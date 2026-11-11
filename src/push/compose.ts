import { summarizeCycle } from '../domain/balance'
import { dueDatesFor, isIncoming } from '../domain/fixed'
import { safeToSpendToday } from '../domain/history'
import type { Category, FixedExpense, PayCycle, Transaction, User } from '../domain/types'
import type { ISODate } from '../lib/date'
import { formatPaise } from '../lib/money'

/**
 * Writes the reminder notification on the phone, from the phone's own data (v1.1 Phase 7,
 * PRD #23 + #24). The push server only says "now" — it never sees an amount or a name.
 *
 * - A fixed cost or recurring income due today → "Rent ₹15,000 deducted today".
 * - Otherwise, nothing logged today → a nudge to log, with today's safe-to-spend.
 * - Otherwise → today's spend and what's left.
 * With the app lock on, no amounts or names appear on the lock screen: just a generic nudge.
 */

export interface Reminder {
  title: string
  body: string
}

export interface ComposeInput {
  user: User | undefined
  cycle: PayCycle | undefined
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  categories: Category[]
  today: ISODate
}

const GENERIC: Reminder = { title: 'Spese', body: 'Logged today’s spending? Tap to add it.' }
const money = (p: number) => formatPaise(p, { decimals: 'never' })

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function composeReminder({ user, cycle, transactions, fixedExpenses, categories, today }: ComposeInput): Reminder {
  if (!user || !cycle) return GENERIC
  if (user.lock) return GENERIC // privacy: the lock screen shows no numbers

  const dueToday = fixedExpenses.filter((fe) => dueDatesFor(fe, today, today).length > 0)
  const out = dueToday.filter((fe) => !isIncoming(fe))
  const incoming = dueToday.filter(isIncoming)
  if (out.length || incoming.length) {
    const parts: string[] = []
    if (out.length) {
      const total = out.reduce((s, fe) => s + fe.amount, 0)
      parts.push(out.length === 1 ? `${out[0]!.name} ${money(total)} deducted today` : `${joinNames(out.map((f) => f.name))} (${money(total)}) deducted today`)
    }
    if (incoming.length) {
      const total = incoming.reduce((s, fe) => s + fe.amount, 0)
      parts.push(`${joinNames(incoming.map((f) => f.name))} +${money(total)} arrives today`)
    }
    return { title: 'Spese', body: parts.join(' · ') }
  }

  const cycleTxs = transactions.filter((t) => t.cycleId === cycle.id)
  const summary = summarizeCycle({ cycle, transactions: cycleTxs, fixedExpenses, categories, today })
  const spentToday = summary.daily.find((d) => d.date === today)?.spent ?? 0
  const loggedToday = cycleTxs.some((t) => t.type === 'expense' && t.date === today)

  if (!loggedToday) {
    return { title: 'Logged today’s spending?', body: `Tap to add it — ${money(safeToSpendToday(summary, user.savingsGoal))} is safe to spend today.` }
  }
  return { title: `Today: ${money(spentToday)} spent`, body: `${money(summary.remaining)} left this cycle.` }
}
