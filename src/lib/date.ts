/**
 * Calendar dates as local "YYYY-MM-DD" strings. They sort and compare lexicographically,
 * survive IndexedDB/JSON round-trips, and have no timezone drift.
 */
export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(year: number, month: number, day: number): ISODate {
  // month is 1–12
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseISO(date: ISODate): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { year: y!, month: m!, day: d! }
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { year, month, day } = parseISO(value)
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

/** Today in the device's local timezone. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The given day in that month, clamped to the month's last day (31 → 30 / 28 / 29). FR-1.4 */
export function clampedDate(year: number, month: number, day: number): ISODate {
  return toISO(year, month, Math.min(day, daysInMonth(year, month)))
}

/** Shift a (year, month) pair by n months. */
export function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

function toUTC(date: ISODate): number {
  const { year, month, day } = parseISO(date)
  return Date.UTC(year, month - 1, day)
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms)
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

const DAY_MS = 86_400_000

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS)
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS)
}

/** Every date from start to end, inclusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b)
