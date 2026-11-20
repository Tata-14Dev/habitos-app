import { describe, expect, it } from 'vitest'
import { buildFoodIndex, matchFood, normalize } from './foodLog'
import { FOODS } from './foods'

describe('FOODS dictionary', () => {
  it('has around 200+ foods', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(200)
  })

  it('ids are unique and kebab-case', () => {
    const ids = FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('values are sane: kcal 0–900 per 100, positive unit weights', () => {
    for (const f of FOODS) {
      expect(f.kcal, f.id).toBeGreaterThanOrEqual(0)
      expect(f.kcal, f.id).toBeLessThanOrEqual(900)
      for (const [u, g] of Object.entries(f.units)) expect(g, `${f.id}.${u}`).toBeGreaterThan(0)
    }
  })

  it('no name, alias or id points to two different foods (after plural/accent folding)', () => {
    const idx = buildFoodIndex()
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const k of idx.keys) {
      const prev = owner.get(k.stemPlain)
      if (prev && prev !== k.food.id) clashes.push(`${k.stemPlain}: ${prev} / ${k.food.id}`)
      owner.set(k.stemPlain, k.food.id)
    }
    expect(clashes).toEqual([])
  })

  it('every food is found by its own name and aliases', () => {
    for (const f of FOODS) {
      for (const n of [f.name, ...f.aliases]) {
        const m = matchFood(n)
        expect(m?.food.id, `${n} → ${f.id}`).toBe(f.id)
      }
    }
  })

  it('common words land on the everyday food', () => {
    const expected: Record<string, string> = {
      arroz: 'arroz',
      fideos: 'fideos',
      leche: 'leche',
      pan: 'pan-frances',
      pizza: 'pizza',
      empanada: 'empanada',
      milanesa: 'milanesa',
      medialuna: 'medialuna',
      alfajor: 'alfajor',
      queso: 'queso-cremoso',
      jamon: 'jamon-cocido',
      pollo: 'pollo',
      carne: 'nalga',
      yerba: 'mate',
      'mate cocido': 'mate-cocido',
      gaseosa: 'gaseosa',
      coca: 'gaseosa',
      cerveza: 'cerveza',
      vino: 'vino-tinto',
      'dulce de leche': 'dulce-de-leche',
      facturas: 'factura',
      galletitas: 'galletitas-agua',
      chocolate: 'chocolate',
    }
    for (const [q, id] of Object.entries(expected)) expect(matchFood(q)?.food.id, q).toBe(id)
  })

  it('regional synonyms', () => {
    const pairs: [string, string][] = [
      ['aguacate', 'palta'],
      ['fresa', 'frutilla'],
      ['maíz', 'choclo'],
      ['frijoles', 'porotos'],
      ['plátano', 'banana'],
      ['piña', 'anana'],
      ['patata', 'papa'],
      ['camote', 'batata'],
      ['durazno', 'durazno'],
      ['melocotón', 'durazno'],
      ['cacahuate', 'mani'],
    ]
    for (const [q, id] of pairs) expect(matchFood(q)?.food.id, q).toBe(id)
  })

  it('liquids have kcal per 100 ml', () => {
    const liquids = FOODS.filter((f) => f.liquid).map((f) => f.id)
    expect(liquids).toEqual(expect.arrayContaining(['leche', 'cerveza', 'gaseosa', 'vino-tinto', 'jugo-naranja', 'mate', 'mate-cocido']))
  })

  it('normalize strips accents, case and punctuation', () => {
    expect(normalize('  Jamón  Crudo! ')).toBe('jamon crudo')
    expect(normalize('ÑOQUIS')).toBe('noquis')
  })
})
