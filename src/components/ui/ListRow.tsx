import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ListRowProps {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}

/** Dense ~40px row with a 1px divider. Becomes a button when clickable. */
export function ListRow({ leading, title, subtitle, trailing, onClick, className }: ListRowProps) {
  const content = (
    <>
      {leading && <span className="flex size-4 shrink-0 items-center justify-center text-text-secondary">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-text-primary">{title}</span>
        {subtitle && <span className="truncate text-label text-text-secondary">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  )
  const base = cn(
    'flex min-h-10 w-full items-center gap-3 border-b border-border px-4 py-2 text-left last:border-b-0',
    className,
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, 'transition-quick hover:bg-surface-hover')}>
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  )
}
