import { describe, expect, it } from 'vitest'
import { computeAmountMetrics, formatAmount } from './progress'
import type { ScheduleConfig } from './schedule'

// 2026-11-16 is a Monday; 2026-11-22 a Sunday.
const cfg: ScheduleConfig = { startDate: '2026-11-16', deadline: '2026-12-20', pace: 2, restWeekdays: [], blockedDates: [] }
const log = (date: string, amount: number) => ({ date, amount })

describe('computeAmountMetrics', () => {
  it('before the start: nothing expected yet, end = start + needed days', () => {
    const m = computeAmountMetrics(60, [], cfg, '2026-11-15')
    expect(m).toMatchObject({ done: 0, pending: 60, shouldHaveDone: 0, diff: 0, todayRemaining: 0 })
    expect(m.estimatedEnd).toBe('2026-12-15') // 30 days of 2 h
    expect(m.marginDays).toBe(5)
    expect(m.requiredPace).toBe(1.7) // 60 / 35
  })

  it('on a study day with nothing done: today counts for its full quota', () => {
    const m = computeAmountMetrics(60, [], cfg, '2026-11-16')
    expect(m.todayRemaining).toBe(2)
    expect(m.shouldHaveDone).toBe(2)
    expect(m.diff).toBe(-2)
    expect(m.estimatedEnd).toBe('2026-12-15')
  })

  it('doing more today pulls the end closer and never pushes the next day away', () => {
    const m = computeAmountMetrics(60, [log('2026-11-16', 5)], cfg, '2026-11-16')
    expect(m.todayRemaining).toBe(0)
    expect(m.diff).toBe(3)
    expect(m.estimatedEnd).toBe('2026-12-14') // 55 h left from tomorrow = 28 days
  })

  it('a partially done day leaves the rest of the quota for today', () => {
    const m = computeAmountMetrics(60, [log('2026-11-16', 1.5)], cfg, '2026-11-16')
    expect(m.todayRemaining).toBe(0.5)
    expect(m.estimatedEnd).toBe('2026-12-15')
  })

  it('rest days: nothing due today, the plan continues on the next available day', () => {
    const c = { ...cfg, pace: 1, restWeekdays: [0] }
    const logs = ['16', '17', '18', '19', '20', '21'].map((d) => log(`2026-11-${d}`, 1))
    const m = computeAmountMetrics(10, logs, c, '2026-11-22')
    expect(m).toMatchObject({ done: 6, pending: 4, shouldHaveDone: 6, diff: 0, todayRemaining: 0 })
    expect(m.estimatedEnd).toBe('2026-11-26')
  })

  it('fractional pace and amounts', () => {
    const m = computeAmountMetrics(3, [], { ...cfg, pace: 1.5 }, '2026-11-16')
    expect(m.todayRemaining).toBe(1.5)
    expect(m.estimatedEnd).toBe('2026-11-17')
  })

  it('target reached: end = last day with progress, no float noise', () => {
    const m = computeAmountMetrics(0.3, [log('2026-11-16', 0.1), log('2026-11-18', 0.2)], cfg, '2026-11-20')
    expect(m.pending).toBe(0)
    expect(m.estimatedEnd).toBe('2026-11-18')
    expect(m.requiredPace).toBe(0)
    expect(m.todayRemaining).toBe(0)
  })

  it('past the deadline with work left: no days left, negative margin', () => {
    const m = computeAmountMetrics(60, [log('2026-11-16', 10)], cfg, '2026-12-21')
    expect(m.requiredPace).toBeNull()
    expect(m.marginDays).toBeLessThan(0)
    expect(m.shouldHaveDone).toBe(60) // capped at the target
  })

  it('rejects a non-positive pace', () => {
    expect(() => computeAmountMetrics(10, [], { ...cfg, pace: 0 }, '2026-11-16')).toThrow(RangeError)
  })
})

describe('formatAmount', () => {
  it('uses a decimal comma and the unit', () => {
    expect(formatAmount(1.5, 'h')).toBe('1,5 h')
    expect(formatAmount(0.1 + 0.2, 'horas')).toBe('0,3 horas')
    expect(formatAmount(12)).toBe('12')
  })
})
