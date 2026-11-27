/** Achievements ("Logros"): the grid in Estadísticas and the "new achievement" card in Hoy. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { computeAchievements, latestAchievement, type Achievement, type AchievementId } from '../domain/achievements'
import type { ISODate } from '../domain/dates'
import { buildDoneLookup, mentalState } from '../domain/habits'
import { db } from '../data/db'
import { Card, cx, ProgressBar, SectionTitle } from './components'
import { fmtDate } from './format'
import { useAllHabitLogs, useAllPlanItems, useBodyWeights, useHabits, useLinkedHabitDays, usePlans, useSettings } from './hooks'
import { t } from './i18n'

export const ACHIEVEMENT_TEXT: Record<AchievementId, { emoji: string; title: string; desc: string }> = {
  'first-habit': { emoji: '🌱', title: t('Primer paso'), desc: t('Cumpliste tu primer hábito.') },
  'perfect-day': { emoji: '⭐', title: t('Día perfecto'), desc: t('Todos los hábitos del día (al menos 2).') },
  'streak-7': { emoji: '🔥', title: t('Una semana seguida'), desc: t('Racha de 7 días en un hábito.') },
  'perfect-week': { emoji: '🌟', title: t('Semana perfecta'), desc: t('7 días perfectos seguidos.') },
  'streak-30': { emoji: '💪', title: t('Un mes seguido'), desc: t('Racha de 30 días en un hábito.') },
  'habits-100': { emoji: '💯', title: t('Cien'), desc: t('100 hábitos cumplidos en total.') },
  'weekly-4': { emoji: '📆', title: t('Mes de metas'), desc: t('Una meta semanal cumplida 4 semanas seguidas.') },
  'plan-done': { emoji: '🎓', title: t('Plan terminado'), desc: t('Terminaste un plan.') },
  'plan-on-time': { emoji: '⏱️', title: t('A tiempo'), desc: t('Terminaste un plan antes de su fecha límite.') },
  'mood-30': { emoji: '🧠', title: t('Me conozco'), desc: t('Registraste tu ánimo 30 días.') },
  'streak-100': { emoji: '🏆', title: t('Imparable'), desc: t('Racha de 100 días en un hábito.') },
  'habits-500': { emoji: '🚀', title: t('Quinientos'), desc: t('500 hábitos cumplidos en total.') },
  'weigh-10': { emoji: '⚖️', title: t('Constancia en la balanza'), desc: t('10 pesajes registrados.') },
}

/** Every achievement, from all the local data (undefined while loading). */
export function useAchievements(today: ISODate): Achievement[] | undefined {
  const habits = useHabits()
  const logs = useAllHabitLogs()
  const linked = useLinkedHabitDays()
  const plans = usePlans()
  const items = useAllPlanItems()
  const planLogs = useLiveQuery(async () => (await db.planLogs.toArray()).filter((l) => !l.deletedAt), [])
  const moods = useLiveQuery(async () => (await db.dayMoods.toArray()).filter((m) => !m.deletedAt), [])
  const weights = useBodyWeights()
  const { weekStartsMonday, healthEnabled } = useSettings()
  return useMemo(() => {
    if (!habits || !logs || !linked || !plans || !items || !planLogs || !moods || !weights) return undefined
    const list = computeAchievements({
      habits,
      isDone: buildDoneLookup(logs, linked, habits),
      habitLogs: logs,
      plans,
      planItems: items,
      planLogs,
      moodDays: moods.filter((m) => mentalState(m) !== null).map((m) => m.date),
      weightDays: weights.map((w) => w.date),
      today,
      mondayFirst: weekStartsMonday,
    })
    return list.filter((a) => !a.health || healthEnabled)
  }, [habits, logs, linked, plans, items, planLogs, moods, weights, today, weekStartsMonday, healthEnabled])
}

function progressText(a: Achievement): string {
  return a.id === 'plan-done' || a.id === 'plan-on-time' ? `${a.value}%` : `${a.value}/${a.target}`
}

/** Grid of badges: reached ones in color with their date, the rest faded with their progress. */
export function AchievementsCard({ today }: { today: ISODate }) {
  const list = useAchievements(today)
  if (!list) return null
  const reached = list.filter((a) => a.achievedOn).length
  return (
    <Card>
      <SectionTitle right={<span className="text-sm font-semibold">{t('{n} de {total}', { n: reached, total: list.length })}</span>}>{t('Logros')}</SectionTitle>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((a) => {
          const txt = ACHIEVEMENT_TEXT[a.id]
          const done = !!a.achievedOn
          return (
            <li
              key={a.id}
              className={cx('rounded-xl p-3', done ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-paper dark:bg-neutral-900')}
              aria-label={`${txt.title}: ${done ? t('logrado el {date}', { date: fmtDate(a.achievedOn!) }) : progressText(a)}`}
            >
              <div className={cx('text-2xl', !done && 'opacity-40 grayscale')} aria-hidden>
                {txt.emoji}
              </div>
              <p className="mt-1 text-sm font-semibold leading-tight">{txt.title}</p>
              <p className="text-xs text-ink-soft dark:text-neutral-400">{txt.desc}</p>
              {done ? (
                <p className="mt-1 text-xs font-medium">✓ {fmtDate(a.achievedOn!)}</p>
              ) : (
                <div className="mt-2">
                  <ProgressBar value={a.value / a.target} />
                  <p className="mt-0.5 text-right text-xs text-ink-soft dark:text-neutral-400">{progressText(a)}</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const SEEN_KEY = 'habitos.achievementsSeen'

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** "🏆 Nuevo logro" in Hoy: the newest one of the last 7 days, until it's dismissed on this device. */
export function NewAchievementCard({ today }: { today: ISODate }) {
  const list = useAchievements(today)
  const [seen, setSeen] = useState(readSeen)
  const latest = list ? latestAchievement(list, today) : null
  if (!latest || seen.includes(latest.id)) return null
  const txt = ACHIEVEMENT_TEXT[latest.id]
  const dismiss = () => {
    const next = [...seen, latest.id]
    setSeen(next)
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next))
    } catch {
      // Private mode: it just shows up again next time.
    }
  }
  return (
    <Card className="flex items-center gap-3 ring-1 ring-primary/40">
      <span className="text-3xl" aria-hidden>
        {txt.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft dark:text-neutral-400">{t('🏆 Nuevo logro')}</p>
        <p className="font-semibold">{txt.title}</p>
        <p className="text-sm text-ink-soft dark:text-neutral-400">{txt.desc}</p>
      </div>
      <button className="px-2 text-ink-soft dark:text-neutral-400" aria-label={t('Cerrar')} onClick={dismiss}>
        ✕
      </button>
    </Card>
  )
}
