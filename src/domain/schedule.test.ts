/**
 * 🎓 Tests del ejercicio de reprogramación. Fallan con NotImplementedError hasta que
 * implementes cada función en schedule.ts. Ordenados de la más fácil a la más difícil.
 *
 *   npm test -- schedule                          → todos
 *   npm test -- schedule -t "isAvailableDay"      → solo una función (usá el nombre del describe)
 *   npm test -- schedule -t "Caso C"              → un caso de la sección 6 del brief
 */
import { describe, expect, it } from 'vitest'
import { addDays, weekday, type ISODate } from './dates'
import { isNotImplemented } from './errors'
import {
  buildBaseline,
  computePlanMetrics,
  countAvailableDays,
  isAvailableDay,
  nextAvailableDay,
  nthAvailableDay,
  projectSchedule,
  type ScheduleConfig,
  type ScheduleItem,
} from './schedule'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Ritmo 1, sin descanso, sin días libres, inicio 16/11/2026, límite 20/12/2026. */
function cfg(over: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    startDate: '2026-11-16',
    deadline: '2026-12-20',
    pace: 1,
    restWeekdays: [],
    blockedDates: [],
    ...over,
  }
}

/** n ítems pendientes con ids r1…rn. */
function makeItems(n: number): ScheduleItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, done: false }))
}

/** Marca como hechos los ítems indicados (por posición 1-based) con su doneDate. */
function markDone(items: ScheduleItem[], done: Record<number, ISODate>): ScheduleItem[] {
  return items.map((it, i) => (done[i + 1] ? { ...it, done: true, doneDate: done[i + 1] } : it))
}

function pendingDates(items: ScheduleItem[], proj: Record<string, ISODate>): ISODate[] {
  return items.filter((i) => !i.done).map((i) => proj[i.id])
}

/** Como `expect(fn).toThrow(type)`, pero un NotImplementedError no cuenta como "tiró el error correcto". */
function expectThrows(fn: () => unknown, type: new (...args: never[]) => Error = Error) {
  let err: unknown
  try {
    fn()
  } catch (e) {
    err = e
  }
  if (isNotImplemented(err)) throw err
  expect(err, "esperaba que tire un error").toBeInstanceOf(type)
}

// ─── 1. isAvailableDay ──────────────────────────────────────────────────────

describe('isAvailableDay', () => {
  it('sin descanso ni días libres, todo día está disponible', () => {
    expect(isAvailableDay('2026-11-16', cfg())).toBe(true)
    expect(isAvailableDay('2026-11-22', cfg())).toBe(true) // domingo
  })
  it('respeta los días de descanso de la semana', () => {
    const c = cfg({ restWeekdays: [0] })
    expect(isAvailableDay('2026-11-22', c)).toBe(false) // domingo
    expect(isAvailableDay('2026-11-21', c)).toBe(true) // sábado
  })
  it('respeta sábado y domingo', () => {
    const c = cfg({ restWeekdays: [6, 0] })
    expect(isAvailableDay('2026-11-21', c)).toBe(false)
    expect(isAvailableDay('2026-11-22', c)).toBe(false)
    expect(isAvailableDay('2026-11-23', c)).toBe(true)
  })
  it('respeta los días libres puntuales', () => {
    const c = cfg({ blockedDates: ['2026-12-24', '2026-12-25'] })
    expect(isAvailableDay('2026-12-24', c)).toBe(false)
    expect(isAvailableDay('2026-12-25', c)).toBe(false)
    expect(isAvailableDay('2026-12-26', c)).toBe(true)
  })
})

// ─── 2. nextAvailableDay ────────────────────────────────────────────────────

describe('nextAvailableDay', () => {
  it('devuelve el día siguiente si está disponible (nunca el mismo día)', () => {
    expect(nextAvailableDay('2026-11-16', cfg())).toBe('2026-11-17')
  })
  it('saltea días de descanso', () => {
    expect(nextAvailableDay('2026-11-21', cfg({ restWeekdays: [0] }))).toBe('2026-11-23')
    expect(nextAvailableDay('2026-11-20', cfg({ restWeekdays: [6, 0] }))).toBe('2026-11-23')
  })
  it('saltea días libres consecutivos', () => {
    expect(nextAvailableDay('2026-12-23', cfg({ blockedDates: ['2026-12-24', '2026-12-25'] }))).toBe('2026-12-26')
  })
  it('combina descanso y días libres', () => {
    // 2026-12-26 sábado, 27 domingo
    const c = cfg({ restWeekdays: [6, 0], blockedDates: ['2026-12-24', '2026-12-25'] })
    expect(nextAvailableDay('2026-12-23', c)).toBe('2026-12-28')
  })
  it('cruza de año', () => {
    expect(nextAvailableDay('2026-12-30', cfg({ blockedDates: ['2026-12-31'] }))).toBe('2027-01-01')
  })
  it('tira Error si ningún día puede estar disponible (no loop infinito)', () => {
    expectThrows(() => nextAvailableDay('2026-11-16', cfg({ restWeekdays: [0, 1, 2, 3, 4, 5, 6] })))
  })
})

// ─── 3. nthAvailableDay ─────────────────────────────────────────────────────

describe('nthAvailableDay', () => {
  it('n = 1 es el propio día si está disponible', () => {
    expect(nthAvailableDay('2026-11-16', 1, cfg())).toBe('2026-11-16')
  })
  it('n = 1 es el siguiente disponible si el día no lo está', () => {
    expect(nthAvailableDay('2026-11-22', 1, cfg({ restWeekdays: [0] }))).toBe('2026-11-23')
  })
  it('cuenta n días disponibles', () => {
    expect(nthAvailableDay('2026-11-16', 2, cfg())).toBe('2026-11-17')
    expect(nthAvailableDay('2026-11-16', 34, cfg())).toBe('2026-12-19')
  })
  it('saltea domingos', () => {
    // lunes 16/11 + 7 días disponibles sin domingo → lunes 23/11 es el 7.º
    expect(nthAvailableDay('2026-11-16', 7, cfg({ restWeekdays: [0] }))).toBe('2026-11-23')
  })
  it('saltea días libres', () => {
    expect(nthAvailableDay('2026-12-23', 2, cfg({ blockedDates: ['2026-12-24', '2026-12-25'] }))).toBe('2026-12-26')
  })
  it('tira RangeError si n no es un entero ≥ 1', () => {
    expectThrows(() => nthAvailableDay('2026-11-16', 0, cfg()), RangeError)
    expectThrows(() => nthAvailableDay('2026-11-16', -1, cfg()), RangeError)
    expectThrows(() => nthAvailableDay('2026-11-16', 1.5, cfg()), RangeError)
  })
  it('tira Error si ningún día puede estar disponible', () => {
    expectThrows(() => nthAvailableDay('2026-11-16', 1, cfg({ restWeekdays: [0, 1, 2, 3, 4, 5, 6] })))
  })
})

// ─── 4. countAvailableDays ──────────────────────────────────────────────────

describe('countAvailableDays', () => {
  it('es inclusivo en ambos extremos', () => {
    expect(countAvailableDays('2026-11-16', '2026-11-16', cfg())).toBe(1)
    expect(countAvailableDays('2026-11-16', '2026-11-17', cfg())).toBe(2)
    expect(countAvailableDays('2026-11-16', '2026-12-20', cfg())).toBe(35)
  })
  it('devuelve 0 si from > to', () => {
    expect(countAvailableDays('2026-11-17', '2026-11-16', cfg())).toBe(0)
  })
  it('descuenta descansos y días libres', () => {
    expect(countAvailableDays('2026-11-16', '2026-11-22', cfg({ restWeekdays: [0] }))).toBe(6)
    expect(countAvailableDays('2026-11-16', '2026-12-20', cfg({ restWeekdays: [0] }))).toBe(30)
    expect(countAvailableDays('2026-12-20', '2026-12-31', cfg({ blockedDates: ['2026-12-24', '2026-12-25', '2026-12-31'] }))).toBe(9)
  })
  it('un día libre fuera del rango no cuenta', () => {
    expect(countAvailableDays('2026-11-16', '2026-11-20', cfg({ blockedDates: ['2026-12-24'] }))).toBe(5)
  })
})

// ─── 5. buildBaseline ───────────────────────────────────────────────────────

describe('buildBaseline', () => {
  it('ritmo 1: un ítem por día desde el inicio', () => {
    const b = buildBaseline(makeItems(3), cfg())
    expect(b).toEqual({ r1: '2026-11-16', r2: '2026-11-17', r3: '2026-11-18' })
  })
  it('34 ítems terminan el 19/12', () => {
    const b = buildBaseline(makeItems(34), cfg())
    expect(b.r34).toBe('2026-12-19')
    expect(Object.keys(b)).toHaveLength(34)
  })
  it('ritmo 2: dos por día', () => {
    const b = buildBaseline(makeItems(5), cfg({ pace: 2 }))
    expect(b).toEqual({ r1: '2026-11-16', r2: '2026-11-16', r3: '2026-11-17', r4: '2026-11-17', r5: '2026-11-18' })
  })
  it('ritmo 0,5: uno cada dos días disponibles, empezando el día de inicio', () => {
    const b = buildBaseline(makeItems(3), cfg({ pace: 0.5 }))
    expect(b).toEqual({ r1: '2026-11-16', r2: '2026-11-18', r3: '2026-11-20' })
  })
  it('si el inicio no es disponible, arranca el siguiente disponible', () => {
    const b = buildBaseline(makeItems(2), cfg({ startDate: '2026-11-22', restWeekdays: [0] }))
    expect(b).toEqual({ r1: '2026-11-23', r2: '2026-11-24' })
  })
  it('incluye también los ítems hechos y no mira doneDate', () => {
    const items = markDone(makeItems(2), { 1: '2026-11-20' })
    expect(buildBaseline(items, cfg())).toEqual({ r1: '2026-11-16', r2: '2026-11-17' })
  })
  it('no modifica los ítems', () => {
    const items = makeItems(3)
    const copy = structuredClone(items)
    buildBaseline(items, cfg())
    expect(items).toEqual(copy)
  })
  it('tira RangeError si el ritmo no es > 0', () => {
    expectThrows(() => buildBaseline(makeItems(2), cfg({ pace: 0 })), RangeError)
    expectThrows(() => buildBaseline(makeItems(2), cfg({ pace: -1 })), RangeError)
  })
  it('lista vacía → objeto vacío', () => {
    expect(buildBaseline([], cfg())).toEqual({})
  })
})

// ─── 6. projectSchedule ─────────────────────────────────────────────────────

describe('projectSchedule', () => {
  it('antes del inicio: igual que el baseline', () => {
    const items = makeItems(5)
    expect(projectSchedule(items, cfg(), '2026-11-10')).toEqual(buildBaseline(items, cfg()))
  })
  it('hoy disponible y nada hecho hoy: el primer pendiente va hoy', () => {
    const p = projectSchedule(makeItems(3), cfg({ startDate: '2026-11-10' }), '2026-11-16')
    expect(p).toEqual({ r1: '2026-11-16', r2: '2026-11-17', r3: '2026-11-18' })
  })
  it('los hechos usan su doneDate', () => {
    const items = markDone(makeItems(3), { 1: '2026-11-12', 2: '2026-11-14' })
    const p = projectSchedule(items, cfg({ startDate: '2026-11-10' }), '2026-11-16')
    expect(p.r1).toBe('2026-11-12')
    expect(p.r2).toBe('2026-11-14')
    expect(p.r3).toBe('2026-11-16')
  })
  it('un hecho sin doneDate usa today', () => {
    const items: ScheduleItem[] = [{ id: 'r1', done: true }, { id: 'r2', done: false }]
    const p = projectSchedule(items, cfg(), '2026-11-16')
    expect(p.r1).toBe('2026-11-16')
  })
  it('cuota de hoy cumplida: el primer pendiente va mañana', () => {
    const items = markDone(makeItems(3), { 1: '2026-11-16' })
    const p = projectSchedule(items, cfg(), '2026-11-16')
    expect(p.r2).toBe('2026-11-17')
    expect(p.r3).toBe('2026-11-18')
  })
  it('hacer de más NO empuja hacia adelante', () => {
    const items = markDone(makeItems(6), { 1: '2026-11-16', 2: '2026-11-16', 3: '2026-11-16' })
    const p = projectSchedule(items, cfg(), '2026-11-16')
    expect(p.r4).toBe('2026-11-17')
    expect(p.r5).toBe('2026-11-18')
  })
  it('hechos de días anteriores no consumen la cuota de hoy', () => {
    const items = markDone(makeItems(3), { 1: '2026-11-15' })
    const p = projectSchedule(items, cfg({ startDate: '2026-11-15' }), '2026-11-16')
    expect(p.r2).toBe('2026-11-16')
  })
  it('hoy es día de descanso: el primer pendiente va el próximo disponible', () => {
    // 2026-11-22 es domingo
    const p = projectSchedule(makeItems(2), cfg({ startDate: '2026-11-16', restWeekdays: [0] }), '2026-11-22')
    expect(p).toEqual({ r1: '2026-11-23', r2: '2026-11-24' })
  })
  it('hoy es día libre puntual: el primer pendiente va el próximo disponible', () => {
    const p = projectSchedule(makeItems(2), cfg({ startDate: '2026-12-01', blockedDates: ['2026-12-24'] }), '2026-12-24')
    expect(p).toEqual({ r1: '2026-12-25', r2: '2026-12-26' })
  })
  it('el orden del array manda', () => {
    const items = makeItems(3)
    const p = projectSchedule([items[2], items[0], items[1]], cfg(), '2026-11-16')
    expect(p).toEqual({ r3: '2026-11-16', r1: '2026-11-17', r2: '2026-11-18' })
  })
  it('no modifica los ítems', () => {
    const items = markDone(makeItems(3), { 1: '2026-11-16' })
    const copy = structuredClone(items)
    projectSchedule(items, cfg(), '2026-11-16')
    expect(items).toEqual(copy)
  })
  it('tira RangeError si el ritmo no es > 0', () => {
    expectThrows(() => projectSchedule(makeItems(2), cfg({ pace: 0 }), '2026-11-16'), RangeError)
  })
})

// ─── 7. computePlanMetrics ──────────────────────────────────────────────────

describe('computePlanMetrics', () => {
  it('plan sin empezar', () => {
    const items = makeItems(34)
    const c = cfg()
    const m = computePlanMetrics(items, buildBaseline(items, c), projectSchedule(items, c, '2026-11-15'), c, '2026-11-15')
    expect(m).toEqual({
      total: 34,
      done: 0,
      pending: 34,
      shouldHaveDone: 0,
      diff: 0,
      estimatedEnd: '2026-12-19',
      marginDays: 1,
      requiredPace: 1,
      todayItemIds: [],
    })
  })
  it('todayItemIds lista los pendientes de hoy en orden', () => {
    const items = markDone(makeItems(5), { 1: '2026-11-16' })
    const c = cfg({ pace: 3 })
    const m = computePlanMetrics(items, buildBaseline(items, c), projectSchedule(items, c, '2026-11-16'), c, '2026-11-16')
    expect(m.todayItemIds).toEqual(['r2', 'r3'])
  })
  it('todo hecho: fin = doneDate más tardía, ritmo necesario 0', () => {
    const items = markDone(makeItems(3), { 1: '2026-11-16', 2: '2026-11-18', 3: '2026-11-17' })
    const c = cfg()
    const m = computePlanMetrics(items, buildBaseline(items, c), projectSchedule(items, c, '2026-11-18'), c, '2026-11-18')
    expect(m.pending).toBe(0)
    expect(m.estimatedEnd).toBe('2026-11-18')
    expect(m.marginDays).toBe(32)
    expect(m.requiredPace).toBe(0)
    expect(m.todayItemIds).toEqual([])
  })
  it('fin estimado después del límite → margen negativo', () => {
    const items = makeItems(40)
    const c = cfg()
    const m = computePlanMetrics(items, buildBaseline(items, c), projectSchedule(items, c, '2026-11-16'), c, '2026-11-16')
    expect(m.estimatedEnd).toBe('2026-12-25')
    expect(m.marginDays).toBe(-5)
    expect(m.requiredPace).toBe(1.1) // 40 / 35 = 1.142…
  })
  it('pasado el límite con pendientes → requiredPace null', () => {
    const items = makeItems(2)
    const c = cfg()
    const m = computePlanMetrics(items, buildBaseline(items, c), projectSchedule(items, c, '2026-12-21'), c, '2026-12-21')
    expect(m.requiredPace).toBeNull()
  })
  it('ítems sin fecha en el baseline (agregados después) no suman a shouldHaveDone', () => {
    const items = makeItems(3)
    const c = cfg()
    const baseline = { r1: '2026-11-16', r2: '2026-11-17' } // r3 agregado después
    const m = computePlanMetrics(items, baseline, projectSchedule(items, c, '2026-11-30'), c, '2026-11-30')
    expect(m.shouldHaveDone).toBe(2)
  })
  it('sin ítems: fin y margen null', () => {
    const c = cfg()
    const m = computePlanMetrics([], {}, {}, c, '2026-11-16')
    expect(m.total).toBe(0)
    expect(m.estimatedEnd).toBeNull()
    expect(m.marginDays).toBeNull()
  })
})

// ─── Casos obligatorios A–H (sección 6 del brief) ───────────────────────────

describe('Casos del brief', () => {
  it('Caso A: 34 ítems, inicio 16/11, hoy 15/11, nada hecho → fin 19/12, sobra 1 día', () => {
    const items = makeItems(34)
    const c = cfg()
    const today = '2026-11-15'
    const proj = projectSchedule(items, c, today)
    expect(proj.r1).toBe('2026-11-16')
    expect(proj.r34).toBe('2026-12-19')
    const m = computePlanMetrics(items, buildBaseline(items, c), proj, c, today)
    expect(m.estimatedEnd).toBe('2026-12-19')
    expect(m.marginDays).toBe(1)
  })

  it('Caso B: inicio 10/11, hoy 15/11, 3 hechos (10, 11 y 15/11) → atrasado 3, primer pendiente 16/11, fin 16/12', () => {
    const c = cfg({ startDate: '2026-11-10' })
    const today = '2026-11-15'
    const items = markDone(makeItems(34), { 1: '2026-11-10', 2: '2026-11-11', 3: '2026-11-15' })
    const baseline = buildBaseline(items, c)
    const proj = projectSchedule(items, c, today)
    expect(proj.r4).toBe('2026-11-16')
    const m = computePlanMetrics(items, baseline, proj, c, today)
    expect(m.shouldHaveDone).toBe(6)
    expect(m.done).toBe(3)
    expect(m.diff).toBe(-3)
    expect(m.estimatedEnd).toBe('2026-12-16')
    expect(m.marginDays).toBe(4)
  })

  it('Caso C: inicio y hoy 16/11, 3 hechos hoy → primer pendiente 17/11 (no 19/11), fin 17/12, al día +2', () => {
    const c = cfg()
    const today = '2026-11-16'
    const items = markDone(makeItems(34), { 1: today, 2: today, 3: today })
    const baseline = buildBaseline(items, c)
    const proj = projectSchedule(items, c, today)
    expect(proj.r4).toBe('2026-11-17')
    expect(proj.r34).toBe('2026-12-17')
    const m = computePlanMetrics(items, baseline, proj, c, today)
    expect(m.estimatedEnd).toBe('2026-12-17')
    expect(baseline.r34).toBe('2026-12-19') // dos días antes que el plan
    expect(m.shouldHaveDone).toBe(1)
    expect(m.diff).toBe(2)
  })

  it('Caso D: como A con domingos de descanso → ningún ítem en domingo, fin 24/12', () => {
    const items = makeItems(34)
    const c = cfg({ restWeekdays: [0] })
    const today = '2026-11-15'
    const proj = projectSchedule(items, c, today)
    const baseline = buildBaseline(items, c)
    for (const d of [...Object.values(proj), ...Object.values(baseline)]) expect(weekday(d)).not.toBe(0)
    const m = computePlanMetrics(items, baseline, proj, c, today)
    expect(m.estimatedEnd).toBe('2026-12-24')
    expect(m.marginDays).toBe(-4)
    expect(m.requiredPace).toBe(1.1) // 34 / 30
  })

  it('Caso E: como A con 24/12 y 25/12 libres y 40 ítems → ninguno el 24 ni el 25', () => {
    const items = makeItems(40)
    const c = cfg({ blockedDates: ['2026-12-24', '2026-12-25'] })
    const today = '2026-11-15'
    const proj = projectSchedule(items, c, today)
    const baseline = buildBaseline(items, c)
    for (const d of [...Object.values(proj), ...Object.values(baseline)]) {
      expect(d).not.toBe('2026-12-24')
      expect(d).not.toBe('2026-12-25')
    }
    expect(proj.r38).toBe('2026-12-23')
    expect(proj.r39).toBe('2026-12-26')
    expect(proj.r40).toBe('2026-12-27')
  })

  it('Caso F: ritmo 2, hoy 16/11, 1 hecho hoy → el primer pendiente va hoy, el 2.º y 3.º mañana', () => {
    const c = cfg({ pace: 2 })
    const today = '2026-11-16'
    const items = markDone(makeItems(10), { 1: today })
    const proj = projectSchedule(items, c, today)
    expect(proj.r2).toBe('2026-11-16')
    expect(proj.r3).toBe('2026-11-17')
    expect(proj.r4).toBe('2026-11-17')
    expect(proj.r5).toBe('2026-11-18')
  })

  it('Caso G: ritmo 0,5 → un ítem cada 2 días disponibles', () => {
    const c = cfg({ pace: 0.5 })
    const items = makeItems(4)
    // antes de empezar
    const before = projectSchedule(items, c, '2026-11-15')
    expect(pendingDates(items, before)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22'])
    // hoy = inicio, nada hecho: hoy toca uno
    const fresh = projectSchedule(items, c, '2026-11-16')
    expect(pendingDates(items, fresh)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22'])
    // hoy = inicio, 1 hecho hoy: el siguiente en 2 días
    const doneOne = markDone(items, { 1: '2026-11-16' })
    const after = projectSchedule(doneOne, c, '2026-11-16')
    expect(pendingDates(doneOne, after)).toEqual(['2026-11-18', '2026-11-20', '2026-11-22'])
    // con domingos de descanso, cada 2 días DISPONIBLES (20/11 vie → 23/11 lun salta el dom 22)
    const withRest = projectSchedule(items, cfg({ pace: 0.5, restWeekdays: [0] }), '2026-11-15')
    expect(pendingDates(items, withRest)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23'])
  })

  it('Caso H: mover el ítem 10 al primer lugar → la proyección se recalcula, el baseline no cambia', () => {
    const c = cfg()
    const today = '2026-11-16'
    const items = makeItems(34)
    const baseline = buildBaseline(items, c)
    const frozen = { ...baseline }
    const reordered = [items[9], ...items.slice(0, 9), ...items.slice(10)]
    const proj = projectSchedule(reordered, c, today)
    expect(proj.r10).toBe('2026-11-16')
    expect(proj.r1).toBe('2026-11-17')
    expect(proj.r11).toBe(addDays('2026-11-16', 10))
    // el plan original queda igual: guardado al crear, no se recalcula al reordenar
    expect(baseline).toEqual(frozen)
    expect(baseline.r10).toBe('2026-11-25')
    expect(baseline.r1).toBe('2026-11-16')
  })
})
