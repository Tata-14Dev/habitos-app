/**
 * Statistics for the "Estadísticas" view and the per-habit detail. Pure functions over the same
 * rules as habits.ts: a habit only counts on days it's due, weekly goals are measured per week,
 * and days after today never count.
 */
import { addDays, compareISO, eachDay, maxISO, weekday, weekStart, type ISODate } from './dates'
import {
  habitRangeRatio,
  isHabitActive,
  isHabitScheduled,
  isPausedBetween,
  isWeeklyGoal,
  mentalState,
  scheduledHabits,
  weekProgress,
  type DoneLookup,
  type HabitLike,
  type HabitLogLike,
  type Ratio,
} from './habits'

const ratio = (done: number, total: number): Ratio => ({ done, total, pct: total === 0 ? null : done / total })

// ─── Consistency ────────────────────────────────────────────────────────────

export interface Consistency {
  /** Last `days` days (daily habits) or last `days / 7` weeks (weekly goals). */
  current: Ratio
  /** The same span right before it. */
  previous: Ratio
  /** current − previous in percentage points, `null` if either has no data. */
  delta: number | null
  unit: 'days' | 'weeks'
}

/** Weeks met / weeks in a range, for weekly goals (the current week counts only if already met). */
function weeksRatio(habit: HabitLike, logs: readonly HabitLogLike[], from: ISODate, to: ISODate, today: ISODate, mondayFirst: boolean): Ratio {
  const thisWeek = weekStart(today, mondayFirst)
  let done = 0
  let total = 0
  for (let w = weekStart(from, mondayFirst); w <= to; w = addDays(w, 7)) {
    const end = addDays(w, 6)
    if (!isHabitActive(habit, maxISO(w, habit.startDate)) || (habit.endDate && w > habit.endDate) || end < habit.startDate) continue
    const met = weekProgress(habit, logs, w, mondayFirst).met
    if (w === thisWeek && !met) continue // still in progress: not a miss yet
    if (w > thisWeek) continue
    if (!met && isPausedBetween(habit, w, end)) continue // paused that week: not a miss either
    total++
    if (met) done++
  }
  return ratio(done, total)
}

export function consistency(
  habit: HabitLike,
  isDone: DoneLookup,
  logs: readonly HabitLogLike[],
  today: ISODate,
  mondayFirst: boolean,
  days = 30,
): Consistency {
  const from = addDays(today, -(days - 1))
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(days - 1))
  const weekly = isWeeklyGoal(habit)
  const current = weekly ? weeksRatio(habit, logs, from, today, today, mondayFirst) : habitRangeRatio(habit, from, today, isDone, today)
  const previous = weekly ? weeksRatio(habit, logs, prevFrom, prevTo, today, mondayFirst) : habitRangeRatio(habit, prevFrom, prevTo, isDone, today)
  const delta = current.pct === null || previous.pct === null ? null : Math.round((current.pct - previous.pct) * 100)
  return { current, previous, delta, unit: weekly ? 'weeks' : 'days' }
}

// ─── Weekday pattern ────────────────────────────────────────────────────────

/** Completion per weekday (index 0 = Sunday … 6 = Saturday) over [from, to], due habits only. */
export function weekdayRatios(habits: readonly HabitLike[], isDone: DoneLookup, from: ISODate, to: ISODate, today: ISODate): Ratio[] {
  const done = Array(7).fill(0)
  const total = Array(7).fill(0)
  const end = compareISO(to, today) > 0 ? today : to
  for (const d of eachDay(from, end)) {
    const w = weekday(d)
    for (const h of scheduledHabits(habits, d)) {
      total[w]++
      if (isDone(h.id, d)) done[w]++
    }
  }
  return done.map((n, i) => ratio(n, total[i]))
}

// ─── Mood vs habits ─────────────────────────────────────────────────────────

export interface MoodSplit {
  /** Average mental state (0–10) on days at or above the threshold. */
  high: number | null
  low: number | null
  highDays: number
  lowDays: number
}

/**
 * Average mood + motivation on "good days" (≥ threshold of due habits done) vs the rest.
 * Only days with both a mood entry and at least one due habit count.
 */
export function moodByCompletion(
  habits: readonly HabitLike[],
  isDone: DoneLookup,
  moods: readonly { date: ISODate; mood?: number; motivation?: number; deletedAt?: string }[],
  from: ISODate,
  to: ISODate,
  threshold = 0.8,
): MoodSplit {
  const hi: number[] = []
  const lo: number[] = []
  for (const m of moods) {
    if (m.deletedAt || m.date < from || m.date > to) continue
    const state = mentalState(m)
    const due = scheduledHabits(habits, m.date)
    if (state === null || due.length === 0) continue
    const pct = due.filter((h) => isDone(h.id, m.date)).length / due.length
    ;(pct >= threshold ? hi : lo).push(state)
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  return { high: avg(hi), low: avg(lo), highDays: hi.length, lowDays: lo.length }
}

// ─── Streak history ─────────────────────────────────────────────────────────

export interface StreakRun {
  from: ISODate
  to: ISODate
  /** Scheduled days done in a row. */
  length: number
}

/** Every streak of a daily-type habit (unscheduled days are skipped), longest first. */
export function streakRuns(habit: HabitLike, isDone: DoneLookup, today: ISODate): StreakRun[] {
  if (isWeeklyGoal(habit) || compareISO(habit.startDate, today) > 0) return []
  const end = habit.endDate && compareISO(habit.endDate, today) < 0 ? habit.endDate : today
  const runs: StreakRun[] = []
  // The run in progress, as plain values (length 0 = none).
  let from = ''
  let to = ''
  let length = 0
  const close = () => {
    if (length > 0) runs.push({ from, to, length })
    length = 0
  }
  for (const d of eachDay(habit.startDate, end)) {
    if (!isHabitScheduled(habit, d)) continue
    if (isDone(habit.id, d)) {
      if (length === 0) from = d
      to = d
      length++
    } else if (d !== today) {
      close()
    }
  }
  close()
  return runs.sort((a, b) => b.length - a.length || compareISO(b.to, a.to))
}

// ─── Amounts over time ──────────────────────────────────────────────────────

export interface Bucket {
  /** First day of the bucket (the day itself, or the week's first day). */
  date: ISODate
  value: number
}

/** Sum of `amount(date)` per day over the last `days` days (oldest first). */
export function dailySeries(amount: (date: ISODate) => number, today: ISODate, days: number): Bucket[] {
  return eachDay(addDays(today, -(days - 1)), today).map((date) => ({ date, value: amount(date) }))
}

/** Sum of `amount(date)` per week over the last `weeks` weeks, current week included (oldest first). */
export function weeklySeries(amount: (date: ISODate) => number, today: ISODate, weeks: number, mondayFirst: boolean): Bucket[] {
  const last = weekStart(today, mondayFirst)
  return Array.from({ length: weeks }, (_, i) => {
    const w = addDays(last, -7 * (weeks - 1 - i))
    const end = compareISO(addDays(w, 6), today) > 0 ? today : addDays(w, 6)
    const value = eachDay(w, end).reduce((s, d) => s + amount(d), 0)
    return { date: w, value: Math.round(value * 100) / 100 }
  })
}

/** Items done per day, from plan items (prior items don't count: they weren't done in the plan). */
export function itemsDoneOn(items: readonly { done: boolean; doneDate?: ISODate; prior?: boolean; deletedAt?: string }[]): (date: ISODate) => number {
  const byDay = new Map<ISODate, number>()
  for (const i of items) if (i.done && i.doneDate && !i.prior && !i.deletedAt) byDay.set(i.doneDate, (byDay.get(i.doneDate) ?? 0) + 1)
  return (d) => byDay.get(d) ?? 0
}

/** Average of the last `n` complete weeks (the current week is excluded: it isn't over). */
export function recentWeeklyAverage(series: readonly Bucket[], n = 4): number | null {
  const complete = series.slice(0, -1).slice(-n)
  if (!complete.length) return null
  return Math.round((complete.reduce((s, b) => s + b.value, 0) / complete.length) * 10) / 10
}
