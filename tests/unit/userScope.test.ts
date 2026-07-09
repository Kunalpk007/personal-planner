import { describe, it, expect, beforeEach } from 'vitest'
import { setUserScope, getUserScope, scopedStorageKey, readUidFromCookieSync } from '@/store/userScope'

beforeEach(() => {
  // Reset to null between tests
  setUserScope(null)
})

describe('readUidFromCookieSync', () => {
  it('returns null when no kp_uid cookie exists', () => {
    globalThis.document.cookie = ''
    expect(readUidFromCookieSync()).toBeNull()
  })

  it('returns the uid when kp_uid cookie is set', () => {
    globalThis.document.cookie = 'some=val; kp_uid=test-user-789; other=thing'
    expect(readUidFromCookieSync()).toBe('test-user-789')
  })

  it('decodes URI-encoded cookie values', () => {
    globalThis.document.cookie = 'kp_uid=user%40example.com'
    expect(readUidFromCookieSync()).toBe('user@example.com')
  })
})

describe('setUserScope / getUserScope', () => {
  it('stores and retrieves a user id', () => {
    setUserScope('user-abc')
    expect(getUserScope()).toBe('user-abc')
  })

  it('returns null when no user is set', () => {
    expect(getUserScope()).toBeNull()
  })

  it('can be reset to null', () => {
    setUserScope('user-abc')
    setUserScope(null)
    expect(getUserScope()).toBeNull()
  })
})

describe('scopedStorageKey', () => {
  it('returns the anonymous key when no user is set', () => {
    expect(scopedStorageKey('my_store')).toBe('my_store:__anon__')
  })

  it('returns the user-scoped key when a user is set', () => {
    setUserScope('user-123')
    expect(scopedStorageKey('my_store')).toBe('my_store:user-123')
  })
})
