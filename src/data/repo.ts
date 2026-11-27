/**
 * Repository: the only API the UI uses to write data. Built on `store` (Dexie + outbox), so
 * every write is local-first and gets synced. Reads live in `hooks.ts` (live queries).
 */
import { todayISO, type ISODate } from '../domain/dates'
import { safeCall } from '../domain/errors'
import { parseItemList, toScheduleConfig, toScheduleItems } from '../domain/plans'
import { buildBaseline, projectSchedule } from '../domain/schedule'
import { parseDictation, tasksToCarry } from '../domain/tasks'
import { addDays } from '../domain/dates'
import { addPause, endPause } from '../domain/habits'
import { db } from './db'
import { newId, nowStamp, store } from './store'
import {
  DEFAULT_SETTINGS,
  type CustomFood,
  type FoodEntry,
  type FoodItem,
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

/** Pauses a habit from `from` (default today) until `to` (open-ended if missing). */
export async function pauseHabit(id: string, from: ISODate, to?: ISODate) {
  const h = await db.habits.get(id)
  if (!alive(h)) return
  await store.put('habits', { ...h, pauses: addPause(h.pauses, from, to) })
}

/** Ends the pause in effect on `today`. */
export async function resumeHabit(id: string, today: ISODate = todayISO()) {
  const h = await db.habits.get(id)
  if (!alive(h)) return
  await store.put('habits', { ...h, pauses: endPause(h.pauses, today) })
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
  /** Item plans: how many of the first items were already done before the plan. */
  priorCount?: number
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
  /** Name for that habit (the UI passes it translated); defaults to "Estudiar <name>". */
  habitName?: string
  itemsText?: string
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  const planId = newId()
  let linkedHabitId: string | undefined
  if (input.withHabit) {
    const h = await saveHabit({ name: input.habitName ?? `Estudiar ${input.name}`, emoji: '📚', startDate: input.startDate })
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
  if (input.itemsText?.trim()) await addItems(planId, input.itemsText, input.priorCount ?? 0)
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

/**
 * Paste a list: one item per line, optionally "Módulo: ítem".
 * `priorCount`: the first N new items were already done before the plan (they're not scheduled).
 */
export async function addItems(planId: string, text: string, priorCount = 0): Promise<number> {
  const parsed = parseItemList(text)
  const existing = await planItems(planId)
  const start = existing.length ? existing[existing.length - 1].order + 1 : 0
  await store.putMany(
    'planItems',
    parsed.map((p, i) => ({
      id: newId(),
      planId,
      title: p.title,
      section: p.section,
      order: start + i,
      ...(i < priorCount ? { done: true, prior: true } : { done: false }),
    })),
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

/** Mark done (default today) or undone. Undoing an item done before the plan brings it back into the plan. */
export async function setItemDone(id: string, done: boolean, date: ISODate = todayISO()) {
  await store.patch('planItems', id, done ? { done: true, doneDate: date, prior: false } : { done: false, doneDate: undefined, prior: false })
}

/**
 * "Ya hice hasta el ítem N": items 1…N (plan order) become done-before-the-plan, the rest that
 * were marked like that go back to pending, and the plan is re-planned from today so the
 * schedule starts at N + 1. Items done during the plan keep their dates.
 */
export async function setPriorUntil(planId: string, n: number, today: ISODate = todayISO()) {
  const items = await planItems(planId)
  const changed = items.flatMap((it, idx) => {
    // Pending items up to N become "done before the plan"; ones already done (before or during the plan) stay as they are.
    if (idx < n) return !it.done ? [{ ...it, done: true, doneDate: undefined, prior: true }] : []
    return it.prior ? [{ ...it, done: false, doneDate: undefined, prior: false }] : []
  })
  if (changed.length) await store.putMany('planItems', changed)
  return replanFromToday(planId, today)
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
  const missing = items.filter((i) => !i.prior && !plan.baseline[i.id])
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

export async function addFood(input: { date: ISODate; kcal: number; label?: string; meal?: Meal; items?: FoodItem[] }) {
  const items = input.items?.length ? input.items.map((i) => ({ ...i, kcal: Math.round(i.kcal) })) : undefined
  return store.put('foodEntries', { id: newId(), ...input, items, kcal: Math.round(input.kcal) })
}

/** Creates or updates a custom food ("Mis alimentos"). */
export async function saveCustomFood(input: Partial<CustomFood> & Pick<CustomFood, 'name'>) {
  const existing = input.id ? await db.customFoods.get(input.id) : undefined
  const clean = (n: number | undefined) => (n !== undefined && Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : undefined)
  return store.put('customFoods', {
    ...existing,
    id: input.id ?? newId(),
    name: input.name.trim(),
    kcal100: clean(input.kcal100),
    kcalPerUnit: clean(input.kcalPerUnit),
    unitGrams: input.unitGrams && input.unitGrams > 0 ? clean(input.unitGrams) : undefined,
  })
}

export async function deleteCustomFood(id: string) {
  await store.softDelete('customFoods', [id])
}

/** Edits a meal (text, kcal, meal of the day). */
export async function updateFood(id: string, changes: { kcal: number; label?: string; meal?: Meal; items?: FoodItem[] }) {
  const items = changes.items?.length ? changes.items.map((i) => ({ ...i, kcal: Math.round(i.kcal) })) : undefined
  await store.patch('foodEntries', id, { ...changes, items, kcal: Math.round(changes.kcal) })
}

/** Logs a copy of a past meal on `date`. */
export async function repeatFood(entry: FoodEntry, date: ISODate) {
  return addFood({ date, kcal: entry.kcal, label: entry.label, meal: entry.meal, items: entry.items })
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

/**
 * Parses dictated text into tasks. They go to `today` unless the text names a day
 * ("mañana", "el jueves", "el 15"). Returns the created tasks.
 */
export async function addTasksFromText(today: ISODate, text: string): Promise<Task[]> {
  const parsed = parseDictation(text, today)
  const next = new Map<ISODate, number>()
  const rows: Task[] = []
  for (const p of parsed) {
    const date = p.date ?? today
    if (!next.has(date)) {
      const existing = (await db.tasks.where('date').equals(date).toArray()).filter(alive)
      next.set(date, existing.reduce((m, t) => Math.max(m, t.order + 1), 0))
    }
    const order = next.get(date)!
    next.set(date, order + 1)
    rows.push({ id: newId(), date, time: p.time, title: p.title, done: false, order, updatedAt: '' })
  }
  return store.putMany('tasks', rows)
}

/**
 * Pending tasks of the last 7 days move to `today` (keeping the day they were first planned for).
 * Idempotent: two devices doing it at once write the same result.
 */
export async function carryOverTasks(today: ISODate = todayISO()): Promise<number> {
  const recent = await db.tasks.where('date').between(addDays(today, -7), today, true, false).toArray()
  const moving = tasksToCarry(recent, today)
  if (!moving.length) return 0
  const existing = (await db.tasks.where('date').equals(today).toArray()).filter(alive)
  const start = existing.reduce((m, t) => Math.max(m, t.order + 1), 0)
  await store.putMany(
    'tasks',
    moving
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
      .map((t, i) => ({ ...t, date: today, order: start + i, carriedFrom: t.carriedFrom ?? t.date })),
  )
  return moving.length
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
