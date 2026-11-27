import { describe, expect, it } from 'vitest'
import { amountDueToday, buildReminder, buildWeeklySummary, dueDate, habitDueOn, localNow, weeklyDueDate } from './reminder'

const BA = 'America/Argentina/Buenos_Aires' // UTC−3

describe('localNow', () => {
  it('convierte a la hora local de Buenos Aires', () => {
    expect(localNow(new Date('2026-11-16T11:05:00Z'), BA)).toEqual({ date: '2026-11-16', time: '08:05' })
    expect(localNow(new Date('2026-11-17T02:30:00Z'), BA)).toEqual({ date: '2026-11-16', time: '23:30' })
  })
})

describe('dueDate', () => {
  const s = { reminderEnabled: true, reminderTime: '08:00', timeZone: BA }
  it('envía a partir de la hora configurada', () => {
    expect(dueDate(new Date('2026-11-16T10:59:00Z'), s, undefined)).toBeNull() // 07:59
    expect(dueDate(new Date('2026-11-16T11:00:00Z'), s, undefined)).toBe('2026-11-16') // 08:00
    expect(dueDate(new Date('2026-11-16T11:04:00Z'), s, undefined)).toBe('2026-11-16')
  })
  it('una sola vez por día', () => {
    expect(dueDate(new Date('2026-11-16T11:05:00Z'), s, '2026-11-16')).toBeNull()
    expect(dueDate(new Date('2026-11-17T11:05:00Z'), s, '2026-11-16')).toBe('2026-11-17')
  })
  it('no manda tarde (fuera de la ventana de 1 h)', () => {
    expect(dueDate(new Date('2026-11-16T12:00:00Z'), s, undefined)).toBeNull() // 09:00
  })
  it('desactivado → nunca', () => {
    expect(dueDate(new Date('2026-11-16T11:00:00Z'), { ...s, reminderEnabled: false }, undefined)).toBeNull()
  })
})

describe('buildReminder', () => {
  const base = { tasks: [], habits: [], plans: [], planItems: [], projections: [] }
  it('junta tareas, rooms del plan y hábitos', () => {
    const r = buildReminder('2026-11-16', {
      tasks: [
        { date: '2026-11-16', title: 'Comprar yerba', done: false },
        { date: '2026-11-16', time: '15:00', title: 'Dentista', done: false },
        { date: '2026-11-16', title: 'Hecha', done: true },
        { date: '2026-11-17', title: 'Mañana', done: false },
      ],
      habits: [
        { id: 'h1', name: 'Leer', startDate: '2026-01-01' },
        { id: 'h2', name: 'Viejo', startDate: '2025-01-01', endDate: '2025-12-31' },
      ],
      plans: [{ id: 'p', name: 'SOC' }],
      planItems: [
        { id: 'i1', planId: 'p', title: 'Room 12', done: false },
        { id: 'i2', planId: 'p', title: 'Room 13', done: false },
      ],
      projections: [{ planId: 'p', dates: { i1: '2026-11-16', i2: '2026-11-17' } }],
    })
    expect(r.title).toBe('Buen día ☀️')
    expect(r.body).toBe('📝 15:00 Dentista · Comprar yerba\n📚 SOC: Room 12\n✅ 1 hábito para hoy')
  })
  it('sin nada cargado', () => {
    expect(buildReminder('2026-11-16', base).body).toMatch(/Dictás tu día/)
  })
})

describe('amount plans', () => {
  // 2026-11-16 is a Monday
  const plan = { id: 'p', name: 'Inglés', kind: 'amount' as const, unit: 'horas', target: 10, pace: 2, startDate: '2026-11-16', restWeekdays: [0] }
  it('a study day: full quota minus what was already done today', () => {
    expect(amountDueToday(plan, [], '2026-11-16')).toBe(2)
    expect(amountDueToday(plan, [{ date: '2026-11-16', amount: 0.5 }], '2026-11-16')).toBe(1.5)
  })
  it('rest day, not started, or finished → nothing', () => {
    expect(amountDueToday(plan, [], '2026-11-22')).toBe(0) // Sunday
    expect(amountDueToday(plan, [], '2026-11-15')).toBe(0)
    expect(amountDueToday(plan, [{ date: '2026-11-17', amount: 10 }], '2026-11-18')).toBe(0)
  })
  it('never more than what is left', () => {
    expect(amountDueToday(plan, [{ date: '2026-11-17', amount: 9 }], '2026-11-18')).toBe(1)
  })
  it('shows up in the reminder', () => {
    const r = buildReminder('2026-11-16', { tasks: [], habits: [], plans: [plan], planItems: [], projections: [], planLogs: [] })
    expect(r.body).toBe('📚 Inglés: hoy tocan 2 horas')
  })
})

describe('habit types in the reminder', () => {
  const base = { startDate: '2026-11-01' }
  it('counts only habits due that day', () => {
    // 2026-11-17 is a Tuesday
    expect(habitDueOn({ id: 'a', name: 'Cama', ...base }, '2026-11-17')).toBe(true)
    expect(habitDueOn({ id: 'b', name: 'Natación', ...base, kind: 'scheduled', weekdays: [1, 3] }, '2026-11-17')).toBe(false)
    expect(habitDueOn({ id: 'c', name: 'Service', ...base, kind: 'scheduled', onDate: '2026-11-17' }, '2026-11-17')).toBe(true)
    expect(habitDueOn({ id: 'd', name: 'Gym', ...base, kind: 'progress', goal: { type: 'times' } }, '2026-11-17')).toBe(false)
    expect(habitDueOn({ id: 'e', name: 'Estudiar', ...base, kind: 'progress', goal: { type: 'amount', period: 'day' } }, '2026-11-17')).toBe(true)
  })
  it('the count in the message follows that rule', () => {
    const r = buildReminder('2026-11-17', {
      tasks: [],
      plans: [],
      planItems: [],
      projections: [],
      habits: [
        { id: 'a', name: 'Cama', ...base },
        { id: 'b', name: 'Natación', ...base, kind: 'scheduled', weekdays: [1, 3] },
      ],
    })
    expect(r.body).toBe('✅ 1 hábito para hoy')
  })
  it('paused habits are not due', () => {
    const h = { id: 'a', name: 'Correr', ...base, pauses: [{ from: '2026-11-15', to: '2026-11-20' }] }
    expect(habitDueOn(h, '2026-11-17')).toBe(false)
    expect(habitDueOn(h, '2026-11-21')).toBe(true)
    expect(habitDueOn({ ...h, pauses: [{ from: '2026-11-15' }] }, '2026-12-25')).toBe(false)
  })
  it('pending tasks of the last 7 days count (they move to today in the app)', () => {
    const r = buildReminder('2026-11-17', {
      tasks: [
        { date: '2026-11-16', title: 'Pagar la luz', done: false },
        { date: '2026-11-16', title: 'Hecha', done: true },
        { date: '2026-11-01', title: 'Muy vieja', done: false },
        { date: '2026-11-17', time: '10:00', title: 'Dentista', done: false },
      ],
      plans: [],
      planItems: [],
      projections: [],
      habits: [],
    })
    expect(r.body).toBe('📝 10:00 Dentista · Pagar la luz')
  })
})

describe('weekly summary', () => {
  // 2026-11-22 is a Sunday; 20:05 in Buenos Aires = 23:05 UTC.
  const sunday2005 = new Date('2026-11-22T23:05:00Z')
  it('goes out on Sundays from 20:00, once, for people with reminders on', () => {
    expect(weeklyDueDate(sunday2005, { reminderEnabled: true, timeZone: BA }, undefined)).toBe('2026-11-22')
    expect(weeklyDueDate(sunday2005, { reminderEnabled: true, timeZone: BA }, '2026-11-22')).toBeNull()
    expect(weeklyDueDate(new Date('2026-11-21T23:05:00Z'), { reminderEnabled: true, timeZone: BA }, undefined)).toBeNull() // Saturday
    expect(weeklyDueDate(new Date('2026-11-22T22:30:00Z'), { reminderEnabled: true, timeZone: BA }, undefined)).toBeNull() // 19:30
  })
  it('can be turned off, or on without the morning reminder', () => {
    expect(weeklyDueDate(sunday2005, { reminderEnabled: true, weeklySummary: false, timeZone: BA }, undefined)).toBeNull()
    expect(weeklyDueDate(sunday2005, { reminderEnabled: false, weeklySummary: true, timeZone: BA }, undefined)).toBe('2026-11-22')
    expect(weeklyDueDate(sunday2005, { timeZone: BA }, undefined)).toBeNull()
  })

  const days = (from: number, to: number, month = 11) => Array.from({ length: to - from + 1 }, (_, i) => `2026-${month}-${String(from + i).padStart(2, '0')}`)
  it('habits % vs last week, plan progress and weight', () => {
    const r = buildWeeklySummary('2026-11-22', {
      tasks: [],
      projections: [],
      habits: [{ id: 'cama', name: 'Cama', startDate: '2026-11-01' }],
      habitLogs: [
        ...days(16, 21).map((date) => ({ habitId: 'cama', date, done: true })), // 6 of 7 this week
        ...days(9, 15).slice(0, 5).map((date) => ({ habitId: 'cama', date, done: true })), // 5 of 7 last week
      ],
      plans: [
        { id: 'soc', name: 'SOC', kind: 'items' },
        { id: 'eng', name: 'Inglés', kind: 'amount', unit: 'horas' },
      ],
      planItems: [
        { id: 'r1', planId: 'soc', title: 'Room 1', done: true, prior: true, order: 0 },
        { id: 'r2', planId: 'soc', title: 'Room 2', done: true, doneDate: '2026-11-17', order: 1 },
        { id: 'r3', planId: 'soc', title: 'Room 3', done: true, doneDate: '2026-11-20', order: 2 },
        { id: 'r4', planId: 'soc', title: 'Room 4', done: false, order: 3 },
      ],
      planLogs: [
        { planId: 'eng', date: '2026-11-17', amount: 1.5 },
        { planId: 'eng', date: '2026-11-19', amount: 2 },
        { planId: 'eng', date: '2026-11-10', amount: 9 }, // last week: not counted
      ],
      bodyWeights: [
        { date: '2026-11-10', kg: 80 },
        { date: '2026-11-12', kg: 80.2 },
        { date: '2026-11-18', kg: 79.7 },
        { date: '2026-11-21', kg: 79.7 },
      ],
    })
    expect(r.title).toBe('Tu semana 📊')
    expect(r.body.split('\n')).toEqual([
      '✅ Hábitos: 86% (la anterior: 71%) ↑',
      '📚 SOC: 2 esta semana · vas por Room 4',
      '📚 Inglés: 3,5 horas esta semana',
      '⚖️ Peso: −0,4 kg vs la semana anterior',
    ])
  })
  it('a quiet week still gets a message', () => {
    expect(buildWeeklySummary('2026-11-22', { tasks: [], habits: [], plans: [], planItems: [], projections: [], habitLogs: [] }).body).toMatch(/Semana tranquila/)
  })
})
