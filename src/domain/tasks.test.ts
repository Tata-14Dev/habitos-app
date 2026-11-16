import { describe, expect, it } from 'vitest'
import { extractTime, formatTask, parseDictation, sortTasks } from './tasks'

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
