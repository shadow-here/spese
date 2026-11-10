import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  // Accent is reserved for the primary action.
  // Hover darkens (not lightens) so white text keeps ≥4.5:1.
  primary: 'bg-accent text-on-accent hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-hover',
  ghost: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'bg-surface text-negative border border-border hover:bg-surface-hover',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-label gap-1.5',
  md: 'h-8 px-3 text-body font-medium gap-2',
  lg: 'h-11 px-4 text-body font-medium gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-control transition-quick select-none',
        'disabled:pointer-events-none disabled:text-text-tertiary disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
