import { CircleAlert, TriangleAlert } from 'lucide-react'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Card, Tag } from '../../components/ui'
import type { BudgetRow } from '../../domain/budgets'
import { cn } from '../../lib/cn'
import { formatPaise } from '../../lib/money'

/**
 * Budget progress (P1): spent vs limit per budgeted category. Status colours are reserved for
 * state and always come with an icon and a word — never colour alone.
 */
export function BudgetsCard({ rows }: { rows: BudgetRow[] }) {
  if (rows.length === 0) return null
  return (
    <Card title="Budgets">
      <ul>
        {rows.map((r) => (
          <li key={r.category.id} className="flex flex-col gap-1.5 border-b border-border px-4 py-2.5 last:border-b-0">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={r.category.icon} className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate text-body">{r.category.name}</span>
              {r.level === 'over' && (
                <Tag tone="negative">
                  <CircleAlert size={10} strokeWidth={2} aria-hidden="true" className="mr-0.5" />
                  Over by {formatPaise(-r.left, { decimals: 'never' })}
                </Tag>
              )}
              {r.level === 'near' && (
                <Tag tone="warning">
                  <TriangleAlert size={10} strokeWidth={2} aria-hidden="true" className="mr-0.5" />
                  {Math.round(r.percent)}% used
                </Tag>
              )}
              <span className="tnum text-label text-text-secondary">
                <span className="text-text-primary">{formatPaise(r.spent, { decimals: 'never' })}</span> of{' '}
                {formatPaise(r.limit, { decimals: 'never' })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${r.category.name} budget used`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(r.percent))}
              className="ml-7 h-1 overflow-hidden rounded-full bg-surface-hover"
            >
              <div
                className={cn('h-full rounded-full', r.level === 'over' ? 'bg-negative' : r.level === 'near' ? 'bg-warning' : 'bg-text-secondary')}
                style={{ width: `${Math.min(100, r.percent)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
