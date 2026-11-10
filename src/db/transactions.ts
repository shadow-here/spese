import { isIncomeKind } from '../domain/income'
import type { PayCycle, Transaction } from '../domain/types'
import type { ISODate } from '../lib/date'
import { formatPaise, type Paise } from '../lib/money'
import { db as defaultDb, newId, type TrackerDB } from './db'

export class ValidationError extends Error {}

/** FR-2.3: expenses may be dated in the current or previous cycle, up to today. */
export async function allowedDateRange(today: ISODate, database: TrackerDB = defaultDb): Promise<{ min: ISODate; max: ISODate }> {
  const cycles = await database.cycles.orderBy('start').reverse().limit(2).toArray()
  const current = cycles[0]
  if (!current) throw new ValidationError('No pay cycle yet')
  return { min: (cycles[1] ?? current).start, max: today }
}

export async function resolveCycle(date: ISODate, today: ISODate, database: TrackerDB): Promise<PayCycle> {
  const { min, max } = await allowedDateRange(today, database)
  if (date < min || date > max) throw new ValidationError('Date must be in this or the previous pay cycle, and not in the future')
  const cycle = await database.cycles.where('start').belowOrEqual(date).last()
  if (!cycle || cycle.end < date) throw new ValidationError('No pay cycle covers that date')
  return cycle
}

export function checkAmount(amount: Paise) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError('Amount must be more than zero')
}

export interface ExpenseInput {
  amount: Paise
  categoryId: string
  date: ISODate
  note?: string
}

/** FR-2.1 */
export function addExpense(input: ExpenseInput, today: ISODate, database: TrackerDB = defaultDb): Promise<Transaction> {
  return addEntry('expense', input, today, database)
}

/**
 * FR-1.5 (P1): one-off income — bonus, freelance, gift. Adds to the balance of the cycle its
 * date falls in. `categoryId` is an income kind (see domain/income.ts).
 */
export async function addIncome(input: ExpenseInput, today: ISODate, database: TrackerDB = defaultDb): Promise<Transaction> {
  if (!isIncomeKind(input.categoryId)) throw new ValidationError('Pick a kind of income')
  return addEntry('income', input, today, database)
}

async function addEntry(type: 'expense' | 'income', input: ExpenseInput, today: ISODate, database: TrackerDB): Promise<Transaction> {
  checkAmount(input.amount)
  return database.transaction('rw', database.cycles, database.transactions, async () => {
    const cycle = await resolveCycle(input.date, today, database)
    const now = Date.now()
    const note = input.note?.trim()
    const tx: Transaction = {
      id: newId(),
      cycleId: cycle.id,
      type,
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

    // An expense with refunds can't drop below what's been refunded, or move after a refund.
    const refunds = existing.type === 'expense' ? await database.transactions.where('refundOf').equals(id).toArray() : []
    if (refunds.length) {
      const refunded = refunds.reduce((s, r) => s + r.amount, 0)
      if (patch.amount !== undefined && patch.amount < refunded)
        throw new ValidationError(`Amount can’t be less than the ${formatPaise(refunded, { decimals: 'auto' })} already refunded`)
      const earliest = refunds.reduce((d, r) => (r.date < d ? r.date : d), refunds[0]!.date)
      if (patch.date !== undefined && patch.date > earliest) throw new ValidationError('The expense can’t be dated after its refunds')
      if (patch.categoryId !== undefined && patch.categoryId !== existing.categoryId)
        await database.transactions.where('refundOf').equals(id).modify({ categoryId: patch.categoryId })
    }

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
 * FR-2.5: delete and return the affected rows (the row first) so the caller can undo.
 * - A row created from a recurring entry (auto-deduction or recurring income) is marked
 *   skipped instead, so the next open doesn't re-create it.
 * - Deleting an expense also deletes its refunds; undo brings them back too.
 */
export async function deleteTransaction(id: string, database: TrackerDB = defaultDb): Promise<Transaction[] | undefined> {
  return database.transaction('rw', database.transactions, async () => {
    const existing = await database.transactions.get(id)
    if (!existing) return undefined
    if (existing.fixedExpenseId) {
      await database.transactions.update(id, { skipped: true, updatedAt: Date.now() })
      return [existing]
    }
    const refunds = existing.type === 'expense' ? await database.transactions.where('refundOf').equals(id).toArray() : []
    await database.transactions.bulkDelete([id, ...refunds.map((r) => r.id)])
    return [existing, ...refunds]
  })
}

/** Undo for deleteTransaction: put the original row(s) back exactly as they were. */
export async function restoreTransaction(rows: Transaction | Transaction[], database: TrackerDB = defaultDb): Promise<void> {
  await database.transactions.bulkPut(Array.isArray(rows) ? rows : [rows])
}

/** Feature 4: quick-add pre-selects the category of the most recently added expense. */
export async function lastUsedCategoryId(database: TrackerDB = defaultDb): Promise<string | undefined> {
  const all = await database.transactions.where('type').equals('expense').toArray()
  let latest: Transaction | undefined
  for (const t of all) if (!latest || t.createdAt > latest.createdAt) latest = t
  return latest?.categoryId
}
