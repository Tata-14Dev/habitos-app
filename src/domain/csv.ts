/**
 * CSV export (for Excel / Google Sheets). Spanish spreadsheets expect ";" between columns and a
 * decimal comma, English ones "," and a decimal point: `CsvFormat` picks one.
 */
export interface CsvFormat {
  sep: ',' | ';'
  decimal: '.' | ','
}

export const CSV_ES: CsvFormat = { sep: ';', decimal: ',' }
export const CSV_EN: CsvFormat = { sep: ',', decimal: '.' }

export type Cell = string | number | boolean | null | undefined

function cell(v: Cell, f: CsvFormat): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', f.decimal) : typeof v === 'boolean' ? (v ? '1' : '0') : v
  return /["\n\r]/.test(s) || s.includes(f.sep) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Rows → CSV text with a BOM (so Excel reads accents as UTF-8) and CRLF line ends. */
export function toCSV(rows: readonly (readonly Cell[])[], f: CsvFormat): string {
  return '﻿' + rows.map((r) => r.map((v) => cell(v, f)).join(f.sep)).join('\r\n') + '\r\n'
}
