/**
 * Sample data for demo mode, relative to today so it always looks current:
 * six weeks of habits of every type, a course started halfway (SOC, room 21 of 62), an hours
 * plan, mood, today's tasks, weight and meals. Only ever written to the demo database.
 */
import { addDays, todayISO, weekday, type ISODate } from '../domain/dates'
import { analyzeFoodText } from '../domain/foodLog'
import { db } from './db'
import {
  addFood,
  addItems,
  addTasksFromText,
  createPlan,
  saveHabit,
  saveMilestone,
  saveWeight,
  setHabitAmount,
  setHabitDone,
  setItemDone,
  setMood,
  setPlanLog,
  updateSettings,
} from './repo'
import type { FoodItem, Meal } from './types'

/** Deterministic pseudo-random numbers, so the demo looks the same on every device. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const MEALS: { meal: Meal; options: string[] }[] = [
  { meal: 'desayuno', options: ['1 taza de leche, 2 tostadas y 1 cda de dulce de leche', '1 yogur con 30 g de avena y 1 banana', '2 huevos y 1 tostada'] },
  { meal: 'almuerzo', options: ['200 g arroz, 150 g pollo y 1 tomate', '1 milanesa con 200 g de puré', '250 g fideos con 1 cda de aceite', '2 empanadas de carne y 1 manzana'] },
  { meal: 'merienda', options: ['2 medialunas', '1 alfajor', '1 banana y 1 yogur'] },
  { meal: 'cena', options: ['150 g carne y 1 plato de ensalada', '2 porciones de pizza', '1 tarta de verdura', '200 g pollo y 200 g papa'] },
]

function foodEntry(text: string): { kcal: number; items: FoodItem[] } {
  const a = analyzeFoodText(text)
  const items: FoodItem[] = a.lines.map((l) =>
    l.status === 'ok' ? { text: l.raw, foodId: l.food.id, grams: l.amount, kcal: l.kcal } : { text: l.raw, kcal: 0 },
  )
  return { kcal: Math.round(a.total), items }
}

/** Fills the (demo) database once. Returns false if it already has data. */
export async function loadDemoData(today: ISODate = todayISO()): Promise<boolean> {
  if ((await db.habits.count()) > 0) return false
  const r = rng(20261124)
  const chance = (p: number) => r() < p
  const start = addDays(today, -41) // six weeks of history
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i)) // start … today

  await updateSettings({ healthEnabled: true, calorieTarget: 2100, weightGoal: 76 })

  // ── Habits of every type ──
  const cama = await saveHabit({ name: 'Hacer la cama', emoji: '🛏️', startDate: start, kind: 'fixed', timeOfDay: 'morning' })
  const perro = await saveHabit({ name: 'Pasear al perro', emoji: '🐕', startDate: start, kind: 'fixed', timeOfDay: 'afternoon' })
  const pantallas = await saveHabit({ name: 'Sin pantallas antes de dormir', emoji: '📵', startDate: start, kind: 'fixed', timeOfDay: 'night' })
  const natacion = await saveHabit({ name: 'Natación', emoji: '🏊', startDate: start, kind: 'scheduled', weekdays: [1, 3], timeOfDay: 'morning' })
  const gym = await saveHabit({ name: 'Gimnasio', emoji: '🏋️', startDate: start, kind: 'progress', goal: { type: 'times', target: 3 } })
  const leer = await saveHabit({ name: 'Leer', emoji: '📖', startDate: start, kind: 'progress', goal: { type: 'amount', period: 'day', target: 20, unit: 'páginas' } })

  for (const [i, d] of days.entries()) {
    const isToday = d === today
    const trend = i / days.length // a bit better every week
    if (chance(0.8 + 0.15 * trend)) await setHabitDone(cama.id, d, true)
    if (!isToday && chance(0.7 + 0.2 * trend)) await setHabitDone(perro.id, d, true)
    if (!isToday && chance(0.45 + 0.3 * trend)) await setHabitDone(pantallas.id, d, true)
    if ([1, 3].includes(weekday(d)) && chance(0.8)) await setHabitDone(natacion.id, d, true)
    if ([2, 4, 6].includes(weekday(d)) && !isToday && chance(0.8)) await setHabitDone(gym.id, d, true)
    if (!isToday) await setHabitAmount(leer.id, d, chance(0.75) ? 20 + Math.round(r() * 15) : Math.round(r() * 15))
    if (!isToday || chance(0.5)) await setMood(d, { mood: 5 + Math.round(r() * 3 + trend * 2), motivation: 4 + Math.round(r() * 4 + trend * 2) })
  }

  // ── A course started halfway: 62 rooms, already at 21 ──
  const socStart = addDays(today, -20)
  const soc = await createPlan({
    name: 'SOC Level 1 · TryHackMe',
    kind: 'items',
    unit: 'rooms',
    startDate: socStart,
    deadline: addDays(socStart, 50),
    pace: 1,
    restWeekdays: [0],
    blockedDates: [],
    withHabit: true,
  })
  await addItems(soc.id, Array.from({ length: 62 }, (_, i) => `Room ${i + 1}`).join('\n'), 20)
  const rooms = (await db.planItems.where('planId').equals(soc.id).toArray()).sort((a, b) => a.order - b.order)
  let next = 20
  for (const d of days.filter((x) => x >= socStart && x < today)) {
    if (weekday(d) === 0) continue
    const n = chance(0.15) ? 0 : chance(0.25) ? 2 : 1 // some days skipped, some days doubled
    for (let k = 0; k < n && next < rooms.length; k++) await setItemDone(rooms[next++].id, true, d)
  }
  await saveMilestone({ planId: soc.id, title: 'Terminar el path', from: socStart, to: addDays(socStart, 50), description: 'Una room por día, domingos libres' })
  await saveMilestone({ planId: soc.id, title: 'Examen SAL1', from: addDays(socStart, 60), to: addDays(socStart, 61), description: 'Ventana de 24 h' })

  // ── An hours plan: English B2, 60 h at 1,5 h per day ──
  const engStart = addDays(today, -24)
  const eng = await createPlan({
    name: 'Inglés B2',
    kind: 'amount',
    unit: 'horas',
    target: 60,
    startDate: engStart,
    deadline: addDays(engStart, 52),
    pace: 1.5,
    restWeekdays: [6, 0],
    blockedDates: [],
    withHabit: false,
  })
  for (const d of days.filter((x) => x >= engStart && x < today)) {
    if ([6, 0].includes(weekday(d))) continue
    if (chance(0.9)) await setPlanLog(eng.id, d, [1.5, 2, 2, 2.5][Math.floor(r() * 4)])
  }

  // ── Today's tasks (as if dictated) ──
  await addTasksFromText(today, 'dentista a las 15 horas, comprar yerba, después llamar a Juan, pagar la luz')

  // ── Weight: ~0,5 kg/week down with daily noise; weigh-ins most days ──
  for (const [i, d] of days.entries()) {
    if (chance(0.25) && d !== today) continue
    const kg = 81.4 - i * 0.07 + (r() - 0.5) * 0.9
    await saveWeight(d, Math.round(kg * 10) / 10)
  }

  // ── Meals of the last three weeks, typed as text ──
  for (const d of days.slice(-21)) {
    for (const { meal, options } of MEALS) {
      if (d === today && (meal === 'merienda' || meal === 'cena')) continue
      if (meal === 'merienda' && chance(0.4)) continue
      const text = options[Math.floor(r() * options.length)]
      const { kcal, items } = foodEntry(text)
      if (kcal > 0) await addFood({ date: d, kcal, label: text, meal, items })
    }
  }
  return true
}
