/**
 * Meals typed as text ("200 g arroz, 2 huevos") → kcal from the food dictionary, plus
 * "Mis alimentos" (custom foods). Used by the Salud screen and the card in Hoy.
 * The parsing and the math live in `src/domain/foodLog.ts`.
 */
import { useMemo, useState } from 'react'
import { addDays, type ISODate } from '../../domain/dates'
import { amountLabel, analyzeFoodText, buildFoodIndex, formatQty, type FoodIndex, type FoodLine } from '../../domain/foodLog'
import { formatKcal, frequentMeals } from '../../domain/health'
import { addFood, deleteCustomFood, deleteFood, repeatFood, saveCustomFood, updateFood } from '../../data/repo'
import type { CustomFood, FoodEntry, FoodItem, Meal } from '../../data/types'
import { Button, Card, cx, Empty, Field, inputCls, SectionTitle, Sheet } from '../components'
import { useCustomFoods, useFoodEntries } from '../hooks'
import { t, tn } from '../i18n'

const MEALS: { value: Meal; label: string; icon: string }[] = [
  { value: 'desayuno', label: t('Desayuno'), icon: '☕' },
  { value: 'almuerzo', label: t('Almuerzo'), icon: '🍽️' },
  { value: 'merienda', label: t('Merienda'), icon: '🧉' },
  { value: 'cena', label: t('Cena'), icon: '🌙' },
  { value: 'snack', label: t('Snack'), icon: '🍎' },
]

/** Meal that fits the current hour (only a default; the user can change it). */
function mealForNow(h = new Date().getHours()): Meal {
  if (h < 11) return 'desayuno'
  if (h < 15) return 'almuerzo'
  if (h < 19) return 'merienda'
  return 'cena'
}

const parseNum = (s: string) => Number(s.replace(',', '.'))
const hintCls = 'text-xs text-ink-soft dark:text-neutral-400'

/** Dictionary + the user's foods, rebuilt when "Mis alimentos" changes. */
function useFoodIndex(): FoodIndex {
  const custom = useCustomFoods()
  return useMemo(() => buildFoodIndex(custom ?? []), [custom])
}

function MealPicker({ meal, onChange }: { meal: Meal; onChange: (m: Meal) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {MEALS.map((m) => (
        <button
          type="button"
          key={m.value}
          aria-pressed={meal === m.value}
          onClick={() => onChange(m.value)}
          className={cx(
            'min-h-10 rounded-lg text-[11px]',
            meal === m.value ? 'bg-ink text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-paper dark:bg-neutral-700',
          )}
        >
          <span className="block text-base leading-none">{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  )
}

function FormatHelp() {
  return (
    <details className={cx(hintCls, 'mt-1')}>
      <summary className="cursor-pointer underline">{t('¿Cómo lo escribo?')}</summary>
      <div className="mt-2 space-y-1">
        <p>{t('Cada alimento es cantidad + unidad + alimento. Separalos con coma, con «y» o uno por línea. Funciona con el dictado del teclado.')}</p>
        <p>
          <b>{t('Cantidad:')}</b> {t('2 · 1,5 · 1/2 · un, una, medio, media, dos… diez. Si no ponés cantidad, cuenta 1.')}
        </p>
        <p>
          <b>{t('Unidades:')}</b> {t('g, kg, ml, cc, l · taza, vaso, cda (cucharada), cdta (cucharadita), feta, rebanada, porción, plato. Sin unidad cuenta unidades: «2 huevos».')}
        </p>
        <p>
          <b>{t('Ejemplos:')}</b> 200 g arroz · 2 huevos · 1 taza de leche · 1/2 palta · 3 fetas de jamón · 1 milanesa · 150 ml jugo de naranja · 1 cda de aceite.
        </p>
        <p>{t('Valores aproximados: arroz, fideos y legumbres cuentan cocidos salvo que digas «crudo».')}</p>
      </div>
    </details>
  )
}

/** "200 g arroz → Arroz blanco (cocido) · 200 g · 260 kcal" */
function LineRow({
  line,
  manual,
  onManual,
  onTeach,
}: {
  line: FoodLine
  manual: string
  onManual: (v: string) => void
  onTeach: () => void
}) {
  if (line.status === 'ok') {
    const guess = line.confidence < 0.9
    return (
      <li className="flex items-baseline gap-2 py-1.5 text-sm">
        <span aria-hidden>{guess ? '≈' : '✓'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{line.raw}</span>
          <span className={cx(hintCls, 'block')}>
            {guess && t('Parecido a:') + ' '}
            {line.food.name}
            {line.food.custom && ' ' + t('(mío)')}
            {amountLabel(line) && ` · ${amountLabel(line)}`}
          </span>
        </span>
        <span className="font-medium whitespace-nowrap">{formatKcal(line.kcal)} kcal</span>
      </li>
    )
  }
  return (
    <li className="py-1.5 text-sm">
      <div className="flex items-baseline gap-2">
        <span aria-hidden>⚠️</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{line.raw}</span>
          <span className="block text-xs text-amber-700 dark:text-amber-300">{line.message}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-6">
        <input
          inputMode="numeric"
          className={cx(inputCls, 'w-24 py-1')}
          value={manual}
          onChange={(e) => onManual(e.target.value)}
          placeholder="kcal"
          aria-label={t('kcal de {name}', { name: line.raw })}
        />
        {line.reason !== 'no-food' && line.reason !== 'bad-quantity' && (
          <button type="button" className="text-xs underline" onClick={onTeach}>
            {t('Guardar en Mis alimentos')}
          </button>
        )}
      </div>
    </li>
  )
}

/** Main food form in Salud: text with live preview, or plain kcal. With `entry`, edits that meal. */
export function MealForm({ today, entry, onDone }: { today: ISODate; entry?: FoodEntry; onDone?: () => void }) {
  const index = useFoodIndex()
  const typed = !!entry?.items?.length
  const [mode, setMode] = useState<'text' | 'kcal'>(entry && !typed ? 'kcal' : 'text')
  const [text, setText] = useState(typed ? (entry?.label ?? '') : '')
  // Lines typed with their kcal by hand come back as manual values.
  const [manual, setManual] = useState<Record<string, string>>(() =>
    Object.fromEntries((entry?.items ?? []).filter((i) => !i.foodId).map((i) => [i.text, String(i.kcal)])),
  )
  const [kcal, setKcal] = useState(entry && !typed ? String(entry.kcal) : '')
  const [label, setLabel] = useState(entry && !typed ? (entry.label ?? '') : '')
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? mealForNow())
  /** New meal → add it; editing → replace the entry. */
  const save = (data: { kcal: number; label?: string; items?: FoodItem[] }) =>
    entry ? updateFood(entry.id, { ...data, meal }).then(() => onDone?.()) : addFood({ date: today, meal, ...data }).then(() => onDone?.())
  const [teach, setTeach] = useState<string | null>(null)

  const analysis = useMemo(() => analyzeFoodText(text, index), [text, index])
  const manualKcal = (l: FoodLine) => {
    const n = parseNum(manual[l.raw] ?? '')
    return n >= 0 && n < 10000 && (manual[l.raw] ?? '').trim() !== '' ? n : null
  }
  const missing = analysis.lines.filter((l) => l.status === 'unresolved' && manualKcal(l) === null).length
  const total = analysis.lines.reduce((s, l) => s + (l.status === 'ok' ? l.kcal : (manualKcal(l) ?? 0)), 0)
  const textValid = analysis.lines.length > 0 && missing === 0 && total < 20000

  const n = parseNum(kcal)
  const kcalValid = n > 0 && n < 10000

  const saveText = () => {
    if (!textValid) return
    const items: FoodItem[] = analysis.lines.map((l) =>
      l.status === 'ok' ? { text: l.raw, foodId: l.food.id, grams: l.amount, kcal: l.kcal } : { text: l.raw, kcal: manualKcal(l) ?? 0 },
    )
    void save({ kcal: total, label: text.trim(), items }).then(() => {
      setText('')
      setManual({})
    })
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1 text-sm dark:bg-neutral-900" role="group" aria-label={t('Cómo cargar')}>
        {(
          [
            ['text', t('Escribir comida')],
            ['kcal', t('Solo kcal')],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mode === v}
            onClick={() => setMode(v)}
            className={cx('min-h-9 rounded-lg', mode === v && 'bg-white font-medium shadow-sm dark:bg-neutral-700')}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveText()
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('¿Qué comiste?')}</span>
            <textarea
              className={cx(inputCls, 'min-h-20')}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'200 g arroz, 2 huevos\n1 taza de leche'}
            />
          </label>
          <p className={hintCls}>{t('Cantidad, unidad y alimento; separá con coma, «y» o una línea por alimento.')}</p>
          <FormatHelp />

          {analysis.lines.length > 0 && (
            <div className="rounded-xl bg-paper p-3 dark:bg-neutral-900">
              <ul aria-label={t('Vista previa')} className="divide-y divide-line dark:divide-neutral-700">
                {analysis.lines.map((l, i) => (
                  <LineRow
                    key={`${i}|${l.raw}`}
                    line={l}
                    manual={manual[l.raw] ?? ''}
                    onManual={(v) => setManual((m) => ({ ...m, [l.raw]: v }))}
                    onTeach={() => setTeach(l.foodQuery)}
                  />
                ))}
              </ul>
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 dark:border-neutral-700">
                <span className={hintCls}>{t('Valores aproximados')}</span>
                <span className="font-semibold">{t('Total: {n} kcal', { n: formatKcal(total) })}</span>
              </div>
              {missing > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {tn(missing, 'Falta resolver 1 línea: poné sus kcal o guardala en Mis alimentos.', 'Faltan resolver {n} líneas: poné sus kcal o guardalas en Mis alimentos.')}
                </p>
              )}
            </div>
          )}

          <MealPicker meal={meal} onChange={setMeal} />
          <Button type="submit" variant="primary" className="w-full" disabled={!textValid}>
            {entry ? t('Guardar cambios') : analysis.lines.length ? t('Sumar {n} kcal', { n: formatKcal(total) }) : t('Sumar')}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!kcalValid) return
            void save({ kcal: n, label: label.trim() || undefined }).then(() => {
              setKcal('')
              setLabel('')
            })
          }}
        >
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('Qué comiste (opcional)')} aria-label={t('Qué comiste')} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input inputMode="numeric" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" aria-label={t('Calorías')} />
            <Button type="submit" variant="primary" disabled={!kcalValid}>
              {entry ? t('Guardar') : t('Sumar kcal')}
            </Button>
          </div>
          <MealPicker meal={meal} onChange={setMeal} />
        </form>
      )}

      <Sheet open={teach !== null} onClose={() => setTeach(null)} title={t('Nuevo alimento')}>
        {teach !== null && <CustomFoodForm initialName={suggestName(teach)} onDone={() => setTeach(null)} />}
      </Sheet>
    </div>
  )
}

/** "guiso de la abuela" → "Guiso de la abuela". */
function suggestName(query: string): string {
  return query.charAt(0).toUpperCase() + query.slice(1)
}

/** Create or edit a custom food. */
export function CustomFoodForm({ food, initialName = '', onDone }: { food?: CustomFood; initialName?: string; onDone: () => void }) {
  const [name, setName] = useState(food?.name ?? initialName)
  const [per, setPer] = useState<'100g' | 'unit'>(!food || food.kcalPerUnit !== undefined ? 'unit' : '100g')
  const [kcal, setKcal] = useState(String(food?.kcalPerUnit ?? food?.kcal100 ?? ''))
  const [grams, setGrams] = useState(food?.unitGrams ? String(food.unitGrams) : '')
  const k = parseNum(kcal)
  const g = parseNum(grams)
  const valid = name.trim().length > 0 && kcal.trim() !== '' && k >= 0 && k < 10000 && (grams.trim() === '' || g > 0)
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        void saveCustomFood({
          id: food?.id,
          name,
          kcal100: per === '100g' ? k : undefined,
          kcalPerUnit: per === 'unit' ? k : undefined,
          unitGrams: grams.trim() ? g : undefined,
        }).then(onDone)
      }}
    >
      <Field label={t('Nombre')} hint={t('Así lo vas a escribir. Plurales y tildes se reconocen solos.')}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Guiso de la abuela')} />
      </Field>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-paper p-1 text-sm dark:bg-neutral-900" role="group" aria-label={t('Calorías por')}>
        {(
          [
            ['unit', t('Por unidad / porción')],
            ['100g', t('Por 100 g')],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={per === v}
            onClick={() => setPer(v)}
            className={cx('min-h-9 rounded-lg', per === v && 'bg-white font-medium shadow-sm dark:bg-neutral-700')}
          >
            {l}
          </button>
        ))}
      </div>
      <Field label={per === 'unit' ? t('kcal de una unidad') : t('kcal cada 100 g')}>
        <input inputMode="numeric" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder={per === 'unit' ? '450' : '250'} />
      </Field>
      <Field
        label={t('Peso de una unidad en g (opcional)')}
        hint={per === 'unit' ? t('Si lo ponés, también podés escribirlo en gramos.') : t('Si lo ponés, también podés escribir «2 …» en unidades.')}
      >
        <input inputMode="decimal" className={inputCls} value={grams} onChange={(e) => setGrams(e.target.value)} placeholder={t('opcional')} />
      </Field>
      <Button type="submit" variant="primary" className="w-full" disabled={!valid}>
        {t('Guardar alimento')}
      </Button>
    </form>
  )
}

function describeCustom(f: CustomFood): string {
  const unit = f.unitGrams ? ` (${formatQty(f.unitGrams)} g)` : ''
  if (f.kcalPerUnit !== undefined) return t('{n} kcal por unidad', { n: formatKcal(f.kcalPerUnit) }) + unit
  return t('{n} kcal cada 100 g', { n: formatKcal(f.kcal100 ?? 0) }) + (f.unitGrams ? ' · ' + t('unidad de {n} g', { n: formatQty(f.unitGrams) }) : '')
}

/** "Mis alimentos": list to edit or delete custom foods. */
export function MyFoodsCard() {
  const foods = useCustomFoods()
  const [editing, setEditing] = useState<CustomFood | 'new' | null>(null)
  return (
    <Card>
      <SectionTitle right={<Button onClick={() => setEditing('new')}>{t('+ Agregar')}</Button>}>{t('Mis alimentos')}</SectionTitle>
      {!foods?.length ? (
        <Empty>{t('Cuando escribas algo que no conozco, guardalo acá y la próxima vez lo reconozco. Tus alimentos tienen prioridad sobre el diccionario.')}</Empty>
      ) : (
        <ul className="divide-y divide-line dark:divide-neutral-700">
          {foods.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(f)}>
                <span className="block truncate">{f.name}</span>
                <span className={hintCls}>{describeCustom(f)}</span>
              </button>
              <button className="px-2 text-ink-soft dark:text-neutral-400" aria-label={t('Borrar {name}', { name: f.name })} onClick={() => void deleteCustomFood(f.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('Nuevo alimento') : t('Editar alimento')}>
        {editing !== null && <CustomFoodForm key={editing === 'new' ? 'new' : editing.id} food={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Card>
  )
}

/** Today's entries; the ones typed as text expand to show their breakdown. Each one can be edited. */
export function FoodEntryList({ entries }: { entries: FoodEntry[] }) {
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  if (!entries.length) return null
  return (
    <>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={t('Editar comida')}>
        {editing && <MealForm key={editing.id} today={editing.date} entry={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <ul className="mt-3 divide-y divide-line dark:divide-neutral-700">
        {entries.map((f) => {
          const m = MEALS.find((x) => x.value === f.meal)
          const title = f.label ?? m?.label ?? t('Comida')
          const head = (
            <>
              <span className="text-lg">{m?.icon ?? '🍴'}</span>
              <span className="min-w-0 flex-1 truncate">{title}</span>
              <span className="font-medium whitespace-nowrap">{formatKcal(f.kcal)} kcal</span>
            </>
          )
          return (
            <li key={f.id} className="flex items-start gap-1 py-2">
              {f.items?.length ? (
                <details className="min-w-0 flex-1">
                  <summary className="flex cursor-pointer list-none items-center gap-2">{head}</summary>
                  <ul className="mt-1 space-y-0.5 pl-8 text-sm" aria-label={t('Detalle de {name}', { name: title })}>
                    {f.items.map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="min-w-0 flex-1 truncate">{it.text}</span>
                        {it.grams !== undefined && <span className={hintCls}>{formatQty(it.grams)} g</span>}
                        <span className="whitespace-nowrap">{formatKcal(it.kcal)} kcal</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">{head}</div>
              )}
              <button className="px-2 text-ink-soft dark:text-neutral-400" aria-label={t('Editar {name}', { name: title })} onClick={() => setEditing(f)}>
                ✎
              </button>
              <button className="px-2 text-ink-soft dark:text-neutral-400" aria-label={t('Borrar {name}', { name: title })} onClick={() => void deleteFood(f.id)}>
                ✕
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** "Repetir": the meals of the last 30 days you eat most, to log again with one tap. */
export function RepeatMeals({ today, limit = 6 }: { today: ISODate; limit?: number }) {
  const recent = useFoodEntries(addDays(today, -29), today)
  const [added, setAdded] = useState<string | null>(null)
  const meals = useMemo(() => frequentMeals(recent ?? [], today, limit), [recent, today, limit])
  if (!meals.length) return null
  return (
    <div className="mt-3">
      <p className={cx(hintCls, 'mb-1')}>{t('Repetir una comida')}</p>
      <ul className="flex flex-wrap gap-2">
        {meals.map((m) => {
          const icon = MEALS.find((x) => x.value === m.meal)?.icon ?? '🍴'
          const name = m.label ?? MEALS.find((x) => x.value === m.meal)?.label ?? t('Comida')
          return (
            <li key={m.id} className="max-w-full">
              <button
                type="button"
                className="flex max-w-full items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-sm dark:bg-neutral-700"
                aria-label={t('Sumar otra vez {name} ({n} kcal)', { name, n: formatKcal(m.kcal) })}
                onClick={() =>
                  void repeatFood(m, today).then(() => {
                    setAdded(m.id)
                    setTimeout(() => setAdded((a) => (a === m.id ? null : a)), 2000)
                  })
                }
              >
                <span aria-hidden>{added === m.id ? '✓' : icon}</span>
                <span className="truncate">{name}</span>
                <span className={cx(hintCls, 'shrink-0 whitespace-nowrap')}>· {formatKcal(m.kcal)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Compact quick add for "Hoy": plain kcal ("350") or the same text format ("2 huevos, 1 tostada"). */
export function QuickFoodForm({ today }: { today: ISODate }) {
  const index = useFoodIndex()
  const [value, setValue] = useState('')
  const plain = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kcal|cal)?$/i)
  const isPlain = plain !== null
  const analysis = useMemo(() => (isPlain ? null : analyzeFoodText(value, index)), [isPlain, value, index])
  const kcal = plain ? parseNum(plain[1]) : (analysis?.total ?? 0)
  const unresolved = analysis?.lines.filter((l) => l.status === 'unresolved') ?? []
  const valid = plain ? kcal > 0 && kcal < 10000 : !!analysis?.lines.length && unresolved.length === 0
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const items: FoodItem[] | undefined = analysis?.lines.flatMap((l) =>
          l.status === 'ok' ? [{ text: l.raw, foodId: l.food.id, grams: l.amount, kcal: l.kcal }] : [],
        )
        void addFood({ date: today, kcal, label: plain ? undefined : value.trim(), meal: mealForNow(), items }).then(() => setValue(''))
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('2 huevos, 1 tostada · o 350')} aria-label={t('Comida o kcal')} />
        <Button type="submit" variant="primary" disabled={!valid} aria-label={t('Sumar comida')}>
          {t('Sumar')}
        </Button>
      </div>
      {analysis && analysis.lines.length > 0 && (
        <p className={hintCls}>
          {unresolved.length
            ? t('⚠️ No reconozco «{name}». Cargalo en Salud.', { name: unresolved[0].raw })
            : `≈ ${formatKcal(kcal)} kcal · ${analysis.lines.map((l) => (l.status === 'ok' ? l.food.name : l.raw)).join(', ')}`}
        </p>
      )}
    </form>
  )
}
