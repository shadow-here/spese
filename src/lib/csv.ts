/** RFC 4180 CSV: quote fields that contain a comma, quote or line break; double inner quotes. */
export function toCsv(rows: (string | number | undefined)[][]): string {
  const cell = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v)
    // Excel runs cells starting with = + - @ as formulas; prefix them so a note can't become one.
    // Plain numbers like "-1800.50" are left alone so amounts stay numeric.
    const isNumber = /^-?\d+(\.\d+)?$/.test(s)
    const safe = /^[=+\-@]/.test(s) && typeof v === 'string' && !isNumber ? `'${s}` : s
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  // CRLF line ends and a BOM so Excel opens it as UTF-8 (₹ and non-English notes display correctly).
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
