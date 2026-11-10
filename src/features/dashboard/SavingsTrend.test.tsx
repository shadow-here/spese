import { render, screen, within } from '@testing-library/react'
import { SavingsTrend } from './SavingsTrend'
import { summarizeCycle } from '../../domain/balance'
import { DEFAULT_CATEGORIES } from '../../domain/categories'
import type { CycleHistoryEntry } from '../../domain/history'
import type { PayCycle } from '../../domain/types'

function entry(id: string, start: string, end: string, spent: number, rate: number): CycleHistoryEntry {
  const cycle: PayCycle = { id, start, end, salary: 5000000, status: 'closed', salaryConfirmed: true }
  const summary = summarizeCycle({
    cycle,
    today: end,
    transactions: [{ id: `${id}-t`, cycleId: id, type: 'expense', amount: spent, categoryId: 'food', date: start, createdAt: 0, updatedAt: 0 }],
    fixedExpenses: [],
    categories: DEFAULT_CATEGORIES,
  })
  return { cycle, summary, savingsRate: rate }
}

describe('SavingsTrend', () => {
  it('summarises the average and lists each cycle in the table view', () => {
    render(
      <SavingsTrend
        finished={[
          entry('sep', '2026-09-01', '2026-09-30', 1000000, 80),
          entry('oct', '2026-10-01', '2026-10-31', 3000000, 40),
        ]}
      />,
    )
    expect(screen.getByText(/Average/)).toHaveTextContent('Average 60% of income saved over the last 2 cycles')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['1 Sep – 30 Sep₹40,00080%', '1 Oct – 31 Oct₹20,00040%'])
  })
})
