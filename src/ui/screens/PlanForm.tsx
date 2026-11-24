import { useState } from 'react'
import { parseAR, todayISO, type ISODate } from '../../domain/dates'
import { numberedItems, parseItemList, suggestedDeadline } from '../../domain/plans'
import { formatAmount } from '../../domain/progress'
import type { PlanInput } from '../../data/repo'
import type { Plan, PlanKind } from '../../data/types'
import { Button, cx, Field, inputCls, MoreOptions } from '../components'
import { WEEKDAY_NAMES, fmtDate, longDay } from '../format'
import { fmtDecimal } from '../../domain/numberFormat'
import { t } from '../i18n'

const REST_PRESETS: { label: string; days: number[] }[] = [
  { label: t('Ninguno'), days: [] },
  { label: t('Domingo'), days: [0] },
  { label: t('Sáb y dom'), days: [6, 0] },
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
  const [target, setTarget] = useState(plan?.target ? fmtDecimal(plan.target) : '')
  // Items: a count ("34", named "Room" → Room 1…34) or a pasted list.
  const [itemsMode, setItemsMode] = useState<'count' | 'list'>('count')
  const [count, setCount] = useState('')
  // "Ya hiciste hasta el": the first N items were done before the plan; the schedule starts at N + 1.
  const [doneUntil, setDoneUntil] = useState('')
  const [prefix, setPrefix] = useState('')
  const [itemsText, setItemsText] = useState('')
  const [pace, setPace] = useState(fmtDecimal(plan?.pace ?? 1))
  const [startDate, setStart] = useState(plan?.startDate ?? todayISO())
  const [rest, setRest] = useState<number[]>(plan?.restWeekdays ?? [])
  const [blocked, setBlocked] = useState((plan?.blockedDates ?? []).map((d) => fmtDate(d)).join(', '))
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
  const itemsTotal = itemsMode === 'count' ? countNum : listCount
  const priorNum = doneUntil.trim() ? Number(doneUntil) : 0
  const priorValid = Number.isInteger(priorNum) && priorNum >= 0 && (priorNum < itemsTotal || itemsTotal === 0)

  // How much there is to do: target (amount), items to create (new) or existing ones (edit).
  // What's left to schedule: target (amount), items minus those already done (new) or the plan's remaining ones (edit).
  const total = isAmount ? targetNum : editing ? (currentTotal ?? 0) : itemsTotal - (priorValid ? priorNum : 0)
  const autoEnd = startDate && paceNum > 0 && blockedValid ? suggestedDeadline(total, { startDate, pace: paceNum, restWeekdays: rest, blockedDates }) : null
  const finalDeadline = customDeadline ? deadline : (autoEnd ?? '')
  const unitLabel = unit.trim() || (isAmount ? t('unidades') : t('ítems'))

  const valid =
    !!name.trim() &&
    !!startDate &&
    !!finalDeadline &&
    finalDeadline >= startDate &&
    paceNum > 0 &&
    blockedValid &&
    rest.length < 7 &&
    (!isAmount || (targetNum > 0 && !!unit.trim())) &&
    (isAmount || editing || ((itemsMode === 'list' || (Number.isInteger(countNum) && countNum > 0 && countNum <= 1000)) && priorValid))

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
          habitName: t('Estudiar {name}', { name: name.trim() }),
          itemsText: isAmount || editing ? '' : itemsMode === 'count' ? numberedItems(prefix || t('Ítem'), countNum) : itemsText,
          priorCount: isAmount || editing ? 0 : priorNum,
        })
      }}
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['items', t('📋 Por ítems'), t('Rooms, lecciones, capítulos')],
              ['amount', t('⏱️ Por cantidad'), t('Horas, páginas, ejercicios')],
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

      <Field label={t('Nombre')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={isAmount ? t('Inglés B2') : 'SOC Level 1'} />
      </Field>

      {isAmount ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Total a completar')}>
            <input inputMode="decimal" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="60" />
          </Field>
          <Field label={t('Unidad')}>
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('horas')} />
          </Field>
        </div>
      ) : (
        !editing && (
          <div className="space-y-3">
            <Segmented
              value={itemsMode}
              onChange={setItemsMode}
              options={[
                ['count', t('Cuántos son')],
                ['list', t('Pegar la lista')],
              ]}
            />
            {itemsMode === 'count' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('¿Cuántos en total?')}>
                    <input inputMode="numeric" className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} placeholder="62" />
                  </Field>
                  <Field label={t('Ya hiciste hasta el (opcional)')}>
                    <input inputMode="numeric" className={inputCls} value={doneUntil} onChange={(e) => setDoneUntil(e.target.value)} placeholder="0" />
                  </Field>
                </div>
                <Field label={t('Se llaman (opcional)')} hint={t('Quedan: {list}…', { list: numberedItems(prefix || t('Ítem'), 2).replace('\n', ', ') })}>
                  <input className={inputCls} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Room" />
                </Field>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label={t('Uno por línea, opcional "Módulo: ítem"') + (listCount ? ` · ${listCount}` : '')}>
                  <textarea
                    className={cx(inputCls, 'min-h-32 font-mono text-sm')}
                    value={itemsText}
                    onChange={(e) => setItemsText(e.target.value)}
                    placeholder={'Intro: Room 1\nIntro: Room 2\nSIEM: Splunk Basics'}
                  />
                </Field>
                <Field label={t('Ya hiciste los primeros (opcional)')}>
                  <input inputMode="numeric" className={inputCls} value={doneUntil} onChange={(e) => setDoneUntil(e.target.value)} placeholder="0" />
                </Field>
              </div>
            )}
            {priorNum > 0 && itemsTotal > 0 && (
              <p className={cx('text-sm', priorValid ? 'text-ink-soft dark:text-neutral-400' : 'text-amber-700 dark:text-amber-400')}>
                {priorValid
                  ? t('Del 1 al {n} quedan como hechos antes del plan. El plan arranca en el {next} y reparte los {left} que faltan.', {
                      n: priorNum,
                      next: priorNum + 1,
                      left: itemsTotal - priorNum,
                    })
                  : t('⚠️ Tiene que ser menor que el total ({n}).', { n: itemsTotal })}
              </p>
            )}
          </div>
        )
      )}

      <Field label={t('Ritmo: {unit} por día', { unit: unitLabel })} hint={isAmount ? t('Puede tener decimales: 1,5 por día.') : t('Puede ser 0,5: uno cada dos días.')}>
        <input inputMode="decimal" className={inputCls} value={pace} onChange={(e) => setPace(e.target.value)} />
      </Field>

      <div className="rounded-xl bg-progress/15 p-3 text-sm dark:bg-progress/10" aria-live="polite">
        {customDeadline ? (
          <>
            <span className="block">
              {t('📅 Fecha límite:')} {deadline ? <strong>{fmtDate(deadline)}</strong> : t('elegila en Más opciones')}
            </span>
            {autoEnd && (
              <span className="mt-1 block text-ink-soft dark:text-neutral-400">
                {t('A este ritmo terminarías el {date}.', { date: fmtDate(autoEnd) })}{' '}
                <button type="button" className="underline" onClick={() => setCustomDeadline(false)}>
                  {t('Usar esa fecha')}
                </button>
              </span>
            )}
          </>
        ) : autoEnd ? (
          <>
            <span className="block">
              {t('📅 Terminás el')} <strong className="first-letter:uppercase">{longDay(autoEnd)}</strong>
            </span>
            <span className="block text-ink-soft dark:text-neutral-400">
              {t('{total} {unit} a {pace} por día, desde {from}', {
                total: formatAmount(total),
                unit: unitLabel,
                pace: formatAmount(paceNum),
                from: startDate === todayISO() ? t('hoy') : fmtDate(startDate),
              })}
              {rest.length ? t(', sin contar los días de descanso') : ''}.
            </span>
          </>
        ) : (
          <span className="text-ink-soft dark:text-neutral-400">
            {isAmount ? t('📅 Completá el total y el ritmo, y te calculo la fecha de fin.') : t('📅 Completá cuántos son y el ritmo, y te calculo la fecha de fin.')}
          </span>
        )}
      </div>

      <MoreOptions hint={t('Inicio, días de descanso, fecha límite propia…')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Inicio')}>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t('Fecha límite')}>
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
          <span className="mb-1 block text-sm text-ink-soft dark:text-neutral-400">{t('Días de descanso')}</span>
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
                aria-label={t('Descanso {day}', { day: WEEKDAY_NAMES[d] })}
              >
                {WEEKDAY_NAMES[d].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
        <Field
          label={t('Días libres puntuales')}
          hint={blockedValid ? t('Separados por coma: 24/12, 25/12, 31/12') : t('⚠️ Hay una fecha que no entiendo (usá dd/mm o dd/mm/aaaa).')}
        >
          <input className={inputCls} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="24/12, 25/12, 31/12" />
        </Field>
        {!isAmount && (
          <Field label={t('Unidad (opcional)')} hint={t('Se usa en los textos: "5/34 rooms".')}>
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="rooms" />
          </Field>
        )}
        {!editing && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 shrink-0 accent-progress" checked={withHabit} onChange={(e) => setWithHabit(e.target.checked)} />
            <span className="text-sm">
              {isAmount
                ? t('Crear el hábito "Estudiar {name}" (se marca solo cuando registrás avance)', { name: name || '…' })
                : t('Crear el hábito "Estudiar {name}" (se marca solo cuando hacés un ítem)', { name: name || '…' })}
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
