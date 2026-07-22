'use client'
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AppState } from './types'
import { createTasksSlice }   from './slices/tasks.slice'
import { createStreakSlice }  from './slices/streak.slice'
import { createRewardsSlice } from './slices/rewards.slice'
import { createGoalsSlice }   from './slices/goals.slice'
import { createJournalSlice } from './slices/journal.slice'
import { createConfigSlice }  from './slices/config.slice'
import { createUISlice }      from './slices/ui.slice'
import { STORAGE_KEY, INITIAL_STATE } from './defaults'
import { scopedStorageKey } from './userScope'

const BACKUP_SUFFIX = '_backup'

/**
 * User-scoped recovering storage.
 *
 * All reads/writes are namespaced to the active user:
 *   localStorage["kunals_planner_v2:{userId}"]
 *
 * This means two users on the same browser have completely separate data.
 *
 * Firebase migration path: replace localStorage calls here with
 * Firestore reads/writes using getUserScope() as the document ID.
 * The key structure maps directly to Firestore["/users/{userId}/data"].
 */
const recoveringStorage: StateStorage = {
  getItem: (name) => {
    const key = scopedStorageKey(name)
    try {
      const v = localStorage.getItem(key)
      if (v) return v
    } catch {}
    try {
      return localStorage.getItem(key + BACKUP_SUFFIX)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    const key = scopedStorageKey(name)
    try {
      const prev = localStorage.getItem(key)
      if (prev) localStorage.setItem(key + BACKUP_SUFFIX, prev)
    } catch {}
    localStorage.setItem(key, value)
  },
  removeItem: (name) => {
    const key = scopedStorageKey(name)
    localStorage.removeItem(key)
    localStorage.removeItem(key + BACKUP_SUFFIX)
  },
}

export const usePlannerStore = create<AppState>()(
  persist(
    (set, get, api) => {
      // Stamp lastModified on every mutation so cross-device loads can pick
      // the newer of local vs. cloud state (see StoreBootstrap merge logic)
      // instead of always assuming local is authoritative.
      const stampedSet: typeof set = (partial, replace) => {
        const stamp = { lastModified: new Date().toISOString() }
        if (typeof partial === 'function') {
          const fn = partial as (state: AppState) => Partial<AppState>
          set((state) => ({ ...fn(state), ...stamp }), replace as any)
        } else {
          set({ ...partial, ...stamp } as Partial<AppState>, replace as any)
        }
      }

      return {
        // Seed all state fields with defaults first
        ...INITIAL_STATE,
        // Then layer actions from each slice
        ...createTasksSlice(stampedSet, get, api),
        ...createStreakSlice(stampedSet, get, api),
        ...createRewardsSlice(stampedSet, get, api),
        ...createGoalsSlice(stampedSet, get, api),
        ...createJournalSlice(stampedSet, get, api),
        ...createConfigSlice(stampedSet, get, api),
        ...createUISlice(stampedSet, get, api),
      }
    },
    {
      name:    STORAGE_KEY,
      storage: createJSONStorage(() => recoveringStorage),
      version: 2,
    }
  )
)
