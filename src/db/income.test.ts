import 'fake-indexeddb/auto'
import { onboard } from './cycles'
import { TrackerDB } from './db'
import { addFixedExpense, pauseFixedExpense } from './fixedExpenses'
import { startup } from './startup'
import { addExpense, addIncome, deleteTransaction, lastUsedCategoryId } from './transactions'
import { summarizeCycle } from '../domain/balance'
import { DEFAULT_CATEGORIES } from '../domain/categories'

let database: TrackerDB
let n = 0

beforeEach(async () => {
  database = new TrackerDB(`income-test-${++n}`)
  await database.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database) // 1–30 Nov
})
afterEach(async () => {
  await database.delete()
})

async function summary(today: string) {
  const cycle = (await database.cycles.where('status').equals('open').last())!
  return summarizeCycle({
    cycle,
    today,
    transactions: await database.transactions.toArray(),
    fixedExpenses: await database.fixedExpenses.toArray(),
    categories: DEFAULT_CATEGORIES,
  })
}

describe('one-off income', () => {
  it('adds to the cycle balance and total income, not to spending', async () => {
    await addExpense({ amount: 100000, categoryId: 'food', date: '2026-11-09' }, '2026-11-10', database)
    const tx = await addIncome({ amount: 500000, categoryId: 'income-bonus', date: '2026-11-10', note: 'Diwali bonus' }, '2026-11-10', database)
    expect(tx).toMatchObject({ type: 'income', amount: 500000, categoryId: 'income-bonus', note: 'Diwali bonus' })

    const s = await summary('2026-11-10')
    expect(s.otherIncome).toBe(500000)
    expect(s.totalIncome).toBe(5500000)
    expect(s.remaining).toBe(5500000 - 100000)
    expect(s.variableSpent).toBe(100000)
    expect(s.byCategory.map((c) => c.categoryId)).toEqual(['food'])
  })

  it('requires an income kind and does not change the last-used expense category', async () => {
    await expect(addIncome({ amount: 100, categoryId: 'food', date: '2026-11-10' }, '2026-11-10', database)).rejects.toThrow()
    await addExpense({ amount: 100, categoryId: 'transport', date: '2026-11-10' }, '2026-11-10', database)
    await addIncome({ amount: 100, categoryId: 'income-gift', date: '2026-11-10' }, '2026-11-10', database)
    expect(await lastUsedCategoryId(database)).toBe('transport')
  })
})

describe('recurring income (monthly bonus)', () => {
  const bonus = { name: 'Monthly bonus', amount: 300000, categoryId: 'income-bonus', deductionDay: 15 }

  it('adds itself on its day each cycle, tagged as automatic', async () => {
    await addFixedExpense(bonus, '2026-11-10', { direction: 'in' }, database)
    expect(await database.transactions.count()).toBe(0)
    await startup('2027-01-20', database)
    const rows = await database.transactions.orderBy('date').toArray()
    expect(rows.map((r) => [r.type, r.date, r.amount, !!r.fixedExpenseId])).toEqual([
      ['income', '2026-11-15', 300000, true],
      ['income', '2026-12-15', 300000, true],
      ['income', '2027-01-15', 300000, true],
    ])
  })

  it('is not a fixed commitment and is not counted before it arrives', async () => {
    await addFixedExpense(bonus, '2026-11-10', { direction: 'in' }, database)
    await addFixedExpense({ name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 20 }, '2026-11-10', {}, database)
    let s = await summary('2026-11-10')
    expect(s.fixedUpcoming).toBe(1500000)
    expect(s.otherIncome).toBe(0)
    await startup('2026-11-16', database)
    s = await summary('2026-11-16')
    expect(s.otherIncome).toBe(300000)
    expect(s.fixedDeducted).toBe(0)
  })

  it('validates the income kind, and can be skipped or paused like a fixed cost', async () => {
    await expect(addFixedExpense({ ...bonus, categoryId: 'bills' }, '2026-11-10', { direction: 'in' }, database)).rejects.toThrow()
    const fe = await addFixedExpense({ ...bonus, deductionDay: 10 }, '2026-11-10', { direction: 'in' }, database)
    const [row] = await database.transactions.toArray()
    await deleteTransaction(row!.id, database)
    expect((await database.transactions.get(row!.id))!.skipped).toBe(true) // kept, so not re-created
    await startup('2026-11-10', database)
    expect(await database.transactions.count()).toBe(1)
    await pauseFixedExpense(fe.id, '2026-11-11', database)
    await startup('2026-12-20', database)
    expect(await database.transactions.count()).toBe(1)
  })
})
