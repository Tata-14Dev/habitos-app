/** Weekly pace of a plan: items (or hours…) per week, vs what's needed to finish on time. */
import { Link } from 'react-router-dom'
import { SimpleBars } from '../../charts/SimpleBars'
import type { ISODate } from '../../domain/dates'
import { formatAmount } from '../../domain/progress'
import { itemsDoneOn, recentWeeklyAverage, weeklySeries } from '../../domain/stats'
import type { Plan } from '../../data/types'
import { Card, SectionTitle } from '../components'
import { fmtDate } from '../format'
import { usePlanItems, usePlanLogs, useSettings } from '../hooks'
import { t } from '../i18n'
import { useAmountModel, usePlanModel } from '../usePlanModel'

const WEEKS = 8

function usePace(plan: Plan, today: ISODate) {
  const { weekStartsMonday } = useSettings()
  const isAmount = plan.kind === 'amount'
  const items = usePlanItems(isAmount ? undefined : plan.id)
  const logs = usePlanLogs(isAmount ? plan.id : undefined)
  const itemModel = usePlanModel(isAmount ? undefined : plan, items, today)
  const amountModel = useAmountModel(isAmount ? plan : undefined, logs, today)
  if (isAmount ? !logs || !amountModel : !items || !itemModel) return null

  const amountOn = isAmount
    ? (d: ISODate) => (logs ?? []).reduce((s, l) => (l.date === d ? s + l.amount : s), 0)
    : itemsDoneOn(items ?? [])
  const series = weeklySeries(amountOn, today, WEEKS, weekStartsMonday)
  const required = isAmount
    ? amountModel?.ok
      ? amountModel.value.requiredPace
      : null
    : itemModel?.metrics.ok
      ? itemModel.metrics.value.requiredPace
      : null
  // requiredPace is per available day; a week has (7 − rest weekdays) of them.
  const neededPerWeek = required === null ? null : Math.round(required * (7 - plan.restWeekdays.length) * 10) / 10
  return { series, average: recentWeeklyAverage(series), neededPerWeek, unit: plan.unit ?? (isAmount ? '' : t('ítems')) }
}

function PaceText({ average, needed, unit }: { average: number | null; needed: number | null; unit: string }) {
  return (
    <p className="text-sm">
      {average === null ? t('Todavía no hay semanas completas.') : t('Promedio: {n} por semana', { n: formatAmount(average, unit) })}
      {needed !== null && needed > 0 && (
        <span className="text-ink-soft dark:text-neutral-400"> · {t('necesitás {n}', { n: formatAmount(needed, unit) })}</span>
      )}
    </p>
  )
}

function PaceBars({ series, needed, unit, height }: { series: { date: ISODate; value: number }[]; needed: number | null; unit: string; height: number }) {
  return (
    <SimpleBars
      data={series.map((b) => ({ label: fmtDate(b.date, false), value: b.value }))}
      format={(v) => formatAmount(v)}
      target={needed}
      targetLabel={needed ? t('Lo que necesitás por semana: {n}', { n: formatAmount(needed, unit) }) : undefined}
      height={height}
    />
  )
}

/** Card for the plan page. */
export function PlanPaceCard({ plan, today }: { plan: Plan; today: ISODate }) {
  const p = usePace(plan, today)
  if (!p) return null
  return (
    <Card>
      <SectionTitle>{t('Ritmo semanal')}</SectionTitle>
      <PaceText average={p.average} needed={p.neededPerWeek} unit={p.unit} />
      <div className="mt-3">
        <PaceBars series={p.series} needed={p.neededPerWeek} unit={p.unit} height={150} />
      </div>
    </Card>
  )
}

/** Compact row for the stats overview. */
export function PlanPaceRow({ plan, today }: { plan: Plan; today: ISODate }) {
  const p = usePace(plan, today)
  if (!p) return null
  return (
    <li className="py-3">
      <Link to={`/planes/${plan.id}`} className="font-medium underline-offset-2 hover:underline">
        {plan.name}
      </Link>
      <PaceText average={p.average} needed={p.neededPerWeek} unit={p.unit} />
      <div className="mt-2">
        <PaceBars series={p.series} needed={p.neededPerWeek} unit={p.unit} height={110} />
      </div>
    </li>
  )
}
