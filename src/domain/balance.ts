import { eachDay, type ISODate } from '../lib/date'
import { percentOf, type Paise } from '../lib/money'
import { cycleLength, daysElapsed, daysLeft } from './cycle'
import { dueDatesFor, isIncoming } from './fixed'
import type { Category, FixedExpense, PayCycle, Transaction } from './types'

/**
 * Everything the dashboard shows for one cycle, computed in one pure pass.
 * Remaining = Salary + Other income − Fixed deducted − Variable spent (PRD "Dashboard analytics").
 * Unspent money does not roll over; at cycle end `remaining` is that cycle's savings.
 */
export interface CycleSummary {
  salary: Paise
  otherIncome: Paise
  /** salary + otherIncome */
  totalIncome: Paise
  fixedDeducted: Paise
  /** Fixed costs due later this cycle that haven't been deducted yet. */
  fixedUpcoming: Paise
  /** fixedDeducted + fixedUpcoming — committed up front (FR-3.3). */
  fixedCommitted: Paise
  variableSpent: Paise
  remaining: Paise
  /** totalIncome − fixedCommitted − variableSpent: what's free once all fixed costs are out. */
  freeToSpend: Paise
  /** remaining as % of totalIncome (can go negative). */
  percentLeft: number
  daysLeft: number
  daysElapsed: number
  cycleDays: number
  byCategory: CategorySpend[]
  daily: DailyPoint[]
  /** Latest first; skipped auto-deductions excluded. */
  recent: Transaction[]
  isEmpty: boolean
}

export interface CategorySpend {
  categoryId: string
  name: string
  colour: string
  amount: Paise
  /** Share of all outflow this cycle, 0–100. */
  percent: number
}

export interface DailyPoint {
  date: ISODate
  /** Variable spend that day (fixed deductions excluded so they don't spike the trend). */
  spent: Paise
  /** Cumulative variable spend; null for days after today. */
  cumulative: Paise | null
  /** Even pace that would use exactly the post-fixed budget by cycle end. */
  ideal: Paise
}

export interface SummaryInput {
  cycle: PayCycle
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  categories: Category[]
  today: ISODate
}

const counts = (t: Transaction) => !t.skipped

export function summarizeCycle({ cycle, transactions, fixedExpenses, categories, today }: SummaryInput): CycleSummary {
  const txs = transactions.filter((t) => t.cycleId === cycle.id && counts(t))

  let otherIncome = 0
  let fixedDeducted = 0
  let variableSpent = 0
  const perCategory = new Map<string, Paise>()
  const perDay = new Map<ISODate, Paise>()

  for (const t of txs) {
    if (t.type === 'income') {
      otherIncome += t.amount
      continue
    }
    if (t.type === 'auto') fixedDeducted += t.amount
    else {
      variableSpent += t.amount
      perDay.set(t.date, (perDay.get(t.date) ?? 0) + t.amount)
    }
    perCategory.set(t.categoryId, (perCategory.get(t.categoryId) ?? 0) + t.amount)
  }

  // Upcoming = due dates in this cycle with no transaction row at all (a skipped row means "not this cycle").
  const existing = new Set(
    transactions.filter((t) => t.fixedExpenseId && t.dueDate).map((t) => `${t.fixedExpenseId}|${t.dueDate}`),
  )
  let fixedUpcoming = 0
  for (const fe of fixedExpenses) {
    // Recurring income isn't a commitment, and isn't counted until it actually arrives.
    if (isIncoming(fe)) continue
    for (const due of dueDatesFor(fe, cycle.start, cycle.end)) {
      if (!existing.has(`${fe.id}|${due}`)) fixedUpcoming += fe.amount
    }
  }

  const totalIncome = cycle.salary + otherIncome
  const fixedCommitted = fixedDeducted + fixedUpcoming
  const remaining = totalIncome - fixedDeducted - variableSpent
  const freeToSpend = totalIncome - fixedCommitted - variableSpent

  const outflow = fixedDeducted + variableSpent
  const catById = new Map(categories.map((c) => [c.id, c]))
  const byCategory: CategorySpend[] = [...perCategory.entries()]
    .map(([categoryId, amount]) => {
      const cat = catById.get(categoryId)
      return {
        categoryId,
        name: cat?.name ?? 'Other',
        colour: cat?.colour ?? '#8A8F98',
        amount,
        percent: percentOf(amount, outflow),
      }
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))

  const range = { start: cycle.start, end: cycle.end }
  const cycleDays = cycleLength(range)
  const variableBudget = Math.max(0, totalIncome - fixedCommitted)
  let running = 0
  const daily: DailyPoint[] = eachDay(cycle.start, cycle.end).map((date, i) => {
    const spent = perDay.get(date) ?? 0
    running += spent
    return {
      date,
      spent,
      cumulative: date <= today ? running : null,
      ideal: Math.round((variableBudget * (i + 1)) / cycleDays),
    }
  })

  const recent = [...txs]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, 10)

  return {
    salary: cycle.salary,
    otherIncome,
    totalIncome,
    fixedDeducted,
    fixedUpcoming,
    fixedCommitted,
    variableSpent,
    remaining,
    freeToSpend,
    percentLeft: percentOf(remaining, totalIncome),
    daysLeft: daysLeft(range, today),
    daysElapsed: daysElapsed(range, today),
    cycleDays,
    byCategory,
    daily,
    recent,
    isEmpty: txs.length === 0,
  }
}
