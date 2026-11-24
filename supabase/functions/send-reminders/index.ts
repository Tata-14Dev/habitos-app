// Supabase Edge Function (Deno): sends the morning reminder and the Sunday weekly summary as
// Web Push notifications. Invoked every 5 minutes by pg_cron (see supabase/cron.example.sql)
// with header x-cron-secret. Manual tests: `?force=1` (morning) or `?force=weekly`.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {
  buildReminder,
  buildWeeklySummary,
  dueDate,
  localNow,
  weeklyDueDate,
  type ReminderData,
  type WeeklyData,
} from '../_shared/reminder.ts'

const COLLECTIONS = ['tasks', 'habits', 'plans', 'planItems', 'planLogs', 'projections', 'pushSubscriptions'] as const
/** Only read when the weekly summary is due (they can be long). */
const WEEKLY_COLLECTIONS = ['habitLogs', 'bodyWeights'] as const

type Sub = { id: string; endpoint: string; keys: { p256dh: string; auth: string } }

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const now = new Date()
  const force = new URL(req.url).searchParams.get('force') // '1' = morning, 'weekly' = summary

  const { data: settingsRows, error } = await sb
    .from('records')
    .select('user_id,data')
    .eq('collection', 'settings')
    .is('deleted_at', null)
  if (error) return new Response(error.message, { status: 500 })

  const { data: logRows } = await sb.from('reminder_log').select('user_id,last_sent_date,last_weekly_date')
  const log = new Map((logRows ?? []).map((r) => [r.user_id as string, r as { last_sent_date?: string; last_weekly_date?: string }]))

  const results: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) {
    const userId = row.user_id as string
    const settings = row.data as { reminderEnabled?: boolean; reminderTime?: string; timeZone?: string; weeklySummary?: boolean }
    const tz = settings.timeZone || 'America/Argentina/Buenos_Aires'
    const morning = force === '1' ? localNow(now, tz).date : force ? null : dueDate(now, settings, log.get(userId)?.last_sent_date)
    const weekly = force === 'weekly' ? localNow(now, tz).date : force ? null : weeklyDueDate(now, settings, log.get(userId)?.last_weekly_date)
    if (!morning && !weekly) continue

    const wanted = weekly ? [...COLLECTIONS, ...WEEKLY_COLLECTIONS] : [...COLLECTIONS]
    const { data: recs } = await sb
      .from('records')
      .select('collection,id,data')
      .eq('user_id', userId)
      .in('collection', wanted)
      .is('deleted_at', null)
    const by = (c: string) => (recs ?? []).filter((r) => r.collection === c).map((r) => r.data)
    const data = Object.fromEntries(wanted.map((c) => [c, by(c)])) as unknown as WeeklyData & { pushSubscriptions: Sub[] }

    const messages: { title: string; body: string; tag: string }[] = []
    if (morning) messages.push({ ...buildReminder(morning, data as ReminderData), tag: 'morning' })
    if (weekly) messages.push({ ...buildWeeklySummary(weekly, data), tag: 'weekly' })

    let sent = 0
    for (const msg of messages) {
      const payload = JSON.stringify({ title: msg.title, body: msg.body, url: '/' })
      for (const sub of data.pushSubscriptions) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 3600, urgency: 'high' })
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            // Subscription expired (app uninstalled / permission revoked): soft-delete so devices see it.
            const stamp = new Date().toISOString()
            await sb
              .from('records')
              .update({ deleted_at: stamp, updated_at: stamp, data: { ...sub, deletedAt: stamp, updatedAt: stamp } })
              .eq('user_id', userId)
              .eq('collection', 'pushSubscriptions')
              .eq('id', sub.id)
          }
        }
      }
    }
    if (!force) {
      await sb.from('reminder_log').upsert({
        user_id: userId,
        ...(morning ? { last_sent_date: morning } : {}),
        ...(weekly ? { last_weekly_date: weekly } : {}),
      })
    }
    results[userId] = { sent, subscriptions: data.pushSubscriptions.length, morning: !!morning, weekly: !!weekly }
  }
  return Response.json({ ok: true, results })
})
