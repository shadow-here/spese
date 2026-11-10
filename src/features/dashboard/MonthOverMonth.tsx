import { useMemo } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { Card } from '../../components/ui'
import type { MonthOverMonth as MoM } from '../../domain/history'
import { formatDate } from '../../lib/format'
import { formatPaise, formatPaiseCompact } from '../../lib/money'

/**
 * Month-over-month (PRD #17): the viewed cycle against up to 3 before it, total and top
 * categories, as grouped bars. Past cycles are a light→dark grey sequence (validated as an
 * ordered ramp, darkest 3.3:1); the viewed cycle takes the accent — reserved for "this cycle".
 * Totals are written out in the legend, and a table view carries every number.
 */
const PAST = ['#62666D', '#8A8F98', '#B4B8BF'] // oldest → newest
const AXIS = { stroke: 'var(--text-secondary)', fontSize: 11, tickLine: false, axisLine: false } as const

export function MonthOverMonth({ data }: { data: MoM }) {
  const n = data.cycles.length
  // Colour per cycle position: the last (viewed) one is accent; earlier ones take the newest greys.
  const colours = data.cycles.map((_, i) => (i === n - 1 ? 'var(--accent)' : PAST[PAST.length - (n - 1) + i]!))
  const labels = data.cycles.map((c, i) => (i === n - 1 && c.isOpen ? 'This cycle' : formatDate(c.cycle.start)))

  const rows = useMemo(
    () => data.categories.map((c) => ({ name: c.name, ...Object.fromEntries(c.amounts.map((a, i) => [`c${i}`, a])) })),
    [data.categories],
  )

  return (
    <Card title="Month over month">
      <div className="px-2 pt-3 pb-1">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2 pb-3 sm:grid-cols-4">
          {data.cycles.map((c, i) => (
            <li key={c.cycle.id} className="flex flex-col">
              <span className="flex items-center gap-1.5 text-label text-text-secondary">
                <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: colours[i] }} />
                {labels[i]}
              </span>
              <span className="tnum text-body">
                {formatPaise(c.total, { decimals: 'never' })}
                {c.isOpen && <span className="text-label text-text-secondary"> so far</span>}
              </span>
            </li>
          ))}
        </ul>
        {rows.length > 0 && (
          <div className="h-44" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
                <XAxis dataKey="name" interval={0} {...AXIS} tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)} />
                <YAxis width={44} tickFormatter={formatPaiseCompact} tickCount={3} {...AXIS} />
                <Tooltip content={<MoMTooltip labels={labels} colours={colours} />} cursor={{ fill: 'var(--surface-hover)' }} isAnimationActive={false} />
                {data.cycles.map((c, i) => (
                  <Bar key={c.cycle.id} dataKey={`c${i}`} fill={colours[i]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <details className="px-2 pb-2 text-label text-text-secondary">
          <summary className="cursor-pointer py-1 hover:text-text-primary">Show as table</summary>
          <table className="mt-1 w-full">
            <thead>
              <tr className="text-left">
                <th className="py-1 font-medium">Category</th>
                {labels.map((l) => (
                  <th key={l} className="py-1 text-right font-medium">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tnum text-text-primary">
              <tr className="border-t border-border">
                <td className="py-1">Total</td>
                {data.cycles.map((c) => (
                  <td key={c.cycle.id} className="py-1 text-right">
                    {formatPaise(c.total, { decimals: 'never' })}
                  </td>
                ))}
              </tr>
              {data.categories.map((c) => (
                <tr key={c.categoryId} className="border-t border-border">
                  <td className="py-1">{c.name}</td>
                  {c.amounts.map((a, i) => (
                    <td key={i} className="py-1 text-right">
                      {formatPaise(a, { decimals: 'never' })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </Card>
  )
}

function MoMTooltip({ active, payload, label, labels, colours }: TooltipProps<number, string> & { labels: string[]; colours: string[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-control border border-border bg-surface-hover px-2.5 py-1.5 text-label">
      <p className="text-text-secondary">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.dataKey)} className="tnum flex items-center gap-1.5 text-text-primary">
          <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: colours[i] }} />
          {labels[i]}: {formatPaise(Number(p.value ?? 0), { decimals: 'never' })}
        </p>
      ))}
    </div>
  )
}
