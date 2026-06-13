import { test, expect } from '@playwright/test'
import { seedStore } from './helpers'
import todayTasks from './fixtures/today-tasks.json'
import readyToSubmit from './fixtures/ready-to-submit.json'
import restDay from './fixtures/rest-day.json'
import freezeAndBuffer from './fixtures/freeze-and-buffer.json'

test('stat grid reflects today\'s tasks and wallet', async ({ page }) => {
  await seedStore(page, todayTasks)
  await page.goto('/dashboard')

  const pointsCard = page.locator('.stat-card').filter({ hasText: 'Points today' })
  await expect(pointsCard.locator('.stat-value')).toHaveText('20')

  const walletCard = page.locator('.stat-card').filter({ hasText: 'Reward Wallet' })
  await expect(walletCard.locator('.stat-value')).toHaveText('10')

  const doneCard = page.locator('.stat-card').filter({ hasText: 'Done today' })
  await expect(doneCard.locator('.stat-value')).toHaveText('1')
  await expect(doneCard).toContainText('of 3')
})

test('submits the day once minimum points are met', async ({ page }) => {
  await seedStore(page, readyToSubmit)
  await page.goto('/dashboard')

  await expect(page.getByText(/ready to submit!/)).toBeVisible()
  await page.getByRole('button', { name: '✓ Submit My Day' }).click()

  await expect(page.getByRole('dialog')).toContainText('Submit your day')
  await page.getByRole('button', { name: 'Confirm & lock' }).click()

  await expect(page.getByText('Day submitted! Streak protected 🔥')).toBeVisible()
  await expect(page.getByText('✓ Day submitted')).toBeVisible()
})

test('declares a rest day', async ({ page }) => {
  await seedStore(page, restDay)
  await page.goto('/dashboard')

  await page.getByRole('button', { name: '🟡 Rest day' }).click()
  await expect(page.getByRole('dialog')).toContainText('Declare Rest Day')
  await page.getByRole('button', { name: 'Declare Rest Day' }).click()

  await expect(page.getByText('🟡 Rest day declared. Streak protected.')).toBeVisible()
  await expect(page.getByText('✓ Day submitted')).toBeVisible()
})

test('uses a streak freeze to protect the day', async ({ page }) => {
  await seedStore(page, freezeAndBuffer)
  await page.goto('/dashboard')

  const freezeCard = page.locator('.card').filter({ hasText: 'Freezes' })
  await freezeCard.getByRole('button', { name: 'Use' }).click()

  await expect(page.getByRole('dialog')).toContainText('Use Streak Freeze')
  await page.getByRole('button', { name: 'Use Freeze' }).click()

  await expect(page.getByText('❄ Freeze used. Streak protected.')).toBeVisible()
})

test('converts buffer XP into rank XP', async ({ page }) => {
  await seedStore(page, freezeAndBuffer)
  await page.goto('/dashboard')

  const bufferCard = page.locator('.card').filter({ hasText: 'Buffer XP' })
  await bufferCard.getByRole('button', { name: 'Use' }).click()

  await expect(page.getByRole('dialog')).toContainText('Use Buffer XP')
  await page.getByRole('button', { name: 'Use 30 pts' }).click()

  await expect(page.getByText('+30 Rank XP from buffer.')).toBeVisible()
})
