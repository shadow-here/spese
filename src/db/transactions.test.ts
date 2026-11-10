import 'fake-indexeddb/auto'
import { runAutoDeductions } from './autoDeduct'
import { ensureCurrentCycle, onboard } from './cycles'
import { newId, TrackerDB } from './db'
import {
  addExpense,
  allowedDateRange,
  deleteTransaction,
  lastUsedCategoryId,
  restoreTransaction,
  updateTransaction,
} from './transactions'

let database: TrackerDB
let n = 0
const TODAY = '2026-12-09'

beforeEach(async () => {
  database = new TrackerDB(`tx-test-${++n}`)
  await database.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-15' }, database)
  await ensureCurrentCycle(TODAY, database) // Nov closed, Dec open
})
afterEach(async () => {
  await database.delete()
})

describe('addExpense', () => {
  it('saves into the cycle for its date', async () => {
    const tx = await addExpense({ amount: 24000, categoryId: 'food', date: TODAY, note: '  Lunch ' }, TODAY, database)
    const dec = await database.cycles.where('start').equals('2026-12-01').first()
    expect(tx).toMatchObject({ type: 'expense', amount: 24000, cycleId: dec!.id, note: 'Lunch' })
  })

  it('allows back-dating into the previous cycle (FR-2.3)', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: '2026-11-03' }, TODAY, database)
    const nov = await database.cycles.where('start').equals('2026-11-01').first()
    expect(tx.cycleId).toBe(nov!.id)
  })

  it('rejects dates outside current/previous cycle, the future, and zero amounts', async () => {
    expect(await allowedDateRange(TODAY, database)).toEqual({ min: '2026-11-01', max: TODAY })
    await expect(addExpense({ amount: 100, categoryId: 'food', date: '2026-10-31' }, TODAY, database)).rejects.toThrow()
    await expect(addExpense({ amount: 100, categoryId: 'food', date: '2026-12-10' }, TODAY, database)).rejects.toThrow()
    await expect(addExpense({ amount: 0, categoryId: 'food', date: TODAY }, TODAY, database)).rejects.toThrow()
  })

  it('omits an empty note', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: TODAY, note: '   ' }, TODAY, database)
    expect('note' in tx).toBe(false)
  })
})

describe('updateTransaction', () => {
  it('edits fields and moves cycle with the date', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: TODAY }, TODAY, database)
    await updateTransaction(tx.id, { amount: 250, categoryId: 'transport', date: '2026-11-20', note: 'Cab' }, TODAY, database)
    const nov = await database.cycles.where('start').equals('2026-11-01').first()
    expect(await database.transactions.get(tx.id)).toMatchObject({ amount: 250, categoryId: 'transport', date: '2026-11-20', note: 'Cab', cycleId: nov!.id })
  })

  it('clears a note set to blank', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: TODAY, note: 'x' }, TODAY, database)
    await updateTransaction(tx.id, { note: '' }, TODAY, database)
    expect((await database.transactions.get(tx.id))!.note).toBeUndefined()
  })
})

describe('delete and undo', () => {
  it('deletes an expense and restores it exactly', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: TODAY }, TODAY, database)
    const removed = await deleteTransaction(tx.id, database)
    expect(await database.transactions.get(tx.id)).toBeUndefined()
    await restoreTransaction(removed!, database)
    expect(await database.transactions.get(tx.id)).toEqual(tx)
  })

  it('skips an auto-deduction instead of deleting, so it is not re-created', async () => {
    await database.fixedExpenses.add({
      id: newId(), name: 'WiFi', amount: 79900, categoryId: 'bills', deductionDay: 5, frequency: 'monthly',
      activeFrom: '2026-11-01', isPaused: false, createdAt: 0, updatedAt: 0,
    })
    const [auto] = (await runAutoDeductions(TODAY, database)).filter((t) => t.date === '2026-12-05')
    const removed = await deleteTransaction(auto!.id, database)
    expect((await database.transactions.get(auto!.id))!.skipped).toBe(true)
    expect(await runAutoDeductions(TODAY, database)).toHaveLength(0)
    await restoreTransaction(removed!, database)
    expect((await database.transactions.get(auto!.id))!.skipped).toBeUndefined()
  })
})

describe('lastUsedCategoryId', () => {
  it('returns the category of the most recently added expense', async () => {
    expect(await lastUsedCategoryId(database)).toBeUndefined()
    await addExpense({ amount: 100, categoryId: 'transport', date: '2026-12-08' }, TODAY, database)
    await new Promise((r) => setTimeout(r, 2))
    await addExpense({ amount: 100, categoryId: 'health', date: '2026-11-02' }, TODAY, database) // back-dated but newer
    expect(await lastUsedCategoryId(database)).toBe('health')
  })
})
