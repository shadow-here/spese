import { CategoryIcon } from '../../components/CategoryIcon'
import { Card } from '../../components/ui'
import type { UpcomingItem } from '../../domain/history'
import { incomeKind } from '../../domain/income'
import type { Category } from '../../domain/types'
import { addDays, parseISO, type ISODate } from '../../lib/date'
import { formatDate } from '../../lib/format'
import { formatPaise } from '../../lib/money'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(date: ISODate, today: ISODate): string {
  if (date === addDays(today, 1)) return 'Tomorrow'
  const { year, month, day } = parseISO(date)
  return `${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]} ${formatDate(date)}`
}

/** Upcoming deductions (PRD #16), plus recurring income, for the next 7 days. Hidden when nothing is due. */
export function UpcomingCard({ items, today, categories }: { items: UpcomingItem[]; today: ISODate; categories: Category[] }) {
  if (items.length === 0) return null
  const catById = new Map(categories.map((c) => [c.id, c]))
  const out = items.filter((i) => !i.incoming).reduce((s, i) => s + i.amount, 0)
  return (
    <Card
      title="Next 7 days"
      action={out > 0 ? <span className="tnum text-label text-text-secondary">{formatPaise(out, { decimals: 'auto' })} going out</span> : undefined}
    >
      <ul>
        {items.map((i) => (
          <li key={`${i.fixedExpense.id}|${i.date}`} className="flex min-h-10 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
            <CategoryIcon
              icon={i.incoming ? incomeKind(i.fixedExpense.categoryId).icon : catById.get(i.fixedExpense.categoryId)?.icon}
              className="shrink-0 text-text-secondary"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body">{i.fixedExpense.name}</span>
              <span className="text-label text-text-secondary">{dayLabel(i.date, today)}</span>
            </span>
            <span className={i.incoming ? 'tnum text-body text-positive' : 'tnum text-body text-text-primary'}>
              {formatPaise(i.amount, { signed: i.incoming })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
