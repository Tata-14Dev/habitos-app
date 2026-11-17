import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAR, yearMonth } from '../../domain/dates'
import {
  buildDoneLookup,
  habitStreaks,
  isHabitActive,
  isOneOff,
  isWeeklyGoal,
  weeklyStreaks,
  type HabitGoal,
  type HabitKind,
  type TimeOfDay,
} from '../../domain/habits'
import { deleteHabit, reorderHabits, saveHabit } from '../../data/repo'
import type { Habit } from '../../data/types'
import { Button, Card, cx, Empty, Field, inputCls, SectionTitle, Sheet } from '../components'
import { WEEKDAY_NAMES } from '../format'
import { habitSummary, TIME_OF_DAY } from '../habitText'
import { useAllHabitLogs, useHabits, useLinkedHabitDays, useSettings, useToday } from '../hooks'
import { SortableList } from '../Sortable'

export function HabitsScreen() {
  const today = useToday()
  const habits = useHabits()
  const logs = useAllHabitLogs()
  const { weekStartsMonday } = useSettings()
  const [editing, setEditing] = useState<Partial<Habit> | null>(null)
  const { year, month } = yearMonth(today)

  const linkedDays = useLinkedHabitDays()
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linkedDays ?? {}, habits ?? []), [logs, linkedDays, habits])

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-semibold">Hábitos</h1>
        <Link to={`/habitos/mes/${year}/${month}`} className="text-sm underline">
          Ver mes 📅
        </Link>
      </header>

      <Card>
        <SectionTitle right={<Button variant="primary" onClick={() => setEditing({ startDate: today })}>+ Nuevo</Button>}>
          Mis hábitos
        </SectionTitle>
        {!habits?.length ? (
          <Empty>Todavía no cargaste hábitos.</Empty>
        ) : (
          <SortableList
            items={habits}
            onReorder={(ids) => void reorderHabits(ids)}
            className="divide-y divide-line dark:divide-neutral-700"
            render={(h, handle) => {
              const weekly = isWeeklyGoal(h)
              const s = weekly ? weeklyStreaks(h, logs ?? [], today, weekStartsMonday) : habitStreaks(h, isDone, today)
              const active = isHabitActive(h, today)
              const unit = weekly ? 'sem' : ''
              return (
                <div className="flex items-center gap-2 py-2">
                  {handle}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(h)}>
                    <span className="text-base">
                      {h.emoji && <span className="mr-1">{h.emoji}</span>}
                      {h.name}
                    </span>
                    <span className="block text-xs text-ink-soft dark:text-neutral-400">
                      {habitSummary(h)}
                      {!isOneOff(h) && ` · desde ${formatAR(h.startDate, false)}`}
                      {h.endDate ? ` hasta ${formatAR(h.endDate, false)}` : ''}
                      {!active && ' · fuera de vigencia'}
                    </span>
                  </button>
                  {!isOneOff(h) && (
                    <span className="text-right text-xs text-ink-soft dark:text-neutral-400">
                      🔥 {s.current}
                      {unit && ` ${unit}`}
                      <br />
                      mejor {s.best}
                    </span>
                  )}
                </div>
              )
            }}
          />
        )}
      </Card>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar hábito' : 'Nuevo hábito'}>
        {editing && <HabitForm habit={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

const KINDS: [HabitKind, string, string][] = [
  ['fixed', '🔁 Fijo', 'Todos los días'],
  ['scheduled', '📅 Del día', 'Una fecha o algunos días'],
  ['progress', '📈 Con progreso', 'Horas, páginas o veces'],
]

const parseNum = (s: string) => Number(s.replace(',', '.'))
const numText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))

/** Pill-style option group (aria-pressed buttons). */
function Options<T extends string | undefined>({
  value,
  options,
  onChange,
  cols,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.label}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-10 rounded-lg px-2 text-sm',
            value === o.value ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HabitForm({ habit, onDone }: { habit: Partial<Habit>; onDone: () => void }) {
  const [kind, setKind] = useState<HabitKind>(habit.kind ?? 'fixed')
  const [name, setName] = useState(habit.name ?? '')
  const [emoji, setEmoji] = useState(habit.emoji ?? '')
  const [startDate, setStart] = useState(habit.startDate ?? '')
  const [endDate, setEnd] = useState(habit.endDate ?? '')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | undefined>(habit.timeOfDay)
  // scheduled
  const [when, setWhen] = useState<'date' | 'weekdays'>(habit.onDate ? 'date' : 'weekdays')
  const [onDate, setOnDate] = useState(habit.onDate ?? habit.startDate ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(habit.weekdays ?? [])
  // progress
  const g = habit.goal
  const [goalType, setGoalType] = useState<'amount' | 'times'>(g?.type ?? 'amount')
  const [period, setPeriod] = useState<'day' | 'week'>(g?.type === 'amount' ? g.period : 'day')
  const [target, setTarget] = useState(numText(g?.target))
  const [unit, setUnit] = useState(g?.type === 'amount' ? g.unit : '')

  const targetNum = parseNum(target)
  const oneOff = kind === 'scheduled' && when === 'date'
  const goal: HabitGoal | undefined =
    kind !== 'progress'
      ? undefined
      : goalType === 'times'
        ? { type: 'times', target: Math.round(targetNum) }
        : { type: 'amount', period, target: targetNum, unit: unit.trim() }

  const valid =
    !!name.trim() &&
    (oneOff ? !!onDate : !!startDate && (!endDate || endDate >= startDate)) &&
    (kind !== 'scheduled' || when === 'date' || weekdays.length > 0) &&
    (kind !== 'progress' ||
      (goalType === 'times' ? Number.isInteger(targetNum) && targetNum >= 1 && targetNum <= 7 : targetNum > 0 && !!unit.trim()))

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))

  const save = async () => {
    if (!valid) return
    await saveHabit({
      ...habit,
      name: name.trim(),
      emoji: emoji.trim() || undefined,
      kind,
      // A one-off habit is valid exactly on its date.
      startDate: oneOff ? onDate : startDate,
      endDate: oneOff ? onDate : endDate || undefined,
      timeOfDay: kind === 'progress' ? undefined : timeOfDay,
      onDate: oneOff ? onDate : undefined,
      weekdays: kind === 'scheduled' && !oneOff ? [...weekdays].sort() : undefined,
      goal,
    })
    onDone()
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div>
        <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">Tipo de hábito</span>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map(([k, label, hint]) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cx(
                'rounded-xl p-2 text-left',
                kind === k ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
              )}
            >
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-[11px] leading-tight opacity-80">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        <Field label="Emoji">
          <input className={inputCls} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="💪" />
        </Field>
        <Field label="Nombre">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={kind === 'fixed' ? 'Hacer la cama' : kind === 'scheduled' ? 'Natación' : 'Estudiar inglés'}
          />
        </Field>
      </div>

      {kind === 'scheduled' && (
        <div className="space-y-2">
          <Options
            value={when}
            onChange={setWhen}
            options={[
              { value: 'weekdays', label: 'Algunos días de la semana' },
              { value: 'date', label: 'Una sola fecha' },
            ]}
          />
          {when === 'date' ? (
            <Field label="Fecha">
              <input type="date" className={inputCls} value={onDate} onChange={(e) => setOnDate(e.target.value)} />
            </Field>
          ) : (
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(d)}
                  aria-pressed={weekdays.includes(d)}
                  aria-label={WEEKDAY_NAMES[d]}
                  className={cx(
                    'h-10 rounded-lg text-sm',
                    weekdays.includes(d) ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
                  )}
                >
                  {WEEKDAY_NAMES[d].slice(0, 2)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {kind === 'progress' && (
        <div className="space-y-2">
          <Options
            value={goalType}
            onChange={setGoalType}
            options={[
              { value: 'amount', label: 'Una cantidad' },
              { value: 'times', label: 'Veces por semana' },
            ]}
          />
          {goalType === 'amount' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Meta">
                  <input inputMode="decimal" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1" />
                </Field>
                <Field label="Unidad">
                  <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="h, páginas, km" />
                </Field>
              </div>
              <Options
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'day', label: 'Por día' },
                  { value: 'week', label: 'Por semana' },
                ]}
              />
            </>
          ) : (
            <Field label="Veces por semana" hint="Cada día que lo hacés lo tildás; la semana se cumple al llegar a la meta.">
              <input inputMode="numeric" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="3" />
            </Field>
          )}
        </div>
      )}

      {kind !== 'progress' && (
        <div>
          <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">Momento del día</span>
          <Options
            value={timeOfDay}
            onChange={setTimeOfDay}
            cols={4}
            options={TIME_OF_DAY.map((t) => ({ value: t.key, label: t.key ? t.label : 'Cualquiera' }))}
          />
        </div>
      )}

      {!oneOff && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde">
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Hasta (opcional)" hint="Si lo dejás, poné la fecha de fin: los meses anteriores conservan sus datos.">
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          Guardar
        </Button>
        {habit.id && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (confirm('¿Borrar el hábito y su historial? Si solo lo dejaste, mejor ponele fecha "hasta".')) {
                void deleteHabit(habit.id!).then(onDone)
              }
            }}
          >
            Borrar
          </Button>
        )}
      </div>
    </form>
  )
}
