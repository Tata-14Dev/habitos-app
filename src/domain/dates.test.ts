import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareISO,
  daysInMonth,
  diffDays,
  eachDay,
  formatAR,
  isISODate,
  maxISO,
  minISO,
  monthRange,
  parseAR,
  parseISO,
  toISO,
  weekday,
  yearMonth,
} from './dates'

describe('toISO', () => {
  it('uses local calendar fields, not UTC', () => {
    // 23:59 local on 16/11 must stay 16/11 even though it's already 17/11 in UTC (Argentina is UTC−3).
    expect(toISO(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16')
    expect(toISO(new Date(2026, 10, 16, 0, 0))).toBe('2026-11-16')
  })
  it('pads month and day', () => {
    expect(toISO(new Date(2027, 0, 5))).toBe('2027-01-05')
  })
})

describe('parseISO', () => {
  it('returns local midnight', () => {
    const d = parseISO('2026-11-16')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 16, 0])
  })
  it('round-trips with toISO', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
      expect(toISO(parseISO(iso))).toBe(iso)
    }
  })
  it('rejects invalid dates', () => {
    expect(() => parseISO('2026-02-30')).toThrow()
    expect(() => parseISO('2026-13-01')).toThrow()
    expect(() => parseISO('16/11/2026')).toThrow()
    expect(() => parseISO('2026-1-1')).toThrow()
  })
})

describe('isISODate', () => {
  it('validates format and calendar', () => {
    expect(isISODate('2026-11-16')).toBe(true)
    expect(isISODate('2027-02-29')).toBe(false)
    expect(isISODate(20261116)).toBe(false)
  })
})

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-11-16', 1)).toBe('2026-11-17')
    expect(addDays('2026-11-16', 0)).toBe('2026-11-16')
    expect(addDays('2026-11-16', -16)).toBe('2026-10-31')
  })
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
  it('handles long spans', () => {
    expect(addDays('2026-11-16', 33)).toBe('2026-12-19')
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
  })
  it('rejects non-integers', () => {
    expect(() => addDays('2026-11-16', 0.5)).toThrow()
  })
})

describe('weekday', () => {
  it('returns 0 = Sunday … 6 = Saturday', () => {
    expect(weekday('2026-11-15')).toBe(0) // domingo
    expect(weekday('2026-11-16')).toBe(1) // lunes
    expect(weekday('2026-11-21')).toBe(6) // sábado
    expect(weekday('2026-12-25')).toBe(5) // viernes
    expect(weekday('1969-12-31')).toBe(3) // before epoch
  })
})

describe('diffDays', () => {
  it('returns a − b in calendar days', () => {
    expect(diffDays('2026-12-20', '2026-12-19')).toBe(1)
    expect(diffDays('2026-12-19', '2026-12-20')).toBe(-1)
    expect(diffDays('2026-11-16', '2026-11-16')).toBe(0)
    expect(diffDays('2027-01-01', '2026-11-16')).toBe(46)
  })
})

describe('compareISO', () => {
  it('orders dates', () => {
    expect(compareISO('2026-11-16', '2026-11-17')).toBeLessThan(0)
    expect(compareISO('2026-11-17', '2026-11-16')).toBeGreaterThan(0)
    expect(compareISO('2026-11-16', '2026-11-16')).toBe(0)
    expect(['2027-01-01', '2026-11-16', '2026-12-01'].sort(compareISO)).toEqual([
      '2026-11-16',
      '2026-12-01',
      '2027-01-01',
    ])
  })
  it('max/min', () => {
    expect(maxISO('2026-11-15', '2026-11-16')).toBe('2026-11-16')
    expect(minISO('2026-11-15', '2026-11-16')).toBe('2026-11-15')
  })
})

describe('ranges', () => {
  it('eachDay is inclusive', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(eachDay('2026-11-17', '2026-11-16')).toEqual([])
  })
  it('month helpers', () => {
    expect(daysInMonth(2027, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(monthRange(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(yearMonth('2027-03-09')).toEqual({ year: 2027, month: 3 })
  })
})

describe('formato argentino', () => {
  it('formatAR / parseAR', () => {
    expect(formatAR('2026-11-16')).toBe('16/11/2026')
    expect(formatAR('2026-11-16', false)).toBe('16/11')
    expect(parseAR('24/12', 2026)).toBe('2026-12-24')
    expect(parseAR('1/1/27', 2026)).toBe('2027-01-01')
    expect(parseAR('31/02', 2026)).toBeNull()
    expect(parseAR('hola', 2026)).toBeNull()
  })
})
