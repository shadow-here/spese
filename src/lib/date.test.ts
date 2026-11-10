import { addDays, addMonths, clampedDate, daysBetween, daysInMonth, eachDay, isISODate, todayISO } from './date'

describe('date helpers', () => {
  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2100, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('clamps a day to the month end', () => {
    expect(clampedDate(2026, 2, 31)).toBe('2026-02-28')
    expect(clampedDate(2028, 2, 30)).toBe('2028-02-29')
    expect(clampedDate(2026, 4, 31)).toBe('2026-04-30')
    expect(clampedDate(2026, 5, 31)).toBe('2026-05-31')
  })

  it('adds months across year boundaries', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths(2026, 3, 14)).toEqual({ year: 2027, month: 5 })
  })

  it('adds days and counts between dates', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-11-25', '2026-12-24')).toBe(29)
    // DST-safe: computed in UTC
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })

  it('lists each day inclusively', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('validates ISO dates', () => {
    expect(isISODate('2026-02-28')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('26-1-1')).toBe(false)
  })

  it('uses local time for today', () => {
    expect(todayISO(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09')
  })
})
