/** Labels for habit types (UI only). */
import type { HabitLike, TimeOfDay } from '../domain/habits'
import { formatAmount } from '../domain/progress'
import { fmtDate } from './format'
import { LANG, t, tn } from './i18n'

export const TIME_OF_DAY: { key: TimeOfDay | undefined; label: string; icon: string }[] = [
  { key: 'morning', label: t('Mañana'), icon: '🌅' },
  { key: 'afternoon', label: t('Tarde'), icon: '☀️' },
  { key: 'night', label: t('Noche'), icon: '🌙' },
  { key: undefined, label: t('Cualquier momento'), icon: '🕐' },
]

const DAY_ABBR = LANG === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** "Lun, mié y vie" (Monday first). */
export function weekdaysLabel(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d, i) => (i === 0 || LANG === 'en' ? DAY_ABBR[d] : DAY_ABBR[d].toLowerCase()))
  if (sorted.length <= 1) return sorted.join('')
  return t('{list} y {last}', { list: sorted.slice(0, -1).join(', '), last: sorted.at(-1)! })
}

/** "Todos los días · mañana", "Lun y mié", "25/11", "5 h por semana", "3 veces por semana". */
export function habitSummary(h: HabitLike & { timeOfDay?: TimeOfDay }): string {
  const moment = h.timeOfDay ? TIME_OF_DAY.find((x) => x.key === h.timeOfDay)!.label.toLowerCase() : null
  const withMoment = (s: string) => (moment ? `${s} · ${moment}` : s)
  if (h.kind === 'scheduled') {
    if (h.onDate) return withMoment(t('Solo el {date}', { date: fmtDate(h.onDate) }))
    return withMoment(weekdaysLabel(h.weekdays ?? []))
  }
  if (h.kind === 'progress' && h.goal) {
    if (h.goal.type === 'times') return tn(h.goal.target, '1 vez por semana', '{n} veces por semana')
    return h.goal.period === 'day'
      ? t('{amount} por día', { amount: formatAmount(h.goal.target, h.goal.unit) })
      : t('{amount} por semana', { amount: formatAmount(h.goal.target, h.goal.unit) })
  }
  return withMoment(t('Todos los días'))
}
