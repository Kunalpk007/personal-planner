import { describe, it, expect, beforeEach } from 'vitest'
import { setUserScope, getUserScope, scopedStorageKey } from '@/store/userScope'

beforeEach(() => {
  // Reset to null between tests
  setUserScope(null)
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
