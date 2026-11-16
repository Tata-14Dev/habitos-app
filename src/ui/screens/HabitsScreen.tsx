import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAR, yearMonth } from '../../domain/dates'
import { buildDoneLookup, habitStreaks, isHabitActive, linkedHabitDays } from '../../domain/habits'
import { deleteHabit, reorderHabits, saveHabit } from '../../data/repo'
import type { Habit } from '../../data/types'
import { Button, Card, Empty, Field, inputCls, SectionTitle, Sheet } from '../components'
import { useAllHabitLogs, useAllPlanItems, useHabits, usePlans, useToday } from '../hooks'
import { SortableList } from '../Sortable'

export function HabitsScreen() {
  const today = useToday()
  const habits = useHabits()
  const logs = useAllHabitLogs()
  const plans = usePlans()
  const items = useAllPlanItems()
  const [editing, setEditing] = useState<Partial<Habit> | null>(null)
  const { year, month } = yearMonth(today)

  const isDone = useMemo(() => {
    const derived: Record<string, Set<string>> = {}
    for (const p of plans ?? []) {
      if (p.linkedHabitId) derived[p.linkedHabitId] = linkedHabitDays((items ?? []).filter((i) => i.planId === p.id))
    }
    return buildDoneLookup(logs ?? [], derived)
  }, [logs, plans, items])

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
              const s = habitStreaks(h, isDone, today)
              const active = isHabitActive(h, today)
              return (
                <div className="flex items-center gap-2 py-2">
                  {handle}
                  <button className="flex-1 text-left" onClick={() => setEditing(h)}>
                    <span className="text-base">
                      {h.emoji && <span className="mr-1">{h.emoji}</span>}
                      {h.name}
                    </span>
                    <span className="block text-xs text-ink-soft dark:text-neutral-400">
                      desde {formatAR(h.startDate)}
                      {h.endDate ? ` hasta ${formatAR(h.endDate)}` : ''}
                      {!active && ' · fuera de vigencia'}
                    </span>
                  </button>
                  <span className="text-right text-xs text-ink-soft dark:text-neutral-400">
                    🔥 {s.current}
                    <br />
                    mejor {s.best}
                  </span>
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

function HabitForm({ habit, onDone }: { habit: Partial<Habit>; onDone: () => void }) {
  const [name, setName] = useState(habit.name ?? '')
  const [emoji, setEmoji] = useState(habit.emoji ?? '')
  const [startDate, setStart] = useState(habit.startDate ?? '')
  const [endDate, setEnd] = useState(habit.endDate ?? '')
  const valid = name.trim() && startDate && (!endDate || endDate >= startDate)

  const save = async () => {
    if (!valid) return
    await saveHabit({ ...habit, name: name.trim(), emoji: emoji.trim() || undefined, startDate, endDate: endDate || undefined })
    onDone()
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        <Field label="Emoji">
          <input className={inputCls} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="💪" />
        </Field>
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Leer 20 minutos" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Desde">
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Hasta (opcional)" hint="Si lo dejás, poné la fecha de fin: los meses anteriores conservan sus datos.">
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
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
