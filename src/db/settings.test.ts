import 'fake-indexeddb/auto'
import { backupOverdue, createBackup, deleteAllData, parseBackup, restoreBackup } from './backup'
import { changePayDay, shiftCurrentCycleStart } from './cycleSettings'
import { ensureCurrentCycle, onboard } from './cycles'
import { TrackerDB } from './db'
import { addFixedExpense } from './fixedExpenses'
import { addExpense } from './transactions'

let database: TrackerDB
let n = 0

beforeEach(async () => {
  database = new TrackerDB(`settings-test-${++n}`)
  await database.open()
})
afterEach(async () => {
  await database.delete()
})

const cycles = async () => (await database.cycles.orderBy('start').toArray()).map((c) => [c.start, c.end, c.status])
const cycleOf = async (txId: string) => {
  const t = await database.transactions.get(txId)
  const c = await database.cycles.get(t!.cycleId)
  return c!.start
}

describe('changePayDay', () => {
  it('ends the current cycle early and starts a new one on the new date', async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database) // 1–30 Nov
    await changePayDay(25, '2026-11-10', database)
    expect(await cycles()).toEqual([['2026-11-01', '2026-11-24', 'open']])
    await ensureCurrentCycle('2026-11-25', database)
    expect(await cycles()).toEqual([
      ['2026-11-01', '2026-11-24', 'closed'],
      ['2026-11-25', '2026-12-24', 'open'],
    ])
    expect((await database.users.get('me'))!.payDay).toBe(25)
  })

  it('switches today when the new pay day is today, moving today’s entries along', async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database)
    const old = await addExpense({ amount: 100, categoryId: 'food', date: '2026-11-09' }, '2026-11-10', database)
    const todays = await addExpense({ amount: 100, categoryId: 'food', date: '2026-11-10' }, '2026-11-10', database)
    await changePayDay(10, '2026-11-10', database)
    expect(await cycles()).toEqual([
      ['2026-11-01', '2026-11-09', 'closed'],
      ['2026-11-10', '2026-12-09', 'open'],
    ])
    expect(await cycleOf(old.id)).toBe('2026-11-01')
    expect(await cycleOf(todays.id)).toBe('2026-11-10')
  })

  it('extends the cycle when the next new pay date is after its end', async () => {
    await onboard({ salary: 5000000, payDay: 25, today: '2026-11-10' }, database) // 25 Oct–24 Nov
    await changePayDay(1, '2026-11-10', database)
    expect(await cycles()).toEqual([['2026-10-25', '2026-11-30', 'open']])
  })
})

describe('shiftCurrentCycleStart', () => {
  beforeEach(async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-10-15' }, database)
    await ensureCurrentCycle('2026-11-10', database) // Oct closed, Nov open
  })

  it('salary came early: current cycle starts earlier, previous ends earlier, entries follow', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: '2026-10-30' }, '2026-11-10', database)
    expect(await cycleOf(tx.id)).toBe('2026-10-01')
    await shiftCurrentCycleStart('2026-10-29', '2026-11-10', database)
    expect(await cycles()).toEqual([
      ['2026-10-01', '2026-10-28', 'closed'],
      ['2026-10-29', '2026-11-30', 'open'],
    ])
    expect(await cycleOf(tx.id)).toBe('2026-10-29')
  })

  it('salary came late: entries before the new start go back to the previous cycle', async () => {
    const tx = await addExpense({ amount: 100, categoryId: 'food', date: '2026-11-02' }, '2026-11-10', database)
    await shiftCurrentCycleStart('2026-11-03', '2026-11-10', database)
    expect(await cycles()).toEqual([
      ['2026-10-01', '2026-11-02', 'closed'],
      ['2026-11-03', '2026-11-30', 'open'],
    ])
    expect(await cycleOf(tx.id)).toBe('2026-10-01')
  })

  it('rejects big, future or empty-making shifts', async () => {
    await expect(shiftCurrentCycleStart('2026-10-10', '2026-11-10', database)).rejects.toThrow('15 days')
    await expect(shiftCurrentCycleStart('2026-11-12', '2026-11-10', database)).rejects.toThrow('future')
  })
})

describe('backup', () => {
  beforeEach(async () => {
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database)
    await addExpense({ amount: 24000, categoryId: 'food', date: '2026-11-09', note: 'Lunch' }, '2026-11-10', database)
    await addFixedExpense({ name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 5 }, '2026-11-10', { deductThisCycle: true }, database)
  })

  it('round-trips everything through JSON', async () => {
    const backup = await createBackup(database, 1_800_000_000_000)
    const text = JSON.stringify(backup)
    await deleteAllData(database)
    expect(await database.users.count()).toBe(0)
    expect(await database.categories.count()).toBe(7) // re-seeded on reopen

    await restoreBackup(parseBackup(text), database)
    expect(await database.transactions.count()).toBe(2)
    expect(await database.fixedExpenses.count()).toBe(1)
    expect((await database.users.get('me'))!.lastBackupAt).toBe(1_800_000_000_000)
    expect((await database.transactions.where('type').equals('expense').first())!.note).toBe('Lunch')
  })

  it('rejects files that are not valid backups, without touching data', async () => {
    const good = await createBackup(database)
    expect(() => parseBackup('not json')).toThrow('not valid JSON')
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow('not from this app')
    expect(() => parseBackup(JSON.stringify({ ...good, version: 99 }))).toThrow('newer version')
    const badAmount = structuredClone(good)
    badAmount.data.transactions[0]!.amount = 12.5
    expect(() => parseBackup(JSON.stringify(badAmount))).toThrow('transaction')
    const orphan = structuredClone(good)
    orphan.data.transactions[0]!.cycleId = 'nope'
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow('transaction cycle')
    expect(await database.transactions.count()).toBe(2)
  })

  it('reminds after 14 days without a backup', async () => {
    const user = (await database.users.get('me'))!
    const day = 86_400_000
    expect(backupOverdue({ ...user, createdAt: 0 }, 13 * day)).toBe(false)
    expect(backupOverdue({ ...user, createdAt: 0 }, 15 * day)).toBe(true)
    expect(backupOverdue({ ...user, createdAt: 0, lastBackupAt: 10 * day }, 15 * day)).toBe(false)
  })
})
