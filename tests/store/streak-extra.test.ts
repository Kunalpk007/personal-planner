import { describe, it, expect, beforeEach } from 'vitest'
import { usePlannerStore } from '@/store'
import { resetStore } from './helpers'
import { MAX_PAUSE_DAYS } from '@/constants/points'

beforeEach(resetStore)

describe('pauseStreak', () => {
  it('saves the current streak and reason in pausedStreak', () => {
    usePlannerStore.setState({ streak: 15 })
    usePlannerStore.getState().pauseStreak('Vacation')

    const paused = usePlannerStore.getState().pausedStreak
    expect(paused).not.toBeNull()
    expect(paused!.streakAtPause).toBe(15)
    expect(paused!.reason).toBe('Vacation')
    expect(paused!.date).toBeTruthy()
  })
})

describe('restoreStreak', () => {
  it('restores the paused streak and clears pausedStreak', () => {
    usePlannerStore.setState({ streak: 5 })
    usePlannerStore.getState().pauseStreak('Sick')
    usePlannerStore.setState({ streak: 0 }) // streak may have broken during pause

    usePlannerStore.getState().restoreStreak()

    expect(usePlannerStore.getState().streak).toBe(5)
    expect(usePlannerStore.getState().pausedStreak).toBeNull()
  })

  it('keeps current streak when there is no pausedStreak', () => {
    usePlannerStore.setState({ streak: 7 })
    usePlannerStore.getState().restoreStreak()
    expect(usePlannerStore.getState().streak).toBe(7)
  })
})

describe('checkPausedExpiry', () => {
  it('does nothing when there is no paused streak', () => {
    usePlannerStore.setState({ pausedStreak: null, streak: 10 })
    usePlannerStore.getState().checkPausedExpiry()
    expect(usePlannerStore.getState().streak).toBe(10)
  })

  it('resets streak to 0 when the pause has expired beyond MAX_PAUSE_DAYS', () => {
    const expiredDate = new Date(Date.now() - (MAX_PAUSE_DAYS + 1) * 86400000).toISOString()
    usePlannerStore.setState({ streak: 10, pausedStreak: { date: expiredDate, reason: 'Travel', streakAtPause: 10 } })

    usePlannerStore.getState().checkPausedExpiry()

    expect(usePlannerStore.getState().streak).toBe(0)
    expect(usePlannerStore.getState().pausedStreak).toBeNull()
  })

  it('does not expire a pause that is within MAX_PAUSE_DAYS', () => {
    const recentDate = new Date(Date.now() - 1 * 86400000).toISOString()
    usePlannerStore.setState({ streak: 10, pausedStreak: { date: recentDate, reason: 'Travel', streakAtPause: 10 } })

    usePlannerStore.getState().checkPausedExpiry()

    expect(usePlannerStore.getState().streak).toBe(10) // not reset
    expect(usePlannerStore.getState().pausedStreak).not.toBeNull()
  })
})

describe('invalidateStreak', () => {
  it('resets streak to 0 and clears pausedStreak', () => {
    usePlannerStore.setState({ streak: 20, pausedStreak: { date: new Date().toISOString(), reason: 'x', streakAtPause: 20 } })
    usePlannerStore.getState().invalidateStreak()
    expect(usePlannerStore.getState().streak).toBe(0)
    expect(usePlannerStore.getState().pausedStreak).toBeNull()
  })
})

describe('resetRankXP', () => {
  it('sets rankXP to 0', () => {
    usePlannerStore.setState({ rankXP: 500 })
    usePlannerStore.getState().resetRankXP()
    expect(usePlannerStore.getState().rankXP).toBe(0)
  })
})
