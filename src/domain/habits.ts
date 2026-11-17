/**
 * Habit logic: validity ranges ("desde/hasta"), types, completion percentages and streaks.
 *
 * Rule from the spreadsheets: a percentage is ALWAYS done / habits SCHEDULED that day.
 * Habits outside their validity range, days a habit isn't due, and weekly goals never count
 * in a daily percentage (weekly goals are measured per week instead).
 *
 * Types:
 * - `fixed` (default, also every habit created before types existed): every day.
 * - `scheduled`: one specific date (`onDate`) or some weekdays (`weekdays`).
 * - `progress`: an amount per day/week (hours, pages…) or a number of times per week.
 */
import { addDays, compareISO, eachDay, monthRange, weekday, weekStart, type ISODate } from './dates'

export type HabitKind = 'fixed' | 'scheduled' | 'progress'
export type TimeOfDay = 'morning' | 'afternoon' | 'night'
export type HabitGoal =
  | { type: 'amount'; period: 'day' | 'week'; target: number; unit: string }
  | { type: 'times'; target: number }

export interface HabitLike {
  id: string
  startDate: ISODate
  endDate?: ISODate
  deletedAt?: string
  kind?: HabitKind
  onDate?: ISODate
  weekdays?: number[]
  goal?: HabitGoal
}

export interface HabitLogLike {
  habitId: string
  date: ISODate
  done: boolean
  /** Progress habits with an amount goal: how much was done that day. */
  amount?: number
  deletedAt?: string
}

const EPS = 1e-9

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

/** Progress habit measured per week (an amount per week, or N times per week). */
export function isWeeklyGoal(habit: HabitLike): boolean {
  const g = habit.kind === 'progress' ? habit.goal : undefined
  return !!g && (g.type === 'times' || g.period === 'week')
}

/** Progress habit with a daily amount goal ("1 hora por día"). */
export function dailyAmountGoal(habit: HabitLike): number | null {
  const g = habit.kind === 'progress' ? habit.goal : undefined
  return g && g.type === 'amount' && g.period === 'day' ? g.target : null
}

/** One-off habit: due on a single date. */
export function isOneOff(habit: HabitLike): boolean {
  return habit.kind === 'scheduled' && !!habit.onDate
}

/**
 * Is the habit DUE on `date`? Valid that day AND:
 * fixed → every day · scheduled → only `onDate`, or only its weekdays ·
 * progress per day → every day · weekly goals → never (they are measured per week).
 */
export function isHabitScheduled(habit: HabitLike, date: ISODate): boolean {
  if (!isHabitActive(habit, date)) return false
  if (habit.kind === 'scheduled') {
    if (habit.onDate) return habit.onDate === date
    return (habit.weekdays ?? []).includes(weekday(date))
  }
  if (habit.kind === 'progress') return !isWeeklyGoal(habit)
  return true
}

export function scheduledHabits<H extends HabitLike>(habits: readonly H[], date: ISODate): H[] {
  return habits.filter((h) => isHabitScheduled(h, date))
}

/**
 * Builds a lookup from manual logs plus "derived" done days.
 * `derived[habitId]` = days that count as done automatically (e.g. a habit linked to a study
 * plan is done on every day where at least one plan item was marked done).
 * Pass `habits` so habits with a daily amount goal count as done when amount ≥ target.
 */
export function buildDoneLookup(
  logs: readonly HabitLogLike[],
  derived: Record<string, ReadonlySet<ISODate>> = {},
  habits: readonly HabitLike[] = [],
): DoneLookup {
  const dailyTarget = new Map<string, number>()
  for (const h of habits) {
    const t = dailyAmountGoal(h)
    if (t !== null) dailyTarget.set(h.id, t)
  }
  const manual = new Set<string>()
  for (const l of logs) {
    if (l.deletedAt) continue
    const target = dailyTarget.get(l.habitId)
    const done = target !== undefined ? (l.amount ?? 0) >= target - EPS : l.done
    if (done) manual.add(`${l.habitId}|${l.date}`)
  }
  return (habitId, date) => manual.has(`${habitId}|${date}`) || (derived[habitId]?.has(date) ?? false)
}

/** Amount logged for a habit on a day (0 if none). */
export function buildAmountLookup(logs: readonly HabitLogLike[]): (habitId: string, date: ISODate) => number {
  const m = new Map<string, number>()
  for (const l of logs) if (!l.deletedAt && l.amount) m.set(`${l.habitId}|${l.date}`, l.amount)
  return (habitId, date) => m.get(`${habitId}|${date}`) ?? 0
}

export interface WeekProgress {
  from: ISODate
  to: ISODate
  done: number
  target: number
  met: boolean
}

/**
 * Weekly goal progress for the week containing `date`: Σ amount (amount goals) or
 * number of days marked done (times per week).
 */
export function weekProgress(
  habit: HabitLike,
  logs: readonly HabitLogLike[],
  date: ISODate,
  mondayFirst: boolean,
): WeekProgress {
  const from = weekStart(date, mondayFirst)
  const to = addDays(from, 6)
  const target = habit.goal?.target ?? 0
  let done = 0
  for (const l of logs) {
    if (l.deletedAt || l.habitId !== habit.id || l.date < from || l.date > to) continue
    if (habit.goal?.type === 'amount') done += l.amount ?? 0
    else if (l.done) done++
  }
  done = Math.round(done * 100) / 100
  return { from, to, done, target, met: target > 0 && done >= target - EPS }
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

/** Percentage of a single day: habits done / habits scheduled that day. */
export function dayRatio(habits: readonly HabitLike[], date: ISODate, isDone: DoneLookup): Ratio {
  const due = scheduledHabits(habits, date)
  return ratio(due.filter((h) => isDone(h.id, date)).length, due.length)
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

/** One habit over a range: days done / days it was scheduled (≤ today). */
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
    if (!isHabitScheduled(habit, d)) continue
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
 * Streaks count consecutive SCHEDULED days with the habit done (in days).
 * - `current` ends today if today is done; if today isn't done yet it ends yesterday
 *   (the day isn't over, so it doesn't break the streak).
 * - Days the habit isn't due (e.g. Tuesday for a Mon/Wed habit) are skipped: they neither
 *   add to nor break the streak.
 * - Days outside the validity range end a streak. One-off habits and weekly goals have no
 *   daily streak (see `weeklyStreaks`).
 */
export function habitStreaks(habit: HabitLike, isDone: DoneLookup, today: ISODate): Streaks {
  if (compareISO(habit.startDate, today) > 0 || isOneOff(habit) || isWeeklyGoal(habit)) return { current: 0, best: 0 }
  const end = habit.endDate && compareISO(habit.endDate, today) < 0 ? habit.endDate : today
  let best = 0
  let run = 0
  for (const d of eachDay(habit.startDate, end)) {
    if (!isHabitScheduled(habit, d)) continue
    if (isDone(habit.id, d)) {
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

/**
 * Weekly goals: consecutive weeks with the goal met (in weeks). The current week doesn't
 * break the streak while it's in progress. Weeks outside the validity range end it.
 */
export function weeklyStreaks(
  habit: HabitLike,
  logs: readonly HabitLogLike[],
  today: ISODate,
  mondayFirst: boolean,
): Streaks {
  if (!isWeeklyGoal(habit) || compareISO(habit.startDate, today) > 0) return { current: 0, best: 0 }
  const last = habit.endDate && compareISO(habit.endDate, today) < 0 ? habit.endDate : today
  const currentWeek = weekStart(today, mondayFirst)
  let best = 0
  let run = 0
  for (let w = weekStart(habit.startDate, mondayFirst); w <= last; w = addDays(w, 7)) {
    if (weekProgress(habit, logs, w, mondayFirst).met) {
      run++
      if (run > best) best = run
    } else if (w !== currentWeek) {
      run = 0
    }
  }
  return { current: last === today ? run : 0, best }
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
