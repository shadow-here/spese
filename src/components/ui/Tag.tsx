import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'positive' | 'warning' | 'negative'

const tones: Record<Tone, string> = {
  neutral: 'text-text-secondary border-border',
  positive: 'text-positive border-positive/30',
  warning: 'text-warning border-warning/30',
  negative: 'text-negative border-negative/30',
}

/** Small inline label, e.g. "Auto" on auto-deductions. */
export function Tag({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded-[4px] border px-1 text-[0.625rem] leading-none font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
