'use client'
import { usePlannerStore } from '@/store'
import { useSocialStore } from '@/store/social/social.store'
import { showToast } from '@/ui/Toast'
import { FLAGS } from '@/constants/feature-flags'

/** Shows the requester's own gated redemptions still awaiting a decision.
 *  No auto-force-approve anywhere in this UI (see docs/PHASE2_SOCIAL_LIFE_OS.md
 *  Section 6.4) — the only ways out of a stuck request are the two explicit
 *  actions here: cancel (instant refund) or reassign to a different Notary
 *  (restarts the cooldown). */
export function PendingApprovalsPanel() {
  const pending = usePlannerStore(s => s.pendingRewardApprovals)
  const cancelPendingApproval = usePlannerStore(s => s.cancelPendingApproval)
  const reassignPendingApproval = usePlannerStore(s => s.reassignPendingApproval)
  const friends = useSocialStore(s => s.friends)
  const notaries = friends.filter(f => f.tags.includes('notary'))

  const active = pending.filter(a => a.status === 'pending')
  if (!FLAGS.FRIENDS || active.length === 0) return null

  async function handleCancel(id: string) {
    cancelPendingApproval(id)
    try {
      const { cancelRewardApproval } = await import('@/lib/firebase/social')
      await cancelRewardApproval(id)
    } catch {}
    showToast('Redemption cancelled — pts refunded.')
  }

  async function handleReassign(id: string, newUid: string) {
    const notary = notaries.find(f => f.uid === newUid)
    if (!notary) return
    const cooldownEndsAt = new Date(new Date().getTime() + 48 * 60 * 60 * 1000).toISOString()
    reassignPendingApproval(id, newUid, notary.displayName, cooldownEndsAt)
    try {
      const { reassignRewardApproval } = await import('@/lib/firebase/social')
      await reassignRewardApproval(id, newUid)
    } catch {}
    showToast(`Reassigned to ${notary.displayName}.`)
  }

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] p-3 mb-3">
      <div className="text-[12px] font-medium mb-2">Awaiting approval</div>
      {active.map(a => (
        <div key={a.id} className="flex items-center gap-2 flex-wrap py-1.5 text-[12px]">
          <span className="flex-1">{a.title} — {a.cost} pts</span>
          <span className="text-[var(--text3)]">via {a.notaryName}, until {new Date(a.cooldownEndsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={() => handleCancel(a.id)} className="text-[11px] px-2 py-1 rounded-full border border-[var(--border2)] text-[var(--red)]">Cancel</button>
          {notaries.length > 1 && (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) handleReassign(a.id, e.target.value) }}
              className="text-[11px] px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none"
            >
              <option value="">Reassign to…</option>
              {notaries.filter(f => f.uid !== a.notaryUid).map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}
