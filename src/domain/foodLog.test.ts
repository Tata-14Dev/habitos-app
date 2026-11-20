import { describe, expect, it } from 'vitest'
import {
  analyzeFoodText,
  buildFoodIndex,
  editDistance,
  matchFood,
  parseFoodItem,
  parseQuantity,
  resolveItem,
  splitFoodText,
  type CustomFoodLike,
  type FoodLine,
  type ResolvedLine,
} from './foodLog'

const ok = (l: FoodLine): ResolvedLine => {
  if (l.status !== 'ok') throw new Error(`unresolved: ${l.raw} (${l.message})`)
  return l
}
const one = (text: string, custom: CustomFoodLike[] = []) => {
  const a = analyzeFoodText(text, buildFoodIndex(custom))
  expect(a.lines).toHaveLength(1)
  return a.lines[0]
}
const kcal = (text: string, custom: CustomFoodLike[] = []) => ok(one(text, custom)).kcal

describe('splitFoodText', () => {
  it('splits by newline, comma, semicolon, plus and " y "', () => {
    expect(splitFoodText('200 g arroz, 2 huevos y 1 taza de leche\n1/2 palta; 1 cda de aceite + 1 banana')).toEqual([
      '200 g arroz',
      '2 huevos',
      '1 taza de leche',
      '1/2 palta',
      '1 cda de aceite',
      '1 banana',
    ])
  })

  it('keeps decimal commas and dots, and "y medio"', () => {
    expect(splitFoodText('1,5 kg papa, 2.5 tazas de leche')).toEqual(['1,5 kg papa', '2.5 tazas de leche'])
    expect(splitFoodText('1 kilo y medio de papa y 2 huevos')).toEqual(['1 kilo y medio de papa', '2 huevos'])
  })

  it('splits dictated sentences on periods and drops empty pieces', () => {
    expect(splitFoodText('2 huevos. 1 tostada.  ,, \n\n')).toEqual(['2 huevos', '1 tostada'])
    expect(splitFoodText('')).toEqual([])
  })

  it('does not split foods that contain "con" or "de"', () => {
    expect(splitFoodText('1 café con leche, 2 cdas de dulce de leche')).toEqual(['1 café con leche', '2 cdas de dulce de leche'])
  })
})

describe('parseQuantity', () => {
  it.each([
    ['2 huevos', 2],
    ['200 g arroz', 200],
    ['1,5 kg papa', 1.5],
    ['1.5 kg papa', 1.5],
    ['1/2 palta', 0.5],
    ['3/4 taza', 0.75],
    ['1 1/2 taza', 1.5],
    ['½ palta', 0.5],
    ['1½ taza', 1.5],
    ['un yogur', 1],
    ['una banana', 1],
    ['uno', 1],
    ['medio pollo', 0.5],
    ['media palta', 0.5],
    ['dos huevos', 2],
    ['tres', 3],
    ['cuatro', 4],
    ['cinco', 5],
    ['seis', 6],
    ['siete', 7],
    ['ocho', 8],
    ['nueve', 9],
    ['diez', 10],
    ['1 y medio', 1.5],
    ['dos y media', 2.5],
  ])('%s → %d', (text, value) => {
    expect(parseQuantity(text)?.value).toBeCloseTo(value)
  })

  it('returns null without a quantity', () => {
    expect(parseQuantity('milanesa')).toBeNull()
    expect(parseQuantity('medialuna')).toBeNull()
    expect(parseQuantity('unidad')).toBeNull()
  })
})

describe('parseFoodItem: units', () => {
  it.each([
    ['200 g arroz', 200, 'g'],
    ['200g arroz', 200, 'g'],
    ['200 gr de arroz', 200, 'g'],
    ['200 grs arroz', 200, 'g'],
    ['200 gramos de arroz', 200, 'g'],
    ['1 kg papa', 1000, 'g'],
    ['medio kilo de papa', 500, 'g'],
    ['1 kilo y medio de papa', 1500, 'g'],
    ['250 ml leche', 250, 'ml'],
    ['250 cc de leche', 250, 'ml'],
    ['1 l leche', 1000, 'ml'],
    ['1,5 litros de agua', 1500, 'ml'],
    ['2 huevos', 2, 'unidad'],
    ['2 unidades de huevo', 2, 'unidad'],
    ['1 unidad de pan', 1, 'unidad'],
    ['1 taza de leche', 1, 'taza'],
    ['2 tazas de leche', 2, 'taza'],
    ['1 vaso de jugo', 1, 'vaso'],
    ['1 cda de aceite', 1, 'cda'],
    ['2 cucharadas de azúcar', 2, 'cda'],
    ['1 cdta de azúcar', 1, 'cdta'],
    ['1 cucharadita de azúcar', 1, 'cdta'],
    ['1 cucharadita de té de azúcar', 1, 'cdta'],
    ['3 fetas de jamón', 3, 'feta'],
    ['2 rebanadas de pan lactal', 2, 'rebanada'],
    ['2 rodajas de ananá', 2, 'rebanada'],
    ['1 porción de pizza', 1, 'porcion'],
    ['2 porciones de pizza', 2, 'porcion'],
    ['1 plato de fideos', 1, 'plato'],
  ])('%s → %d %s', (text, quantity, unit) => {
    const p = parseFoodItem(text)
    expect(p.quantity).toBeCloseTo(quantity)
    expect(p.unit).toBe(unit)
  })

  it('separates the food and drops the "de" connector', () => {
    expect(parseFoodItem('1 taza de leche').foodQuery).toBe('leche')
    expect(parseFoodItem('2 cdas de dulce de leche').foodQuery).toBe('dulce de leche')
    expect(parseFoodItem('150 ml jugo de naranja').foodQuery).toBe('jugo de naranja')
    expect(parseFoodItem('3 FETAS DE JAMÓN').foodQuery).toBe('jamon')
  })

  it('a missing quantity is 1 and a missing unit is implicit', () => {
    const p = parseFoodItem('milanesa')
    expect(p).toMatchObject({ quantity: 1, unit: 'unidad', unitExplicit: false, foodQuery: 'milanesa' })
    expect(parseFoodItem('un huevo')).toMatchObject({ quantity: 1, unit: 'unidad', foodQuery: 'huevo' })
  })
})

describe('matchFood', () => {
  it('exact name or alias', () => {
    expect(matchFood('palta')).toMatchObject({ match: 'exact', confidence: 1 })
    expect(matchFood('aguacate')?.food.id).toBe('palta')
  })

  it('plurals: huevos, panes, empanadas, nueces, limones', () => {
    expect(matchFood('huevos')).toMatchObject({ match: 'plural', food: { id: 'huevo' } })
    expect(matchFood('panes')?.food.id).toBe('pan-frances')
    expect(matchFood('empanadas')?.food.id).toBe('empanada')
    expect(matchFood('nuez')?.food.id).toBe('nueces')
    expect(matchFood('limones')?.food.id).toBe('limon')
    expect(matchFood('tomates')?.food.id).toBe('tomate')
    expect(matchFood('alfajores')?.food.id).toBe('alfajor')
  })

  it('accent- and case-insensitive', () => {
    expect(matchFood('JAMON')?.food.id).toBe('jamon-cocido')
    expect(matchFood('Jamón')?.food.id).toBe('jamon-cocido')
    expect(matchFood('platano')?.food.id).toBe('banana')
    expect(matchFood('cafe con leche')?.food.id).toBe('cafe-con-leche')
    expect(matchFood('noquis')?.food.id).toBe('noquis')
  })

  it('fuzzy: small typos, with lower confidence', () => {
    const m = matchFood('milaneza')
    expect(m).toMatchObject({ match: 'fuzzy', food: { id: 'milanesa' } })
    expect(m!.confidence).toBeLessThan(0.9)
    expect(matchFood('frutiya')?.food.id).toBe('frutilla')
    expect(matchFood('bananna')?.food.id).toBe('banana')
    expect(matchFood('brocolli')?.food.id).toBe('brocoli')
  })

  it('short words need an exact match (no fuzzy on 3 letters)', () => {
    expect(matchFood('pam')).toBeNull()
    expect(matchFood('xyz')).toBeNull()
  })

  it('partial: a known food inside a longer phrase', () => {
    const m = matchFood('copa de vino malbec reserva')
    expect(m).toMatchObject({ match: 'partial', food: { id: 'vino-tinto' } })
    expect(m!.confidence).toBeLessThan(0.9)
  })

  it('a short known word inside a long unknown phrase is not a match', () => {
    expect(matchFood('guiso de la abuela')).toBeNull()
  })

  it('unknown food → null', () => {
    expect(matchFood('guiso de la abuela marta')).toBeNull()
    expect(matchFood('')).toBeNull()
  })
})

describe('kcal math (hand-checked)', () => {
  it.each([
    // 200 g × 130 kcal/100 g
    ['200 g arroz', 260],
    // 2 × 50 g × 1,55
    ['2 huevos', 155],
    // 240 ml × 0,61
    ['1 taza de leche', 146],
    // 0,5 × 170 g × 1,60
    ['1/2 palta', 136],
    // 3 × 15 g × 1,15 = 51,75
    ['3 fetas de jamón', 52],
    // 150 g × 2,60
    ['1 milanesa', 390],
    // 150 ml × 0,45 = 67,5
    ['150 ml jugo de naranja', 68],
    // 13,5 g × 8,84 = 119,3
    ['1 cda de aceite', 119],
    // 4 g × 3,87
    ['1 cdta de azúcar', 15],
    // 200 ml × 0,42 (generic vaso)
    ['1 vaso de gaseosa', 84],
    // 500 g × 0,86
    ['medio kilo de papa', 430],
    // cup-weight density: 15 ml × (160/240) = 10 g × 1,30
    ['1 cda de arroz', 13],
    // oil density from its cup: 200 ml × (218/240) = 181,7 g × 8,84 = 1606
    ['200 ml aceite', 1606],
    // liquids: 1 g ≈ 1 ml
    ['300 g leche', 183],
    // no unit on a food counted in portions: 1 porción = 115 g × 3,10
    ['papas fritas', 357],
  ])('%s → %d kcal', (text, expected) => {
    expect(kcal(text)).toBe(expected)
  })

  it('reports grams or ml of the line', () => {
    expect(ok(one('2 huevos'))).toMatchObject({ amount: 100, measure: 'g' })
    expect(ok(one('1 taza de leche'))).toMatchObject({ amount: 240, measure: 'ml' })
  })

  it('total of a meal', () => {
    const a = analyzeFoodText('200 g arroz, 2 huevos\n1 cda de aceite')
    expect(a.unresolved).toBe(0)
    expect(a.total).toBe(260 + 155 + 119)
  })

  it('total skips unresolved lines and counts them', () => {
    const a = analyzeFoodText('200 g arroz, 1 guiso de la abuela')
    expect(a.total).toBe(260)
    expect(a.unresolved).toBe(1)
  })
})

describe('unresolved reasons', () => {
  it('unknown food', () => {
    const l = one('1 guiso de la abuela')
    expect(l).toMatchObject({ status: 'unresolved', reason: 'unknown-food' })
    expect(l.status === 'unresolved' && l.message).toContain('guiso de la abuela')
  })

  it('unit the food cannot convert (1 feta de arroz)', () => {
    const l = one('1 feta de arroz')
    expect(l).toMatchObject({ status: 'unresolved', reason: 'unit', food: { id: 'arroz' } })
    expect(l.status === 'unresolved' && l.message).toMatch(/feta.*gramos/)
  })

  it('implicit unit on a food without unit or portion weight (2 harina)', () => {
    expect(one('2 harina')).toMatchObject({ status: 'unresolved', reason: 'unit' })
  })

  it('missing food', () => {
    expect(one('200 g')).toMatchObject({ status: 'unresolved', reason: 'no-food' })
  })

  it('bad quantity', () => {
    expect(one('0 huevos')).toMatchObject({ status: 'unresolved', reason: 'bad-quantity' })
    expect(one('1/0 palta')).toMatchObject({ status: 'unresolved', reason: 'bad-quantity' })
  })
})

describe('custom foods', () => {
  const tarta: CustomFoodLike = { id: 'c1', name: 'Tarta de la abuela', kcalPerUnit: 450 }
  const granola: CustomFoodLike = { id: 'c2', name: 'Granola casera', kcal100: 400 }
  const barrita: CustomFoodLike = { id: 'c3', name: 'Barrita proteica', kcalPerUnit: 200, unitGrams: 50 }

  it('are recognized (per unit, per 100 g, per unit with weight)', () => {
    expect(kcal('1 tarta de la abuela', [tarta])).toBe(450)
    expect(kcal('2 tartas de la abuela', [tarta])).toBe(900)
    expect(kcal('150 g granola casera', [granola])).toBe(600)
    expect(kcal('100 g barrita proteica', [barrita])).toBe(400)
    expect(ok(one('2 barritas proteicas', [barrita]))).toMatchObject({ kcal: 400, amount: 100, food: { id: 'c3', custom: true } })
  })

  it('take precedence over the built-in dictionary', () => {
    const mine: CustomFoodLike = { id: 'm', name: 'Milanesa', kcalPerUnit: 500 }
    expect(ok(one('1 milanesa', [mine])).food.id).toBe('m')
    expect(kcal('2 milanesas', [mine])).toBe(1000)
    // Without it, the dictionary one.
    expect(ok(one('1 milanesa')).food.id).toBe('milanesa')
  })

  it('per unit without weight cannot convert grams', () => {
    expect(one('100 g tarta de la abuela', [tarta])).toMatchObject({ status: 'unresolved', reason: 'unit' })
  })

  it('deleted or empty custom foods are ignored', () => {
    expect(ok(one('1 milanesa', [{ id: 'x', name: 'Milanesa', kcalPerUnit: 1, deletedAt: '2026-01-01' }])).food.id).toBe('milanesa')
    expect(ok(one('1 milanesa', [{ id: 'y', name: 'Milanesa' }])).food.id).toBe('milanesa')
    expect(ok(one('1 milanesa', [{ id: 'z', name: '  ', kcalPerUnit: 3 }])).food.id).toBe('milanesa')
  })
})

describe('robustness', () => {
  it('editDistance', () => {
    expect(editDistance('milanesa', 'milaneza')).toBe(1)
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abcdef', 'x', 2)).toBe(3)
  })

  it('never throws on random input', () => {
    const chars = 'abcdeñáéíóú0123456789 ,.;/+-y½\n\t()[]{}*?$^|\\🍕'
    let seed = 42
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 2000; i++) {
      const len = Math.floor(rnd() * 40)
      let s = ''
      for (let j = 0; j < len; j++) s += chars[Math.floor(rnd() * chars.length)]
      const items = splitFoodText(s).map(parseFoodItem)
      for (const it of items) {
        const l = resolveItem(it)
        if (l.status === 'ok') expect(Number.isFinite(l.kcal)).toBe(true)
      }
    }
    for (const bad of [undefined, null, 42, {}] as unknown as string[]) {
      expect(() => analyzeFoodText(bad)).not.toThrow()
      expect(() => parseFoodItem(bad)).not.toThrow()
      expect(matchFood(bad)).toBeNull()
    }
  })

  it('caps very long texts', () => {
    const a = analyzeFoodText(Array(500).fill('1 huevo').join('\n'))
    expect(a.lines.length).toBeLessThanOrEqual(60)
  })
})
