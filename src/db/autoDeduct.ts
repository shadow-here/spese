import { dueDatesFor } from '../domain/fixed'
import type { Transaction } from '../domain/types'
import type { ISODate } from '../lib/date'
import { db as defaultDb, newId, type TrackerDB } from './db'

/**
 * Create the "Auto" transaction for every active fixed expense whose due date is on or
 * before today and doesn't have one yet (FR-3.2), back-filling missed ones with their
 * original dates (FR-3.4). Idempotent: keyed on [fixedExpenseId+dueDate], and a skipped
 * or edited auto-transaction still counts as existing. Returns the rows it created.
 *
 * Only dates inside a stored cycle are deducted; nothing before the first cycle.
 * Callers that pause a fixed expense should run this first so earlier dues aren't lost.
 */
export async function runAutoDeductions(today: ISODate, database: TrackerDB = defaultDb): Promise<Transaction[]> {
  return database.transaction('rw', database.fixedExpenses, database.cycles, database.transactions, async () => {
    const first = await database.cycles.orderBy('start').first()
    if (!first) return []
    const cycles = await database.cycles.orderBy('start').toArray()
    const cycleFor = (date: ISODate) => cycles.find((c) => c.start <= date && c.end >= date)

    const created: Transaction[] = []
    const fixed = await database.fixedExpenses.toArray()
    for (const fe of fixed) {
      for (const dueDate of dueDatesFor(fe, first.start, today)) {
        const exists = await database.transactions.where('[fixedExpenseId+dueDate]').equals([fe.id, dueDate]).count()
        if (exists) continue
        const cycle = cycleFor(dueDate)
        if (!cycle) continue
        const now = Date.now()
        const tx: Transaction = {
          id: newId(),
          cycleId: cycle.id,
          type: 'auto',
          amount: fe.amount,
          categoryId: fe.categoryId,
          date: dueDate,
          note: fe.name,
          fixedExpenseId: fe.id,
          dueDate,
          createdAt: now,
          updatedAt: now,
        }
        await database.transactions.add(tx)
        created.push(tx)
      }
    }
    return created
  })
}
