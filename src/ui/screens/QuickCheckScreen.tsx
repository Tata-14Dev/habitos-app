/**
 * "/marcar/:id": opened from a home-screen shortcut (Android/desktop), the iPhone Shortcuts app
 * or a QR code. A yes/no habit is marked done for today right away, with "Deshacer";
 * an amount habit shows a quick "+1" and the exact amount.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addDays } from '../../domain/dates'
import { buildAmountLookup, buildDoneLookup, habitStreaks, isWeeklyGoal, weekProgress, weeklyStreaks } from '../../domain/habits'
import { formatAmount } from '../../domain/progress'
import { addHabitAmount, setHabitDone } from '../../data/repo'
import { Button, Card, Empty } from '../components'
import { useHabitLogs, useHabits, useLinkedHabitDays, useSettings, useToday } from '../hooks'
import { t, tn } from '../i18n'
import { AmountSheet, stepFor } from './HabitWidgets'

export function QuickCheckScreen() {
  const { id } = useParams()
  const today = useToday()
  const habits = useHabits()
  const logs = useHabitLogs(addDays(today, -400), today)
  const linked = useLinkedHabitDays()
  const { weekStartsMonday } = useSettings()
  const marked = useRef(false)

  const habit = habits?.find((h) => h.id === id)
  const isAmount = habit?.goal?.type === 'amount'
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linked ?? {}, habits ?? []), [logs, linked, habits])

  // Mark once, when the data is there (and only yes/no habits: amounts need a number).
  useEffect(() => {
    if (!habit || isAmount || !logs || marked.current) return
    marked.current = true
    if (!isDone(habit.id, today)) void setHabitDone(habit.id, today, true)
  }, [habit, isAmount, logs, isDone, today])

  if (!habits || !logs) return <Empty>{t('Cargando…')}</Empty>
  if (!habit) {
    return (
      <Card>
        <p>{t('Este hábito no existe.')}</p>
        <Link to="/" className="mt-2 inline-block underline">
          {t('Ir a Hoy')}
        </Link>
      </Card>
    )
  }

  const weekly = isWeeklyGoal(habit)
  const streak = weekly ? weeklyStreaks(habit, logs, today, weekStartsMonday).current : habitStreaks(habit, isDone, today).current
  const done = isDone(habit.id, today)
  const amount = buildAmountLookup(logs)(habit.id, today)

  return (
    <div className="space-y-5 pt-6 text-center">
      <div className="text-6xl" aria-hidden>
        {habit.emoji ?? '✅'}
      </div>
      <h1 className="text-2xl font-semibold">
        {isAmount ? habit.name : done ? t('✅ Listo: {name}', { name: habit.name }) : habit.name}
      </h1>

      {isAmount && habit.goal?.type === 'amount' ? (
        <Card className="text-left">
          <p className="mb-3 text-center text-lg">
            {weekly
              ? t('{done}/{target} esta semana', {
                  done: formatAmount(weekProgress(habit, logs, today, weekStartsMonday).done),
                  target: formatAmount(habit.goal.target, habit.goal.unit),
                })
              : t('{done}/{target} hoy', { done: formatAmount(amount), target: formatAmount(habit.goal.target, habit.goal.unit) })}
          </p>
          <Button variant="primary" className="mb-4 w-full" onClick={() => void addHabitAmount(habit.id, today, stepFor(habit.goal!.target))}>
            +{formatAmount(stepFor(habit.goal.target), habit.goal.unit)}
          </Button>
          <AmountSheet key={amount} habit={habit} date={today} current={amount} onClose={() => {}} />
        </Card>
      ) : (
        <>
          <p className="text-ink-soft dark:text-neutral-400">
            {streak > 0 && (weekly ? tn(streak, '🔥 1 semana seguida', '🔥 {n} semanas seguidas') : tn(streak, '🔥 1 día seguido', '🔥 {n} días seguidos'))}
          </p>
          {done && (
            <Button className="w-full" onClick={() => void setHabitDone(habit.id, today, false)}>
              {t('Deshacer')}
            </Button>
          )}
          {!done && marked.current && (
            <Button variant="primary" className="w-full" onClick={() => void setHabitDone(habit.id, today, true)}>
              {t('Marcar como hecho')}
            </Button>
          )}
        </>
      )}
      <Link to="/" className="inline-block underline">
        {t('Ir a Hoy')}
      </Link>
    </div>
  )
}
