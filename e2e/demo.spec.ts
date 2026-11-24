import { expect, test } from '@playwright/test'

test('modo demo: datos de ejemplo en una base aparte', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Empty app → invitation to try the demo
  await page.goto('/')
  await page.getByRole('button', { name: /Probar la demo/ }).click()
  await expect(page.getByText(/Modo demo: datos de ejemplo/)).toBeVisible()

  // Today: grouped habits, a course halfway, tasks, health
  await expect(page.getByText('Pasear al perro')).toBeVisible()
  await expect(page.getByText('Vas por:').first()).toContainText('Room')
  await expect(page.getByText('Dentista')).toBeVisible()
  await expect(page.getByText('Metas de la semana')).toBeVisible()
  await page.screenshot({ path: 'test-results/demo-hoy.png', fullPage: true })

  // Plan: started at room 21
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByText('SOC Level 1 · TryHackMe', { exact: true }).click()
  await expect(page.getByText('20 hechos antes del plan')).toBeVisible()
  await expect(page.getByText('Avance', { exact: true })).toBeVisible()
  await page.getByText('Avance', { exact: true }).locator('xpath=ancestor::section[1]').screenshot({ path: 'test-results/demo-burnup.png' })
  await page.screenshot({ path: 'test-results/demo-plan.png', fullPage: true })
  await page.getByRole('link', { name: /Planes/ }).click()
  await page.getByText('Inglés B2', { exact: true }).click()
  await expect(page.getByText('Avance', { exact: true })).toBeVisible()
  await page.getByText('Avance', { exact: true }).locator('xpath=ancestor::section[1]').screenshot({ path: 'test-results/demo-burnup-horas.png' })

  // Month grid and health have history
  await page.getByRole('link', { name: /Hábitos/ }).click()
  await page.getByRole('link', { name: /Ver mes/ }).click()
  await expect(page.getByText('Progreso diario')).toBeVisible()
  await page.getByRole('link', { name: /ver 20/ }).click()
  await expect(page.getByText('Día por día')).toBeVisible()
  await page.screenshot({ path: 'test-results/demo-anio.png', fullPage: true })
  await page.getByRole('link', { name: /Salud/ }).click()
  await expect(page.getByText('Tendencia (7 días)').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/demo-salud.png', fullPage: true })

  // Leaving the demo goes back to the real (still empty) database
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await expect(page.getByText(/Modo demo: datos de ejemplo/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Probar la demo/ })).toBeVisible()

  expect(errors).toEqual([])
})
