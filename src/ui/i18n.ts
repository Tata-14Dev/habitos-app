/**
 * UI language: Argentine Spanish (source) or English.
 *
 * `t('Texto en español')`: the key IS the Spanish text, so code stays readable and a missing
 * translation falls back to Spanish instead of breaking. Variables go as `{name}`:
 * `t('Te quedan {n} tareas', { n })`. Never build keys with template literals: a unit test
 * scans the code for every `t('…')` and checks it has an English entry.
 *
 * The choice is per device (like the theme) and applied at startup; changing it reloads.
 */
import { setNumberLocale } from '../domain/numberFormat'
import { EN } from './i18n.en'

export type Lang = 'es' | 'en'
export type LangPref = Lang | 'system'
const KEY = 'lang'

export function getLangPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'es' || v === 'en' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function setLangPref(p: LangPref) {
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    // storage unavailable: the choice lasts until reload
  }
  window.location.reload()
}

function detect(): Lang {
  const pref = getLangPref()
  if (pref !== 'system') return pref
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es'
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export const LANG: Lang = detect()
setNumberLocale(LANG)
if (typeof document !== 'undefined') document.documentElement.lang = LANG === 'es' ? 'es-AR' : 'en'

export function t(key: string, vars?: Record<string, string | number>): string {
  const s = LANG === 'en' ? (EN[key] ?? key) : key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

/** Picks the singular or plural key by count (both must be literal keys for the scanner). */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : many, { n, ...vars })
}
