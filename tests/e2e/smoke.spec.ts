import { test, expect, type Page } from '@playwright/test'
import { createTestToken, addAuthCookies } from './auth'

/** Collects console errors during a page interaction — assert empty at the end. */
function captureConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(err.message))
  return errors
}

const PROTECTED_TABS = ['/dashboard', '/tasks', '/journal', '/rewards', '/history', '/settings']
const PUBLIC_PAGES = ['/login', '/signup', '/reset-password']

// ── Public pages (no auth needed) ─────────────────────────────────────────────

for (const href of PUBLIC_PAGES) {
  test(`public page ${href} loads without console errors`, async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto(href)
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    // Public pages have an <h1> heading — basic hydration check
    await expect(page.locator('h1')).toBeVisible()
    expect(errors).toEqual([])
  })
}

// ── Auth guard (unauthenticated) ─────────────────────────────────────────────

test('redirects unauthenticated / to /login', async ({ page }) => {
  const errors = captureConsoleErrors(page)
  await page.goto('/')
  // / redirects to /dashboard (server-side), then proxy redirects to /login
  await expect(page).toHaveURL(/\/login/)
  expect(errors).toEqual([])
})

for (const href of PROTECTED_TABS) {
  test(`redirects unauthenticated ${href} to /login`, async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto(href)
    await expect(page).toHaveURL(/\/login/)
    expect(errors).toEqual([])
  })
}

// ── Session expired ───────────────────────────────────────────────────────────

test('shows session expired message when reason param is set', async ({ page }) => {
  const errors = captureConsoleErrors(page)
  await page.goto('/login?reason=session_expired')
  await expect(page.getByText(/Your session expired/)).toBeVisible()
  expect(errors).toEqual([])
})

// ── Protected pages (authenticated) ───────────────────────────────────────────

for (const href of PROTECTED_TABS) {
  test(`authenticated ${href} loads without console errors`, async ({ page, context }) => {
    const errors = captureConsoleErrors(page)
    const token = await createTestToken()
    await addAuthCookies(context, token)
    await page.goto(href)
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    // Authenticated pages have a navigation bar
    await expect(page.getByRole('navigation').first()).toBeVisible()
    expect(errors).toEqual([])
  })
}
