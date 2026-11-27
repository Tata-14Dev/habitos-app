import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, weekStart } from '../../domain/dates'
import { buildDoneLookup, currentPause, dayRatio, formatPct, isHabitPaused, isHabitScheduled, isWeeklyGoal, mentalState } from '../../domain/habits'
import { formatTask, parseDictation, sortTasks } from '../../domain/tasks'
import { addTasksFromText, carryOverTasks, deleteTask, setItemDone, setMood, updateTask } from '../../data/repo'
import type { Plan, PlanItem, Task } from '../../data/types'
import { Button, Card, Check, cx, Empty, inputCls, PendingNotice, ProgressBar, Scale, SectionTitle } from '../components'
import { fmtDate, longDay, marginText, relativeDay } from '../format'
import { useDayMoods, useHabitLogs, useHabits, usePlanItems, usePlans, useSettings, useTasks, useToday, useLinkedHabitDays, useUpcomingTasks } from '../hooks'
import { NewAchievementCard } from '../achievements'
import { t, tn } from '../i18n'
import { usePlanModel } from '../usePlanModel'
import { AmountToday } from './AmountPlan'
import { TodayHabitList, WeeklyGoalList } from './HabitWidgets'
import { CurrentLine } from './CurrentLine'
import { DEMO, enterDemo } from '../../data/demoFlag'
import { fmtFixed } from '../../domain/numberFormat'

// Only loaded when health tracking is on (it pulls the food dictionary and charts).
const HealthTodayCard = lazy(() => import('./HealthScreen').then((m) => ({ default: m.HealthTodayCard })))

export function TodayScreen() {
  const today = useToday()
  const habits = useHabits()
  const { weekStartsMonday, healthEnabled } = useSettings()
  const week = weekStart(today, weekStartsMonday)
  const logs = useHabitLogs(week, addDays(week, 6))
  const plans = usePlans()
  const tasks = useTasks(today)
  const upcoming = useUpcomingTasks(today)
  const mood = useDayMoods(today, today)?.[0]

  // Pending tasks of the last days move to today (on open and after midnight).
  useEffect(() => {
    void carryOverTasks(today)
  }, [today])

  const linkedDays = useLinkedHabitDays()
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linkedDays ?? {}, habits ?? []), [logs, linkedDays, habits])

  const dueToday = (habits ?? []).filter((h) => isHabitScheduled(h, today))
  const hasWeekly = (habits ?? []).some((h) => isWeeklyGoal(h) && h.startDate <= today && (!h.endDate || today <= h.endDate) && !isHabitPaused(h, today))
  const paused = (habits ?? []).filter((h) => isHabitPaused(h, today) && h.startDate <= today && (!h.endDate || today <= h.endDate))
  const ratio = dayRatio(habits ?? [], today, isDone)
  const sortedTasks = sortTasks(tasks ?? [])
  const pendingTasks = sortedTasks.filter((task) => !task.done).length

  // Wait for the first local reads (a few ms) so cards don't render empty and then grow,
  // pushing the rest of the page down (layout shift).
  if (habits === undefined || plans === undefined || tasks === undefined || logs === undefined) return null

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-sm text-ink-soft first-letter:uppercase dark:text-neutral-400">{longDay(today)}</p>
        <h1 className="text-2xl font-semibold text-brand">{t('Tu día')}</h1>
        <p className="mt-1 text-ink-soft dark:text-neutral-400">{briefingLine(pendingTasks, dueToday.length - ratio.done)}</p>
      </header>

      {!DEMO && habits?.length === 0 && plans?.length === 0 && (
        <Card className="border-2 border-dashed border-primary/60">
          <p className="font-medium">{t('¿Primera vez?')}</p>
          <p className="mt-1 text-sm text-ink-soft dark:text-neutral-400">
            {t('Mirá la app con seis semanas de datos de ejemplo: hábitos, un curso a mitad de camino, gráficos y salud. No toca tus datos.')}
          </p>
          <Button variant="primary" className="mt-3 w-full" onClick={enterDemo}>
            {t('🧪 Probar la demo')}
          </Button>
        </Card>
      )}

      <NewAchievementCard today={today} />

      <DictationCard today={today} />

      <Card>
        <SectionTitle>{t('Tareas')}</SectionTitle>
        {sortedTasks.length === 0 ? (
          <Empty>{t('Sin tareas. Dictá lo que tenés que hacer arriba.')}</Empty>
        ) : (
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {sortedTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
        {upcoming && upcoming.length > 0 && <UpcomingTasks tasks={upcoming} today={today} />}
      </Card>

      <Card>
        <SectionTitle right={<span className="text-sm font-semibold">{formatPct(ratio)}</span>}>{t('Hábitos')}</SectionTitle>
        <ProgressBar value={ratio.pct} />
        {dueToday.length === 0 ? (
          <Empty>
            {t('Hoy no te toca ningún hábito.')}{' '}
            <Link to="/habitos" className="underline">
              {t('Agregá uno')}
            </Link>
          </Empty>
        ) : (
          <TodayHabitList habits={habits ?? []} logs={logs ?? []} isDone={isDone} today={today} plans={plans ?? []} />
        )}
        {paused.length > 0 && (
          <p className="mt-3 text-sm text-ink-soft dark:text-neutral-400">
            {'⏸️ '}
            {paused.map((h, i) => {
              const p = currentPause(h, today)
              return (
                <span key={h.id}>
                  {i > 0 && ', '}
                  <Link to={`/habitos/h/${h.id}`} className="underline">
                    {h.name}
                  </Link>
                  {p?.to && ` (${t('hasta el {date}', { date: fmtDate(p.to, false) })})`}
                </span>
              )
            })}{' '}
            {t('en pausa: no cuentan para el porcentaje ni cortan la racha.')}
          </p>
        )}
      </Card>

      {hasWeekly && (
        <Card>
          <SectionTitle>{t('Metas de la semana')}</SectionTitle>
          <WeeklyGoalList habits={habits ?? []} logs={logs ?? []} today={today} mondayFirst={weekStartsMonday} />
        </Card>
      )}

      {healthEnabled && (
        <Suspense fallback={<div className="h-48 rounded-2xl bg-white shadow-sm dark:bg-neutral-800" aria-hidden />}>
          <HealthTodayCard today={today} />
        </Suspense>
      )}

      {(plans ?? []).map((p) =>
        p.kind === 'amount' ? <AmountToday key={p.id} plan={p} today={today} /> : <PlanToday key={p.id} plan={p} today={today} />,
      )}

      <Card>
        <SectionTitle right={<span className="text-sm text-ink-soft dark:text-neutral-400">{t('Estado mental: {v}', { v: fmtMental(mentalState(mood)) })}</span>}>
          {t('Ánimo y motivación')}
        </SectionTitle>
        <p className="mb-1 text-sm">{t('Ánimo')}</p>
        <Scale value={mood?.mood} color="bg-accent" onChange={(v) => void setMood(today, { mood: v })} />
        <p className="mb-1 mt-3 text-sm">{t('Motivación')}</p>
        <Scale value={mood?.motivation} color="bg-primary" onChange={(v) => void setMood(today, { motivation: v })} />
      </Card>
    </div>
  )
}

function briefingLine(tasks: number, habits: number): string {
  const parts: string[] = []
  if (tasks) parts.push(tn(tasks, '1 tarea', '{n} tareas'))
  if (habits > 0) parts.push(tn(habits, '1 hábito', '{n} hábitos'))
  if (!parts.length) return t('Nada pendiente por ahora. 🎉')
  return parts.length === 2 ? t('Te quedan {a} y {b}.', { a: parts[0], b: parts[1] }) : t('Te quedan {a}.', { a: parts[0] })
}

function fmtMental(v: number | null) {
  return v === null ? '—' : fmtFixed(v, 1)
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Check checked={task.done} label={task.title} onChange={(v) => void updateTask(task.id, { done: v })} />
      <span className={cx('flex-1 text-base', task.done && 'text-ink-soft dark:text-neutral-400 line-through')}>
        {task.time && <span className="mr-2 font-mono font-semibold">{task.time}</span>}
        {task.title}
        {task.carriedFrom && !task.done && (
          <span className="ml-2 whitespace-nowrap text-xs text-ink-soft dark:text-neutral-400">{t('↪ del {date}', { date: fmtDate(task.carriedFrom, false) })}</span>
        )}
      </span>
      <button className="px-2 text-ink-soft dark:text-neutral-400" aria-label={t('Borrar {name}', { name: task.title })} onClick={() => void deleteTask(task.id)}>
        ✕
      </button>
    </li>
  )
}

/** Tasks dictated for later days, grouped by day. */
function UpcomingTasks({ tasks, today }: { tasks: Task[]; today: string }) {
  const days = [...new Set(tasks.map((x) => x.date))]
  return (
    <details className="mt-3 border-t border-line pt-3 dark:border-neutral-700" open={days.length <= 3}>
      <summary className="cursor-pointer text-sm font-medium">{tn(tasks.length, 'Próximos días · 1 tarea', 'Próximos días · {n} tareas')}</summary>
      {days.map((d) => (
        <div key={d} className="mt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-neutral-400">{relativeDay(d, today)}</p>
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {sortTasks(tasks.filter((x) => x.date === d)).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ))}
    </details>
  )
}

function DictationCard({ today }: { today: string }) {
  const [text, setText] = useState('')
  const preview = useMemo(() => parseDictation(text, today), [text, today])
  // "?dictar=1" (home-screen shortcut): jump straight to the box.
  const [params, setParams] = useSearchParams()
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (params.get('dictar') === null) return
    box.current?.focus()
    box.current?.scrollIntoView({ block: 'center' })
    setParams({}, { replace: true })
  }, [params, setParams])
  const add = async () => {
    if (!preview.length) return
    await addTasksFromText(today, text)
    setText('')
  }
  return (
    <Card>
      <SectionTitle>{t('🎤 Dictá tu día')}</SectionTitle>
      <textarea
        ref={box}
        aria-label={t('Dictá tu día')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t('Tocá el micrófono del teclado y decí, por ejemplo: «dentista mañana a las 15, comprar yerba, el lunes llamar a Juan»')}
        className={cx(inputCls, 'resize-none')}
      />
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-ink-soft dark:text-neutral-300">
          {preview.map((p, i) => (
            <li key={i}>
              • {p.date && <span className="font-medium">{relativeDay(p.date, today)} · </span>}
              {formatTask(p)}
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" className="mt-3 w-full" disabled={!preview.length} onClick={() => void add()}>
        {preview.length > 0 ? tn(preview.length, 'Agregar 1 tarea', 'Agregar {n} tareas') : t('Agregar')}
      </Button>
    </Card>
  )
}

function PlanToday({ plan, today }: { plan: Plan; today: string }) {
  const items = usePlanItems(plan.id)
  const model = usePlanModel(plan, items, today)
  if (!model || !items) return null
  const byId = new Map<string, PlanItem>(items.map((i) => [i.id, i]))
  const todayIds = model.metrics.ok ? model.metrics.value.todayItemIds : []
  const doneToday = items.filter((i) => i.done && i.doneDate === today)
  const shown = [...doneToday, ...todayIds.map((id) => byId.get(id)!).filter(Boolean)]

  return (
    <Card>
      <SectionTitle
        right={
          <Link to={`/planes/${plan.id}`} className="text-sm underline">
            {t('Ver plan')}
          </Link>
        }
      >
        {plan.name}
      </SectionTitle>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{t('{done}/{total} hechos', { done: model.doneCount, total: model.total })}</span>
        {model.metrics.ok && model.metrics.value.marginDays !== null && (
          <span className="font-medium">{marginText(model.metrics.value.marginDays)}</span>
        )}
      </div>
      <ProgressBar value={model.total ? model.doneCount / model.total : null} />
      <CurrentLine items={items} />
      <PendingNotice fns={model.pending} />
      {model.metrics.ok && (
        <ul className="mt-2 divide-y divide-line dark:divide-neutral-700">
          {shown.length === 0 && <Empty>{t('Hoy no te toca nada de este plan.')}</Empty>}
          {shown.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <Check checked={it.done} label={it.title} onChange={(v) => void setItemDone(it.id, v, today)} />
              <span className={cx('flex-1', it.done && 'text-ink-soft dark:text-neutral-400 line-through')}>
                {it.section && <span className="text-xs text-ink-soft dark:text-neutral-400">{it.section} · </span>}
                {it.title}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!model.metrics.ok && (
        <p className="mt-2 text-sm text-ink-soft dark:text-neutral-400">
          {t('Mientras tanto podés marcar ítems desde el detalle del plan.')}{' '}
          <Link to={`/planes/${plan.id}`} className="underline">
            {t('Ver plan')}
          </Link>
        </p>
      )}
    </Card>
  )
}
