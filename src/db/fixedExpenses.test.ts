import 'fake-indexeddb/auto'
import { onboard } from './cycles'
import { TrackerDB } from './db'
import {
  addFixedExpense,
  endFixedExpense,
  passedDueDateThisCycle,
  pauseFixedExpense,
  resumeFixedExpense,
  unskipDeduction,
  updateFixedExpense,
} from './fixedExpenses'
import { startup } from './startup'
import { deleteTransaction } from './transactions'
import { nextDueDate } from '../domain/fixed'

let database: TrackerDB
let n = 0
const wifi = { name: 'WiFi', amount: 79900, categoryId: 'bills', deductionDay: 5 }

beforeEach(async () => {
  database = new TrackerDB(`fe-test-${++n}`)
  await database.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database) // cycle 1–30 Nov
})
afterEach(async () => {
  await database.delete()
})

const autos = async () => (await database.transactions.where('type').equals('auto').sortBy('date')).map((t) => [t.date, t.amount, t.skipped ?? false])

describe('adding mid-cycle', () => {
  it('asks only when the day has already passed this cycle', async () => {
    expect(await passedDueDateThisCycle(5, '2026-11-10', database)).toBe('2026-11-05')
    expect(await passedDueDateThisCycle(10, '2026-11-10', database)).toBeUndefined() // due today: just deducts
    expect(await passedDueDateThisCycle(20, '2026-11-10', database)).toBeUndefined()
  })

  it('deducts the passed due with its original date when the user says yes', async () => {
    await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: true }, database)
    expect(await autos()).toEqual([['2026-11-05', 79900, false]])
  })

  it('starts next cycle when the user says no', async () => {
    await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: false }, database)
    expect(await autos()).toEqual([])
    await startup('2026-12-05', database)
    expect(await autos()).toEqual([['2026-12-05', 79900, false]])
  })

  it('deducts immediately when due today', async () => {
    await addFixedExpense({ ...wifi, deductionDay: 10 }, '2026-11-10', {}, database)
    expect(await autos()).toEqual([['2026-11-10', 79900, false]])
  })

  it('validates input', async () => {
    await expect(addFixedExpense({ ...wifi, name: ' ' }, '2026-11-10', {}, database)).rejects.toThrow()
    await expect(addFixedExpense({ ...wifi, amount: 0 }, '2026-11-10', {}, database)).rejects.toThrow()
    await expect(addFixedExpense({ ...wifi, deductionDay: 0 }, '2026-11-10', {}, database)).rejects.toThrow()
  })
})

describe('editing (FR-3.5)', () => {
  it('a new amount applies from the next deduction; past ones keep theirs', async () => {
    const fe = await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: true }, database)
    await updateFixedExpense(fe.id, { amount: 99900 }, '2026-11-10', database)
    await startup('2026-12-06', database)
    expect(await autos()).toEqual([
      ['2026-11-05', 79900, false],
      ['2026-12-05', 99900, false],
    ])
  })

  it('moving the day after this cycle was charged does not charge it twice', async () => {
    const fe = await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: true }, database)
    await updateFixedExpense(fe.id, { deductionDay: 20 }, '2026-11-10', database)
    await startup('2026-12-21', database)
    expect(await autos()).toEqual([
      ['2026-11-05', 79900, false],
      ['2026-12-20', 79900, false],
    ])
  })

  it('moving the day before it was charged this cycle uses the new day this cycle', async () => {
    const fe = await addFixedExpense({ ...wifi, deductionDay: 25 }, '2026-11-10', {}, database)
    await updateFixedExpense(fe.id, { deductionDay: 15 }, '2026-11-10', database)
    await startup('2026-11-16', database)
    expect(await autos()).toEqual([['2026-11-15', 79900, false]])
  })
})

describe('pause / resume / end', () => {
  it('pausing first deducts what is already due, and resuming does not back-fill', async () => {
    const fe = await addFixedExpense({ ...wifi, deductionDay: 12 }, '2026-11-10', {}, database)
    await pauseFixedExpense(fe.id, '2026-11-12', database) // due today → deducted before pausing
    await startup('2027-01-20', database) // Dec 12 and Jan 12 fall while paused
    await resumeFixedExpense(fe.id, '2027-01-20', database)
    await startup('2027-02-13', database)
    expect(await autos()).toEqual([
      ['2026-11-12', 79900, false],
      ['2027-02-12', 79900, false],
    ])
  })

  it('ending keeps past deductions and stops future ones', async () => {
    const fe = await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: true }, database)
    await endFixedExpense(fe.id, '2026-11-20', database)
    await startup('2027-01-10', database)
    expect(await autos()).toEqual([['2026-11-05', 79900, false]])
    expect((await database.fixedExpenses.get(fe.id))!.endDate).toBe('2026-11-20')
  })
})

describe('skip and restore (FR-3.6)', () => {
  it('restores a skipped deduction', async () => {
    await addFixedExpense(wifi, '2026-11-10', { deductThisCycle: true }, database)
    const [tx] = await database.transactions.toArray()
    await deleteTransaction(tx!.id, database)
    expect(await autos()).toEqual([['2026-11-05', 79900, true]])
    await unskipDeduction(tx!.id, database)
    expect(await autos()).toEqual([['2026-11-05', 79900, false]])
  })
})

describe('nextDueDate', () => {
  it('skips dues that already have a transaction and handles paused', async () => {
    const fe = await addFixedExpense({ ...wifi, deductionDay: 10 }, '2026-11-10', {}, database)
    expect(nextDueDate(fe, '2026-11-10', new Set())).toBe('2026-11-10')
    expect(nextDueDate(fe, '2026-11-10', new Set(['2026-11-10']))).toBe('2026-12-10')
    expect(nextDueDate({ ...fe, isPaused: true }, '2026-11-10', new Set())).toBeUndefined()
    expect(nextDueDate({ ...fe, endDate: '2026-11-30' }, '2026-11-11', new Set())).toBeUndefined()
  })
})
