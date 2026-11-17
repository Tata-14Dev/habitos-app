/**
 * Habit logic: validity ranges ("desde/hasta"), completion percentages and streaks.
 *
 * Rule from the spreadsheets: a percentage is ALWAYS done / habits active that day.
 * Habits outside their validity range — or days with no active habits — never count.
 */
import { compareISO, eachDay, monthRange, type ISODate } from './dates'

export interface HabitLike {
  id: string
  startDate: ISODate
  endDate?: ISODate
  deletedAt?: string
}

export interface HabitLogLike {
  habitId: string
  date: ISODate
  done: boolean
  deletedAt?: string
}

/** Answers "was habit X done on day D?". Build one with `buildDoneLookup`. */
export type DoneLookup = (habitId: string, date: ISODate) => boolean

/** A habit counts on `date` if `startDate ≤ date ≤ endDate` (endDate optional) and it isn't deleted. */
export function isHabitActive(habit: HabitLike, date: ISODate): boolean {
  if (habit.deletedAt) return false
  if (compareISO(date, habit.startDate) < 0) return false
  if (habit.endDate && compareISO(date, habit.endDate) > 0) return false
  return true
}

export function activeHabits<H extends HabitLike>(habits: readonly H[], date: ISODate): H[] {
  return habits.filter((h) => isHabitActive(h, date))
}

/**
 * Builds a lookup from manual logs plus "derived" done days.
 * `derived[habitId]` = days that count as done automatically (e.g. a habit linked to a study
 * plan is done on every day where at least one plan item was marked done).
 */
export function buildDoneLookup(
  logs: readonly HabitLogLike[],
  derived: Record<string, ReadonlySet<ISODate>> = {},
): DoneLookup {
  const manual = new Set<string>()
  for (const l of logs) if (l.done && !l.deletedAt) manual.add(`${l.habitId}|${l.date}`)
  return (habitId, date) => manual.has(`${habitId}|${date}`) || (derived[habitId]?.has(date) ?? false)
}

export interface Ratio {
  done: number
  total: number
  /** done / total in [0, 1], or `null` when total is 0 (nothing to measure — show "—", never 0%). */
  pct: number | null
}

function ratio(done: number, total: number): Ratio {
  return { done, total, pct: total === 0 ? null : done / total }
}

/** Percentage of a single day: habits done / habits active that day. */
export function dayRatio(habits: readonly HabitLike[], date: ISODate, isDone: DoneLookup): Ratio {
  const active = activeHabits(habits, date)
  return ratio(active.filter((h) => isDone(h.id, date)).length, active.length)
}

/** Days of the range that have already started (≤ today). Future days never count. */
function countedDays(from: ISODate, to: ISODate, today: ISODate): ISODate[] {
  return eachDay(from, compareISO(to, today) > 0 ? today : to)
}

/** Aggregate over a range: Σ done / Σ active, only days ≤ today. */
export function rangeRatio(
  habits: readonly HabitLike[],
  from: ISODate,
  to: ISODate,
  isDone: DoneLookup,
  today: ISODate,
): Ratio {
  let done = 0
  let total = 0
  for (const d of countedDays(from, to, today)) {
    const r = dayRatio(habits, d, isDone)
    done += r.done
    total += r.total
  }
  return ratio(done, total)
}

/** One habit over a range: days done / days it was active (≤ today). */
export function habitRangeRatio(
  habit: HabitLike,
  from: ISODate,
  to: ISODate,
  isDone: DoneLookup,
  today: ISODate,
): Ratio {
  let done = 0
  let total = 0
  for (const d of countedDays(from, to, today)) {
    if (!isHabitActive(habit, d)) continue
    total++
    if (isDone(habit.id, d)) done++
  }
  return ratio(done, total)
}

export interface MonthStats {
  year: number
  month: number
  days: { date: ISODate; ratio: Ratio; future: boolean }[]
  total: Ratio
  perHabit: Record<string, Ratio>
}

/** Everything the month grid needs. `month` is 1–12. */
export function monthStats(
  habits: readonly HabitLike[],
  year: number,
  month: number,
  isDone: DoneLookup,
  today: ISODate,
): MonthStats {
  const { from, to } = monthRange(year, month)
  const days = eachDay(from, to).map((date) => ({
    date,
    ratio: dayRatio(habits, date, isDone),
    future: compareISO(date, today) > 0,
  }))
  const perHabit: Record<string, Ratio> = {}
  for (const h of habits) perHabit[h.id] = habitRangeRatio(h, from, to, isDone, today)
  return { year, month, days, total: rangeRatio(habits, from, to, isDone, today), perHabit }
}

/** Percentage of each month of a year (index 0 = January). */
export function yearStats(
  habits: readonly HabitLike[],
  year: number,
  isDone: DoneLookup,
  today: ISODate,
): Ratio[] {
  return Array.from({ length: 12 }, (_, i) => {
    const { from, to } = monthRange(year, i + 1)
    return rangeRatio(habits, from, to, isDone, today)
  })
}

export interface Streaks {
  current: number
  best: number
}

/**
 * Streaks count consecutive ACTIVE days with the habit done.
 * - `current` ends today if today is done; if today isn't done yet it ends yesterday
 *   (the day isn't over, so it doesn't break the streak).
 * - Days outside the validity range end a streak.
 */
export function habitStreaks(habit: HabitLike, isDone: DoneLookup, today: ISODate): Streaks {
  if (compareISO(habit.startDate, today) > 0) return { current: 0, best: 0 }
  const end = habit.endDate && compareISO(habit.endDate, today) < 0 ? habit.endDate : today
  let best = 0
  let run = 0
  for (const d of eachDay(habit.startDate, end)) {
    if (isHabitActive(habit, d) && isDone(habit.id, d)) {
      run++
      if (run > best) best = run
    } else if (d !== today) {
      run = 0
    }
  }
  // `run` is the streak ending at `end` (a pending today keeps yesterday's run).
  // A habit that already ended has no current streak.
  return { current: end === today ? run : 0, best }
}

/** "Estado mental": average of mood and motivation (0–10). Uses whichever exists; `null` if none. */
export function mentalState(day: { mood?: number; motivation?: number } | undefined): number | null {
  if (!day) return null
  const vals = [day.mood, day.motivation].filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Days on which at least one plan item was done → derived done-days for its linked habit. */
export function linkedHabitDays(
  items: readonly { done: boolean; doneDate?: ISODate; deletedAt?: string }[],
): Set<ISODate> {
  const s = new Set<ISODate>()
  for (const it of items) if (it.done && it.doneDate && !it.deletedAt) s.add(it.doneDate)
  return s
}

/** Amount plans: days with some progress logged → derived done-days for its linked habit. */
export function linkedHabitLogDays(logs: readonly { date: ISODate; amount: number; deletedAt?: string }[]): Set<ISODate> {
  const s = new Set<ISODate>()
  for (const l of logs) if (l.amount > 0 && !l.deletedAt) s.add(l.date)
  return s
}

/** Formats a ratio as "73%" or "—". */
export function formatPct(r: Ratio | number | null): string {
  const v = typeof r === 'number' || r === null ? r : r.pct
  return v === null ? '—' : `${Math.round(v * 100)}%`
}
