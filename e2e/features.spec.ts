import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** Tasks with days, carry-over, pauses, meals, achievements, the quick-check link and CSV export (on the demo). */
test('tareas con fecha, pausas, comidas, logros, atajos y CSV', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?demo=1')
  await expect(page.getByText('Pasear al perro')).toBeVisible()

  // ── Tasks: yesterday's pending one moved to today; the ones for later days are listed apart ──
  await expect(page.getByText('Devolver los libros a la biblioteca')).toBeVisible()
  await expect(page.getByText(/↪ del /)).toBeVisible()
  await expect(page.getByText(/Próximos días · 2 tareas/)).toBeVisible()
  await expect(page.getByText('Renovar el pasaporte')).toBeVisible()

  // Dictation with a day: the preview says it, and the task goes to "Próximos días".
  await page.getByRole('textbox', { name: 'Dictá tu día' }).fill('pasado mañana comprar pilas')
  await expect(page.getByText(/^• .*Comprar pilas/)).toContainText('· Comprar pilas')
  await page.getByRole('button', { name: 'Agregar 1 tarea' }).click()
  await expect(page.getByText(/Próximos días · 3 tareas/)).toBeVisible()
  await expect(page.getByText('Comprar pilas')).toBeVisible()
  await page.screenshot({ path: 'test-results/feat-tareas.png', fullPage: true })

  // ── Pause a habit and resume it ──
  await page.getByRole('link', { name: /Hábitos/ }).first().click()
  await page.getByRole('link', { name: /Hacer la cama/ }).click()
  await page.getByRole('button', { name: /Pausar \(vacaciones/ }).click()
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(page.getByText('⏸️ En pausa')).toBeVisible()
  await page.screenshot({ path: 'test-results/feat-pausa.png', fullPage: true })
  await page.getByRole('link', { name: /Hoy/ }).first().click()
  await expect(page.getByText(/en pausa: no cuentan/)).toBeVisible()
  await page.getByRole('link', { name: 'Hacer la cama' }).click()
  await page.getByRole('button', { name: 'Reanudar' }).click()
  await expect(page.getByText('⏸️ En pausa')).toHaveCount(0)

  // A past pause shows in the detail of the habit that had one.
  await page.getByRole('link', { name: '← Estadísticas' }).click()
  await page.getByRole('link', { name: /Sin pantallas antes de dormir/ }).click()
  await expect(page.getByText(/^Pausas:/)).toBeVisible()

  // ── Achievements in Estadísticas ──
  await page.getByRole('link', { name: '← Estadísticas' }).click()
  await expect(page.getByText('Logros', { exact: true })).toBeVisible()
  await expect(page.getByText('Primer paso')).toBeVisible()
  await page.getByText('Logros', { exact: true }).locator('xpath=ancestor::section[1]').screenshot({ path: 'test-results/feat-logros.png' })

  // ── Meals: repeat one with a tap, edit one ──
  await page.getByRole('link', { name: /Salud/ }).first().click()
  const kcalToday = page.getByText(/kcal$/).first()
  await expect(page.getByText('Repetir una comida')).toBeVisible()
  const before = await page.getByRole('button', { name: /^Borrar / }).count()
  await page.getByRole('button', { name: /^Sumar otra vez / }).first().click()
  await expect(page.getByRole('button', { name: /^Borrar / })).toHaveCount(before + 1)
  await page.getByRole('button', { name: /^Editar / }).first().click()
  await expect(page.getByRole('dialog').getByText('Editar comida')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: /Guardar/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(kcalToday).toBeVisible()
  await page.screenshot({ path: 'test-results/feat-comidas.png', fullPage: true })

  // ── Quick-check link (shortcuts): marks the habit done today, with undo ──
  await page.getByRole('link', { name: /Ajustes/ }).first().click()
  await page.getByText('Marcá un hábito o dictá sin abrir la app primero.').click()
  const link = await page.getByText(/\/marcar\//).first().textContent()
  const path = new URL(link!).pathname
  await page.goto(path)
  await expect(page.getByText(/✅ Listo: /)).toBeVisible()
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('button', { name: 'Marcar como hecho' })).toBeVisible()

  // ── CSV export: Spanish spreadsheet format ──
  await page.goto('/ajustes')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '✅ Hábitos' }).click()
  const file = await (await download).path()
  const csv = readFileSync(file, 'utf8')
  expect(csv.startsWith('﻿Fecha;Hacer la cama;')).toBe(true)
  expect(csv).toContain('% del día')
  await expect(page.getByText(/✅ Exportadas \d+ filas\./)).toBeVisible()

  expect(errors).toEqual([])
})
