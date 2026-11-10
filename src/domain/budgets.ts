import { percentOf, type Paise } from '../lib/money'
import type { CycleSummary } from './balance'
import type { Category } from './types'

/**
 * Budgets, alerts and the savings goal (v1.1 Phase 5, PRD #18, #19, FR-5.1–5.3).
 * A "monthly" budget applies to each pay cycle. Spend counts the same way as the dashboard:
 * expenses net of same-cycle refunds, plus auto-deducted fixed costs in that category.
 */

export type BudgetLevel = 'ok' | 'near' | 'over'

/** FR-5.2: warn at 80%, over at 100%. */
export const NEAR_AT = 80
export const OVER_AT = 100
/** FR-5.2: alert when remaining drops below 10% of salary. */
export const LOW_BALANCE_SHARE = 10

export function budgetLevel(percent: number): BudgetLevel {
  return percent >= OVER_AT ? 'over' : percent >= NEAR_AT ? 'near' : 'ok'
}

export interface BudgetRow {
  category: Category
  limit: Paise
  spent: Paise
  percent: number
  level: BudgetLevel
  /** limit − spent; negative when over. */
  left: Paise
}

/** One row per category that has a budget, most urgent first (over, near, then by % used). */
export function budgetRows(summary: CycleSummary, categories: Category[]): BudgetRow[] {
  const spentBy = new Map(summary.byCategory.map((c) => [c.categoryId, c.amount]))
  const rank: Record<BudgetLevel, number> = { over: 0, near: 1, ok: 2 }
  return categories
    .filter((c) => c.monthlyLimit !== undefined && c.monthlyLimit > 0)
    .map((category) => {
      const limit = category.monthlyLimit!
      const spent = spentBy.get(category.id) ?? 0
      const percent = percentOf(spent, limit)
      return { category, limit, spent, percent, level: budgetLevel(percent), left: limit - spent }
    })
    .sort((a, b) => rank[a.level] - rank[b.level] || b.percent - a.percent || a.category.order - b.category.order)
}

/** The threshold an entry just crossed for a category, if any (for the toast after saving). */
export function crossedThreshold(beforePercent: number, afterPercent: number): Exclude<BudgetLevel, 'ok'> | undefined {
  if (beforePercent < OVER_AT && afterPercent >= OVER_AT) return 'over'
  if (beforePercent < NEAR_AT && afterPercent >= NEAR_AT) return 'near'
  return undefined
}

/** FR-5.2: remaining below 10% of salary (includes being overspent). */
export function isLowBalance(summary: CycleSummary): boolean {
  return summary.remaining < (summary.salary * LOW_BALANCE_SHARE) / 100
}

export interface GoalProgress {
  goal: Paise
  /** What you can still spend this cycle and end with the goal intact (free to spend − goal). */
  spendable: Paise
  onTrack: boolean
  /** How much of the goal is still protected: min(goal, free to spend), floored at 0. */
  protectedAmount: Paise
}

/**
 * FR-5.3: savings goal per cycle. Leftover counts as savings, so you hit the goal by ending the
 * cycle with at least `goal` left — i.e. by keeping free-to-spend (which already subtracts fixed
 * costs still to come) at or above it.
 */
export function goalProgress(summary: CycleSummary, goal: Paise): GoalProgress {
  const spendable = summary.freeToSpend - goal
  return { goal, spendable, onTrack: spendable >= 0, protectedAmount: Math.max(0, Math.min(goal, summary.freeToSpend)) }
}

/** For a finished cycle: did what was left meet the goal? */
export function goalMet(remaining: Paise, goal: Paise): boolean {
  return remaining >= goal
}
