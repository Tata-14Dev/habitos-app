/**
 * Achievements ("Logros"), derived from the data on every render: nothing is stored, so they
 * match on every device and appear on their own after an import or a sync. Each one says when it
 * was reached (the day the threshold was crossed) or how close it is.
 */
import { addDays, compareISO, eachDay, minISO, weekStart, type ISODate } from './dates'
import {
  isHabitActive,
  isOneOff,
  isPausedBetween,
  isWeeklyGoal,
  scheduledHabits,
  weekProgress,
  type DoneLookup,
  type HabitLike,
  type HabitLogLike,
} from './habits'

export type AchievementId =
  | 'first-habit'
  | 'perfect-day'
  | 'streak-7'
  | 'perfect-week'
  | 'streak-30'
  | 'habits-100'
  | 'weekly-4'
  | 'plan-done'
  | 'plan-on-time'
  | 'mood-30'
  | 'streak-100'
  | 'habits-500'
  | 'weigh-10'

export interface Achievement {
  id: AchievementId
  /** Day it was reached, or null if not yet. */
  achievedOn: ISODate | null
  /** Best value so far (capped at target) and the target, for "12/30". */
  value: number
  target: number
  /** Health achievements are hidden when health tracking is off. */
  health?: boolean
}

export interface AchievementInput {
  habits: readonly HabitLike[]
  isDone: DoneLookup
  habitLogs: readonly HabitLogLike[]
  plans: readonly { id: string; kind?: 'items' | 'amount'; target?: number; deadline: ISODate; deletedAt?: string }[]
  planItems: readonly { planId: string; done: boolean; doneDate?: ISODate; prior?: boolean; deletedAt?: string }[]
  planLogs: readonly { planId: string; date: ISODate; amount: number; deletedAt?: string }[]
  /** Days with a mood or motivation entry. */
  moodDays: readonly ISODate[]
  /** Days with a weigh-in. */
  weightDays: readonly ISODate[]
  today: ISODate
  mondayFirst: boolean
}

/** Tracks "value reached N on day D" for a counter that only grows. */
class Counter {
  best = 0
  reached = new Map<number, ISODate>()
  private readonly targets: number[]
  constructor(targets: number[]) {
    this.targets = targets
  }
  set(value: number, day: ISODate) {
    if (value <= this.best) return
    this.best = value
    for (const t of this.targets) if (value >= t && !this.reached.has(t)) this.reached.set(t, day)
  }
}

function achievement(id: AchievementId, c: Counter, target: number, health?: boolean): Achievement {
  return { id, achievedOn: c.reached.get(target) ?? null, value: Math.min(c.best, target), target, ...(health ? { health } : {}) }
}

/** When each plan was finished (null if not yet). */
export function planFinishedOn(input: Pick<AchievementInput, 'planItems' | 'planLogs'>, plan: AchievementInput['plans'][number]): { on: ISODate | null; progress: number } {
  if (plan.kind === 'amount') {
    const target = plan.target ?? 0
    const logs = input.planLogs.filter((l) => l.planId === plan.id && !l.deletedAt).sort((a, b) => compareISO(a.date, b.date))
    let sum = 0
    for (const l of logs) {
      sum += l.amount
      if (target > 0 && sum >= target - 1e-9) return { on: l.date, progress: 1 }
    }
    return { on: null, progress: target > 0 ? Math.min(1, sum / target) : 0 }
  }
  const items = input.planItems.filter((i) => i.planId === plan.id && !i.deletedAt)
  if (!items.length) return { on: null, progress: 0 }
  const done = items.filter((i) => i.done)
  if (done.length < items.length) return { on: null, progress: done.length / items.length }
  const dates = done.filter((i) => !i.prior && i.doneDate).map((i) => i.doneDate!) // all done before the plan: no date
  return { on: dates.length ? dates.reduce((a, b) => (compareISO(a, b) > 0 ? a : b)) : null, progress: 1 }
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  const { habits, isDone, today } = input
  const live = habits.filter((h) => !h.deletedAt)
  const total = new Counter([1, 100, 500])
  const streak = new Counter([7, 30, 100])
  const perfect = new Counter([1])
  const perfectRun = new Counter([7])

  const first = live.reduce<ISODate | null>((m, h) => (m === null || compareISO(h.startDate, m) < 0 ? h.startDate : m), null)
  if (first && compareISO(first, today) <= 0) {
    const runs = new Map<string, number>()
    const daily = live.filter((h) => !isWeeklyGoal(h) && !isOneOff(h))
    let count = 0
    let run = 0
    for (const d of eachDay(first, today)) {
      const due = scheduledHabits(live, d)
      const doneDue = due.filter((h) => isDone(h.id, d)).length
      // Weekly goals count the days they were done too.
      const doneWeekly = live.filter((h) => isWeeklyGoal(h) && isHabitActive(h, d) && isDone(h.id, d)).length
      count += doneDue + doneWeekly
      total.set(count, d)

      for (const h of daily) {
        if (!due.includes(h)) continue
        if (isDone(h.id, d)) {
          const r = (runs.get(h.id) ?? 0) + 1
          runs.set(h.id, r)
          streak.set(r, d)
        } else if (d !== today) runs.set(h.id, 0)
      }

      if (due.length >= 2 && doneDue === due.length) {
        perfect.set(1, d)
        run++
        perfectRun.set(run, d)
      } else if (due.length > 0 && d !== today) run = 0
    }
  }

  // Weekly goals met 4 weeks in a row (a paused week doesn't break the run).
  const weekly = new Counter([4])
  for (const h of live.filter(isWeeklyGoal)) {
    if (compareISO(h.startDate, today) > 0) continue
    let run = 0
    for (let w = weekStart(h.startDate, input.mondayFirst); compareISO(w, today) <= 0; w = addDays(w, 7)) {
      if (weekProgress(h, input.habitLogs, w, input.mondayFirst).met) {
        run++
        weekly.set(run, minISO(addDays(w, 6), today))
      } else if (compareISO(addDays(w, 6), today) < 0 && !isPausedBetween(h, w, addDays(w, 6))) run = 0
    }
  }

  // Plans: the first one finished, and the first one finished on or before its deadline.
  const planDone = new Counter([1])
  const planOnTime = new Counter([1])
  let bestPlan = 0
  let bestOpen = 0
  const finished = input.plans
    .filter((p) => !p.deletedAt)
    .map((p) => ({ p, ...planFinishedOn(input, p) }))
  for (const f of finished) {
    bestPlan = Math.max(bestPlan, f.progress)
    if (!f.on) bestOpen = Math.max(bestOpen, f.progress)
  }
  for (const f of finished.filter((x) => x.on).sort((a, b) => compareISO(a.on!, b.on!))) {
    planDone.set(1, f.on!)
    if (compareISO(f.on!, f.p.deadline) <= 0) planOnTime.set(1, f.on!)
  }

  const days = (list: readonly ISODate[], targets: number[]) => {
    const c = new Counter(targets)
    ;[...new Set(list)].sort(compareISO).forEach((d, i) => compareISO(d, today) <= 0 && c.set(i + 1, d))
    return c
  }
  const moods = days(input.moodDays, [30])
  const weights = days(input.weightDays, [10])

  const planAch = (id: AchievementId, c: Counter, best: number): Achievement => ({
    id,
    achievedOn: c.reached.get(1) ?? null,
    // Progress toward finishing the most advanced plan, in % (shown as "62%").
    value: c.reached.has(1) ? 100 : Math.min(99, Math.round(best * 100)),
    target: 100,
  })

  return [
    achievement('first-habit', total, 1),
    achievement('perfect-day', perfect, 1),
    achievement('streak-7', streak, 7),
    achievement('perfect-week', perfectRun, 7),
    achievement('streak-30', streak, 30),
    achievement('habits-100', total, 100),
    achievement('weekly-4', weekly, 4),
    planAch('plan-done', planDone, bestPlan),
    planAch('plan-on-time', planOnTime, bestOpen),
    achievement('mood-30', moods, 30),
    achievement('streak-100', streak, 100),
    achievement('habits-500', total, 500),
    achievement('weigh-10', weights, 10, true),
  ]
}

/** The most recent achievement reached in the last `days` days (for the "new achievement" card). */
export function latestAchievement(list: readonly Achievement[], today: ISODate, days = 7): Achievement | null {
  const since = addDays(today, -(days - 1))
  const recent = list.filter((a) => a.achievedOn && compareISO(a.achievedOn, since) >= 0)
  return recent.sort((a, b) => compareISO(b.achievedOn!, a.achievedOn!))[0] ?? null
}
