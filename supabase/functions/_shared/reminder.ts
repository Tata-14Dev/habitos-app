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
    goal?: { type: 'amount'; period: 'day' | 'week' } | { type: 'times' }
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
  planItems: (Alive & { id: string; planId: string; title: string; done: boolean })[]
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
