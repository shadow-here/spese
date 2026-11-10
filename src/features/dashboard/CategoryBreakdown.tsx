import { useState } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { Card } from '../../components/ui'
import type { CategorySpend } from '../../domain/balance'
import type { Category } from '../../domain/types'
import { cn } from '../../lib/cn'
import { formatPaise } from '../../lib/money'

/**
 * Spend by category (P0): donut + ranked list. The donut keeps the fixed category order
 * (the order the palette is validated in); the list ranks by amount and carries the names,
 * amounts and shares, so identity never depends on colour. Hovering either highlights both.
 */
export const REST = '__rest'
const MAX_SEGMENTS = 8

/**
 * Donut segments: never more than 8 (the palette size). Past that, the 7 biggest keep their own
 * segment and the rest fold into one neutral "N more". Kept segments follow the category order
 * (`items` arrives ranked by amount). The ranked list still names every category.
 */
export function donutSegments(items: CategorySpend[], categories: Category[]): { donut: CategorySpend[]; foldedIds: Set<string> } {
  const order = new Map(categories.map((c) => [c.id, c.order]))
  const folded = items.length > MAX_SEGMENTS ? items.slice(MAX_SEGMENTS - 1) : []
  const foldedIds = new Set(folded.map((i) => i.categoryId))
  const kept = items.filter((i) => !foldedIds.has(i.categoryId))
  const donut: CategorySpend[] = [
    ...kept.sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99)),
    ...(folded.length
      ? [{ categoryId: REST, name: `${folded.length} more`, colour: '#62666D', amount: folded.reduce((s, i) => s + i.amount, 0), percent: 0 }]
      : []),
  ]
  return { donut, foldedIds }
}

export function CategoryBreakdown({ items, categories }: { items: CategorySpend[]; categories: Category[] }) {
  const [active, setActive] = useState<string>()
  if (items.length === 0) return null

  const { donut, foldedIds } = donutSegments(items, categories)
  const total = items.reduce((s, i) => s + i.amount, 0)
  const focused = items.find((i) => i.categoryId === active)
  // Hovering a folded category in the list highlights the shared segment.
  const activeSegment = active && foldedIds.has(active) ? REST : active

  return (
    <Card title="Spend by category">
      <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
        <div className="relative size-36 shrink-0" aria-hidden="true">
          <PieChart width={144} height={144}>
            <Pie
              data={donut}
              dataKey="amount"
              nameKey="name"
              innerRadius={50}
              outerRadius={70}
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              // The donut is decorative (aria-hidden; the list carries the data), so keep it out of the tab order.
              rootTabIndex={-1}
              onMouseEnter={(d: CategorySpend) => setActive(d.categoryId)}
              onMouseLeave={() => setActive(undefined)}
            >
              {donut.map((d) => (
                <Cell key={d.categoryId} fill={d.colour} fillOpacity={activeSegment && activeSegment !== d.categoryId ? 0.35 : 1} />
              ))}
            </Pie>
          </PieChart>
          {/* Centre label: total, or the hovered category */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-label text-text-secondary">{focused ? focused.name : active === REST ? donut.at(-1)!.name : 'Total'}</span>
            <span className="tnum text-body font-medium text-text-primary">
              {formatPaise(focused ? focused.amount : active === REST ? donut.at(-1)!.amount : total, { decimals: 'never' })}
            </span>
          </div>
        </div>

        <ol className="w-full min-w-0 flex-1">
          {items.map((i) => (
            <li
              key={i.categoryId}
              onMouseEnter={() => setActive(i.categoryId)}
              onMouseLeave={() => setActive(undefined)}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-control px-2 transition-quick',
                active === i.categoryId && 'bg-surface-hover',
              )}
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ background: i.colour }} />
              <span className="min-w-0 flex-1 truncate text-body text-text-primary">{i.name}</span>
              <span className="tnum w-10 text-right text-label text-text-secondary">{Math.round(i.percent)}%</span>
              <span className="tnum w-24 text-right text-body text-text-primary">{formatPaise(i.amount, { decimals: 'auto' })}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}
