import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage } from './auth'
import wallet from './fixtures/wallet.json'

test.beforeEach(async ({ page, context }) => {
  await setupAuthenticatedPage(page, context, wallet)
  await page.goto('/rewards')
})

test('buys a streak freeze with wallet points', async ({ page }) => {
  await page.getByRole('button', { name: '❄ Buy Streak Freeze' }).click()

  await expect(page.getByRole('dialog')).toContainText('Buy Streak Freeze')
  await page.getByRole('button', { name: 'Buy 1 freeze (250 pts)' }).click()

  await expect(page.getByText('❄ Freeze purchased! Tokens: 1')).toBeVisible()
})

test('redeems a reward from the wallet', async ({ page }) => {
  const row = page.locator(
    `xpath=//span[normalize-space(text())="30-min screen-free break"]/ancestor::div[contains(@class,"rounded-")][1]`
  )
  await row.getByRole('button', { name: 'Redeem' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Redeem' }).click()

  await expect(page.getByText('🎁 Reward redeemed!')).toBeVisible()
})
