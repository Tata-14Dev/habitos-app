import { addDays, compareISO, isISODate, weekday, type ISODate } from './dates'

/**
 * Daily tasks from dictation (no AI). The text the iPhone keyboard dictation produces is split
 * into tasks, each taken literally; if a time is mentioned it goes to the `time` field and is
 * removed from the title: "dentista a las 15 horas" → { time: '15:00', title: 'Dentista' }.
 */

export interface ParsedTask {
  /** Day the task is for, when the text names one ("mañana", "el jueves", "el 15"). */
  date?: ISODate
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

// ─── Dates ("mañana", "el jueves", "el 15 de diciembre") ─────────────────────

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6,
}
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')
/** "para el", "el", "este"… before a day. */
const PREP = String.raw`(?:\b(?:para|el|este)\s+)*`
/** End of a word that may end in "ñ" or an accented letter (\b doesn't know them). */
const END = String.raw`(?![\p{L}\d])`

/** Day `d` of month `m`: this year, or next year if it already passed. */
function nextDayMonth(today: ISODate, d: number, m: number): ISODate | undefined {
  const y = Number(today.slice(0, 4))
  const iso = `${y}-${pad(m)}-${pad(d)}`
  if (!isISODate(iso)) return undefined
  if (compareISO(iso, today) >= 0) return iso
  const next = `${y + 1}-${pad(m)}-${pad(d)}`
  return isISODate(next) ? next : undefined
}

/** Day `d` of this month, or of next month if it already passed. */
function nextDayOfMonth(today: ISODate, d: number): ISODate | undefined {
  const [y, m] = today.split('-').map(Number)
  const here = `${y}-${pad(m)}-${pad(d)}`
  if (isISODate(here) && compareISO(here, today) >= 0) return here
  const nm = m === 12 ? 1 : m + 1
  const next = `${m === 12 ? y + 1 : y}-${pad(nm)}-${pad(d)}`
  return isISODate(next) ? next : undefined
}

const DATE_PATTERNS: { re: RegExp; date: (m: RegExpExecArray, today: ISODate) => ISODate | undefined }[] = [
  { re: new RegExp(String.raw`(?:\bpara\s+)?\bpasado\s+mañana${END}`, 'iu'), date: (_, t) => addDays(t, 2) },
  // "mañana", but not "a la mañana" / "esta mañana" (the moment of the day, not tomorrow).
  { re: new RegExp(String.raw`(?<!\b(?:la|esta|por|de)\s+)(?:\bpara\s+)?\bmañana${END}`, 'iu'), date: (_, t) => addDays(t, 1) },
  { re: /(?:\bpara\s+)?\bhoy\b/iu, date: (_, t) => t },
  {
    re: new RegExp(String.raw`${PREP}\b(\d{1,2})\s+de\s+(${Object.keys(MONTHS).join('|')})\b`, 'iu'),
    date: (m, t) => nextDayMonth(t, Number(m[1]), MONTHS[m[2].toLowerCase()]),
  },
  { re: new RegExp(String.raw`${PREP}\b(\d{1,2})/(\d{1,2})\b`, 'iu'), date: (m, t) => nextDayMonth(t, Number(m[1]), Number(m[2])) },
  {
    // "el lunes", "el próximo lunes", "el lunes que viene": always the NEXT one (on a Monday, a week ahead).
    re: new RegExp(String.raw`${PREP}(?:\bpr[oó]ximo\s+)?\b(${Object.keys(WEEKDAYS).join('|')})${END}(?:\s+que\s+viene)?`, 'iu'),
    date: (m, t) => {
      const diff = (WEEKDAYS[m[1].toLowerCase()] - weekday(t) + 7) % 7
      return addDays(t, diff === 0 ? 7 : diff)
    },
  },
  // "el 15" (day of the month; needs "el" so quantities like "comprar 2 kilos" don't match).
  { re: /(?:\bpara\s+)?\bel\s+(\d{1,2})\b(?![:.,]\d)/iu, date: (m, t) => nextDayOfMonth(t, Number(m[1])) },
]

/** Finds a day in `text` relative to `today`. Returns it and the text without the phrase. */
export function extractDate(text: string, today: ISODate): { date?: ISODate; rest: string } {
  for (const { re, date } of DATE_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const d = date(m, today)
    if (!d) continue
    return { date: d, rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() }
  }
  return { rest: text }
}

/** "Mañana: comprar pan" → heading "Mañana" + the rest. Only when the heading is just a day. */
const HEADING_RE = /^([^:]{1,30}):\s*(.*)$/su

/**
 * Splits dictated text into tasks. With `today`, days are recognized too ("mañana", "el jueves",
 * "el 15"). A heading that is only a day ("Mañana: …", or a chunk "el lunes" on its own) applies
 * to the tasks after it.
 * @example parseDictation('dentista a las 15 horas, comprar yerba y llamar a Juan')
 * // → [{ time: '15:00', title: 'Dentista' }, { title: 'Comprar yerba y llamar a Juan' }]
 */
export function parseDictation(text: string, today?: ISODate): ParsedTask[] {
  let groupDate: ISODate | undefined
  const out: ParsedTask[] = []
  for (const raw of text.split(SPLIT_RE)) {
    let chunk = (raw ?? '').trim()
    if (!chunk) continue
    if (today) {
      const h = HEADING_RE.exec(chunk)
      const head = h && !/\d$/.test(h[1]) ? extractDate(h[1], today) : null
      if (h && head?.date && !head.rest) {
        groupDate = head.date
        chunk = h[2].trim()
        if (!chunk) continue
      }
    }
    const { time, rest: afterTime } = extractTime(chunk)
    const { date, rest } = today ? extractDate(afterTime, today) : { date: undefined, rest: afterTime }
    const title = cleanTitle(rest)
    if (!title && !time) {
      if (date) groupDate = date
      continue
    }
    const day = date ?? groupDate
    out.push({ ...(day && day !== today ? { date: day } : {}), ...(time ? { time } : {}), title: title || 'Recordatorio' })
  }
  return out
}

/** Tasks still pending from the last `maxDays` days: they move to today ("carry over"). */
export function tasksToCarry<T extends { date: ISODate; done: boolean; deletedAt?: string }>(
  tasks: readonly T[],
  today: ISODate,
  maxDays = 7,
): T[] {
  const oldest = addDays(today, -maxDays)
  return tasks.filter((t) => !t.done && !t.deletedAt && compareISO(t.date, today) < 0 && compareISO(t.date, oldest) >= 0)
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
