/**
 * Connects a plan to the (Tomás-implemented) scheduling functions. Every call goes through
 * `safeCall`, so a NotImplementedError becomes a "🛠️ Pendiente" notice instead of a crash.
 */
import { useEffect, useMemo } from 'react'
import type { ISODate } from '../domain/dates'
import { safeCall, type Safe } from '../domain/errors'
import { toScheduleConfig, toScheduleItems } from '../domain/plans'
import { computePlanMetrics, projectSchedule, type DateMap, type PlanMetrics } from '../domain/schedule'
import { ensureBaseline, saveProjection } from '../data/repo'
import { computeAmountMetrics, type AmountPlanMetrics } from '../domain/progress'
import type { Plan, PlanItem, PlanLog } from '../data/types'

export interface PlanModel {
  projection: Safe<DateMap>
  metrics: Safe<PlanMetrics>
  /** Simple counts that don't need the exercise. */
  doneCount: number
  total: number
  /** Function names still pending, for the notice. */
  pending: string[]
}

export function usePlanModel(plan: Plan | undefined, items: PlanItem[] | undefined, today: ISODate): PlanModel | undefined {
  const model = useMemo(() => {
    if (!plan || !items) return undefined
    const sItems = toScheduleItems(items)
    const config = toScheduleConfig(plan)
    const projection = safeCall(() => projectSchedule(sItems, config, today))
    const metrics: Safe<PlanMetrics> = projection.ok
      ? safeCall(() => computePlanMetrics(sItems, plan.baseline, projection.value, config, today))
      : projection.ok === false && 'notImplemented' in projection
        ? projection
        : { ok: false, error: new Error('Sin proyección') }
    const pending = new Set<string>()
    for (const r of [projection, metrics]) if (!r.ok && 'notImplemented' in r) pending.add(r.notImplemented)
    const missingBaseline = items.some((i) => !plan.baseline[i.id])
    if (missingBaseline) pending.add('buildBaseline')
    return {
      projection,
      metrics,
      doneCount: items.filter((i) => i.done).length,
      total: items.length,
      pending: [...pending],
    } satisfies PlanModel
  }, [plan, items, today])

  // Side effects: fill missing baseline dates once buildBaseline works; publish projection for reminders.
  useEffect(() => {
    if (plan && items?.some((i) => !plan.baseline[i.id])) void ensureBaseline(plan.id)
  }, [plan, items])
  useEffect(() => {
    if (plan && model?.projection.ok) void saveProjection(plan.id, model.projection.value, today)
  }, [plan, model, today])

  return model
}

/** Metrics for an amount plan (hours, pages…). Pure: see `src/domain/progress.ts`. */
export function useAmountModel(plan: Plan | undefined, logs: PlanLog[] | undefined, today: ISODate): Safe<AmountPlanMetrics> | undefined {
  return useMemo(() => {
    if (!plan || !logs) return undefined
    return safeCall(() => computeAmountMetrics(plan.target ?? 0, logs, toScheduleConfig(plan), today))
  }, [plan, logs, today])
}
