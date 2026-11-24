import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, weekStart } from '../../domain/dates'
import { buildDoneLookup, dayRatio, formatPct, isHabitScheduled, isWeeklyGoal, mentalState } from '../../domain/habits'
import { marginLabel } from '../../domain/plans'
import { formatTask, parseDictation, sortTasks } from '../../domain/tasks'
import { addTasksFromText, deleteTask, setItemDone, setMood, updateTask } from '../../data/repo'
import type { Plan, PlanItem } from '../../data/types'
import { Button, Card, Check, cx, Empty, inputCls, PendingNotice, ProgressBar, Scale, SectionTitle } from '../components'
import { longDay } from '../format'
import { useDayMoods, useHabitLogs, useHabits, usePlanItems, usePlans, useSettings, useTasks, useToday, useLinkedHabitDays } from '../hooks'
import { usePlanModel } from '../usePlanModel'
import { AmountToday } from './AmountPlan'
import { TodayHabitList, WeeklyGoalList } from './HabitWidgets'
import { CurrentLine } from './CurrentLine'

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
  const mood = useDayMoods(today, today)?.[0]

  const linkedDays = useLinkedHabitDays()
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linkedDays ?? {}, habits ?? []), [logs, linkedDays, habits])

  const dueToday = (habits ?? []).filter((h) => isHabitScheduled(h, today))
  const hasWeekly = (habits ?? []).some((h) => isWeeklyGoal(h) && h.startDate <= today && (!h.endDate || today <= h.endDate))
  const ratio = dayRatio(habits ?? [], today, isDone)
  const sortedTasks = sortTasks(tasks ?? [])
  const pendingTasks = sortedTasks.filter((t) => !t.done).length

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-sm text-ink-soft first-letter:uppercase dark:text-neutral-400">{longDay(today)}</p>
        <h1 className="text-2xl font-semibold">Tu día</h1>
        <p className="mt-1 text-ink-soft dark:text-neutral-400">
          {briefingLine(pendingTasks, dueToday.length - ratio.done)}
        </p>
      </header>

      <DictationCard today={today} />

      <Card>
        <SectionTitle>Tareas</SectionTitle>
        {sortedTasks.length === 0 ? (
          <Empty>Sin tareas. Dictá lo que tenés que hacer arriba.</Empty>
        ) : (
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {sortedTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <Check checked={t.done} label={t.title} onChange={(v) => void updateTask(t.id, { done: v })} />
                <span className={cx('flex-1 text-base', t.done && 'text-ink-soft line-through')}>
                  {t.time && <span className="mr-2 font-mono font-semibold">{t.time}</span>}
                  {t.title}
                </span>
                <button className="px-2 text-ink-soft" aria-label={`Borrar ${t.title}`} onClick={() => void deleteTask(t.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle right={<span className="text-sm font-semibold">{formatPct(ratio)}</span>}>Hábitos</SectionTitle>
        <ProgressBar value={ratio.pct} />
        {dueToday.length === 0 ? (
          <Empty>
            Hoy no te toca ningún hábito. <Link to="/habitos" className="underline">Agregá uno</Link>.
          </Empty>
        ) : (
          <TodayHabitList habits={habits ?? []} logs={logs ?? []} isDone={isDone} today={today} plans={plans ?? []} />
        )}
      </Card>

      {hasWeekly && (
        <Card>
          <SectionTitle>Metas de la semana</SectionTitle>
          <WeeklyGoalList habits={habits ?? []} logs={logs ?? []} today={today} mondayFirst={weekStartsMonday} />
        </Card>
      )}

      {healthEnabled && (
        <Suspense fallback={null}>
          <HealthTodayCard today={today} />
        </Suspense>
      )}

      {(plans ?? []).map((p) =>
        p.kind === 'amount' ? <AmountToday key={p.id} plan={p} today={today} /> : <PlanToday key={p.id} plan={p} today={today} />,
      )}

      <Card>
        <SectionTitle right={<span className="text-sm text-ink-soft">Estado mental: {fmtMental(mentalState(mood))}</span>}>
          Ánimo y motivación
        </SectionTitle>
        <p className="mb-1 text-sm">Ánimo</p>
        <Scale value={mood?.mood} color="bg-mood" onChange={(v) => void setMood(today, { mood: v })} />
        <p className="mb-1 mt-3 text-sm">Motivación</p>
        <Scale value={mood?.motivation} color="bg-progress" onChange={(v) => void setMood(today, { motivation: v })} />
      </Card>
    </div>
  )
}

function briefingLine(tasks: number, habits: number): string {
  const parts: string[] = []
  if (tasks) parts.push(`${tasks} ${tasks === 1 ? 'tarea' : 'tareas'}`)
  if (habits > 0) parts.push(`${habits} ${habits === 1 ? 'hábito' : 'hábitos'}`)
  return parts.length ? `Te quedan ${parts.join(' y ')}.` : 'Nada pendiente por ahora. 🎉'
}

function fmtMental(v: number | null) {
  return v === null ? '—' : v.toFixed(1).replace('.', ',')
}

function DictationCard({ today }: { today: string }) {
  const [text, setText] = useState('')
  const preview = useMemo(() => parseDictation(text), [text])
  const add = async () => {
    if (!preview.length) return
    await addTasksFromText(today, text)
    setText('')
  }
  return (
    <Card>
      <SectionTitle>🎤 Dictá tu día</SectionTitle>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Tocá el micrófono del teclado y decí, por ejemplo: «dentista a las 15, comprar yerba, llamar a Juan»"
        className={cx(inputCls, 'resize-none')}
      />
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-ink-soft dark:text-neutral-300">
          {preview.map((p, i) => (
            <li key={i}>• {formatTask(p)}</li>
          ))}
        </ul>
      )}
      <Button variant="primary" className="mt-3 w-full" disabled={!preview.length} onClick={() => void add()}>
        Agregar {preview.length > 0 ? `${preview.length} ${preview.length === 1 ? 'tarea' : 'tareas'}` : ''}
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
            Ver plan
          </Link>
        }
      >
        {plan.name}
      </SectionTitle>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>
          {model.doneCount}/{model.total} hechos
        </span>
        {model.metrics.ok && model.metrics.value.marginDays !== null && (
          <span className="font-medium">{marginLabel(model.metrics.value.marginDays)}</span>
        )}
      </div>
      <ProgressBar value={model.total ? model.doneCount / model.total : null} />
      <CurrentLine items={items} />
      <PendingNotice fns={model.pending} />
      {model.metrics.ok && (
        <ul className="mt-2 divide-y divide-line dark:divide-neutral-700">
          {shown.length === 0 && <Empty>Hoy no te toca nada de este plan.</Empty>}
          {shown.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <Check checked={it.done} label={it.title} onChange={(v) => void setItemDone(it.id, v, today)} />
              <span className={cx('flex-1', it.done && 'text-ink-soft line-through')}>
                {it.section && <span className="text-xs text-ink-soft">{it.section} · </span>}
                {it.title}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!model.metrics.ok && (
        <p className="mt-2 text-sm text-ink-soft">
          Mientras tanto podés marcar ítems desde el <Link to={`/planes/${plan.id}`} className="underline">detalle del plan</Link>.
        </p>
      )}
    </Card>
  )
}
