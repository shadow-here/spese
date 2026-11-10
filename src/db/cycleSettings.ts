import { nextPayDateAfter } from '../domain/cycle'
import type { PayCycle } from '../domain/types'
import { addDays, daysBetween, type ISODate } from '../lib/date'
import { runAutoDeductions } from './autoDeduct'
import { ensureCurrentCycle } from './cycles'
import { db as defaultDb, type TrackerDB } from './db'
import { ValidationError } from './transactions'

/** Re-home every transaction to the stored cycle that covers its date. */
async function reassignTransactions(database: TrackerDB): Promise<void> {
  const cycles = await database.cycles.orderBy('start').toArray()
  const find = (date: ISODate) => cycles.find((c) => c.start <= date && c.end >= date)
  await database.transactions.toCollection().modify((t) => {
    const c = find(t.date)
    if (c && c.id !== t.cycleId) t.cycleId = c.id
  })
}

async function currentAndPrevious(database: TrackerDB): Promise<{ current: PayCycle; previous?: PayCycle }> {
  const [current, previous] = await database.cycles.orderBy('start').reverse().limit(2).toArray()
  if (!current) throw new ValidationError('No pay cycle yet')
  return { current, previous }
}

/**
 * Edge case "Pay date changed mid-cycle → current cycle ends early; new cycle starts on
 * the new date." The current cycle now ends the day before the next occurrence of the new
 * pay day (on or after today). If that would leave it empty, it keeps its start and runs
 * to the day before the first new pay date after its start.
 */
export async function changePayDay(newPayDay: number, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  if (!Number.isInteger(newPayDay) || newPayDay < 1 || newPayDay > 31) throw new ValidationError('Pay day must be 1–31')
  await database.transaction('rw', database.users, database.cycles, database.transactions, async () => {
    const user = await database.users.get('me')
    if (!user) throw new ValidationError('Not set up yet')
    if (user.payDay === newPayDay) return
    const { current } = await currentAndPrevious(database)
    const nextStart = nextPayDateAfter(addDays(today, -1), newPayDay) // on or after today
    const newEnd = nextStart > current.start ? addDays(nextStart, -1) : addDays(nextPayDateAfter(current.start, newPayDay), -1)
    await database.users.update('me', { payDay: newPayDay })
    await database.cycles.update(current.id, { end: newEnd })
  })
  await ensureCurrentCycle(today, database)
  await database.transaction('rw', database.cycles, database.transactions, () => reassignTransactions(database))
  await runAutoDeductions(today, database)
}

/** How far the current cycle's start may move for an early/late salary. */
export const MAX_SHIFT_DAYS = 15

/**
 * Edge case "Salary credited late or early → user can shift the cycle start date for that
 * month." Moves the current cycle's start (its end stays); the previous cycle's end moves
 * with it, and transactions follow their dates into the right cycle.
 */
export async function shiftCurrentCycleStart(newStart: ISODate, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.cycles, database.transactions, async () => {
    const { current, previous } = await currentAndPrevious(database)
    if (newStart === current.start) return
    if (Math.abs(daysBetween(current.start, newStart)) > MAX_SHIFT_DAYS)
      throw new ValidationError(`Can only move the start by up to ${MAX_SHIFT_DAYS} days`)
    if (newStart > today) throw new ValidationError('The start can’t be in the future')
    if (newStart > current.end) throw new ValidationError('The start must be before the cycle ends')
    if (previous) {
      if (newStart <= previous.start) throw new ValidationError('That would leave the previous cycle empty')
      await database.cycles.update(previous.id, { end: addDays(newStart, -1) })
    } else if (newStart > current.start) {
      const orphaned = await database.transactions.where('date').below(newStart).count()
      if (orphaned) throw new ValidationError('Some entries are dated before that day — move or delete them first')
    }
    await database.cycles.update(current.id, { start: newStart })
    await reassignTransactions(database)
  })
  await runAutoDeductions(today, database)
}
