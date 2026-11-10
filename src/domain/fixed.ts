import { addDays, maxDate, minDate, type ISODate } from '../lib/date'
import { monthlyDueDates } from './cycle'
import type { FixedExpense } from './types'

/** Due dates for a fixed expense in [from, to], respecting activeFrom / endDate / pause. */
export function dueDatesFor(fe: FixedExpense, from: ISODate, to: ISODate): ISODate[] {
  if (fe.isPaused) return []
  const start = maxDate(from, fe.activeFrom)
  const end = fe.endDate ? minDate(to, fe.endDate) : to
  return monthlyDueDates(fe.deductionDay, start, end)
}

/**
 * Next date this fixed expense will deduct: the first due date on or after today that
 * has no transaction yet (deducted or skipped). Undefined when paused or ended.
 */
export function nextDueDate(fe: FixedExpense, today: ISODate, handledDueDates: ReadonlySet<ISODate>): ISODate | undefined {
  if (fe.isPaused) return undefined
  const horizon = addDays(today, 70) // covers the next two monthly dues
  return dueDatesFor(fe, today, horizon).find((d) => !handledDueDates.has(d))
}

export function isIncoming(fe: FixedExpense): boolean {
  return fe.direction === 'in'
}

export function isEnded(fe: FixedExpense, today: ISODate): boolean {
  return fe.endDate !== undefined && fe.endDate <= today
}
