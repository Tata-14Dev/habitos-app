import { useEffect, useState } from 'react'
import { applyPalette } from './palette'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'

/** Theme is a per-device preference (not synced). */
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function setThemePref(p: ThemePref) {
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    /* storage unavailable: theme just won't persist */
  }
  applyTheme()
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined

export function applyTheme() {
  const p = getThemePref()
  const dark = p === 'dark' || (p === 'system' && !!media?.matches)
  document.documentElement.classList.toggle('dark', dark)
  applyPalette(dark)
}

export function initTheme() {
  applyTheme()
  media?.addEventListener('change', applyTheme)
}

export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}
