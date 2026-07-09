import { test, expect, type Page } from '@playwright/test'
import { setupAuthenticatedPage } from './auth'
import fixture from './fixtures/today-tasks.json'

function taskRow(page: Page, title: string) {
  return page.locator(`xpath=//span[normalize-space(text())="${title}"]/ancestor::div[contains(@class,"rounded-")][1]`)
}

test.beforeEach(async ({ page, context }) => {
  await setupAuthenticatedPage(page, context, fixture)
  await page.goto('/tasks')
})

test('adds a new task and it appears in the list', async ({ page }) => {
  await page.getByPlaceholder('Task name...').fill('Write E2E tests')
  await page.getByRole('button', { name: '+ Add' }).click()

  await expect(page.getByText('Task added.')).toBeVisible()
  await expect(taskRow(page, 'Write E2E tests')).toBeVisible()
})

test('completes a task and shows the points toast', async ({ page }) => {
  const row = taskRow(page, 'Morning workout')
  await row.locator('button').first().click()

  await expect(page.getByText('+12 RXP · +6 🪙')).toBeVisible()
  await expect(row.locator('button').first()).toHaveText('✓')
})

test('uncompletes a previously done task', async ({ page }) => {
  const row = taskRow(page, 'Deep work block')
  await expect(row.locator('button').first()).toHaveText('✓')

  await row.locator('button').first().click()

  await expect(row.locator('button').first()).toHaveText('')
})

test('pins a task to focus it', async ({ page }) => {
  const row = taskRow(page, 'Morning workout')
  const pinButton = row.getByTitle('Select to focus this task')
  await pinButton.click()

  await expect(row.getByTitle('Remove focus')).toHaveText('★')
})

test('deletes a task via the reason modal', async ({ page }) => {
  const row = taskRow(page, 'Old leftover task')
  await row.getByRole('button', { name: '×', exact: true }).click()

  await expect(page.getByRole('dialog')).toContainText('Delete task?')
  await page.getByRole('button', { name: 'Duplicate / added by mistake' }).click()

  await expect(page.getByText('Task deleted.')).toBeVisible()
  await expect(taskRow(page, 'Old leftover task')).toHaveCount(0)
})
