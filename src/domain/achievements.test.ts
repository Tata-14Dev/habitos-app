import { describe, expect, it } from 'vitest'
import { computeAchievements, latestAchievement, planFinishedOn, type AchievementInput } from './achievements'
import { eachDay } from './dates'
import { buildDoneLookup, type HabitLike } from './habits'

const today = '2026-11-27'
function input(over: Partial<AchievementInput> = {}): AchievementInput {
  return { habits: [], isDone: () => false, habitLogs: [], plans: [], planItems: [], planLogs: [], moodDays: [], weightDays: [], today, mondayFirst: true, ...over }
}
const get = (list: ReturnType<typeof computeAchievements>, id: string) => list.find((a) => a.id === id)!

describe('computeAchievements', () => {
  it('nothing yet: every achievement locked, progress 0', () => {
    const list = computeAchievements(input())
    expect(list.every((a) => a.achievedOn === null && a.value === 0)).toBe(true)
  })

  it('streaks and totals say the day the threshold was crossed', () => {
    const habits: HabitLike[] = [{ id: 'a', startDate: '2026-11-01' }, { id: 'b', startDate: '2026-11-01' }]
    // "a" every day from the 1st; "b" only the 10th → 16th (a perfect week).
    const logs = [
      ...eachDay('2026-11-01', today).map((date) => ({ habitId: 'a', date, done: true })),
      ...eachDay('2026-11-10', '2026-11-16').map((date) => ({ habitId: 'b', date, done: true })),
    ]
    const list = computeAchievements(input({ habits, habitLogs: logs, isDone: buildDoneLookup(logs) }))
    expect(get(list, 'first-habit').achievedOn).toBe('2026-11-01')
    expect(get(list, 'streak-7').achievedOn).toBe('2026-11-07')
    expect(get(list, 'streak-30')).toMatchObject({ achievedOn: null, value: 27, target: 30 })
    expect(get(list, 'perfect-day').achievedOn).toBe('2026-11-10')
    expect(get(list, 'perfect-week').achievedOn).toBe('2026-11-16')
    expect(get(list, 'habits-100')).toMatchObject({ achievedOn: null, value: 34 })
  })

  it('a pending today does not break a run', () => {
    const habits: HabitLike[] = [{ id: 'a', startDate: '2026-11-20' }]
    const logs = eachDay('2026-11-20', '2026-11-26').map((date) => ({ habitId: 'a', date, done: true }))
    expect(get(computeAchievements(input({ habits, isDone: buildDoneLookup(logs) })), 'streak-7').achievedOn).toBe('2026-11-26')
  })

  it('weekly goal met 4 weeks in a row', () => {
    const habits: HabitLike[] = [{ id: 'w', startDate: '2026-11-02', kind: 'progress', goal: { type: 'times', target: 1 } }]
    const logs = ['2026-11-02', '2026-11-10', '2026-11-18', '2026-11-26'].map((date) => ({ habitId: 'w', date, done: true }))
    expect(get(computeAchievements(input({ habits, habitLogs: logs, isDone: buildDoneLookup(logs) })), 'weekly-4').achievedOn).toBe('2026-11-27')
  })

  it('plans: finished, and finished on time', () => {
    const plans = [
      { id: 'p', kind: 'items' as const, deadline: '2026-11-20' },
      { id: 'q', kind: 'amount' as const, target: 10, deadline: '2026-11-30' },
    ]
    const planItems = [
      { planId: 'p', done: true, prior: true },
      { planId: 'p', done: true, doneDate: '2026-11-22' },
    ]
    const planLogs = [
      { planId: 'q', date: '2026-11-24', amount: 6 },
      { planId: 'q', date: '2026-11-25', amount: 4 },
    ]
    const list = computeAchievements(input({ plans, planItems, planLogs }))
    expect(get(list, 'plan-done').achievedOn).toBe('2026-11-22')
    expect(get(list, 'plan-on-time').achievedOn).toBe('2026-11-25')
    expect(planFinishedOn({ planItems, planLogs }, { id: 'q', kind: 'amount', target: 20, deadline: today })).toEqual({ on: null, progress: 0.5 })
  })

  it('mood and weigh-in days', () => {
    const moodDays = eachDay('2026-10-01', '2026-10-30')
    const list = computeAchievements(input({ moodDays, weightDays: ['2026-11-01', '2026-11-01', '2026-11-02'] }))
    expect(get(list, 'mood-30').achievedOn).toBe('2026-10-30')
    expect(get(list, 'weigh-10')).toMatchObject({ value: 2, health: true })
  })
})

describe('latestAchievement', () => {
  it('the newest one of the last 7 days', () => {
    const list = computeAchievements(input({ moodDays: eachDay('2026-10-01', '2026-10-30') }))
    expect(latestAchievement(list, today)).toBeNull()
    expect(latestAchievement(list, '2026-11-02')?.id).toBe('mood-30')
  })
})
