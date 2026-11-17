/** Optional weight & calorie tracking ("Salud"). Turned on in Ajustes. */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalorieBars, WeightChart } from '../../charts/HealthCharts'
import { addDays, formatAR, type ISODate } from '../../domain/dates'
import { calorieSummary, dayCalories, formatKcal, formatKg, weightSeries, weightSummary } from '../../domain/health'
import { addFood, deleteFood, saveWeight, updateSettings } from '../../data/repo'
import type { Meal } from '../../data/types'
import { Button, Card, cx, Empty, Field, inputCls, ProgressBar, SectionTitle, Sheet } from '../components'
import { useBodyWeights, useFoodEntries, useSettings, useToday } from '../hooks'

const MEALS: { value: Meal; label: string; icon: string }[] = [
  { value: 'desayuno', label: 'Desayuno', icon: '☕' },
  { value: 'almuerzo', label: 'Almuerzo', icon: '🍽️' },
  { value: 'merienda', label: 'Merienda', icon: '🧉' },
  { value: 'cena', label: 'Cena', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍎' },
]

/** Meal that fits the current hour (only a default; the user can change it). */
function mealForNow(h = new Date().getHours()): Meal {
  if (h < 11) return 'desayuno'
  if (h < 15) return 'almuerzo'
  if (h < 19) return 'merienda'
  return 'cena'
}

const parseNum = (s: string) => Number(s.replace(',', '.'))

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-paper p-3 dark:bg-neutral-900">
      <dt className="text-xs text-ink-soft dark:text-neutral-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-ink-soft dark:text-neutral-400">{sub}</dd>}
    </div>
  )
}

/** "Te quedan 650 kcal" / "Te pasaste 120 kcal". */
function remainingLine(eaten: number, target: number | undefined): string | null {
  if (!target) return null
  const left = target - eaten
  return left >= 0 ? `Te quedan ${formatKcal(left)} kcal` : `Te pasaste ${formatKcal(-left)} kcal`
}

function FoodForm({ today, compact }: { today: ISODate; compact?: boolean }) {
  const [kcal, setKcal] = useState('')
  const [label, setLabel] = useState('')
  const [meal, setMeal] = useState<Meal>(mealForNow())
  const n = parseNum(kcal)
  const valid = n > 0 && n < 10000
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        void addFood({ date: today, kcal: n, label: label.trim() || undefined, meal }).then(() => {
          setKcal('')
          setLabel('')
        })
      }}
    >
      {!compact && (
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Qué comiste (opcional)" aria-label="Qué comiste" />
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input inputMode="numeric" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" aria-label="Calorías" />
        <Button type="submit" variant="primary" disabled={!valid}>
          Sumar kcal
        </Button>
      </div>
      {!compact && (
        <div className="grid grid-cols-5 gap-1">
          {MEALS.map((m) => (
            <button
              type="button"
              key={m.value}
              aria-pressed={meal === m.value}
              onClick={() => setMeal(m.value)}
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
      )}
    </form>
  )
}

function WeightForm({ today, current }: { today: ISODate; current?: number }) {
  const [kg, setKg] = useState(current ? String(current).replace('.', ',') : '')
  const n = parseNum(kg)
  const valid = n > 20 && n < 400
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) void saveWeight(today, n)
      }}
    >
      <input inputMode="decimal" className={cx(inputCls, 'flex-1')} value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Peso de hoy (kg)" aria-label="Peso de hoy en kg" />
      <Button type="submit" variant="primary" disabled={!valid}>
        {current ? 'Actualizar' : 'Guardar'}
      </Button>
    </form>
  )
}

function GoalsForm({ onDone }: { onDone: () => void }) {
  const s = useSettings()
  const [kcal, setKcal] = useState(s.calorieTarget ? String(s.calorieTarget) : '')
  const [goal, setGoal] = useState(s.weightGoal ? String(s.weightGoal).replace('.', ',') : '')
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const k = parseNum(kcal)
        const g = parseNum(goal)
        void updateSettings({ calorieTarget: k > 0 ? Math.round(k) : undefined, weightGoal: g > 0 ? Math.round(g * 10) / 10 : undefined }).then(onDone)
      }}
    >
      <Field label="Calorías por día (objetivo)" hint="Dejalo vacío si no querés un objetivo.">
        <input inputMode="numeric" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="2000" />
      </Field>
      <Field label="Peso meta (kg)" hint="Con al menos una semana de pesajes te estimo cuándo llegás.">
        <input inputMode="decimal" className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="75" />
      </Field>
      <Button type="submit" variant="primary" className="w-full">
        Guardar
      </Button>
    </form>
  )
}

export function HealthScreen() {
  const today = useToday()
  const settings = useSettings()
  const weights = useBodyWeights()
  const from30 = addDays(today, -29)
  const food = useFoodEntries(from30, today)
  const [goals, setGoals] = useState(false)

  const todays = (food ?? []).filter((f) => f.date === today).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const eaten = dayCalories(food ?? [], today)
  const target = settings.calorieTarget
  const cal = useMemo(() => calorieSummary(food ?? [], from30, today, target, today), [food, from30, today, target])
  const ws = useMemo(() => weightSummary(weights ?? [], settings.weightGoal, today), [weights, settings.weightGoal, today])
  const series = useMemo(
    () => weightSeries((weights ?? []).filter((w) => w.date >= addDays(today, -89))).map((p) => ({ ...p, label: formatAR(p.date, false) })),
    [weights, today],
  )
  const todayWeight = (weights ?? []).find((w) => w.date === today)

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-semibold">Salud</h1>
        <Button onClick={() => setGoals(true)}>Objetivos</Button>
      </header>

      <Card>
        <SectionTitle right={<span className="text-sm font-semibold">{formatKcal(eaten)}{target ? ` / ${formatKcal(target)}` : ''} kcal</span>}>
          Calorías de hoy
        </SectionTitle>
        {target ? <ProgressBar value={eaten / target} color={eaten > target ? 'bg-mood' : 'bg-progress'} /> : null}
        {remainingLine(eaten, target) && <p className="mt-2 text-sm">{remainingLine(eaten, target)}</p>}
        <div className="mt-3">
          <FoodForm today={today} />
        </div>
        {todays.length > 0 && (
          <ul className="mt-3 divide-y divide-line dark:divide-neutral-700">
            {todays.map((f) => {
              const m = MEALS.find((x) => x.value === f.meal)
              return (
                <li key={f.id} className="flex items-center gap-2 py-2">
                  <span className="text-lg">{m?.icon ?? '🍴'}</span>
                  <span className="min-w-0 flex-1 truncate">{f.label ?? m?.label ?? 'Comida'}</span>
                  <span className="font-medium">{formatKcal(f.kcal)} kcal</span>
                  <button className="px-2 text-ink-soft" aria-label={`Borrar ${f.label ?? 'comida'}`} onClick={() => void deleteFood(f.id)}>
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Peso</SectionTitle>
        <WeightForm key={todayWeight?.kg ?? 'none'} today={today} current={todayWeight?.kg} />
        {!ws.latest ? (
          <Empty>Cargá tu primer pesaje. Conviene pesarse a la misma hora, por ejemplo al levantarte.</Empty>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Tendencia (7 días)" value={ws.trend !== null ? `${formatKg(ws.trend)} kg` : '—'} sub={`Último: ${formatKg(ws.latest.kg)} kg (${formatAR(ws.latest.date, false)})`} />
              <Stat
                label="Ritmo"
                value={ws.ratePerWeek === null ? 'Faltan datos' : `${ws.ratePerWeek > 0 ? '+' : ''}${formatKg(ws.ratePerWeek)} kg/sem`}
                sub={ws.ratePerWeek === null ? 'Necesito 3 pesajes en una semana o más' : 'Últimas 4 semanas'}
              />
              <Stat
                label="Cambio total"
                value={ws.totalChange !== null ? `${ws.totalChange > 0 ? '+' : ''}${formatKg(ws.totalChange)} kg` : '—'}
                sub={ws.first ? `Desde ${formatAR(ws.first.date)}` : undefined}
              />
              <Stat
                label="Meta"
                value={ws.goal === null ? 'Sin meta' : ws.reached ? '🎉 Llegaste' : `${formatKg(Math.abs(ws.toGoal ?? 0))} kg`}
                sub={ws.goal === null ? 'Ponela en Objetivos' : ws.reached ? `${formatKg(ws.goal)} kg` : ws.eta ? `Al ritmo actual: ${formatAR(ws.eta)}` : `Meta ${formatKg(ws.goal)} kg`}
              />
            </dl>
            {series.length >= 2 && (
              <div className="mt-4">
                <WeightChart data={series} goal={ws.goal} />
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Calorías · últimos 30 días</SectionTitle>
        {cal.loggedDays === 0 ? (
          <Empty>Todavía no hay comidas cargadas.</Empty>
        ) : (
          <>
            <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Promedio diario" value={`${formatKcal(cal.average ?? 0)} kcal`} sub={`${cal.loggedDays} ${cal.loggedDays === 1 ? 'día' : 'días'} con registro`} />
              <Stat label="Dentro del objetivo" value={target ? `${cal.daysOnTarget}/${cal.loggedDays} días` : '—'} sub={target ? `≤ ${formatKcal(target)} kcal` : 'Sin objetivo'} />
            </dl>
            <CalorieBars data={cal.days.map((d) => ({ label: formatAR(d.date, false), kcal: d.kcal }))} target={target} />
          </>
        )}
      </Card>

      <Sheet open={goals} onClose={() => setGoals(false)} title="Objetivos">
        {goals && <GoalsForm onDone={() => setGoals(false)} />}
      </Sheet>
    </div>
  )
}

/** Small card for "Hoy" when health tracking is on. */
export function HealthTodayCard({ today }: { today: ISODate }) {
  const settings = useSettings()
  const food = useFoodEntries(today, today)
  const weights = useBodyWeights()
  const eaten = dayCalories(food ?? [], today)
  const target = settings.calorieTarget
  const todayWeight = (weights ?? []).find((w) => w.date === today)
  return (
    <Card>
      <SectionTitle
        right={
          <Link to="/salud" className="text-sm underline">
            Ver salud
          </Link>
        }
      >
        Salud
      </SectionTitle>
      <div className="mb-2 flex justify-between text-sm">
        <span>
          🍽️ {formatKcal(eaten)}
          {target ? ` / ${formatKcal(target)}` : ''} kcal
        </span>
        <span>⚖️ {todayWeight ? `${formatKg(todayWeight.kg)} kg` : 'Sin pesaje hoy'}</span>
      </div>
      {target ? <ProgressBar value={eaten / target} color={eaten > target ? 'bg-mood' : 'bg-progress'} /> : null}
      <div className="mt-3">
        <FoodForm today={today} compact />
      </div>
    </Card>
  )
}
