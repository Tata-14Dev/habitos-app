import { describe, expect, it } from 'vitest'
import { CSV_EN, CSV_ES, toCSV } from './csv'

describe('toCSV', () => {
  it('Spanish: ";" and decimal comma; English: "," and point', () => {
    expect(toCSV([['Fecha', 'Horas'], ['2026-11-27', 1.5]], CSV_ES)).toBe('﻿Fecha;Horas\r\n2026-11-27;1,5\r\n')
    expect(toCSV([['Date', 'Hours'], ['2026-11-27', 1.5]], CSV_EN)).toBe('﻿Date,Hours\r\n2026-11-27,1.5\r\n')
  })
  it('quotes cells with the separator, quotes or new lines; empty for null', () => {
    expect(toCSV([['a;b', 'dijo "hola"', 'x\ny', null, true]], CSV_ES)).toBe('﻿"a;b";"dijo ""hola""";"x\ny";;1\r\n')
    expect(toCSV([['a;b', 'c,d']], CSV_EN)).toBe('﻿a;b,"c,d"\r\n')
  })
})
