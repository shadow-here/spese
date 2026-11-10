import { addDays, addMonths, clampedDate, daysBetween, parseISO, type ISODate } from '../lib/date'

/** Pure pay-cycle date maths (FR-1.2, FR-1.4). No storage here. */

export interface CycleRange {
  start: ISODate
  end: ISODate
}

export function isValidPayDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31
}

/** The pay date in the month of `date`, clamped to that month's last day. */
function payDateInMonthOf(date: ISODate, payDay: number): ISODate {
  const { year, month } = parseISO(date)
  return clampedDate(year, month, payDay)
}

function payDateInMonthOffset(date: ISODate, payDay: number, offset: number): ISODate {
  const { year, month } = parseISO(date)
  const m = addMonths(year, month, offset)
  return clampedDate(m.year, m.month, payDay)
}

/** First pay date strictly after `date`. */
export function nextPayDateAfter(date: ISODate, payDay: number): ISODate {
  const thisMonth = payDateInMonthOf(date, payDay)
  return thisMonth > date ? thisMonth : payDateInMonthOffset(date, payDay, 1)
}

/** Latest pay date on or before `date`. */
export function payDateOnOrBefore(date: ISODate, payDay: number): ISODate {
  const thisMonth = payDateInMonthOf(date, payDay)
  return thisMonth <= date ? thisMonth : payDateInMonthOffset(date, payDay, -1)
}

/**
 * The regular pay cycle containing `date`: from the latest pay date on or before it
 * to the day before the next pay date.
 * e.g. payDay 25 → 25 Oct–24 Nov; payDay 1 → 1st–last day; payDay 31 → 28 Feb–30 Mar.
 */
export function cycleContaining(date: ISODate, payDay: number): CycleRange {
  const start = payDateOnOrBefore(date, payDay)
  return { start, end: addDays(nextPayDateAfter(start, payDay), -1) }
}

/**
 * A cycle that starts on an arbitrary date and runs until the day before the next
 * regular pay date. Used when the pay day itself changes (the new cycle starts now).
 */
export function cycleStartingOn(start: ISODate, payDay: number): CycleRange {
  return { start, end: addDays(nextPayDateAfter(start, payDay), -1) }
}

/**
 * Salary credited early or late on `creditedOn`: the cycle starts that day and ends
 * where the regular cycle it belongs to ends. The regular pay date it belongs to is the
 * nearest one (ties go to the earlier date, i.e. treated as late).
 * payDay 25: credited 22 Nov → 22 Nov–24 Dec; credited 27 Nov → 27 Nov–24 Dec.
 */
export function shiftedCycle(creditedOn: ISODate, payDay: number): CycleRange {
  const before = payDateOnOrBefore(creditedOn, payDay)
  const after = nextPayDateAfter(creditedOn, payDay)
  const nominal = daysBetween(before, creditedOn) <= daysBetween(creditedOn, after) ? before : after
  return { start: creditedOn, end: addDays(nextPayDateAfter(nominal, payDay), -1) }
}

/** Cycle following one that ends on `prevEnd`. */
export function nextCycle(prevEnd: ISODate, payDay: number): CycleRange {
  return cycleStartingOn(addDays(prevEnd, 1), payDay)
}

/** Length of a cycle in days (inclusive). */
export function cycleLength(range: CycleRange): number {
  return daysBetween(range.start, range.end) + 1
}

/** Days left including today; 0 if the cycle is over, full length if it hasn't started. */
export function daysLeft(range: CycleRange, today: ISODate): number {
  if (today > range.end) return 0
  if (today < range.start) return cycleLength(range)
  return daysBetween(today, range.end) + 1
}

/** Days elapsed including today, clamped to the cycle. */
export function daysElapsed(range: CycleRange, today: ISODate): number {
  return cycleLength(range) - daysLeft(range, today)
}

export function inRange(date: ISODate, range: CycleRange): boolean {
  return date >= range.start && date <= range.end
}

/**
 * Monthly due dates for a deduction day that fall inside [from, to], each clamped to
 * its month's last day. Usually one per cycle; can be 0 or 2 for shortened/stretched cycles.
 */
export function monthlyDueDates(deductionDay: number, from: ISODate, to: ISODate): ISODate[] {
  if (from > to) return []
  const out: ISODate[] = []
  const { year, month } = parseISO(from)
  for (let i = 0; ; i++) {
    const m = addMonths(year, month, i)
    const due = clampedDate(m.year, m.month, deductionDay)
    if (due > to) break
    if (due >= from) out.push(due)
  }
  return out
}
