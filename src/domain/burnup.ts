/**
 * Burn-up series for a plan: cumulative work over time, one point per day.
 * - `plan`: what the original plan expected by that day.
 * - `real`: what was actually done (only up to today).
 * - `projection`: done so far + the projected schedule (from today on).
 * Items done before the plan (`prior`) are not part of these series: the chart is about the plan.
 */
import { addDays, eachDay, maxISO, type ISODate } from './dates'
import { countAvailableDays, isAvailableDay, type DateMap, type ScheduleConfig, type ScheduleItem } from './schedule'

export interface BurnupPoint {
  date: ISODate
  plan: number
  real: number | null
  projection: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Last day to draw: the later of the deadline and the last projected/done date (and today). */
function lastDay(config: ScheduleConfig, today: ISODate, ...dates: (ISODate | undefined)[]): ISODate {
  return dates.reduce<ISODate>((max, d) => (d && d > max ? d : max), maxISO(config.deadline, today))
}

export function itemsBurnup(
  items: readonly ScheduleItem[],
  baseline: DateMap,
  projection: DateMap,
  config: ScheduleConfig,
  today: ISODate,
): BurnupPoint[] {
  if (items.length === 0) return []
  const end = lastDay(config, today, ...Object.values(projection))
  const doneDates = items.filter((i) => i.done).map((i) => i.doneDate ?? today)
  const first = [config.startDate, ...doneDates].reduce((min, d) => (d < min ? d : min))
  const planDates = items.map((i) => baseline[i.id]).filter(Boolean) as ISODate[]
  const pendingDates = items.filter((i) => !i.done).map((i) => projection[i.id]).filter(Boolean) as ISODate[]
  const countUpTo = (dates: ISODate[], d: ISODate) => dates.filter((x) => x <= d).length
  return eachDay(first, end).map((date) => ({
    date,
    plan: countUpTo(planDates, date),
    real: date <= today ? countUpTo(doneDates, date) : null,
    projection: date >= today ? doneDates.length + countUpTo(pendingDates, date) : null,
  }))
}

export function amountBurnup(
  target: number,
  logs: readonly { date: ISODate; amount: number }[],
  config: ScheduleConfig,
  today: ISODate,
): BurnupPoint[] {
  if (!(target > 0) || !(config.pace > 0)) return []
  const byDay = new Map<ISODate, number>()
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.amount)
  const done = [...byDay.values()].reduce((s, a) => s + a, 0)
  const doneToday = byDay.get(today) ?? 0

  // Projection: from today on, each available day adds the pace (today: only what's left of it).
  const proj = new Map<ISODate, number>()
  let acc = done
  let d = today
  for (let guard = 0; acc < target - 1e-9 && guard < 3650; guard++, d = addDays(d, 1)) {
    if (d >= config.startDate && isAvailableDay(d, config)) acc = Math.min(target, acc + (d === today ? Math.max(0, config.pace - doneToday) : config.pace))
    proj.set(d, acc)
  }
  const projEnd = d === today ? today : addDays(d, -1)

  const firstLog = [...byDay.keys()].reduce<ISODate>((min, x) => (x < min ? x : min), config.startDate)
  const end = lastDay(config, today, projEnd)
  let real = 0
  return eachDay(firstLog, end).map((date) => {
    real += byDay.get(date) ?? 0
    const planned = date < config.startDate ? 0 : Math.min(target, config.pace * countAvailableDays(config.startDate, date, config))
    return {
      date,
      plan: round2(planned),
      real: date <= today ? round2(real) : null,
      projection: date >= today ? round2(proj.get(date) ?? target) : null,
    }
  })
}
