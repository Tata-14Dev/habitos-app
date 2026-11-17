import { describe, expect, it } from 'vitest'
import { weekStart, type ISODate } from './dates'
import {
  buildDoneLookup,
  dayRatio,
  habitRangeRatio,
  habitStreaks,
  isHabitScheduled,
  weeklyStreaks,
  weekProgress,
  type HabitLike,
  type HabitLogLike,
} from './habits'

// 2026-11-16 is a Monday.
const START = '2026-11-02' // Monday
const fixed: HabitLike = { id: 'cama', startDate: START }
const monWed: HabitLike = { id: 'natacion', startDate: START, kind: 'scheduled', weekdays: [1, 3] }
const oneOff: HabitLike = { id: 'service', startDate: START, kind: 'scheduled', onDate: '2026-11-25' }
const studyDaily: HabitLike = { id: 'estudiar', startDate: START, kind: 'progress', goal: { type: 'amount', period: 'day', target: 1, unit: 'h' } }
const englishWeekly: HabitLike = { id: 'ingles', startDate: START, kind: 'progress', goal: { type: 'amount', period: 'week', target: 5, unit: 'h' } }
const gym3: HabitLike = { id: 'gym', startDate: START, kind: 'progress', goal: { type: 'times', target: 3 } }

const done = (habitId: string, dates: ISODate[]): HabitLogLike[] => dates.map((date) => ({ habitId, date, done: true }))
const amount = (habitId: string, date: ISODate, a: number): HabitLogLike => ({ habitId, date, done: a > 0, amount: a })

describe('weekStart', () => {
  it('Monday or Sunday first', () => {
    expect(weekStart('2026-11-19', true)).toBe('2026-11-16')
    expect(weekStart('2026-11-16', true)).toBe('2026-11-16')
    expect(weekStart('2026-11-22', true)).toBe('2026-11-16') // Sunday belongs to the Monday week
    expect(weekStart('2026-11-22', false)).toBe('2026-11-22')
    expect(weekStart('2026-11-21', false)).toBe('2026-11-15')
  })
})

describe('isHabitScheduled', () => {
  it('fixed (and habits without a kind): every valid day', () => {
    expect(isHabitScheduled(fixed, '2026-11-17')).toBe(true)
    expect(isHabitScheduled(fixed, '2026-11-01')).toBe(false) // before its start
  })
  it('weekdays: only those days', () => {
    expect(isHabitScheduled(monWed, '2026-11-16')).toBe(true)
    expect(isHabitScheduled(monWed, '2026-11-17')).toBe(false)
    expect(isHabitScheduled(monWed, '2026-11-18')).toBe(true)
  })
  it('one-off: only its date', () => {
    expect(isHabitScheduled(oneOff, '2026-11-25')).toBe(true)
    expect(isHabitScheduled(oneOff, '2026-11-24')).toBe(false)
  })
  it('daily progress: every day; weekly goals: never part of a day', () => {
    expect(isHabitScheduled(studyDaily, '2026-11-17')).toBe(true)
    expect(isHabitScheduled(englishWeekly, '2026-11-17')).toBe(false)
    expect(isHabitScheduled(gym3, '2026-11-17')).toBe(false)
  })
})

describe('daily percentage with types', () => {
  const habits = [fixed, monWed, oneOff, studyDaily, englishWeekly, gym3]
  it('Tuesday: only fixed + daily progress are due', () => {
    const isDone = buildDoneLookup(done('cama', ['2026-11-17']), {}, habits)
    expect(dayRatio(habits, '2026-11-17', isDone)).toMatchObject({ done: 1, total: 2 })
  })
  it('Monday: the weekday habit joins', () => {
    const isDone = buildDoneLookup([...done('cama', ['2026-11-16']), ...done('natacion', ['2026-11-16'])], {}, habits)
    expect(dayRatio(habits, '2026-11-16', isDone)).toMatchObject({ done: 2, total: 3 })
  })
  it('daily amount goal: done only when amount ≥ target', () => {
    const half = buildDoneLookup([amount('estudiar', '2026-11-17', 0.5)], {}, habits)
    const full = buildDoneLookup([amount('estudiar', '2026-11-17', 1)], {}, habits)
    expect(half('estudiar', '2026-11-17')).toBe(false)
    expect(full('estudiar', '2026-11-17')).toBe(true)
  })
  it('unscheduled days never count as misses for that habit', () => {
    const isDone = buildDoneLookup(done('natacion', ['2026-11-16', '2026-11-18']), {}, habits)
    expect(habitRangeRatio(monWed, '2026-11-16', '2026-11-22', isDone, '2026-11-22')).toMatchObject({ done: 2, total: 2, pct: 1 })
  })
})

describe('streaks with types', () => {
  it('weekday habits skip the days they are not due', () => {
    // Mon 9, Wed 11, Mon 16, Wed 18: 4 in a row even though Tue/Thu… were empty
    const isDone = buildDoneLookup(done('natacion', ['2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18']))
    expect(habitStreaks(monWed, isDone, '2026-11-19')).toEqual({ current: 4, best: 4 })
  })
  it('missing a due day breaks it', () => {
    const isDone = buildDoneLookup(done('natacion', ['2026-11-09', '2026-11-16', '2026-11-18']))
    expect(habitStreaks(monWed, isDone, '2026-11-19')).toEqual({ current: 2, best: 2 })
  })
  it('one-off habits have no streak', () => {
    expect(habitStreaks(oneOff, buildDoneLookup(done('service', ['2026-11-25'])), '2026-11-26')).toEqual({ current: 0, best: 0 })
  })
})

describe('weekly goals', () => {
  const logs = [
    amount('ingles', '2026-11-16', 2),
    amount('ingles', '2026-11-18', 1.5),
    ...done('gym', ['2026-11-16', '2026-11-19']),
  ]
  it('amount per week: sum of the week', () => {
    expect(weekProgress(englishWeekly, logs, '2026-11-19', true)).toMatchObject({ from: '2026-11-16', to: '2026-11-22', done: 3.5, target: 5, met: false })
  })
  it('times per week: days marked', () => {
    expect(weekProgress(gym3, logs, '2026-11-19', true)).toMatchObject({ done: 2, target: 3, met: false })
    expect(weekProgress(gym3, [...logs, ...done('gym', ['2026-11-21'])], '2026-11-19', true).met).toBe(true)
  })
  it('week streaks: consecutive weeks met, the current week does not break it', () => {
    const history = [
      ...done('gym', ['2026-11-02', '2026-11-04', '2026-11-06']), // week of 2/11: met
      ...done('gym', ['2026-11-09', '2026-11-10', '2026-11-12']), // week of 9/11: met
      ...done('gym', ['2026-11-16']), // current week: in progress
    ]
    expect(weeklyStreaks(gym3, history, '2026-11-17', true)).toEqual({ current: 2, best: 2 })
  })
  it('a missed past week resets the streak', () => {
    const history = [...done('gym', ['2026-11-02', '2026-11-04', '2026-11-06']), ...done('gym', ['2026-11-09'])]
    expect(weeklyStreaks(gym3, history, '2026-11-17', true)).toEqual({ current: 0, best: 1 })
  })
})
