import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface AmountInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  value: string
  onChange: (value: string) => void
  label: string
  /** 'lg' is the hero field (balance-sized digits) used in onboarding and add-expense. */
  size?: 'md' | 'lg'
  hideLabel?: boolean
  error?: string
}

/**
 * Rupee amount field: ₹ prefix, decimal keypad on phones, tabular digits.
 * Keeps the raw string; callers parse with parseRupees() so no float ever touches money.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { value, onChange, label, size = 'md', hideLabel = false, error, className, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const large = size === 'lg'
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cn('text-label text-text-secondary', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-1 rounded-control border bg-surface px-3 transition-quick',
          'focus-within:border-accent hover:border-text-tertiary',
          error ? 'border-negative' : 'border-border',
          large ? 'h-16' : 'h-9',
        )}
      >
        <span aria-hidden="true" className={cn('text-text-secondary', large ? 'text-title font-normal' : 'text-body')}>
          ₹
        </span>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'tnum w-full min-w-0 bg-transparent text-text-primary outline-none',
            large ? 'text-balance' : 'text-body',
            className,
          )}
          {...rest}
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-label text-negative">
          {error}
        </p>
      )}
    </div>
  )
})
