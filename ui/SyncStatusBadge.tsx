'use client'
import { useState, useEffect } from 'react'
import { subscribeSyncStatus, getSyncStatus, type SyncStatus } from '@/lib/sync-status'

const STATUS_MAP: Record<Exclude<SyncStatus, 'idle'>, { text: string; color: string }> = {
  waiting:  { text: 'Waiting…', color: 'var(--amber)' },
  saving:   { text: 'Saving…',  color: 'var(--amber)' },
  saved:    { text: 'Saved ✓',  color: 'var(--green)' },
  error:    { text: 'Offline ⚠', color: 'var(--red)'  },
  // Firebase env vars weren't present at build time on this deployment — this
  // device is running in local-only mode and nothing here reaches Firestore,
  // so it will never appear on another device/origin until that's fixed
  // (see the NEXT_PUBLIC_FIREBASE_* / SESSION_SECRET env vars checklist).
  disabled: { text: 'No cloud sync ⚠', color: 'var(--red)' },
}

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => subscribeSyncStatus(setStatus), [])

  if (status === 'idle') return null

  const s = STATUS_MAP[status]
  return (
    <span style={{ fontSize: 11, color: s.color, flexShrink: 0, lineHeight: 1 }}>
      {s.text}
    </span>
  )
}
