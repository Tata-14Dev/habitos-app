import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { calorieSummary, dayCalories, formatKg, trendOn, weeklyRate, weightSeries, weightSummary, type WeightEntry } from './health'

const food = (date: string, kcal: number) => ({ date, kcal })

describe('calories', () => {
  const entries = [food('2026-11-16', 600), food('2026-11-16', 900), food('2026-11-17', 2400), { ...food('2026-11-17', 500), deletedAt: 'x' }]
  it('sums a day and ignores deleted entries', () => {
    expect(dayCalories(entries, '2026-11-16')).toBe(1500)
    expect(dayCalories(entries, '2026-11-17')).toBe(2400)
  })
  it('summary: average over logged days, days on target, future days null', () => {
    const s = calorieSummary(entries, '2026-11-15', '2026-11-19', 2000, '2026-11-18')
    expect(s.average).toBe(1950)
    expect(s.loggedDays).toBe(2)
    expect(s.daysOnTarget).toBe(1)
    expect(s.days.map((d) => d.kcal)).toEqual([0, 1500, 2400, 0, null])
  })
})

/** A weigh-in every day from `from`, starting at `kg0` and changing `perDay`. */
function linear(from: string, n: number, kg0: number, perDay: number): WeightEntry[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), kg: Math.round((kg0 + perDay * i) * 100) / 100 }))
}

describe('weight', () => {
  it('trend = average of the last 7 days of weigh-ins', () => {
    const w = [{ date: '2026-11-09', kg: 80 }, { date: '2026-11-14', kg: 79 }, { date: '2026-11-16', kg: 78.4 }]
    expect(trendOn(w, '2026-11-16')).toBe(78.7) // window is 10/11–16/11: 9/11 stays out
    expect(trendOn([...w, { date: '2026-11-10', kg: 80 }], '2026-11-16')).toBe(79.1) // 10/11 is in
    expect(trendOn(w, '2026-11-01')).toBeNull()
  })
  it('series pairs each weigh-in with its trend', () => {
    expect(weightSeries([{ date: '2026-11-16', kg: 80 }, { date: '2026-11-17', kg: 79 }])).toEqual([
      { date: '2026-11-16', kg: 80, trend: 80 },
      { date: '2026-11-17', kg: 79, trend: 79.5 },
    ])
  })
  it('weekly rate from a least-squares line (−0,1 kg/day → −0,7 kg/week)', () => {
    expect(weeklyRate(linear('2026-10-20', 28, 85, -0.1), '2026-11-16')).toBe(-0.7)
  })
  it('no rate with too few weigh-ins or less than a week of data', () => {
    expect(weeklyRate(linear('2026-11-14', 3, 80, -0.1), '2026-11-16')).toBeNull()
  })
  it('summary: goal, distance and estimated date', () => {
    const s = weightSummary(linear('2026-10-20', 28, 85, -0.1), 80, '2026-11-16')
    expect(s.latest?.kg).toBe(82.3)
    expect(s.totalChange).toBe(-2.7)
    expect(s.ratePerWeek).toBe(-0.7)
    expect(s.toGoal).toBeLessThan(0)
    expect(s.eta).not.toBeNull()
    expect(s.eta! > '2026-11-16').toBe(true)
  })
  it('no estimated date when moving away from the goal', () => {
    const s = weightSummary(linear('2026-10-20', 28, 80, 0.05), 75, '2026-11-16')
    expect(s.eta).toBeNull()
  })
  it('goal reached when the trend is within 0,15 kg', () => {
    expect(weightSummary([{ date: '2026-11-16', kg: 70.1 }], 70, '2026-11-16').reached).toBe(true)
  })
  it('formats with a decimal comma', () => {
    expect(formatKg(72.36)).toBe('72,4')
  })
})
