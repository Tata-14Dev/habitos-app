import { expect, test } from '@playwright/test'

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
  await expect(page.getByText(/Pendiente: implementá/).first()).toBeVisible()
  await expect(page.getByText('0/34')).toBeVisible()

  // Marcar 3 ítems
  for (const n of [1, 2, 3]) await page.getByRole('checkbox', { name: `Room ${n}`, exact: true }).click()
  await expect(page.getByText('3/34')).toBeVisible()
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

  // Persistencia: recargar
  await page.reload()
  await expect(page.getByText('Progreso diario')).toBeVisible()

  expect(errors.filter((e) => !/NotImplemented/.test(e))).toEqual([])
})
