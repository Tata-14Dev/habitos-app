/**
 * Repository: the only API the UI uses to write data. Built on `store` (Dexie + outbox), so
 * every write is local-first and gets synced. Reads live in `hooks.ts` (live queries).
 */
import { todayISO, type ISODate } from '../domain/dates'
import { safeCall } from '../domain/errors'
import { parseItemList, toScheduleConfig, toScheduleItems } from '../domain/plans'
import { buildBaseline, projectSchedule } from '../domain/schedule'
import { parseDictation } from '../domain/tasks'
import { db } from './db'
import { newId, nowStamp, store } from './store'
import {
  DEFAULT_SETTINGS,
  type Habit,
  type Meal,
  type Milestone,
  type Plan,
  type PlanItem,
  type PlanKind,
  type Settings,
  type Task,
} from './types'

const alive = <T extends { deletedAt?: string }>(r: T | undefined): r is T => !!r && !r.deletedAt

// ─── Habits ─────────────────────────────────────────────────────────────────

export async function saveHabit(input: Partial<Habit> & Pick<Habit, 'name' | 'startDate'>): Promise<Habit> {
  const existing = input.id ? await db.habits.get(input.id) : undefined
  const count = existing ? 0 : (await db.habits.toArray()).filter(alive).length
  const now = nowStamp()
  return store.put('habits', {
    order: count,
    createdAt: now,
    ...existing,
    ...input,
    id: input.id ?? newId(),
  } as Habit)
}

export async function deleteHabit(id: string) {
  await store.softDelete('habits', [id])
}

export async function reorderHabits(orderedIds: string[]) {
  const habits = (await db.habits.bulkGet(orderedIds)).filter(alive)
  await store.putMany(
    'habits',
    habits.map((h) => ({ ...h, order: orderedIds.indexOf(h.id) })),
  )
}

export async function setHabitDone(habitId: string, date: ISODate, done: boolean) {
  await store.put('habitLogs', { id: `${habitId}|${date}`, habitId, date, done })
}

/** Progress habits with an amount goal: sets the amount done on `date` (0 clears it). */
export async function setHabitAmount(habitId: string, date: ISODate, amount: number) {
  const value = Math.max(0, Math.round(amount * 100) / 100)
  await store.put('habitLogs', { id: `${habitId}|${date}`, habitId, date, done: value > 0, amount: value })
}

/** Adds `delta` (can be negative) to the amount logged on `date`. */
export async function addHabitAmount(habitId: string, date: ISODate, delta: number) {
  const current = await db.habitLogs.get(`${habitId}|${date}`)
  const base = current && !current.deletedAt ? (current.amount ?? 0) : 0
  await setHabitAmount(habitId, date, base + delta)
}

export async function setMood(date: ISODate, values: { mood?: number; motivation?: number }) {
  const current = await db.dayMoods.get(date)
  await store.put('dayMoods', { ...current, id: date, date, ...values })
}

// ─── Plans ──────────────────────────────────────────────────────────────────

export interface PlanInput {
  name: string
  kind: PlanKind
  unit?: string
  /** Amount plans: total to reach. */
  target?: number
  startDate: ISODate
  deadline: ISODate
  pace: number
  restWeekdays: number[]
  blockedDates: ISODate[]
  /** Create a linked habit "Estudiar <name>" that counts as done on days with progress. */
  withHabit: boolean
  itemsText?: string
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  const planId = newId()
  let linkedHabitId: string | undefined
  if (input.withHabit) {
    const h = await saveHabit({ name: `Estudiar ${input.name}`, emoji: '📚', startDate: input.startDate })
    linkedHabitId = h.id
  }
  const plan = await store.put('plans', {
    id: planId,
    name: input.name,
    kind: input.kind,
    unit: input.unit,
    target: input.kind === 'amount' ? input.target : undefined,
    startDate: input.startDate,
    deadline: input.deadline,
    pace: input.pace,
    restWeekdays: input.restWeekdays,
    blockedDates: input.blockedDates,
    linkedHabitId,
    baseline: {},
    createdAt: nowStamp(),
  })
  if (input.itemsText?.trim()) await addItems(planId, input.itemsText)
  return plan
}

export async function updatePlan(id: string, changes: Partial<Plan>) {
  await store.patch('plans', id, changes)
}

export async function deletePlan(id: string) {
  const items = await db.planItems.where('planId').equals(id).primaryKeys()
  const milestones = await db.milestones.where('planId').equals(id).primaryKeys()
  const logs = await db.planLogs.where('planId').equals(id).primaryKeys()
  await store.softDelete('planItems', items)
  await store.softDelete('planLogs', logs)
  await store.softDelete('milestones', milestones)
  await store.softDelete('plans', [id])
}

async function planItems(planId: string): Promise<PlanItem[]> {
  return (await db.planItems.where('planId').equals(planId).toArray()).filter(alive).sort((a, b) => a.order - b.order)
}

/** Paste a list: one item per line, optionally "Módulo: ítem". */
export async function addItems(planId: string, text: string): Promise<number> {
  const parsed = parseItemList(text)
  const existing = await planItems(planId)
  const start = existing.length ? existing[existing.length - 1].order + 1 : 0
  await store.putMany(
    'planItems',
    parsed.map((p, i) => ({ id: newId(), planId, title: p.title, section: p.section, order: start + i, done: false })),
  )
  await ensureBaseline(planId)
  return parsed.length
}

export async function updateItem(id: string, changes: Partial<PlanItem>) {
  await store.patch('planItems', id, changes)
}

export async function deleteItem(id: string) {
  await store.softDelete('planItems', [id])
}

/** Mark done (default today) or undone. */
export async function setItemDone(id: string, done: boolean, date: ISODate = todayISO()) {
  await store.patch('planItems', id, done ? { done: true, doneDate: date } : { done: false, doneDate: undefined })
}

export async function reorderItems(planId: string, orderedIds: string[]) {
  const items = await planItems(planId)
  const pos = new Map(orderedIds.map((id, i) => [id, i]))
  const changed = items.filter((it) => pos.has(it.id) && pos.get(it.id) !== it.order)
  await store.putMany(
    'planItems',
    changed.map((it) => ({ ...it, order: pos.get(it.id)! })),
  )
}

/**
 * Fills baseline dates for items that don't have one yet (e.g. pasted after creating the plan),
 * without touching existing ones. No-op while `buildBaseline` is not implemented.
 */
export async function ensureBaseline(planId: string): Promise<'ok' | 'pending' | 'unchanged'> {
  const plan = await db.plans.get(planId)
  if (!alive(plan)) return 'unchanged'
  const items = await planItems(planId)
  const missing = items.filter((i) => !plan.baseline[i.id])
  if (!missing.length) return 'unchanged'
  const r = safeCall(() => buildBaseline(toScheduleItems(items), toScheduleConfig(plan)))
  if (!r.ok) return 'pending'
  const baseline = { ...plan.baseline }
  for (const it of missing) baseline[it.id] = r.value[it.id]
  await store.patch('plans', planId, { baseline })
  return 'ok'
}

/** "Replanificar desde hoy": the current projection becomes the new plan original. */
export async function replanFromToday(planId: string, today: ISODate = todayISO()): Promise<'ok' | 'pending'> {
  const plan = await db.plans.get(planId)
  if (!alive(plan)) return 'pending'
  const items = await planItems(planId)
  const r = safeCall(() => projectSchedule(toScheduleItems(items), toScheduleConfig(plan), today))
  if (!r.ok) return 'pending'
  await store.patch('plans', planId, { baseline: r.value })
  return 'ok'
}

/** Stores the latest projection so the server can include "Hoy toca…" in the reminder. */
export async function saveProjection(planId: string, dates: Record<string, ISODate>, today: ISODate) {
  const current = await db.projections.get(planId)
  if (current && current.computedOn === today && JSON.stringify(current.dates) === JSON.stringify(dates)) return
  await store.put('projections', { id: planId, planId, computedOn: today, dates })
}

// ─── Amount plans: daily log ────────────────────────────────────────────────

/** Sets how much was done on `date` (0 removes the day). One record per plan and day. */
export async function setPlanLog(planId: string, date: ISODate, amount: number) {
  const id = `${planId}|${date}`
  const value = Math.max(0, Math.round(amount * 100) / 100)
  if (value === 0) {
    if (await db.planLogs.get(id)) await store.softDelete('planLogs', [id])
    return
  }
  await store.put('planLogs', { id, planId, date, amount: value })
}

/** Adds `delta` (can be negative) to what was logged on `date`. */
export async function addToPlanLog(planId: string, date: ISODate, delta: number) {
  const current = await db.planLogs.get(`${planId}|${date}`)
  const base = current && !current.deletedAt ? current.amount : 0
  await setPlanLog(planId, date, base + delta)
}

// ─── Health (optional): weight & calories ───────────────────────────────────

/** One weigh-in per day; 0 or less removes it. */
export async function saveWeight(date: ISODate, kg: number) {
  if (!(kg > 0)) {
    if (await db.bodyWeights.get(date)) await store.softDelete('bodyWeights', [date])
    return
  }
  await store.put('bodyWeights', { id: date, date, kg: Math.round(kg * 10) / 10 })
}

export async function addFood(input: { date: ISODate; kcal: number; label?: string; meal?: Meal }) {
  return store.put('foodEntries', { id: newId(), ...input, kcal: Math.round(input.kcal) })
}

export async function deleteFood(id: string) {
  await store.softDelete('foodEntries', [id])
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export async function saveMilestone(input: Partial<Milestone> & Pick<Milestone, 'planId' | 'title' | 'from' | 'to'>) {
  const existing = input.id ? await db.milestones.get(input.id) : undefined
  return store.put('milestones', { done: false, ...existing, ...input, id: input.id ?? newId() } as Milestone)
}

export async function deleteMilestone(id: string) {
  await store.softDelete('milestones', [id])
}

// ─── Tasks (dictation) ──────────────────────────────────────────────────────

/** Parses dictated text into tasks for `date`. Returns how many were created. */
export async function addTasksFromText(date: ISODate, text: string): Promise<Task[]> {
  const parsed = parseDictation(text)
  const existing = (await db.tasks.where('date').equals(date).toArray()).filter(alive)
  const start = existing.reduce((m, t) => Math.max(m, t.order + 1), 0)
  return store.putMany(
    'tasks',
    parsed.map((p, i) => ({ id: newId(), date, time: p.time, title: p.title, done: false, order: start + i })),
  )
}

export async function updateTask(id: string, changes: Partial<Task>) {
  await store.patch('tasks', id, changes)
}

export async function deleteTask(id: string) {
  await store.softDelete('tasks', [id])
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('prefs')) ?? ({ ...DEFAULT_SETTINGS, updatedAt: '' } as Settings)
}

export async function updateSettings(changes: Partial<Settings>) {
  const current = await getSettings()
  await store.put('settings', { ...current, ...changes, id: 'prefs' })
}
