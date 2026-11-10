import { Card } from '../../components/ui'
import type { CycleSummary } from '../../domain/balance'
import { cn } from '../../lib/cn'
import { formatPaise } from '../../lib/money'

/** Hero: remaining ₹, % of income left, days left, progress bar (Dashboard analytics, P0). */
export function BalanceCard({ summary, isCurrent }: { summary: CycleSummary; isCurrent: boolean }) {
  const negative = summary.remaining < 0
  const left = Math.max(0, Math.min(100, summary.percentLeft))
  return (
    <Card className="p-4">
      <p className="text-label text-text-secondary">{isCurrent ? 'Remaining this cycle' : 'Left at cycle end (saved)'}</p>
      <p className={cn('tnum text-balance', negative && 'text-negative')}>{formatPaise(summary.remaining)}</p>
      <div
        role="progressbar"
        aria-label="Share of income left"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(left)}
        className="mt-3 h-1 overflow-hidden rounded-full bg-surface-hover"
      >
        <div className={cn('h-full rounded-full', negative ? 'bg-negative' : 'bg-text-primary')} style={{ width: `${negative ? 100 : left}%` }} />
      </div>
      <p className="mt-2 text-label text-text-secondary">
        {negative ? (
          <span className="text-negative">Overspent by {formatPaise(-summary.remaining)}</span>
        ) : (
          <>
            <span className="tnum">{Math.round(summary.percentLeft)}%</span> of{' '}
            <span className="tnum">{formatPaise(summary.totalIncome, { decimals: 'auto' })}</span> left
          </>
        )}
        {isCurrent && (
          <>
            {' · '}
            <span className="tnum">{summary.daysLeft}</span> {summary.daysLeft === 1 ? 'day' : 'days'} left
          </>
        )}
      </p>
      {isCurrent && summary.fixedUpcoming > 0 && (
        <p className="mt-1 text-label text-text-secondary">
          <span className="tnum">{formatPaise(summary.fixedUpcoming, { decimals: 'auto' })}</span> fixed still to come ·{' '}
          <span className={cn('tnum', summary.freeToSpend < 0 ? 'text-negative' : 'text-text-primary')}>
            {formatPaise(summary.freeToSpend, { decimals: 'auto' })}
          </span>{' '}
          free to spend
        </p>
      )}
    </Card>
  )
}
