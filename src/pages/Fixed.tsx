import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Repeat, TriangleAlert } from 'lucide-react'
import { EmptyState } from '../app/EmptyState'
import { Button, Card } from '../components/ui'
import { db } from '../db/db'
import { dueDatesFor, isIncoming } from '../domain/fixed'
import type { Direction, FixedExpense } from '../domain/types'
import { FixedList, useFixedListData } from '../features/fixed/FixedList'
import type { ISODate } from '../lib/date'
import { formatPaise } from '../lib/money'

/** Fixed costs (deduct themselves) and recurring income such as a monthly bonus (adds itself). */
export function FixedPage({ today, onAdd, onEdit }: { today: ISODate; onAdd: (direction: Direction) => void; onEdit: (fe: FixedExpense) => void }) {
  const data = useFixedListData()
  const cycle = useLiveQuery(() => db.cycles.where('status').equals('open').last(), [])
  if (!data || !cycle) return null

  const costs = data.fixed.filter((fe) => !isIncoming(fe))
  const income = data.fixed.filter(isIncoming)

  // Committed this cycle (FR-3.3) = already deducted (as actually charged, skips excluded)
  // + still to come for active ones. Same rule as the dashboard's summarizeCycle.
  let committed = 0
  const handled = new Set<string>()
  for (const t of data.autos) {
    if (t.fixedExpenseId && t.dueDate) handled.add(`${t.fixedExpenseId}|${t.dueDate}`)
    if (t.type === 'auto' && t.cycleId === cycle.id && !t.skipped) committed += t.amount
  }
  for (const fe of costs) {
    for (const due of dueDatesFor(fe, cycle.start, cycle.end)) {
      if (!handled.has(`${fe.id}|${due}`)) committed += fe.amount
    }
  }
  const overSalary = committed > cycle.salary

  return (
    <div className="flex flex-col gap-4">
      {costs.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No fixed expenses"
          body="Add rent, WiFi, gym or subscriptions and they'll deduct themselves on their due day."
          action={
            <Button variant="primary" onClick={() => onAdd('out')}>
              Add fixed expense
            </Button>
          }
        />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-label text-text-secondary">Committed this cycle</p>
              <p className="tnum text-title">{formatPaise(committed)}</p>
              <p className="text-label text-text-secondary">
                of <span className="tnum">{formatPaise(cycle.salary, { decimals: 'auto' })}</span> salary
              </p>
            </div>
            <Button variant="secondary" onClick={() => onAdd('out')} aria-label="Add fixed expense">
              <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
              Add
            </Button>
          </Card>
          {overSalary && (
            <p role="alert" className="flex items-center gap-2 rounded-card border border-negative/30 px-3 py-2 text-label text-negative">
              <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
              Fixed costs are more than your salary — your balance will go negative.
            </p>
          )}
          <FixedList data={{ ...data, fixed: costs }} today={today} onEdit={onEdit} />
        </>
      )}

      <section aria-labelledby="recurring-income" className="mt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 id="recurring-income" className="text-label text-text-secondary">
            Recurring income
          </h2>
          <Button variant="ghost" size="sm" onClick={() => onAdd('in')} aria-label="Add recurring income">
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Add
          </Button>
        </div>
        {income.length > 0 ? (
          <FixedList data={{ ...data, fixed: income }} today={today} onEdit={onEdit} />
        ) : (
          <p className="rounded-card border border-dashed border-border px-4 py-3 text-label text-text-secondary">
            A monthly bonus or allowance? Add it once and it adds itself to each cycle on its day.
          </p>
        )}
      </section>
    </div>
  )
}
