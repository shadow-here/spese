import { incomeKind } from '../domain/income'
import { paymentMethodName } from '../domain/payment'
import type { Transaction } from '../domain/types'
import { toCsv } from '../lib/csv'
import { paiseToInput } from '../lib/money'
import { db as defaultDb, type TrackerDB } from './db'

const TYPE_LABEL: Record<Transaction['type'], string> = { expense: 'Expense', income: 'Income', auto: 'Fixed', refund: 'Refund' }

/**
 * Export every transaction as CSV for spreadsheets (PRD #26, FR-6.2). One row per entry, oldest
 * first. Amounts are plain rupees ("1800.50"), signed: money out is negative, money in positive,
 * so a SUM() of the column is the net change. Skipped auto-deductions are left out.
 */
export async function exportTransactionsCsv(database: TrackerDB = defaultDb): Promise<string> {
  const [transactions, categories, cycles] = await Promise.all([
    database.transactions.orderBy('date').toArray(),
    database.categories.toArray(),
    database.cycles.toArray(),
  ])
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const cycleStart = new Map(cycles.map((c) => [c.id, c.start]))
  const byId = new Map(transactions.map((t) => [t.id, t]))

  const header = ['Date', 'Type', 'Category', 'Note', 'Amount (₹)', 'Paid with', 'Pay cycle start', 'Refund for']
  const rows = transactions
    .filter((t) => !t.skipped)
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => {
      const incoming = t.type === 'income' || t.type === 'refund'
      const category = t.type === 'income' ? incomeKind(t.categoryId).name : (catName.get(t.categoryId) ?? 'Other')
      const parent = t.refundOf ? byId.get(t.refundOf) : undefined
      return [
        t.date,
        t.fixedExpenseId && t.type === 'income' ? 'Recurring income' : TYPE_LABEL[t.type],
        category,
        t.note,
        `${incoming ? '' : '-'}${paiseToInput(t.amount)}`,
        paymentMethodName(t.paymentMethod),
        cycleStart.get(t.cycleId),
        parent ? `${parent.date} ${parent.note ?? catName.get(parent.categoryId) ?? ''}`.trim() : undefined,
      ]
    })
  return toCsv([header, ...rows])
}

export function csvFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `spese-transactions-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`
}
