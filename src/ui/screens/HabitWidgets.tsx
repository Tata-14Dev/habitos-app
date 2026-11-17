/** Habit pieces for the Today screen: daily habits grouped by moment, weekly goals, amount logging. */
import { useState } from 'react'
import type { ISODate } from '../../domain/dates'
import {
  buildAmountLookup,
  isHabitScheduled,
  isWeeklyGoal,
  weekProgress,
  type DoneLookup,
} from '../../domain/habits'
import { formatAmount } from '../../domain/progress'
import { addHabitAmount, setHabitAmount, setHabitDone } from '../../data/repo'
import type { Habit, HabitLog, Plan } from '../../data/types'
import { Button, Check, Field, inputCls, ProgressBar, Sheet } from '../components'
import { TIME_OF_DAY } from '../habitText'

const parseNum = (s: string) => Number(s.replace(',', '.'))

/** Quick step for amount goals: half an hour for small targets, 1 for bigger ones. */
function stepFor(target: number): number {
  return target <= 2 ? 0.5 : 1
}

function HabitName({ h, sub }: { h: Habit; sub?: string }) {
  return (
    <span className="min-w-0 flex-1 text-base">
      {h.emoji && <span className="mr-1">{h.emoji}</span>}
      {h.name}
      {sub && <span className="block text-xs text-ink-soft dark:text-neutral-400">{sub}</span>}
    </span>
  )
}

/** Sheet to set the exact amount of a day. */
function AmountSheet({ habit, date, current, onClose }: { habit: Habit; date: ISODate; current: number; onClose: () => void }) {
  const [value, setValue] = useState(current ? String(current).replace('.', ',') : '')
  const n = parseNum(value)
  const unit = habit.goal?.type === 'amount' ? habit.goal.unit : ''
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(n >= 0)) return
        void setHabitAmount(habit.id, date, n).then(onClose)
      }}
    >
      <Field label={`Cuánto hiciste hoy (${unit})`} hint="Reemplaza lo registrado hoy. 0 lo borra.">
        <input inputMode="decimal" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={!(n >= 0) || value.trim() === ''}>
        Guardar
      </Button>
    </form>
  )
}

/** Row for a habit with an amount goal (per day or per week): progress + quick add. */
function AmountRow({
  habit,
  today,
  todayAmount,
  label,
  done,
  bar,
}: {
  habit: Habit
  today: ISODate
  todayAmount: number
  label: string
  done: boolean
  /** Weekly goals: progress of the week in [0, 1]. */
  bar?: number | null
}) {
  const [editing, setEditing] = useState(false)
  if (habit.goal?.type !== 'amount') return null
  const { target, unit, period } = habit.goal
  const step = stepFor(target)
  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <Check
          checked={done}
          label={habit.name}
          onChange={(v) => void (period === 'day' ? setHabitAmount(habit.id, today, v ? target : 0) : setEditing(true))}
        />
        <HabitName h={habit} sub={label} />
        <Button className="px-3 text-sm" onClick={() => void addHabitAmount(habit.id, today, step)} aria-label={`Sumar ${formatAmount(step, unit)} a ${habit.name}`}>
          +{formatAmount(step)}
        </Button>
        <Button className="px-3 text-sm" onClick={() => setEditing(true)} aria-label={`Otra cantidad para ${habit.name}`}>
          ✎
        </Button>
      </div>
      {bar !== undefined && (
        <div className="mt-2">
          <ProgressBar value={bar} />
        </div>
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title={habit.name}>
        {editing && <AmountSheet habit={habit} date={today} current={todayAmount} onClose={() => setEditing(false)} />}
      </Sheet>
    </li>
  )
}

/** Daily habits due today, grouped by moment of the day. */
export function TodayHabitList({
  habits,
  logs,
  isDone,
  today,
  plans,
}: {
  habits: Habit[]
  logs: HabitLog[]
  isDone: DoneLookup
  today: ISODate
  plans: Plan[]
}) {
  const amountOf = buildAmountLookup(logs)
  const due = habits.filter((h) => isHabitScheduled(h, today))
  const groups = TIME_OF_DAY.map((g) => ({ ...g, items: due.filter((h) => (h.kind === 'progress' ? undefined : h.timeOfDay) === g.key) })).filter(
    (g) => g.items.length > 0,
  )
  const showHeaders = groups.length > 1 || (groups[0] && groups[0].key !== undefined)
  return (
    <div className="mt-2 space-y-3">
      {groups.map((g) => (
        <div key={g.label}>
          {showHeaders && (
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-neutral-400">
              {g.icon} {g.label}
            </p>
          )}
          <ul className="divide-y divide-line dark:divide-neutral-700">
            {g.items.map((h) => {
              const done = isDone(h.id, today)
              if (h.goal?.type === 'amount') {
                const a = amountOf(h.id, today)
                return (
                  <AmountRow key={h.id} habit={h} today={today} todayAmount={a} done={done} label={`${formatAmount(a)}/${formatAmount(h.goal.target, h.goal.unit)} hoy`} />
                )
              }
              const linked = plans.find((p) => p.linkedHabitId === h.id)
              return (
                <li key={h.id} className="flex items-center gap-3 py-2">
                  <Check checked={done} label={h.name} onChange={(v) => void setHabitDone(h.id, today, v)} />
                  <HabitName
                    h={h}
                    sub={linked ? `Se marca solo al ${linked.kind === 'amount' ? 'registrar avance en' : 'hacer un ítem de'} ${linked.name}` : undefined}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Weekly goals ("5 h por semana", "3 veces por semana") with this week's progress. */
export function WeeklyGoalList({
  habits,
  logs,
  today,
  mondayFirst,
}: {
  habits: Habit[]
  logs: HabitLog[]
  today: ISODate
  mondayFirst: boolean
}) {
  const weekly = habits.filter((h) => isWeeklyGoal(h) && h.startDate <= today && (!h.endDate || today <= h.endDate))
  if (!weekly.length) return null
  const amountOf = buildAmountLookup(logs)
  const doneToday = new Set(logs.filter((l) => l.date === today && l.done && !l.deletedAt).map((l) => l.habitId))
  return (
    <ul className="divide-y divide-line dark:divide-neutral-700">
      {weekly.map((h) => {
        const p = weekProgress(h, logs, today, mondayFirst)
        const unit = h.goal?.type === 'amount' ? h.goal.unit : undefined
        const label = `${formatAmount(p.done)}/${formatAmount(p.target, unit)} esta semana${p.met ? ' ✅' : ''}`
        return h.goal?.type === 'amount' ? (
          <AmountRow
            key={h.id}
            habit={h}
            today={today}
            todayAmount={amountOf(h.id, today)}
            done={p.met}
            label={label}
            bar={p.target ? p.done / p.target : null}
          />
        ) : (
          <li key={h.id} className="py-2">
            <div className="flex items-center gap-3">
              <Check checked={doneToday.has(h.id)} label={`${h.name} hoy`} onChange={(v) => void setHabitDone(h.id, today, v)} />
              <HabitName h={h} sub={label} />
            </div>
            <div className="mt-2">
              <ProgressBar value={p.target ? p.done / p.target : null} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
