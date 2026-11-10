import 'fake-indexeddb/auto'
import { runAutoDeductions } from './autoDeduct'
import { confirmSalary, cycleForDate, ensureCurrentCycle, NotOnboardedError, onboard } from './cycles'
import { newId, TrackerDB } from './db'
import { startup } from './startup'
import type { FixedExpense } from '../domain/types'

let database: TrackerDB
let n = 0

beforeEach(async () => {
  database = new TrackerDB(`test-${++n}`)
  await database.open()
})
afterEach(async () => {
  await database.delete()
})

function fixed(overrides: Partial<FixedExpense> = {}): FixedExpense {
  return {
    id: newId(),
    name: 'WiFi',
    amount: 79900,
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

const autos = () => database.transactions.where('type').equals('auto').sortBy('date')

describe('database', () => {
  it('seeds the 7 default categories', async () => {
    const cats = await database.categories.orderBy('order').toArray()
    expect(cats.map((c) => c.name)).toEqual(['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'])
  })
})

describe('onboarding and cycles', () => {
  it('startup asks for onboarding before a user exists', async () => {
    expect(await startup('2026-11-09', database)).toEqual({ status: 'needs-onboarding' })
    await expect(ensureCurrentCycle('2026-11-09', database)).rejects.toBeInstanceOf(NotOnboardedError)
  })

  it('opens the cycle containing today', async () => {
    const cycle = await onboard({ salary: 5000000, payDay: 25, today: '2026-11-09' }, database)
    expect(cycle).toMatchObject({ start: '2026-10-25', end: '2026-11-24', salary: 5000000, status: 'open', salaryConfirmed: true })
  })

  it('rejects bad input and double onboarding', async () => {
    await expect(onboard({ salary: 0, payDay: 1, today: '2026-11-09' }, database)).rejects.toThrow()
    await expect(onboard({ salary: 100, payDay: 32, today: '2026-11-09' }, database)).rejects.toThrow()
    await onboard({ salary: 100, payDay: 1, today: '2026-11-09' }, database)
    await expect(onboard({ salary: 100, payDay: 1, today: '2026-11-09' }, database)).rejects.toThrow('Already onboarded')
  })

  it('keeps the same cycle within its dates', async () => {
    const first = await onboard({ salary: 5000000, payDay: 25, today: '2026-11-09' }, database)
    const again = await ensureCurrentCycle('2026-11-24', database)
    expect(again.id).toBe(first.id)
    expect(await database.cycles.count()).toBe(1)
  })

  it('rolls over on the pay date with an unconfirmed carried-over salary', async () => {
    const first = await onboard({ salary: 5000000, payDay: 25, today: '2026-11-09' }, database)
    const next = await ensureCurrentCycle('2026-11-25', database)
    expect(next).toMatchObject({ start: '2026-11-25', end: '2026-12-24', salary: 5000000, salaryConfirmed: false, status: 'open' })
    expect((await database.cycles.get(first.id))!.status).toBe('closed')
  })

  it('fills in every cycle missed while the app was closed', async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-09' }, database)
    const current = await ensureCurrentCycle('2027-02-14', database)
    expect(current).toMatchObject({ start: '2027-02-01', end: '2027-02-28' })
    const all = await database.cycles.orderBy('start').toArray()
    expect(all.map((c) => [c.start, c.end, c.status])).toEqual([
      ['2026-11-01', '2026-11-30', 'closed'],
      ['2026-12-01', '2026-12-31', 'closed'],
      ['2027-01-01', '2027-01-31', 'closed'],
      ['2027-02-01', '2027-02-28', 'open'],
    ])
  })

  it('finds the cycle for a date', async () => {
    await onboard({ salary: 100, payDay: 25, today: '2026-11-09' }, database)
    await ensureCurrentCycle('2026-12-01', database)
    expect((await cycleForDate('2026-11-24', database))?.start).toBe('2026-10-25')
    expect((await cycleForDate('2026-11-25', database))?.start).toBe('2026-11-25')
    expect(await cycleForDate('2026-10-24', database)).toBeUndefined()
    expect(await cycleForDate('2026-12-25', database)).toBeUndefined()
  })

  it('confirming salary updates the cycle and the default', async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-09' }, database)
    const next = await ensureCurrentCycle('2026-12-02', database)
    await confirmSalary(next.id, 5500000, database)
    expect(await database.cycles.get(next.id)).toMatchObject({ salary: 5500000, salaryConfirmed: true })
    expect((await database.users.get('me'))!.defaultSalary).toBe(5500000)
  })
})

describe('auto-deductions', () => {
  beforeEach(async () => {
    await onboard({ salary: 5000000, payDay: 25, today: '2026-11-01' }, database) // cycle 25 Oct–24 Nov
  })

  it('deducts on the due day, not before', async () => {
    await database.fixedExpenses.add(fixed({ deductionDay: 5 }))
    expect(await runAutoDeductions('2026-11-04', database)).toHaveLength(0)
    const created = await runAutoDeductions('2026-11-05', database)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ type: 'auto', amount: 79900, date: '2026-11-05', dueDate: '2026-11-05', categoryId: 'bills', note: 'WiFi' })
  })

  it('is idempotent across repeated opens', async () => {
    await database.fixedExpenses.add(fixed())
    await runAutoDeductions('2026-11-09', database)
    await runAutoDeductions('2026-11-09', database)
    await startup('2026-11-09', database)
    expect(await autos()).toHaveLength(1)
  })

  it('back-fills missed deductions across cycles with original dates and cycle ids', async () => {
    await database.fixedExpenses.add(fixed({ deductionDay: 5 }))
    await database.fixedExpenses.add(fixed({ name: 'Gym', amount: 150000, deductionDay: 31, categoryId: 'health' }))
    const result = await startup('2027-01-10', database)
    expect(result.status).toBe('ready')
    const rows = await autos()
    expect(rows.map((r) => [r.note, r.date])).toEqual([
      ['Gym', '2026-10-31'],
      ['WiFi', '2026-11-05'],
      ['Gym', '2026-11-30'],
      ['WiFi', '2026-12-05'],
      ['Gym', '2026-12-31'],
      ['WiFi', '2027-01-05'],
    ])
    for (const r of rows) {
      const c = await database.cycles.get(r.cycleId)
      expect(r.date >= c!.start && r.date <= c!.end).toBe(true)
    }
  })

  it('does not re-create a deduction that was edited or skipped', async () => {
    await database.fixedExpenses.add(fixed())
    const [tx] = await runAutoDeductions('2026-11-09', database)
    await database.transactions.update(tx!.id, { date: '2026-11-07', amount: 50000 })
    expect(await runAutoDeductions('2026-11-09', database)).toHaveLength(0)
    await database.transactions.update(tx!.id, { skipped: true })
    expect(await runAutoDeductions('2026-11-09', database)).toHaveLength(0)
    expect(await autos()).toHaveLength(1)
  })

  it('skips paused, not-yet-active and ended fixed expenses', async () => {
    await database.fixedExpenses.add(fixed({ name: 'Paused', isPaused: true }))
    await database.fixedExpenses.add(fixed({ name: 'Later', activeFrom: '2026-11-06' }))
    await database.fixedExpenses.add(fixed({ name: 'Ended', endDate: '2026-11-04' }))
    await database.fixedExpenses.add(fixed({ name: 'Active' }))
    await runAutoDeductions('2026-11-09', database)
    expect((await autos()).map((r) => r.note)).toEqual(['Active'])
  })

  it('ending keeps past deductions and stops future ones', async () => {
    const fe = fixed()
    await database.fixedExpenses.add(fe)
    await startup('2026-12-10', database)
    expect(await autos()).toHaveLength(2)
    await database.fixedExpenses.update(fe.id, { endDate: '2026-12-10' })
    await startup('2027-02-10', database)
    expect((await autos()).map((r) => r.date)).toEqual(['2026-11-05', '2026-12-05'])
  })

  it('never deducts before the first cycle', async () => {
    await database.fixedExpenses.add(fixed({ deductionDay: 20, activeFrom: '2026-01-01' }))
    await runAutoDeductions('2026-11-09', database)
    // Cycle starts 25 Oct, so 20 Oct is out; next is 20 Nov (future).
    expect(await autos()).toHaveLength(0)
  })
})
