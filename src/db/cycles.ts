import { cycleContaining, nextCycle } from '../domain/cycle'
import type { PayCycle, User } from '../domain/types'
import type { ISODate } from '../lib/date'
import type { Paise } from '../lib/money'
import { db as defaultDb, newId, type TrackerDB } from './db'

export class NotOnboardedError extends Error {
  constructor() {
    super('No user yet — finish onboarding first')
  }
}

export interface OnboardInput {
  salary: Paise
  payDay: number
  name?: string
  today: ISODate
}

/** FR-1.1: create the user and open the first cycle (the regular cycle containing today). */
export async function onboard(input: OnboardInput, database: TrackerDB = defaultDb): Promise<PayCycle> {
  const { salary, payDay, name = '', today } = input
  if (!Number.isSafeInteger(salary) || salary <= 0) throw new Error('Salary must be a positive amount')
  if (!Number.isInteger(payDay) || payDay < 1 || payDay > 31) throw new Error('Pay day must be 1–31')

  return database.transaction('rw', database.users, database.cycles, async () => {
    if (await database.users.get('me')) throw new Error('Already onboarded')
    const user: User = { id: 'me', name, currency: 'INR', payDay, defaultSalary: salary, createdAt: Date.now() }
    await database.users.add(user)
    const range = cycleContaining(today, payDay)
    const cycle: PayCycle = { id: newId(), ...range, salary, status: 'open', salaryConfirmed: true }
    await database.cycles.add(cycle)
    return cycle
  })
}

/**
 * Make sure an open cycle covers `today`. Closes finished cycles and opens every cycle
 * in between (so a phone left off for months still gets each month's deductions — FR-3.4).
 * New cycles carry the default salary, unconfirmed (FR-1.3). Safe to call on every open.
 */
export async function ensureCurrentCycle(today: ISODate, database: TrackerDB = defaultDb): Promise<PayCycle> {
  return database.transaction('rw', database.users, database.cycles, async () => {
    const user = await database.users.get('me')
    if (!user) throw new NotOnboardedError()

    let open = await database.cycles.where('status').equals('open').last()
    if (!open) {
      // Shouldn't happen, but recover: continue from the latest cycle or start fresh.
      const latest = await database.cycles.orderBy('end').last()
      open = latest
        ? { id: newId(), ...nextCycle(latest.end, user.payDay), salary: user.defaultSalary, status: 'open', salaryConfirmed: false }
        : { id: newId(), ...cycleContaining(today, user.payDay), salary: user.defaultSalary, status: 'open', salaryConfirmed: false }
      await database.cycles.add(open)
    }

    while (open.end < today) {
      await database.cycles.update(open.id, { status: 'closed' })
      const next: PayCycle = {
        id: newId(),
        ...nextCycle(open.end, user.payDay),
        salary: user.defaultSalary,
        status: 'open',
        salaryConfirmed: false,
      }
      await database.cycles.add(next)
      open = next
    }
    return open
  })
}

/** The stored cycle a date belongs to, or undefined if it's outside every cycle. */
export async function cycleForDate(date: ISODate, database: TrackerDB = defaultDb): Promise<PayCycle | undefined> {
  const candidate = await database.cycles.where('start').belowOrEqual(date).last()
  return candidate && candidate.end >= date ? candidate : undefined
}

/** FR-1.3: user confirms or edits the salary for a cycle; it becomes the default for future cycles. */
export async function confirmSalary(cycleId: string, salary: Paise, database: TrackerDB = defaultDb): Promise<void> {
  if (!Number.isSafeInteger(salary) || salary <= 0) throw new Error('Salary must be a positive amount')
  await database.transaction('rw', database.users, database.cycles, async () => {
    const cycle = await database.cycles.get(cycleId)
    if (!cycle) throw new Error('Cycle not found')
    await database.cycles.update(cycleId, { salary, salaryConfirmed: true })
    if (cycle.status === 'open') await database.users.update('me', { defaultSalary: salary })
  })
}
