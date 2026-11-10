import { summarizeCycle } from './balance'
import { budgetLevel, budgetRows, crossedThreshold, goalMet, goalProgress, isLowBalance } from './budgets'
import { DEFAULT_CATEGORIES } from './categories'
import { safeToSpendToday } from './history'
import type { Category, PayCycle, Transaction } from './types'

const cycle: PayCycle = { id: 'nov', start: '2026-11-01', end: '2026-11-30', salary: 5000000, status: 'open', salaryConfirmed: true }
let seq = 0
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, cycleId: 'nov', type: 'expense', amount: 0, categoryId: 'food', date: '2026-11-02', createdAt: seq, updatedAt: seq, ...o,
})
const withLimits = (limits: Record<string, number>): Category[] =>
  DEFAULT_CATEGORIES.map((c) => (limits[c.id] ? { ...c, monthlyLimit: limits[c.id] } : c))

const summary = (transactions: Transaction[], today = '2026-11-10') =>
  summarizeCycle({ cycle, today, transactions, fixedExpenses: [], categories: DEFAULT_CATEGORIES })

describe('budget levels', () => {
  it('warns at 80% and is over at 100%', () => {
    expect([0, 79.9, 80, 99.9, 100, 140].map(budgetLevel)).toEqual(['ok', 'ok', 'near', 'near', 'over', 'over'])
  })
  it('detects the threshold an entry crossed', () => {
    expect(crossedThreshold(50, 79)).toBeUndefined()
    expect(crossedThreshold(70, 85)).toBe('near')
    expect(crossedThreshold(85, 90)).toBeUndefined() // already near
    expect(crossedThreshold(70, 120)).toBe('over') // jumping straight past both: report the worse
    expect(crossedThreshold(110, 130)).toBeUndefined()
  })
})

describe('budgetRows', () => {
  it('only lists budgeted categories, most urgent first, counting net spend', () => {
    const s = summary([
      tx({ id: 'dinner', amount: 450000, categoryId: 'food' }),
      tx({ amount: 600000, categoryId: 'transport' }),
      tx({ amount: 100000, categoryId: 'shopping' }),
      tx({ type: 'refund', amount: 50000, categoryId: 'food', refundOf: 'dinner' }),
    ])
    const rows = budgetRows(s, withLimits({ food: 500000, transport: 500000, shopping: 1000000 }))
    expect(rows.map((r) => [r.category.id, r.spent, Math.round(r.percent), r.level, r.left])).toEqual([
      ['transport', 600000, 120, 'over', -100000],
      ['food', 400000, 80, 'near', 100000], // 4,500 − 500 refund
      ['shopping', 100000, 10, 'ok', 900000],
    ])
  })
  it('includes budgeted categories with nothing spent yet', () => {
    expect(budgetRows(summary([]), withLimits({ health: 200000 }))).toMatchObject([{ spent: 0, percent: 0, level: 'ok' }])
  })
})

describe('low balance', () => {
  it('alerts below 10% of salary', () => {
    expect(isLowBalance(summary([tx({ amount: 4400000 })]))).toBe(false) // ₹6,000 left = 12%
    expect(isLowBalance(summary([tx({ amount: 4600000 })]))).toBe(true) // ₹4,000 left = 8%
    expect(isLowBalance(summary([tx({ amount: 6000000 })]))).toBe(true) // overspent
  })
})

describe('savings goal', () => {
  it('sets the goal aside from what you can spend', () => {
    const s = summary([tx({ amount: 1000000 })]) // ₹40,000 free, 21 days left
    expect(goalProgress(s, 1000000)).toEqual({ goal: 1000000, spendable: 3000000, onTrack: true, protectedAmount: 1000000 })
    expect(safeToSpendToday(s, 1000000)).toBe(Math.floor(3000000 / 21 / 100) * 100)
    expect(safeToSpendToday(s)).toBe(Math.floor(4000000 / 21 / 100) * 100)
  })
  it('is off track once spending eats into the goal', () => {
    const s = summary([tx({ amount: 4500000 })]) // ₹5,000 free
    expect(goalProgress(s, 1000000)).toMatchObject({ spendable: -500000, onTrack: false, protectedAmount: 500000 })
    expect(safeToSpendToday(s, 1000000)).toBe(0)
  })
  it('judges a finished cycle by what was left', () => {
    expect(goalMet(1000000, 1000000)).toBe(true)
    expect(goalMet(999999, 1000000)).toBe(false)
  })
})
