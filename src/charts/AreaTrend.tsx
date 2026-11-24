import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '../ui/palette'

/**
 * Single-series area chart (no legend: the card title names it).
 * Colors come from the active theme: `primary` or `accent` (validated in palette.data.ts).
 */

export interface TrendPoint {
  label: string
  value: number | null
}

export function AreaTrend({
  data,
  kind,
  max,
  format,
  height = 160,
}: {
  data: TrendPoint[]
  kind: 'primary' | 'accent'
  max: number
  format: (v: number) => string
  height?: number
}) {
  const pal = useChartColors()
  const c = { stroke: pal[kind], fill: pal[kind] }
  const { ink, grid } = pal
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="label" tick={{ fill: ink, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis domain={[0, max]} tick={{ fill: ink, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={format} width={44} />
          <Tooltip
            cursor={{ stroke: ink, strokeDasharray: '3 3' }}
            formatter={(v) => [typeof v === 'number' ? format(v) : '—', '']}
            separator=""
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              background: pal.surface,
              color: pal.text,
              boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            }}
            labelStyle={{ color: ink }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={c.stroke}
            strokeWidth={2}
            fill={c.fill}
            fillOpacity={0.22}
            connectNulls={false}
            isAnimationActive={false}
            dot={{ r: 3, fill: c.stroke, stroke: pal.surface, strokeWidth: 1 }}
            activeDot={{ r: 4, stroke: pal.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
