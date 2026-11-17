import { useState } from 'react'
import { formatAR, parseAR, todayISO, type ISODate } from '../../domain/dates'
import { numberedItems, parseItemList, suggestedDeadline } from '../../domain/plans'
import { formatAmount } from '../../domain/progress'
import type { PlanInput } from '../../data/repo'
import type { Plan, PlanKind } from '../../data/types'
import { Button, cx, Field, inputCls, MoreOptions } from '../components'
import { longDay, WEEKDAY_NAMES } from '../format'

const REST_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Ninguno', days: [] },
  { label: 'Domingo', days: [0] },
  { label: 'Sáb y dom', days: [6, 0] },
]

const parseNum = (s: string) => Number(s.replace(',', '.'))

/** Small segmented control. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-paper p-1 dark:bg-neutral-900" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, label]) => (
        <button
          type="button"
          key={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx('min-h-10 rounded-lg text-sm', value === v ? 'bg-white font-medium shadow-sm dark:bg-neutral-700' : 'text-ink-soft dark:text-neutral-400')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Create / edit a plan. The essentials go first (what, how many, how fast); the end date is
 * computed from them. Start date, rest days, a fixed deadline, unit and linked habit live in
 * "Más opciones".
 * `total` (edit mode): current number of items or target, to suggest a new end date.
 */
export function PlanForm({
  plan,
  total: currentTotal,
  onSubmit,
  submitLabel,
}: {
  plan?: Plan
  total?: number
  onSubmit: (v: PlanInput) => void | Promise<void>
  submitLabel: string
}) {
  const editing = !!plan
  const [name, setName] = useState(plan?.name ?? '')
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? 'items')
  const [unit, setUnit] = useState(plan?.unit ?? '')
  const [target, setTarget] = useState(plan?.target ? String(plan.target).replace('.', ',') : '')
  // Items: a count ("34", named "Room" → Room 1…34) or a pasted list.
  const [itemsMode, setItemsMode] = useState<'count' | 'list'>('count')
  const [count, setCount] = useState('')
  const [prefix, setPrefix] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [pace, setPace] = useState(String(plan?.pace ?? 1).replace('.', ','))
  const [startDate, setStart] = useState(plan?.startDate ?? todayISO())
  const [rest, setRest] = useState<number[]>(plan?.restWeekdays ?? [])
  const [blocked, setBlocked] = useState((plan?.blockedDates ?? []).map((d) => formatAR(d)).join(', '))
  // New plans: the end date is automatic unless the user sets one. Edits keep the saved one.
  const [customDeadline, setCustomDeadline] = useState(editing)
  const [deadline, setDeadline] = useState(plan?.deadline ?? '')
  const [withHabit, setWithHabit] = useState(!plan)

  const isAmount = kind === 'amount'
  const paceNum = parseNum(pace)
  const targetNum = parseNum(target)
  const countNum = Number(count)
  const year = Number(startDate.slice(0, 4)) || new Date().getFullYear()
  const blockedParsed = blocked
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((s) => parseAR(s, year))
  const blockedValid = blockedParsed.every(Boolean)
  const blockedDates = [...new Set(blockedParsed.filter(Boolean) as ISODate[])].sort()
  const listCount = parseItemList(itemsText).length

  // How much there is to do: target (amount), items to create (new) or existing ones (edit).
  const total = isAmount ? targetNum : editing ? (currentTotal ?? 0) : itemsMode === 'count' ? countNum : listCount
  const autoEnd = startDate && paceNum > 0 && blockedValid ? suggestedDeadline(total, { startDate, pace: paceNum, restWeekdays: rest, blockedDates }) : null
  const finalDeadline = customDeadline ? deadline : (autoEnd ?? '')
  const unitLabel = unit.trim() || (isAmount ? 'unidades' : 'ítems')

  const valid =
    !!name.trim() &&
    !!startDate &&
    !!finalDeadline &&
    finalDeadline >= startDate &&
    paceNum > 0 &&
    blockedValid &&
    rest.length < 7 &&
    (!isAmount || (targetNum > 0 && !!unit.trim())) &&
    (isAmount || editing || itemsMode === 'list' || (Number.isInteger(countNum) && countNum > 0 && countNum <= 1000))

  const toggleDay = (d: number) => setRest((r) => (r.includes(d) ? r.filter((x) => x !== d) : [...r, d]))

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        void onSubmit({
          name: name.trim(),
          kind,
          unit: unit.trim() || undefined,
          target: isAmount ? targetNum : undefined,
          startDate,
          deadline: finalDeadline,
          pace: paceNum,
          restWeekdays: [...rest].sort(),
          blockedDates,
          withHabit,
          itemsText: isAmount || editing ? '' : itemsMode === 'count' ? numberedItems(prefix, countNum) : itemsText,
        })
      }}
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['items', '📋 Por ítems', 'Rooms, lecciones, capítulos'],
              ['amount', '⏱️ Por cantidad', 'Horas, páginas, ejercicios'],
            ] as const
          ).map(([k, label, hint]) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cx(
                'rounded-xl p-3 text-left',
                kind === k ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
              )}
            >
              <span className="block font-medium">{label}</span>
              <span className="block text-xs opacity-80">{hint}</span>
            </button>
          ))}
        </div>
      )}

      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={isAmount ? 'Inglés B2' : 'SOC Level 1'} />
      </Field>

      {isAmount ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total a completar">
            <input inputMode="decimal" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="60" />
          </Field>
          <Field label="Unidad">
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="horas" />
          </Field>
        </div>
      ) : (
        !editing && (
          <div className="space-y-3">
            <Segmented
              value={itemsMode}
              onChange={setItemsMode}
              options={[
                ['count', 'Cuántos son'],
                ['list', 'Pegar la lista'],
              ]}
            />
            {itemsMode === 'count' ? (
              <div className="grid grid-cols-[6rem_1fr] gap-3">
                <Field label="¿Cuántos?">
                  <input inputMode="numeric" className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} placeholder="34" />
                </Field>
                <Field label="Se llaman (opcional)" hint={`Quedan: ${numberedItems(prefix, Math.min(2, countNum || 2)).replace('\n', ', ')}…`}>
                  <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Room" />
                </Field>
              </div>
            ) : (
              <Field label={`Uno por línea, opcional "Módulo: ítem"${listCount ? ` · ${listCount}` : ''}`}>
                <textarea
                  className={cx(inputCls, 'min-h-32 font-mono text-sm')}
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  placeholder={'Intro: Room 1\nIntro: Room 2\nSIEM: Splunk Basics'}
                />
              </Field>
            )}
          </div>
        )
      )}

      <Field label={`Ritmo: ${unitLabel} por día`} hint={isAmount ? 'Puede tener decimales: 1,5 por día.' : 'Puede ser 0,5: uno cada dos días.'}>
        <input inputMode="decimal" className={inputCls} value={pace} onChange={(e) => setPace(e.target.value)} />
      </Field>

      <div className="rounded-xl bg-progress/15 p-3 text-sm dark:bg-progress/10" aria-live="polite">
        {customDeadline ? (
          <>
            <span className="block">📅 Fecha límite: {deadline ? <strong>{formatAR(deadline)}</strong> : 'elegila en Más opciones'}</span>
            {autoEnd && (
              <span className="mt-1 block text-ink-soft dark:text-neutral-400">
                A este ritmo terminarías el {formatAR(autoEnd)}.{' '}
                <button type="button" className="underline" onClick={() => setCustomDeadline(false)}>
                  Usar esa fecha
                </button>
              </span>
            )}
          </>
        ) : autoEnd ? (
          <>
            <span className="block">
              📅 Terminás el <strong className="first-letter:uppercase">{longDay(autoEnd)}</strong>
            </span>
            <span className="block text-ink-soft dark:text-neutral-400">
              {formatAmount(total)} {unitLabel} a {formatAmount(paceNum)} por día, desde {startDate === todayISO() ? 'hoy' : formatAR(startDate)}
              {rest.length ? ', sin contar los días de descanso' : ''}.
            </span>
          </>
        ) : (
          <span className="text-ink-soft dark:text-neutral-400">📅 Completá {isAmount ? 'el total' : 'cuántos son'} y el ritmo, y te calculo la fecha de fin.</span>
        )}
      </div>

      <MoreOptions hint="Inicio, días de descanso, fecha límite propia…">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fecha límite">
            <input
              type="date"
              className={inputCls}
              value={finalDeadline}
              onChange={(e) => {
                setDeadline(e.target.value)
                setCustomDeadline(true)
              }}
            />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">Días de descanso</span>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {REST_PRESETS.map((p) => (
              <Button key={p.label} type="button" className="text-sm" onClick={() => setRest(p.days)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleDay(d)}
                className={cx(
                  'h-10 rounded-lg text-sm',
                  rest.includes(d) ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-white dark:bg-neutral-700',
                )}
                aria-pressed={rest.includes(d)}
                aria-label={`Descanso ${WEEKDAY_NAMES[d]}`}
              >
                {WEEKDAY_NAMES[d].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Días libres puntuales" hint={blockedValid ? 'Separados por coma: 24/12, 25/12, 31/12' : '⚠️ Hay una fecha que no entiendo (usá dd/mm o dd/mm/aaaa).'}>
          <input className={inputCls} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="24/12, 25/12, 31/12" />
        </Field>
        {!isAmount && (
          <Field label="Unidad (opcional)" hint='Se usa en los textos: "5/34 rooms".'>
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="rooms" />
          </Field>
        )}
        {!editing && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 shrink-0 accent-progress" checked={withHabit} onChange={(e) => setWithHabit(e.target.checked)} />
            <span className="text-sm">
              Crear el hábito "Estudiar {name || '…'}" (se marca solo cuando {isAmount ? 'registrás avance' : 'hacés un ítem'})
            </span>
          </label>
        )}
      </MoreOptions>

      <Button type="submit" variant="primary" className="w-full" disabled={!valid}>
        {submitLabel}
      </Button>
    </form>
  )
}
