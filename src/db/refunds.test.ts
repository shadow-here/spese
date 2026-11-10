import 'fake-indexeddb/auto'
import { shiftCurrentCycleStart } from './cycleSettings'
import { ensureCurrentCycle, onboard } from './cycles'
import { TrackerDB } from './db'
import { addRefund, deleteRefund, refundsOf, updateRefund } from './refunds'
import { addExpense, deleteTransaction, restoreTransaction, updateTransaction } from './transactions'
import { summarizeCycle } from '../domain/balance'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import { netAmount, refundsByExpense } from '../domain/refunds'

let database: TrackerDB
let n = 0

beforeEach(async () => {
  database = new TrackerDB(`refund-test-${++n}`)
  await database.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-05' }, database) // cycle 1–30 Nov
})
afterEach(async () => {
  await database.delete()
})

async function summaryFor(start: string, today: string) {
  const cycle = (await database.cycles.where('start').equals(start).first())!
  return summarizeCycle({
    cycle,
    today,
    transactions: await database.transactions.toArray(),
    fixedExpenses: [],
    categories: DEFAULT_CATEGORIES,
  })
}

const dinner = { amount: 180000, categoryId: 'food', date: '2026-11-05', note: 'Dinner' }

describe('refund in the same cycle', () => {
  it('reduces the expense everywhere: balance, category, daily trend', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-07', note: "Rahul's share" }, '2026-11-08', database)
    const s = await summaryFor('2026-11-01', '2026-11-08')
    expect(s.variableSpent).toBe(120000)
    expect(s.remaining).toBe(5000000 - 120000)
    expect(s.otherIncome).toBe(0) // not shown as income
    expect(s.byCategory).toMatchObject([{ categoryId: 'food', amount: 120000 }])
    expect(s.daily[4]!.spent).toBe(120000) // netted on the expense's day (5 Nov), not the refund's
    expect(s.daily[6]!.spent).toBe(0)
    expect(s.recent.map((t) => t.type)).toEqual(['expense']) // no separate refund row
  })

  it('allows several refunds but never more than the expense', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-06' }, '2026-11-08', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-07' }, '2026-11-08', database)
    await expect(addRefund(e.id, { amount: 60001, date: '2026-11-08' }, '2026-11-08', database)).rejects.toThrow('At most ₹600')
    await addRefund(e.id, { amount: 60000, date: '2026-11-08' }, '2026-11-08', database)
    await expect(addRefund(e.id, { amount: 1, date: '2026-11-08' }, '2026-11-08', database)).rejects.toThrow('fully refunded')
    const s = await summaryFor('2026-11-01', '2026-11-08')
    expect(s.variableSpent).toBe(0)
    expect(s.byCategory).toEqual([]) // fully refunded category drops out
  })

  it('rejects a refund dated before the expense, or on a non-expense', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await expect(addRefund(e.id, { amount: 100, date: '2026-11-04' }, '2026-11-08', database)).rejects.toThrow('before the expense')
    const r = await addRefund(e.id, { amount: 100, date: '2026-11-05' }, '2026-11-08', database)
    await expect(addRefund(r.id, { amount: 1, date: '2026-11-05' }, '2026-11-08', database)).rejects.toThrow('only be added to an expense')
  })
})

describe('refund in a later cycle', () => {
  it('keeps the old cycle as it was and adds the money to the new cycle', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await ensureCurrentCycle('2026-12-03', database)
    await addRefund(e.id, { amount: 60000, date: '2026-12-02' }, '2026-12-03', database)

    const nov = await summaryFor('2026-11-01', '2026-11-30')
    expect(nov.variableSpent).toBe(180000) // November's savings unchanged
    const dec = await summaryFor('2026-12-01', '2026-12-03')
    expect(dec.otherIncome).toBe(60000)
    expect(dec.remaining).toBe(5000000 + 60000)
    expect(dec.recent).toEqual([]) // still not its own row

    const all = await database.transactions.toArray()
    const info = refundsByExpense(all, new Map(all.map((t) => [t.id, t]))).get(e.id)!
    expect(info).toMatchObject({ total: 60000, sameCycle: 0, later: 60000 })
    expect(netAmount(e, info)).toBe(180000)
  })

  it('follows the refund’s date: moving it into the expense’s cycle nets the expense instead', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await ensureCurrentCycle('2026-12-03', database)
    const r = await addRefund(e.id, { amount: 60000, date: '2026-12-02' }, '2026-12-03', database)
    await updateRefund(r.id, { date: '2026-11-29' }, '2026-12-03', database)
    expect((await summaryFor('2026-11-01', '2026-11-30')).variableSpent).toBe(120000)
    expect((await summaryFor('2026-12-01', '2026-12-03')).otherIncome).toBe(0)
  })

  it('re-homes when cycles change (salary came late, so this cycle starts later)', async () => {
    const e = await addExpense({ ...dinner, date: '2026-11-29' }, '2026-11-29', database)
    await ensureCurrentCycle('2026-12-05', database)
    await addRefund(e.id, { amount: 60000, date: '2026-12-02' }, '2026-12-05', database)
    const info = async () => {
      const all = await database.transactions.toArray()
      return refundsByExpense(all, new Map(all.map((t) => [t.id, t]))).get(e.id)!
    }
    expect((await info()).later).toBe(60000) // Nov expense, Dec refund
    await shiftCurrentCycleStart('2026-12-03', '2026-12-05', database) // Nov cycle now runs to 2 Dec
    expect((await info()).sameCycle).toBe(60000)
  })
})

describe('editing and deleting', () => {
  it('editing the expense respects its refunds and carries the category', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-07' }, '2026-11-08', database)
    await expect(updateTransaction(e.id, { amount: 50000 }, '2026-11-08', database)).rejects.toThrow('already refunded')
    await expect(updateTransaction(e.id, { date: '2026-11-08' }, '2026-11-08', database)).rejects.toThrow('after its refunds')
    await updateTransaction(e.id, { categoryId: 'entertainment' }, '2026-11-08', database)
    expect((await refundsOf(e.id, database))[0]!.categoryId).toBe('entertainment')
  })

  it('deleting the expense deletes its refunds; undo brings both back', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-07' }, '2026-11-08', database)
    const removed = await deleteTransaction(e.id, database)
    expect(removed).toHaveLength(2)
    expect(await database.transactions.count()).toBe(0)
    await restoreTransaction(removed!, database)
    expect(await database.transactions.count()).toBe(2)
  })

  it('deletes a single refund, with undo', async () => {
    const e = await addExpense(dinner, '2026-11-05', database)
    const r = await addRefund(e.id, { amount: 60000, date: '2026-11-07' }, '2026-11-08', database)
    const removed = await deleteRefund(r.id, database)
    expect(await refundsOf(e.id, database)).toEqual([])
    await restoreTransaction(removed!, database)
    expect(await refundsOf(e.id, database)).toHaveLength(1)
  })
})
