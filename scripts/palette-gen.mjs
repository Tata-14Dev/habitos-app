// Generates the color palettes (src/ui/palette.data.ts) in OKLCH and validates them with the
// dataviz palette validator (lightness band, chroma floor, CVD separation, contrast, ordinal ramps).
//   DATAVIZ_VALIDATOR=/path/to/validate_palette.js node scripts/palette-gen.mjs
// Prints the checks and writes palette.json next to this script; the app's palette.data.ts is
// that JSON as typed constants.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

if (!process.env.DATAVIZ_VALIDATOR) {
  console.error('Set DATAVIZ_VALIDATOR to the path of validate_palette.js')
  process.exit(1)
}
const { contrast, validate, validateOrdinal } = await import(pathToFileURL(process.env.DATAVIZ_VALIDATOR).href)

// ── OKLCH → sRGB hex (with gamut clamping by reducing chroma) ──
function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const toSrgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
function oklch(L, C, h) {
  let c = C
  for (;;) {
    const lin = oklchToLinear(L, c, h)
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005) || c <= 0) {
      return '#' + lin.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
    }
    c -= 0.004
  }
}

// ── Swatches: hue + max chroma (neon-ish but not garish) ──
const HUES = {
  rosa: { h: 356, c: 0.2, name: ['Rosa neón', 'Neon pink'] },
  celeste: { h: 218, c: 0.14, name: ['Celeste', 'Sky blue'] },
  verde: { h: 145, c: 0.15, name: ['Verde', 'Green'] },
  violeta: { h: 300, c: 0.18, name: ['Violeta', 'Violet'] },
  ambar: { h: 62, c: 0.15, name: ['Ámbar', 'Amber'] },
  azul: { h: 262, c: 0.17, name: ['Azul', 'Blue'] },
}

// ── Neutral bases ──
// Tailwind's neutral scale lightness, tinted for "noche" (indigo night).
const NEUTRAL_L = { 50: 0.985, 100: 0.97, 200: 0.922, 300: 0.87, 400: 0.708, 500: 0.556, 600: 0.439, 700: 0.371, 800: 0.269, 900: 0.205, 950: 0.145 }
function neutralScale(chroma, hue) {
  return Object.fromEntries(Object.entries(NEUTRAL_L).map(([k, L]) => [k, oklch(L, k >= 700 ? chroma : chroma * 0.6, hue)]))
}
const BASES = {
  gris: {
    name: ['Neutro', 'Neutral'],
    light: { paper: '#EFEFEF', line: '#D9D9D9', ink: '#434343', inkSoft: '#666666', surface: '#FFFFFF' },
    neutral: neutralScale(0, 0),
  },
  noche: {
    name: ['Nocturno', 'Night'],
    light: { paper: oklch(0.955, 0.012, 300), line: oklch(0.885, 0.02, 300), ink: oklch(0.33, 0.035, 290), inkSoft: oklch(0.47, 0.035, 290), surface: '#FFFFFF' },
    neutral: neutralScale(0.035, 285),
  },
}
for (const b of Object.values(BASES)) b.dark = { surface: b.neutral[800], body: b.neutral[900] }

// ── Per-swatch colors ──
/** OKLCH chroma of a hex (to check the gamut didn't wash the hue out). */
function chromaOf(hex) {
  const lin = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2])
  const m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2])
  const s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2])
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return Math.hypot(a, b)
}
/** Light-mode chart color: the darkest L in the band that keeps chroma ≥ 0.1 (the gamut limits cyan at low L). */
function lightChart(h, c) {
  for (let L = 0.5; L <= 0.66; L += 0.01) {
    const hex = oklch(L, c, h)
    if (chromaOf(hex) >= 0.105 && contrast(hex, '#FFFFFF') >= 3) return hex
  }
  return oklch(0.55, c, h)
}
const LIGHT_RAMP = [0.74, 0.65, 0.56, 0.47, 0.38]
const DARK_RAMP = [0.5, 0.59, 0.68, 0.77, 0.86]
function swatch({ h, c }) {
  // Button fill in light mode: darkest L that still reads as the hue, white text ≥ 4.5:1.
  let lightBtn
  for (let L = 0.6; L >= 0.4; L -= 0.01) {
    lightBtn = oklch(L, c, h)
    if (contrast(lightBtn, '#FFFFFF') >= 4.5) break
  }
  return {
    light: { button: lightBtn, chart: lightChart(h, c), ramp: LIGHT_RAMP.map((L) => oklch(L, c * 0.9, h)) },
    dark: { button: oklch(0.78, c * 0.85, h), chart: oklch(0.64, c, h), ramp: DARK_RAMP.map((L) => oklch(L, c * 0.85, h)) },
  }
}
const SW = Object.fromEntries(Object.entries(HUES).map(([k, v]) => [k, swatch(v)]))

// ── Validation ──
const problems = []
const ok = (r) => r.ok ?? r.pass ?? (Array.isArray(r) ? r.every((x) => x[1]) : r)
function checkReport(r) {
  // validate()/validateOrdinal() return { ok, report: [[name, pass, detail]...] } in recent versions
  if (r && typeof r === 'object' && 'ok' in r) return r
  if (r && r.report) return { ok: r.report.every((x) => x[1]), report: r.report }
  return { ok: !!r, report: r }
}
for (const [k, s] of Object.entries(SW)) {
  for (const [bk, b] of Object.entries(BASES)) {
    const ol = checkReport(validateOrdinal(s.light.ramp, { mode: 'light', surface: b.light.surface }))
    const od = checkReport(validateOrdinal(s.dark.ramp, { mode: 'dark', surface: b.dark.surface }))
    if (!ol.ok) problems.push(`ramp light ${k}/${bk}: ${JSON.stringify(ol.report)}`)
    if (!od.ok) problems.push(`ramp dark ${k}/${bk}: ${JSON.stringify(od.report)}`)
    const darkTxt = b.neutral[900]
    if (contrast(s.dark.button, darkTxt) < 4.5) problems.push(`dark button text ${k}/${bk}: ${contrast(s.dark.button, darkTxt).toFixed(2)}`)
  }
  if (contrast(s.light.button, '#FFFFFF') < 4.5) problems.push(`light button text ${k}: ${contrast(s.light.button, '#FFFFFF').toFixed(2)}`)
}

// Which accent can go with which primary (both modes, both bases): chart pair must pass.
const compatible = {}
const pairDetail = {}
for (const p of Object.keys(SW)) {
  compatible[p] = []
  for (const a of Object.keys(SW)) {
    if (a === p) continue
    let all = true
    for (const [bk, b] of Object.entries(BASES)) {
      const l = checkReport(validate([SW[p].light.chart, SW[a].light.chart], { mode: 'light', surface: b.light.surface }))
      const d = checkReport(validate([SW[p].dark.chart, SW[a].dark.chart], { mode: 'dark', surface: b.dark.surface }))
      if (!l.ok || !d.ok) {
        all = false
        pairDetail[`${p}+${a}/${bk}`] = { light: l.ok, dark: d.ok, report: (!l.ok ? l : d).report?.filter?.((x) => !x[1]) }
      }
    }
    if (all) compatible[p].push(a)
  }
}

const out = { swatches: Object.fromEntries(Object.entries(SW).map(([k, v]) => [k, { name: HUES[k].name, ...v }])), bases: BASES, compatible }
console.log('PROBLEMS', problems.length ? problems : 'none')
console.log('COMPATIBLE', JSON.stringify(compatible))
console.log('FAILED PAIRS', Object.keys(pairDetail).join(' '))
console.log(JSON.stringify({ rosa: SW.rosa, celeste: SW.celeste }, null, 1).slice(0, 900))
writeFileSync(new URL('./palette.json', import.meta.url), JSON.stringify(out, null, 2))
