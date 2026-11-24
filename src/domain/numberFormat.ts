/**
 * How numbers are written in the UI: "1,5" and "1.850" (es-AR) or "1.5" and "1,850" (en).
 * Domain formatters read this; the UI sets it once at startup from the chosen language.
 * Defaults to Spanish, which is what the domain tests expect.
 */
let locale: 'es-AR' | 'en-US' = 'es-AR'

export function setNumberLocale(lang: 'es' | 'en') {
  locale = lang === 'en' ? 'en-US' : 'es-AR'
}

/** Decimal number as typed in the UI: up to 2 decimals, no thousands separator ("1,5" / "1.5"). */
export function fmtDecimal(n: number): string {
  const s = String(Math.round(n * 100) / 100)
  return locale === 'es-AR' ? s.replace('.', ',') : s
}

/** Number with thousands separators ("1.850" / "1,850"). */
export function fmtThousands(n: number, maxDecimals = 0): string {
  return n.toLocaleString(locale, { maximumFractionDigits: maxDecimals })
}

/** Fixed decimals ("72,0" / "72.0"). */
export function fmtFixed(n: number, digits: number): string {
  const s = n.toFixed(digits)
  return locale === 'es-AR' ? s.replace('.', ',') : s
}
