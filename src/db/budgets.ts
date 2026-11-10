import { summarizeCycle } from '../domain/balance'
import { budgetRows, type BudgetRow } from '../domain/budgets'
import type { ISODate } from '../lib/date'
import { cycleForDate } from './cycles'
import { db as defaultDb, type TrackerDB } from './db'

/**
 * How much of a category's budget is used in the cycle a date falls in — undefined if the
 * category has no budget or no cycle covers the date. Used to toast when an entry crosses
 * 80% or 100% (FR-5.2).
 */
export async function budgetUse(categoryId: string, date: ISODate, today: ISODate, database: TrackerDB = defaultDb): Promise<BudgetRow | undefined> {
  const category = await database.categories.get(categoryId)
  if (!category?.monthlyLimit) return undefined
  const cycle = await cycleForDate(date, database)
  if (!cycle) return undefined
  const [transactions, fixedExpenses, categories] = await Promise.all([
    database.transactions.where('cycleId').equals(cycle.id).toArray(),
    database.fixedExpenses.toArray(),
    database.categories.toArray(),
  ])
  const summary = summarizeCycle({ cycle, transactions, fixedExpenses, categories, today: today < cycle.end ? today : cycle.end })
  return budgetRows(summary, categories).find((r) => r.category.id === categoryId)
}
