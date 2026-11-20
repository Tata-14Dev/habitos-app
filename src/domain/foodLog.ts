/**
 * Meal text → items → kcal.
 *
 * Format (see docs/COMIDAS.md): one item per line, or several separated by commas, ";", "+"
 * or " y ". Each item is `<cantidad> <unidad> <alimento>`:
 *
 *   200 g arroz · 2 huevos · 1 taza de leche · 1/2 palta · medio kilo de papa · 1 cda de aceite
 *
 * - Quantity: 2, 1,5, 1.5, 1/2, 1 1/2, ½, un/una/medio/media/dos…diez, "1 y medio". Missing → 1.
 * - Unit: g, kg, ml, cc, l and household units (taza, vaso, cda, cdta, feta, rebanada, porción,
 *   plato, unidad). Missing → unidad ("2 huevos"). The connector "de" after the unit is optional.
 * - Food: looked up in the user's custom foods first, then the built-in dictionary: exact
 *   name/alias → singularized → accent-insensitive → fuzzy (small edit distance) → partial.
 *
 * Everything here is pure and never throws on user input: what can't be computed comes back as
 * an unresolved line with a reason the UI can show.
 */
import { FOODS, type FoodDef, type HouseholdUnit } from './foods'

export type FoodUnit = 'g' | 'ml' | HouseholdUnit

/** Generic volume of household units (ml), used when a food doesn't define its own. */
export const GENERIC_ML: Partial<Record<FoodUnit, number>> = { taza: 240, vaso: 200, cda: 15, cdta: 5 }

const MAX_LINES = 60
const MAX_QUANTITY = 100_000
/** Partial matches must cover at least this share of the query's letters. */
const MIN_PARTIAL_RATIO = 0.4

// ─── Text helpers ───────────────────────────────────────────────────────────

/** Lowercase, no accents (ñ → n too), only letters/digits and single spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Lowercase with accents kept, punctuation removed. */
function lower(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Canonical form of a word so that singular and plural meet: "huevos"/"huevo" → "huevo",
 * "panes"/"pan" → "pan", "nueces"/"nuez" → "nuez", "tomates"/"tomate" → "tomat".
 * Applied to both the dictionary keys and the query, so it only has to be consistent.
 */
function stemWord(w: string): string {
  if (w.length <= 2 || /^\d/.test(w)) return w
  let x = w
  if (x.endsWith('ces')) x = x.slice(0, -3) + 'z'
  else if (x.endsWith('es')) x = x.slice(0, -2)
  else if (x.endsWith('s')) x = x.slice(0, -1)
  if (x.length > 2 && x.endsWith('e')) x = x.slice(0, -1)
  return x
}

const stem = (s: string) => s.split(' ').filter(Boolean).map(stemWord).join(' ')

/** Levenshtein distance, giving up (returns max + 1) once it exceeds `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// ─── Splitting and parsing ──────────────────────────────────────────────────

/**
 * Splits a meal text into item strings: newlines, ";", "+", commas that aren't decimal
 * separators ("1,5 kg" stays together), periods that aren't decimals, and " y " (except
 * "1 y medio").
 */
export function splitFoodText(text: string): string[] {
  if (typeof text !== 'string') return []
  return text
    .split(/\n|;|\+|(?<!\d),|,(?!\d)|\.(?!\d)|\s+y\s+(?!medi[oa]\b)|\s+e\s+(?=[ií])/i)
    .map((p) => p.trim())
    .filter((p) => p && /[\p{L}\p{N}]/u.test(p))
    .slice(0, MAX_LINES)
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  medio: 0.5,
  media: 0.5,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
}

const UNICODE_FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

const num = (s: string) => Number(s.replace(',', '.'))

/**
 * Reads the quantity at the start of `s` (already lowercased, accents stripped).
 * Returns the value and the rest, or `null` if `s` doesn't start with a quantity.
 */
export function parseQuantity(s: string): { value: number; rest: string } | null {
  const t = s.trim()
  let m: RegExpMatchArray | null
  let value: number
  let rest: string
  if ((m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)(?![\d.,])/))) {
    value = Number(m[1]) + Number(m[2]) / Number(m[3])
  } else if ((m = t.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/))) {
    value = num(m[1]) / num(m[2])
  } else if ((m = t.match(/^(\d+)?\s*([½¼¾⅓⅔])/))) {
    value = (m[1] ? Number(m[1]) : 0) + UNICODE_FRACTIONS[m[2]]
  } else if ((m = t.match(/^(\d+(?:[.,]\d+)?)/))) {
    value = num(m[1])
  } else if ((m = t.match(/^([a-z]+)(?![a-z])/)) && m[1] in NUMBER_WORDS) {
    value = NUMBER_WORDS[m[1]]
  } else {
    return null
  }
  rest = t.slice(m[0].length).trim()
  // "1 y medio", "dos y media"
  const half = rest.match(/^y\s+medi[oa](?![a-z])/)
  if (half) {
    value += 0.5
    rest = rest.slice(half[0].length).trim()
  }
  return { value, rest }
}

/** Unit words (normalized) → unit and multiplier into g/ml. */
const UNIT_WORDS: Record<string, { unit: FoodUnit; factor: number }> = {}
const addUnit = (unit: FoodUnit, factor: number, words: string) => {
  for (const w of words.split('|')) UNIT_WORDS[w] = { unit, factor }
}
addUnit('g', 1, 'g|gr|grs|gramo|gramos|grm')
addUnit('g', 1000, 'kg|kgs|kilo|kilos|kilogramo|kilogramos')
addUnit('ml', 1, 'ml|mls|cc|mililitro|mililitros')
addUnit('ml', 1000, 'l|lt|lts|litro|litros')
addUnit('unidad', 1, 'u|un|unidad|unidades|ud|uds')
addUnit('taza', 1, 'taza|tazas|tz')
addUnit('vaso', 1, 'vaso|vasos')
addUnit('cda', 1, 'cda|cdas|cucharada|cucharadas|cuchara|cucharas|cucharada sopera|cucharadas soperas')
addUnit('cdta', 1, 'cdta|cdtas|cdita|cditas|cucharadita|cucharaditas|cucharita|cucharitas|cucharada de te|cucharadas de te|cucharadita de te')
addUnit('feta', 1, 'feta|fetas')
addUnit('rebanada', 1, 'rebanada|rebanadas|rodaja|rodajas')
addUnit('porcion', 1, 'porcion|porciones|porc')
addUnit('plato', 1, 'plato|platos|platito|platitos')

/** Longest unit phrase first ("cucharada de te" before "cucharada"). */
const UNIT_PHRASES = Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length)

export interface ParsedItem {
  /** The item as typed. */
  raw: string
  quantity: number
  /** Unit after conversion: kg → g (quantity × 1000), l → ml. */
  unit: FoodUnit
  /** The user typed a unit (or "unidad" was implicit, as in "2 huevos"). */
  unitExplicit: boolean
  /** Food words, normalized ("jamon"). */
  foodQuery: string
}

/** Parses one item. Never throws; an empty `foodQuery` or NaN quantity is reported later. */
export function parseFoodItem(raw: string): ParsedItem {
  // Lighter cleanup than normalize(): the quantity needs "/", "," "." and ½.
  const light = String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,/½¼¾⅓⅔ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const q = parseQuantity(light)
  let quantity = q ? q.value : 1
  let rest = normalize(q ? q.rest : light)

  let unit: FoodUnit = 'unidad'
  let unitExplicit = false
  let factor = 1
  for (const phrase of UNIT_PHRASES) {
    if (rest === phrase || rest.startsWith(phrase + ' ')) {
      // "un huevo": "un" was the quantity, not a unit.
      if (phrase === 'un' && !q) continue
      ;({ unit, factor } = UNIT_WORDS[phrase])
      quantity *= factor
      unitExplicit = true
      rest = rest.slice(phrase.length).trim()
      break
    }
  }
  // "1 kilo y medio de papa"
  const half = unitExplicit ? rest.match(/^y medi[oa](?: |$)/) : null
  if (half) {
    quantity += 0.5 * factor
    rest = rest.slice(half[0].length).trim()
  }
  rest = rest.replace(/^(de las|de los|de la|del|de)( |$)/, '').trim()
  return { raw: String(raw ?? '').trim(), quantity, unit, unitExplicit, foodQuery: rest }
}

export function parseFoodText(text: string): ParsedItem[] {
  return splitFoodText(text).map(parseFoodItem)
}

// ─── Foods and matching ─────────────────────────────────────────────────────

/** A food saved by the user ("Mis alimentos"). Either per 100 g or per unit. */
export interface CustomFoodLike {
  id: string
  name: string
  /** kcal per 100 g (or 100 ml). */
  kcal100?: number
  /** kcal of one unit. */
  kcalPerUnit?: number
  /** grams of one unit (optional). */
  unitGrams?: number
  deletedAt?: string
}

/** A food as the calculator sees it (built-in or custom). */
export interface Food {
  id: string
  name: string
  custom: boolean
  /** kcal per 100 g / 100 ml; undefined for custom foods known only per unit. */
  kcal?: number
  liquid: boolean
  units: FoodDef['units']
  /** Custom foods: kcal of one unit. */
  kcalPerUnit?: number
}

export type MatchKind = 'exact' | 'plural' | 'accent' | 'fuzzy' | 'partial'

interface Key {
  food: Food
  lower: string
  stemLower: string
  plain: string
  /** stemmed + accent-free: what fuzzy/partial compare. */
  stemPlain: string
  words: string[]
}

export interface FoodIndex {
  keys: Key[]
  byLower: Map<string, Food>
  byStemLower: Map<string, Food>
  byStemPlain: Map<string, Food>
}

function customToFood(c: CustomFoodLike): Food | null {
  const unitGrams = c.unitGrams && c.unitGrams > 0 ? c.unitGrams : undefined
  const perUnit = c.kcalPerUnit !== undefined && c.kcalPerUnit >= 0 ? c.kcalPerUnit : undefined
  let kcal = c.kcal100 !== undefined && c.kcal100 >= 0 ? c.kcal100 : undefined
  if (kcal === undefined && perUnit !== undefined && unitGrams) kcal = (perUnit / unitGrams) * 100
  if (kcal === undefined && perUnit === undefined) return null
  return {
    id: c.id,
    name: c.name.trim(),
    custom: true,
    kcal,
    liquid: false,
    units: unitGrams ? { unidad: unitGrams } : {},
    kcalPerUnit: perUnit,
  }
}

/** Index of custom foods (first: they take precedence) and the built-in dictionary. */
export function buildFoodIndex(custom: readonly CustomFoodLike[] = [], builtins: readonly FoodDef[] = FOODS): FoodIndex {
  const keys: Key[] = []
  const foods: { food: Food; names: string[] }[] = []
  for (const c of custom) {
    if (c.deletedAt || !c.name?.trim()) continue
    const food = customToFood(c)
    if (food) foods.push({ food, names: [c.name] })
  }
  for (const d of builtins) {
    foods.push({
      food: { id: d.id, name: d.name, custom: false, kcal: d.kcal, liquid: !!d.liquid, units: d.units },
      // The id doubles as the short name: "medialuna", "pizza", "leche".
      names: [d.name, d.name.replace(/\s*\(.*?\)\s*/g, ' '), ...d.aliases, d.id.replace(/-/g, ' ')],
    })
  }
  const byLower = new Map<string, Food>()
  const byStemLower = new Map<string, Food>()
  const byStemPlain = new Map<string, Food>()
  for (const { food, names } of foods) {
    for (const n of names) {
      const lw = lower(n)
      if (!lw) continue
      const plain = normalize(n)
      const key: Key = { food, lower: lw, stemLower: stem(lw), plain, stemPlain: stem(plain), words: stem(plain).split(' ') }
      keys.push(key)
      // First writer wins: custom foods were added first.
      if (!byLower.has(key.lower)) byLower.set(key.lower, food)
      if (!byStemLower.has(key.stemLower)) byStemLower.set(key.stemLower, food)
      if (!byStemPlain.has(key.stemPlain)) byStemPlain.set(key.stemPlain, food)
    }
  }
  return { keys, byLower, byStemLower, byStemPlain }
}

const DEFAULT_INDEX = buildFoodIndex()

export interface FoodMatch {
  food: Food
  match: MatchKind
  /** 0–1: 1 exact, ~0.9 accents/plural, lower for fuzzy and partial matches. */
  confidence: number
}

/** Edit distance allowed for a query of `len` characters. */
const maxTypos = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3)

/** Finds the food a query refers to. `query` can be raw ("Jamón") or normalized. */
export function matchFood(query: string, index: FoodIndex = DEFAULT_INDEX): FoodMatch | null {
  if (typeof query !== 'string') return null
  const lw = lower(query)
  if (!lw) return null
  const hit = (food: Food | undefined, match: MatchKind, confidence: number) => (food ? { food, match, confidence } : null)

  const exact = hit(index.byLower.get(lw), 'exact', 1)
  if (exact) return exact
  const plural = hit(index.byStemLower.get(stem(lw)), 'plural', 0.95)
  if (plural) return plural
  const q = stem(normalize(query))
  const accent = hit(index.byStemPlain.get(q), 'accent', 0.9)
  if (accent) return accent

  // Fuzzy: whole query against whole keys, a few typos allowed. Ties → first key (custom first).
  const allowed = maxTypos(q.length)
  let best: { key: Key; d: number } | null = null
  if (allowed > 0) {
    for (const key of index.keys) {
      const d = editDistance(q, key.stemPlain, Math.min(allowed, best ? best.d - 1 : allowed))
      if (d <= allowed && (!best || d < best.d)) best = { key, d }
      if (best?.d === 1) break
    }
  }
  if (best) {
    const conf = Math.min(0.85, 1 - best.d / Math.max(q.length, best.key.stemPlain.length))
    return { food: best.key.food, match: 'fuzzy', confidence: Math.round(conf * 100) / 100 }
  }

  // Partial: a known food inside the query ("copa de vino tinto" → vino tinto). Longest wins.
  const qWords = q.split(' ')
  let partial: Key | null = null
  for (const key of index.keys) {
    if (key.stemPlain.length < 3 || key.words.length > qWords.length) continue
    if (partial && key.stemPlain.length <= partial.stemPlain.length) continue
    if (containsWords(qWords, key.words)) partial = key
  }
  // …but only if it's a good part of what was typed: "guiso de la abuela marta" isn't a guiso.
  const ratio = partial ? partial.stemPlain.length / q.length : 0
  if (partial && ratio >= MIN_PARTIAL_RATIO) {
    return { food: partial.food, match: 'partial', confidence: Math.round((0.5 + 0.3 * ratio) * 100) / 100 }
  }
  // The query is the start of a known name ("dulce de" → dulce de leche). Shortest wins.
  if (q.length >= 4) {
    let prefix: Key | null = null
    for (const key of index.keys) {
      if (key.stemPlain.startsWith(q + ' ') && (!prefix || key.stemPlain.length < prefix.stemPlain.length)) prefix = key
    }
    if (prefix) return { food: prefix.food, match: 'partial', confidence: 0.5 }
  }
  return null
}

function containsWords(hay: string[], needle: string[]): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

// ─── Calculation ────────────────────────────────────────────────────────────

export type UnresolvedReason = 'no-food' | 'bad-quantity' | 'unknown-food' | 'unit'

interface LineBase extends ParsedItem {
  status: 'ok' | 'unresolved'
}

export interface ResolvedLine extends LineBase {
  status: 'ok'
  food: Food
  match: MatchKind
  confidence: number
  /** Grams, or ml for liquids. `undefined` only for custom foods known per unit without weight. */
  amount?: number
  measure: 'g' | 'ml'
  kcal: number
}

export interface UnresolvedLine extends LineBase {
  status: 'unresolved'
  reason: UnresolvedReason
  /** Ready to show, in Spanish. */
  message: string
  /** The food, when it was found but the unit can't be converted. */
  food?: Food
}

export type FoodLine = ResolvedLine | UnresolvedLine

export const UNIT_LABEL: Record<FoodUnit, [string, string]> = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  unidad: ['unidad', 'unidades'],
  taza: ['taza', 'tazas'],
  vaso: ['vaso', 'vasos'],
  cda: ['cucharada', 'cucharadas'],
  cdta: ['cucharadita', 'cucharaditas'],
  feta: ['feta', 'fetas'],
  rebanada: ['rebanada', 'rebanadas'],
  porcion: ['porción', 'porciones'],
  plato: ['plato', 'platos'],
}

/** Grams per ml of a solid food, from the cup/spoon weights it defines (1 if none). */
function density(food: Food): number {
  const u = food.units
  if (u.taza) return u.taza / 240
  if (u.cda) return u.cda / 15
  if (u.cdta) return u.cdta / 5
  if (u.vaso) return u.vaso / 200
  return 1
}

/** Amount in the food's own measure (g, or ml if liquid), or `null` if the unit doesn't apply. */
function toAmount(food: Food, quantity: number, unit: FoodUnit): number | null {
  if (unit === 'g') return quantity // liquids: 1 g ≈ 1 ml
  if (unit === 'ml') return food.liquid ? quantity : quantity * density(food)
  const per = food.units[unit]
  if (per) return quantity * per
  const ml = GENERIC_ML[unit]
  if (ml) return food.liquid ? quantity * ml : quantity * ml * density(food)
  return null
}

const round = (n: number) => Math.round(n)

function unitPhrase(quantity: number, unit: FoodUnit): string {
  const [one, many] = UNIT_LABEL[unit]
  return quantity === 1 ? `1 ${one}` : `${formatQty(quantity)} ${many}`
}

/** "1,5" / "0,5" / "200" */
export function formatQty(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

/** Resolves one parsed item against the index. */
export function resolveItem(item: ParsedItem, index: FoodIndex = DEFAULT_INDEX): FoodLine {
  const base = { ...item }
  if (!item.foodQuery) {
    return { ...base, status: 'unresolved', reason: 'no-food', message: 'Falta el alimento (ej: 200 g arroz).' }
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
    return { ...base, status: 'unresolved', reason: 'bad-quantity', message: 'No entiendo la cantidad.' }
  }
  const m = matchFood(item.foodQuery, index)
  if (!m) {
    return {
      ...base,
      status: 'unresolved',
      reason: 'unknown-food',
      message: `No conozco «${item.foodQuery}».`,
    }
  }
  const { food } = m
  const measure = food.liquid ? 'ml' : 'g'
  // Custom food known per unit.
  if (food.kcalPerUnit !== undefined && item.unit === 'unidad') {
    const grams = food.units.unidad ? item.quantity * food.units.unidad : undefined
    return { ...base, status: 'ok', food, match: m.match, confidence: m.confidence, amount: grams && round(grams), measure, kcal: round(item.quantity * food.kcalPerUnit) }
  }
  // No unit typed and the food isn't counted in units ("papas fritas"): one portion.
  if (!item.unitExplicit && item.unit === 'unidad' && !food.units.unidad && food.kcalPerUnit === undefined && food.units.porcion) {
    base.unit = 'porcion'
  }
  const amount = toAmount(food, item.quantity, base.unit)
  if (amount === null || food.kcal === undefined) {
    const what = item.unitExplicit ? unitPhrase(1, item.unit) : 'una unidad'
    return {
      ...base,
      status: 'unresolved',
      reason: 'unit',
      food,
      message: `No sé cuánto es ${what} de ${food.name.toLowerCase()}. Probá con ${food.kcal === undefined ? 'unidades' : food.liquid ? 'ml' : 'gramos'}.`,
    }
  }
  return {
    ...base,
    status: 'ok',
    food,
    match: m.match,
    confidence: m.confidence,
    amount: round(amount),
    measure,
    kcal: round((amount / 100) * food.kcal),
  }
}

export interface FoodAnalysis {
  lines: FoodLine[]
  /** Sum of the resolved lines. */
  total: number
  unresolved: number
}

/** Text → lines with kcal. Never throws. */
export function analyzeFoodText(text: string, index: FoodIndex = DEFAULT_INDEX): FoodAnalysis {
  try {
    const lines = parseFoodText(text).map((it) => resolveItem(it, index))
    return {
      lines,
      total: lines.reduce((s, l) => (l.status === 'ok' ? s + l.kcal : s), 0),
      unresolved: lines.filter((l) => l.status === 'unresolved').length,
    }
  } catch {
    return { lines: [], total: 0, unresolved: 0 }
  }
}

/** "200 g", "240 ml", "≈ 100 g" — the measured amount of a resolved line. */
export function amountLabel(line: ResolvedLine): string | null {
  return line.amount === undefined ? null : `${line.amount.toLocaleString('es-AR')} ${line.measure}`
}
