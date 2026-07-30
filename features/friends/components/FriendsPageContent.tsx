'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSocialStore } from '@/store/social/social.store'
import { usePlannerStore } from '@/store'
import { getClientAuth } from '@/lib/firebase/client'
import { getPublicProfile } from '@/lib/firebase/firestore'
import { FRIEND_TAGS, FRIEND_TAG_META, FRIEND_SOFT_CAP } from '@/constants/social'
import type { FriendTag } from '@/constants/social'
import { showToast } from '@/ui/Toast'
import { Modal } from '@/ui/Modal'
import type { SharedTask } from '@/store/social/types'

function inviteLink(uid: string, name: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/tasks?mode=friends&code=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`
}

export function FriendsPageContent() {
  const params = useSearchParams()
  const friends     = useSocialStore(s => s.friends)
  const loaded      = useSocialStore(s => s.loaded)
  const addFriend   = useSocialStore(s => s.addFriendDirect)
  const remove      = useSocialStore(s => s.remove)
  const myName      = useSocialStore(s => s.displayName)

  const [myUid, setMyUid] = useState<string | null>(null)
  const [toUid, setToUid] = useState('')
  const [toName, setToName] = useState('')
  const [confirmAdd, setConfirmAdd] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMyUid(getClientAuth().currentUser?.uid ?? null)
  }, [])

  // Prefill from an invite link (?code=&name=).
  useEffect(() => {
    const code = params.get('code')
    const name = params.get('name')
    if (code) setToUid(code)
    if (name) setToName(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doAdd() {
    setBusy(true)
    const res = await addFriend(toUid.trim(), toName.trim() || 'Friend')
    setBusy(false)
    setConfirmAdd(false)
    if (res.ok) {
      showToast('Friend added 🎉')
      setToUid(''); setToName('')
    } else {
      const msg: Record<string, string> = {
        'not-signed-in': 'You need to be signed in.',
        'self': "That's your own code.",
        'cap-reached': `You're at the ${FRIEND_SOFT_CAP}-friend limit.`,
        'already-friends': "You're already friends.",
        'already-sent': 'Already added.',
      }
      showToast(msg[res.reason] ?? 'Could not add friend.')
    }
  }

  return (
    <div>
      {/* Your code + share link */}
      {myUid && (
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-3 mb-3 text-[12px]">
          <div className="text-[var(--text3)] mb-1">Your friend code / invite link</div>
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 truncate text-[13px] font-semibold">{myUid}</code>
            <button onClick={() => { navigator.clipboard?.writeText(myUid); showToast('Code copied.') }}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[var(--text2)]">Copy code</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { navigator.clipboard?.writeText(inviteLink(myUid, myName)); showToast('Invite link copied.') }}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[var(--text2)]">🔗 Copy invite link</button>
            <button
              onClick={() => {
                const link = inviteLink(myUid, myName)
                const msg = `Add me on Personal Planner — just open this link and tap Add Friend 💪\n\n${link}`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
              }}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[#25D366] flex items-center gap-1 whitespace-nowrap"
              title="Share invite link via WhatsApp">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg>
              WhatsApp
            </button>
          </div>
          <div className="text-[10px] text-[var(--text3)] mt-1.5">Anyone who opens your link and taps Add Friend becomes your friend instantly — no approval needed.</div>
        </div>
      )}

      {/* Add a friend */}
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3">
        <div className="text-[13px] font-medium mb-2">Add a friend</div>
        {friends.length >= FRIEND_SOFT_CAP ? (
          <div className="text-[12px] text-[var(--amber)]">You&apos;ve hit the {FRIEND_SOFT_CAP}-friend limit. Remove someone below to add a new one.</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <input value={toUid} onChange={e => setToUid(e.target.value)} placeholder="Paste their friend code"
              className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            <input value={toName} onChange={e => setToName(e.target.value)} placeholder="Their name (optional)"
              className="flex-1 min-w-[120px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            <button disabled={busy || !toUid.trim()} onClick={() => setConfirmAdd(true)}
              className="text-[13px] px-3 py-2 rounded-md bg-[var(--green-mid)] text-white disabled:opacity-50">Add Friend</button>
          </div>
        )}
      </div>

      {/* Your friends */}
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
        Your friends ({friends.length}/{FRIEND_SOFT_CAP})
      </div>
      {!loaded && <div className="text-[12px] text-[var(--text3)] py-3 text-center">Loading…</div>}
      {loaded && friends.length === 0 && <div className="text-[12px] text-[var(--text3)] py-3 text-center">No friends yet. Share your invite link above.</div>}
      {friends.map(f => <FriendTile key={f.uid} friend={f} onRemove={() => remove(f.uid)} />)}

      {/* Add confirmation */}
      <Modal open={confirmAdd} onClose={() => setConfirmAdd(false)} title="Add friend?">
        <p className="text-sm text-[var(--text2)] mb-4">Add <strong>{toName.trim() || 'this person'}</strong> as a friend? You&apos;ll both be added to each other&apos;s lists right away.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmAdd(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={doAdd} disabled={busy} className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-50">
            {busy ? 'Adding…' : 'Add Friend'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function FriendTile({ friend, onRemove }: {
  friend: { uid: string; displayName: string; tags: FriendTag[]; isNotary: boolean }
  onRemove: () => void
}) {
  const setTags         = useSocialStore(s => s.setTags)
  const checkReciprocal = useSocialStore(s => s.checkReciprocal)
  const addFriend       = useSocialStore(s => s.addFriendDirect)

  const [xp, setXp] = useState<number | null>(null)
  const [reciprocal, setReciprocal] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    let alive = true
    getPublicProfile(friend.uid).then(p => { if (alive && p?.rankXP != null) setXp(p.rankXP) })
    checkReciprocal(friend.uid).then(r => { if (alive) setReciprocal(r) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.uid])

  const primaryType = friend.tags[0] ? FRIEND_TAG_META[friend.tags[0]].label : 'Friend'

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 mb-2">
      <div className="flex items-center gap-2.5">
        <button onClick={() => setHistoryOpen(true)} className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-medium break-words [overflow-wrap:anywhere]">{friend.displayName}</div>
          <div className="text-[11px] text-[var(--text3)] flex items-center gap-2 mt-0.5">
            <span>{primaryType}</span>
            <span>·</span>
            <span>{xp == null ? '… XP' : `${xp} XP`}</span>
          </div>
        </button>
        <select value={friend.tags[0] ?? ''} onChange={e => setTags(friend.uid, e.target.value ? [e.target.value as FriendTag] : [])}
          className="text-[11px] px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)] outline-none flex-shrink-0"
          title="Friend type">
          <option value="">Type…</option>
          {FRIEND_TAGS.map(t => <option key={t} value={t}>{FRIEND_TAG_META[t].label}</option>)}
        </select>
        {!reciprocal ? (
          <button onClick={() => addFriend(friend.uid, friend.displayName).then(() => { setReciprocal(true); showToast('Re-added.') })}
            className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--green-mid)] text-white flex-shrink-0" title="They removed you — re-add">Send request</button>
        ) : (
          <button onClick={() => setConfirmRemove(true)}
            className="flex-shrink-0 w-6 h-6 rounded-full border border-[var(--red)] text-[var(--red)] flex items-center justify-center text-sm" title="Remove friend" aria-label="Remove friend">×</button>
        )}
      </div>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove friend?">
        <p className="text-sm text-[var(--text2)] mb-4">Remove {friend.displayName}? They&apos;ll no longer be in your list. You can re-add them anytime with their code.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmRemove(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={() => { onRemove(); setConfirmRemove(false); showToast('Friend removed.') }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red)]">Remove</button>
        </div>
      </Modal>

      <FriendHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} friend={friend} />
    </div>
  )
}

function FriendHistoryModal({ open, onClose, friend }: {
  open: boolean; onClose: () => void; friend: { uid: string; displayName: string }
}) {
  const sentChallenges = useSocialStore(s => s.sentChallenges)
  const tasks = usePlannerStore(s => s.tasks)
  const goals = usePlannerStore(s => s.goals)

  const sent = sentChallenges.filter((c: SharedTask) => c.participantUids[0] === friend.uid)
  const fromThem = [
    ...tasks.filter(t => t.challengedBy === friend.displayName).map(t => ({ id: t.id, title: t.title, kind: 'Task', done: t.done })),
    ...goals.filter(g => g.challengedBy === friend.displayName).map(g => ({ id: g.id, title: g.title, kind: 'Goal', done: !!g.completedAt })),
  ]

  function statusOf(c: SharedTask): string {
    const st = c.perUserStatus[c.participantUids[0]] ?? 'pending'
    return st === 'done' ? 'Completed ✓' : st === 'accepted' ? 'Accepted' : st === 'declined' ? 'Declined' : 'Pending'
  }

  return (
    <Modal open={open} onClose={onClose} title={`🎯 ${friend.displayName} — challenge history`}>
      <div className="max-h-[55vh] overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">You challenged them</div>
        {sent.length === 0 && <div className="text-[12px] text-[var(--text3)] mb-3">None yet.</div>}
        {sent.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-[12px] border-b border-[var(--border)]">
            <span className="break-words [overflow-wrap:anywhere] min-w-0">
              <span className="text-[10px] font-semibold mr-1 text-[var(--text3)]">{c.type === 'goal' ? 'GOAL' : 'TASK'}</span>
              {c.title}{c.type === 'goal' && c.completionPoints != null ? ` · +${c.completionPoints} pts` : ''}
            </span>
            <span className="text-[var(--text2)] flex-shrink-0">{statusOf(c)}</span>
          </div>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5 mt-3">They challenged you</div>
        {fromThem.length === 0 && <div className="text-[12px] text-[var(--text3)]">None yet.</div>}
        {fromThem.map(x => (
          <div key={x.id} className="flex items-center justify-between gap-2 py-1.5 text-[12px] border-b border-[var(--border)]">
            <span className="break-words [overflow-wrap:anywhere] min-w-0">
              <span className="text-[10px] font-semibold mr-1 text-[var(--text3)]">{x.kind.toUpperCase()}</span>{x.title}
            </span>
            <span className="text-[var(--text2)] flex-shrink-0">{x.done ? 'Completed ✓' : 'In progress'}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Close</button>
      </div>
    </Modal>
  )
}
