'use client'
import { useEffect, useState } from 'react'
import { useSocialStore } from '@/store/social/social.store'
import { getClientAuth } from '@/lib/firebase/client'
import { FRIEND_TAGS, FRIEND_TAG_META, FRIEND_SOFT_CAP, FRIEND_NUDGE_AT } from '@/constants/social'
import type { FriendTag } from '@/constants/social'
import { showToast } from '@/ui/Toast'
import { Modal } from '@/ui/Modal'

export function FriendsPageContent() {
  const friends          = useSocialStore(s => s.friends)
  const incomingRequests = useSocialStore(s => s.incomingRequests)
  const outgoingRequests = useSocialStore(s => s.outgoingRequests)
  const loaded            = useSocialStore(s => s.loaded)
  const sendRequest        = useSocialStore(s => s.sendRequest)
  const accept             = useSocialStore(s => s.accept)
  const reject              = useSocialStore(s => s.reject)
  const setTags             = useSocialStore(s => s.setTags)
  const remove               = useSocialStore(s => s.remove)
  const approvalsToReview   = useSocialStore(s => s.approvalsToReview)
  const approveRequest      = useSocialStore(s => s.approveRequest)
  const rejectRequest       = useSocialStore(s => s.rejectRequest)
  const setThresholdFor     = useSocialStore(s => s.setThresholdFor)

  const validationsToReview = useSocialStore(s => s.validationsToReview)
  const approveValidation   = useSocialStore(s => s.approveValidation)
  const rejectValidation    = useSocialStore(s => s.rejectValidation)
  const incomingChallenges  = useSocialStore(s => s.incomingChallenges)
  const acceptChallenge     = useSocialStore(s => s.acceptChallenge)
  const declineChallenge    = useSocialStore(s => s.declineChallenge)
  const sentChallenges      = useSocialStore(s => s.sentChallenges)

  const [myUid, setMyUid] = useState<string | null>(null)
  const [toUid, setToUid] = useState('')
  const [toName, setToName] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setMyUid(getClientAuth().currentUser?.uid ?? null)
  }, [])

  async function handleSend() {
    if (!toUid.trim()) return
    setSending(true)
    const result = await sendRequest(toUid.trim(), toName.trim() || 'Friend')
    setSending(false)
    if (result.ok) {
      showToast('Friend request sent.')
      setToUid('')
      setToName('')
    } else {
      const messages: Record<string, string> = {
        'not-signed-in':   'You need to be signed in.',
        'self':            "That's your own code.",
        'cap-reached':     `You're at the ${FRIEND_SOFT_CAP}-friend limit. Remove someone first.`,
        'already-friends': "You're already friends.",
        'already-sent':    'Request already sent — waiting on them.',
      }
      showToast(messages[result.reason] ?? 'Could not send request.')
    }
  }

  return (
    <div>
      {myUid && (
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-3 mb-3 text-[12px]">
          <div className="text-[var(--text3)] mb-1">Your friend code — share it so others can add you</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-[13px] font-semibold">{myUid}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(myUid); showToast('Copied.') }}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[var(--text2)]"
            >
              Copy
            </button>
            <button
              onClick={() => {
                // wa.me with no phone number opens WhatsApp's own contact
                // picker — a free deep link, no WhatsApp Business API needed.
                const msg = `Hey! Add me on Kunal's Planner so we can keep each other accountable 💪\n\nMy friend code: ${myUid}\n\nOpen the app → Friends → Add a friend → paste this code.`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
              }}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[#25D366] flex items-center gap-1 whitespace-nowrap"
              title="Share your friend code via WhatsApp"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67a8.2 8.2 0 0 1 5.83 2.42 8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25M8.53 6.98c-.17 0-.45.06-.68.32-.24.25-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.86 4.45 3.9.62.26 1.1.42 1.48.53.62.2 1.19.17 1.63.1.5-.07 1.53-.62 1.75-1.23.22-.6.22-1.11.15-1.22-.07-.1-.24-.17-.5-.3-.26-.13-1.53-.75-1.77-.84-.24-.09-.4-.13-.58.13-.17.26-.66.83-.81 1-.15.17-.3.19-.55.06-.26-.13-1.08-.4-2.06-1.27-.76-.68-1.28-1.5-1.42-1.76-.15-.26-.02-.4.11-.53.11-.11.26-.3.38-.44.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.58-1.46-.81-2-.21-.5-.43-.44-.58-.45-.15 0-.32-.01-.5-.01Z"/></svg>
              WhatsApp
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3">
        <div className="text-[13px] font-medium mb-2">Add a friend</div>
        {friends.length >= FRIEND_SOFT_CAP ? (
          <div className="text-[12px] text-[var(--amber)]">
            You&apos;ve hit the {FRIEND_SOFT_CAP}-friend limit. Remove someone below to add a new one.
          </div>
        ) : (
          <>
            {friends.length >= FRIEND_NUDGE_AT && (
              <div className="text-[11px] text-[var(--text3)] mb-2">
                3 is usually the sweet spot — more people often means less accountability per person.
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <input
                value={toUid}
                onChange={e => setToUid(e.target.value)}
                placeholder="Paste their friend code"
                className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
              />
              <input
                value={toName}
                onChange={e => setToName(e.target.value)}
                placeholder="Their name (optional)"
                className="flex-1 min-w-[120px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
              />
              <button
                disabled={sending || !toUid.trim()}
                onClick={handleSend}
                className="text-[13px] px-3 py-2 rounded-md bg-[var(--green-mid)] text-white disabled:opacity-50"
              >
                Send request
              </button>
            </div>
          </>
        )}
      </div>

      {incomingRequests.length > 0 && (
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Incoming requests</div>
          {incomingRequests.map(r => (
            <div key={r.id} className="flex items-center justify-between py-1.5 text-[13px]">
              <span>{r.fromName}</span>
              <div className="flex gap-1.5">
                <button onClick={() => accept(r)} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--green-mid)] text-white">Accept</button>
                <button onClick={() => reject(r.id)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--text3)]">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div className="text-[11px] text-[var(--text3)] mb-3">
          Waiting on: {outgoingRequests.map(r => r.toName).join(', ')}
        </div>
      )}

      {approvalsToReview.length > 0 && (
        <div className="rounded-[10px] border border-[var(--purple)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Reward redemptions to review</div>
          {approvalsToReview.map(a => (
            <div key={a.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
              <span className="flex-1">{a.rewardTitle} — {a.cost} pts ({a.gate === 'habit' ? 'habit-linked' : 'over threshold'})</span>
              <button onClick={() => approveRequest(a.id)} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--green-mid)] text-white">Approve now</button>
              <button onClick={() => rejectRequest(a.id, null)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--red)]">Reject</button>
            </div>
          ))}
          <div className="text-[10px] text-[var(--text3)] mt-1">No action needed if you&apos;re fine with it — it auto-approves once the cooldown passes.</div>
        </div>
      )}

      {validationsToReview.length > 0 && (
        <div className="rounded-[10px] border border-[var(--purple)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Tasks to validate</div>
          {validationsToReview.map(v => (
            <div key={v.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
              <span className="flex-1">{v.ownerName} did: &ldquo;{v.taskTitle}&rdquo;</span>
              <button onClick={() => approveValidation(v.id)} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--green-mid)] text-white">Approve</button>
              <button onClick={() => rejectValidation(v.id, null)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--red)]">Reject</button>
            </div>
          ))}
          <div className="text-[10px] text-[var(--text3)] mt-1">Their points for this task stay withheld until you decide — there&apos;s no auto-approve here.</div>
        </div>
      )}

      {incomingChallenges.length > 0 && (
        <div className="rounded-[10px] border border-[var(--purple)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Challenges</div>
          {incomingChallenges.map(c => (
            <div key={c.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
              <span className="flex-1">
                {c.ownerName} challenged you {c.type === 'goal' ? 'to a goal' : ''}: &ldquo;{c.title}&rdquo;
                {c.type === 'goal' && (
                  <span className="text-[var(--text3)]"> · {c.checklist?.length ?? 0} tasks{c.endDate ? ` · by ${c.endDate}` : ''}</span>
                )}
              </span>
              <button onClick={() => acceptChallenge(c)} className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--purple)] text-white">Accept</button>
              <button onClick={() => declineChallenge(c.id)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border2)] text-[var(--text3)]">Decline</button>
            </div>
          ))}
          <div className="text-[10px] text-[var(--text3)] mt-1">Accepting adds it to your own Tasks (or Goals, for goal challenges) — it counts toward your own points, not theirs.</div>
        </div>
      )}

      {sentChallenges.length > 0 && (
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3">
          <div className="text-[13px] font-medium mb-2">Challenges you&apos;ve sent</div>
          {/* Its own listener keyed only on ownerUid (see listenSentChallenges)
              — independent of the `friends` array, so adding or removing a
              friend never clears this history. */}
          {[...sentChallenges].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).map(c => {
            const friendUid = c.participantUids[0]
            const friendName = friends.find(f => f.uid === friendUid)?.displayName ?? friendUid
            const status = c.perUserStatus[friendUid] ?? 'pending'
            const STATUS_META: Record<string, { label: string; color: string }> = {
              pending:  { label: 'Pending',            color: 'var(--text3)' },
              accepted: { label: 'Accepted — pending',  color: 'var(--amber)' },
              declined: { label: 'Declined',            color: 'var(--red)'  },
              done:     { label: 'Completed ✓',         color: 'var(--green)' },
            }
            const meta = STATUS_META[status] ?? STATUS_META.pending
            return (
              <div key={c.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
                <span className="flex-1">
                  &ldquo;{c.title}&rdquo; → {friendName}
                  {c.type === 'goal' && (
                    <span className="text-[var(--text3)]"> · goal · {c.checklist?.length ?? 0} tasks{c.endDate ? ` · by ${c.endDate}` : ''}</span>
                  )}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: meta.color, background: `${meta.color}1a` }}>
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
        Your friends ({friends.length}/{FRIEND_SOFT_CAP})
      </div>
      {!loaded && <div className="text-[12px] text-[var(--text3)] py-3 text-center">Loading…</div>}
      {loaded && friends.length === 0 && (
        <div className="text-[12px] text-[var(--text3)] py-3 text-center">No friends added yet.</div>
      )}
      {friends.map(f => (
        <FriendRow
          key={f.uid}
          friend={f}
          onSetTags={tags => setTags(f.uid, tags)}
          onRemove={() => remove(f.uid)}
          onSetThreshold={amount => setThresholdFor(f.uid, amount)}
        />
      ))}
    </div>
  )
}

function FriendRow({ friend, onSetTags, onRemove, onSetThreshold }: {
  friend: { uid: string; displayName: string; tags: FriendTag[]; isNotary: boolean; rewardApprovalThreshold?: number }
  onSetTags: (tags: FriendTag[]) => void
  onRemove: () => void
  onSetThreshold: (amount: number) => void
}) {
  const [thresholdInput, setThresholdInput] = useState(String(friend.rewardApprovalThreshold ?? ''))
  const [confirmOpen, setConfirmOpen] = useState(false)

  function toggleTag(tag: FriendTag) {
    const has = friend.tags.includes(tag)
    onSetTags(has ? friend.tags.filter(t => t !== tag) : [...friend.tags, tag])
  }

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium">{friend.displayName}</span>
        <button onClick={() => setConfirmOpen(true)} className="text-[11px] text-[var(--red)]">Remove</button>
      </div>
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Remove friend?">
        <p className="text-sm text-[var(--text2)] mb-3">
          Remove {friend.displayName}? This only removes them from your own list — any validations, challenges, or reward approvals already in progress with them aren&apos;t affected, and they can re-add you later with your friend code.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button
            onClick={() => { onRemove(); setConfirmOpen(false) }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red)]"
          >
            Remove
          </button>
        </div>
      </Modal>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {FRIEND_TAGS.map(tag => {
          const active = friend.tags.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-[10px] px-2 py-1 rounded-full border ${
                active
                  ? 'bg-[var(--purple)] text-white border-[var(--purple)]'
                  : 'border-[var(--border2)] text-[var(--text3)]'
              }`}
            >
              {FRIEND_TAG_META[tag].label}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[var(--text3)]">
        <span>Approval threshold if they pick you as Notary:</span>
        <input
          type="number"
          value={thresholdInput}
          onChange={e => setThresholdInput(e.target.value)}
          onBlur={() => { const n = Number(thresholdInput); if (!Number.isNaN(n) && n >= 0) onSetThreshold(n) }}
          className="w-20 px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
          placeholder="e.g. 100"
        />
        pts
      </div>
    </div>
  )
}
