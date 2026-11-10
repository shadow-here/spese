import type { Transaction } from '../domain/types'
import type { ISODate } from '../lib/date'
import { formatPaise, type Paise } from '../lib/money'
import { db as defaultDb, newId, type TrackerDB } from './db'
import { checkAmount, resolveCycle, ValidationError } from './transactions'

/**
 * Refunds on an expense (v1.1 Phase 2): e.g. paid ₹1,800 for dinner, a friend sent back ₹600.
 * Stored as 'refund' transactions linked by refundOf. How they count is decided by the refund's
 * cycle — see domain/refunds.ts.
 */

export interface RefundInput {
  amount: Paise
  date: ISODate
  note?: string
}

async function loadExpense(expenseId: string, database: TrackerDB): Promise<Transaction> {
  const expense = await database.transactions.get(expenseId)
  if (!expense || expense.type !== 'expense') throw new ValidationError('Refunds can only be added to an expense')
  return expense
}

async function refundedSoFar(expenseId: string, database: TrackerDB, exceptId?: string): Promise<Paise> {
  const refunds = await database.transactions.where('refundOf').equals(expenseId).toArray()
  return refunds.filter((r) => r.id !== exceptId).reduce((s, r) => s + r.amount, 0)
}

function checkWithinExpense(expense: Transaction, alreadyRefunded: Paise, amount: Paise) {
  const left = expense.amount - alreadyRefunded
  if (amount > left)
    throw new ValidationError(
      left <= 0 ? 'This expense is already fully refunded' : `At most ${formatPaise(left, { decimals: 'auto' })} is left to refund on this expense`,
    )
}

function checkDate(expense: Transaction, date: ISODate) {
  if (date < expense.date) throw new ValidationError('A refund can’t be dated before the expense')
}

export function refundsOf(expenseId: string, database: TrackerDB = defaultDb): Promise<Transaction[]> {
  return database.transactions.where('refundOf').equals(expenseId).sortBy('date')
}

export async function addRefund(expenseId: string, input: RefundInput, today: ISODate, database: TrackerDB = defaultDb): Promise<Transaction> {
  checkAmount(input.amount)
  return database.transaction('rw', database.cycles, database.transactions, async () => {
    const expense = await loadExpense(expenseId, database)
    checkDate(expense, input.date)
    checkWithinExpense(expense, await refundedSoFar(expenseId, database), input.amount)
    const cycle = await resolveCycle(input.date, today, database)
    const now = Date.now()
    const note = input.note?.trim()
    const refund: Transaction = {
      id: newId(),
      cycleId: cycle.id,
      type: 'refund',
      amount: input.amount,
      categoryId: expense.categoryId,
      date: input.date,
      refundOf: expenseId,
      ...(note ? { note } : {}),
      createdAt: now,
      updatedAt: now,
    }
    await database.transactions.add(refund)
    return refund
  })
}

export async function updateRefund(id: string, patch: Partial<RefundInput>, today: ISODate, database: TrackerDB = defaultDb): Promise<void> {
  if (patch.amount !== undefined) checkAmount(patch.amount)
  await database.transaction('rw', database.cycles, database.transactions, async () => {
    const refund = await database.transactions.get(id)
    if (!refund || refund.type !== 'refund' || !refund.refundOf) throw new ValidationError('Refund not found')
    const expense = await loadExpense(refund.refundOf, database)
    const changes: Partial<Transaction> = { updatedAt: Date.now() }
    if (patch.amount !== undefined) {
      checkWithinExpense(expense, await refundedSoFar(expense.id, database, id), patch.amount)
      changes.amount = patch.amount
    }
    if (patch.note !== undefined) changes.note = patch.note.trim() || undefined
    if (patch.date !== undefined && patch.date !== refund.date) {
      checkDate(expense, patch.date)
      changes.date = patch.date
      changes.cycleId = (await resolveCycle(patch.date, today, database)).id
    }
    await database.transactions.update(id, changes)
  })
}

/** Delete one refund; returns it for undo (restore with restoreTransaction). */
export async function deleteRefund(id: string, database: TrackerDB = defaultDb): Promise<Transaction | undefined> {
  return database.transaction('rw', database.transactions, async () => {
    const refund = await database.transactions.get(id)
    if (!refund || refund.type !== 'refund') return undefined
    await database.transactions.delete(id)
    return refund
  })
}
