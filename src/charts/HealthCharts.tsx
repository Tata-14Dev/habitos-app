/**
 * Weight and calorie charts. Trend = theme primary, weigh-ins = theme accent: every allowed
 * primary/accent pair is validated (lightness, chroma, CVD, contrast) in palette.data.ts.
 */
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors, type ChartColors } from '../ui/palette'
import { t } from '../ui/i18n'
import { fmtFixed, fmtThousands } from '../domain/numberFormat'

function colors(p: ChartColors) {
  return { trend: p.primary, point: p.accent, ink: p.ink, grid: p.grid, surface: p.surface }
}

function tooltipStyle(p: ChartColors) {
  return {
    contentStyle: { borderRadius: 12, border: 'none', background: p.surface, color: p.text, boxShadow: '0 2px 8px rgba(0,0,0,.15)' },
    labelStyle: { color: p.ink },
  }
}

export interface WeightPoint {
  label: string
  kg: number
  trend: number
}

/** Weigh-ins (dots) + 7-day trend (line). Two series → legend + the title names the chart. */
export function WeightChart({ data, goal, height = 200 }: { data: WeightPoint[]; goal?: number | null; height?: number }) {
  const pal = useChartColors()
  const c = colors(pal)
  const values = data.flatMap((d) => [d.kg, d.trend]).concat(goal ? [goal] : [])
  const min = Math.floor(Math.min(...values) - 0.5)
  const max = Math.ceil(Math.max(...values) + 0.5)
  const fmt = (v: number) => fmtFixed(v, 1)
  return (
    <div>
      <div className="mb-1 flex gap-4 text-xs text-ink-soft dark:text-neutral-400" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full" style={{ background: c.point }} /> {t('Pesaje')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: c.trend }} /> {t('Tendencia (7 días)')}
        </span>
        {goal ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c.ink }} /> {t('Meta')}
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
              formatter={(v, name) => [`${typeof v === 'number' ? fmt(v) : '—'} kg`, name === 'trend' ? t('Tendencia') : t('Pesaje')]}
              {...tooltipStyle(pal)}
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
  const pal = useChartColors()
  const c = colors(pal)
  const fmt = (v: number) => fmtThousands(Math.round(v))
  return (
    <div>
      {target ? (
        <div className="mb-1 flex items-center gap-1 text-xs text-ink-soft dark:text-neutral-400">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c.ink }} /> {t('Objetivo: {n} kcal', { n: fmt(target) })}
        </div>
      ) : null}
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={44} />
          <Tooltip cursor={{ fill: c.ink, fillOpacity: 0.08 }} formatter={(v) => [`${typeof v === 'number' ? fmt(v) : '—'} kcal`, '']} separator="" {...tooltipStyle(pal)} />
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
