import { composeReminder, type ComposeInput } from './compose'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import type { FixedExpense, PayCycle, Transaction, User } from '../domain/types'

const user: User = { id: 'me', name: '', currency: 'INR', payDay: 1, defaultSalary: 5000000, createdAt: 0 }
const cycle: PayCycle = { id: 'nov', start: '2026-11-01', end: '2026-11-30', salary: 5000000, status: 'open', salaryConfirmed: true }
const fe = (o: Partial<FixedExpense>): FixedExpense => ({
  id: 'rent', name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 10, frequency: 'monthly', activeFrom: '2026-01-01',
  isPaused: false, createdAt: 0, updatedAt: 0, ...o,
})
const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), cycleId: 'nov', type: 'expense', amount: 0, categoryId: 'food', date: '2026-11-10', createdAt: 0, updatedAt: 0, ...o,
})
const input = (o: Partial<ComposeInput>): ComposeInput => ({
  user, cycle, transactions: [], fixedExpenses: [], categories: DEFAULT_CATEGORIES, today: '2026-11-10', ...o,
})

describe('composeReminder', () => {
  it('announces a fixed cost due today', () => {
    expect(composeReminder(input({ fixedExpenses: [fe({})] }))).toEqual({ title: 'Spese', body: 'Rent ₹15,000 deducted today' })
  })

  it('combines several dues, and recurring income', () => {
    const r = composeReminder(
      input({
        fixedExpenses: [
          fe({}),
          fe({ id: 'wifi', name: 'WiFi', amount: 79900 }),
          fe({ id: 'bonus', name: 'Monthly bonus', amount: 300000, direction: 'in', categoryId: 'income-bonus' }),
          fe({ id: 'gym', name: 'Gym', deductionDay: 11 }), // not today
          fe({ id: 'p', name: 'Paused', isPaused: true }),
        ],
      }),
    )
    expect(r.body).toBe('Rent and WiFi (₹15,799) deducted today · Monthly bonus +₹3,000 arrives today')
  })

  it('nudges to log when nothing is logged today, with safe to spend', () => {
    // ₹50,000 over 21 days (10–30 Nov) = ₹2,380
    expect(composeReminder(input({}))).toEqual({ title: 'Logged today’s spending?', body: 'Tap to add it — ₹2,380 is safe to spend today.' })
  })

  it('summarises today once something is logged', () => {
    const r = composeReminder(input({ transactions: [tx({ amount: 24000 }), tx({ amount: 5000, date: '2026-11-09' })] }))
    expect(r).toEqual({ title: 'Today: ₹240 spent', body: '₹49,710 left this cycle.' })
  })

  it('shows no amounts or names when the app lock is on', () => {
    const r = composeReminder(input({ user: { ...user, lock: { pinHash: 'x', salt: 'y', iterations: 1, pinLength: 4 } }, fixedExpenses: [fe({})] }))
    expect(r).toEqual({ title: 'Spese', body: 'Logged today’s spending? Tap to add it.' })
  })

  it('falls back to a generic nudge before setup', () => {
    expect(composeReminder(input({ user: undefined }))).toEqual({ title: 'Spese', body: 'Logged today’s spending? Tap to add it.' })
  })
})
