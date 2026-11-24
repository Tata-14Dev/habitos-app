/**
 * Yearly overview: % per month (chart) and a "year in pixels" — twelve mini calendars where
 * each day's shade is the share of its due habits that got done.
 * Sequential ramps validated with the dataviz script (--ordinal), light and dark.
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AreaTrend } from '../../charts/AreaTrend'
import { formatAR, weekday, yearMonth, type ISODate } from '../../domain/dates'
import { buildDoneLookup, formatPct, monthStats, rangeRatio, type MonthStats } from '../../domain/habits'
import { Card, cx, SectionTitle } from '../components'
import { monthLabel } from '../format'
import { useHabitLogs, useHabits, useLinkedHabitDays, useSettings, useToday } from '../hooks'
import { useIsDark } from '../theme'

const RAMP = {
  light: ['#88C16E', '#6FAE53', '#558F3B', '#3D7027', '#285217'],
  dark: ['#3A5A2B', '#4F7D3A', '#67A34C', '#86BF6B', '#A9D893'],
}
const BINS = ['1–24%', '25–49%', '50–74%', '75–99%', '100%']

/** Ramp step for a day's %: 0 → none (a miss), (0, 25) → 0 … 100% → 4. */
function step(pct: number): number {
  if (pct >= 1) return 4
  return Math.min(3, Math.floor(pct * 4))
}

function MiniMonth({ stats, mondayFirst, ramp, today }: { stats: MonthStats; mondayFirst: boolean; ramp: string[]; today: ISODate }) {
  const offset = (weekday(stats.days[0].date) - (mondayFirst ? 1 : 0) + 7) % 7
  return (
    <Link to={`/habitos/mes/${stats.year}/${stats.month}`} className="block rounded-xl bg-paper p-3 dark:bg-neutral-900">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium capitalize">{monthLabel(stats.year, stats.month).split(' ')[0]}</span>
        <span className="text-xs text-ink-soft dark:text-neutral-400">{formatPct(stats.total)}</span>
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {stats.days.map((d) => {
          const pct = d.ratio.pct
          const color = !d.future && pct !== null && pct > 0 ? ramp[step(pct)] : undefined
          return (
            <span
              key={d.date}
              title={`${formatAR(d.date, false)}: ${d.future ? 'todavía no' : formatPct(d.ratio)}`}
              aria-label={`${formatAR(d.date, false)}: ${d.future ? 'todavía no' : formatPct(d.ratio)}`}
              className={cx(
                'aspect-square rounded-[3px]',
                !color && (d.future || pct === null ? 'bg-transparent ring-1 ring-inset ring-line dark:ring-neutral-700' : 'bg-line dark:bg-neutral-700'),
                d.date === today && 'outline outline-2 outline-offset-1 outline-ink dark:outline-neutral-200',
              )}
              style={color ? { background: color } : undefined}
            />
          )
        })}
      </div>
    </Link>
  )
}

export function YearScreen() {
  const today = useToday()
  const params = useParams()
  const year = Number(params.year) || yearMonth(today).year
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const habits = useHabits()
  const logs = useHabitLogs(from, to)
  const linkedDays = useLinkedHabitDays()
  const { weekStartsMonday } = useSettings()
  const ramp = RAMP[useIsDark() ? 'dark' : 'light']

  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linkedDays ?? {}, habits ?? []), [logs, linkedDays, habits])
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => monthStats(habits ?? [], year, i + 1, isDone, today)),
    [habits, year, isDone, today],
  )
  const total = useMemo(() => rangeRatio(habits ?? [], from, to, isDone, today), [habits, from, to, isDone, today])
  const trend = months.map((m) => ({ label: monthLabel(year, m.month).slice(0, 3), value: m.total.pct }))

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <Link to={`/habitos/anio/${year - 1}`} className="grid size-11 place-items-center rounded-xl bg-white text-xl dark:bg-neutral-800" aria-label="Año anterior">
          ‹
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold">{year}</h1>
          <p className="text-sm text-ink-soft dark:text-neutral-400">Año: {formatPct(total)}</p>
        </div>
        <Link to={`/habitos/anio/${year + 1}`} className="grid size-11 place-items-center rounded-xl bg-white text-xl dark:bg-neutral-800" aria-label="Año siguiente">
          ›
        </Link>
      </header>

      <Card>
        <SectionTitle>Por mes</SectionTitle>
        <AreaTrend data={trend} kind="progress" max={1} format={(v) => `${Math.round(v * 100)}%`} />
      </Card>

      <Card>
        <SectionTitle>Día por día</SectionTitle>
        <div className="mb-3 flex items-center gap-1 text-[11px] text-ink-soft dark:text-neutral-400" aria-label="Referencia de colores">
          <span className="mr-1">0%</span>
          <span className="size-3 rounded-[3px] bg-line dark:bg-neutral-700" />
          {ramp.map((c, i) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} title={BINS[i]} />
          ))}
          <span className="ml-1">100%</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {months.map((m) => (
            <MiniMonth key={m.month} stats={m} mondayFirst={weekStartsMonday} ramp={ramp} today={today} />
          ))}
        </div>
      </Card>
    </div>
  )
}
