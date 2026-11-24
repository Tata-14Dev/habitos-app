/** UI for amount plans (hours, pages…): dashboard, quick log, history. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAR, type ISODate } from '../../domain/dates'
import { marginLabel } from '../../domain/plans'
import { formatAmount, type AmountPlanMetrics } from '../../domain/progress'
import { amountBurnup } from '../../domain/burnup'
import { toScheduleConfig } from '../../domain/plans'
import { BurnupChart } from '../../charts/Burnup'
import { addToPlanLog, setPlanLog } from '../../data/repo'
import type { Plan, PlanLog } from '../../data/types'
import { Button, Card, cx, Empty, Field, inputCls, ProgressBar, SectionTitle, Sheet } from '../components'
import { usePlanLogs } from '../hooks'
import { useAmountModel } from '../usePlanModel'

const parseNum = (s: string) => Number(s.replace(',', '.'))

/** "✅ Al día (+1,5 h)" / "⚠️ Atrasado 2 h". */
function amountSituation(diff: number, unit?: string): string {
  if (diff >= 0) return `✅ Al día${diff > 0 ? ` (+${formatAmount(diff, unit)})` : ''}`
  return `⚠️ Atrasado ${formatAmount(-diff, unit)}`
}

/** "Hoy te tocan 2 h" / "Hoy hiciste 3 h 🎉" / "Hoy no toca". */
function todayLine(m: AmountPlanMetrics, unit?: string): string {
  if (m.pending === 0) return 'Plan completo 🎉'
  if (m.todayRemaining > 0) {
    return m.doneToday > 0
      ? `Llevás ${formatAmount(m.doneToday, unit)} hoy, te faltan ${formatAmount(m.todayRemaining, unit)}`
      : `Hoy te tocan ${formatAmount(m.todayRemaining, unit)}`
  }
  if (m.doneToday > 0) return `Hoy hiciste ${formatAmount(m.doneToday, unit)} 🎉`
  return 'Hoy no te toca nada de este plan'
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-paper p-3 dark:bg-neutral-900">
      <dt className="text-xs text-ink-soft dark:text-neutral-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-soft dark:text-neutral-400">{sub}</dd>}
    </div>
  )
}

function ErrorNotice({ error }: { error: Error }) {
  return <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">⚠️ No pude calcular el plan: {error.message}</p>
}

/** Quick buttons + custom amount, always for today. */
export function QuickLog({ plan, today }: { plan: Plan; today: ISODate }) {
  const [custom, setCustom] = useState('')
  const quick = [...new Set([plan.pace, 1, 0.5].map((n) => Math.round(n * 100) / 100))].filter((n) => n > 0).slice(0, 3)
  const n = parseNum(custom)
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        {quick.map((q) => (
          <Button key={q} className="flex-1" onClick={() => void addToPlanLog(plan.id, today, q)}>
            +{formatAmount(q, plan.unit)}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!(n > 0)) return
          void addToPlanLog(plan.id, today, n).then(() => setCustom(''))
        }}
      >
        <input
          inputMode="decimal"
          className={cx(inputCls, 'flex-1')}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={`Otra cantidad (${plan.unit ?? 'unidades'})`}
          aria-label={`Cantidad de ${plan.unit ?? 'unidades'} para sumar hoy`}
        />
        <Button type="submit" variant="primary" disabled={!(n > 0)}>
          Sumar
        </Button>
      </form>
    </div>
  )
}

export function AmountDashboard({ plan, logs, today }: { plan: Plan; logs: PlanLog[]; today: ISODate }) {
  const model = useAmountModel(plan, logs, today)
  if (!model) return null
  const m = model.ok ? model.value : null
  const target = plan.target ?? 0
  const done = logs.reduce((s, l) => s + l.amount, 0)
  return (
    <Card>
      <SectionTitle>Panel</SectionTitle>
      <div className="mb-1 flex justify-between text-sm">
        <span>Progreso</span>
        <span className="font-semibold">
          {formatAmount(done)}/{formatAmount(target, plan.unit)}
        </span>
      </div>
      <ProgressBar value={target ? Math.min(1, done / target) : null} />
      {!model.ok && 'error' in model && <ErrorNotice error={model.error} />}
      {m && (
        <>
          <p className="mt-3 font-medium">{todayLine(m, plan.unit)}</p>
          <QuickLog plan={plan} today={today} />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat
              label="Situación"
              value={amountSituation(m.diff, plan.unit)}
              sub={`Deberías llevar ${formatAmount(m.shouldHaveDone)}, llevás ${formatAmount(m.done)}`}
            />
            <Stat label="Margen" value={m.marginDays === null ? '—' : marginLabel(m.marginDays)} sub={`Límite ${formatAR(plan.deadline)}`} />
            <Stat label="Fin estimado" value={m.estimatedEnd ? formatAR(m.estimatedEnd) : '—'} />
            <Stat
              label="Ritmo necesario"
              value={
                m.requiredPace === null
                  ? 'Sin días'
                  : m.requiredPace === 0 && m.pending > 0
                    ? `Menos de ${formatAmount(0.1, plan.unit)}/día`
                    : `${formatAmount(m.requiredPace, plan.unit)}/día`
              }
              sub={`Tu ritmo: ${formatAmount(plan.pace, plan.unit)}/día`}
            />
          </dl>
          {target > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Avance</p>
              <BurnupChart data={amountBurnup(target, logs, toScheduleConfig(plan), today)} total={target} unit={plan.unit} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export function LogHistory({ plan, logs, today }: { plan: Plan; logs: PlanLog[]; today: ISODate }) {
  const [editing, setEditing] = useState<{ date: ISODate; amount: number } | null>(null)
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Card>
      <SectionTitle right={<Button onClick={() => setEditing({ date: today, amount: 0 })}>+ Otro día</Button>}>Registro</SectionTitle>
      {sorted.length === 0 ? (
        <Empty>Todavía no registraste avance.</Empty>
      ) : (
        <ul className="divide-y divide-line dark:divide-neutral-700">
          {sorted.map((l) => (
            <li key={l.id}>
              <button className="flex w-full items-center justify-between py-2 text-left" onClick={() => setEditing(l)}>
                <span>{l.date === today ? 'Hoy' : formatAR(l.date)}</span>
                <span className="font-semibold">{formatAmount(l.amount, plan.unit)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Avance de un día">
        {editing && <LogForm plan={plan} initial={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Card>
  )
}

function LogForm({ plan, initial, onDone }: { plan: Plan; initial: { date: ISODate; amount: number }; onDone: () => void }) {
  const [date, setDate] = useState(initial.date)
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount).replace('.', ',') : '')
  const n = parseNum(amount)
  const valid = !!date && n >= 0 && amount.trim() !== ''
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const move = initial.amount > 0 && date !== initial.date ? setPlanLog(plan.id, initial.date, 0) : Promise.resolve()
        void move.then(() => setPlanLog(plan.id, date, n)).then(onDone)
      }}
    >
      <Field label="Día">
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={`Cantidad ese día (${plan.unit ?? 'unidades'})`} hint="Reemplaza lo registrado ese día. 0 lo borra.">
        <input inputMode="decimal" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          Guardar
        </Button>
        {initial.amount > 0 && (
          <Button type="button" variant="danger" onClick={() => void setPlanLog(plan.id, initial.date, 0).then(onDone)}>
            Borrar
          </Button>
        )}
      </div>
    </form>
  )
}

/** Card for the Today screen. */
export function AmountToday({ plan, today }: { plan: Plan; today: ISODate }) {
  const logs = usePlanLogs(plan.id)
  const model = useAmountModel(plan, logs, today)
  if (!logs || !model) return null
  const target = plan.target ?? 0
  const done = logs.reduce((s, l) => s + l.amount, 0)
  const m = model.ok ? model.value : null
  return (
    <Card>
      <SectionTitle
        right={
          <Link to={`/planes/${plan.id}`} className="text-sm underline">
            Ver plan
          </Link>
        }
      >
        {plan.name}
      </SectionTitle>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>
          {formatAmount(done)}/{formatAmount(target, plan.unit)}
        </span>
        {m && m.marginDays !== null && <span className="font-medium">{marginLabel(m.marginDays)}</span>}
      </div>
      <ProgressBar value={target ? Math.min(1, done / target) : null} />
      {!model.ok && 'error' in model && <ErrorNotice error={model.error} />}
      {m && (
        <>
          <p className="mt-3">{todayLine(m, plan.unit)}</p>
          {m.pending > 0 && <QuickLog plan={plan} today={today} />}
        </>
      )}
    </Card>
  )
}

/** Progress line for the plans list. */
export function AmountSummary({ plan, today }: { plan: Plan; today: ISODate }) {
  const logs = usePlanLogs(plan.id)
  const model = useAmountModel(plan, logs, today)
  const target = plan.target ?? 0
  const done = (logs ?? []).reduce((s, l) => s + l.amount, 0)
  const m = model?.ok ? model.value : null
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span>
          {formatAmount(done)}/{formatAmount(target, plan.unit)}
        </span>
        {m && m.marginDays !== null && <span>{marginLabel(m.marginDays)}</span>}
      </div>
      <ProgressBar value={target ? Math.min(1, done / target) : null} />
    </>
  )
}
