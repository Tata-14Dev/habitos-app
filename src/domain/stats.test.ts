import { describe, expect, it } from 'vitest'
import { addDays, eachDay, type ISODate } from './dates'
import { buildDoneLookup, type HabitLike, type HabitLogLike } from './habits'
import {
  consistency,
  dailySeries,
  itemsDoneOn,
  moodByCompletion,
  recentWeeklyAverage,
  streakRuns,
  weekdayRatios,
  weeklySeries,
} from './stats'

// 2026-11-16 is a Monday.
const TODAY = '2026-11-29' // Sunday
const done = (habitId: string, dates: ISODate[]): HabitLogLike[] => dates.map((date) => ({ habitId, date, done: true }))
const cama: HabitLike = { id: 'cama', startDate: '2026-09-01' }

describe('consistency', () => {
  it('last 30 days vs the 30 before, in percentage points', () => {
    const recent = eachDay(addDays(TODAY, -29), TODAY).filter((_, i) => i % 2 === 0) // 15 of 30
    const before = eachDay(addDays(TODAY, -59), addDays(TODAY, -30)).slice(0, 6) // 6 of 30
    const c = consistency(cama, buildDoneLookup(done('cama', [...recent, ...before])), [], TODAY, true)
    expect(c.current).toMatchObject({ done: 15, total: 30 })
    expect(c.previous).toMatchObject({ done: 6, total: 30 })
    expect(c.delta).toBe(30) // 50% − 20%
    expect(c.unit).toBe('days')
  })
  it('no previous data → no delta', () => {
    const fresh: HabitLike = { id: 'n', startDate: addDays(TODAY, -5) }
    expect(consistency(fresh, buildDoneLookup([]), [], TODAY, true).delta).toBeNull()
  })
  it('weekly goals: weeks met; the current week only counts once met', () => {
    const gym: HabitLike = { id: 'gym', startDate: '2026-10-01', kind: 'progress', goal: { type: 'times', target: 2 } }
    const logs = done('gym', ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-16', '2026-11-18', '2026-11-23'])
    const c = consistency(gym, buildDoneLookup(logs), logs, TODAY, true, 28)
    // weeks of 2/11 (met), 9/11 (1/2), 16/11 (met), 23/11 (current, 1/2 → not counted yet)
    expect(c.unit).toBe('weeks')
    expect(c.current).toMatchObject({ done: 2, total: 3 })
  })
})

describe('weekdayRatios', () => {
  it('finds the weak day', () => {
    const weekdays = eachDay('2026-11-16', '2026-11-29').filter((d) => ![0, 6].includes(new Date(`${d}T12:00`).getDay()))
    const r = weekdayRatios([cama], buildDoneLookup(done('cama', weekdays)), '2026-11-16', TODAY, TODAY)
    expect(r[1].pct).toBe(1) // Mondays
    expect(r[0].pct).toBe(0) // Sundays
    expect(r[6]).toMatchObject({ done: 0, total: 2 })
  })
  it('only due habits count (a Mon/Wed habit has no Tuesday)', () => {
    const swim: HabitLike = { id: 's', startDate: '2026-11-01', kind: 'scheduled', weekdays: [1, 3] }
    const r = weekdayRatios([swim], buildDoneLookup([]), '2026-11-16', TODAY, TODAY)
    expect(r[2].total).toBe(0)
    expect(r[2].pct).toBeNull()
  })
})

describe('moodByCompletion', () => {
  it('averages mood on good days vs the rest', () => {
    const moods = [
      { date: '2026-11-20', mood: 8, motivation: 8 }, // done → good day
      { date: '2026-11-21', mood: 6, motivation: 8 }, // done → good day
      { date: '2026-11-22', mood: 4, motivation: 5 }, // not done
      { date: '2026-11-23' }, // no values: ignored
    ]
    const r = moodByCompletion([cama], buildDoneLookup(done('cama', ['2026-11-20', '2026-11-21'])), moods, '2026-11-01', TODAY)
    expect(r).toEqual({ high: 7.5, low: 4.5, highDays: 2, lowDays: 1 })
  })
})

describe('streakRuns', () => {
  it('lists streaks longest first and skips days the habit is not due', () => {
    const swim: HabitLike = { id: 's', startDate: '2026-11-02', kind: 'scheduled', weekdays: [1, 3] }
    // Mon 2, Wed 4 | miss Mon 9 | Wed 11, Mon 16, Wed 18, Mon 23 | today Wed 25 pending
    const isDone = buildDoneLookup(done('s', ['2026-11-02', '2026-11-04', '2026-11-11', '2026-11-16', '2026-11-18', '2026-11-23']))
    expect(streakRuns(swim, isDone, '2026-11-25')).toEqual([
      { from: '2026-11-11', to: '2026-11-23', length: 4 },
      { from: '2026-11-02', to: '2026-11-04', length: 2 },
    ])
  })
})

describe('series', () => {
  const amount = (d: ISODate) => ({ '2026-11-16': 2, '2026-11-18': 1.5, '2026-11-24': 3 })[d] ?? 0
  it('daily buckets, oldest first', () => {
    expect(dailySeries(amount, '2026-11-18', 3).map((b) => b.value)).toEqual([2, 0, 1.5])
  })
  it('weekly buckets, current week included', () => {
    const s = weeklySeries(amount, '2026-11-25', 3, true)
    expect(s).toEqual([
      { date: '2026-11-09', value: 0 },
      { date: '2026-11-16', value: 3.5 },
      { date: '2026-11-23', value: 3 },
    ])
  })
  it('recent weekly average leaves the unfinished current week out', () => {
    expect(recentWeeklyAverage([{ date: 'a', value: 4 }, { date: 'b', value: 6 }, { date: 'c', value: 1 }], 4)).toBe(5)
    expect(recentWeeklyAverage([{ date: 'c', value: 1 }])).toBeNull()
  })
  it('plan items per day ignore items done before the plan', () => {
    const f = itemsDoneOn([
      { done: true, doneDate: '2026-11-20' },
      { done: true, doneDate: '2026-11-20' },
      { done: true, prior: true },
      { done: false },
    ])
    expect(f('2026-11-20')).toBe(2)
    expect(f('2026-11-21')).toBe(0)
  })
})
