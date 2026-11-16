import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseISO, type ISODate } from '../domain/dates'

/** "lunes 16 de noviembre" */
export function longDay(iso: ISODate): string {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es })
}

/** "nov 2026" */
export function monthLabel(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: es })
}

export const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
