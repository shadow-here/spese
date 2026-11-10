import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListOrdered } from 'lucide-react'
import { EmptyState } from '../app/EmptyState'
import { Button } from '../components/ui'
import { db } from '../db/db'
import { TransactionRow } from '../features/expenses/TransactionRow'
import { netAmount, refundsByExpense } from '../domain/refunds'
import type { Transaction } from '../domain/types'
import { addDays, type ISODate } from '../lib/date'
import { formatDate } from '../lib/format'
import { formatPaise } from '../lib/money'

function dayLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return formatDate(date, date.slice(0, 4) !== today.slice(0, 4))
}

/** Dense list grouped by day, newest first. Skipped auto-deductions are hidden. */
export function TransactionsPage({ today, onAdd, onEdit }: { today: ISODate; onAdd: () => void; onEdit: (tx: Transaction) => void }) {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catById = useMemo(() => new Map(categories?.map((c) => [c.id, c])), [categories])

  const refunds = useMemo(() => {
    const all = transactions ?? []
    return refundsByExpense(all, new Map(all.map((t) => [t.id, t])))
  }, [transactions])

  const groups = useMemo(() => {
    // Refunds show on their expense, never as their own row.
    const visible = (transactions ?? []).filter((t) => !t.skipped && t.type !== 'refund')
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
  }, [transactions, refunds])

  if (!transactions || !categories) return null

  if (groups.length === 0) {
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

  return (
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
  )
}
