import { Card } from '../../components/ui'
import type { CycleSummary } from '../../domain/balance'
import { formatPaise, percentOf } from '../../lib/money'

/**
 * Income vs outflow (P0): income split into fixed, variable spent and remaining, as one
 * stacked bar. Monochrome greys of rising lightness (remaining brightest — it's the hero);
 * every segment is labelled with its value below, so identity is never colour alone.
 */
const SEGMENTS = [
  { key: 'fixed', label: 'Fixed', colour: '#62666D' },
  { key: 'variable', label: 'Spent', colour: '#8A8F98' },
  { key: 'remaining', label: 'Remaining', colour: '#D0D3D8' },
] as const

export function OutflowBar({ summary }: { summary: CycleSummary }) {
  const values = {
    fixed: summary.fixedDeducted,
    variable: summary.variableSpent,
    remaining: Math.max(0, summary.remaining),
  }
  // Overspent: the bar shows outflow only, scaled to itself.
  const total = Math.max(summary.totalIncome, summary.fixedDeducted + summary.variableSpent)

  return (
    <Card title="Income vs outflow">
      <div className="p-4">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-[4px]" role="img" aria-label={SEGMENTS.map((s) => `${s.label} ${formatPaise(values[s.key])}`).join(', ')}>
          {SEGMENTS.map((s) => {
            const pct = percentOf(values[s.key], total)
            if (pct <= 0) return null
            return (
              <div
                key={s.key}
                title={`${s.label}: ${formatPaise(values[s.key])} (${Math.round(pct)}%)`}
                className="h-full"
                style={{ width: `${pct}%`, background: s.colour, minWidth: 4 }}
              />
            )
          })}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {SEGMENTS.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5">
              <dt className="flex items-center gap-1.5 text-label text-text-secondary">
                <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: s.colour }} />
                {s.label}
              </dt>
              <dd className="tnum text-body text-text-primary">{formatPaise(values[s.key], { decimals: 'auto' })}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  )
}
