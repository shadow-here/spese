import { cn } from '../../lib/cn'

/** Accessible on/off switch. Accent marks "on" (the current selection). */
export function Switch({
  checked,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name, e.g. "Active: WiFi". */
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-5 w-8 shrink-0 items-center rounded-full border transition-quick disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-border bg-surface-hover',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-3.5 rounded-full transition-quick',
          checked ? 'translate-x-[13px] bg-text-primary' : 'translate-x-[2px] bg-text-secondary',
        )}
      />
    </button>
  )
}
