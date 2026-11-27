/** One habit in depth: streaks, consistency over time, a 12-month calendar and its own charts. */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SimpleBars } from '../../charts/SimpleBars'
import { addDays, yearMonth } from '../../domain/dates'
import {
  buildAmountLookup,
  buildDoneLookup,
  dailyAmountGoal,
  formatPct,
  habitStreaks,
  isOneOff,
  isWeeklyGoal,
  monthStats,
  weeklyStreaks,
  type HabitLike,
} from '../../domain/habits'
import { formatAmount } from '../../domain/progress'
import { consistency, dailySeries, streakRuns, weekdayRatios, weeklySeries } from '../../domain/stats'
import { Button, Card, Empty, SectionTitle, Sheet } from '../components'
import { fmtDate, WEEKDAY_NAMES } from '../format'
import { habitSummary } from '../habitText'
import { useAllHabitLogs, useHabits, useLinkedHabitDays, useSettings, useToday } from '../hooks'
import { t, tn } from '../i18n'
import { useChartColors } from '../palette'
import { HabitForm } from './HabitsScreen'
import { Delta } from './StatsScreen'
import { MiniMonth } from './YearScreen'

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-paper p-3 dark:bg-neutral-900">
      <dt className="text-xs text-ink-soft dark:text-neutral-400">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-soft dark:text-neutral-400">{sub}</dd>}
    </div>
  )
}

export function HabitDetailScreen() {
  const { id } = useParams()
  const today = useToday()
  const habits = useHabits()
  const logs = useAllHabitLogs()
  const linked = useLinkedHabitDays()
  const { weekStartsMonday } = useSettings()
  const ramp = useChartColors().ramp
  const [editing, setEditing] = useState(false)

  const habit = habits?.find((h) => h.id === id)
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linked ?? {}, habits ?? []), [logs, linked, habits])
  const amountOf = useMemo(() => buildAmountLookup(logs ?? []), [logs])

  if (!habits || !logs) return <Empty>{t('Cargando…')}</Empty>
  if (!habit) return <Empty>{t('Este hábito no existe.')}</Empty>

  const weekly = isWeeklyGoal(habit)
  const goal = habit.goal
  const amountUnit = goal?.type === 'amount' ? goal.unit : undefined
  const streaks = weekly ? weeklyStreaks(habit, logs, today, weekStartsMonday) : habitStreaks(habit, isDone, today)
  const unit = (n: number) => (weekly ? tn(n, '1 semana', '{n} semanas') : tn(n, '1 día', '{n} días'))
  const c30 = consistency(habit, isDone, logs, today, weekStartsMonday, 30)
  const c90 = consistency(habit, isDone, logs, today, weekStartsMonday, 90)
  const runs = weekly || isOneOff(habit) ? [] : streakRuns(habit, isDone, today).slice(0, 5)

  // Calendar: for weekly goals, show the days it was done (as if it were daily).
  const calHabit: HabitLike = weekly ? { ...habit, kind: 'fixed', goal: undefined } : habit
  const { year, month } = yearMonth(today)
  const months = Array.from({ length: 12 }, (_, i) => {
    const m0 = month - 1 - (11 - i)
    const y = year + Math.floor(m0 / 12)
    const m = ((m0 % 12) + 12) % 12
    return monthStats([calHabit], y, m + 1, isDone, today)
  }).filter((s) => s.days[s.days.length - 1].date >= habit.startDate)

  const order = weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
  const byWeekday = weekly ? null : weekdayRatios([habit], isDone, addDays(today, -89), today, today)
  const dailyTarget = dailyAmountGoal(habit)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2 pt-2">
        <div className="min-w-0">
          <Link to="/habitos/estadisticas" className="text-sm underline">
            {t('← Estadísticas')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {/* The emoji stays outside the gradient: background-clip would paint it as a flat silhouette. */}
            {habit.emoji && <span className="mr-1">{habit.emoji}</span>}
            <span className="text-brand inline-block">{habit.name}</span>
          </h1>
          <p className="text-sm text-ink-soft dark:text-neutral-400">
            {habitSummary(habit)} · {t('desde {date}', { date: fmtDate(habit.startDate) })}
          </p>
        </div>
        <Button onClick={() => setEditing(true)}>{t('Editar')}</Button>
      </header>

      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label={t('Racha actual')} value={`🔥 ${unit(streaks.current)}`} />
          <Stat label={t('Mejor racha')} value={unit(streaks.best)} />
          <Stat label={t('Últimos 30 días')} value={formatPct(c30.current)} sub={<Delta pts={c30.delta} />} />
          <Stat label={t('Últimos 90 días')} value={formatPct(c90.current)} />
        </dl>
      </Card>

      {goal?.type === 'amount' && (
        <Card>
          <SectionTitle>{weekly ? t('Por semana · últimas 12') : t('Por día · últimos 30')}</SectionTitle>
          <SimpleBars
            data={(weekly
              ? weeklySeries((d) => amountOf(habit.id, d), today, 12, weekStartsMonday)
              : dailySeries((d) => amountOf(habit.id, d), today, 30)
            ).map((b) => ({ label: fmtDate(b.date, false), value: b.value }))}
            format={(v) => formatAmount(v)}
            target={weekly ? goal.target : dailyTarget}
            targetLabel={t('Meta: {n}', { n: formatAmount(goal.target, amountUnit) })}
          />
        </Card>
      )}

      {goal?.type === 'times' && (
        <Card>
          <SectionTitle>{t('Veces por semana · últimas 12')}</SectionTitle>
          <SimpleBars
            data={weeklySeries((d) => (isDone(habit.id, d) ? 1 : 0), today, 12, weekStartsMonday).map((b) => ({
              label: fmtDate(b.date, false),
              value: b.value,
            }))}
            format={(v) => String(v)}
            target={goal.target}
            targetLabel={t('Meta: {n}', { n: goal.target })}
          />
        </Card>
      )}

      {byWeekday && byWeekday.some((r) => r.total > 0) && (
        <Card>
          <SectionTitle>{t('Días de la semana · últimos 90 días')}</SectionTitle>
          <SimpleBars
            data={order.filter((d) => byWeekday[d].total > 0).map((d) => ({ label: WEEKDAY_NAMES[d].slice(0, 3), value: byWeekday[d].pct }))}
            format={(v) => `${Math.round(v * 100)}%`}
            max={1}
          />
        </Card>
      )}

      <Card>
        <SectionTitle>{t('Calendario')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {months.map((m) => (
            <MiniMonth key={`${m.year}-${m.month}`} stats={m} mondayFirst={weekStartsMonday} ramp={ramp} today={today} />
          ))}
        </div>
      </Card>

      {runs.length > 0 && (
        <Card>
          <SectionTitle>{t('Mejores rachas')}</SectionTitle>
          <ol className="divide-y divide-line dark:divide-neutral-700">
            {runs.map((r, i) => (
              <li key={r.from} className="flex items-baseline justify-between py-2">
                <span>
                  <span className="mr-2 text-ink-soft dark:text-neutral-400">{i + 1}.</span>
                  {unit(r.length)}
                </span>
                <span className="text-sm text-ink-soft dark:text-neutral-400">
                  {fmtDate(r.from, false)} → {fmtDate(r.to, false)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title={t('Editar hábito')}>
        {editing && <HabitForm habit={habit} onDone={() => setEditing(false)} />}
      </Sheet>
    </div>
  )
}
