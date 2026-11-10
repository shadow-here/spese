import { CategoryIcon } from '../../components/CategoryIcon'
import { ListRow, Tag } from '../../components/ui'
import type { Category, Transaction } from '../../domain/types'
import { formatDate } from '../../lib/format'
import { formatPaise } from '../../lib/money'

/** One transaction as a dense ~40px row. Reused by the Transactions list and the dashboard. */
export function TransactionRow({
  tx,
  category,
  showDate = false,
  onClick,
}: {
  tx: Transaction
  category: Category | undefined
  showDate?: boolean
  onClick?: () => void
}) {
  const categoryName = category?.name ?? 'Other'
  const title = tx.note || categoryName
  const income = tx.type === 'income'
  const subtitle = [tx.note ? categoryName : null, showDate ? formatDate(tx.date) : null].filter(Boolean).join(' · ')
  return (
    <ListRow
      onClick={onClick}
      leading={<CategoryIcon icon={category?.icon} />}
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{title}</span>
          {tx.type === 'auto' && <Tag>Auto</Tag>}
        </span>
      }
      subtitle={subtitle || undefined}
      trailing={
        <span className={income ? 'tnum text-body text-positive' : 'tnum text-body text-text-primary'}>
          {formatPaise(tx.amount, { signed: income })}
        </span>
      }
    />
  )
}
