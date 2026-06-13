import { test, expect, type Page } from '@playwright/test'

const TABS = ['/dashboard', '/tasks', '/journal', '/rewards', '/history', '/settings']

function captureConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

test('redirects from / to /dashboard', async ({ page }) => {
  const errors = captureConsoleErrors(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('navigation').first()).toContainText("Kunal's Planner")
  expect(errors).toEqual([])
})

for (const href of TABS) {
  test(`loads ${href} without console errors`, async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto(href)
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole('navigation').first()).toContainText("Kunal's Planner")
    expect(errors).toEqual([])
  })
}
