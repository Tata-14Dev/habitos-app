/**
 * Single-series bar chart (no legend: the card title names it) in the theme primary, with an
 * optional dashed target line that gets its own caption. Hover/tap shows the value.
 */
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '../ui/palette'

export interface BarPoint {
  label: string
  value: number | null
}

export function SimpleBars({
  data,
  format,
  max,
  target,
  targetLabel,
  height = 160,
}: {
  data: BarPoint[]
  format: (v: number) => string
  /** Fixed top of the axis (e.g. 1 for percentages); auto if omitted. */
  max?: number
  target?: number | null
  targetLabel?: string
  height?: number
}) {
  const c = useChartColors()
  return (
    <div>
      {target ? (
        <div className="mb-1 flex items-center gap-1 text-xs text-ink-soft dark:text-neutral-400">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: c.ink }} aria-hidden /> {targetLabel}
        </div>
      ) : null}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tick={{ fill: c.ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis
              domain={[0, max ?? 'auto']}
              tick={{ fill: c.ink, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={format}
              width={40}
            />
            <Tooltip
              cursor={{ fill: c.ink, fillOpacity: 0.08 }}
              formatter={(v) => [typeof v === 'number' ? format(v) : '—', '']}
              separator=""
              contentStyle={{ borderRadius: 12, border: 'none', background: c.surface, color: c.text, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}
              labelStyle={{ color: c.ink }}
            />
            {target ? <ReferenceLine y={target} stroke={c.ink} strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
            <Bar dataKey="value" fill={c.primary} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
