import { expect, test, type Page } from '@playwright/test'

/** Value of a dashboard stat ("Fin estimado" → "19/12/2026"). */
const statValue = (page: Page, label: string) =>
  page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]').innerText()

test('flujo básico: ejemplo, plan, ítems, hábitos y dictado', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tu día', exact: true })).toBeVisible()

  // Cargar ejemplo
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByRole('button', { name: /Cargar ejemplo/ }).click()
  await page.getByText('SOC Level 1 · TryHackMe').click()
  await expect(page.getByText(/Pendiente: implementá/)).toHaveCount(0)
  await expect(page.getByText('0/34')).toBeVisible()
  const endBefore = await statValue(page, 'Fin estimado')

  // Marcar 3 ítems hoy → la fecha de fin se adelanta
  for (const n of [1, 2, 3]) await page.getByRole('checkbox', { name: `Room ${n}`, exact: true }).last().click()
  await expect(page.getByText('3/34')).toBeVisible()
  await expect.poll(() => statValue(page, 'Fin estimado')).not.toBe(endBefore)
  await page.screenshot({ path: 'test-results/plan.png', fullPage: true })

  // Hoy: dictado + hábito vinculado marcado solo
  await page.getByRole('link', { name: /Hoy/ }).click()
  await page.getByPlaceholder(/micrófono/).fill('dentista a las 15 horas, comprar yerba')
  await page.getByRole('button', { name: /Agregar 2 tareas/ }).click()
  await expect(page.getByText('15:00')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Estudiar SOC' })).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: 'test-results/hoy.png', fullPage: true })

  // Hábitos y mes
  await page.getByRole('link', { name: /Hábitos/ }).click()
  await page.getByRole('link', { name: /Ver mes/ }).click()
  await expect(page.getByText('Progreso diario')).toBeVisible()
  await page.screenshot({ path: 'test-results/mes.png', fullPage: true })

  // Plan por cantidad: 10 horas a 2 por día; registrar 3 h hoy
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByRole('button', { name: /Por cantidad/ }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Inglés')
  await page.getByLabel('Total a completar').fill('10')
  await page.getByLabel('Unidad', { exact: true }).fill('horas')
  await page.getByLabel(/Ritmo/).fill('2')
  await page.getByLabel('Fecha límite').fill('2027-12-31')
  await page.getByRole('button', { name: 'Crear plan' }).click()
  await expect(page.getByText('Hoy te tocan 2 horas')).toBeVisible()
  await page.getByLabel(/Cantidad de horas para sumar hoy/).fill('3')
  await page.getByRole('button', { name: 'Sumar' }).click()
  await expect(page.getByText('Hoy hiciste 3 horas 🎉')).toBeVisible()
  await expect(page.getByText('3/10 horas')).toBeVisible()
  await page.screenshot({ path: 'test-results/cantidad.png', fullPage: true })

  // Persistencia: recargar
  await page.reload()
  await expect(page.getByText('3/10 horas')).toBeVisible()

  // Tipos de hábito: fijo a la mañana, uno de ciertos días (no hoy) y una meta semanal
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const notToday = days[(new Date().getDay() + 2) % 7]
  await page.getByRole('link', { name: /Hábitos/ }).click()

  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Hacer la cama')
  await page.getByRole('button', { name: 'Mañana', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Todos los días · mañana')).toBeVisible()

  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByRole('button', { name: /Del día/ }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Natación')
  await page.getByRole('button', { name: notToday, exact: true }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()

  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByRole('button', { name: /Con progreso/ }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Inglés semanal')
  await page.getByLabel('Meta', { exact: true }).fill('5')
  await page.getByLabel('Unidad', { exact: true }).fill('h')
  await page.getByRole('button', { name: 'Por semana', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('5 h por semana')).toBeVisible()

  await page.getByRole('link', { name: /Hoy/ }).click()
  await expect(page.getByText('🌅 Mañana')).toBeVisible()
  await expect(page.getByText('Hacer la cama')).toBeVisible()
  await expect(page.getByText('Natación')).toHaveCount(0) // not due today
  await expect(page.getByText('Metas de la semana')).toBeVisible()
  await page.getByRole('button', { name: 'Sumar 1 h a Inglés semanal' }).click()
  await expect(page.getByText('1/5 h esta semana')).toBeVisible()
  await page.screenshot({ path: 'test-results/habitos-tipos.png', fullPage: true })

  // Salud: activar, sumar calorías y un pesaje
  await page.getByRole('link', { name: /Ajustes/ }).click()
  await page.getByLabel(/Seguimiento de peso y calorías/).click()
  await expect(page.getByLabel(/Seguimiento de peso y calorías/)).toBeChecked()
  await page.getByRole('link', { name: /Salud/ }).click()
  await page.getByLabel('Calorías', { exact: true }).fill('650')
  await page.getByRole('button', { name: 'Sumar kcal' }).click()
  await expect(page.getByText('650 kcal').first()).toBeVisible()
  await page.getByLabel('Peso de hoy en kg').fill('72,5')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Último: 72,5 kg', { exact: false })).toBeVisible()
  await page.screenshot({ path: 'test-results/salud.png', fullPage: true })

  expect(errors).toEqual([])
})
