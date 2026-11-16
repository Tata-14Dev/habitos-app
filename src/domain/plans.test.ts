import { describe, expect, it } from 'vitest'
import { marginLabel, parseItemList, situationLabel, toScheduleItems } from './plans'

describe('parseItemList', () => {
  it('un ítem por línea, con "Módulo: ítem" opcional', () => {
    expect(parseItemList('Intro: Room 1\nRoom 2\n\n  SIEM: Splunk Basics  ')).toEqual([
      { section: 'Intro', title: 'Room 1' },
      { title: 'Room 2' },
      { section: 'SIEM', title: 'Splunk Basics' },
    ])
  })
  it('ignora viñetas y numeración', () => {
    expect(parseItemList('- A\n2. B\n3) C\n• D')).toEqual([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }])
  })
  it('un "dos puntos" sin espacio no es sección (ej. horas)', () => {
    expect(parseItemList('Clase 10:30')).toEqual([{ title: 'Clase 10:30' }])
  })
})

describe('toScheduleItems', () => {
  it('ordena por order', () => {
    const r = toScheduleItems([
      { id: 'b', order: 2, done: false },
      { id: 'a', order: 1, done: true, doneDate: '2026-11-16' },
    ])
    expect(r).toEqual([{ id: 'a', done: true, doneDate: '2026-11-16' }, { id: 'b', done: false }])
  })
})

describe('labels', () => {
  it('situación', () => {
    expect(situationLabel(2)).toBe('✅ Al día (+2)')
    expect(situationLabel(0)).toBe('✅ Al día')
    expect(situationLabel(-3)).toBe('⚠️ Atrasado 3')
  })
  it('margen con singular y plural', () => {
    expect(marginLabel(4)).toBe('✅ Te sobran 4 días')
    expect(marginLabel(1)).toBe('✅ Te sobra 1 día')
    expect(marginLabel(0)).toBe('✅ Justo a tiempo')
    expect(marginLabel(-2)).toBe('⚠️ Te pasás 2 días')
  })
})
