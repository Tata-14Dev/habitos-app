/**
 * Burn-up: cumulative work per day. Real (solid green) and its projection (same green, dashed:
 * the same entity continued); the original plan is a neutral dashed reference, like the total.
 * Real/projection use the theme primary (validated in palette.data.ts).
 */
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BurnupPoint } from '../domain/burnup'
import { useChartColors } from '../ui/palette'
import { fmtDate } from '../ui/format'
import { t } from '../ui/i18n'
import { fmtDecimal } from '../domain/numberFormat'

const NAMES: Record<string, string> = { real: t('Real'), projection: t('Proyección'), plan: t('Plan original') }

export function BurnupChart({ data, total, unit, height = 200 }: { data: BurnupPoint[]; total: number; unit?: string; height?: number }) {
  const pal = useChartColors()
  const green = pal.primary
  const { ink, grid, surface } = pal
  const rows = data.map((p) => ({ ...p, label: fmtDate(p.date, false) }))
  const fmt = (v: number) => fmtDecimal(Math.round(v * 10) / 10)
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft dark:text-neutral-400" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: green }} /> {NAMES.real}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: green }} /> {NAMES.projection}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: ink }} /> {NAMES.plan}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dotted" style={{ borderColor: ink }} /> {t('Total ({n})', { n: `${fmt(total)}${unit ? ` ${unit}` : ''}` })}
        </span>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="label" tick={{ fill: ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" minTickGap={20} />
            <YAxis domain={[0, Math.ceil(total)]} tick={{ fill: ink, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={36} />
            <ReferenceLine y={total} stroke={ink} strokeDasharray="1 3" />
            <Tooltip
              cursor={{ stroke: ink, strokeDasharray: '3 3' }}
              formatter={(v, name) => [typeof v === 'number' ? `${fmt(v)}${unit ? ` ${unit}` : ''}` : '—', NAMES[String(name)] ?? String(name)]}
              contentStyle={{ borderRadius: 12, border: 'none', background: surface, color: pal.text, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}
              labelStyle={{ color: ink }}
            />
            <Line type="linear" dataKey="plan" stroke={ink} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="projection" stroke={green} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="real"
              stroke={green}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: surface, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
