export type SyncStatus = 'idle' | 'waiting' | 'saving' | 'saved' | 'error' | 'disabled'

type Listener = (s: SyncStatus) => void
let _status: SyncStatus = 'idle'
const _listeners = new Set<Listener>()

export function setSyncStatus(s: SyncStatus): void {
  _status = s
  _listeners.forEach(l => l(s))
}

export function getSyncStatus(): SyncStatus { return _status }

export function subscribeSyncStatus(l: Listener): () => void {
  _listeners.add(l)
  return () => _listeners.delete(l)
}
