/**
 * 🎓 EJERCICIO DE TOMÁS — lógica de reprogramación de planes de estudio.
 *
 * Cada función tiene la firma, los tipos y un JSDoc con el enunciado. El cuerpo solo tira
 * `NotImplementedError`: tu trabajo es reemplazarlo por la implementación.
 *
 * - Tests:  npm test -- schedule                      (todos)
 *           npm test -- schedule -t "nthAvailableDay"  (una función)
 * - Guía con orden sugerido, casos borde y pistas: docs/GUIA_REPROGRAMACION.md
 *
 * Herramientas disponibles en `./dates`: addDays, weekday, diffDays, compareISO, maxISO, eachDay…
 * Todas las fechas son strings 'YYYY-MM-DD' locales: compararlas con compareISO (o < y > entre
 * strings, que funciona porque el formato es fijo), nunca con objetos Date.
 */
import type { ISODate } from './dates'
import { NotImplementedError } from './errors'

export type { ISODate }
export { NotImplementedError }

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Lo mínimo que el algoritmo necesita de un ítem del plan. El orden del array ES el orden del plan. */
export interface ScheduleItem {
  id: string
  done: boolean
  /** Fecha real en que se hizo. Solo tiene sentido si `done` es true. */
  doneDate?: ISODate
}

/** Configuración de un plan para calcular calendarios. */
export interface ScheduleConfig {
  startDate: ISODate
  deadline: ISODate
  /** Ítems por día disponible. Mayor que 0. Puede ser fraccionario (0.5 = uno cada 2 días disponibles). */
  pace: number
  /** Días de la semana sin estudio: 0 = domingo … 6 = sábado. */
  restWeekdays: readonly number[]
  /** Días libres puntuales. */
  blockedDates: readonly ISODate[]
}

/** itemId → fecha asignada. */
export type DateMap = Record<string, ISODate>

/** Métricas del panel del plan. */
export interface PlanMetrics {
  /** Cantidad total de ítems. */
  total: number
  /** "llevo": ítems hechos. */
  done: number
  /** Ítems pendientes. */
  pending: number
  /** "deberíaLlevar": ítems cuya fecha del plan original es ≤ hoy (los que no están en el baseline no cuentan). */
  shouldHaveDone: number
  /** done − shouldHaveDone. Positivo = adelantado ("✅ Al día (+2)"), negativo = atrasado ("⚠️ Atrasado 3"). */
  diff: number
  /** Fecha proyectada más tardía entre los pendientes; si no hay pendientes, la doneDate más tardía. `null` si el plan no tiene ítems. */
  estimatedEnd: ISODate | null
  /** deadline − estimatedEnd en días corridos. Positivo = "Te sobran N días", negativo = "Te pasás N días". `null` si estimatedEnd es null. */
  marginDays: number | null
  /**
   * pendientes / díasDisponibles(base … deadline), redondeado a 1 decimal, con base = max(today, startDate).
   * 0 si no quedan pendientes. `null` si quedan pendientes pero no queda ningún día disponible.
   */
  requiredPace: number | null
  /** Ids de los ítems pendientes que la proyección pone hoy, en el orden del plan. */
  todayItemIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones (de la más simple a la más compleja)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Se puede estudiar ese día?
 *
 * Un día está disponible si su día de la semana NO está en `config.restWeekdays`
 * y la fecha NO está en `config.blockedDates`.
 *
 * @example
 * // 2026-11-22 es domingo
 * isAvailableDay('2026-11-22', { ...cfg, restWeekdays: [0] }) // → false
 * isAvailableDay('2026-12-24', { ...cfg, blockedDates: ['2026-12-24'] }) // → false
 * isAvailableDay('2026-11-23', { ...cfg, restWeekdays: [0] }) // → true
 */
export function isAvailableDay(date: ISODate, config: ScheduleConfig): boolean {
  throw new NotImplementedError('isAvailableDay')
}

/**
 * Primer día disponible **estrictamente después** de `date` (nunca devuelve `date`).
 *
 * Si `config.restWeekdays` contiene los 7 días de la semana no existe ningún día disponible:
 * en ese caso tirá un `Error` en vez de quedarte en un loop infinito.
 *
 * @example
 * // sin descanso
 * nextAvailableDay('2026-11-16', cfg) // → '2026-11-17'
 * // domingos de descanso; 2026-11-21 es sábado
 * nextAvailableDay('2026-11-21', { ...cfg, restWeekdays: [0] }) // → '2026-11-23'
 */
export function nextAvailableDay(date: ISODate, config: ScheduleConfig): ISODate {
  throw new NotImplementedError('nextAvailableDay')
}

/**
 * El n-ésimo día disponible contando desde `from` **inclusive** (n = 1 es el primero).
 * Si `from` está disponible, `nthAvailableDay(from, 1, cfg) === from`.
 *
 * - `n` tiene que ser un entero ≥ 1; si no, tirá `RangeError`.
 * - Igual que `nextAvailableDay`: si no puede existir ningún día disponible, tirá `Error`.
 *
 * @example
 * nthAvailableDay('2026-11-16', 1, cfg)  // → '2026-11-16'
 * nthAvailableDay('2026-11-16', 34, cfg) // → '2026-12-19'
 * // domingos de descanso: 2026-11-22 es domingo
 * nthAvailableDay('2026-11-22', 1, { ...cfg, restWeekdays: [0] }) // → '2026-11-23'
 */
export function nthAvailableDay(from: ISODate, n: number, config: ScheduleConfig): ISODate {
  throw new NotImplementedError('nthAvailableDay')
}

/**
 * Cantidad de días disponibles entre `from` y `to`, **ambos inclusive**.
 * Devuelve 0 si `from > to`.
 *
 * @example
 * countAvailableDays('2026-11-16', '2026-11-16', cfg) // → 1
 * countAvailableDays('2026-11-16', '2026-12-20', cfg) // → 35
 * countAvailableDays('2026-11-16', '2026-11-22', { ...cfg, restWeekdays: [0] }) // → 6
 * countAvailableDays('2026-11-17', '2026-11-16', cfg) // → 0
 */
export function countAvailableDays(from: ISODate, to: ISODate, config: ScheduleConfig): number {
  throw new NotImplementedError('countAvailableDays')
}

/**
 * Plan original (baseline): una fecha para CADA ítem (hecho o no), según su posición.
 *
 * El ítem en la posición `i` (1-based, entre todos los ítems) va en:
 *
 *     nthAvailableDay(config.startDate, floor((i − 1) / pace) + 1)
 *
 * (Con ritmo entero es lo mismo que `ceil(i / pace)`; esta forma hace que con ritmo 0,5 el
 * primer ítem caiga el día de inicio: días 1, 3, 5…)
 *
 * - No mira `done` ni `doneDate`, ni "hoy": solo el orden y la configuración.
 * - No modifica `items`.
 * - `pace` tiene que ser > 0; si no, tirá `RangeError`.
 *
 * @example
 * // 3 ítems, inicio 2026-11-16, ritmo 1
 * buildBaseline(items, cfg) // → { a: '2026-11-16', b: '2026-11-17', c: '2026-11-18' }
 * // ritmo 2 → { a: '2026-11-16', b: '2026-11-16', c: '2026-11-17' }
 * // ritmo 0.5 → { a: '2026-11-16', b: '2026-11-18', c: '2026-11-20' }
 */
export function buildBaseline(items: readonly ScheduleItem[], config: ScheduleConfig): DateMap {
  throw new NotImplementedError('buildBaseline')
}

/**
 * Proyección: reparte los pendientes desde hoy. Se recalcula en cada cambio.
 * Devuelve una fecha para CADA ítem.
 *
 * 1. `base = max(today, config.startDate)`.
 * 2. **Ítems hechos**: usan su `doneDate` (si les falta, usá `today`).
 * 3. **Caso "el plan todavía no empezó"** (`base > today`): el k-ésimo pendiente (1-based)
 *    va en `nthAvailableDay(base, floor((k − 1) / pace) + 1)`. Igual que el baseline, pero
 *    contando solo pendientes.
 * 4. **Caso "hoy es día de estudio"** (`base == today` y hoy está disponible):
 *    - `capacidadDeHoy = ceil(pace)` (ritmo 1 → 1, ritmo 2 → 2, ritmo 0,5 → 1).
 *    - `doneToday` = cantidad de ítems hechos con `doneDate == today`.
 *    - `remainingToday = max(0, capacidadDeHoy − doneToday)`.
 *    - k-ésimo pendiente con `k ≤ remainingToday` → `today`.
 *    - si no → `nthAvailableDay(nextAvailableDay(today), ceil((k − remainingToday) / pace))`.
 * 5. **Caso "hoy no se estudia"** (`base == today` pero hoy NO está disponible):
 *    k-ésimo pendiente → `nthAvailableDay(nextAvailableDay(today), floor((k − 1) / pace) + 1)`.
 *
 * ⚠️ Regla de oro: **hacer de más nunca empuja hacia adelante**. Si hoy hiciste 3 con ritmo 1,
 * el primer pendiente va MAÑANA (no dentro de 3 días). Fijate que `remainingToday` nunca es
 * negativo: eso es lo que lo garantiza.
 *
 * - No modifica `items`. `pace` tiene que ser > 0; si no, tirá `RangeError`.
 *
 * @example
 * // ritmo 1, hoy 2026-11-16 (= inicio), los 3 primeros hechos hoy, 34 ítems:
 * projectSchedule(items, cfg, '2026-11-16')
 * // → hechos: '2026-11-16'; 4.º ítem: '2026-11-17'; …; 34.º: '2026-12-17'
 */
export function projectSchedule(
  items: readonly ScheduleItem[],
  config: ScheduleConfig,
  today: ISODate,
): DateMap {
  throw new NotImplementedError('projectSchedule')
}

/**
 * Métricas del panel. Ver la definición de cada campo en `PlanMetrics`.
 *
 * - `shouldHaveDone`: ítems con `baseline[id] <= today`.
 * - `estimatedEnd`: la fecha de `projection` más tardía entre los pendientes; si no hay
 *   pendientes, la `doneDate` más tardía (o la de `projection` si falta); `null` sin ítems.
 * - `marginDays = diffDays(deadline, estimatedEnd)`.
 * - `requiredPace = round1(pending / countAvailableDays(base, deadline))`, `base = max(today, startDate)`.
 * - `todayItemIds`: pendientes con `projection[id] == today`.
 *
 * @example
 * // 34 ítems, inicio 2026-11-16, hoy 2026-11-15, nada hecho, límite 2026-12-20
 * // → { total: 34, done: 0, pending: 34, shouldHaveDone: 0, diff: 0,
 * //     estimatedEnd: '2026-12-19', marginDays: 1, requiredPace: 1, todayItemIds: [] }
 */
export function computePlanMetrics(
  items: readonly ScheduleItem[],
  baseline: DateMap,
  projection: DateMap,
  config: ScheduleConfig,
  today: ISODate,
): PlanMetrics {
  throw new NotImplementedError('computePlanMetrics')
}
