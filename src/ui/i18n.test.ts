/// <reference types="node" />
/**
 * Every `t('…')` / `tn(n, '…', '…')` key used in the UI must have an English entry, and keys
 * must be plain literals (no template strings) so this scan can see them.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN } from './i18n.en'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : []
  })
}

const sources = [...files('src/ui'), ...files('src/charts')]
  .filter((p) => !/i18n(\.en)?\.ts$/.test(p))
  .map((p) => ({ p, src: readFileSync(p, 'utf8') }))
const LIT = String.raw`'((?:[^'\\]|\\.)*)'`
const unescape = (s: string) => s.replace(/\\'/g, "'").replace(/\\n/g, '\n')

function keys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = []
  for (const { p, src } of sources) {
    for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*` + LIT, 'g'))) out.push({ key: unescape(m[1]), file: p })
    for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*` + LIT + String.raw`\s*,\s*` + LIT, 'g'))) {
      out.push({ key: unescape(m[1]), file: p }, { key: unescape(m[2]), file: p })
    }
  }
  return out
}

describe('i18n', () => {
  it('finds the keys (sanity check)', () => {
    expect(keys().length).toBeGreaterThan(50)
  })

  it('every key has an English translation', () => {
    const missing = [...new Set(keys().filter((k) => !(k.key in EN)).map((k) => `${k.file}: ${k.key}`))]
    expect(missing).toEqual([])
  })

  it('keys are plain literals (no template strings or variables)', () => {
    const bad = sources.flatMap(({ p, src }) => [...src.matchAll(/\bt\(\s*[`a-zA-Z]/g)].map((m) => `${p}: ${src.slice(m.index!, m.index! + 40)}`))
    expect(bad).toEqual([])
  })

  it('placeholders match between Spanish and English', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
    const wrong = Object.entries(EN).filter(([es, en]) => vars(es) !== vars(en)).map(([es]) => es)
    expect(wrong).toEqual([])
  })
})
