import { describe, expect, it } from 'vitest'
import { eachDay, type ISODate } from './dates'
import {
  buildDoneLookup,
  dayRatio,
  formatPct,
  habitStreaks,
  isHabitActive,
  linkedHabitDays,
  mentalState,
  monthStats,
  rangeRatio,
  yearStats,
  type HabitLike,
  type HabitLogLike,
} from './habits'

const habit = (id: string, startDate: ISODate, endDate?: ISODate): HabitLike => ({ id, startDate, endDate })
const logsFor = (habitId: string, dates: ISODate[]): HabitLogLike[] => dates.map((date) => ({ habitId, date, done: true }))

describe('isHabitActive', () => {
  it('respeta desde y hasta, ambos inclusive', () => {
    const h = habit('a', '2027-03-01', '2027-03-31')
    expect(isHabitActive(h, '2027-02-28')).toBe(false)
    expect(isHabitActive(h, '2027-03-01')).toBe(true)
    expect(isHabitActive(h, '2027-03-31')).toBe(true)
    expect(isHabitActive(h, '2027-04-01')).toBe(false)
  })
  it('sin hasta sigue vigente', () => {
    expect(isHabitActive(habit('a', '2027-01-01'), '2030-01-01')).toBe(true)
  })
  it('un hábito borrado nunca cuenta', () => {
    expect(isHabitActive({ ...habit('a', '2027-01-01'), deletedAt: 'x' }, '2027-01-02')).toBe(false)
  })
})

describe('dayRatio', () => {
  it('divide solo por los hábitos vigentes', () => {
    const habits = [habit('a', '2027-01-01'), habit('b', '2027-01-01'), habit('c', '2027-06-01')]
    const isDone = buildDoneLookup(logsFor('a', ['2027-01-10']))
    expect(dayRatio(habits, '2027-01-10', isDone)).toEqual({ done: 1, total: 2, pct: 0.5 })
  })
  it('sin hábitos vigentes → pct null (no 0%)', () => {
    expect(dayRatio([habit('a', '2027-06-01')], '2027-01-10', buildDoneLookup([])).pct).toBeNull()
    expect(formatPct(null)).toBe('—')
  })
  it('logs con done=false o borrados no cuentan', () => {
    const isDone = buildDoneLookup([
      { habitId: 'a', date: '2027-01-10', done: false },
      { habitId: 'b', date: '2027-01-10', done: true, deletedAt: 'x' },
    ])
    expect(dayRatio([habit('a', '2027-01-01'), habit('b', '2027-01-01')], '2027-01-10', isDone).done).toBe(0)
  })
})

describe('Caso I: 1 hábito vigente cumplido todo el mes → 100%', () => {
  const habits = [
    habit('vigente', '2027-01-01'),
    habit('terminado', '2026-01-01', '2026-12-31'), // fuera de vigencia
    habit('futuro', '2027-05-01'), // fuera de vigencia
  ]
  const isDone = buildDoneLookup(logsFor('vigente', eachDay('2027-03-01', '2027-03-31')))
  const stats = monthStats(habits, 2027, 3, isDone, '2027-04-15')

  it('100% cada día', () => {
    expect(stats.days).toHaveLength(31)
    for (const d of stats.days) expect(d.ratio.pct).toBe(1)
  })
  it('100% el mes', () => {
    expect(stats.total.pct).toBe(1)
    expect(formatPct(stats.total)).toBe('100%')
  })
  it('100% el hábito; los no vigentes no tienen porcentaje', () => {
    expect(stats.perHabit.vigente.pct).toBe(1)
    expect(stats.perHabit.terminado.pct).toBeNull()
    expect(stats.perHabit.futuro.pct).toBeNull()
  })
})

describe('Caso J: hábito nuevo con "desde" en noviembre no cambia los meses anteriores', () => {
  const old = habit('viejo', '2027-01-01')
  const isDoneBase = eachDay('2027-01-01', '2027-12-31').filter((_, i) => i % 2 === 0) // día por medio
  const logs = logsFor('viejo', isDoneBase)
  const today = '2027-12-31'

  it('enero–octubre quedan iguales al agregar el hábito', () => {
    const before = yearStats([old], 2027, buildDoneLookup(logs), today)
    const after = yearStats([old, habit('nuevo', '2027-11-01')], 2027, buildDoneLookup(logs), today)
    for (let m = 0; m < 10; m++) expect(after[m]).toEqual(before[m])
  })
  it('noviembre sí cambia (ahora hay 2 hábitos vigentes)', () => {
    const after = yearStats([old, habit('nuevo', '2027-11-01')], 2027, buildDoneLookup(logs), today)
    expect(after[10].total).toBe(60)
  })
  it('dejar un hábito con "hasta" conserva los meses anteriores', () => {
    const quit = habit('viejo', '2027-01-01', '2027-06-30')
    const full = yearStats([old], 2027, buildDoneLookup(logs), today)
    const withEnd = yearStats([quit], 2027, buildDoneLookup(logs), today)
    for (let m = 0; m < 6; m++) expect(withEnd[m]).toEqual(full[m])
    expect(withEnd[6].pct).toBeNull() // julio: ningún hábito vigente
  })
})

describe('mes en curso', () => {
  it('los días futuros no cuentan para el porcentaje del mes', () => {
    const isDone = buildDoneLookup(logsFor('a', eachDay('2027-03-01', '2027-03-10')))
    const s = monthStats([habit('a', '2027-01-01')], 2027, 3, isDone, '2027-03-10')
    expect(s.total).toEqual({ done: 10, total: 10, pct: 1 })
    expect(s.days[10].future).toBe(true)
  })
  it('rangeRatio suma hechos y vigentes de todos los días', () => {
    const habits = [habit('a', '2027-01-01'), habit('b', '2027-01-03')]
    const isDone = buildDoneLookup([...logsFor('a', ['2027-01-01', '2027-01-02']), ...logsFor('b', ['2027-01-03'])])
    // días 1 y 2: solo "a" vigente (2/2); día 3: a y b vigentes, 1/2 → 3/4
    expect(rangeRatio(habits, '2027-01-01', '2027-01-03', isDone, '2027-01-03')).toEqual({ done: 3, total: 4, pct: 0.75 })
  })
})

describe('habitStreaks', () => {
  const h = habit('a', '2027-01-01')
  it('racha actual que llega a hoy', () => {
    const isDone = buildDoneLookup(logsFor('a', ['2027-01-03', '2027-01-04', '2027-01-05']))
    expect(habitStreaks(h, isDone, '2027-01-05')).toEqual({ current: 3, best: 3 })
  })
  it('hoy todavía sin marcar no corta la racha', () => {
    const isDone = buildDoneLookup(logsFor('a', ['2027-01-03', '2027-01-04']))
    expect(habitStreaks(h, isDone, '2027-01-05')).toEqual({ current: 2, best: 2 })
  })
  it('un día sin hacer corta la racha; la mejor se conserva', () => {
    const isDone = buildDoneLookup(logsFor('a', ['2027-01-01', '2027-01-02', '2027-01-03', '2027-01-05']))
    expect(habitStreaks(h, isDone, '2027-01-07')).toEqual({ current: 0, best: 3 }) // el 6 se salteó
  })
  it('hábito terminado: sin racha actual', () => {
    const ended = habit('a', '2027-01-01', '2027-01-03')
    const isDone = buildDoneLookup(logsFor('a', ['2027-01-01', '2027-01-02', '2027-01-03']))
    expect(habitStreaks(ended, isDone, '2027-01-10')).toEqual({ current: 0, best: 3 })
  })
  it('hábito que todavía no empezó', () => {
    expect(habitStreaks(habit('a', '2027-02-01'), buildDoneLookup([]), '2027-01-10')).toEqual({ current: 0, best: 0 })
  })
})

describe('hábito vinculado a un plan', () => {
  it('cuenta como hecho los días con al menos un ítem marcado', () => {
    const items = [
      { done: true, doneDate: '2026-11-16' },
      { done: true, doneDate: '2026-11-16' },
      { done: true, doneDate: '2026-11-18' },
      { done: false },
    ]
    const isDone = buildDoneLookup([], { soc: linkedHabitDays(items) })
    expect(isDone('soc', '2026-11-16')).toBe(true)
    expect(isDone('soc', '2026-11-17')).toBe(false)
    expect(isDone('soc', '2026-11-18')).toBe(true)
  })
  it('también se puede marcar a mano', () => {
    const isDone = buildDoneLookup(logsFor('soc', ['2026-11-17']), { soc: new Set() })
    expect(isDone('soc', '2026-11-17')).toBe(true)
  })
})

describe('mentalState', () => {
  it('promedia ánimo y motivación, o usa el que haya', () => {
    expect(mentalState({ mood: 6, motivation: 8 })).toBe(7)
    expect(mentalState({ mood: 5 })).toBe(5)
    expect(mentalState({})).toBeNull()
    expect(mentalState(undefined)).toBeNull()
  })
})
