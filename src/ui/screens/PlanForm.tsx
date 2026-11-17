import { useState } from 'react'
import { formatAR, parseAR, todayISO } from '../../domain/dates'
import { parseItemList } from '../../domain/plans'
import type { PlanInput } from '../../data/repo'
import type { Plan, PlanKind } from '../../data/types'
import { Button, cx, Field, inputCls } from '../components'
import { WEEKDAY_NAMES } from '../format'

const REST_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Ninguno', days: [] },
  { label: 'Domingo', days: [0] },
  { label: 'Sáb y dom', days: [6, 0] },
]

export function PlanForm({
  plan,
  onSubmit,
  submitLabel,
}: {
  plan?: Plan
  onSubmit: (v: PlanInput) => void | Promise<void>
  submitLabel: string
}) {
  const [name, setName] = useState(plan?.name ?? '')
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? 'items')
  const [unit, setUnit] = useState(plan?.unit ?? '')
  const [target, setTarget] = useState(plan?.target ? String(plan.target).replace('.', ',') : '')
  const [startDate, setStart] = useState(plan?.startDate ?? todayISO())
  const [deadline, setDeadline] = useState(plan?.deadline ?? '')
  const [pace, setPace] = useState(String(plan?.pace ?? 1).replace('.', ','))
  const [rest, setRest] = useState<number[]>(plan?.restWeekdays ?? [])
  const [blocked, setBlocked] = useState((plan?.blockedDates ?? []).map((d) => formatAR(d)).join(', '))
  const [withHabit, setWithHabit] = useState(!plan)
  const [itemsText, setItemsText] = useState('')

  const paceNum = Number(pace.replace(',', '.'))
  const targetNum = Number(target.replace(',', '.'))
  const isAmount = kind === 'amount'
  const unitLabel = unit.trim() || (isAmount ? 'unidades' : 'ítems')
  const year = Number(startDate.slice(0, 4)) || new Date().getFullYear()
  const blockedParsed = blocked
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((s) => parseAR(s, year))
  const blockedValid = blockedParsed.every(Boolean)
  const valid =
    name.trim() &&
    startDate &&
    deadline &&
    deadline >= startDate &&
    paceNum > 0 &&
    blockedValid &&
    rest.length < 7 &&
    (!isAmount || (targetNum > 0 && unit.trim()))
  const itemCount = parseItemList(itemsText).length

  const toggleDay = (d: number) => setRest((r) => (r.includes(d) ? r.filter((x) => x !== d) : [...r, d]))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        void onSubmit({
          name: name.trim(),
          kind,
          unit: unit.trim() || undefined,
          target: isAmount ? targetNum : undefined,
          startDate,
          deadline,
          pace: paceNum,
          restWeekdays: [...rest].sort(),
          blockedDates: [...new Set(blockedParsed as string[])].sort(),
          withHabit,
          itemsText: isAmount ? '' : itemsText,
        })
      }}
    >
      {!plan && (
        <div>
          <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">¿Cómo medís el avance?</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['items', '📋 Por ítems', 'Una lista: rooms, lecciones, capítulos'],
                ['amount', '⏱️ Por cantidad', 'Un total: horas, páginas, ejercicios'],
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
        </div>
      )}
      <Field label="Nombre">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isAmount ? 'Inglés B2' : 'SOC Level 1'}
        />
      </Field>
      <div className={cx('grid gap-2', isAmount && 'grid-cols-2')}>
        {isAmount && (
          <Field label="Total a completar">
            <input inputMode="decimal" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="60" />
          </Field>
        )}
        <Field label={isAmount ? 'Unidad' : 'Unidad (opcional)'}>
          <input
            className={inputCls}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={isAmount ? 'horas' : 'rooms'}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Inicio">
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Fecha límite">
          <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      <Field
        label={`Ritmo (${unitLabel} por día)`}
        hint={isAmount ? 'Puede tener decimales: 1,5 = una hora y media por día disponible.' : 'Puede ser fraccionario: 0,5 = uno cada dos días disponibles.'}
      >
        <input inputMode="decimal" className={inputCls} value={pace} onChange={(e) => setPace(e.target.value)} />
      </Field>
      <div>
        <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">Días de descanso</span>
        <div className="mb-2 flex gap-2">
          {REST_PRESETS.map((p) => (
            <Button key={p.label} type="button" className="flex-1 text-sm" onClick={() => setRest(p.days)}>
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
                rest.includes(d) ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
              )}
              aria-pressed={rest.includes(d)}
            >
              {WEEKDAY_NAMES[d].slice(0, 2)}
            </button>
          ))}
        </div>
      </div>
      <Field label="Días libres puntuales" hint={blockedValid ? 'Separados por coma: 24/12, 25/12, 31/12' : '⚠️ Hay una fecha que no entiendo (usá dd/mm o dd/mm/aaaa).'}>
        <input className={inputCls} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="24/12, 25/12, 31/12" />
      </Field>
      {!plan && (
        <>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-progress" checked={withHabit} onChange={(e) => setWithHabit(e.target.checked)} />
            <span>
              Crear el hábito "Estudiar {name || '…'}" (se marca solo cuando {isAmount ? 'registrás avance' : 'hacés un ítem'})
            </span>
          </label>
          {!isAmount && (
          <Field label={`Ítems (uno por línea, opcional "Módulo: ítem")${itemCount ? ` · ${itemCount}` : ''}`}>
            <textarea
              className={cx(inputCls, 'min-h-32 font-mono text-sm')}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={'Intro: Room 1\nIntro: Room 2\nSIEM: Splunk Basics'}
            />
          </Field>
          )}
        </>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={!valid}>
        {submitLabel}
      </Button>
    </form>
  )
}
