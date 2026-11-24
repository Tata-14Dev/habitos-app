import { describe, expect, it } from 'vitest'
import { amountBurnup, itemsBurnup } from './burnup'
import { buildBaseline, projectSchedule, type ScheduleConfig, type ScheduleItem } from './schedule'

// 2026-11-16 is a Monday.
const cfg: ScheduleConfig = { startDate: '2026-11-16', deadline: '2026-11-20', pace: 1, restWeekdays: [], blockedDates: [] }

describe('itemsBurnup', () => {
  const items: ScheduleItem[] = [
    { id: 'a', done: true, doneDate: '2026-11-16' },
    { id: 'b', done: true, doneDate: '2026-11-16' }, // did 2 on day one
    { id: 'c', done: false },
    { id: 'd', done: false },
    { id: 'e', done: false },
  ]
  const baseline = buildBaseline(items, cfg)
  const today = '2026-11-17'
  const projection = projectSchedule(items, cfg, today)
  const pts = itemsBurnup(items, baseline, projection, cfg, today)

  it('one point per day from the start to the end of the plan', () => {
    expect(pts.map((p) => p.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'])
  })
  it('plan grows one per day; real stops today; projection starts today', () => {
    expect(pts.map((p) => p.plan)).toEqual([1, 2, 3, 4, 5])
    expect(pts.map((p) => p.real)).toEqual([2, 2, null, null, null])
    expect(pts.map((p) => p.projection)).toEqual([null, 3, 4, 5, 5]) // ahead of plan: ends a day early
  })
  it('empty plan → no points', () => {
    expect(itemsBurnup([], {}, {}, cfg, today)).toEqual([])
  })
})

describe('amountBurnup', () => {
  const c = { ...cfg, pace: 2, deadline: '2026-11-20' } // 10 h in 5 days
  it('plan, real and projection for hours', () => {
    const pts = amountBurnup(10, [{ date: '2026-11-16', amount: 3 }], c, '2026-11-17')
    expect(pts.map((p) => p.plan)).toEqual([2, 4, 6, 8, 10])
    expect(pts.map((p) => p.real)).toEqual([3, 3, null, null, null])
    expect(pts.map((p) => p.projection)).toEqual([null, 5, 7, 9, 10])
  })
  it('extends past the deadline when the projection does', () => {
    const pts = amountBurnup(10, [], c, '2026-11-19') // nothing done, 2 days left at 2 h → late
    expect(pts.at(-1)!.date > '2026-11-20').toBe(true)
    expect(pts.at(-1)!.projection).toBe(10)
  })
})
