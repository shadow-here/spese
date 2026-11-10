import { useMemo } from 'react'
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { Card } from '../../components/ui'
import type { DailyPoint } from '../../domain/balance'
import type { ISODate } from '../../lib/date'
import { formatDate } from '../../lib/format'
import { formatPaise, formatPaiseCompact } from '../../lib/money'

// Axis labels are text: secondary ink (6:1), not tertiary (3.4:1, below AA).
const AXIS = { stroke: 'var(--text-secondary)', fontSize: 11, tickLine: false, axisLine: false } as const

/**
 * Daily trend (P0): cumulative spend vs ideal pace on one axis, with daily spend as a
 * separate small bar chart below on the same x — two charts rather than a dual axis.
 * Accent is reserved for the current cycle's line. Hover shows a crosshair tooltip.
 */
export function DailyTrend({ daily, today, isCurrent }: { daily: DailyPoint[]; today: ISODate; isCurrent: boolean }) {
  const data = useMemo(() => daily.map((d) => ({ ...d, label: formatDate(d.date) })), [daily])
  const elapsed = daily.filter((d) => d.cumulative !== null)
  const last = elapsed.at(-1)
  const idealToday = last?.ideal ?? 0
  const ahead = last ? last.cumulative! - idealToday : 0
  const ticks = [data[0]?.label, data[Math.floor(data.length / 2)]?.label, data.at(-1)?.label].filter(Boolean) as string[]

  return (
    <Card title="Daily trend">
      <div className="px-2 pt-3 pb-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-2 text-label text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-accent" />
            Spent so far
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0 w-3 border-t border-dashed border-text-secondary" />
            Even pace
          </span>
          {last && isCurrent && (
            <span className="ml-auto">
              {ahead > 0 ? (
                <>
                  <span className="tnum text-text-primary">{formatPaise(ahead, { decimals: 'never' })}</span> over even pace
                </>
              ) : (
                <>
                  <span className="tnum text-text-primary">{formatPaise(-ahead, { decimals: 'never' })}</span> under even pace
                </>
              )}
            </span>
          )}
        </div>
        <div className="h-40" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 20, bottom: 4, left: 0 }} syncId="trend">
              <XAxis dataKey="label" ticks={ticks} interval={0} {...AXIS} hide />
              <YAxis width={44} tickFormatter={formatPaiseCompact} tickCount={3} {...AXIS} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} isAnimationActive={false} />
              <Line dataKey="ideal" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
              <Line
                dataKey="cumulative"
                stroke={isCurrent ? 'var(--accent)' : 'var(--text-primary)'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 border-t border-border px-2 pt-2 text-label text-text-secondary">Spent per day</p>
        <div className="h-16" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 20, bottom: 0, left: 0 }} syncId="trend" barCategoryGap={1}>
              <XAxis dataKey="label" ticks={ticks} interval={0} {...AXIS} />
              <YAxis width={44} tickFormatter={formatPaiseCompact} tickCount={2} {...AXIS} />
              {/* Synced with the line chart: highlight the day here, show the one tooltip up there. */}
              <Tooltip content={() => null} cursor={{ fill: 'var(--surface-hover)' }} isAnimationActive={false} />
              <Bar dataKey="spent" fill="var(--text-secondary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="px-2 pb-2 text-label text-text-secondary">
          <summary className="cursor-pointer py-1 hover:text-text-primary">Show as table</summary>
          <table className="mt-1 w-full">
            <thead>
              <tr className="text-left">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">Spent</th>
                <th className="py-1 text-right font-medium">So far</th>
                <th className="py-1 text-right font-medium">Even pace</th>
              </tr>
            </thead>
            <tbody className="tnum text-text-primary">
              {elapsed.map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="py-1">{d.date === today ? 'Today' : formatDate(d.date)}</td>
                  <td className="py-1 text-right">{formatPaise(d.spent, { decimals: 'auto' })}</td>
                  <td className="py-1 text-right">{formatPaise(d.cumulative!, { decimals: 'auto' })}</td>
                  <td className="py-1 text-right text-text-secondary">{formatPaise(d.ideal, { decimals: 'never' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </Card>
  )
}

function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = payload?.[0]?.payload as (DailyPoint & { label: string }) | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-control border border-border bg-surface-hover px-2.5 py-1.5 text-label shadow-none">
      <p className="text-text-secondary">{point.label}</p>
      <p className="tnum text-text-primary">Spent {formatPaise(point.spent, { decimals: 'auto' })}</p>
      {point.cumulative !== null && <p className="tnum text-text-primary">So far {formatPaise(point.cumulative, { decimals: 'auto' })}</p>}
      <p className="tnum text-text-secondary">Even pace {formatPaise(point.ideal, { decimals: 'never' })}</p>
    </div>
  )
}
