/**
 * Amount plans: a total quantity (hours, pages, exercises…) logged per day, instead of a list
 * of items. Same rules as `schedule.ts`, which it reuses for available-day arithmetic:
 *
 * - The plan expects `pace` units on every available day from `startDate`.
 * - Today's quota is `pace − doneToday` (never negative), so doing more today pulls the
 *   estimated end closer but never pushes the next study day further away.
 */
import { diffDays, maxISO, minISO, type ISODate } from './dates'
import { countAvailableDays, isAvailableDay, nextAvailableDay, nthAvailableDay, type ScheduleConfig } from './schedule'
import { fmtDecimal } from './numberFormat'

export interface AmountLog {
  date: ISODate
  amount: number
}

export interface AmountPlanMetrics {
  target: number
  /** Total logged. */
  done: number
  /** max(0, target − done). */
  pending: number
  doneToday: number
  /** What the original pace says you should have by the end of today (capped at target). */
  shouldHaveDone: number
  /** done − shouldHaveDone. Positive = ahead. */
  diff: number
  /** Left of today's quota: 0 if today isn't a study day, the plan hasn't started, or the quota is met. */
  todayRemaining: number
  /** Day the target is reached at the current pace; if already reached, the last day with progress. */
  estimatedEnd: ISODate | null
  /** deadline − estimatedEnd in calendar days. */
  marginDays: number | null
  /** pending / available days from max(today, start) to deadline, 1 decimal. 0 if done, null if no days left. */
  requiredPace: number | null
}

/** Float noise guard: 0.1 + 0.2 must count as 0.3 when comparing against a target. */
const EPS = 1e-9
const round2 = (n: number) => Math.round(n * 100) / 100

/** Available days needed to do `amount` at `pace` per day (at least 1). */
function daysFor(amount: number, pace: number): number {
  return Math.max(1, Math.ceil(amount / pace - EPS))
}

export function computeAmountMetrics(
  target: number,
  logs: readonly AmountLog[],
  config: ScheduleConfig,
  today: ISODate,
): AmountPlanMetrics {
  if (!(config.pace > 0)) throw new RangeError(`El ritmo tiene que ser mayor que 0 (recibí ${config.pace})`)
  const { pace, startDate, deadline } = config

  const done = round2(logs.reduce((s, l) => s + l.amount, 0))
  const doneToday = round2(logs.filter((l) => l.date === today).reduce((s, l) => s + l.amount, 0))
  const pending = round2(Math.max(0, target - done))

  const shouldHaveDone =
    today < startDate ? 0 : round2(Math.min(target, pace * countAvailableDays(startDate, minISO(today, deadline), config)))

  const base = maxISO(today, startDate)
  const studyToday = base === today && isAvailableDay(today, config)
  const todayRemaining = studyToday ? round2(Math.max(0, Math.min(pending, pace - doneToday))) : 0

  let estimatedEnd: ISODate | null
  if (target <= 0) estimatedEnd = null
  else if (pending <= EPS) {
    estimatedEnd = logs.filter((l) => l.amount > 0).reduce<ISODate | null>((max, l) => (!max || l.date > max ? l.date : max), null)
  } else if (base > today) {
    estimatedEnd = nthAvailableDay(base, daysFor(pending, pace), config)
  } else if (studyToday) {
    const afterToday = pending - todayRemaining
    estimatedEnd = afterToday <= EPS ? today : nthAvailableDay(nextAvailableDay(today, config), daysFor(afterToday, pace), config)
  } else {
    estimatedEnd = nthAvailableDay(nextAvailableDay(today, config), daysFor(pending, pace), config)
  }

  const daysLeft = countAvailableDays(base, deadline, config)
  const requiredPace = pending <= EPS ? 0 : daysLeft === 0 ? null : Math.round((pending / daysLeft) * 10) / 10

  return {
    target,
    done,
    pending,
    doneToday,
    shouldHaveDone,
    diff: round2(done - shouldHaveDone),
    todayRemaining,
    estimatedEnd,
    marginDays: estimatedEnd === null ? null : diffDays(deadline, estimatedEnd),
    requiredPace,
  }
}

/** "1,5 h" style: up to 2 decimals with a decimal comma, plus the unit. */
export function formatAmount(n: number, unit?: string): string {
  const num = fmtDecimal(round2(n))
  return unit ? `${num} ${unit}` : num
}
