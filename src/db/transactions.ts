import type { PayCycle, Transaction } from '../domain/types'
import type { ISODate } from '../lib/date'
import type { Paise } from '../lib/money'
import { db as defaultDb, newId, type TrackerDB } from './db'

export class ValidationError extends Error {}

/** FR-2.3: expenses may be dated in the current or previous cycle, up to today. */
export async function allowedDateRange(today: ISODate, database: TrackerDB = defaultDb): Promise<{ min: ISODate; max: ISODate }> {
  const cycles = await database.cycles.orderBy('start').reverse().limit(2).toArray()
  const current = cycles[0]
  if (!current) throw new ValidationError('No pay cycle yet')
  return { min: (cycles[1] ?? current).start, max: today }
}

async function resolveCycle(date: ISODate, today: ISODate, database: TrackerDB): Promise<PayCycle> {
  const { min, max } = await allowedDateRange(today, database)
  if (date < min || date > max) throw new ValidationError('Date must be in this or the previous pay cycle, and not in the future')
  const cycle = await database.cycles.where('start').belowOrEqual(date).last()
  if (!cycle || cycle.end < date) throw new ValidationError('No pay cycle covers that date')
  return cycle
}

function checkAmount(amount: Paise) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError('Amount must be more than zero')
}

export interface ExpenseInput {
  amount: Paise
  categoryId: string
  date: ISODate
  note?: string
}

/** FR-2.1 */
export async function addExpense(input: ExpenseInput, today: ISODate, database: TrackerDB = defaultDb): Promise<Transaction> {
  checkAmount(input.amount)
  return database.transaction('rw', database.cycles, database.transactions, async () => {
    const cycle = await resolveCycle(input.date, today, database)
    const now = Date.now()
    const note = input.note?.trim()
    const tx: Transaction = {
      id: newId(),
      cycleId: cycle.id,
      type: 'expense',
      amount: input.amount,
      categoryId: input.categoryId,
      date: input.date,
      ...(note ? { note } : {}),
      createdAt: now,
      updatedAt: now,
    }
    await database.transactions.add(tx)
    return tx
  })
}

/**
 * FR-2.4 / FR-3.6: edit any transaction. Moving the date re-assigns the cycle.
 * Auto-deductions keep their dueDate, so editing never causes a duplicate deduction.
 */
export async function updateTransaction(
  id: string,
  patch: Partial<ExpenseInput>,
  today: ISODate,
  database: TrackerDB = defaultDb,
): Promise<void> {
  if (patch.amount !== undefined) checkAmount(patch.amount)
  await database.transaction('rw', database.cycles, database.transactions, async () => {
    const existing = await database.transactions.get(id)
    if (!existing) throw new ValidationError('Transaction not found')
    const changes: Partial<Transaction> = { updatedAt: Date.now() }
    if (patch.amount !== undefined) changes.amount = patch.amount
    if (patch.categoryId !== undefined) changes.categoryId = patch.categoryId
    if (patch.note !== undefined) changes.note = patch.note.trim() || undefined
    if (patch.date !== undefined && patch.date !== existing.date) {
      const cycle = await resolveCycle(patch.date, today, database)
      changes.date = patch.date
      changes.cycleId = cycle.id
    }
    await database.transactions.update(id, changes)
  })
}

/**
 * FR-2.5: delete and return the row so the caller can undo.
 * An auto-deduction is marked skipped instead, so the next open doesn't re-create it.
 */
export async function deleteTransaction(id: string, database: TrackerDB = defaultDb): Promise<Transaction | undefined> {
  return database.transaction('rw', database.transactions, async () => {
    const existing = await database.transactions.get(id)
    if (!existing) return undefined
    if (existing.type === 'auto') await database.transactions.update(id, { skipped: true, updatedAt: Date.now() })
    else await database.transactions.delete(id)
    return existing
  })
}

/** Undo for deleteTransaction: put the original row back exactly as it was. */
export async function restoreTransaction(tx: Transaction, database: TrackerDB = defaultDb): Promise<void> {
  await database.transactions.put(tx)
}

/** Feature 4: quick-add pre-selects the category of the most recently added expense. */
export async function lastUsedCategoryId(database: TrackerDB = defaultDb): Promise<string | undefined> {
  const all = await database.transactions.where('type').equals('expense').toArray()
  let latest: Transaction | undefined
  for (const t of all) if (!latest || t.createdAt > latest.createdAt) latest = t
  return latest?.categoryId
}
