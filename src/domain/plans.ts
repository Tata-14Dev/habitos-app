/** Plan helpers that are NOT part of the scheduling exercise. */
import type { ISODate } from './dates'
import type { ScheduleConfig, ScheduleItem } from './schedule'

export interface ParsedItem {
  title: string
  section?: string
}

/**
 * One item per line; optionally "Módulo: ítem". Empty lines and list bullets/numbers are ignored.
 * @example parseItemList('Intro: Room 1\n2. Room 2') → [{ section: 'Intro', title: 'Room 1' }, { title: 'Room 2' }]
 */
export function parseItemList(text: string): ParsedItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(?:[-–•*]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const m = /^([^:]{1,80}):\s+(.+)$/.exec(line)
      return m ? { section: m[1].trim(), title: m[2].trim() } : { title: line }
    })
}

export interface PlanLike {
  startDate: ISODate
  deadline: ISODate
  pace: number
  restWeekdays: number[]
  blockedDates: ISODate[]
}

export function toScheduleConfig(p: PlanLike): ScheduleConfig {
  return {
    startDate: p.startDate,
    deadline: p.deadline,
    pace: p.pace,
    restWeekdays: p.restWeekdays,
    blockedDates: p.blockedDates,
  }
}

/** Items sorted by `order`, reduced to what the algorithm needs. */
export function toScheduleItems(items: readonly { id: string; order: number; done: boolean; doneDate?: ISODate }[]): ScheduleItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((i) => (i.done ? { id: i.id, done: true, doneDate: i.doneDate } : { id: i.id, done: false }))
}

/** "✅ Al día (+2)" / "⚠️ Atrasado 3". */
export function situationLabel(diff: number): string {
  return diff >= 0 ? `✅ Al día${diff > 0 ? ` (+${diff})` : ''}` : `⚠️ Atrasado ${-diff}`
}

/** "✅ Te sobran 4 días" / "✅ Te sobra 1 día" / "✅ Justo a tiempo" / "⚠️ Te pasás 2 días". */
export function marginLabel(days: number): string {
  if (days === 0) return '✅ Justo a tiempo'
  const n = Math.abs(days)
  const d = n === 1 ? 'día' : 'días'
  if (days > 0) return `✅ Te ${n === 1 ? 'sobra' : 'sobran'} ${n} ${d}`
  return `⚠️ Te pasás ${n} ${d}`
}
