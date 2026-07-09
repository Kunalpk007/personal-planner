import type { BrowserContext, Page } from '@playwright/test'

const TEST_UID = 'e2e-test-user-00000000-0000-0000-0000-000000000000'
const COOKIE_DOMAIN = 'localhost'

/**
 * Creates a test session cookie by reading SESSION_SECRET from the
 * environment (loaded via dotenv in playwright.config.ts) and signing
 * a JWT with the app's jose key.
 *
 * This lets e2e tests bypass the proxy.ts auth guard without mocking.
 */
export async function createTestToken(): Promise<string> {
  const { SignJWT } = await import('jose')
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is required for e2e tests. ' +
      'Ensure .env.local exists with a valid SESSION_SECRET (min 32 chars).'
    )
  }
  const key = new TextEncoder().encode(secret)
  return new SignJWT({ userId: TEST_UID, email: 'test@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

/**
 * Injects auth cookies into the browser context so that proxy.ts
 * treats the user as authenticated. Call in `test.beforeEach` or
 * `page.addInitScript` before navigating to a protected route.
 */
export async function addAuthCookies(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: 'kp_session',
      value: token,
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
    {
      name: 'kp_uid',
      value: TEST_UID,
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
    {
      name: 'kp_display',
      value: encodeURIComponent('Test User'),
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Seeds localStorage + adds auth cookies + freezes clock.
 * Single setup call for protected routes.
 */
export async function setupAuthenticatedPage(
  page: Page,
  context: BrowserContext,
  fixture: Record<string, unknown>,
) {
  const token = await createTestToken()
  await addAuthCookies(context, token)
  await page.addInitScript(
    ([key, state]) => {
      localStorage.setItem(key, JSON.stringify({ state, version: 2 }))
    },
    [process.env.NEXT_PUBLIC_STORAGE_KEY || 'kunals_planner_v2', fixture] as [string, Record<string, unknown>],
  )
  await page.clock.setFixedTime(new Date('2026-06-12T10:00:00'))
}
