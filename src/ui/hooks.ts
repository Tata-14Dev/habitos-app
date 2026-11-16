import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { todayISO, type ISODate } from '../domain/dates'
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
