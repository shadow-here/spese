import type { ISODate } from '../lib/date'
import { paiseToInput } from '../lib/money'
import { incomeKind } from './income'
import { paymentMethodName } from './payment'
import type { Category, PaymentMethod, Transaction } from './types'

/** Search and filter for the Transactions list (PRD #22). Pure, so it's easy to test. */

export interface TransactionFilter {
  /** Free text: matches note, category / income kind, payment method, or amount ("240", "1,800"). */
  text?: string
  /** A spending category id, an income kind id, or 'income' for all income. */
  categoryId?: string
  paymentMethod?: PaymentMethod
  from?: ISODate
  to?: ISODate
}

export function isFilterActive(f: TransactionFilter): boolean {
  return Boolean(f.text?.trim() || f.categoryId || f.paymentMethod || f.from || f.to)
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[₹,\s]/g, '')
}

/**
 * Rows that match every set part of the filter. Refund rows are never listed on their own, but
 * a refund's note counts as a match for its expense ("Rahul" finds the dinner he paid back for).
 */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter,
  categories: Category[],
): Transaction[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const refundNotes = new Map<string, string[]>()
  for (const t of transactions) {
    if (t.type === 'refund' && t.refundOf && t.note) refundNotes.set(t.refundOf, [...(refundNotes.get(t.refundOf) ?? []), t.note])
  }
  const needle = filter.text ? normalise(filter.text) : ''

  return transactions.filter((t) => {
    if (t.type === 'refund' || t.skipped) return false
    if (filter.categoryId) {
      if (filter.categoryId === 'income') {
        if (t.type !== 'income') return false
      } else if (t.categoryId !== filter.categoryId) return false
    }
    if (filter.paymentMethod && t.paymentMethod !== filter.paymentMethod) return false
    if (filter.from && t.date < filter.from) return false
    if (filter.to && t.date > filter.to) return false
    if (needle) {
      const label = t.type === 'income' ? incomeKind(t.categoryId).name : (catName.get(t.categoryId) ?? '')
      const haystack = [t.note ?? '', label, paymentMethodName(t.paymentMethod) ?? '', paiseToInput(t.amount), ...(refundNotes.get(t.id) ?? [])]
      if (!haystack.some((h) => normalise(h).includes(needle))) return false
    }
    return true
  })
}
