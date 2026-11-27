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
  pauseHabit,
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

/** Meals as [text the parser reads (Spanish), label shown in English]. */
const MEALS: { meal: Meal; options: [string, string][] }[] = [
  {
    meal: 'desayuno',
    options: [
      ['1 taza de leche, 2 tostadas y 1 cda de dulce de leche', 'Milk, 2 toasts and dulce de leche'],
      ['1 yogur con 30 g de avena y 1 banana', 'Yogurt with oats and a banana'],
      ['2 huevos y 1 tostada', '2 eggs and a toast'],
    ],
  },
  {
    meal: 'almuerzo',
    options: [
      ['200 g arroz, 150 g pollo y 1 tomate', 'Rice, chicken and a tomato'],
      ['1 milanesa con 200 g de puré', 'Milanesa with mashed potatoes'],
      ['250 g fideos con 1 cda de aceite', 'Pasta with olive oil'],
      ['2 empanadas de carne y 1 manzana', '2 beef empanadas and an apple'],
    ],
  },
  { meal: 'merienda', options: [['2 medialunas', '2 croissants'], ['1 alfajor', 'An alfajor'], ['1 banana y 1 yogur', 'A banana and a yogurt']] },
  {
    meal: 'cena',
    options: [
      ['150 g carne y 1 plato de ensalada', 'Steak and a salad'],
      ['2 porciones de pizza', '2 slices of pizza'],
      ['1 tarta de verdura', 'Vegetable pie'],
      ['200 g pollo y 200 g papa', 'Chicken and potatoes'],
    ],
  },
]

/** Visible names in the demo, per language. */
const TEXT = {
  es: {
    cama: 'Hacer la cama', perro: 'Pasear al perro', pantallas: 'Sin pantallas antes de dormir', natacion: 'Natación', gym: 'Gimnasio', leer: 'Leer', paginas: 'páginas',
    milestone1: 'Terminar el path', milestone1d: 'Una room por día, domingos libres', milestone2: 'Examen SAL1', milestone2d: 'Ventana de 24 h',
    eng: 'Inglés B2', horas: 'horas', tasks: 'dentista a las 15 horas, comprar yerba, después llamar a Juan, pagar la luz',
    yesterday: 'devolver los libros a la biblioteca', upcoming: 'Mañana: renovar el pasaporte. El viernes que viene cena con Ana a las 21',
  },
  en: {
    cama: 'Make the bed', perro: 'Walk the dog', pantallas: 'No screens before bed', natacion: 'Swimming', gym: 'Gym', leer: 'Read', paginas: 'pages',
    milestone1: 'Finish the path', milestone1d: 'One room a day, Sundays off', milestone2: 'SAL1 exam', milestone2d: '24-hour window',
    eng: 'Spanish B2', horas: 'hours', tasks: 'dentist a las 15 horas, buy coffee, después call John, pay the electricity bill',
    yesterday: 'return the library books', upcoming: 'Mañana: renew the passport. El viernes que viene dinner with Ana a las 21',
  },
}

function foodEntry(text: string): { kcal: number; items: FoodItem[] } {
  const a = analyzeFoodText(text)
  const items: FoodItem[] = a.lines.map((l) =>
    l.status === 'ok' ? { text: l.raw, foodId: l.food.id, grams: l.amount, kcal: l.kcal } : { text: l.raw, kcal: 0 },
  )
  return { kcal: Math.round(a.total), items }
}

/** Fills the (demo) database once. Returns false if it already has data. */
export async function loadDemoData(today: ISODate = todayISO(), lang: 'es' | 'en' = 'es'): Promise<boolean> {
  if ((await db.habits.count()) > 0) return false
  // One transaction: much faster than hundreds of separate writes, and the UI goes from empty
  // to complete in one step instead of showing half-loaded data.
  await db.transaction('rw', db.tables, () => fill(today, lang))
  return true
}

async function fill(today: ISODate, lang: 'es' | 'en') {
  const T = TEXT[lang]
  const r = rng(20261124)
  const chance = (p: number) => r() < p
  const start = addDays(today, -41) // six weeks of history
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i)) // start … today

  await updateSettings({ healthEnabled: true, calorieTarget: 2100, weightGoal: 76 })

  // ── Habits of every type ──
  const cama = await saveHabit({ name: T.cama, emoji: '🛏️', startDate: start, kind: 'fixed', timeOfDay: 'morning' })
  const perro = await saveHabit({ name: T.perro, emoji: '🐕', startDate: start, kind: 'fixed', timeOfDay: 'afternoon' })
  const pantallas = await saveHabit({ name: T.pantallas, emoji: '📵', startDate: start, kind: 'fixed', timeOfDay: 'night' })
  const natacion = await saveHabit({ name: T.natacion, emoji: '🏊', startDate: start, kind: 'scheduled', weekdays: [1, 3], timeOfDay: 'morning' })
  const gym = await saveHabit({ name: T.gym, emoji: '🏋️', startDate: start, kind: 'progress', goal: { type: 'times', target: 3 } })
  const leer = await saveHabit({ name: T.leer, emoji: '📖', startDate: start, kind: 'progress', goal: { type: 'amount', period: 'day', target: 20, unit: T.paginas } })

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
    habitName: lang === 'en' ? 'Study SOC Level 1' : undefined,
  })
  await addItems(soc.id, Array.from({ length: 62 }, (_, i) => `Room ${i + 1}`).join('\n'), 20)
  const rooms = (await db.planItems.where('planId').equals(soc.id).toArray()).sort((a, b) => a.order - b.order)
  let next = 20
  for (const d of days.filter((x) => x >= socStart && x < today)) {
    if (weekday(d) === 0) continue
    const n = chance(0.15) ? 0 : chance(0.25) ? 2 : 1 // some days skipped, some days doubled
    for (let k = 0; k < n && next < rooms.length; k++) await setItemDone(rooms[next++].id, true, d)
  }
  await saveMilestone({ planId: soc.id, title: T.milestone1, from: socStart, to: addDays(socStart, 50), description: T.milestone1d })
  await saveMilestone({ planId: soc.id, title: T.milestone2, from: addDays(socStart, 60), to: addDays(socStart, 61), description: T.milestone2d })

  // ── An hours plan: English B2, 60 h at 1,5 h per day ──
  const engStart = addDays(today, -24)
  const eng = await createPlan({
    name: T.eng,
    kind: 'amount',
    unit: T.horas,
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
  await addTasksFromText(today, T.tasks)

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
      const [text, en] = options[Math.floor(r() * options.length)]
      const { kcal, items } = foodEntry(text)
      if (kcal > 0) await addFood({ date: d, kcal, label: lang === 'en' ? en : text, meal, items })
    }
  }

  // ── Added later (after every random draw, so the data above stays the same) ──
  // A task left from yesterday (it moves to today when Hoy opens) and some for the next days.
  await addTasksFromText(addDays(today, -1), T.yesterday)
  await addTasksFromText(today, T.upcoming)
  // A past break: a few days of vacation without the "no screens" habit.
  await pauseHabit(pantallas.id, addDays(today, -30), addDays(today, -26))
}
