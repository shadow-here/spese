import { cn } from '../../lib/cn'

/** Two-to-four option switch (e.g. Expense / Income). Accent marks the current selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-control border border-border bg-surface p-0.5', className)}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 flex-1 rounded-[4px] px-3 text-label transition-quick',
              selected ? 'bg-surface-hover text-text-primary shadow-[inset_0_0_0_1px_var(--accent)]' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
