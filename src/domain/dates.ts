/**
 * Date utilities. Every calendar day is a local `YYYY-MM-DD` string (ISODate).
 * Calendar math is done on UTC-based day numbers internally, so no result ever
 * depends on the device time zone or DST transitions.
 */

/** A local calendar day, formatted `YYYY-MM-DD`. */
export type ISODate = string

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

function parts(iso: ISODate): [number, number, number] {
  const m = ISO_RE.exec(iso)
  if (!m) throw new Error(`Invalid ISODate: "${iso}"`)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const check = new Date(Date.UTC(y, mo - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid ISODate: "${iso}"`)
  }
  return [y, mo, d]
}

/** Days since 1970-01-01 for a calendar date (time-zone independent). */
function dayNumber(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * MS_PER_DAY)
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** True if `s` is a real calendar date in `YYYY-MM-DD` format. */
export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string') return false
  try {
    parts(s)
    return true
  } catch {
    return false
  }
}

/** Local calendar day of a JS Date. `toISO(new Date(2026, 10, 16, 23, 59))` → `'2026-11-16'`. */
export function toISO(date: Date): ISODate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight Date for an ISODate. Throws on invalid input. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = parts(iso)
  return new Date(y, m - 1, d)
}

/** Today in the device's local time zone. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now)
}

/** `addDays('2026-12-31', 1)` → `'2027-01-01'`. Negative `n` goes back. */
export function addDays(iso: ISODate, n: number): ISODate {
  if (!Number.isInteger(n)) throw new Error(`addDays expects an integer, got ${n}`)
  return fromDayNumber(dayNumber(iso) + n)
}

/** Day of week: 0 = Sunday … 6 = Saturday. */
export function weekday(iso: ISODate): number {
  // 1970-01-01 was a Thursday (4).
  return (((dayNumber(iso) + 4) % 7) + 7) % 7
}

/** `a − b` in calendar days. `diffDays('2026-12-20', '2026-12-19')` → `1`. */
export function diffDays(a: ISODate, b: ISODate): number {
  return dayNumber(a) - dayNumber(b)
}

/** Comparator: negative if a < b, 0 if equal, positive if a > b. Usable in `sort`. */
export function compareISO(a: ISODate, b: ISODate): number {
  return Math.sign(diffDays(a, b))
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return compareISO(a, b) >= 0 ? a : b
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return compareISO(a, b) <= 0 ? a : b
}

/** First day of the week containing `iso` (Monday or Sunday). */
export function weekStart(iso: ISODate, mondayFirst: boolean): ISODate {
  const offset = (weekday(iso) - (mondayFirst ? 1 : 0) + 7) % 7
  return addDays(iso, -offset)
}

/** Every day from `from` to `to`, both inclusive. Empty if `from > to`. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  const start = dayNumber(from)
  const end = dayNumber(to)
  for (let n = start; n <= end; n++) out.push(fromDayNumber(n))
  return out
}

/** Number of days in a month (`month` is 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** First and last day of a month (`month` is 1–12). */
export function monthRange(year: number, month: number): { from: ISODate; to: ISODate } {
  return {
    from: `${pad(year, 4)}-${pad(month)}-01`,
    to: `${pad(year, 4)}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  }
}

/** `{ year, month }` of an ISODate (`month` is 1–12). */
export function yearMonth(iso: ISODate): { year: number; month: number } {
  const [y, m] = parts(iso)
  return { year: y, month: m }
}

/** `'2026-11-16'` → `'16/11/2026'` (formato argentino). */
export function formatAR(iso: ISODate, withYear = true): string {
  const [y, m, d] = parts(iso)
  return withYear ? `${pad(d)}/${pad(m)}/${y}` : `${pad(d)}/${pad(m)}`
}

/** `'16/11/2026'` o `'16/11'` (año por defecto) → ISODate. Devuelve `null` si no es válida. */
export function parseAR(s: string, defaultYear: number): ISODate | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/.exec(s)
  if (!m) return null
  let y = m[3] ? Number(m[3]) : defaultYear
  if (y < 100) y += 2000
  const iso = `${pad(y, 4)}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  return isISODate(iso) ? iso : null
}
