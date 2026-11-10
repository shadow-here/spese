import { addDays, minDate, type ISODate } from '../lib/date'
import { percentOf, type Paise } from '../lib/money'
import { summarizeCycle, type CycleSummary } from './balance'
import { dueDatesFor, isIncoming } from './fixed'
import type { Category, FixedExpense, PayCycle, Transaction } from './types'

/** v1.1 Phase 4: numbers that compare cycles or look ahead (PRD #15, #16, #17 + P1 widgets). */

export interface CycleHistoryEntry {
  cycle: PayCycle
  summary: CycleSummary
  /** remaining ÷ income for a finished cycle (leftover counts as savings); undefined while open. */
  savingsRate?: number
}

/** Summaries for the given cycles, oldest first. Each is viewed as of min(today, its end). */
export function cycleHistory(
  cycles: PayCycle[],
  transactions: Transaction[],
  fixedExpenses: FixedExpense[],
  categories: Category[],
  today: ISODate,
): CycleHistoryEntry[] {
  return [...cycles]
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((cycle) => {
      const summary = summarizeCycle({ cycle, transactions, fixedExpenses, categories, today: minDate(today, cycle.end) })
      const finished = cycle.end < today
      return { cycle, summary, savingsRate: finished ? percentOf(summary.remaining, summary.totalIncome) : undefined }
    })
}

/**
 * Safe to spend today: what's free once every fixed cost due this cycle is out, spread over
 * the days left (today included). Never negative; rounded down to whole rupees.
 */
export function safeToSpendToday(summary: CycleSummary): Paise {
  if (summary.daysLeft <= 0 || summary.freeToSpend <= 0) return 0
  return Math.floor(summary.freeToSpend / summary.daysLeft / 100) * 100
}

/** Share of this cycle's income committed to fixed costs (deducted + still to come), 0–100+. */
export function fixedShare(summary: CycleSummary): number {
  return percentOf(summary.fixedCommitted, summary.totalIncome)
}

export interface UpcomingItem {
  fixedExpense: FixedExpense
  date: ISODate
  amount: Paise
  incoming: boolean
}

/**
 * Fixed costs and recurring income due in the next 7 days (tomorrow through today+7) that
 * haven't happened yet. Today's are already applied on open, so they're not "upcoming".
 */
export function upcomingInNextWeek(fixedExpenses: FixedExpense[], transactions: Transaction[], today: ISODate): UpcomingItem[] {
  const handled = new Set(transactions.filter((t) => t.fixedExpenseId && t.dueDate).map((t) => `${t.fixedExpenseId}|${t.dueDate}`))
  const from = addDays(today, 1)
  const to = addDays(today, 7)
  const out: UpcomingItem[] = []
  for (const fe of fixedExpenses) {
    for (const date of dueDatesFor(fe, from, to)) {
      if (!handled.has(`${fe.id}|${date}`)) out.push({ fixedExpense: fe, date, amount: fe.amount, incoming: isIncoming(fe) })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.fixedExpense.name.localeCompare(b.fixedExpense.name) : a.date < b.date ? -1 : 1))
}

export interface MonthOverMonth {
  /** Oldest first; the last one is the cycle being viewed. */
  cycles: { cycle: PayCycle; total: Paise; isOpen: boolean }[]
  /** Top categories across these cycles, with each cycle's spend in cycle order. */
  categories: { categoryId: string; name: string; amounts: Paise[] }[]
}

/** This cycle vs up to 3 before it: total spend (fixed + variable, net of refunds) and top categories. */
export function monthOverMonth(history: CycleHistoryEntry[], today: ISODate, topN = 5): MonthOverMonth {
  const last = history.slice(-4)
  const byCat = new Map<string, { name: string; amounts: Paise[]; total: Paise }>()
  last.forEach((h, i) => {
    for (const c of h.summary.byCategory) {
      const entry = byCat.get(c.categoryId) ?? { name: c.name, amounts: last.map(() => 0), total: 0 }
      entry.amounts[i] = c.amount
      entry.total += c.amount
      byCat.set(c.categoryId, entry)
    }
  })
  return {
    cycles: last.map((h) => ({ cycle: h.cycle, total: h.summary.fixedDeducted + h.summary.variableSpent, isOpen: h.cycle.end >= today })),
    categories: [...byCat.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, topN)
      .map(([categoryId, v]) => ({ categoryId, name: v.name, amounts: v.amounts })),
  }
}
