import { describe, expect, it } from 'vitest'
import { marginLabel, numberedItems, parseItemList, situationLabel, suggestedDeadline, toScheduleItems } from './plans'

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

describe('suggestedDeadline', () => {
  const base = { startDate: '2026-11-16', pace: 1, restWeekdays: [] as number[], blockedDates: [] as string[] }
  it('34 items at 1 per day from 16/11 → 19/12 (same as the baseline)', () => {
    expect(suggestedDeadline(34, base)).toBe('2026-12-19')
  })
  it('respects rest days and blocked dates', () => {
    expect(suggestedDeadline(6, { ...base, restWeekdays: [0] })).toBe('2026-11-21') // Mon–Sat
    expect(suggestedDeadline(7, { ...base, restWeekdays: [0] })).toBe('2026-11-23') // skips Sunday
    expect(suggestedDeadline(2, { ...base, blockedDates: ['2026-11-17'] })).toBe('2026-11-18')
  })
  it('fractional pace and amounts: 60 h at 2 h/day → 30 days', () => {
    expect(suggestedDeadline(60, { ...base, pace: 2 })).toBe('2026-12-15')
    expect(suggestedDeadline(3, { ...base, pace: 0.5 })).toBe('2026-11-21') // 6 days
  })
  it('nothing to plan or no available day → null', () => {
    expect(suggestedDeadline(0, base)).toBeNull()
    expect(suggestedDeadline(5, { ...base, pace: 0 })).toBeNull()
    expect(suggestedDeadline(5, { ...base, restWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toBeNull()
  })
})

describe('numberedItems', () => {
  it('numbers a prefix, or "Ítem" by default', () => {
    expect(numberedItems('Room', 3)).toBe('Room 1\nRoom 2\nRoom 3')
    expect(numberedItems('  ', 2)).toBe('Ítem 1\nÍtem 2')
    expect(numberedItems('Room', 0)).toBe('')
  })
})
