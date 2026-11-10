import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string
  action?: ReactNode
}

/** Surface separated by a 1px border — no shadows. */
export function Card({ title, action, className, children, ...rest }: CardProps) {
  return (
    <section className={cn('rounded-card border border-border bg-surface', className)} {...rest}>
      {(title || action) && (
        <header className="flex h-10 items-center justify-between border-b border-border px-4">
          {title && <h2 className="text-label text-text-secondary">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
