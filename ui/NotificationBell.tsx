'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useSocialStore } from '@/store/social/social.store'

interface NotifItem {
  id:   string   // stable across renders — used as the "seen" key
  text: string
  at:   string   // ISO — used for sort order
}

function seenKey(uid: string): string {
  return `kp_notif_seen:${uid}`
}

function loadSeen(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(uid))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveSeen(uid: string, seen: Set<string>): void {
  try {
    // Cap growth — only the most recent 200 seen-ids need to stick around.
    localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-200)))
  } catch {}
}

// Matches the stroke style of the bottom-tab icons in app/(tabs)/layout.tsx
// (viewBox 0 0 24 24, stroke=currentColor, strokeWidth 1.8) rather than an
// emoji, so it sits consistently with the rest of the nav chrome.
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/** Aggregates everything actionable or newly-resolved across the Friends
 *  system into one dropdown: incoming friend requests, tasks/rewards waiting
 *  on my review, incoming challenges, plus "your thing got rejected/accepted"
 *  notices for stuff I sent out. All of it is driven by the same live
 *  Firestore listeners already running in social.store.ts — nothing here
 *  polls, it just re-derives from whatever state those listeners have
 *  already pushed in. */
export function NotificationBell() {
  const router = useRouter()
  const uid = useSocialStore(s => s.uid)
  const incomingRequests    = useSocialStore(s => s.incomingRequests)
  const validationsToReview = useSocialStore(s => s.validationsToReview)
  const incomingChallenges  = useSocialStore(s => s.incomingChallenges)
  const approvalsToReview   = useSocialStore(s => s.approvalsToReview)
  const myOwnValidations    = useSocialStore(s => s.myOwnValidations)
  const myOwnApprovals      = useSocialStore(s => s.myOwnApprovals)
  const sentChallenges      = useSocialStore(s => s.sentChallenges)

  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })
  const [mounted, setMounted] = useState(false)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (uid) setSeen(loadSeen(uid))
  }, [uid])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Close on scroll/resize rather than trying to keep a fixed-position panel
  // glued to a moving trigger — simplest way to avoid a stale/misaligned dropdown.
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const items = useMemo<NotifItem[]>(() => {
    const list: NotifItem[] = []
    for (const r of incomingRequests) {
      list.push({ id: `freq:${r.id}`, text: `${r.fromName} sent you a friend request`, at: r.createdAt })
    }
    for (const v of validationsToReview) {
      list.push({ id: `valreq:${v.id}`, text: `${v.ownerName} needs you to validate "${v.taskTitle}"`, at: v.createdAt })
    }
    for (const c of incomingChallenges) {
      list.push({ id: `chalin:${c.id}`, text: `${c.ownerName} challenged you: "${c.title}"`, at: c.createdAt })
    }
    for (const a of approvalsToReview) {
      list.push({ id: `apprreq:${a.id}`, text: `Approve "${a.rewardTitle}" redemption (${a.cost}pts)?`, at: a.createdAt })
    }
    for (const v of myOwnValidations) {
      if (v.status === 'rejected') {
        list.push({ id: `valres:${v.id}`, text: `Your task "${v.taskTitle}" was rejected${v.note ? `: ${v.note}` : ''}`, at: v.resolvedAt ?? v.createdAt })
      }
    }
    for (const a of myOwnApprovals) {
      if (a.status === 'rejected') {
        list.push({ id: `apprres:${a.id}`, text: `Your "${a.rewardTitle}" redemption was rejected${a.note ? `: ${a.note}` : ''}`, at: a.resolvedAt ?? a.createdAt })
      }
    }
    for (const c of sentChallenges) {
      const friendUid = c.participantUids[0]
      const status = c.perUserStatus[friendUid]
      if (status === 'accepted') list.push({ id: `chalacc:${c.id}`, text: `Your challenge "${c.title}" was accepted`, at: c.createdAt })
      if (status === 'declined') list.push({ id: `chaldec:${c.id}`, text: `Your challenge "${c.title}" was declined`, at: c.createdAt })
      if (status === 'done')     list.push({ id: `chaldone:${c.id}`, text: `Your challenge "${c.title}" was completed 🎉`, at: c.createdAt })
    }
    return list.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))).slice(0, 30)
  }, [incomingRequests, validationsToReview, incomingChallenges, approvalsToReview, myOwnValidations, myOwnApprovals, sentChallenges])

  const unseenCount = items.filter(i => !seen.has(i.id)).length

  function handleToggle() {
    const next = !open
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPanelPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    setOpen(next)
    if (next && uid) {
      const nextSeen = new Set(seen)
      items.forEach(i => nextSeen.add(i.id))
      setSeen(nextSeen)
      saveSeen(uid, nextSeen)
    }
  }

  if (!uid) return null

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Notifications"
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          lineHeight: 1, padding: 4, color: 'inherit', display: 'flex',
        }}
      >
        <BellIcon />
        {unseenCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, minWidth: 14, height: 14, padding: '0 3px',
            borderRadius: 999, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {/* Portalled to <body> with fixed positioning — .nav-top scrolls
          horizontally (overflow-x: auto), which clips any absolutely
          positioned descendant that would otherwise render "behind" the
          page content below it. A portal escapes that clipping entirely. */}
      {mounted && open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', top: panelPos.top, right: panelPos.right, width: 300, maxHeight: 360,
            overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000,
          }}
        >
          <div style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
              Nothing yet.
            </div>
          ) : (
            items.map(i => (
              <button
                key={i.id}
                onClick={() => { setOpen(false); router.push('/tasks?mode=friends') }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                  fontSize: 12, border: 'none', borderBottom: '1px solid var(--border)',
                  background: seen.has(i.id) ? 'transparent' : 'var(--purple-bg, rgba(123,110,246,0.08))',
                  color: 'var(--text)', cursor: 'pointer',
                }}
              >
                {i.text}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
