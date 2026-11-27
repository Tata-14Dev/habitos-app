/**
 * Spreadsheet export: one CSV per area, with headers in the UI language. Spanish files use ";"
 * and a decimal comma so Excel in Argentina opens them in columns; English ones use ",".
 */
import { CSV_EN, CSV_ES, toCSV, type Cell } from '../domain/csv'
import { compareISO, eachDay, todayISO, type ISODate } from '../domain/dates'
import { buildAmountLookup, buildDoneLookup, dayRatio, isHabitActive, isHabitPaused, isHabitScheduled, isWeeklyGoal, linkedHabitDays, linkedHabitLogDays } from '../domain/habits'
import { db } from '../data/db'
import { downloadFile } from '../data/backup'
import { LANG, t } from './i18n'

export type CsvKind = 'habits' | 'plans' | 'tasks' | 'health'

const alive = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
const fmt = LANG === 'en' ? CSV_EN : CSV_ES

async function habitsRows(today: ISODate): Promise<Cell[][]> {
  const habits = alive(await db.habits.toArray()).sort((a, b) => a.order - b.order)
  const logs = alive(await db.habitLogs.toArray())
  const plans = alive(await db.plans.toArray())
  const items = alive(await db.planItems.toArray())
  const planLogs = alive(await db.planLogs.toArray())
  const derived: Record<string, Set<ISODate>> = {}
  for (const p of plans) {
    if (!p.linkedHabitId) continue
    derived[p.linkedHabitId] = p.kind === 'amount' ? linkedHabitLogDays(planLogs.filter((l) => l.planId === p.id)) : linkedHabitDays(items.filter((i) => i.planId === p.id))
  }
  const isDone = buildDoneLookup(logs, derived, habits)
  const amountOf = buildAmountLookup(logs)
  const header: Cell[] = [
    t('Fecha'),
    ...habits.map((h) => (h.goal?.type === 'amount' ? `${h.name} (${h.goal.unit})` : h.name)),
    t('% del día'),
  ]
  if (!habits.length) return [header]
  const first = habits.map((h) => h.startDate).sort(compareISO)[0]
  if (compareISO(first, today) > 0) return [header]
  const rows = eachDay(first, today).map((d) => {
    const cells = habits.map((h): Cell => {
      if (!isHabitActive(h, d)) return null
      if (isHabitPaused(h, d)) return '⏸'
      if (h.goal?.type === 'amount') return amountOf(h.id, d) || (isHabitScheduled(h, d) ? 0 : null)
      if (isWeeklyGoal(h)) return isDone(h.id, d) ? 1 : null
      return isHabitScheduled(h, d) ? isDone(h.id, d) : null
    })
    const r = dayRatio(habits, d, isDone)
    return [d, ...cells, r.pct === null ? null : Math.round(r.pct * 100)]
  })
  return [header, ...rows.reverse()]
}

async function plansRows(): Promise<Cell[][]> {
  const plans = alive(await db.plans.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const items = alive(await db.planItems.toArray())
  const logs = alive(await db.planLogs.toArray())
  const rows: Cell[][] = [[t('Plan'), t('Sección'), t('Ítem'), t('Cantidad'), t('Hecho'), t('Fecha'), t('Fecha del plan original')]]
  for (const p of plans) {
    if (p.kind === 'amount') {
      for (const l of logs.filter((x) => x.planId === p.id).sort((a, b) => compareISO(a.date, b.date))) {
        rows.push([p.name, null, null, l.amount, true, l.date, null])
      }
      continue
    }
    for (const i of items.filter((x) => x.planId === p.id).sort((a, b) => a.order - b.order)) {
      rows.push([p.name, i.section, i.title, 1, i.done, i.prior ? t('antes del plan') : i.doneDate, p.baseline[i.id]])
    }
  }
  return rows
}

async function tasksRows(): Promise<Cell[][]> {
  const tasks = alive(await db.tasks.toArray()).sort((a, b) => compareISO(b.date, a.date) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.order - b.order)
  return [[t('Fecha'), t('Hora'), t('Tarea'), t('Hecha'), t('Pasada desde')], ...tasks.map((x) => [x.date, x.time, x.title, x.done, x.carriedFrom])]
}

async function healthRows(): Promise<Cell[][]> {
  const weights = alive(await db.bodyWeights.toArray())
  const foods = alive(await db.foodEntries.toArray())
  const days = [...new Set([...weights.map((w) => w.date), ...foods.map((f) => f.date)])].sort((a, b) => compareISO(b, a))
  return [
    [t('Fecha'), t('Peso (kg)'), t('Calorías'), t('Comidas')],
    ...days.map((d) => {
      const eaten = foods.filter((f) => f.date === d)
      return [d, weights.find((w) => w.date === d)?.kg, eaten.length ? eaten.reduce((s, f) => s + f.kcal, 0) : null, eaten.map((f) => f.label ?? `${f.kcal} kcal`).join(' | ')]
    }),
  ]
}

const NAMES: Record<CsvKind, string> = { habits: t('habitos'), plans: t('planes'), tasks: t('tareas'), health: t('salud') }

/** Builds and downloads one CSV. Returns the number of data rows. */
export async function downloadCsv(kind: CsvKind): Promise<number> {
  const today = todayISO()
  const rows = kind === 'habits' ? await habitsRows(today) : kind === 'plans' ? await plansRows() : kind === 'tasks' ? await tasksRows() : await healthRows()
  downloadFile(`${NAMES[kind]}-${today}.csv`, toCSV(rows, fmt), 'text/csv;charset=utf-8')
  return rows.length - 1
}
