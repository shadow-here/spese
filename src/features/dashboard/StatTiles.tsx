import type { CycleSummary } from '../../domain/balance'
import { goalMet } from '../../domain/budgets'
import { fixedShare, safeToSpendToday, type CycleHistoryEntry } from '../../domain/history'
import { cn } from '../../lib/cn'
import { formatPaise } from '../../lib/money'

/** Three at-a-glance numbers for the current cycle (v1.1 Phase 4). Numbers are the hero; labels small. */
export function StatTiles({
  summary,
  lastFinished,
  historyLoaded,
  savingsGoal,
}: {
  summary: CycleSummary
  lastFinished?: CycleHistoryEntry
  /** False while past cycles load — the savings tile waits instead of flashing "after your first cycle". */
  historyLoaded: boolean
  /** With a goal, safe to spend keeps it aside and the savings tile says whether it was met. */
  savingsGoal?: number
}) {
  const safe = safeToSpendToday(summary, savingsGoal)
  const over = summary.freeToSpend < 0
  const eatingGoal = !over && savingsGoal !== undefined && summary.freeToSpend < savingsGoal
  const lastSub = lastFinished
    ? savingsGoal !== undefined
      ? goalMet(lastFinished.summary.remaining, savingsGoal)
        ? 'goal met'
        : `${formatPaise(savingsGoal - lastFinished.summary.remaining, { decimals: 'never' })} short of goal`
      : `${Math.round(lastFinished.savingsRate ?? 0)}% of income`
    : historyLoaded
      ? 'after your first cycle'
      : ' '
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        label="Safe to spend today"
        value={formatPaise(safe, { decimals: 'never' })}
        sub={
          over
            ? 'overspent'
            : eatingGoal
              ? 'spending into your goal'
              : `for ${summary.daysLeft} ${summary.daysLeft === 1 ? 'day' : 'days'}${savingsGoal !== undefined ? ', goal kept' : ''}`
        }
        tone={over ? 'negative' : undefined}
      />
      <Tile label="Fixed costs" value={`${Math.round(fixedShare(summary))}%`} sub="of income" />
      <Tile
        label="Saved last cycle"
        value={lastFinished ? formatPaise(lastFinished.summary.remaining, { decimals: 'never' }) : '—'}
        sub={lastSub}
        tone={lastFinished && lastFinished.summary.remaining < 0 ? 'negative' : undefined}
      />
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'negative' }) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2.5">
      {/* Labels wrap rather than truncate: on a phone each tile is ~110px wide. */}
      <h2 className="text-label text-text-secondary">{label}</h2>
      <p className={cn('tnum mt-auto truncate text-title', tone === 'negative' && 'text-negative')}>{value}</p>
      <p className="text-label text-text-secondary">{sub}</p>
    </section>
  )
}
