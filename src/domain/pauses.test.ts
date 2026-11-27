import { describe, expect, it } from 'vitest'
import { buildDoneLookup, habitRangeRatio, habitStreaks, isHabitScheduled, weeklyStreaks, addPause, endPause, currentPause, type HabitLike } from './habits'
import { eachDay } from './dates'
import { consistency } from './stats'

const daily: HabitLike = { id: 'h', startDate: '2026-11-01', pauses: [{ from: '2026-11-10', to: '2026-11-14' }] }
// Done every day except the paused ones.
const logs = eachDay('2026-11-01', '2026-11-20')
  .filter((d) => d < '2026-11-10' || d > '2026-11-14')
  .map((date) => ({ habitId: 'h', date, done: true }))
const isDone = buildDoneLookup(logs)

describe('habit pauses', () => {
  it('paused days are not due', () => {
    expect(isHabitScheduled(daily, '2026-11-12')).toBe(false)
    expect(isHabitScheduled(daily, '2026-11-15')).toBe(true)
  })
  it('the streak goes over the pause without breaking (and without counting it)', () => {
    expect(habitStreaks(daily, isDone, '2026-11-20')).toEqual({ current: 15, best: 15 })
  })
  it('percentages ignore paused days', () => {
    expect(habitRangeRatio(daily, '2026-11-01', '2026-11-20', isDone, '2026-11-20')).toEqual({ done: 15, total: 15, pct: 1 })
  })
  it('an open pause (no end) lasts until resumed', () => {
    const h = { ...daily, pauses: [{ from: '2026-11-18' }] }
    expect(isHabitScheduled(h, '2027-03-01')).toBe(false)
    expect(currentPause(h, '2026-11-20')).toEqual({ from: '2026-11-18' })
  })
  it('weekly goals: a paused week does not break the streak', () => {
    const w: HabitLike = { id: 'w', startDate: '2026-11-02', kind: 'progress', goal: { type: 'times', target: 1 }, pauses: [{ from: '2026-11-09', to: '2026-11-15' }] }
    const wl = [{ habitId: 'w', date: '2026-11-03', done: true }, { habitId: 'w', date: '2026-11-17', done: true }]
    expect(weeklyStreaks(w, wl, '2026-11-20', true)).toEqual({ current: 2, best: 2 })
    expect(consistency(w, buildDoneLookup(wl), wl, '2026-11-20', true, 28).current).toEqual({ done: 2, total: 2, pct: 1 })
  })
})

describe('addPause / endPause', () => {
  it('merges overlapping or touching pauses', () => {
    expect(addPause([{ from: '2026-11-01', to: '2026-11-05' }], '2026-11-06', '2026-11-08')).toEqual([{ from: '2026-11-01', to: '2026-11-08' }])
    expect(addPause([{ from: '2026-11-01', to: '2026-11-05' }], '2026-11-03')).toEqual([{ from: '2026-11-01' }])
    expect(addPause([{ from: '2026-11-01', to: '2026-11-02' }], '2026-11-10', '2026-11-12')).toHaveLength(2)
  })
  it('resuming ends the current pause yesterday; one starting today disappears; later ones stay', () => {
    const p = [{ from: '2026-11-10' }, { from: '2026-12-20', to: '2026-12-31' }]
    expect(endPause(p, '2026-11-20')).toEqual([{ from: '2026-11-10', to: '2026-11-19' }, { from: '2026-12-20', to: '2026-12-31' }])
    expect(endPause([{ from: '2026-11-20' }], '2026-11-20')).toEqual([])
  })
})
