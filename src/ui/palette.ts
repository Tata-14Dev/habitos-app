/**
 * Color themes: a primary color (buttons, checks, progress), an accent (secondary highlights,
 * mood, the second series in charts) and a base (neutral gray or indigo "night").
 *
 * All values come from palette.data.ts (generated + validated). The choice is stored in the
 * synced settings and mirrored in localStorage so the first paint already has the right colors.
 * Applying a theme = writing CSS variables on <html>; Tailwind's tokens point at them.
 */
import { useEffect, useState } from 'react'
import { BASES, COMPATIBLE, SWATCHES } from './palette.data'

export type SwatchId = keyof typeof SWATCHES
export type BaseId = keyof typeof BASES
export type PresetId = 'neon' | 'clasico' | 'oceano' | 'lavanda'

export interface PaletteChoice {
  preset: PresetId | 'custom'
  primary?: SwatchId
  accent?: SwatchId
  base?: BaseId
}

export const PRESETS: Record<PresetId, { name: [string, string]; primary: SwatchId; accent: SwatchId; base: BaseId }> = {
  neon: { name: ['Neón', 'Neon'], primary: 'rosa', accent: 'celeste', base: 'noche' },
  clasico: { name: ['Clásico', 'Classic'], primary: 'verde', accent: 'rosa', base: 'gris' },
  oceano: { name: ['Océano', 'Ocean'], primary: 'azul', accent: 'ambar', base: 'gris' },
  lavanda: { name: ['Lavanda', 'Lavender'], primary: 'violeta', accent: 'celeste', base: 'noche' },
}

export const DEFAULT_PALETTE: PaletteChoice = { preset: 'neon' }
export const SWATCH_IDS = Object.keys(SWATCHES) as SwatchId[]
export const BASE_IDS = Object.keys(BASES) as BaseId[]

export function isCompatible(primary: SwatchId, accent: SwatchId): boolean {
  return COMPATIBLE[primary].includes(accent)
}

/** Concrete primary/accent/base for a choice; an incompatible custom accent falls back to a valid one. */
export function resolvePalette(choice: PaletteChoice | undefined): { primary: SwatchId; accent: SwatchId; base: BaseId } {
  const c = choice ?? DEFAULT_PALETTE
  if (c.preset !== 'custom') {
    const p = PRESETS[c.preset] ?? PRESETS.neon
    return { primary: p.primary, accent: p.accent, base: p.base }
  }
  const primary = c.primary && c.primary in SWATCHES ? c.primary : 'rosa'
  const accent = c.accent && c.accent in SWATCHES && isCompatible(primary, c.accent) ? c.accent : COMPATIBLE[primary][0]
  const base = c.base && c.base in BASES ? c.base : 'noche'
  return { primary, accent, base }
}

export interface ChartColors {
  primary: string
  accent: string
  ramp: readonly string[]
  ink: string
  grid: string
  surface: string
  text: string
}

/** Colors for charts (Recharts needs real values, not CSS variables). */
export function chartColors(choice: PaletteChoice | undefined, dark: boolean): ChartColors {
  const { primary, accent, base } = resolvePalette(choice)
  const mode = dark ? 'dark' : 'light'
  const b = BASES[base]
  return {
    primary: SWATCHES[primary][mode].chart,
    accent: SWATCHES[accent][mode].chart,
    ramp: SWATCHES[primary][mode].ramp,
    ink: dark ? b.neutral[400] : b.light.inkSoft,
    grid: dark ? b.neutral[700] : b.light.paper,
    surface: dark ? b.dark.surface : b.light.surface,
    text: dark ? b.neutral[200] : b.light.ink,
  }
}

// ─── Current choice (module state + localStorage mirror) ────────────────────

const KEY = 'palette'
let current: PaletteChoice = readMirror()
const listeners = new Set<() => void>()

function readMirror(): PaletteChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PaletteChoice | null
    return v && typeof v === 'object' && 'preset' in v ? v : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

export function getPalette(): PaletteChoice {
  return current
}

/** Sets the active palette (from settings or the picker) and repaints. */
export function setPalette(choice: PaletteChoice | undefined) {
  const next = choice ?? DEFAULT_PALETTE
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: it still applies for this visit
  }
  applyPalette(document.documentElement.classList.contains('dark'))
  listeners.forEach((l) => l())
}

/** Writes the CSS variables for the current palette and mode. Called on start and on mode changes. */
export function applyPalette(dark: boolean) {
  if (typeof document === 'undefined') return
  const { primary, accent, base } = resolvePalette(current)
  const mode = dark ? 'dark' : 'light'
  const b = BASES[base]
  const vars: Record<string, string> = {
    '--c-primary': SWATCHES[primary][mode].button,
    '--c-accent': SWATCHES[accent][mode].button,
    '--c-paper': b.light.paper,
    '--c-line': b.light.line,
    '--c-ink': b.light.ink,
    '--c-ink-soft': b.light.inkSoft,
  }
  for (const [k, v] of Object.entries(b.neutral)) vars[`--c-n-${k}`] = v
  const style = document.documentElement.style
  for (const [k, v] of Object.entries(vars)) style.setProperty(k, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? b.neutral[900] : b.light.paper)
}

/** Re-renders when the palette or the light/dark mode changes; returns colors for charts. */
export function useChartColors(): ChartColors {
  const [, bump] = useState(0)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      listeners.delete(l)
      obs.disconnect()
    }
  }, [])
  return chartColors(current, dark)
}

/** Re-renders on palette changes (for the picker). */
export function usePaletteChoice(): PaletteChoice {
  const [, bump] = useState(0)
  useEffect(() => {
    const l = () => bump((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return current
}
