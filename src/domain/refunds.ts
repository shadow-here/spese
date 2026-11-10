import type { Paise } from '../lib/money'
import type { Transaction } from './types'

/**
 * Refund rule (decided 11 Nov 2026, docs/ROADMAP.md Phase 2):
 * - refund in the SAME cycle as its expense → the expense counts net of it;
 * - refund in a LATER cycle → the expense keeps its full amount in its own cycle (that cycle's
 *   savings don't change) and the refund adds to the later cycle's balance as income.
 * "Same cycle" = same cycleId, so it follows the refund's date (and re-homes if cycles shift).
 */

export interface RefundInfo {
  /** Everything refunded on this expense, in any cycle. */
  total: Paise
  /** Refunded within the expense's own cycle — reduces the expense. */
  sameCycle: Paise
  /** Refunded in later cycles — added to those cycles' balances instead. */
  later: Paise
  refunds: Transaction[]
}

/** Refund info per expense id, from any list of transactions that includes the refund rows. */
export function refundsByExpense(transactions: Iterable<Transaction>, expensesById: Map<string, Transaction>): Map<string, RefundInfo> {
  const out = new Map<string, RefundInfo>()
  for (const r of transactions) {
    if (r.type !== 'refund' || !r.refundOf) continue
    const expense = expensesById.get(r.refundOf)
    const info = out.get(r.refundOf) ?? { total: 0, sameCycle: 0, later: 0, refunds: [] }
    info.total += r.amount
    if (expense && expense.cycleId === r.cycleId) info.sameCycle += r.amount
    else info.later += r.amount
    info.refunds.push(r)
    out.set(r.refundOf, info)
  }
  for (const info of out.values()) info.refunds.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  return out
}

/** What an expense counts as in its own cycle. */
export function netAmount(expense: Transaction, info: RefundInfo | undefined): Paise {
  return expense.amount - (info?.sameCycle ?? 0)
}
