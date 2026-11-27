import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addTasksFromText, carryOverTasks, pauseHabit, resumeHabit, saveHabit } from './repo'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const today = '2026-11-27'

describe('tasks from dictation', () => {
  it('each task goes to the day it names, after the ones already there', async () => {
    await addTasksFromText('2026-11-28', 'algo ya cargado')
    await addTasksFromText(today, 'comprar yerba, mañana dentista a las 10, el lunes llamar a Juan')
    const all = (await db.tasks.toArray()).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    expect(all.map((t) => [t.date, t.title, t.order])).toEqual([
      [today, 'Comprar yerba', 0],
      ['2026-11-28', 'Algo ya cargado', 0],
      ['2026-11-28', 'Dentista', 1],
      ['2026-11-30', 'Llamar a Juan', 0],
    ])
  })

  it('pending tasks of the last days move to today and remember where they came from', async () => {
    await addTasksFromText('2026-11-25', 'pagar la luz, regar')
    await addTasksFromText('2026-11-10', 'muy vieja')
    const regar = (await db.tasks.toArray()).find((t) => t.title === 'Regar')!
    await db.tasks.update(regar.id, { done: true })
    expect(await carryOverTasks(today)).toBe(1)
    expect(await carryOverTasks(today)).toBe(0) // idempotent
    const moved = (await db.tasks.toArray()).find((t) => t.title === 'Pagar la luz')!
    expect(moved).toMatchObject({ date: today, carriedFrom: '2026-11-25' })
    // Carried again the next day: it keeps the first day.
    await carryOverTasks('2026-11-28')
    expect(await db.tasks.get(moved.id)).toMatchObject({ date: '2026-11-28', carriedFrom: '2026-11-25' })
    expect((await db.tasks.toArray()).find((t) => t.title === 'Muy vieja')!.date).toBe('2026-11-10')
  })
})

describe('pause / resume', () => {
  it('pausing and resuming leaves a closed pause', async () => {
    const h = await saveHabit({ name: 'Correr', startDate: '2026-11-01' })
    await pauseHabit(h.id, '2026-11-20')
    expect((await db.habits.get(h.id))!.pauses).toEqual([{ from: '2026-11-20' }])
    await resumeHabit(h.id, today)
    expect((await db.habits.get(h.id))!.pauses).toEqual([{ from: '2026-11-20', to: '2026-11-26' }])
  })
})
