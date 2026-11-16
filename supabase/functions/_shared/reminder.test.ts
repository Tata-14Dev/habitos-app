import { describe, expect, it } from 'vitest'
import { buildReminder, dueDate, localNow } from './reminder'

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
