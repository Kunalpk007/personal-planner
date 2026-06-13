import { test, expect } from '@playwright/test'
import { seedStore } from './helpers'
import fresh from './fixtures/fresh.json'

test('sets up a journal PIN and saves the first entry', async ({ page }) => {
  await seedStore(page, fresh)
  await page.goto('/journal')

  // First visit — PinGate prompts to choose a 4-digit PIN
  await expect(page.getByText('Set a 4-digit Journal PIN')).toBeVisible()
  for (const digit of ['1', '2', '3', '4']) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  // Security question, used for PIN recovery
  await expect(page.getByText('Security question')).toBeVisible()
  await page.getByPlaceholder("e.g. What was your first pet's name?").fill('Favorite color?')
  await page.getByPlaceholder('Your answer').fill('blue')
  await page.getByRole('button', { name: 'Save' }).click()

  // Now unlocked — write today's journal entry
  await page.getByPlaceholder(/mind today/).fill('First entry via E2E test.')
  await page.getByRole('button', { name: 'Save entry (+5 XP)' }).click()

  await expect(page.getByText('+5 Rank XP for journaling!')).toBeVisible()
  await expect(page.getByText('Saved 1 entry today ✓')).toBeVisible()
})
