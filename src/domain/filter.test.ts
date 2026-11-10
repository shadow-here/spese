import { DEFAULT_CATEGORIES } from './categories'
import { filterTransactions, isFilterActive } from './filter'
import type { Transaction } from './types'

let seq = 0
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, cycleId: 'c', type: 'expense', amount: 0, categoryId: 'food', date: '2026-11-05', createdAt: seq, updatedAt: seq, ...o,
})

const rows = [
  tx({ id: 'dinner', amount: 180000, note: 'Dinner at Toit', paymentMethod: 'card', date: '2026-11-05' }),
  tx({ id: 'cab', amount: 24000, categoryId: 'transport', note: 'Uber', paymentMethod: 'upi', date: '2026-11-06' }),
  tx({ id: 'chai', amount: 2050, note: 'Chai', paymentMethod: 'cash', date: '2026-11-08' }),
  tx({ id: 'bonus', type: 'income', amount: 500000, categoryId: 'income-bonus', date: '2026-11-07' }),
  tx({ id: 'rent', type: 'auto', amount: 1500000, categoryId: 'bills', note: 'Rent', fixedExpenseId: 'f', date: '2026-11-01' }),
  tx({ id: 'gym', type: 'auto', amount: 150000, categoryId: 'health', note: 'Gym', fixedExpenseId: 'g', skipped: true }),
  tx({ id: 'r1', type: 'refund', amount: 60000, refundOf: 'dinner', note: "Rahul's share", date: '2026-11-09' }),
]
const ids = (f: Parameters<typeof filterTransactions>[1]) => filterTransactions(rows, f, DEFAULT_CATEGORIES).map((t) => t.id)

describe('filterTransactions', () => {
  it('with no filter lists everything except refunds and skipped rows', () => {
    expect(ids({})).toEqual(['dinner', 'cab', 'chai', 'bonus', 'rent'])
    expect(isFilterActive({})).toBe(false)
    expect(isFilterActive({ text: '  ' })).toBe(false)
  })

  it('searches notes, categories, income kinds and payment methods, ignoring case', () => {
    expect(ids({ text: 'toit' })).toEqual(['dinner'])
    expect(ids({ text: 'Transport' })).toEqual(['cab'])
    expect(ids({ text: 'bonus' })).toEqual(['bonus'])
    expect(ids({ text: 'upi' })).toEqual(['cab'])
    expect(ids({ text: 'bills' })).toEqual(['rent'])
  })

  it('searches amounts, with or without ₹ and commas', () => {
    expect(ids({ text: '1800' })).toEqual(['dinner'])
    expect(ids({ text: '₹1,800' })).toEqual(['dinner'])
    expect(ids({ text: '20.5' })).toEqual(['chai'])
  })

  it('finds an expense by the note on its refund', () => {
    expect(ids({ text: 'rahul' })).toEqual(['dinner'])
  })

  it('filters by category, all income, payment method and dates, combined', () => {
    expect(ids({ categoryId: 'food' })).toEqual(['dinner', 'chai'])
    expect(ids({ categoryId: 'income' })).toEqual(['bonus'])
    expect(ids({ paymentMethod: 'cash' })).toEqual(['chai'])
    expect(ids({ from: '2026-11-06', to: '2026-11-07' })).toEqual(['cab', 'bonus'])
    expect(ids({ categoryId: 'food', paymentMethod: 'card', from: '2026-11-05', text: 'dinner' })).toEqual(['dinner'])
    expect(ids({ categoryId: 'food', paymentMethod: 'upi' })).toEqual([])
  })
})
