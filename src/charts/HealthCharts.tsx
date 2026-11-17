/**
 * Weight and calorie charts. Palette validated (scripts/validate_palette.js from the dataviz guide):
 * light #38761D / #A64D79, dark #67A34C / #BF6496 — both pass lightness, chroma, CVD and contrast.
 */
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsDark } from '../ui/theme'

const COLORS = {
  light: { trend: '#38761D', point: '#A64D79', ink: '#666666', grid: '#EFEFEF', surface: '#ffffff' },
  dark: { trend: '#67A34C', point: '#BF6496', ink: '#a3a3a3', grid: '#404040', surface: '#262626' },
}

function tooltipStyle(dark: boolean) {
  return {
    contentStyle: {
      borderRadius: 12,
      border: 'none',
      background: dark ? '#262626' : '#ffffff',
      color: dark ? '#e5e5e5' : '#434343',
      boxShadow: '0 2px 8px rgba(0,0,0,.15)',
    },
    labelStyle: { color: dark ? '#a3a3a3' : '#666666' },
  }
}

export interface WeightPoint {
  label: string
  kg: number
  trend: number
}

/** Weigh-ins (dots) + 7-day trend (line). Two series → legend + the title names the chart. */
export function WeightChart({ data, goal, height = 200 }: { data: WeightPoint[]; goal?: number | null; height?: number }) {
  const dark = useIsDark()
  const c = COLORS[dark ? 'dark' : 'light']
  const values = data.flatMap((d) => [d.kg, d.trend]).concat(goal ? [goal] : [])
  const min = Math.floor(Math.min(...values) - 0.5)
  const max = Math.ceil(Math.max(...values) + 0.5)
  const fmt = (v: number) => v.toFixed(1).replace('.', ',')
  return (
    <div>
      <div className="mb-1 flex gap-4 text-xs text-ink-soft dark:text-neutral-400" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full" style={{ background: c.point }} /> Pesaje
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: c.trend }} /> Tendencia (7 días)
        </span>
        {goal ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c.ink }} /> Meta
          </span>
        ) : null}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis domain={[min, max]} tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={40} />
            {goal ? <ReferenceLine y={goal} stroke={c.ink} strokeDasharray="4 4" /> : null}
            <Tooltip
              cursor={{ stroke: c.ink, strokeDasharray: '3 3' }}
              formatter={(v, name) => [`${typeof v === 'number' ? fmt(v) : '—'} kg`, name === 'trend' ? 'Tendencia' : 'Pesaje']}
              {...tooltipStyle(dark)}
            />
            <Scatter dataKey="kg" fill={c.point} stroke={c.surface} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="trend" stroke={c.trend} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export interface CaloriePoint {
  label: string
  kcal: number | null
}

/** kcal per day (single series, no legend) with the daily target as a labeled dashed line. */
export function CalorieBars({ data, target, height = 180 }: { data: CaloriePoint[]; target?: number; height?: number }) {
  const dark = useIsDark()
  const c = COLORS[dark ? 'dark' : 'light']
  const fmt = (v: number) => Math.round(v).toLocaleString('es-AR')
  return (
    <div>
      {target ? (
        <div className="mb-1 flex items-center gap-1 text-xs text-ink-soft dark:text-neutral-400">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c.ink }} /> Objetivo: {fmt(target)} kcal
        </div>
      ) : null}
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={44} />
          <Tooltip cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} formatter={(v) => [`${typeof v === 'number' ? fmt(v) : '—'} kcal`, '']} separator="" {...tooltipStyle(dark)} />
          {target ? (
            <ReferenceLine y={target} stroke={c.ink} strokeDasharray="4 4" ifOverflow="extendDomain" />
          ) : null}
          <Bar dataKey="kcal" fill={c.trend} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    </div>
  )
}
