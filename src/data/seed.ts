/** "Cargar ejemplo": Tomás's real plan (brief §10). */
import { db } from './db'
import { addItems, createPlan, saveHabit, saveMilestone, updatePlan } from './repo'

export const EXAMPLE_PLAN_NAME = 'SOC Level 1 · TryHackMe'

const MILESTONES: { title: string; from: string; to: string; description: string }[] = [
  { title: 'Terminar el path', from: '2026-11-16', to: '2026-12-20', description: 'Una room por día. Descargar el certificado apenas termine' },
  { title: 'Control de avance', from: '2026-12-06', to: '2026-12-06', description: 'Si voy atrasado, recuperar ese fin de semana' },
  { title: 'Margen y fiestas', from: '2026-12-21', to: '2027-01-03', description: 'Descanso. Solo recuperar si hace falta' },
  { title: 'Revisar Premium', from: '2026-12-28', to: '2026-12-28', description: 'Confirmar que la suscripción siga activa en enero' },
  { title: 'Preparación SAL1', from: '2027-01-04', to: '2027-01-15', description: '~2 h por día: SOC Simulator, plantilla de reportes, rehacer rooms difíciles, hoja de queries del SIEM' },
  { title: 'Comprar el voucher', from: '2027-01-12', to: '2027-01-12', description: 'Si me siento cómodo con el simulador' },
  { title: 'Examen SAL1', from: '2027-01-16', to: '2027-01-17', description: 'Ventana de 24 h, con pausas' },
  { title: 'Fecha de reserva', from: '2027-01-23', to: '2027-01-24', description: 'Por si algo falla' },
]

/** Returns false if the example plan already exists. */
export async function loadExample(): Promise<boolean> {
  const exists = (await db.plans.toArray()).some((p) => p.name === EXAMPLE_PLAN_NAME && !p.deletedAt)
  if (exists) return false

  const plan = await createPlan({
    name: EXAMPLE_PLAN_NAME,
    kind: 'items',
    unit: 'rooms',
    startDate: '2026-11-16',
    deadline: '2026-12-20',
    pace: 1,
    restWeekdays: [],
    blockedDates: ['2026-12-24', '2026-12-25', '2026-12-31'],
    withHabit: false,
  })
  await addItems(plan.id, Array.from({ length: 34 }, (_, i) => `Room ${i + 1}`).join('\n'))
  for (const m of MILESTONES) await saveMilestone({ planId: plan.id, ...m })

  // Example habit "Estudiar SOC", linked to the plan.
  const habit = await saveHabit({ name: 'Estudiar SOC', emoji: '🛡️', startDate: '2026-11-16' })
  await updatePlan(plan.id, { linkedHabitId: habit.id })
  return true
}
