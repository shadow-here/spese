import {
  cycleContaining,
  cycleLength,
  cycleStartingOn,
  daysElapsed,
  daysLeft,
  monthlyDueDates,
  nextCycle,
  nextPayDateAfter,
  shiftedCycle,
} from './cycle'

describe('cycleContaining', () => {
  it('pay day 1 → calendar month', () => {
    expect(cycleContaining('2026-11-09', 1)).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(cycleContaining('2026-11-01', 1)).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(cycleContaining('2026-02-28', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('pay day 25 → 25th to 24th', () => {
    expect(cycleContaining('2026-11-09', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24' })
    expect(cycleContaining('2026-11-24', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24' })
    expect(cycleContaining('2026-11-25', 25)).toEqual({ start: '2026-11-25', end: '2026-12-24' })
  })

  it('crosses the year boundary', () => {
    expect(cycleContaining('2027-01-05', 25)).toEqual({ start: '2026-12-25', end: '2027-01-24' })
    expect(cycleContaining('2026-12-31', 1)).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('pay day 31 uses the last day of short months (FR-1.4)', () => {
    expect(cycleContaining('2026-03-15', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30' })
    expect(cycleContaining('2026-03-31', 31)).toEqual({ start: '2026-03-31', end: '2026-04-29' })
    expect(cycleContaining('2026-05-01', 31)).toEqual({ start: '2026-04-30', end: '2026-05-30' })
    expect(cycleContaining('2026-02-27', 31)).toEqual({ start: '2026-01-31', end: '2026-02-27' })
  })

  it('pay day 29/30 in February, leap and non-leap', () => {
    expect(cycleContaining('2026-03-10', 30)).toEqual({ start: '2026-02-28', end: '2026-03-29' })
    expect(cycleContaining('2028-03-10', 30)).toEqual({ start: '2028-02-29', end: '2028-03-29' })
    expect(cycleContaining('2028-02-29', 29)).toEqual({ start: '2028-02-29', end: '2028-03-28' })
    expect(cycleContaining('2027-02-28', 29)).toEqual({ start: '2027-02-28', end: '2027-03-28' })
  })

  it('consecutive cycles tile the calendar with no gaps or overlaps', () => {
    for (const payDay of [1, 15, 25, 28, 29, 30, 31]) {
      let range = cycleContaining('2026-01-10', payDay)
      for (let i = 0; i < 30; i++) {
        const next = nextCycle(range.end, payDay)
        expect(next).toEqual(cycleContaining(next.start, payDay))
        expect(cycleLength(next)).toBeGreaterThanOrEqual(28)
        expect(cycleLength(next)).toBeLessThanOrEqual(31)
        range = next
      }
    }
  })
})

describe('shifted cycles', () => {
  it('salary arrives early: cycle starts that day and ends with its regular cycle', () => {
    expect(shiftedCycle('2026-11-22', 25)).toEqual({ start: '2026-11-22', end: '2026-12-24' })
    expect(shiftedCycle('2026-11-29', 1)).toEqual({ start: '2026-11-29', end: '2026-12-31' })
  })
  it('salary arrives late', () => {
    expect(shiftedCycle('2026-11-27', 25)).toEqual({ start: '2026-11-27', end: '2026-12-24' })
    expect(shiftedCycle('2026-12-03', 1)).toEqual({ start: '2026-12-03', end: '2026-12-31' })
  })
  it('pay day changed: new cycle runs to the day before the next new pay date', () => {
    expect(cycleStartingOn('2026-11-09', 1)).toEqual({ start: '2026-11-09', end: '2026-11-30' })
    expect(cycleStartingOn('2026-11-09', 25)).toEqual({ start: '2026-11-09', end: '2026-11-24' })
  })
  it('next pay date after a date', () => {
    expect(nextPayDateAfter('2026-11-25', 25)).toBe('2026-12-25')
    expect(nextPayDateAfter('2026-11-24', 25)).toBe('2026-11-25')
    expect(nextPayDateAfter('2026-01-31', 31)).toBe('2026-02-28')
  })
})

describe('days left / elapsed', () => {
  const range = { start: '2026-10-25', end: '2026-11-24' }
  it('counts today as a day left', () => {
    expect(daysLeft(range, '2026-11-24')).toBe(1)
    expect(daysLeft(range, '2026-11-09')).toBe(16)
    expect(daysElapsed(range, '2026-11-09')).toBe(15)
  })
  it('clamps outside the cycle', () => {
    expect(daysLeft(range, '2026-11-25')).toBe(0)
    expect(daysLeft(range, '2026-10-01')).toBe(31)
    expect(daysElapsed(range, '2026-10-01')).toBe(0)
  })
})

describe('monthlyDueDates', () => {
  it('finds the one due date inside a 25th–24th cycle', () => {
    expect(monthlyDueDates(5, '2026-10-25', '2026-11-24')).toEqual(['2026-11-05'])
    expect(monthlyDueDates(28, '2026-10-25', '2026-11-24')).toEqual(['2026-10-28'])
  })
  it('clamps day 31 in short months', () => {
    expect(monthlyDueDates(31, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('returns none for an empty or short window', () => {
    expect(monthlyDueDates(10, '2026-11-12', '2026-11-20')).toEqual([])
    expect(monthlyDueDates(10, '2026-11-20', '2026-11-12')).toEqual([])
  })
})
