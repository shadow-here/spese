import { summarizeCycle, type SummaryInput } from './balance'
import { DEFAULT_CATEGORIES } from './categories'
import type { FixedExpense, PayCycle, Transaction } from './types'

const cycle: PayCycle = {
  id: 'c1',
  start: '2026-11-01',
  end: '2026-11-30',
  salary: 5000000, // ₹50,000
  status: 'open',
  salaryConfirmed: true,
}

let seq = 0
function tx(overrides: Partial<Transaction>): Transaction {
  seq++
  return {
    id: `t${seq}`,
    cycleId: 'c1',
    type: 'expense',
    amount: 0,
    categoryId: 'food',
    date: '2026-11-01',
    createdAt: seq,
    updatedAt: seq,
    ...overrides,
  }
}

function fe(overrides: Partial<FixedExpense>): FixedExpense {
  return {
    id: 'f1',
    name: 'Rent',
    amount: 1500000,
    categoryId: 'bills',
    deductionDay: 5,
    frequency: 'monthly',
    activeFrom: '2026-01-01',
    isPaused: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const base = (o: Partial<SummaryInput> = {}): SummaryInput => ({
  cycle,
  transactions: [],
  fixedExpenses: [],
  categories: DEFAULT_CATEGORIES,
  today: '2026-11-10',
  ...o,
})

describe('summarizeCycle', () => {
  it('empty cycle: everything left, empty state', () => {
    const s = summarizeCycle(base())
    expect(s).toMatchObject({ remaining: 5000000, freeToSpend: 5000000, percentLeft: 100, isEmpty: true, daysLeft: 21, cycleDays: 30 })
  })

  it('applies the PRD formula: salary + income − fixed − variable', () => {
    const s = summarizeCycle(
      base({
        transactions: [
          tx({ type: 'expense', amount: 24000, date: '2026-11-02' }),
          tx({ type: 'expense', amount: 349900, categoryId: 'shopping', date: '2026-11-03' }),
          tx({ type: 'income', amount: 1000000, categoryId: 'other', date: '2026-11-04' }),
          tx({ type: 'auto', amount: 1500000, categoryId: 'bills', date: '2026-11-05', fixedExpenseId: 'f1', dueDate: '2026-11-05' }),
        ],
        fixedExpenses: [fe({})],
      }),
    )
    expect(s.otherIncome).toBe(1000000)
    expect(s.totalIncome).toBe(6000000)
    expect(s.fixedDeducted).toBe(1500000)
    expect(s.variableSpent).toBe(373900)
    expect(s.remaining).toBe(6000000 - 1500000 - 373900)
    expect(s.percentLeft).toBeCloseTo(((6000000 - 1873900) / 6000000) * 100)
  })

  it('counts fixed costs due later this cycle as committed (FR-3.3)', () => {
    const s = summarizeCycle(base({ today: '2026-11-02', fixedExpenses: [fe({ deductionDay: 5 }), fe({ id: 'f2', amount: 79900, deductionDay: 20 })] }))
    expect(s.fixedDeducted).toBe(0)
    expect(s.fixedUpcoming).toBe(1579900)
    expect(s.remaining).toBe(5000000)
    expect(s.freeToSpend).toBe(5000000 - 1579900)
  })

  it('does not double count a deducted fixed expense, and a skipped one is neither spent nor upcoming', () => {
    const s = summarizeCycle(
      base({
        transactions: [
          tx({ type: 'auto', amount: 1500000, categoryId: 'bills', date: '2026-11-05', fixedExpenseId: 'f1', dueDate: '2026-11-05' }),
          tx({ type: 'auto', amount: 150000, categoryId: 'health', date: '2026-11-06', fixedExpenseId: 'gym', dueDate: '2026-11-06', skipped: true }),
        ],
        fixedExpenses: [fe({}), fe({ id: 'gym', amount: 150000, deductionDay: 6 })],
      }),
    )
    expect(s.fixedDeducted).toBe(1500000)
    expect(s.fixedUpcoming).toBe(0)
    expect(s.fixedCommitted).toBe(1500000)
    expect(s.recent).toHaveLength(1)
  })

  it('goes negative when overspent', () => {
    const s = summarizeCycle(base({ transactions: [tx({ amount: 6000000 })] }))
    expect(s.remaining).toBe(-1000000)
    expect(s.percentLeft).toBe(-20)
  })

  it('ignores transactions from other cycles', () => {
    const s = summarizeCycle(base({ transactions: [tx({ cycleId: 'other', amount: 100 })] }))
    expect(s.variableSpent).toBe(0)
  })

  it('ranks categories by amount with share of outflow', () => {
    const s = summarizeCycle(
      base({
        transactions: [
          tx({ amount: 30000, categoryId: 'food' }),
          tx({ amount: 10000, categoryId: 'food' }),
          tx({ amount: 60000, categoryId: 'transport' }),
          tx({ type: 'income', amount: 999999, categoryId: 'other' }),
        ],
      }),
    )
    expect(s.byCategory.map((c) => [c.name, c.amount, c.percent])).toEqual([
      ['Transport', 60000, 60],
      ['Food', 40000, 40],
    ])
  })

  it('builds a daily trend with cumulative up to today and an ideal pace', () => {
    const s = summarizeCycle(
      base({
        today: '2026-11-03',
        transactions: [
          tx({ amount: 10000, date: '2026-11-01' }),
          tx({ amount: 5000, date: '2026-11-03' }),
          tx({ amount: 2500, date: '2026-11-03' }),
          tx({ type: 'auto', amount: 1500000, categoryId: 'bills', date: '2026-11-02', fixedExpenseId: 'f1', dueDate: '2026-11-02' }),
        ],
        fixedExpenses: [fe({ deductionDay: 2 })],
      }),
    )
    expect(s.daily).toHaveLength(30)
    expect(s.daily.slice(0, 4).map((d) => [d.spent, d.cumulative])).toEqual([
      [10000, 10000],
      [0, 10000], // fixed deduction not in the trend
      [7500, 17500],
      [0, null],
    ])
    // ideal: (50,000 − 15,000) spread evenly over 30 days, ending exactly at the budget
    expect(s.daily[29]!.ideal).toBe(3500000)
    expect(s.daily[0]!.ideal).toBe(Math.round(3500000 / 30))
  })

  it('lists the 10 most recent, newest first', () => {
    const many = Array.from({ length: 12 }, (_, i) => tx({ amount: 100, date: `2026-11-${String(i + 1).padStart(2, '0')}` }))
    const s = summarizeCycle(base({ transactions: many }))
    expect(s.recent).toHaveLength(10)
    expect(s.recent[0]!.date).toBe('2026-11-12')
    expect(s.recent[9]!.date).toBe('2026-11-03')
  })
})
