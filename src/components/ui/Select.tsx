import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
}

/** Native select (best on phones) styled to match Input. */
export function Select({ label, hint, className, id, children, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-label text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'h-9 w-full appearance-none rounded-control border border-border bg-surface pr-9 pl-3 text-body text-text-primary',
            'transition-quick hover:border-text-tertiary focus-visible:border-accent focus-visible:outline-none',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
        />
      </div>
      {hint && <p className="text-label text-text-secondary">{hint}</p>}
    </div>
  )
}
