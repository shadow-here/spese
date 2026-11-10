import { CircleAlert, TriangleAlert } from 'lucide-react'
import type { CycleSummary } from '../../domain/balance'
import { isLowBalance, type BudgetRow } from '../../domain/budgets'
import { formatPaise } from '../../lib/money'

/**
 * In-app alerts (FR-5.2): remaining below 10% of salary, and categories at 80% / over 100% of
 * their budget. Each line carries an icon and words, not just colour.
 */
export function AlertsBanner({ summary, budgets }: { summary: CycleSummary; budgets: BudgetRow[] }) {
  const over = budgets.filter((b) => b.level === 'over')
  const near = budgets.filter((b) => b.level === 'near')
  const low = isLowBalance(summary) && summary.remaining >= 0 // overspent is already red on the balance card
  if (!low && over.length === 0 && near.length === 0) return null

  const names = (rows: BudgetRow[]) => rows.map((r) => r.category.name).join(', ')
  return (
    <section aria-label="Alerts" className="flex flex-col gap-1.5">
      {low && (
        <p className="flex items-start gap-2 rounded-card border border-warning/30 px-3 py-2 text-label text-warning">
          <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          <span>
            Only {formatPaise(summary.remaining, { decimals: 'never' })} left — under 10% of your salary, with {summary.daysLeft}{' '}
            {summary.daysLeft === 1 ? 'day' : 'days'} to go.
          </span>
        </p>
      )}
      {over.length > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-negative/30 px-3 py-2 text-label text-negative">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          <span>Over budget: {names(over)}</span>
        </p>
      )}
      {near.length > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-warning/30 px-3 py-2 text-label text-warning">
          <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
          <span>Nearly at budget (80%+): {names(near)}</span>
        </p>
      )}
    </section>
  )
}
