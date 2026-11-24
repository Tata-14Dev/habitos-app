/**
 * Pure logic for the morning reminder (no Deno/Node APIs, so Vitest can test it and the
 * Edge Function can import it).
 */

type ISODate = string

/** Local date ('YYYY-MM-DD') and time ('HH:MM') of an instant in a time zone. */
export function localNow(now: Date, timeZone: string): { date: ISODate; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** How late a reminder may still be sent (cron hiccups, function cold starts). */
export const SEND_WINDOW_MIN = 60

/**
 * Due if local time is within [reminderTime, reminderTime + window) and we haven't sent today.
 * Returns the local date to record as "sent", or null.
 */
export function dueDate(
  now: Date,
  settings: { reminderEnabled?: boolean; reminderTime?: string; timeZone?: string },
  lastSentDate: ISODate | undefined,
): ISODate | null {
  if (!settings.reminderEnabled || !settings.reminderTime) return null
  const { date, time } = localNow(now, settings.timeZone || 'America/Argentina/Buenos_Aires')
  if (lastSentDate === date) return null
  const delta = toMin(time) - toMin(settings.reminderTime)
  return delta >= 0 && delta < SEND_WINDOW_MIN ? date : null
}

interface Alive {
  deletedAt?: string
}
export interface ReminderData {
  tasks: (Alive & { date: ISODate; time?: string; title: string; done: boolean })[]
  habits: (Alive & {
    id: string
    name: string
    startDate: ISODate
    endDate?: ISODate
    kind?: 'fixed' | 'scheduled' | 'progress'
    onDate?: ISODate
    weekdays?: number[]
    goal?: { type: 'amount'; period: 'day' | 'week'; target?: number; unit?: string } | { type: 'times'; target?: number }
  })[]
  plans: (Alive & {
    id: string
    name: string
    kind?: 'items' | 'amount'
    unit?: string
    target?: number
    pace?: number
    startDate?: ISODate
    restWeekdays?: number[]
    blockedDates?: ISODate[]
  })[]
  planItems: (Alive & { id: string; planId: string; title: string; done: boolean; order?: number; doneDate?: ISODate; prior?: boolean })[]
  projections: (Alive & { planId: string; dates: Record<string, ISODate> })[]
  /** Amount plans: progress per day. Optional so older callers keep working. */
  planLogs?: (Alive & { planId: string; date: ISODate; amount: number })[]
}

/** Weekday (0 = Sunday) of a 'YYYY-MM-DD' date, independent of the server's time zone. */
function weekdayOf(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Same rule as isHabitScheduled in src/domain/habits.ts (kept dependency-free for Deno). */
export function habitDueOn(h: ReminderData['habits'][number], date: ISODate): boolean {
  if (h.startDate > date || (h.endDate && date > h.endDate)) return false
  if (h.kind === 'scheduled') return h.onDate ? h.onDate === date : (h.weekdays ?? []).includes(weekdayOf(date))
  if (h.kind === 'progress') return !!h.goal && h.goal.type === 'amount' && h.goal.period === 'day'
  return true
}

/** Amount plan: what's left of today's quota (0 if not a study day, not started, or finished). */
export function amountDueToday(
  plan: ReminderData['plans'][number],
  logs: { date: ISODate; amount: number }[],
  date: ISODate,
): number {
  const pace = plan.pace ?? 0
  if (pace <= 0 || !plan.target) return 0
  if (plan.startDate && date < plan.startDate) return 0
  if ((plan.restWeekdays ?? []).includes(weekdayOf(date)) || (plan.blockedDates ?? []).includes(date)) return 0
  const done = logs.reduce((s, l) => s + l.amount, 0)
  const doneToday = logs.filter((l) => l.date === date).reduce((s, l) => s + l.amount, 0)
  const due = Math.min(pace - doneToday, plan.target - done)
  return due > 1e-9 ? Math.round(due * 100) / 100 : 0
}

/** "Buen día ☀️" + a short summary of what's on today. */
export function buildReminder(date: ISODate, d: ReminderData): { title: string; body: string } {
  const live = <T extends Alive>(xs: T[]) => xs.filter((x) => !x.deletedAt)

  const tasks = live(d.tasks)
    .filter((t) => t.date === date && !t.done)
    .sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0))
  const habits = live(d.habits).filter((h) => habitDueOn(h, date))

  const lines: string[] = []
  if (tasks.length) {
    const shown = tasks.slice(0, 3).map((t) => (t.time ? `${t.time} ${t.title}` : t.title))
    lines.push(`📝 ${shown.join(' · ')}${tasks.length > 3 ? ` (+${tasks.length - 3})` : ''}`)
  }
  for (const plan of live(d.plans)) {
    if (plan.kind === 'amount') {
      const due = amountDueToday(plan, live(d.planLogs ?? []).filter((l) => l.planId === plan.id), date)
      if (due > 0) lines.push(`📚 ${plan.name}: hoy tocan ${String(due).replace('.', ',')}${plan.unit ? ` ${plan.unit}` : ''}`)
      continue
    }
    const proj = live(d.projections).find((p) => p.planId === plan.id)
    if (!proj) continue
    const today = live(d.planItems).filter((i) => i.planId === plan.id && !i.done && proj.dates[i.id] === date)
    if (today.length) lines.push(`📚 ${plan.name}: ${today.map((i) => i.title).join(', ')}`)
  }
  if (habits.length) lines.push(`✅ ${habits.length} ${habits.length === 1 ? 'hábito' : 'hábitos'} para hoy`)

  return {
    title: 'Buen día ☀️',
    body: lines.length ? lines.join('\n') : 'Hoy no tenés nada cargado. ¿Dictás tu día?',
  }
}

// ─── Weekly summary (Sundays) ───────────────────────────────────────────────

/** Local time the weekly summary goes out on Sundays. */
export const WEEKLY_TIME = '20:00'

function addDaysISO(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/**
 * Due on Sundays within [20:00, 21:00) local time, once per Sunday. On by default for anyone
 * who turned the morning reminder on; `weeklySummary: false` turns it off.
 */
export function weeklyDueDate(
  now: Date,
  settings: { reminderEnabled?: boolean; weeklySummary?: boolean; timeZone?: string },
  lastWeeklyDate: ISODate | undefined,
): ISODate | null {
  const on = settings.weeklySummary ?? settings.reminderEnabled ?? false
  if (!on) return null
  const { date, time } = localNow(now, settings.timeZone || 'America/Argentina/Buenos_Aires')
  if (weekdayOf(date) !== 0 || lastWeeklyDate === date) return null
  const delta = toMin(time) - toMin(WEEKLY_TIME)
  return delta >= 0 && delta < SEND_WINDOW_MIN ? date : null
}

export interface WeeklyData extends ReminderData {
  habitLogs: (Alive & { habitId: string; date: ISODate; done: boolean; amount?: number })[]
  bodyWeights?: (Alive & { date: ISODate; kg: number })[]
}

const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** % of due habits done over [from, to] (same rule as the app's daily percentage). */
function habitsPct(d: WeeklyData, from: ISODate, to: ISODate): number | null {
  const habits = d.habits.filter((h) => !h.deletedAt)
  const logs = new Map(d.habitLogs.filter((l) => !l.deletedAt).map((l) => [`${l.habitId}|${l.date}`, l]))
  let due = 0
  let done = 0
  for (let day = from; day <= to; day = addDaysISO(day, 1)) {
    for (const h of habits) {
      if (!habitDueOn(h, day)) continue
      due++
      const log = logs.get(`${h.id}|${day}`)
      const target = h.goal?.type === 'amount' && h.goal.period === 'day' ? h.goal.target : undefined
      if (log && (target !== undefined ? (log.amount ?? 0) >= target : log.done)) done++
    }
  }
  return due ? Math.round((done / due) * 100) : null
}

/** "Tu semana 📊": habits % vs last week, progress per plan, weight change. `date` is the Sunday. */
export function buildWeeklySummary(date: ISODate, d: WeeklyData): { title: string; body: string } {
  const from = addDaysISO(date, -6)
  const prevFrom = addDaysISO(date, -13)
  const prevTo = addDaysISO(date, -7)
  const lines: string[] = []

  const pct = habitsPct(d, from, date)
  const prev = habitsPct(d, prevFrom, prevTo)
  if (pct !== null) {
    const arrow = prev === null ? '' : pct > prev ? ' ↑' : pct < prev ? ' ↓' : ''
    lines.push(`✅ Hábitos: ${pct}%${prev !== null ? ` (la anterior: ${prev}%)${arrow}` : ''}`)
  }

  for (const plan of d.plans.filter((p) => !p.deletedAt)) {
    if (plan.kind === 'amount') {
      const sum = (d.planLogs ?? []).filter((l) => !l.deletedAt && l.planId === plan.id && l.date >= from && l.date <= date).reduce((s, l) => s + l.amount, 0)
      if (sum > 0) lines.push(`📚 ${plan.name}: ${fmt1(sum)}${plan.unit ? ` ${plan.unit}` : ''} esta semana`)
      continue
    }
    const items = d.planItems.filter((i) => !i.deletedAt && i.planId === plan.id)
    const n = items.filter((i) => i.done && !i.prior && i.doneDate && i.doneDate >= from && i.doneDate <= date).length
    const cur = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).find((i) => !i.done)
    if (n > 0 || cur) lines.push(`📚 ${plan.name}: ${n} esta semana${cur ? ` · vas por ${cur.title}` : ' · ¡terminado!'}`)
  }

  const w = (d.bodyWeights ?? []).filter((x) => !x.deletedAt)
  const avg = (a: ISODate, b: ISODate) => {
    const xs = w.filter((x) => x.date >= a && x.date <= b)
    return xs.length ? xs.reduce((s, x) => s + x.kg, 0) / xs.length : null
  }
  const wNow = avg(from, date)
  const wPrev = avg(prevFrom, prevTo)
  if (wNow !== null && wPrev !== null) {
    const diff = Math.round((wNow - wPrev) * 10) / 10
    lines.push(`⚖️ Peso: ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmt1(Math.abs(diff))} kg vs la semana anterior`)
  }

  return { title: 'Tu semana 📊', body: lines.length ? lines.join('\n') : 'Semana tranquila. ¿Arrancamos la próxima con todo?' }
}
