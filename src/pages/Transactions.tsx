import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListOrdered, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState } from '../app/EmptyState'
import { Button } from '../components/ui'
import { db } from '../db/db'
import { TransactionRow } from '../features/expenses/TransactionRow'
import { filterTransactions, isFilterActive, type TransactionFilter } from '../domain/filter'
import { INCOME_KINDS } from '../domain/income'
import { PAYMENT_METHODS } from '../domain/payment'
import { netAmount, refundsByExpense } from '../domain/refunds'
import type { PaymentMethod, Transaction } from '../domain/types'
import { cn } from '../lib/cn'
import { addDays, type ISODate } from '../lib/date'
import { formatDate } from '../lib/format'
import { formatPaise } from '../lib/money'

/** The search box's id — the "/" shortcut focuses it (PRD Design system: "/ = search"). */
export const TRANSACTION_SEARCH_ID = 'transaction-search'

let focusSearchWhenShown = false

/**
 * Focus the search box. If it isn't on screen yet (we're switching to Transactions, which
 * happens on the next hashchange), it focuses itself as soon as it renders.
 */
export function focusTransactionSearch() {
  const el = document.getElementById(TRANSACTION_SEARCH_ID)
  if (el) el.focus()
  else focusSearchWhenShown = true
}

function searchRef(el: HTMLInputElement | null) {
  if (el && focusSearchWhenShown) {
    focusSearchWhenShown = false
    el.focus()
  }
}

function dayLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return formatDate(date, date.slice(0, 4) !== today.slice(0, 4))
}

const FIELD =
  'h-8 rounded-control border border-border bg-surface px-2 text-label text-text-primary transition-quick hover:border-text-tertiary focus-visible:border-accent focus-visible:outline-none'

/** Dense list grouped by day, newest first, with search and filters (PRD #22). Refund rows and skipped auto-deductions are hidden. */
export function TransactionsPage({ today, onAdd, onEdit }: { today: ISODate; onAdd: () => void; onEdit: (tx: Transaction) => void }) {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const catById = useMemo(() => new Map(categories?.map((c) => [c.id, c])), [categories])
  const [filter, setFilter] = useState<TransactionFilter>({})
  const [showFilters, setShowFilters] = useState(false)
  const active = isFilterActive(filter)
  const set = (patch: Partial<TransactionFilter>) => setFilter((f) => ({ ...f, ...patch }))

  const refunds = useMemo(() => {
    const all = transactions ?? []
    return refundsByExpense(all, new Map(all.map((t) => [t.id, t])))
  }, [transactions])

  const visible = useMemo(() => filterTransactions(transactions ?? [], filter, categories ?? []), [transactions, filter, categories])

  const groups = useMemo(() => {
    const map = new Map<ISODate, Transaction[]>()
    for (const t of visible) {
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
      spent: items
        .filter((t) => t.type === 'expense' || t.type === 'auto')
        .reduce((s, t) => s + (t.type === 'expense' ? netAmount(t, refunds.get(t.id)) : t.amount), 0),
    }))
  }, [visible, refunds])

  const totalShown = useMemo(
    () =>
      visible
        .filter((t) => t.type === 'expense' || t.type === 'auto')
        .reduce((s, t) => s + (t.type === 'expense' ? netAmount(t, refunds.get(t.id)) : t.amount), 0),
    [visible, refunds],
  )

  if (!transactions || !categories) return null

  const anyRows = transactions.some((t) => t.type !== 'refund' && !t.skipped)
  if (!anyRows) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No transactions yet"
        body="Expenses and auto-deductions will appear here, grouped by day."
        action={
          <Button variant="primary" onClick={onAdd}>
            Add expense
          </Button>
        }
      />
    )
  }

  const filtersSet = Boolean(filter.categoryId || filter.paymentMethod || filter.from || filter.to)

  return (
    <div className="flex flex-col gap-4">
      {/* Filters live in one row above the list. */}
      <div role="search" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search transactions</span>
            <Search size={16} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-secondary" />
            <input
              ref={searchRef}
              id={TRANSACTION_SEARCH_ID}
              type="search"
              placeholder="Search notes, categories, amounts…"
              value={filter.text ?? ''}
              onChange={(e) => set({ text: e.target.value })}
              onKeyDown={(e) => e.key === 'Escape' && set({ text: '' })}
              className="h-9 w-full rounded-control border border-border bg-surface pr-3 pl-8 text-body text-text-primary transition-quick hover:border-text-tertiary focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          <Button
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-controls="transaction-filters"
            className={cn('h-9', filtersSet && 'border-accent')}
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
            Filters{filtersSet ? ' •' : ''}
          </Button>
        </div>

        {showFilters && (
          <div id="transaction-filters" className="flex flex-wrap items-center gap-2">
            <select aria-label="Category" value={filter.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })} className={FIELD}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="income">All income</option>
              {INCOME_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  Income · {k.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Paid with"
              value={filter.paymentMethod ?? ''}
              onChange={(e) => set({ paymentMethod: (e.target.value || undefined) as PaymentMethod | undefined })}
              className={FIELD}
            >
              <option value="">Any payment</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {/* From and To stay on one line together when the row wraps. */}
            <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-label text-text-secondary">
              From
              <input type="date" value={filter.from ?? ''} max={filter.to} onChange={(e) => set({ from: e.target.value || undefined })} className={cn(FIELD, 'tnum [color-scheme:dark]')} />
            </label>
            <label className="flex items-center gap-1.5 text-label text-text-secondary">
              To
              <input type="date" value={filter.to ?? ''} min={filter.from} onChange={(e) => set({ to: e.target.value || undefined })} className={cn(FIELD, 'tnum [color-scheme:dark]')} />
            </label>
            </div>
          </div>
        )}

        {active && (
          <div className="flex items-center justify-between gap-2 px-1 text-label text-text-secondary" aria-live="polite">
            <span>
              {visible.length} {visible.length === 1 ? 'result' : 'results'}
              {totalShown > 0 && (
                <>
                  {' · '}
                  <span className="tnum text-text-primary">{formatPaise(totalShown, { decimals: 'auto' })}</span> spent
                </>
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={SearchX} title="Nothing matches" body="Try a different word, or clear the filters." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.date} aria-label={dayLabel(g.date, today)}>
              <header className="flex h-8 items-center justify-between px-1 text-label text-text-secondary">
                <h2>{dayLabel(g.date, today)}</h2>
                {g.spent > 0 && <span className="tnum">{formatPaise(g.spent)}</span>}
              </header>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                {g.items.map((t) => (
                  <TransactionRow key={t.id} tx={t} category={catById.get(t.categoryId)} refunds={refunds.get(t.id)} onClick={() => onEdit(t)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
