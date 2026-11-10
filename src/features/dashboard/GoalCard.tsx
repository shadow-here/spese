import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Card } from '../../components/ui'
import type { CycleSummary } from '../../domain/balance'
import { goalProgress } from '../../domain/budgets'
import { cn } from '../../lib/cn'
import type { Paise } from '../../lib/money'
import { formatPaise } from '../../lib/money'

/** Savings goal progress (FR-5.3) for the current cycle: is the goal still protected? */
export function GoalCard({ summary, goal }: { summary: CycleSummary; goal: Paise }) {
  const g = goalProgress(summary, goal)
  const pct = Math.round((g.protectedAmount / goal) * 100)
  return (
    <Card title="Savings goal">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="tnum text-title">{formatPaise(goal, { decimals: 'never' })}</p>
          <p className={cn('flex items-center gap-1.5 text-label', g.onTrack ? 'text-positive' : 'text-warning')}>
            {g.onTrack ? (
              <CircleCheck size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
            {g.onTrack ? 'On track' : 'At risk'}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Share of the goal still protected"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 overflow-hidden rounded-full bg-surface-hover"
        >
          <div className={cn('h-full rounded-full', g.onTrack ? 'bg-text-primary' : 'bg-warning')} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-label text-text-secondary">
          {g.onTrack ? (
            <>
              <span className="tnum text-text-primary">{formatPaise(g.spendable, { decimals: 'never' })}</span> to spend this cycle and still
              keep it.
            </>
          ) : (
            <>
              Spending has eaten <span className="tnum text-text-primary">{formatPaise(-g.spendable, { decimals: 'never' })}</span> into the
              goal — {formatPaise(g.protectedAmount, { decimals: 'never' })} of it is left.
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
