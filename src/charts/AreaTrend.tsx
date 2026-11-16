import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsDark } from '../ui/theme'

/**
 * Single-series area chart (no legend: the card title names it).
 * Brand fills (#93C47D / #D5A6BD) with a darker stroke in light mode for ≥3:1 contrast.
 */
const PALETTE = {
  progress: { light: { stroke: '#38761D', fill: '#93C47D' }, dark: { stroke: '#93C47D', fill: '#93C47D' } },
  mood: { light: { stroke: '#A64D79', fill: '#D5A6BD' }, dark: { stroke: '#D5A6BD', fill: '#D5A6BD' } },
} as const

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
  kind: keyof typeof PALETTE
  max: number
  format: (v: number) => string
  height?: number
}) {
  const dark = useIsDark()
  const c = PALETTE[kind][dark ? 'dark' : 'light']
  const ink = dark ? '#a3a3a3' : '#666666'
  const grid = dark ? '#404040' : '#EFEFEF'
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
              background: dark ? '#262626' : '#ffffff',
              color: dark ? '#e5e5e5' : '#434343',
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
            fillOpacity={0.35}
            connectNulls={false}
            isAnimationActive={false}
            dot={{ r: 3, fill: c.stroke, stroke: dark ? "#262626" : "#ffffff", strokeWidth: 1 }}
            activeDot={{ r: 4, stroke: dark ? '#262626' : '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
