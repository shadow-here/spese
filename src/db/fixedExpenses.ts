import { monthlyDueDates } from '../domain/cycle'
import { isIncomeKind } from '../domain/income'
import type { Direction, FixedExpense } from '../domain/types'
import { addDays, maxDate, type ISODate } from '../lib/date'
import type { Paise } from '../lib/money'
import { runAutoDeductions } from './autoDeduct'
import { db as defaultDb, newId, type TrackerDB } from './db'
import { ValidationError } from './transactions'

export interface FixedInput {
  name: string
  amount: Paise
  categoryId: string
  deductionDay: number
}

function validate(input: Partial<FixedInput>) {
  if (input.name !== undefined && !input.name.trim()) throw new ValidationError('Give it a name')
  if (input.amount !== undefined && (!Number.isSafeInteger(input.amount) || input.amount <= 0))
    throw new ValidationError('Amount must be more than zero')
  if (input.deductionDay !== undefined && (!Number.isInteger(input.deductionDay) || input.deductionDay < 1 || input.deductionDay > 31))
    throw new ValidationError('Deduction day must be 1–31')
}

async function openCycle(database: TrackerDB) {
  const cycle = await database.cycles.where('status').equals('open').last()
  if (!cycle) throw new ValidationError('No open pay cycle')
  return cycle
}

/**
 * Edge case: "Fixed expense added mid-cycle with a deduction day already passed → ask
 * whether to deduct this cycle." Returns that past due date, or undefined if nothing to ask.
 */
export async function passedDueDateThisCycle(deductionDay: number, today: ISODate, database: TrackerDB = defaultDb): Promise<ISODate | undefined> {
  const cycle = await openCycle(database)
  return monthlyDueDates(deductionDay, cycle.start, addDays(today, -1)).at(-1)
}

/**
 * FR-3.1. With `deductThisCycle`, a due date already passed this cycle is deducted now
 * (with its original date); otherwise deductions start from today.
 * `direction: 'in'` makes it recurring income (e.g. a monthly bonus); categoryId is then an
 * income kind. Recurring income adds itself on its day, like a fixed cost deducts itself.
 */
export async function addFixedExpense(
  input: FixedInput,
  today: ISODate,
  options: { deductThisCycle?: boolean; direction?: Direction } = {},
  database: TrackerDB = defaultDb,
): Promise<FixedExpense> {
  validate(input)
  const direction = options.direction ?? 'out'
  if (direction === 'in' && !isIncomeKind(input.categoryId)) throw new ValidationError('Pick a kind of income')
  const cycle = await openCycle(database)
  const now = Date.now()
  const fe: FixedExpense = {
    id: newId(),
    name: input.name.trim(),
    amount: input.amount,
    categoryId: input.categoryId,
    deductionDay: input.deductionDay,
    frequency: 'monthly',
    direction,
    activeFrom: options.deductThisCycle ? cycle.start : today,
    isPaused: false,
    createdAt: now,
    updatedAt: now,
  }
  await database.fixedExpenses.add(fe)
  await runAutoDeductions(today, database)
  return fe
}

/**
 * FR-3.5: edits apply from the next deduction; past deductions keep their amounts.
 * If the day moves and this cycle already has a deduction (or skip) for it, the new
 * day starts next cycle so the same cycle is never charged twice.
 */
export async function updateFixedExpense(
  id: string,
  patch: Partial<FixedInput>,
  today: ISODate,
  database: TrackerDB = defaultDb,
): Promise<void> {
  validate(patch)
  await database.transaction('rw', database.fixedExpenses, database.cycles, database.transactions, async () => {
    const fe = await database.fixedExpenses.get(id)
    if (!fe) throw new ValidationError('Fixed expense not found')
    const changes: Partial<FixedExpense> = { ...patch, updatedAt: Date.now() }
    if (patch.name !== undefined) changes.name = patch.name.trim()
    if (patch.deductionDay !== undefined && patch.deductionDay !== fe.deductionDay) {
      const cycle = await openCycle(database)
      const chargedThisCycle = await database.transactions
        .where('[cycleId+date]')
        .between([cycle.id, cycle.start], [cycle.id, cycle.end], true, true)
        .filter((t) => t.fixedExpenseId === id)
        .count()
      changes.activeFrom = chargedThisCycle ? maxDate(fe.activeFrom, addDays(cycle.end, 1)) : maxDate(fe.activeFrom, today)
    }
    await database.fixedExpenses.update(id, changes)
  })
  await runAutoDeductions(today, database)
}

/** FR-3.5 pause. Anything due up to today is deducted first, so pausing never loses a past due. */
export async function pauseFixedExpense(id: string, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  await runAutoDeductions(today, database)
  await database.fixedExpenses.update(id, { isPaused: true, updatedAt: Date.now() })
}

/** Resume: dues that fell while paused are not back-filled. */
export async function resumeFixedExpense(id: string, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.fixedExpenses, async () => {
    const fe = await database.fixedExpenses.get(id)
    if (!fe) throw new ValidationError('Fixed expense not found')
    await database.fixedExpenses.update(id, { isPaused: false, activeFrom: maxDate(fe.activeFrom, today), updatedAt: Date.now() })
  })
  await runAutoDeductions(today, database)
}

/** FR-3.5 end: past deductions stay; nothing after today. */
export async function endFixedExpense(id: string, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  await runAutoDeductions(today, database)
  await database.fixedExpenses.update(id, { endDate: today, isPaused: false, updatedAt: Date.now() })
}

/** Reverse a "skip this cycle" (FR-3.6). */
export async function unskipDeduction(transactionId: string, database: TrackerDB = defaultDb): Promise<void> {
  await database.transactions.update(transactionId, { skipped: undefined, updatedAt: Date.now() })
}
