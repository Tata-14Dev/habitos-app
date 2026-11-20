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
  await expect(page.getByText(/Terminás el/)).toBeVisible() // end date computed: 10 h at 2 per day
  await page.getByRole('button', { name: 'Crear plan' }).click()
  await expect(page.getByText('Hoy te tocan 2 horas')).toBeVisible()
  await page.getByLabel(/Cantidad de horas para sumar hoy/).fill('3')
  await page.getByRole('button', { name: 'Sumar' }).click()
  await expect(page.getByText('Hoy hiciste 3 horas 🎉')).toBeVisible()
  await expect(page.getByText('3/10 horas')).toBeVisible()
  await page.screenshot({ path: 'test-results/cantidad.png', fullPage: true })

  // Plan por ítems sin pegar la lista: "34, se llaman Room, 1 por día" → la fecha de fin sale sola
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Curso rápido')
  await page.getByLabel('¿Cuántos?').fill('34')
  await page.getByLabel(/Se llaman/).fill('Room')
  const expectedEnd = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() + 33)
    return d.toLocaleDateString('es-AR', { day: 'numeric' })
  })
  await expect(page.getByText(/Terminás el/)).toContainText(expectedEnd)
  await page.getByRole('button', { name: 'Crear plan' }).click()
  await expect(page.getByText('0/34')).toBeVisible()
  await expect(page.getByText('Room 34', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByText('Inglés').first().click()

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

  // Comida escrita: diccionario + un alimento desconocido que se resuelve con "Mis alimentos"
  await page.getByLabel('¿Qué comiste?').fill('200 g arroz, 2 huevos\n1 guiso de la abuela')
  const preview = page.getByRole('list', { name: 'Vista previa' })
  await expect(preview.getByText('Arroz blanco (cocido) · 200 g')).toBeVisible()
  await expect(preview.getByText('Huevo (entero, crudo o duro) · 100 g')).toBeVisible()
  await expect(preview.getByText('No conozco «guiso de la abuela».')).toBeVisible()
  await expect(page.getByText('Total: 415 kcal')).toBeVisible() // 260 + 155, the unknown line doesn't count yet
  await expect(page.getByRole('button', { name: 'Sumar 415 kcal' })).toBeDisabled()
  await page.getByRole('button', { name: 'Guardar en Mis alimentos' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByLabel(/^Nombre/)).toHaveValue('Guiso de la abuela')
  await sheet.getByLabel('kcal de una unidad').fill('450')
  await sheet.getByRole('button', { name: 'Guardar alimento' }).click()
  await expect(preview.getByText('Guiso de la abuela (mío)')).toBeVisible()
  await expect(page.getByText('Total: 865 kcal')).toBeVisible()
  await page.getByRole('button', { name: 'Sumar 865 kcal' }).click()
  await expect(page.getByLabel('¿Qué comiste?')).toHaveValue('')
  await page.getByText('200 g arroz, 2 huevos 1 guiso de la abuela').click() // expand the breakdown
  const detail = page.getByRole('list', { name: /Detalle de/ })
  await expect(detail.getByText('200 g arroz')).toBeVisible()
  await expect(detail.getByText('450 kcal')).toBeVisible()
  await expect(page.getByText('450 kcal por unidad')).toBeVisible() // listed in Mis alimentos

  // Solo kcal: la carga manual sigue funcionando
  await page.getByRole('button', { name: 'Solo kcal' }).click()
  await page.getByLabel('Calorías', { exact: true }).fill('650')
  await page.getByRole('button', { name: 'Sumar kcal' }).click()
  await expect(page.getByText('650 kcal').first()).toBeVisible()
  await expect(page.getByText('1.515', { exact: false }).first()).toBeVisible()
  await page.getByLabel('Peso de hoy en kg').fill('72,5')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Último: 72,5 kg', { exact: false })).toBeVisible()
  await page.screenshot({ path: 'test-results/salud.png', fullPage: true })

  // Hoy: carga rápida con el mismo formato
  await page.getByRole('link', { name: /Hoy/ }).click()
  await page.getByLabel('Comida o kcal').fill('1 banana')
  await expect(page.getByText('≈ 107 kcal · Banana')).toBeVisible()
  await page.getByRole('button', { name: 'Sumar comida' }).click()
  await expect(page.getByText('1.622', { exact: false }).first()).toBeVisible()

  expect(errors).toEqual([])
})
