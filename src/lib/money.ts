/**
 * Money is always an integer number of paise (₹1 = 100 paise). Never store or add
 * rupee floats; convert only at the edges (user input and display).
 */
export type Paise = number

const MAX_PAISE = Number.MAX_SAFE_INTEGER

export function isPaise(value: unknown): value is Paise {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/**
 * Parse what a user typed as rupees into paise. Accepts "1234", "1,234.5", "₹ 1,23,456.78".
 * Returns null for empty, negative, non-numeric or more-than-2-decimal input.
 * Done on the string, so there is no float rounding.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '')
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned)
  if (!match) return null
  const rupees = match[1]!
  const fraction = (match[2] ?? '').padEnd(2, '0')
  const paise = Number(rupees) * 100 + Number(fraction)
  return Number.isSafeInteger(paise) && paise <= MAX_PAISE ? paise : null
}

const groupFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export interface FormatOptions {
  /** 'auto' drops ".00" on whole rupees. Default 'always'. */
  decimals?: 'always' | 'auto' | 'never'
  /** Show "+" for positive values (income). Negative always gets "−". */
  signed?: boolean
  /** Omit the ₹ symbol. */
  bare?: boolean
}

/** Format paise in Indian grouping: 12345678 → "₹1,23,456.78". Uses a true minus (−). */
export function formatPaise(paise: Paise, options: FormatOptions = {}): string {
  const { decimals = 'always', signed = false, bare = false } = options
  const negative = paise < 0
  const abs = Math.abs(paise)
  const whole = Math.floor(abs / 100)
  const fraction = abs % 100

  let text = groupFormatter.format(whole)
  if (decimals === 'always' || (decimals === 'auto' && fraction !== 0)) {
    text += '.' + String(fraction).padStart(2, '0')
  } else if (decimals === 'never' && fraction >= 50) {
    text = groupFormatter.format(whole + 1)
  }

  const sign = negative ? '−' : signed && paise > 0 ? '+' : ''
  return `${sign}${bare ? '' : '₹'}${text}`
}

/** Short axis label in Indian units: ₹950, ₹1.2k, ₹45k, ₹1.5L, ₹2.3Cr. */
export function formatPaiseCompact(paise: Paise): string {
  const rupees = Math.abs(paise) / 100
  const sign = paise < 0 ? '−' : ''
  const fmt = (n: number, unit: string) => `${sign}₹${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}${unit}`
  if (rupees >= 1e7) return fmt(rupees / 1e7, 'Cr')
  if (rupees >= 1e5) return fmt(rupees / 1e5, 'L')
  if (rupees >= 1e3) return fmt(rupees / 1e3, 'k')
  return `${sign}₹${Math.round(rupees)}`
}

/** Paise → editable rupee string for a form field ("1234.5" style, no grouping). */
export function paiseToInput(paise: Paise): string {
  const whole = Math.floor(Math.abs(paise) / 100)
  const fraction = Math.abs(paise) % 100
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`
}

export function sumPaise(values: Iterable<Paise>): Paise {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Share of a total as a 0–100 percentage (0 when total is 0). */
export function percentOf(part: Paise, total: Paise): number {
  return total === 0 ? 0 : (part / total) * 100
}
