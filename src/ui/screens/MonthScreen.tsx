import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { monthRange, weekday, yearMonth } from '../../domain/dates'
import { buildAmountLookup, buildDoneLookup, formatPct, isHabitActive, isHabitScheduled, isWeeklyGoal, mentalState, monthStats } from '../../domain/habits'
import { formatAmount } from '../../domain/progress'
import { setHabitAmount, setHabitDone } from '../../data/repo'
import { AreaTrend } from '../../charts/AreaTrend'
import { Card, cx, Empty, ProgressBar, SectionTitle } from '../components'
import { WEEKDAY_SHORT, fmtDate, monthLabel } from '../format'
import { useDayMoods, useHabitLogs, useHabits, useSettings, useToday, useLinkedHabitDays } from '../hooks'
import { fmtDecimal, fmtFixed } from '../../domain/numberFormat'
import { t } from '../i18n'

export function MonthScreen() {
  const today = useToday()
  const params = useParams()
  const cur = yearMonth(today)
  const year = Number(params.year) || cur.year
  const month = Number(params.month) || cur.month
  const { from, to } = monthRange(year, month)

  const habits = useHabits()
  const logs = useHabitLogs(from, to)
  const moods = useDayMoods(from, to)
  const { weekStartsMonday } = useSettings()

  const linkedDays = useLinkedHabitDays()
  const isDone = useMemo(() => buildDoneLookup(logs ?? [], linkedDays ?? {}, habits ?? []), [logs, linkedDays, habits])
  const amountOf = useMemo(() => buildAmountLookup(logs ?? []), [logs])

  const stats = useMemo(() => monthStats(habits ?? [], year, month, isDone, today), [habits, year, month, isDone, today])
  const monthHabits = (habits ?? []).filter((h) => stats.days.some((d) => isHabitActive(h, d.date)))
  const moodByDate = new Map((moods ?? []).map((m) => [m.date, m]))

  const prev = month === 1 ? [year - 1, 12] : [year, month - 1]
  const next = month === 12 ? [year + 1, 1] : [year, month + 1]
  const weekBreak = weekStartsMonday ? 1 : 0
  const scrollRef = useRef<HTMLDivElement>(null)
  // Open the grid scrolled so today is visible.
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-date="${today}"]`)
    if (el && scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, el.offsetLeft - scrollRef.current.clientWidth / 2)
  }, [today, year, month, monthHabits.length])

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <Link to={`/habitos/mes/${prev[0]}/${prev[1]}`} className="grid size-11 place-items-center rounded-xl bg-white text-xl dark:bg-neutral-800" aria-label={t('Mes anterior')}>
          ‹
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-semibold capitalize">{monthLabel(year, month)}</h1>
          <p className="text-sm text-ink-soft dark:text-neutral-400">
            {t('Mes: {pct}', { pct: formatPct(stats.total) })} ·{' '}
            <Link to={`/habitos/anio/${year}`} className="underline">
              {t('ver {year}', { year })}
            </Link>
          </p>
        </div>
        <Link to={`/habitos/mes/${next[0]}/${next[1]}`} className="grid size-11 place-items-center rounded-xl bg-white text-xl dark:bg-neutral-800" aria-label={t('Mes siguiente')}>
          ›
        </Link>
      </header>

      <Card className="p-0">
        {monthHabits.length === 0 ? (
          <Empty>{t('Ningún hábito vigente este mes.')}</Empty>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left dark:bg-neutral-800">{t('Hábito')}</th>
                  {stats.days.map((d) => (
                    <th
                      key={d.date}
                      data-date={d.date}
                      className={cx(
                        'min-w-8 p-1 text-center font-normal text-ink-soft dark:text-neutral-400',
                        weekday(d.date) === weekBreak && 'border-l border-line dark:border-neutral-700',
                        d.date === today && 'text-ink font-bold dark:text-neutral-100',
                      )}
                    >
                      {WEEKDAY_SHORT[weekday(d.date)]}
                      <br />
                      {Number(d.date.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthHabits.map((h) => (
                  <tr key={h.id}>
                    <th className="sticky left-0 z-10 max-w-32 truncate bg-white p-2 text-left font-normal dark:bg-neutral-800">
                      {h.emoji} {h.name}
                    </th>
                    {stats.days.map((d) => {
                      // Weekly goals can be logged any day; other habits only on the days they're due.
                      const active = isWeeklyGoal(h) ? isHabitActive(h, d.date) : isHabitScheduled(h, d.date)
                      const isAmount = h.goal?.type === 'amount'
                      const amount = isAmount ? amountOf(h.id, d.date) : 0
                      const done = active && (isAmount && isWeeklyGoal(h) ? amount > 0 : isDone(h.id, d.date))
                      return (
                        <td key={d.date} className={cx('p-0.5 text-center', weekday(d.date) === weekBreak && 'border-l border-line dark:border-neutral-700')}>
                          {active && isAmount ? (
                            <button
                              aria-label={`${h.name} ${d.date}`}
                              disabled={d.future}
                              onClick={() => {
                                const v = prompt(t('{name} · {date}: ¿cuánto hiciste?', { name: h.name, date: fmtDate(d.date, false) }), amount ? fmtDecimal(amount) : '')
                                if (v !== null && Number(v.replace(',', '.')) >= 0) void setHabitAmount(h.id, d.date, Number(v.replace(',', '.')))
                              }}
                              className={cx(
                                'size-7 rounded-md border text-[10px]',
                                done ? 'border-progress bg-progress text-white dark:text-neutral-900' : 'border-line bg-paper dark:border-neutral-600 dark:bg-neutral-700',
                                d.future && 'opacity-40',
                              )}
                            >
                              {amount ? formatAmount(amount) : ''}
                            </button>
                          ) : active ? (
                            <button
                              aria-label={`${h.name} ${d.date}`}
                              disabled={d.future}
                              onClick={() => void setHabitDone(h.id, d.date, !done)}
                              className={cx(
                                'size-7 rounded-md border',
                                done ? 'border-progress bg-progress' : 'border-line bg-paper dark:border-neutral-600 dark:bg-neutral-700',
                                d.future && 'opacity-40',
                              )}
                            />
                          ) : (
                            <span className="text-line">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left font-semibold dark:bg-neutral-800">{t('% día')}</th>
                  {stats.days.map((d) => (
                    <td key={d.date} className="p-1 text-center text-[10px] text-ink-soft dark:text-neutral-400">
                      {d.future ? '' : formatPct(d.ratio).replace('%', '')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('Por hábito')}</SectionTitle>
        <ul className="space-y-3">
          {monthHabits.map((h) => (
            <li key={h.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>
                  {h.emoji} {h.name}
                </span>
                <span className="font-medium">{formatPct(stats.perHabit[h.id])}</span>
              </div>
              <ProgressBar value={stats.perHabit[h.id]?.pct ?? null} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>{t('Progreso diario')}</SectionTitle>
        <AreaTrend
          kind="progress"
          max={1}
          format={(v) => `${Math.round(v * 100)}%`}
          data={stats.days.map((d) => ({ label: String(Number(d.date.slice(8))), value: d.future ? null : d.ratio.pct }))}
        />
      </Card>

      <Card>
        <SectionTitle>{t('Estado mental')}</SectionTitle>
        <AreaTrend
          kind="mood"
          max={10}
          format={(v) => fmtFixed(v, 1)}
          data={stats.days.map((d) => ({ label: String(Number(d.date.slice(8))), value: mentalState(moodByDate.get(d.date)) }))}
        />
      </Card>
    </div>
  )
}
