/** Optional weight & calorie tracking ("Salud"). Turned on in Ajustes. */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalorieBars, WeightChart } from '../../charts/HealthCharts'
import { addDays, type ISODate } from '../../domain/dates'
import { calorieSummary, dayCalories, formatKcal, formatKg, weightSeries, weightSummary } from '../../domain/health'
import { saveWeight, updateSettings } from '../../data/repo'
import { Button, Card, cx, Empty, Field, inputCls, ProgressBar, SectionTitle, Sheet } from '../components'
import { useBodyWeights, useFoodEntries, useSettings, useToday } from '../hooks'
import { FoodEntryList, MealForm, MyFoodsCard, QuickFoodForm } from './FoodLog'
import { fmtDate } from '../format'
import { fmtDecimal } from '../../domain/numberFormat'
import { t, tn } from '../i18n'

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
  return left >= 0 ? t('Te quedan {n} kcal', { n: formatKcal(left) }) : t('Te pasaste {n} kcal', { n: formatKcal(-left) })
}

function WeightForm({ today, current }: { today: ISODate; current?: number }) {
  const [kg, setKg] = useState(current ? fmtDecimal(current) : '')
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
      <input inputMode="decimal" className={cx(inputCls, 'flex-1')} value={kg} onChange={(e) => setKg(e.target.value)} placeholder={t('Peso de hoy (kg)')} aria-label={t('Peso de hoy en kg')} />
      <Button type="submit" variant="primary" disabled={!valid}>
        {current ? t('Actualizar') : t('Guardar')}
      </Button>
    </form>
  )
}

function GoalsForm({ onDone }: { onDone: () => void }) {
  const s = useSettings()
  const [kcal, setKcal] = useState(s.calorieTarget ? String(s.calorieTarget) : '')
  const [goal, setGoal] = useState(s.weightGoal ? fmtDecimal(s.weightGoal) : '')
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
      <Field label={t('Calorías por día (objetivo)')} hint={t('Dejalo vacío si no querés un objetivo.')}>
        <input inputMode="numeric" className={inputCls} value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="2000" />
      </Field>
      <Field label={t('Peso meta (kg)')} hint={t('Con al menos una semana de pesajes te estimo cuándo llegás.')}>
        <input inputMode="decimal" className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="75" />
      </Field>
      <Button type="submit" variant="primary" className="w-full">
        {t('Guardar')}
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
    () => weightSeries((weights ?? []).filter((w) => w.date >= addDays(today, -89))).map((p) => ({ ...p, label: fmtDate(p.date, false) })),
    [weights, today],
  )
  const todayWeight = (weights ?? []).find((w) => w.date === today)

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-semibold">{t('Salud')}</h1>
        <Button onClick={() => setGoals(true)}>{t('Objetivos')}</Button>
      </header>

      <Card>
        <SectionTitle right={<span className="text-sm font-semibold">{formatKcal(eaten)}{target ? ` / ${formatKcal(target)}` : ''} kcal</span>}>
          {t('Calorías de hoy')}
        </SectionTitle>
        {target ? <ProgressBar value={eaten / target} color={eaten > target ? 'bg-mood' : 'bg-progress'} /> : null}
        {remainingLine(eaten, target) && <p className="mt-2 text-sm">{remainingLine(eaten, target)}</p>}
        <div className="mt-3">
          <MealForm today={today} />
        </div>
        <FoodEntryList entries={todays} />
      </Card>

      <Card>
        <SectionTitle>{t('Peso')}</SectionTitle>
        <WeightForm key={todayWeight?.kg ?? 'none'} today={today} current={todayWeight?.kg} />
        {!ws.latest ? (
          <Empty>{t('Cargá tu primer pesaje. Conviene pesarse a la misma hora, por ejemplo al levantarte.')}</Empty>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat
                label={t('Tendencia (7 días)')}
                value={ws.trend !== null ? `${formatKg(ws.trend)} kg` : '—'}
                sub={t('Último: {kg} kg ({date})', { kg: formatKg(ws.latest.kg), date: fmtDate(ws.latest.date, false) })}
              />
              <Stat
                label={t('Ritmo')}
                value={ws.ratePerWeek === null ? t('Faltan datos') : t('{n} kg/sem', { n: `${ws.ratePerWeek > 0 ? '+' : ''}${formatKg(ws.ratePerWeek)}` })}
                sub={ws.ratePerWeek === null ? t('Necesito 3 pesajes en una semana o más') : t('Últimas 4 semanas')}
              />
              <Stat
                label={t('Cambio total')}
                value={ws.totalChange !== null ? `${ws.totalChange > 0 ? '+' : ''}${formatKg(ws.totalChange)} kg` : '—'}
                sub={ws.first ? t('Desde {date}', { date: fmtDate(ws.first.date) }) : undefined}
              />
              <Stat
                label={t('Meta')}
                value={ws.goal === null ? t('Sin meta') : ws.reached ? t('🎉 Llegaste') : `${formatKg(Math.abs(ws.toGoal ?? 0))} kg`}
                sub={
                  ws.goal === null
                    ? t('Ponela en Objetivos')
                    : ws.reached
                      ? `${formatKg(ws.goal)} kg`
                      : ws.eta
                        ? t('Al ritmo actual: {date}', { date: fmtDate(ws.eta) })
                        : t('Meta {n} kg', { n: formatKg(ws.goal) })
                }
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

      <MyFoodsCard />

      <Card>
        <SectionTitle>{t('Calorías · últimos 30 días')}</SectionTitle>
        {cal.loggedDays === 0 ? (
          <Empty>{t('Todavía no hay comidas cargadas.')}</Empty>
        ) : (
          <>
            <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label={t('Promedio diario')} value={`${formatKcal(cal.average ?? 0)} kcal`} sub={tn(cal.loggedDays, '1 día con registro', '{n} días con registro')} />
              <Stat
                label={t('Dentro del objetivo')}
                value={target ? t('{a}/{b} días', { a: cal.daysOnTarget, b: cal.loggedDays }) : '—'}
                sub={target ? `≤ ${formatKcal(target)} kcal` : t('Sin objetivo')}
              />
            </dl>
            <CalorieBars data={cal.days.map((d) => ({ label: fmtDate(d.date, false), kcal: d.kcal }))} target={target} />
          </>
        )}
      </Card>

      <Sheet open={goals} onClose={() => setGoals(false)} title={t('Objetivos')}>
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
            {t('Ver salud')}
          </Link>
        }
      >
        {t('Salud')}
      </SectionTitle>
      <div className="mb-2 flex justify-between text-sm">
        <span>
          🍽️ {formatKcal(eaten)}
          {target ? ` / ${formatKcal(target)}` : ''} kcal
        </span>
        <span>⚖️ {todayWeight ? `${formatKg(todayWeight.kg)} kg` : t('Sin pesaje hoy')}</span>
      </div>
      {target ? <ProgressBar value={eaten / target} color={eaten > target ? 'bg-mood' : 'bg-progress'} /> : null}
      <div className="mt-3">
        <QuickFoodForm today={today} />
      </div>
    </Card>
  )
}
