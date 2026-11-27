import { describe, expect, it } from 'vitest'
import { extractTime, formatTask, parseDictation, sortTasks, tasksToCarry } from './tasks'

describe('extractTime', () => {
  it.each([
    ['dentista a las 15 horas', '15:00', 'dentista'],
    ['dentista a las 15', '15:00', 'dentista'],
    ['reunión a las 9:30', '09:30', 'reunión'],
    ['reunión 18.45 hs', '18:45', 'reunión'],
    ['gimnasio 19 hs', '19:00', 'gimnasio'],
    ['clase a las 9 y media', '09:30', 'clase'],
    ['llamar a mamá a las 8 y cuarto', '08:15', 'llamar a mamá'],
    ['turno a las 5 menos cuarto de la tarde', '16:45', 'turno'],
    ['almuerzo a las 3 de la tarde', '15:00', 'almuerzo'],
    ['cena a las diez de la noche', '22:00', 'cena'],
    ['correr a las seis de la mañana', '06:00', 'correr'],
    ['pagar el gas a las 3 pm', '15:00', 'pagar el gas'],
    ['almuerzo al mediodía', '12:00', 'almuerzo'],
    ['a las 21 estudiar', '21:00', 'estudiar'],
    ['para las 10 entregar el TP', '10:00', 'entregar el TP'],
  ])('"%s" → %s', (input, time, rest) => {
    const r = extractTime(input)
    expect(r.time).toBe(time)
    expect(r.rest).toBe(rest)
  })

  it('sin hora deja el texto igual', () => {
    expect(extractTime('comprar yerba')).toEqual({ rest: 'comprar yerba' })
  })
  it('no confunde cantidades con horas', () => {
    expect(extractTime('comprar 2 kilos de papa').time).toBeUndefined()
    expect(extractTime('hacer 3 rooms').time).toBeUndefined()
  })
  it('ignora horas imposibles', () => {
    expect(extractTime('algo a las 27').time).toBeUndefined()
  })
})

describe('parseDictation', () => {
  it('el ejemplo de Tomás: "dentista a las 15 horas" → 15:00 Dentista', () => {
    expect(parseDictation('dentista a las 15 horas')).toEqual([{ time: '15:00', title: 'Dentista' }])
  })
  it('separa por comas y puntos (como escribe el dictado del iPhone)', () => {
    expect(parseDictation('Hoy tengo dentista a las 15, comprar yerba. Llamar a Juan.')).toEqual([
      { time: '15:00', title: 'Dentista' },
      { title: 'Comprar yerba' },
      { title: 'Llamar a Juan' },
    ])
  })
  it('separa por "después" / "luego" / "y también"', () => {
    expect(parseDictation('ir al banco después pasar por la farmacia y también comprar pan')).toEqual([
      { title: 'Ir al banco' },
      { title: 'Pasar por la farmacia' },
      { title: 'Comprar pan' },
    ])
  })
  it('no corta en "y" común ni en la hora con punto', () => {
    expect(parseDictation('comprar pan y leche a las 18.30')).toEqual([{ time: '18:30', title: 'Comprar pan y leche' }])
  })
  it('una línea por tarea y viñetas', () => {
    expect(parseDictation('- lavar ropa\n- 20 hs cena con Ana')).toEqual([
      { title: 'Lavar ropa' },
      { time: '20:00', title: 'Cena con Ana' },
    ])
  })
  it('solo una hora → "Recordatorio"', () => {
    expect(parseDictation('a las 7')).toEqual([{ time: '07:00', title: 'Recordatorio' }])
  })
  it('texto vacío → nada', () => {
    expect(parseDictation('  , . \n')).toEqual([])
  })
})

describe('sortTasks / formatTask', () => {
  it('primero las que tienen hora, ordenadas; después el resto en su orden', () => {
    const tasks = [
      { title: 'Yerba', order: 0 },
      { title: 'Dentista', time: '15:00', order: 1 },
      { title: 'Gym', time: '08:00', order: 2 },
      { title: 'Juan', order: 3 },
    ]
    expect(sortTasks(tasks).map((t) => t.title)).toEqual(['Gym', 'Dentista', 'Yerba', 'Juan'])
  })
  it('formatea "15:00 Dentista"', () => {
    expect(formatTask({ time: '15:00', title: 'Dentista' })).toBe('15:00 Dentista')
    expect(formatTask({ title: 'Comprar yerba' })).toBe('Comprar yerba')
  })
})

describe('dates in dictation', () => {
  // Friday 27/11/2026.
  const today = '2026-11-27'
  it.each([
    ['dentista mañana a las 10', '2026-11-28', '10:00', 'Dentista'],
    ['pasado mañana entregar el TP', '2026-11-29', undefined, 'Entregar el TP'],
    ['el lunes llamar a Juan', '2026-11-30', undefined, 'Llamar a Juan'],
    ['pagar la luz el próximo miércoles', '2026-12-02', undefined, 'Pagar la luz'],
    ['el viernes que viene partido', '2026-12-04', undefined, 'Partido'],
    ['cumple de Ana el 15 de diciembre', '2026-12-15', undefined, 'Cumple de Ana'],
    ['turno el 3/12 a las 9', '2026-12-03', '09:00', 'Turno'],
    ['vence el 5', '2026-12-05', undefined, 'Vence'],
    ['vence el 30', '2026-11-30', undefined, 'Vence'],
    ['para mañana comprar pan', '2026-11-28', undefined, 'Comprar pan'],
    ['mañana tengo médico', '2026-11-28', undefined, 'Médico'],
  ])('"%s" → %s', (input, date, time, title) => {
    expect(parseDictation(input, today)).toEqual([{ date, ...(time ? { time } : {}), title }])
  })
  it('a date that already passed this year goes to next year', () => {
    expect(parseDictation('renovar el 10 de enero', today)).toEqual([{ date: '2027-01-10', title: 'Renovar' }])
  })
  it('"hoy" and no day stay today (no date field)', () => {
    expect(parseDictation('hoy comprar yerba, llamar a mamá', today)).toEqual([{ title: 'Comprar yerba' }, { title: 'Llamar a mamá' }])
  })
  it('"de la mañana" / "a la mañana" / "esta mañana" are moments, not tomorrow', () => {
    expect(parseDictation('correr a las 7 de la mañana', today)).toEqual([{ time: '07:00', title: 'Correr' }])
    expect(parseDictation('correr a la mañana', today)).toEqual([{ title: 'Correr a la mañana' }])
    expect(parseDictation('esta mañana regar', today)[0].date).toBeUndefined()
  })
  it('a heading "Mañana:" applies to every task after it', () => {
    expect(parseDictation('Mañana: comprar pan, lavar el auto. El lunes: gimnasio', today)).toEqual([
      { date: '2026-11-28', title: 'Comprar pan' },
      { date: '2026-11-28', title: 'Lavar el auto' },
      { date: '2026-11-30', title: 'Gimnasio' },
    ])
  })
  it('without today, days are not looked for (old behavior)', () => {
    expect(parseDictation('mañana comprar pan')).toEqual([{ title: 'Mañana comprar pan' }])
  })
  it('quantities are not days', () => {
    expect(parseDictation('comprar 2 kilos de papa', today)).toEqual([{ title: 'Comprar 2 kilos de papa' }])
  })
})

describe('tasksToCarry', () => {
  const today = '2026-11-27'
  const t = (date: string, done = false, deletedAt?: string) => ({ date, done, deletedAt })
  it('pending tasks of the last 7 days move to today; done, deleted, future and older ones stay', () => {
    const tasks = [t('2026-11-26'), t('2026-11-20'), t('2026-11-19'), t('2026-11-26', true), t('2026-11-25', false, 'x'), t('2026-11-27'), t('2026-11-28')]
    expect(tasksToCarry(tasks, today).map((x) => x.date)).toEqual(['2026-11-26', '2026-11-20'])
  })
})
