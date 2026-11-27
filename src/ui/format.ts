import { format } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { diffDays, formatAR, parseISO, weekday, type ISODate } from '../domain/dates'
import { LANG, t, tn } from './i18n'

const locale = LANG === 'en' ? enUS : es

/** "lunes 16 de noviembre" / "Monday, November 16" */
export function longDay(iso: ISODate): string {
  return format(parseISO(iso), LANG === 'en' ? 'EEEE, MMMM d' : "EEEE d 'de' MMMM", { locale })
}

/** "noviembre 2026" / "November 2026" */
export function monthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale })
}

/** "16/11/2026" · "16/11" (es) / "Nov 16, 2026" · "Nov 16" (en). */
export function fmtDate(iso: ISODate, withYear = true): string {
  if (LANG === 'es') return formatAR(iso, withYear)
  return format(parseISO(iso), withYear ? 'MMM d, yyyy' : 'MMM d', { locale })
}

export const WEEKDAY_SHORT = LANG === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const WEEKDAY_NAMES =
  LANG === 'en'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** "✅ Al día (+2)" / "⚠️ Atrasado 3". */
export function situationText(diff: number): string {
  if (diff > 0) return t('✅ Al día (+{n})', { n: diff })
  if (diff === 0) return t('✅ Al día')
  return t('⚠️ Atrasado {n}', { n: -diff })
}

/** "✅ Te sobran 4 días" / "✅ Justo a tiempo" / "⚠️ Te pasás 2 días". */
export function marginText(days: number): string {
  if (days === 0) return t('✅ Justo a tiempo')
  const n = Math.abs(days)
  return days > 0 ? tn(n, '✅ Te sobra 1 día', '✅ Te sobran {n} días') : tn(n, '⚠️ Te pasás 1 día', '⚠️ Te pasás {n} días')
}

/** "hoy" / "mañana" / "ayer" / "lunes 30/11" (es) · "tomorrow" / "Monday, Nov 30" (en). */
export function relativeDay(iso: ISODate, today: ISODate): string {
  const d = diffDays(iso, today)
  if (d === 0) return t('hoy')
  if (d === 1) return t('mañana')
  if (d === -1) return t('ayer')
  const name = WEEKDAY_NAMES[weekday(iso)]
  return LANG === 'en' ? `${name}, ${fmtDate(iso, false)}` : `${name.toLowerCase()} ${fmtDate(iso, false)}`
}
