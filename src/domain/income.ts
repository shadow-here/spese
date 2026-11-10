/**
 * Kinds of extra income (v1.1 Phase 1). Stored in Transaction.categoryId / FixedExpense.categoryId
 * for income rows. Kept out of the categories table on purpose: spending categories drive the
 * budget and charts, income kinds don't. Ids never collide with category ids.
 */
export interface IncomeKind {
  id: string
  name: string
  /** Lucide icon name (see CategoryIcon). */
  icon: string
}

export const INCOME_KINDS: IncomeKind[] = [
  { id: 'income-bonus', name: 'Bonus', icon: 'sparkles' },
  { id: 'income-freelance', name: 'Freelance', icon: 'briefcase' },
  { id: 'income-gift', name: 'Gift', icon: 'gift' },
  { id: 'income-other', name: 'Other income', icon: 'circle-plus' },
]

export const DEFAULT_INCOME_KIND = 'income-bonus'

const byId = new Map(INCOME_KINDS.map((k) => [k.id, k]))

export function incomeKind(id: string): IncomeKind {
  return byId.get(id) ?? byId.get('income-other')!
}

export function isIncomeKind(id: string): boolean {
  return byId.has(id)
}
