import { usePlannerStore } from '@/store'
import { INITIAL_STATE } from '@/store/defaults'

// Snapshot the action functions once — they never change between resets.
const actions: Record<string, unknown> = {}
for (const [key, value] of Object.entries(usePlannerStore.getState())) {
  if (typeof value === 'function') actions[key] = value
}

/** Resets the store back to INITIAL_STATE while preserving slice actions. */
export function resetStore() {
  usePlannerStore.setState({ ...structuredClone(INITIAL_STATE), ...actions } as never, true)
}
