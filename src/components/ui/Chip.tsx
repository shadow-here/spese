import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/** Selectable pill (e.g. category picker). Accent marks the current selection. */
export function Chip({ selected = false, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-label transition-quick select-none',
        selected
          ? 'border-accent bg-accent/15 text-text-primary'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        className,
      )}
      {...rest}
    />
  )
}
