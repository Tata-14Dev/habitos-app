/**
 * Daily tasks from dictation (no AI). The text the iPhone keyboard dictation produces is split
 * into tasks, each taken literally; if a time is mentioned it goes to the `time` field and is
 * removed from the title: "dentista a las 15 horas" → { time: '15:00', title: 'Dentista' }.
 */

export interface ParsedTask {
  /** 'HH:MM' (24 h) or undefined. */
  time?: string
  title: string
}

const NUMBER_WORDS: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
  veintidós: 22, veintitres: 23, veintitrés: 23,
}
const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')})`
const MIN_WORDS = `(?:y\\s+(media|cuarto|\\d{1,2})|menos\\s+(cuarto|\\d{1,2}))`
const PERIOD = `(?:de\\s+la\\s+(mañana|madrugada|tarde|noche)|(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?))`
const UNIT = `(?:hs\\.?|hrs?\\.?|horas?|h)`

/** Ordered from most to least specific. Each regex captures the whole time phrase. */
const TIME_PATTERNS: RegExp[] = [
  // "a las 15:30", "15.30 hs", "a la 1:05 de la tarde"
  new RegExp(`(?:\\ba\\s+las?\\s+|\\bde\\s+|\\bpara\\s+las?\\s+)?\\b(\\d{1,2})[:.](\\d{2})\\s*${UNIT}?\\s*${PERIOD}?`, 'iu'),
  // "a las 9 y media de la mañana", "a las tres menos cuarto", "a las 15 horas", "a las 3 pm"
  new RegExp(`\\b(?:a|para)\\s+las?\\s+${NUM}(?:\\s+${MIN_WORDS})?(?:\\s*${UNIT})?(?:\\s*${PERIOD})?`, 'iu'),
  // "15 hs", "9h", "tres de la tarde", "9 am" (sin "a las")
  new RegExp(`\\b${NUM}(?:\\s+${MIN_WORDS})?(?:\\s*${UNIT}|\\s*${PERIOD})`, 'iu'),
  // "al mediodía", "a la medianoche"
  /\b(?:al|a\s+la|a\s+las)?\s*(mediod[ií]a|medianoche)\b/iu,
]

function toNumber(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s.toLowerCase()]
}

function minutesFrom(add?: string, sub?: string): number {
  if (add) return add.toLowerCase() === 'media' ? 30 : add.toLowerCase() === 'cuarto' ? 15 : Number(add)
  if (sub) return -(sub.toLowerCase() === 'cuarto' ? 15 : Number(sub))
  return 0
}

function applyPeriod(h: number, period?: string, ampm?: string): number {
  const p = (period ?? '').toLowerCase()
  const ap = (ampm ?? '').toLowerCase().replace(/[.\s]/g, '')
  if ((p === 'tarde' || p === 'noche' || ap === 'pm') && h < 12) return h + 12
  if ((p === 'mañana' || p === 'madrugada' || ap === 'am') && h === 12) return 0
  return h
}

function fmt(h: number, m: number): string | undefined {
  let total = h * 60 + m
  if (total < 0) total += 24 * 60
  const hh = Math.floor(total / 60)
  const mm = total % 60
  if (hh > 23 || mm > 59) return undefined
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Finds a time phrase in `text`. Returns the time and the text without the phrase. */
export function extractTime(text: string): { time?: string; rest: string } {
  for (const [i, re] of TIME_PATTERNS.entries()) {
    const m = re.exec(text)
    if (!m) continue
    let time: string | undefined
    if (i === 0) {
      time = fmt(applyPeriod(Number(m[1]), m[3], m[4]), Number(m[2]))
    } else if (i === 1 || i === 2) {
      const h = toNumber(m[1])
      const mins = minutesFrom(m[2], m[3])
      time = fmt(applyPeriod(h, m[4], m[5]), mins)
    } else {
      time = m[1].toLowerCase().startsWith('mediod') ? '12:00' : '00:00'
    }
    if (!time) continue
    return { time, rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() }
  }
  return { rest: text }
}

/** Separators: punctuation, new lines and spoken connectors ("después", "luego", "y también"). */
const SPLIT_RE = /(?:\r?\n|[;,]|\.(?!\d)|\s+(?:y\s+)?(?:despu[eé]s|luego|tambi[eé]n)\s+)/iu

const LEADING_FILLER = /^(?:y|e|hoy|que|hoy\s+tengo|tengo)\s+/iu

function cleanTitle(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  t = t.replace(/^[-–•*]\s*/, '')
  let prev = ''
  while (prev !== t) {
    prev = t
    t = t.replace(LEADING_FILLER, '').trim()
  }
  t = t.replace(/\s+(?:a|de|para|el|la)$/iu, '').replace(/[\s.,;:]+$/u, '')
  return t.charAt(0).toLocaleUpperCase('es-AR') + t.slice(1)
}

/**
 * Splits dictated text into tasks.
 * @example parseDictation('dentista a las 15 horas, comprar yerba y llamar a Juan')
 * // → [{ time: '15:00', title: 'Dentista' }, { title: 'Comprar yerba y llamar a Juan' }]
 */
export function parseDictation(text: string): ParsedTask[] {
  return text
    .split(SPLIT_RE)
    .map((chunk) => (chunk ?? '').trim())
    .filter(Boolean)
    .map((chunk) => {
      const { time, rest } = extractTime(chunk)
      return { time, title: cleanTitle(rest) }
    })
    .filter((t) => t.title.length > 0 || t.time)
    .map((t) => (t.time ? { time: t.time, title: t.title || 'Recordatorio' } : { title: t.title }))
}

/** Sort: timed tasks first by time, then untimed ones keeping their order. */
export function sortTasks<T extends { time?: string; order: number }>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.order - b.order
    if (a.time) return -1
    if (b.time) return 1
    return a.order - b.order
  })
}

/** "15:00 Dentista" / "Comprar yerba". */
export function formatTask(t: { time?: string; title: string }): string {
  return t.time ? `${t.time} ${t.title}` : t.title
}
