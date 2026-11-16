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
  habits: (Alive & { id: string; name: string; startDate: ISODate; endDate?: ISODate })[]
  plans: (Alive & { id: string; name: string })[]
  planItems: (Alive & { id: string; planId: string; title: string; done: boolean })[]
  projections: (Alive & { planId: string; dates: Record<string, ISODate> })[]
}

/** "Buen día ☀️" + a short summary of what's on today. */
export function buildReminder(date: ISODate, d: ReminderData): { title: string; body: string } {
  const live = <T extends Alive>(xs: T[]) => xs.filter((x) => !x.deletedAt)

  const tasks = live(d.tasks)
    .filter((t) => t.date === date && !t.done)
    .sort((a, b) => (a.time && b.time ? a.time.localeCompare(b.time) : a.time ? -1 : b.time ? 1 : 0))
  const habits = live(d.habits).filter((h) => h.startDate <= date && (!h.endDate || date <= h.endDate))

  const lines: string[] = []
  if (tasks.length) {
    const shown = tasks.slice(0, 3).map((t) => (t.time ? `${t.time} ${t.title}` : t.title))
    lines.push(`📝 ${shown.join(' · ')}${tasks.length > 3 ? ` (+${tasks.length - 3})` : ''}`)
  }
  for (const plan of live(d.plans)) {
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
