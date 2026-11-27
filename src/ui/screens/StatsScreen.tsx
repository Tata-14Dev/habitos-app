/** "Estadísticas": consistency per habit, weekday pattern, mood vs habits, and the pace of each plan. */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SimpleBars } from '../../charts/SimpleBars'
import { addDays } from '../../domain/dates'
import { buildDoneLookup, formatPct, isOneOff, isWeeklyGoal } from '../../domain/habits'
import { fmtDecimal } from '../../domain/numberFormat'
import { consistency, moodByCompletion, weekdayRatios } from '../../domain/stats'
import { Card, Empty, ProgressBar, SectionTitle } from '../components'
import { WEEKDAY_NAMES } from '../format'
import { useAllHabitLogs, useDayMoods, useHabits, useLinkedHabitDays, usePlans, useSettings, useToday } from '../hooks'
import { t, tn } from '../i18n'
import { PlanPaceRow } from './PlanPace'
import { AchievementsCard } from '../achievements'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-paper p-3 dark:bg-neutral-900">
      <dt className="text-xs text-ink-soft dark:text-neutral-400">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-soft dark:text-neutral-400">{sub}</dd>}
    </div>
  )
}

/** "▲ 12" / "▼ 5" / "= 0" in percentage points; arrows + text, never color alone. */
export function Delta({ pts }: { pts: number | null }) {
  if (pts === null) return null
  const label = pts > 0 ? t('{n} puntos más que los 30 días anteriores', { n: pts }) : pts < 0 ? t('{n} puntos menos que los 30 días anteriores', { n: -pts }) : t('Igual que los 30 días anteriores')
  return (
    <span className="text-xs text-ink-soft dark:text-neutral-400" title={label} aria-label={label}>
      {pts > 0 ? `▲ ${pts}` : pts < 0 ? `▼ ${-pts}` : '='}
    </span>
  )
}

export function StatsScreen() {
  const today = useToday()
  const habits = useHabits()
  const logs = useAllHabitLogs()
  const linked = useLinkedHabitDays()
  const plans = usePlans()
  const { weekStartsMonday } = useSettings()
  const from90 = addDays(today, -89)
  const moods = useDayMoods(from90, today)

  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linked ?? {}, habits ?? []), [logs, linked, habits])

  const rows = useMemo(
    () =>
      (habits ?? [])
        .filter((h) => !isOneOff(h) && h.startDate <= today)
        .map((h) => ({ h, c: consistency(h, isDone, logs ?? [], today, weekStartsMonday) }))
        .sort((a, b) => (b.c.current.pct ?? -1) - (a.c.current.pct ?? -1)),
    [habits, isDone, logs, today, weekStartsMonday],
  )
  const order = weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
  const byWeekday = useMemo(
    () => weekdayRatios((habits ?? []).filter((h) => !isWeeklyGoal(h)), isDone, from90, today, today),
    [habits, isDone, from90, today],
  )
  const mood = useMemo(() => moodByCompletion(habits ?? [], isDone, moods ?? [], from90, today), [habits, isDone, moods, from90, today])

  if (!habits || !logs || !plans || !moods) return <Empty>{t('Cargando…')}</Empty>

  const measured = order.filter((d) => byWeekday[d].pct !== null)
  const best = measured.length ? measured.reduce((a, b) => (byWeekday[b].pct! > byWeekday[a].pct! ? b : a)) : null
  const worst = measured.length ? measured.reduce((a, b) => (byWeekday[b].pct! < byWeekday[a].pct! ? b : a)) : null
  const enoughMood = mood.highDays >= 3 && mood.lowDays >= 3 && mood.high !== null && mood.low !== null
  const moodDiff = enoughMood ? Math.round((mood.high! - mood.low!) * 10) / 10 : null

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-semibold text-brand">{t('Estadísticas')}</h1>
        <Link to="/habitos" className="text-sm underline">
          {t('← Hábitos')}
        </Link>
      </header>

      <Card>
        <SectionTitle>{t('Constancia · últimos 30 días')}</SectionTitle>
        {rows.length === 0 ? (
          <Empty>{t('Todavía no hay hábitos para medir.')}</Empty>
        ) : (
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {rows.map(({ h, c }) => (
              <li key={h.id}>
                <Link to={`/habitos/h/${h.id}`} className="block py-3">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {h.emoji && <span className="mr-1">{h.emoji}</span>}
                      {h.name}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <Delta pts={c.delta} />
                      <span className="font-semibold">{formatPct(c.current)}</span>
                    </span>
                  </div>
                  <ProgressBar value={c.current.pct} />
                  <span className="mt-1 block text-xs text-ink-soft dark:text-neutral-400">
                    {c.unit === 'weeks'
                      ? t('{done} de {total} semanas cumplidas', { done: c.current.done, total: c.current.total })
                      : t('{done} de {total} días', { done: c.current.done, total: c.current.total })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('Días de la semana · últimos 90 días')}</SectionTitle>
        {best === null || worst === null ? (
          <Empty>{t('Todavía no hay datos.')}</Empty>
        ) : (
          <>
            <p className="mb-3 text-sm">
              {t('Tu mejor día: {best} ({bp}). El más flojo: {worst} ({wp}).', {
                best: WEEKDAY_NAMES[best].toLowerCase(),
                bp: formatPct(byWeekday[best]),
                worst: WEEKDAY_NAMES[worst].toLowerCase(),
                wp: formatPct(byWeekday[worst]),
              })}
            </p>
            <SimpleBars
              data={order.map((d) => ({ label: WEEKDAY_NAMES[d].slice(0, 3), value: byWeekday[d].pct }))}
              format={(v) => `${Math.round(v * 100)}%`}
              max={1}
            />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('Ánimo y hábitos · últimos 90 días')}</SectionTitle>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat
            label={t('Días en que cumplís 80% o más')}
            value={mood.high === null ? '—' : fmtDecimal(mood.high)}
            sub={tn(mood.highDays, '1 día', '{n} días')}
          />
          <Stat label={t('Resto de los días')} value={mood.low === null ? '—' : fmtDecimal(mood.low)} sub={tn(mood.lowDays, '1 día', '{n} días')} />
        </dl>
        <p className="mt-3 text-sm text-ink-soft dark:text-neutral-400">
          {moodDiff === null
            ? t('Registrá tu ánimo en Hoy unos días más para comparar (hacen falta 3 de cada tipo).')
            : moodDiff > 0
              ? t('Los días que cumplís tus hábitos, tu estado mental es {n} puntos más alto.', { n: fmtDecimal(moodDiff) })
              : moodDiff < 0
                ? t('Curioso: los días que cumplís, tu estado mental es {n} puntos más bajo.', { n: fmtDecimal(-moodDiff) })
                : t('Tu estado mental es igual los días que cumplís y los que no.')}
        </p>
      </Card>

      <AchievementsCard today={today} />

      {plans.length > 0 && (
        <Card>
          <SectionTitle>{t('Planes · ritmo semanal')}</SectionTitle>
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {plans.map((p) => (
              <PlanPaceRow key={p.id} plan={p} today={today} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
