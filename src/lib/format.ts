import { parseISO, type ISODate } from './date'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "25 Oct", or "25 Oct 2026" with year. Built by hand so it never shifts by timezone. */
export function formatDate(date: ISODate, withYear = false): string {
  const { year, month, day } = parseISO(date)
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`
}

/** "25 Oct – 24 Nov"; adds years only when the range spans two years. */
export function formatRange(start: ISODate, end: ISODate): string {
  const crossYear = start.slice(0, 4) !== end.slice(0, 4)
  return `${formatDate(start, crossYear)} – ${formatDate(end, crossYear)}`
}

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
