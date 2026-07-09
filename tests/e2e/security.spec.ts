import { test, expect } from '@playwright/test'

test.describe('Auth guard edge cases', () => {

  test('redirects to login with from param for unknown routes', async ({ page }) => {
    await page.goto('/some/deep/page')
    await expect(page).toHaveURL(/\/login\?from=%2Fsome%2Fdeep%2Fpage/)
  })

  test('does not redirect public pages to login', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/signup$/)
    await page.goto('/reset-password')
    await expect(page).toHaveURL(/\/reset-password$/)
  })

  test('redirect to login preserves from param', async ({ page }) => {
    await page.goto('/tasks?sort=date')
    const url = page.url()
    expect(url).toContain('/login')
    expect(url).toContain('from=%2Ftasks')
  })

  test('does not crash on malformed session cookie', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'kp_session',
        value: 'not-a-valid-jwt',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict' as const,
      },
    ])
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/dashboard')
    // Should redirect to login, not crash
    await expect(page).toHaveURL(/\/login/)
    expect(errors).toEqual([])
  })

  test('expired or invalid session shows redirect not crash', async ({ page, context }) => {
    // Create a JWT with alg=none — simulates tampered token
    const tamperedToken = 'eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiJ0ZXN0In0.'
    await context.addCookies([
      {
        name: 'kp_session',
        value: tamperedToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict' as const,
      },
    ])
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    expect(errors).toEqual([])
  })
})

test.describe('Error boundary fallback', () => {
  test('app shell error boundary renders without crashing', async ({ page, context }) => {
    const { createTestToken, addAuthCookies } = await import('./auth')
    const token = await createTestToken()
    await addAuthCookies(context, token)

    // Cause a deliberate runtime error by corrupting localStorage
    // (The store bootstrap will fail, triggering the error boundary)
    await page.addInitScript(() => {
      localStorage.setItem('kunals_planner_v2', '{invalid json!!!}')
    })

    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/dashboard')

    // The app should recover gracefully — show the morning quote overlay,
    // the dashboard, or error boundary fallback instead of a blank white screen.
    await expect(page.getByText(/something went wrong|Start my day|My Planner|loading|login/i).first()).toBeVisible({ timeout: 15000 })
    // No unhandled page errors — boundary caught it
    expect(errors.filter(e => !e.includes('NEXT_REDIRECT'))).toEqual([])
  })
})

test.describe('Session expiry flow', () => {
  test('shows session expired banner on login page', async ({ page }) => {
    await page.goto('/login?reason=session_expired')
    await expect(page.getByText(/Your session expired/)).toBeVisible()
    // Form is still functional alongside the banner
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })
})
