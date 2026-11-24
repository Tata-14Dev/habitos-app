import { describe, expect, it } from 'vitest'
import { chartColors, isCompatible, PRESETS, resolvePalette, SWATCH_IDS, type PresetId } from './palette'
import { BASES, COMPATIBLE, SWATCHES } from './palette.data'

const HEX = /^#[0-9A-F]{6}$/

describe('palette data', () => {
  it('every color is a 6-digit hex', () => {
    for (const s of Object.values(SWATCHES)) {
      for (const mode of [s.light, s.dark]) {
        expect(mode.button).toMatch(HEX)
        expect(mode.chart).toMatch(HEX)
        expect(mode.ramp).toHaveLength(5)
        mode.ramp.forEach((c) => expect(c).toMatch(HEX))
      }
    }
    for (const b of Object.values(BASES)) Object.values(b.neutral).forEach((c) => expect(c).toMatch(HEX))
  })

  it('compatibility is symmetric and never pairs a color with itself', () => {
    for (const p of SWATCH_IDS) {
      expect(COMPATIBLE[p]).not.toContain(p)
      for (const a of COMPATIBLE[p]) expect(COMPATIBLE[a]).toContain(p)
    }
  })
})

describe('presets', () => {
  it('every preset uses a validated primary/accent pair', () => {
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      const p = PRESETS[id]
      expect(isCompatible(p.primary, p.accent), id).toBe(true)
    }
  })
  it('the default is Neón: neon pink + sky blue on the night base', () => {
    expect(resolvePalette(undefined)).toEqual({ primary: 'rosa', accent: 'celeste', base: 'noche' })
  })
})

describe('custom choices', () => {
  it('keeps a valid custom pair', () => {
    expect(resolvePalette({ preset: 'custom', primary: 'azul', accent: 'ambar', base: 'gris' })).toEqual({ primary: 'azul', accent: 'ambar', base: 'gris' })
  })
  it('replaces an accent that fails validation with one that passes', () => {
    const r = resolvePalette({ preset: 'custom', primary: 'azul', accent: 'celeste' })
    expect(r.accent).not.toBe('celeste')
    expect(isCompatible('azul', r.accent)).toBe(true)
  })
  it('falls back on unknown values (e.g. synced from a newer version)', () => {
    const r = resolvePalette({ preset: 'custom', primary: 'turquesa' as never, base: 'sepia' as never })
    expect(r.primary).toBe('rosa')
    expect(r.base).toBe('noche')
  })
})

describe('chart colors', () => {
  it('charts use the validated chart tones, not the button tones', () => {
    const light = chartColors({ preset: 'neon' }, false)
    const dark = chartColors({ preset: 'neon' }, true)
    expect(light.primary).toBe(SWATCHES.rosa.light.chart)
    expect(light.accent).toBe(SWATCHES.celeste.light.chart)
    expect(dark.ramp).toEqual(SWATCHES.rosa.dark.ramp)
    expect(dark.surface).toBe(BASES.noche.dark.surface)
  })
})
