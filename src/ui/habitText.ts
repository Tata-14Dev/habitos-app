/** Spanish labels for habit types (UI only). */
import { formatAR } from '../domain/dates'
import type { HabitLike, TimeOfDay } from '../domain/habits'
import { formatAmount } from '../domain/progress'

export const TIME_OF_DAY: { key: TimeOfDay | undefined; label: string; icon: string }[] = [
  { key: 'morning', label: 'Mañana', icon: '🌅' },
  { key: 'afternoon', label: 'Tarde', icon: '☀️' },
  { key: 'night', label: 'Noche', icon: '🌙' },
  { key: undefined, label: 'Cualquier momento', icon: '🕐' },
]

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** "Lun, mié y vie" (Monday first). */
export function weekdaysLabel(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d, i) => (i === 0 ? DAY_ABBR[d] : DAY_ABBR[d].toLowerCase()))
  if (sorted.length <= 1) return sorted.join('')
  return `${sorted.slice(0, -1).join(', ')} y ${sorted.at(-1)}`
}

/** "Todos los días · mañana", "Lun y mié", "25/11", "5 h por semana", "3 veces por semana". */
export function habitSummary(h: HabitLike & { timeOfDay?: TimeOfDay }): string {
  const moment = h.timeOfDay ? TIME_OF_DAY.find((t) => t.key === h.timeOfDay)!.label.toLowerCase() : null
  const withMoment = (s: string) => (moment ? `${s} · ${moment}` : s)
  if (h.kind === 'scheduled') {
    if (h.onDate) return withMoment(`Solo el ${formatAR(h.onDate)}`)
    return withMoment(weekdaysLabel(h.weekdays ?? []))
  }
  if (h.kind === 'progress' && h.goal) {
    if (h.goal.type === 'times') return `${h.goal.target} ${h.goal.target === 1 ? 'vez' : 'veces'} por semana`
    return `${formatAmount(h.goal.target, h.goal.unit)} por ${h.goal.period === 'day' ? 'día' : 'semana'}`
  }
  return withMoment('Todos los días')
}
