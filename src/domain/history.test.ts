import { summarizeCycle } from './balance'
import { DEFAULT_CATEGORIES } from './categories'
import { cycleHistory, fixedShare, monthOverMonth, safeToSpendToday, upcomingInNextWeek } from './history'
import type { FixedExpense, PayCycle, Transaction } from './types'

const cycle = (id: string, start: string, end: string, status: PayCycle['status'] = 'closed'): PayCycle => ({
  id, start, end, salary: 5000000, status, salaryConfirmed: true,
})
let seq = 0
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, cycleId: 'nov', type: 'expense', amount: 0, categoryId: 'food', date: '2026-11-02', createdAt: seq, updatedAt: seq, ...o,
})
const fe = (o: Partial<FixedExpense>): FixedExpense => ({
  id: 'rent', name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 5, frequency: 'monthly', activeFrom: '2026-01-01',
  isPaused: false, createdAt: 0, updatedAt: 0, ...o,
})

const nov = cycle('nov', '2026-11-01', '2026-11-30', 'open')

describe('safeToSpendToday', () => {
  it('spreads free-to-spend over the days left, rounded down to whole rupees', () => {
    // 50,000 − 15,000 rent to come − 1,000 spent = 34,000 over 21 days (10–30 Nov)
    const s = summarizeCycle({ cycle: nov, today: '2026-11-10', transactions: [tx({ amount: 100000 })], fixedExpenses: [fe({ deductionDay: 20 })], categories: DEFAULT_CATEGORIES })
    expect(safeToSpendToday(s)).toBe(Math.floor(3400000 / 21 / 100) * 100) // ₹1,619
  })
  it('is zero when overspent or the cycle is over', () => {
    const over = summarizeCycle({ cycle: nov, today: '2026-11-10', transactions: [tx({ amount: 6000000 })], fixedExpenses: [], categories: DEFAULT_CATEGORIES })
    expect(safeToSpendToday(over)).toBe(0)
    const done = summarizeCycle({ cycle: nov, today: '2026-12-01', transactions: [], fixedExpenses: [], categories: DEFAULT_CATEGORIES })
    expect(safeToSpendToday(done)).toBe(0)
  })
})

describe('fixedShare', () => {
  it('is committed fixed costs over income', () => {
    const s = summarizeCycle({ cycle: nov, today: '2026-11-02', transactions: [], fixedExpenses: [fe({})], categories: DEFAULT_CATEGORIES })
    expect(fixedShare(s)).toBe(30)
  })
})

describe('upcomingInNextWeek', () => {
  it('lists dues from tomorrow to a week out, skipping ones already applied, paused or recurring-income-tagged', () => {
    const items = upcomingInNextWeek(
      [
        fe({ id: 'rent', deductionDay: 12 }),
        fe({ id: 'gym', name: 'Gym', deductionDay: 10 }), // today: already applied on open
        fe({ id: 'wifi', name: 'WiFi', deductionDay: 18 }), // 8 days out: too far
        fe({ id: 'bonus', name: 'Bonus', deductionDay: 15, direction: 'in', categoryId: 'income-bonus', amount: 300000 }),
        fe({ id: 'paused', name: 'Paused', deductionDay: 11, isPaused: true }),
      ],
      [tx({ fixedExpenseId: 'rent', dueDate: '2026-12-12', type: 'auto' })], // a different month: irrelevant
      '2026-11-10',
    )
    expect(items.map((i) => [i.fixedExpense.name, i.date, i.incoming])).toEqual([
      ['Rent', '2026-11-12', false],
      ['Bonus', '2026-11-15', true],
    ])
  })
  it('crosses into the next cycle and month', () => {
    const items = upcomingInNextWeek([fe({ deductionDay: 2 })], [], '2026-11-28')
    expect(items.map((i) => i.date)).toEqual(['2026-12-02'])
  })
})

describe('cycleHistory and monthOverMonth', () => {
  const cycles = [
    cycle('aug', '2026-08-01', '2026-08-31'),
    cycle('sep', '2026-09-01', '2026-09-30'),
    cycle('oct', '2026-10-01', '2026-10-31'),
    nov,
    cycle('jul', '2026-07-01', '2026-07-31'),
  ]
  const transactions = [
    tx({ cycleId: 'jul', date: '2026-07-03', amount: 999900 }),
    tx({ cycleId: 'aug', date: '2026-08-03', amount: 1000000 }),
    tx({ cycleId: 'sep', date: '2026-09-03', amount: 2000000, categoryId: 'transport' }),
    tx({ cycleId: 'oct', date: '2026-10-03', amount: 500000 }),
    tx({ cycleId: 'nov', date: '2026-11-03', amount: 250000, categoryId: 'shopping' }),
  ]

  it('orders oldest first and gives finished cycles a savings rate', () => {
    const h = cycleHistory(cycles, transactions, [], DEFAULT_CATEGORIES, '2026-11-10')
    expect(h.map((e) => e.cycle.id)).toEqual(['jul', 'aug', 'sep', 'oct', 'nov'])
    expect(h.map((e) => e.savingsRate)).toEqual([80.002, 80, 60, 90, undefined])
  })

  it('compares the viewed cycle with up to 3 before it, by total and top categories', () => {
    const mom = monthOverMonth(cycleHistory(cycles, transactions, [], DEFAULT_CATEGORIES, '2026-11-10'), '2026-11-10')
    expect(mom.cycles.map((c) => [c.cycle.id, c.total, c.isOpen])).toEqual([
      ['aug', 1000000, false],
      ['sep', 2000000, false],
      ['oct', 500000, false],
      ['nov', 250000, true],
    ])
    expect(mom.categories).toEqual([
      { categoryId: 'transport', name: 'Transport', amounts: [0, 2000000, 0, 0] },
      { categoryId: 'food', name: 'Food', amounts: [1000000, 0, 500000, 0] },
      { categoryId: 'shopping', name: 'Shopping', amounts: [0, 0, 0, 250000] },
    ])
  })
})
