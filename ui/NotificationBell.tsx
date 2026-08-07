'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useSocialStore } from '@/store/social/social.store'

interface NotifItem {
  id:    string   // stable across renders — used as the "seen" key
  text:  string
  at:    string   // ISO — used for sort order
  route: string   // where clicking this item navigates
}

const FRIENDS_ROUTE          = '/tasks?mode=friends'
const CHALLENGES_GIVEN_ROUTE = '/tasks?mode=challenges&sub=given'
const MY_CHALLENGES_ROUTE    = '/tasks?mode=challenges&sub=accepted'

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

// Dismissal is purely a local "hide this" concept — there's no notifications
// collection to delete from (everything here is re-derived from live
// subscriptions each render, see the big comment on NotificationBell below).
// Dismissed ids are just filtered out of the derived list; if the same id's
// underlying doc changes again later it's free to reappear, same as "seen".
function dismissedKey(uid: string): string {
  return `kp_notif_dismissed:${uid}`
}

function loadDismissed(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(uid))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(uid: string, dismissed: Set<string>): void {
  try {
    localStorage.setItem(dismissedKey(uid), JSON.stringify([...dismissed].slice(-200)))
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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0, maxHeight: 420 })
  const [mounted, setMounted] = useState(false)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (uid) { setSeen(loadSeen(uid)); setDismissed(loadDismissed(uid)) }
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
      list.push({ id: `freq:${r.id}`, text: `${r.fromName} sent you a friend request`, at: r.createdAt, route: FRIENDS_ROUTE })
    }
    for (const v of validationsToReview) {
      list.push({ id: `valreq:${v.id}`, text: `${v.ownerName} needs you to validate "${v.taskTitle}"`, at: v.createdAt, route: FRIENDS_ROUTE })
    }
    for (const c of incomingChallenges) {
      list.push({ id: `chalin:${c.id}`, text: `${c.ownerName} challenged you: "${c.title}"`, at: c.createdAt, route: MY_CHALLENGES_ROUTE })
      // Owner nudged us to accept/start a still-pending challenge.
      const reminderAt = uid ? c.reminderSentAt?.[uid] : undefined
      if (reminderAt) {
        list.push({ id: `chalrem:${c.id}:${reminderAt}`, text: `${c.ownerName} sent you a reminder: "${c.title}"`, at: reminderAt, route: MY_CHALLENGES_ROUTE })
      }
    }
    for (const a of approvalsToReview) {
      list.push({ id: `apprreq:${a.id}`, text: `Approve "${a.rewardTitle}" redemption (${a.cost}pts)?`, at: a.createdAt, route: FRIENDS_ROUTE })
    }
    for (const v of myOwnValidations) {
      if (v.status === 'rejected') {
        list.push({ id: `valres:${v.id}`, text: `Your task "${v.taskTitle}" was rejected${v.note ? `: ${v.note}` : ''}`, at: v.resolvedAt ?? v.createdAt, route: FRIENDS_ROUTE })
      }
    }
    for (const a of myOwnApprovals) {
      if (a.status === 'rejected') {
        list.push({ id: `apprres:${a.id}`, text: `Your "${a.rewardTitle}" redemption was rejected${a.note ? `: ${a.note}` : ''}`, at: a.resolvedAt ?? a.createdAt, route: FRIENDS_ROUTE })
      }
    }
    for (const c of sentChallenges) {
      const friendUid = c.participantUids[0]
      const status = c.perUserStatus[friendUid]
      if (status === 'accepted')  list.push({ id: `chalacc:${c.id}`, text: `Your challenge "${c.title}" was accepted`, at: c.createdAt, route: CHALLENGES_GIVEN_ROUTE })
      if (status === 'declined')  list.push({ id: `chaldec:${c.id}`, text: `Your challenge "${c.title}" was declined`, at: c.createdAt, route: CHALLENGES_GIVEN_ROUTE })
      if (status === 'done')      list.push({ id: `chaldone:${c.id}`, text: `Your challenge "${c.title}" was completed 🎉`, at: c.createdAt, route: CHALLENGES_GIVEN_ROUTE })
      if (status === 'cancelled') {
        const reason = c.cancelReason?.[friendUid]
        list.push({ id: `chalcancel:${c.id}`, text: `Your challenge "${c.title}" was cancelled${reason ? `: ${reason}` : ''}`, at: c.createdAt, route: CHALLENGES_GIVEN_ROUTE })
      }
    }
    return list.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))).slice(0, 30)
  }, [uid, incomingRequests, validationsToReview, incomingChallenges, approvalsToReview, myOwnValidations, myOwnApprovals, sentChallenges])

  // Dismissed items are hidden but not "gone" from the underlying data (there's
  // nothing to delete — see the dismissedKey comment above), so both the badge
  // count and the rendered list filter them out the same way.
  const visibleItems = items.filter(i => !dismissed.has(i.id))
  const unseenCount = visibleItems.filter(i => !seen.has(i.id)).length

  function handleToggle() {
    const next = !open
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      // Anchor below-right of the bell, like a normal app notification
      // dropdown — clamped so it always stays fully on-screen (the panel's
      // own width is also capped responsively via CSS, but `right` still
      // needs a floor/ceiling so it can't be pushed past either edge on a
      // narrow viewport) and height-capped to whatever room is actually
      // left below the icon so it never runs off the bottom of the screen.
      const PANEL_WIDTH = 320
      const right = Math.min(
        Math.max(8, window.innerWidth - rect.right),
        Math.max(8, window.innerWidth - PANEL_WIDTH - 8)
      )
      const maxHeight = Math.max(160, Math.min(420, window.innerHeight - rect.bottom - 24))
      setPanelPos({ top: rect.bottom + 8, right, maxHeight })
    }
    setOpen(next)
    if (next && uid) {
      const nextSeen = new Set(seen)
      items.forEach(i => nextSeen.add(i.id))
      setSeen(nextSeen)
      saveSeen(uid, nextSeen)
    }
  }

  function dismissOne(id: string) {
    if (!uid) return
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(uid, next)
  }

  function dismissAll() {
    if (!uid) return
    const next = new Set(dismissed)
    visibleItems.forEach(i => next.add(i.id))
    setDismissed(next)
    saveDismissed(uid, next)
  }

  if (!uid) return null

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Notifications"
        className="vx-bell-btn"
      >
        <BellIcon />
        {unseenCount > 0 && (
          <span className="vx-bell-badge">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {/* A normal app-style dropdown anchored to the bell icon — not a
          centered modal — portalled to <body> with fixed positioning.
          .vx-nav-top scrolls horizontally (overflow-x: auto), which clips
          any absolutely positioned descendant that would otherwise render
          "behind" the page content below it; a portal escapes that clipping
          entirely. Position is computed in handleToggle and clamped there
          so the panel can never end up off-screen. */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              className="vx-notif-panel"
              style={{ position: 'fixed', top: panelPos.top, right: panelPos.right, maxHeight: panelPos.maxHeight, zIndex: 1000 }}
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <div className="vx-notif-header">
                <span>Notifications</span>
                {visibleItems.length > 0 && (
                  <button onClick={dismissAll} className="vx-notif-dismiss-all">
                    Dismiss all
                  </button>
                )}
              </div>
              {visibleItems.length === 0 ? (
                <div className="vx-notif-empty">Nothing yet.</div>
              ) : (
                <div className="vx-notif-list">
                  {visibleItems.map(i => (
                    <div key={i.id} className={`vx-notif-item ${seen.has(i.id) ? '' : 'vx-unseen'}`}>
                      <button
                        onClick={() => { setOpen(false); router.push(i.route) }}
                        className="vx-notif-item-text"
                      >
                        {i.text}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissOne(i.id) }}
                        aria-label="Dismiss"
                        className="vx-notif-item-dismiss"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
