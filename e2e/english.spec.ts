import { expect, test } from '@playwright/test'

test.use({ locale: 'en-US' })

test('English UI follows the device language, demo included', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/?demo=1')
  await expect(page.getByText(/Demo mode: sample data/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your day', exact: true })).toBeVisible()
  await expect(page.getByText('Walk the dog')).toBeVisible()
  await expect(page.getByText("📍 You're on:").first()).toBeVisible()
  await expect(page.getByText("This week's goals")).toBeVisible()
  await expect(page.getByText(/Mental state/)).toBeVisible()
  await page.screenshot({ path: 'test-results/en-today.png', fullPage: true })

  await page.getByRole('link', { name: /Plans/ }).click()
  await page.getByText('SOC Level 1 · TryHackMe', { exact: true }).click()
  await expect(page.getByText('✓ 20 done before the plan')).toBeVisible()
  await expect(page.getByText('Estimated end')).toBeVisible()
  await page.screenshot({ path: 'test-results/en-plan.png', fullPage: true })

  await page.getByRole('link', { name: /Health/ }).click()
  await expect(page.getByText('Trend (7 days)').first()).toBeVisible()
  await expect(page.getByText(/\d\.\d kg/).first()).toBeVisible() // decimal point, not comma

  // Switching the language in Settings reloads the app in Spanish
  await page.getByRole('link', { name: /Settings/ }).click()
  await page.getByRole('button', { name: 'Español' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()

  expect(errors).toEqual([])
})
