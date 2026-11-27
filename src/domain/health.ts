/**
 * Optional weight and calorie tracking.
 *
 * - Calories: food entries (kcal) per day against a daily target.
 * - Weight: one weigh-in per day. Daily weight is noisy (water, salt), so decisions use the
 *   TREND: the average of the weigh-ins of the last 7 days. The weekly rate comes from a
 *   least-squares line over the last 28 days, and the goal date extrapolates that rate.
 */
import { addDays, compareISO, diffDays, eachDay, type ISODate } from './dates'
import { fmtFixed, fmtThousands } from './numberFormat'

export interface WeightEntry {
  date: ISODate
  kg: number
  deletedAt?: string
}

export interface FoodEntryLike {
  date: ISODate
  kcal: number
  deletedAt?: string
}

const round1 = (n: number) => Math.round(n * 10) / 10

// ─── Calories ───────────────────────────────────────────────────────────────

export function dayCalories(entries: readonly FoodEntryLike[], date: ISODate): number {
  return entries.reduce((s, e) => (!e.deletedAt && e.date === date ? s + e.kcal : s), 0)
}

export interface CalorieSummary {
  /** One point per day of the range (future days: null). */
  days: { date: ISODate; kcal: number | null }[]
  /** Average over days with something logged (≤ today). `null` if none. */
  average: number | null
  loggedDays: number
  /** Logged days at or under the target. */
  daysOnTarget: number
}

export function calorieSummary(
  entries: readonly FoodEntryLike[],
  from: ISODate,
  to: ISODate,
  target: number | undefined,
  today: ISODate,
): CalorieSummary {
  const byDay = new Map<ISODate, number>()
  for (const e of entries) if (!e.deletedAt) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.kcal)
  const days = eachDay(from, to).map((date) => ({
    date,
    kcal: compareISO(date, today) > 0 ? null : (byDay.get(date) ?? 0),
  }))
  const logged = days.filter((d) => d.kcal !== null && d.kcal > 0) as { date: ISODate; kcal: number }[]
  return {
    days,
    average: logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : null,
    loggedDays: logged.length,
    daysOnTarget: target ? logged.filter((d) => d.kcal <= target).length : 0,
  }
}

// ─── Weight ─────────────────────────────────────────────────────────────────

function alive(entries: readonly WeightEntry[]): WeightEntry[] {
  return entries.filter((e) => !e.deletedAt && e.kg > 0).sort((a, b) => compareISO(a.date, b.date))
}

/** 7-day trend on `date`: average of the weigh-ins in [date − 6, date]. `null` if none. */
export function trendOn(entries: readonly WeightEntry[], date: ISODate): number | null {
  const from = addDays(date, -6)
  const win = alive(entries).filter((e) => e.date >= from && e.date <= date)
  return win.length ? round1(win.reduce((s, e) => s + e.kg, 0) / win.length) : null
}

/** Weigh-ins with their trend, for the chart. */
export function weightSeries(entries: readonly WeightEntry[]): { date: ISODate; kg: number; trend: number }[] {
  const list = alive(entries)
  return list.map((e) => ({ date: e.date, kg: e.kg, trend: trendOn(list, e.date)! }))
}

/** kg per week from a least-squares line over the weigh-ins of the last `days` days. */
export function weeklyRate(entries: readonly WeightEntry[], today: ISODate, days = 28): number | null {
  const from = addDays(today, -(days - 1))
  const pts = alive(entries).filter((e) => e.date >= from && e.date <= today)
  if (pts.length < 3 || diffDays(pts[pts.length - 1].date, pts[0].date) < 7) return null
  const xs = pts.map((p) => diffDays(p.date, pts[0].date))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = pts.reduce((a, p) => a + p.kg, 0) / pts.length
  let num = 0
  let den = 0
  pts.forEach((p, i) => {
    num += (xs[i] - mx) * (p.kg - my)
    den += (xs[i] - mx) ** 2
  })
  return den === 0 ? null : Math.round((num / den) * 7 * 100) / 100
}

export interface WeightSummary {
  latest: WeightEntry | null
  first: WeightEntry | null
  /** 7-day trend today (or on the last weigh-in if there's none this week). */
  trend: number | null
  /** latest − first. */
  totalChange: number | null
  /** kg per week (negative = losing). */
  ratePerWeek: number | null
  goal: number | null
  /** goal − trend (negative = still has to lose). */
  toGoal: number | null
  reached: boolean
  /** Day the goal is reached at the current rate; `null` if not moving towards it. */
  eta: ISODate | null
}

export function weightSummary(entries: readonly WeightEntry[], goal: number | undefined, today: ISODate): WeightSummary {
  const list = alive(entries).filter((e) => e.date <= today)
  const latest = list.at(-1) ?? null
  const first = list[0] ?? null
  const trend = latest ? (trendOn(list, today) ?? trendOn(list, latest.date)) : null
  const ratePerWeek = weeklyRate(list, today)
  const g = goal && goal > 0 ? goal : null
  const toGoal = g !== null && trend !== null ? round1(g - trend) : null
  const reached = toGoal !== null && Math.abs(toGoal) < 0.15
  let eta: ISODate | null = null
  if (!reached && toGoal !== null && ratePerWeek !== null && Math.abs(ratePerWeek) >= 0.05 && Math.sign(toGoal) === Math.sign(ratePerWeek)) {
    eta = addDays(today, Math.ceil((toGoal / ratePerWeek) * 7))
  }
  return {
    latest,
    first,
    trend,
    totalChange: latest && first ? round1(latest.kg - first.kg) : null,
    ratePerWeek,
    goal: g,
    toGoal,
    reached,
    eta,
  }
}

/** "72,4" */
export function formatKg(n: number): string {
  return fmtFixed(round1(n), 1)
}

/** "1.850" */
export function formatKcal(n: number): string {
  return fmtThousands(Math.round(n))
}

/**
 * Meals to repeat with one tap: the ones from the last `days` days, most frequent first (then the
 * most recent). Same text (or same meal + kcal when there's no text) counts as the same meal;
 * the latest copy is returned.
 */
export function frequentMeals<T extends { date: ISODate; kcal: number; label?: string; meal?: string; deletedAt?: string; updatedAt?: string }>(
  entries: readonly T[],
  today: ISODate,
  limit = 6,
  days = 30,
): T[] {
  const since = addDays(today, -(days - 1))
  const groups = new Map<string, { latest: T; count: number }>()
  for (const e of entries) {
    if (e.deletedAt || e.date < since || e.date > today) continue
    const key = e.label?.trim() ? e.label.trim().toLocaleLowerCase('es') : `${e.meal ?? ''}|${e.kcal}`
    const g = groups.get(key)
    const newer = (a: T, b: T) => a.date > b.date || (a.date === b.date && (a.updatedAt ?? '') > (b.updatedAt ?? ''))
    if (!g) groups.set(key, { latest: e, count: 1 })
    else {
      g.count++
      if (newer(e, g.latest)) g.latest = e
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || (a.latest.date < b.latest.date ? 1 : a.latest.date > b.latest.date ? -1 : 0))
    .slice(0, limit)
    .map((g) => g.latest)
}
