import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { addDays, todayISO, type ISODate } from '../domain/dates'
import { linkedHabitDays, linkedHabitLogDays } from '../domain/habits'
import { db } from '../data/db'
import { getSyncState, subscribeSync } from '../data/sync'
import { DEFAULT_SETTINGS, type Settings } from '../data/types'

const alive = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)

/** Today's local date; updates after midnight and when the app comes back to the foreground. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const tick = () => setToday(todayISO())
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

export function useHabits() {
  return useLiveQuery(async () => alive(await db.habits.toArray()).sort((a, b) => a.order - b.order), [])
}

export function useHabitLogs(from: ISODate, to: ISODate) {
  return useLiveQuery(
    async () => alive(await db.habitLogs.where('date').between(from, to, true, true).toArray()),
    [from, to],
  )
}

export function useAllHabitLogs() {
  return useLiveQuery(async () => alive(await db.habitLogs.toArray()), [])
}

export function useDayMoods(from: ISODate, to: ISODate) {
  return useLiveQuery(
    async () => alive(await db.dayMoods.where('date').between(from, to, true, true).toArray()),
    [from, to],
  )
}

export function usePlans() {
  return useLiveQuery(async () => alive(await db.plans.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [])
}

export function usePlan(id: string | undefined) {
  return useLiveQuery(async () => (id ? await db.plans.get(id) : undefined), [id])
}

export function usePlanItems(planId: string | undefined) {
  return useLiveQuery(
    async () =>
      planId ? alive(await db.planItems.where('planId').equals(planId).toArray()).sort((a, b) => a.order - b.order) : [],
    [planId],
  )
}

export function usePlanLogs(planId: string | undefined) {
  return useLiveQuery(
    async () =>
      planId ? alive(await db.planLogs.where('planId').equals(planId).toArray()).sort((a, b) => a.date.localeCompare(b.date)) : [],
    [planId],
  )
}

/**
 * Derived done-days for habits linked to a plan: a day counts if an item was done (item plans)
 * or some progress was logged (amount plans). habitId → days.
 */
export function useLinkedHabitDays(): Record<string, Set<ISODate>> | undefined {
  const plans = usePlans()
  const items = useAllPlanItems()
  const logs = useLiveQuery(async () => alive(await db.planLogs.toArray()), [])
  return useMemo(() => {
    if (!plans || !items || !logs) return undefined
    const derived: Record<string, Set<ISODate>> = {}
    for (const p of plans) {
      if (!p.linkedHabitId) continue
      derived[p.linkedHabitId] =
        p.kind === 'amount'
          ? linkedHabitLogDays(logs.filter((l) => l.planId === p.id))
          : linkedHabitDays(items.filter((i) => i.planId === p.id))
    }
    return derived
  }, [plans, items, logs])
}

/** All plan items (any plan) — used for linked habits. */
export function useAllPlanItems() {
  return useLiveQuery(async () => alive(await db.planItems.toArray()), [])
}

export function useMilestones(planId: string | undefined) {
  return useLiveQuery(
    async () =>
      planId ? alive(await db.milestones.where('planId').equals(planId).toArray()).sort((a, b) => a.from.localeCompare(b.from)) : [],
    [planId],
  )
}

export function useTasks(date: ISODate) {
  return useLiveQuery(async () => alive(await db.tasks.where('date').equals(date).toArray()), [date])
}

export function useBodyWeights() {
  return useLiveQuery(async () => alive(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [])
}

export function useFoodEntries(from: ISODate, to: ISODate) {
  return useLiveQuery(async () => alive(await db.foodEntries.where('date').between(from, to, true, true).toArray()), [from, to])
}

export function useCustomFoods() {
  return useLiveQuery(async () => alive(await db.customFoods.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'es')), [])
}

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get('prefs'), [])
  return useMemo(() => ({ ...DEFAULT_SETTINGS, updatedAt: '', ...s }), [s])
}

export function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState)
}

export function usePendingChanges() {
  return useLiveQuery(() => db.outbox.count(), []) ?? 0
}

/** Tasks after `today` (up to `days` ahead), by date. */
export function useUpcomingTasks(today: ISODate, days = 30) {
  return useLiveQuery(
    async () =>
      alive(await db.tasks.where('date').between(today, addDays(today, days), false, true).toArray()).sort(
        (a, b) => a.date.localeCompare(b.date) || a.order - b.order,
      ),
    [today, days],
  )
}
