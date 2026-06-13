'use client'
import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AppState } from './types'
import { createTasksSlice }   from './slices/tasks.slice'
import { createStreakSlice }  from './slices/streak.slice'
import { createRewardsSlice } from './slices/rewards.slice'
import { createJournalSlice } from './slices/journal.slice'
import { createConfigSlice }  from './slices/config.slice'
import { createUISlice }      from './slices/ui.slice'
import { STORAGE_KEY, INITIAL_STATE } from './defaults'

const BACKUP_SUFFIX = '_backup'

/**
 * Wraps localStorage so every write keeps a rolling one-generation backup
 * under `<key>_backup`, and reads fall back to that backup if the primary
 * key is missing or unreadable (e.g. corrupted by a partial write).
 */
const recoveringStorage: StateStorage = {
  getItem: (name) => {
    try {
      const v = localStorage.getItem(name)
      if (v) return v
    } catch {}
    try {
      return localStorage.getItem(name + BACKUP_SUFFIX)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      const prev = localStorage.getItem(name)
      if (prev) localStorage.setItem(name + BACKUP_SUFFIX, prev)
    } catch {}
    localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
    localStorage.removeItem(name + BACKUP_SUFFIX)
  },
}

export const usePlannerStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // Seed all state fields with defaults first
      ...INITIAL_STATE,
      // Then layer actions from each slice
      ...createTasksSlice(set, get, api),
      ...createStreakSlice(set, get, api),
      ...createRewardsSlice(set, get, api),
      ...createJournalSlice(set, get, api),
      ...createConfigSlice(set, get, api),
      ...createUISlice(set, get, api),
    }),
    {
      name:    STORAGE_KEY,
      storage: createJSONStorage(() => recoveringStorage),
      version: 2,
    }
  )
)
