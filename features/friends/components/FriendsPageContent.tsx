'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSocialStore } from '@/store/social/social.store'
import { usePlannerStore } from '@/store'
import { FRIEND_TAGS, FRIEND_TAG_META, FRIEND_SOFT_CAP } from '@/constants/social'
import type { FriendTag } from '@/constants/social'
import { showToast } from '@/ui/Toast'
import { Modal } from '@/ui/Modal'
import type { SharedTask } from '@/store/social/types'

export function FriendsPageContent() {
  const params = useSearchParams()
  const friends     = useSocialStore(s => s.friends)
  const loaded      = useSocialStore(s => s.loaded)
  const addFriend   = useSocialStore(s => s.addFriendDirect)
  const remove      = useSocialStore(s => s.remove)

  const [toUid, setToUid] = useState('')
  const [toName, setToName] = useState('')
  const [confirmAdd, setConfirmAdd] = useState(false)
  const [busy, setBusy] = useState(false)

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
      {/* Add a friend */}
      <div className="vx-tile p-3.5 mb-3">
        <div className="text-[13px] font-medium mb-2">Add a friend</div>
        {friends.length >= FRIEND_SOFT_CAP ? (
          <div className="text-[12px]" style={{ color: 'var(--vx-amber)' }}>You&apos;ve hit the {FRIEND_SOFT_CAP}-friend limit. Remove someone below to add a new one.</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <input value={toUid} onChange={e => setToUid(e.target.value)} placeholder="Paste their friend code"
              className="flex-1 min-w-[160px] vx-field" />
            <input value={toName} onChange={e => setToName(e.target.value)} placeholder="Their name (optional)"
              className="flex-1 min-w-[120px] vx-field" />
            <button disabled={busy || !toUid.trim()} onClick={() => setConfirmAdd(true)}
              className="vx-btn vx-btn-primary text-[13px]">Add Friend</button>
          </div>
        )}
      </div>

      {/* Your friends */}
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vx-fg-4)' }}>
        Your friends ({friends.length}/{FRIEND_SOFT_CAP})
      </div>
      {!loaded && <div className="text-[12px] py-3 text-center" style={{ color: 'var(--vx-fg-4)' }}>Loading…</div>}
      {loaded && friends.length === 0 && <div className="text-[12px] py-3 text-center" style={{ color: 'var(--vx-fg-4)' }}>No friends yet. Share your invite link above.</div>}
      {friends.map(f => <FriendTile key={f.uid} friend={f} onRemove={() => remove(f.uid)} />)}

      {/* Add confirmation */}
      <Modal open={confirmAdd} onClose={() => setConfirmAdd(false)} title="Add friend?" variant="vx">
        <p className="text-sm mb-4" style={{ color: 'var(--vx-fg-2)' }}>Add <strong>{toName.trim() || 'this person'}</strong> as a friend? You&apos;ll both be added to each other&apos;s lists right away.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmAdd(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={doAdd} disabled={busy} className="vx-btn vx-btn-primary text-sm">
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

  const [reciprocal, setReciprocal] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    let alive = true
    checkReciprocal(friend.uid).then(r => { if (alive) setReciprocal(r) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.uid])

  return (
    <div className="vx-tile mb-2">
      <button onClick={() => setHistoryOpen(true)} className="block w-full text-left">
        <div className="text-[13px] font-medium break-words">{friend.displayName}</div>
      </button>
      <div className="flex items-center justify-between gap-2 mt-2">
        <select value={friend.tags[0] ?? ''} onChange={e => setTags(friend.uid, e.target.value ? [e.target.value as FriendTag] : [])}
          className="vx-field text-[11px] px-2 py-1 min-w-0 max-w-[55%]"
          title="Friend type">
          <option value="">Type…</option>
          {FRIEND_TAGS.map(t => <option key={t} value={t}>{FRIEND_TAG_META[t].label}</option>)}
        </select>
        {!reciprocal ? (
          <button onClick={() => addFriend(friend.uid, friend.displayName).then(() => { setReciprocal(true); showToast('Re-added.') })}
            className="vx-btn vx-btn-primary text-[11px] px-2.5 py-1 flex-shrink-0" title="They removed you — re-add">Send request</button>
        ) : (
          <button onClick={() => setConfirmRemove(true)}
            className="vx-btn vx-btn-icon vx-danger flex-shrink-0" title="Remove friend" aria-label="Remove friend">×</button>
        )}
      </div>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove friend?" variant="vx">
        <p className="text-sm mb-4" style={{ color: 'var(--vx-fg-2)' }}>Remove {friend.displayName}? They&apos;ll no longer be in your list. You can re-add them anytime with their code.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmRemove(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={() => { onRemove(); setConfirmRemove(false); showToast('Friend removed.') }}
            className="vx-btn vx-btn-danger text-sm">Remove</button>
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
    <Modal open={open} onClose={onClose} title={`🎯 ${friend.displayName} — challenge history`} variant="vx">
      <div className="max-h-[55vh] overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--vx-fg-4)' }}>You challenged them</div>
        {sent.length === 0 && <div className="text-[12px] mb-3" style={{ color: 'var(--vx-fg-4)' }}>None yet.</div>}
        {sent.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-[12px] border-b" style={{ borderColor: 'var(--vx-border)' }}>
            <span className="break-words [overflow-wrap:anywhere] min-w-0">
              <span className="text-[10px] font-semibold mr-1" style={{ color: 'var(--vx-fg-4)' }}>{c.type === 'goal' ? 'GOAL' : 'TASK'}</span>
              {c.title}{c.type === 'goal' && c.completionPoints != null ? ` · +${c.completionPoints} pts` : ''}
            </span>
            <span className="flex-shrink-0" style={{ color: 'var(--vx-fg-3)' }}>{statusOf(c)}</span>
          </div>
        ))}

        <div className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 mt-3" style={{ color: 'var(--vx-fg-4)' }}>They challenged you</div>
        {fromThem.length === 0 && <div className="text-[12px]" style={{ color: 'var(--vx-fg-4)' }}>None yet.</div>}
        {fromThem.map(x => (
          <div key={x.id} className="flex items-center justify-between gap-2 py-1.5 text-[12px] border-b" style={{ borderColor: 'var(--vx-border)' }}>
            <span className="break-words [overflow-wrap:anywhere] min-w-0">
              <span className="text-[10px] font-semibold mr-1" style={{ color: 'var(--vx-fg-4)' }}>{x.kind.toUpperCase()}</span>{x.title}
            </span>
            <span className="flex-shrink-0" style={{ color: 'var(--vx-fg-3)' }}>{x.done ? 'Completed ✓' : 'In progress'}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={onClose} className="vx-btn vx-btn-ghost text-sm">Close</button>
      </div>
    </Modal>
  )
}
