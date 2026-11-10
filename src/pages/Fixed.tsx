import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Repeat, TriangleAlert } from 'lucide-react'
import { EmptyState } from '../app/EmptyState'
import { Button, Card } from '../components/ui'
import { db } from '../db/db'
import { dueDatesFor } from '../domain/fixed'
import type { FixedExpense } from '../domain/types'
import { FixedList, useFixedListData } from '../features/fixed/FixedList'
import type { ISODate } from '../lib/date'
import { formatPaise } from '../lib/money'

export function FixedPage({ today, onAdd, onEdit }: { today: ISODate; onAdd: () => void; onEdit: (fe: FixedExpense) => void }) {
  const data = useFixedListData()
  const cycle = useLiveQuery(() => db.cycles.where('status').equals('open').last(), [])
  if (!data || !cycle) return null

  if (data.fixed.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title="No fixed expenses"
        body="Add rent, WiFi, gym or subscriptions and they'll deduct themselves on their due day."
        action={
          <Button variant="primary" onClick={onAdd}>
            Add fixed expense
          </Button>
        }
      />
    )
  }

  // Committed this cycle (FR-3.3) = already deducted (as actually charged, skips excluded)
  // + still to come for active ones. Same rule as the dashboard's summarizeCycle.
  let committed = 0
  const handled = new Set<string>()
  for (const t of data.autos) {
    if (t.fixedExpenseId && t.dueDate) handled.add(`${t.fixedExpenseId}|${t.dueDate}`)
    if (t.cycleId === cycle.id && !t.skipped) committed += t.amount
  }
  for (const fe of data.fixed) {
    for (const due of dueDatesFor(fe, cycle.start, cycle.end)) {
      if (!handled.has(`${fe.id}|${due}`)) committed += fe.amount
    }
  }
  const overSalary = committed > cycle.salary

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-label text-text-secondary">Committed this cycle</p>
          <p className="tnum text-title">{formatPaise(committed)}</p>
          <p className="text-label text-text-secondary">
            of <span className="tnum">{formatPaise(cycle.salary, { decimals: 'auto' })}</span> salary
          </p>
        </div>
        <Button variant="secondary" onClick={onAdd}>
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
      <FixedList data={data} today={today} onEdit={onEdit} />
    </div>
  )
}
