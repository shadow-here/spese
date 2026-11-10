import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { Card } from '../../components/ui'
import type { CycleHistoryEntry } from '../../domain/history'
import { formatDate, formatRange } from '../../lib/format'
import { formatPaise } from '../../lib/money'

const AXIS = { stroke: 'var(--text-secondary)', fontSize: 11, tickLine: false, axisLine: false } as const

interface Point {
  label: string
  range: string
  rate: number
  saved: number
}

/**
 * Savings rate (P1 widget): what was left at the end of each finished cycle ÷ its income.
 * One series, so no legend — the title names it. Shown from 2 finished cycles.
 */
export function SavingsTrend({ finished }: { finished: CycleHistoryEntry[] }) {
  const points: Point[] = finished.map((h) => ({
    label: formatDate(h.cycle.start),
    range: formatRange(h.cycle.start, h.cycle.end),
    rate: Math.round((h.savingsRate ?? 0) * 10) / 10,
    saved: h.summary.remaining,
  }))
  const avg = points.reduce((s, p) => s + p.rate, 0) / points.length
  const hasNegative = points.some((p) => p.rate < 0)

  return (
    <Card title="Savings rate">
      <div className="px-2 pt-3 pb-1">
        <p className="px-2 pb-2 text-label text-text-secondary">
          Average <span className="tnum text-text-primary">{Math.round(avg)}%</span> of income saved over the last {points.length} cycles
        </p>
        <div className="h-36" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS} />
              <YAxis width={40} tickFormatter={(v: number) => `${v}%`} tickCount={3} domain={hasNegative ? ['auto', 'auto'] : [0, 'auto']} {...AXIS} />
              {hasNegative && <ReferenceLine y={0} stroke="var(--border)" />}
              <Tooltip content={<SavingsTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} isAnimationActive={false} />
              <Line
                dataKey="rate"
                stroke="var(--text-primary)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--text-primary)', stroke: 'var(--surface)', strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="px-2 pb-2 text-label text-text-secondary">
          <summary className="cursor-pointer py-1 hover:text-text-primary">Show as table</summary>
          <table className="mt-1 w-full">
            <thead>
              <tr className="text-left">
                <th className="py-1 font-medium">Cycle</th>
                <th className="py-1 text-right font-medium">Saved</th>
                <th className="py-1 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="tnum text-text-primary">
              {points.map((p) => (
                <tr key={p.range} className="border-t border-border">
                  <td className="py-1">{p.range}</td>
                  <td className="py-1 text-right">{formatPaise(p.saved, { decimals: 'never' })}</td>
                  <td className="py-1 text-right">{p.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </Card>
  )
}

function SavingsTooltip({ active, payload }: TooltipProps<number, string>) {
  const p = payload?.[0]?.payload as Point | undefined
  if (!active || !p) return null
  return (
    <div className="rounded-control border border-border bg-surface-hover px-2.5 py-1.5 text-label">
      <p className="text-text-secondary">{p.range}</p>
      <p className="tnum text-text-primary">
        Saved {formatPaise(p.saved, { decimals: 'never' })} · {p.rate}%
      </p>
    </div>
  )
}
