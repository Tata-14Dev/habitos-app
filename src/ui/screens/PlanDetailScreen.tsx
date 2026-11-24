import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { compareISO, formatAR, type ISODate } from '../../domain/dates'
import { itemsBurnup } from '../../domain/burnup'
import { BurnupChart } from '../../charts/Burnup'
import { marginLabel, numberedItems, numberingOf, situationLabel, toScheduleConfig, toScheduleItems } from '../../domain/plans'
import { formatAmount } from '../../domain/progress'
import type { PlanMetrics } from '../../domain/schedule'
import {
  addItems,
  deleteItem,
  deleteMilestone,
  deletePlan,
  replanFromToday,
  reorderItems,
  saveMilestone,
  setItemDone,
  setPriorUntil,
  updateItem,
  updatePlan,
} from '../../data/repo'
import type { Milestone, Plan, PlanItem } from '../../data/types'
import { Button, Card, Check, cx, Empty, Field, inputCls, MoreOptions, PendingNotice, ProgressBar, SectionTitle, Sheet } from '../components'
import { useMilestones, usePlan, usePlanItems, usePlanLogs, useToday } from '../hooks'
import { SortableList } from '../Sortable'
import { usePlanModel, type PlanModel } from '../usePlanModel'
import { AmountDashboard, LogHistory } from './AmountPlan'
import { CurrentLine } from './CurrentLine'
import { PlanForm } from './PlanForm'

export function PlanDetailScreen() {
  const { id } = useParams()
  const today = useToday()
  const plan = usePlan(id)
  const items = usePlanItems(id)
  const logs = usePlanLogs(id)
  const model = usePlanModel(plan, items, today)
  const [editing, setEditing] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [settingStart, setSettingStart] = useState(false)
  const navigate = useNavigate()

  if (plan === undefined || !items || !logs || !model) return <Empty>Cargando…</Empty>
  if (!plan || plan.deletedAt) return <Empty>Este plan no existe.</Empty>
  const isAmount = plan.kind === 'amount'
  const prior = items.filter((i) => i.prior)
  const inPlan = items.filter((i) => !i.prior)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2 pt-2">
        <div>
          <h1 className="text-2xl font-semibold">{plan.name}</h1>
          <p className="text-sm text-ink-soft dark:text-neutral-400">
            {formatAR(plan.startDate, false)} → {formatAR(plan.deadline)} · ritmo {formatAmount(plan.pace)} por día
          </p>
        </div>
        <Button onClick={() => setEditing(true)}>Editar</Button>
      </header>

      {isAmount ? (
        <>
          <AmountDashboard plan={plan} logs={logs} today={today} />
          <LogHistory plan={plan} logs={logs} today={today} />
        </>
      ) : (
        <>
      <Dashboard plan={plan} model={model} items={items} today={today} />
      <ItemsBurnup plan={plan} model={model} items={items} today={today} />

      <Card>
        <SectionTitle right={<Button onClick={() => setPasting(true)}>+ Ítems</Button>}>Ítems</SectionTitle>
        {items.length === 0 ? (
          <Empty>Pegá la lista de ítems con "+ Ítems".</Empty>
        ) : (
          <div className="space-y-3">
            {prior.length > 0 && (
              <MoreOptions summary={`✓ ${prior.length} hechos antes del plan`} hint={`${prior[0].title} → ${prior[prior.length - 1].title}`}>
                <ul className="divide-y divide-line dark:divide-neutral-700">
                  {prior.map((it) => (
                    <li key={it.id}>
                      <ItemRow item={it} plan={plan} model={model} today={today} handle={<span />} onEdit={() => setEditItem(it)} />
                    </li>
                  ))}
                </ul>
              </MoreOptions>
            )}
            <SortableList
              items={inPlan}
              // Prior items keep the first positions; the rest are reordered after them.
              onReorder={(ids) => void reorderItems(plan.id, [...prior.map((p) => p.id), ...ids])}
              className="divide-y divide-line dark:divide-neutral-700"
              render={(it, handle) => (
                <ItemRow item={it} plan={plan} model={model} today={today} handle={handle} onEdit={() => setEditItem(it)} />
              )}
            />
          </div>
        )}
      </Card>
        </>
      )}

      <Milestones planId={plan.id} today={today} />

      <Card>
        <SectionTitle>Acciones</SectionTitle>
        <div className="space-y-2">
          {!isAmount && items.length > 0 && (
            <Button className="w-full" onClick={() => setSettingStart(true)}>
              📍 Ya hice hasta el ítem…
            </Button>
          )}
          {!isAmount && (
          <Button
            className="w-full"
            onClick={() => {
              if (!confirm('¿Reemplazar el plan original por la proyección actual? Esto no se puede deshacer.')) return
              void replanFromToday(plan.id, today).then((r) => {
                if (r === 'pending') alert('🛠️ Pendiente: implementá projectSchedule (ver docs/GUIA_REPROGRAMACION.md)')
              })
            }}
          >
            🔁 Replanificar desde hoy
          </Button>
          )}
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm(`¿Borrar el plan "${plan.name}" con todos sus ítems?`)) void deletePlan(plan.id).then(() => navigate('/planes'))
            }}
          >
            Borrar plan
          </Button>
        </div>
      </Card>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar plan">
        <PlanForm
          plan={plan}
          total={isAmount ? plan.target : inPlan.length}
          submitLabel="Guardar"
          onSubmit={async (v) => {
            await updatePlan(plan.id, {
              name: v.name,
              unit: v.unit,
              ...(isAmount ? { target: v.target } : {}),
              startDate: v.startDate,
              deadline: v.deadline,
              pace: v.pace,
              restWeekdays: v.restWeekdays,
              blockedDates: v.blockedDates,
            })
            setEditing(false)
          }}
        />
        <p className="mt-3 text-xs text-ink-soft">
          Cambiar la configuración recalcula la proyección al instante. El plan original solo cambia con "Replanificar desde hoy".
        </p>
      </Sheet>

      <Sheet open={pasting} onClose={() => setPasting(false)} title="Agregar ítems">
        <PasteItems planId={plan.id} titles={items.map((i) => i.title)} onDone={() => setPasting(false)} />
      </Sheet>

      <Sheet open={settingStart} onClose={() => setSettingStart(false)} title="¿Por dónde vas?">
        {settingStart && <PriorForm plan={plan} items={items} today={today} onDone={() => setSettingStart(false)} />}
      </Sheet>

      <Sheet open={!!editItem} onClose={() => setEditItem(null)} title="Ítem">
        {editItem && <ItemForm item={editItem} onDone={() => setEditItem(null)} />}
      </Sheet>
    </div>
  )
}

/** Burn-up of the items in the plan (items done before the plan are left out). */
function ItemsBurnup({ plan, model, items, today }: { plan: Plan; model: PlanModel; items: PlanItem[]; today: ISODate }) {
  const sItems = toScheduleItems(items)
  if (!model.projection.ok || sItems.length < 2) return null
  const data = itemsBurnup(sItems, plan.baseline, model.projection.value, toScheduleConfig(plan), today)
  return (
    <Card>
      <SectionTitle>Avance</SectionTitle>
      <BurnupChart data={data} total={sItems.length} unit={plan.unit} />
    </Card>
  )
}

function Dashboard({ plan, model, items, today }: { plan: Plan; model: PlanModel; items: PlanItem[]; today: ISODate }) {
  const m: PlanMetrics | null = model.metrics.ok ? model.metrics.value : null
  const byId = new Map(items.map((i) => [i.id, i]))
  return (
    <Card>
      <SectionTitle>Panel</SectionTitle>
      <div className="mb-1 flex justify-between text-sm">
        <span>Progreso</span>
        <span className="font-semibold">
          {model.doneCount}/{model.total}
        </span>
      </div>
      <ProgressBar value={model.total ? model.doneCount / model.total : null} />
      <CurrentLine items={items} />

      <div className="mt-3">
        <PendingNotice fns={model.pending} />
      </div>

      {m && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Situación" value={situationLabel(m.diff)} sub={`Debería llevar ${m.shouldHaveDone}, llevo ${m.done}`} />
          <Stat label="Margen" value={m.marginDays === null ? '—' : marginLabel(m.marginDays)} sub={`Límite ${formatAR(plan.deadline)}`} />
          <Stat label="Fin estimado" value={m.estimatedEnd ? formatAR(m.estimatedEnd) : '—'} />
          <Stat
            label="Ritmo necesario"
            value={m.requiredPace === null ? 'Sin días' : `${String(m.requiredPace).replace('.', ',')}/día`}
            sub={`Tu ritmo: ${String(plan.pace).replace('.', ',')}/día`}
          />
        </dl>
      )}

      {m && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">Hoy toca</p>
          {m.todayItemIds.length === 0 ? (
            <p className="text-sm text-ink-soft">Nada pendiente para hoy. 🎉</p>
          ) : (
            <ul className="space-y-1">
              {m.todayItemIds.map((id) => {
                const it = byId.get(id)
                if (!it) return null
                return (
                  <li key={id} className="flex items-center gap-3">
                    <Check checked={it.done} label={it.title} onChange={(v) => void setItemDone(id, v, today)} />
                    <span>{it.title}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
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

function ItemRow({
  item,
  plan,
  model,
  today,
  handle,
  onEdit,
}: {
  item: PlanItem
  plan: Plan
  model: PlanModel
  today: ISODate
  handle: React.ReactNode
  onEdit: () => void
}) {
  const base = plan.baseline[item.id]
  const proj = model.projection.ok ? model.projection.value[item.id] : undefined
  const late = !item.done && base && proj && compareISO(proj, base) > 0
  return (
    <div className="grid grid-cols-[2rem_2.75rem_1fr] items-center gap-3 py-2">
      {handle}
      <Check checked={item.done} label={item.title} onChange={(v) => void setItemDone(item.id, v, today)} />
      <button className="min-w-0 py-1 text-left" onClick={onEdit}>
        <span className={cx('block truncate', item.done && 'text-ink-soft line-through')}>{item.title}</span>
        <span className="block truncate text-xs text-ink-soft dark:text-neutral-400">
          {item.section && `${item.section} · `}
          {item.prior ? (
            <>Hecho antes del plan</>
          ) : item.done && item.doneDate ? (
            <>Hecho el {formatAR(item.doneDate, false)}</>
          ) : proj ? (
            <>
              Toca el <span className={cx(late && 'font-medium text-amber-700 dark:text-amber-400')}>{formatAR(proj, false)}</span>
              {late && base && ` (plan: ${formatAR(base, false)})`}
            </>
          ) : base ? (
            <>Plan: {formatAR(base, false)}</>
          ) : null}
        </span>
      </button>
    </div>
  )
}

function ItemForm({ item, onDone }: { item: PlanItem; onDone: () => void }) {
  const [title, setTitle] = useState(item.title)
  const [section, setSection] = useState(item.section ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [doneDate, setDoneDate] = useState(item.doneDate ?? '')
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void updateItem(item.id, {
          title: title.trim() || item.title,
          section: section.trim() || undefined,
          notes: notes.trim() || undefined,
          ...(item.done && doneDate ? { doneDate } : {}),
        }).then(onDone)
      }}
    >
      <Field label="Nombre">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Módulo o sección">
        <input className={inputCls} value={section} onChange={(e) => setSection(e.target.value)} />
      </Field>
      <Field label="Notas">
        <textarea className={cx(inputCls, 'min-h-20')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {item.done && (
        <Field label="Fecha en que lo hiciste">
          <input type="date" className={inputCls} value={doneDate} onChange={(e) => setDoneDate(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1">
          Guardar
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (confirm(`¿Borrar "${item.title}"?`)) void deleteItem(item.id).then(onDone)
          }}
        >
          Borrar
        </Button>
      </div>
    </form>
  )
}

/** "Ya hice hasta el ítem N": everything up to N counts as done before the plan; re-plans from today. */
function PriorForm({ plan, items, today, onDone }: { plan: Plan; items: PlanItem[]; today: ISODate; onDone: () => void }) {
  const firstPending = items.findIndex((i) => !i.done)
  const [n, setN] = useState(String(firstPending > 0 ? firstPending : items.filter((i) => i.prior).length || ''))
  const num = Number(n)
  const valid = n.trim() !== '' && Number.isInteger(num) && num >= 0 && num < items.length
  const next = valid ? items[num] : undefined
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) void setPriorUntil(plan.id, num, today).then(onDone)
      }}
    >
      <Field label={`Ya hice hasta el ítem número (de ${items.length})`}>
        <input inputMode="numeric" className={inputCls} value={n} onChange={(e) => setN(e.target.value)} autoFocus />
      </Field>
      <p className="text-sm text-ink-soft dark:text-neutral-400">
        {valid && next
          ? `Del 1 al ${num} quedan como hechos antes del plan (no cuentan como atraso ni como hechos hoy). Arrancás en ${next.title} y el cronograma se rearma desde hoy con los ${items.length - num} que faltan.`
          : `Poné un número entre 0 y ${items.length - 1}. Si te faltan ítems, primero agregalos con "+ Ítems".`}
      </p>
      <Button type="submit" variant="primary" className="w-full" disabled={!valid}>
        Arrancar desde {next ? next.title : '…'}
      </Button>
    </form>
  )
}

function PasteItems({ planId, titles, onDone }: { planId: string; titles: string[]; onDone: () => void }) {
  const numbering = numberingOf(titles)
  const [mode, setMode] = useState<'count' | 'list'>(numbering ? 'count' : 'list')
  const [until, setUntil] = useState('')
  const [prefix, setPrefix] = useState(numbering?.prefix ?? '')
  const [text, setText] = useState('')
  const last = numbering?.last ?? titles.length
  const untilNum = Number(until)
  const extra = Number.isInteger(untilNum) && untilNum > last && untilNum - last <= 1000 ? untilNum - last : 0
  if (mode === 'count') {
    const name = prefix.trim() || 'Ítem'
    return (
      <div className="space-y-4">
        <ModeSwitch mode={mode} setMode={setMode} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Se llaman">
            <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Room" />
          </Field>
          <Field label="Agregar hasta el N°">
            <input inputMode="numeric" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} placeholder={String(last + 10)} autoFocus />
          </Field>
        </div>
        <p className="text-sm text-ink-soft dark:text-neutral-400">
          {extra
            ? `Se agregan ${name} ${last + 1} a ${name} ${untilNum} (${extra}).`
            : `El último es el ${last}. Poné hasta qué número querés llegar.`}
        </p>
        <Button variant="primary" className="w-full" disabled={!extra} onClick={() => void addItems(planId, numberedItems(prefix, extra, last + 1)).then(onDone)}>
          Agregar {extra || ''} {extra === 1 ? 'ítem' : 'ítems'}
        </Button>
      </div>
    )
  }
  const count = text.split(/\r?\n/).filter((l) => l.trim()).length
  return (
    <div className="space-y-3">
      <ModeSwitch mode={mode} setMode={setMode} />
      <textarea
        className={cx(inputCls, 'min-h-48 font-mono text-sm')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Un ítem por línea. Opcional: "Módulo: ítem"\nBlue Team: Intro to SOC\nSIEM: Splunk Basics'}
        autoFocus
      />
      <Button variant="primary" className="w-full" disabled={!count} onClick={() => void addItems(planId, text).then(onDone)}>
        Agregar {count || ''} {count === 1 ? 'ítem' : 'ítems'}
      </Button>
    </div>
  )
}

function ModeSwitch({ mode, setMode }: { mode: 'count' | 'list'; setMode: (m: 'count' | 'list') => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1 dark:bg-neutral-900">
      {(
        [
          ['count', 'Numerados'],
          ['list', 'Pegar la lista'],
        ] as const
      ).map(([v, label]) => (
        <button
          type="button"
          key={v}
          aria-pressed={mode === v}
          onClick={() => setMode(v)}
          className={cx('min-h-10 rounded-lg text-sm', mode === v ? 'bg-white font-medium shadow-sm dark:bg-neutral-700' : 'text-ink-soft dark:text-neutral-400')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Milestones({ planId, today }: { planId: string; today: ISODate }) {
  const milestones = useMilestones(planId)
  const [editing, setEditing] = useState<Partial<Milestone> | null>(null)
  return (
    <Card>
      <SectionTitle right={<Button onClick={() => setEditing({ planId, from: today, to: today })}>+ Etapa</Button>}>
        Etapas
      </SectionTitle>
      {!milestones?.length ? (
        <Empty>Sin etapas.</Empty>
      ) : (
        <ul className="divide-y divide-line dark:divide-neutral-700">
          {milestones.map((m) => {
            const current = compareISO(m.from, today) <= 0 && compareISO(today, m.to) <= 0
            return (
              <li key={m.id} className="flex items-start gap-3 py-2">
                <Check checked={m.done} label={m.title} onChange={(v) => void saveMilestone({ ...m, done: v })} />
                <button className="flex-1 text-left" onClick={() => setEditing(m)}>
                  <span className={cx('block', m.done && 'text-ink-soft line-through')}>
                    {m.title} {current && !m.done && <span className="ml-1 rounded bg-progress/30 px-1.5 text-xs">ahora</span>}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {m.from === m.to ? formatAR(m.from) : `${formatAR(m.from)} → ${formatAR(m.to)}`}
                  </span>
                  {m.description && <span className="block text-xs text-ink-soft">{m.description}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar etapa' : 'Nueva etapa'}>
        {editing && <MilestoneForm m={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Card>
  )
}

function MilestoneForm({ m, onDone }: { m: Partial<Milestone>; onDone: () => void }) {
  const [title, setTitle] = useState(m.title ?? '')
  const [from, setFrom] = useState(m.from ?? '')
  const [to, setTo] = useState(m.to ?? '')
  const [description, setDesc] = useState(m.description ?? '')
  const valid = title.trim() && from && to && to >= from
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        void saveMilestone({ ...m, planId: m.planId!, title: title.trim(), from, to, description: description.trim() || undefined }).then(onDone)
      }}
    >
      <Field label="Nombre">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Desde">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field label="Descripción">
        <textarea className={cx(inputCls, 'min-h-20')} value={description} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={!valid}>
          Guardar
        </Button>
        {m.id && (
          <Button type="button" variant="danger" onClick={() => void deleteMilestone(m.id!).then(onDone)}>
            Borrar
          </Button>
        )}
      </div>
    </form>
  )
}
