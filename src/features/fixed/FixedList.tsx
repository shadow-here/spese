import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CategoryIcon } from '../../components/CategoryIcon'
import { useToast } from '../../components/Toast'
import { Button, Switch, Tag } from '../../components/ui'
import { db } from '../../db/db'
import { pauseFixedExpense, resumeFixedExpense, unskipDeduction } from '../../db/fixedExpenses'
import { isEnded, isIncoming, nextDueDate } from '../../domain/fixed'
import { incomeKind } from '../../domain/income'
import type { FixedExpense, Transaction } from '../../domain/types'
import type { ISODate } from '../../lib/date'
import { formatDate } from '../../lib/format'
import { formatPaise } from '../../lib/money'

export interface FixedListData {
  fixed: FixedExpense[]
  autos: Transaction[]
  cycleId: string
}

/** Live data for the fixed list, shared with onboarding. `autos` = every row created from a recurring entry. */
export function useFixedListData(): FixedListData | undefined {
  return useLiveQuery(async () => {
    const [fixed, autos, cycle] = await Promise.all([
      db.fixedExpenses.toArray(),
      db.transactions.where('fixedExpenseId').above('').toArray(),
      db.cycles.where('status').equals('open').last(),
    ])
    return { fixed: fixed.sort((a, b) => a.deductionDay - b.deductionDay || a.name.localeCompare(b.name)), autos, cycleId: cycle?.id ?? '' }
  }, [])
}

/** Feature 7/9 list: amount, next deduction date and a pause toggle (Design system "Fixed expenses"). */
export function FixedList({
  data,
  today,
  onEdit,
  showEnded = true,
}: {
  data: FixedListData
  today: ISODate
  onEdit: (fe: FixedExpense) => void
  showEnded?: boolean
}) {
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const catById = useMemo(() => new Map(categories?.map((c) => [c.id, c])), [categories])
  const handled = useMemo(() => {
    const map = new Map<string, Set<ISODate>>()
    for (const t of data.autos) {
      if (!t.fixedExpenseId || !t.dueDate) continue
      const set = map.get(t.fixedExpenseId) ?? new Set()
      set.add(t.dueDate)
      map.set(t.fixedExpenseId, set)
    }
    return map
  }, [data.autos])
  const skippedThisCycle = useMemo(
    () => new Map(data.autos.filter((t) => t.skipped && t.cycleId === data.cycleId).map((t) => [t.fixedExpenseId!, t])),
    [data.autos, data.cycleId],
  )

  const active = data.fixed.filter((fe) => !isEnded(fe, today))
  const ended = data.fixed.filter((fe) => isEnded(fe, today))

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {active.map((fe) => (
            <FixedRow
              key={fe.id}
              fe={fe}
              icon={isIncoming(fe) ? incomeKind(fe.categoryId).icon : catById.get(fe.categoryId)?.icon}
              today={today}
              next={nextDueDate(fe, today, handled.get(fe.id) ?? new Set())}
              skipped={skippedThisCycle.get(fe.id)}
              onEdit={() => onEdit(fe)}
            />
          ))}
        </div>
      )}
      {showEnded && ended.length > 0 && (
        <section aria-label="Ended">
          <h2 className="flex h-8 items-center px-1 text-label text-text-secondary">Ended</h2>
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {ended.map((fe) => (
              <div key={fe.id} className="flex min-h-10 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
                <CategoryIcon
                  icon={isIncoming(fe) ? incomeKind(fe.categoryId).icon : catById.get(fe.categoryId)?.icon}
                  className="text-text-tertiary"
                />
                <span className="flex-1 truncate text-body text-text-secondary">{fe.name}</span>
                <span className="text-label text-text-secondary">Ended {formatDate(fe.endDate!)}</span>
                <span className="tnum text-body text-text-secondary">{formatPaise(fe.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FixedRow({
  fe,
  icon,
  today,
  next,
  skipped,
  onEdit,
}: {
  fe: FixedExpense
  icon: string | undefined
  today: ISODate
  next: ISODate | undefined
  skipped: Transaction | undefined
  onEdit: () => void
}) {
  const toast = useToast()
  const status = fe.isPaused ? 'Paused' : next ? `Next ${formatDate(next)}` : fe.endDate ? `Ends ${formatDate(fe.endDate)}` : '—'

  async function toggle(on: boolean) {
    if (on) await resumeFixedExpense(fe.id, today)
    else await pauseFixedExpense(fe.id, today)
    toast.show(on ? `${fe.name} resumed` : `${fe.name} paused`, { durationMs: 2000 })
  }

  return (
    <div className="flex min-h-10 items-center border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left transition-quick hover:bg-surface-hover"
      >
        <CategoryIcon icon={icon} className="shrink-0 text-text-secondary" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={fe.isPaused ? 'truncate text-body text-text-secondary' : 'truncate text-body text-text-primary'}>{fe.name}</span>
          <span className="flex items-center gap-2 text-label text-text-secondary">
            {status}
            {skipped && <Tag>Skipped this cycle</Tag>}
          </span>
        </span>
        <span
          className={
            fe.isPaused ? 'tnum pr-3 text-body text-text-secondary' : isIncoming(fe) ? 'tnum pr-3 text-body text-positive' : 'tnum pr-3 text-body text-text-primary'
          }
        >
          {formatPaise(fe.amount, { signed: isIncoming(fe) })}
        </span>
      </button>
      {skipped && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void unskipDeduction(skipped.id).then(() => toast.show(`${fe.name} ${isIncoming(fe) ? 'added' : 'deducted'} again`, { durationMs: 2000 }))}
        >
          Restore
        </Button>
      )}
      <div className="flex items-center pr-4 pl-1">
        <Switch checked={!fe.isPaused} onChange={(on) => void toggle(on)} label={`Active: ${fe.name}`} />
      </div>
    </div>
  )
}
