import { formatPaise, formatPaiseCompact, paiseToInput, parseRupees } from './money'

describe('parseRupees', () => {
  it.each([
    ['240', 24000],
    ['240.5', 24050],
    ['240.05', 24005],
    ['0.1', 10],
    ['1,234.56', 123456],
    ['₹ 1,23,456.78', 12345678],
    ['Rs. 99', 9900],
    ['  12  ', 1200],
    ['12.', 1200],
  ])('%s → %i paise', (input, expected) => {
    expect(parseRupees(input)).toBe(expected)
  })

  it.each(['', 'abc', '-5', '1.234', '1.2.3', '.', '1e5'])('rejects %j', (input) => {
    expect(parseRupees(input)).toBeNull()
  })

  it('has no float error (0.1 + 0.2 style)', () => {
    expect(parseRupees('0.29')).toBe(29)
    expect(parseRupees('1.15')).toBe(115)
  })
})

describe('formatPaise', () => {
  it('uses Indian grouping', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78')
    expect(formatPaise(10000000000)).toBe('₹10,00,00,000.00')
  })
  it('formats zero and small values', () => {
    expect(formatPaise(0)).toBe('₹0.00')
    expect(formatPaise(5)).toBe('₹0.05')
  })
  it('uses a true minus for negatives', () => {
    expect(formatPaise(-24000)).toBe('−₹240.00')
  })
  it('supports signed, auto, never and bare', () => {
    expect(formatPaise(24000, { signed: true })).toBe('+₹240.00')
    expect(formatPaise(24000, { decimals: 'auto' })).toBe('₹240')
    expect(formatPaise(24050, { decimals: 'auto' })).toBe('₹240.50')
    expect(formatPaise(24050, { decimals: 'never' })).toBe('₹241')
    expect(formatPaise(24049, { decimals: 'never', bare: true })).toBe('240')
  })
})

describe('formatPaiseCompact', () => {
  it.each([
    [95000, '₹950'],
    [120000, '₹1.2k'],
    [4500000, '₹45k'],
    [15000000, '₹1.5L'],
    [230000000, '₹23L'],
    [2300000000, '₹2.3Cr'],
    [-120000, '−₹1.2k'],
  ])('%i → %s', (p, s) => expect(formatPaiseCompact(p)).toBe(s))
})

describe('paiseToInput', () => {
  it('round-trips with parseRupees', () => {
    for (const p of [0, 5, 100, 24050, 12345678]) {
      expect(parseRupees(paiseToInput(p))).toBe(p)
    }
  })
})
