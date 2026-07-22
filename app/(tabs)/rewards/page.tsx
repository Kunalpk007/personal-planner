'use client'
import { useState, useEffect }        from 'react'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { FREEZE_COST }     from '@/constants/points'
import { FLAGS }           from '@/constants/feature-flags'
import { useSocialStore }  from '@/store/social/social.store'
import { decideApprovalGate, cooldownEndsAt } from '@/lib/engine/rewardApproval'
import { uid as genId }    from '@/lib/engine/cutoff'
import { PendingApprovalsPanel } from '@/features/rewards/components/PendingApprovalsPanel'

export default function RewardsPage() {
  const rewards      = usePlannerStore(s => s.rewards)
  const wallet       = usePlannerStore(s => s.rewardWallet)
  const freezeTokens = usePlannerStore(s => s.freezeTokens)
  const freezesBought= usePlannerStore(s => s.freezesBought)
  const redeemReward = usePlannerStore(s => s.redeemReward)
  const addReward    = usePlannerStore(s => s.addReward)
  const removeReward = usePlannerStore(s => s.removeReward)
  const buyFreeze    = usePlannerStore(s => s.buyFreeze)
  const requestRewardApprovalLocal = usePlannerStore(s => s.requestRewardApproval)

  const friends = useSocialStore(s => s.friends)
  const socialUid = useSocialStore(s => s.uid)
  const notaries = friends.filter(f => f.tags.includes('notary'))
  const [notaryUid, setNotaryUid] = useState('')
  const [notaryThreshold, setNotaryThreshold] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!notaryUid) { setNotaryThreshold(undefined); return }
    useSocialStore.getState().getThresholdFrom(notaryUid).then(setNotaryThreshold)
  }, [notaryUid])

  const [buyOpen,  setBuyOpen]  = useState(false)
  const [title,    setTitle]    = useState('')
  const [cost,     setCost]     = useState(15)
  const [habitLinked, setHabitLinked] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<{ id: string; title: string; cost: number; habitLinked?: boolean; habitCooldownHours?: number } | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  function handleRedeem(id: string) {
    const reward = rewards.find(r => r.id === id)
    if (!reward) return
    const gate = FLAGS.FRIENDS ? decideApprovalGate(reward, notaryThreshold) : null

    if (gate && notaryUid) {
      const notary = notaries.find(f => f.uid === notaryUid)
      requestRewardApprovalLocal({
        id: genId(), rewardId: id, title: reward.title, cost: reward.cost, gate,
        notaryUid, notaryName: notary?.displayName ?? 'Notary',
        createdAt: new Date().toISOString(), cooldownEndsAt: cooldownEndsAt(gate, reward),
      })
      if (socialUid) {
        import('@/lib/firebase/social').then(m => m.requestRewardApproval(socialUid, notaryUid, reward.title, reward.cost, gate))
      }
      showToast(`Sent to ${notary?.displayName ?? 'your Notary'} for approval — pts locked until resolved.`)
      return
    }

    const ok = redeemReward(id, today)
    if (ok) showToast('🎁 Reward redeemed!')
    else    showToast('Not enough wallet pts.')
  }

  const canBuyFreeze = wallet >= FREEZE_COST && freezesBought < 2

  function handleBuy() {
    const ok = buyFreeze()
    if (ok) showToast('❄ Freeze purchased! Tokens: ' + (freezeTokens + 1))
    else if (freezesBought >= 2) showToast('Holding 2 purchased freezes. Use one first.')
    else showToast(`Need ${FREEZE_COST} wallet pts. Have ${wallet}.`)
    setBuyOpen(false)
  }

  return (
    <div>
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <span className="wallet-chip">🪙 Wallet: <span className="ml-1">{wallet}</span> pts</span>
        <button onClick={() => setBuyOpen(true)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--blue-bg)] text-[var(--blue)] border border-[#4A9EE0]">
          ❄ Buy Streak Freeze
        </button>
      </div>
      <div className="text-[11px] bg-[var(--bg3)] text-[var(--text2)] px-2.5 py-1 rounded-full border border-[var(--border)] inline-block mb-3">
        Redeem from your wallet anytime. Earns 1 pt per 2 task pts.
      </div>

      {FLAGS.FRIENDS && notaries.length > 0 && (
        <div className="text-[12px] mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[var(--text3)]">Notary for gated redemptions:</span>
          <select
            value={notaryUid}
            onChange={e => setNotaryUid(e.target.value)}
            className="text-[12px] px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
          >
            <option value="">None selected</option>
            {notaries.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
          </select>
          {notaryUid && (
            <span className="text-[11px] text-[var(--text3)]">
              {notaryThreshold != null ? `Threshold: ${notaryThreshold} pts` : 'No threshold set yet — cost gate inactive'}
            </span>
          )}
        </div>
      )}

      <PendingApprovalsPanel />

      <div className="mb-4">
        {rewards.map(r => {
          const ok = wallet >= r.cost
          return (
            <div key={r.id} className={`flex items-center gap-2.5 p-3 rounded-[10px] border mb-2 ${ok ? 'border-[var(--green-mid)]' : 'border-[var(--border)]'} bg-[var(--bg)]`}>
              <span className="flex-1 text-[13px]">
                {r.title}
                {r.habitLinked && <span className="ml-1.5 text-[10px] text-[var(--purple)]" title="Habit-linked — always gets a cooldown before it redeems">⏳</span>}
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${ok ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>{r.cost} pts</span>
              <button onClick={() => setRedeemTarget({ id: r.id, title: r.title, cost: r.cost, habitLinked: r.habitLinked, habitCooldownHours: r.habitCooldownHours })} disabled={!ok}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-35 ${ok ? 'bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-mid)]' : 'bg-[var(--bg2)] border-[var(--border2)] text-[var(--text2)]'}`}>
                Redeem
              </button>
              <button onClick={() => removeReward(r.id)} className="btn-icon danger">×</button>
            </div>
          )
        })}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Custom reward</div>
      <div className="card">
        <div className="flex gap-2 flex-wrap items-center">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reward name..."
            className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
          <input type="number" value={cost} onChange={e => setCost(+e.target.value)} min={15} style={{ width: 80 }}
            className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
          <button onClick={() => { if (!title.trim() || cost < 15) { showToast('Min cost: 15 pts.'); return }; addReward({ title: title.trim(), cost, habitLinked }); setTitle(''); setCost(15); setHabitLinked(false); showToast('Reward added.') }}
            className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
            + Add Reward
          </button>
        </div>
        {FLAGS.FRIENDS && (
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--text3)] mt-2 cursor-pointer">
            <input type="checkbox" checked={habitLinked} onChange={e => setHabitLinked(e.target.checked)} />
            Linked to a habit I&apos;m trying to reduce (always gets a cooldown before it redeems, regardless of cost)
          </label>
        )}
        <div className="text-[11px] text-[var(--text3)] mt-1">Min cost: 15 reward pts</div>
      </div>

      {/* Redeem confirmation */}
      <Modal open={!!redeemTarget} onClose={() => setRedeemTarget(null)} title="🎁 Redeem Reward">
        {redeemTarget && (
          <>
            <p className="text-sm text-[var(--text2)] mb-3">
              Redeem <strong>{redeemTarget.title}</strong> for <strong>{redeemTarget.cost} pts</strong>? This will be deducted from your wallet.
            </p>
            {FLAGS.FRIENDS && redeemTarget.habitLinked && (
              <p className="text-xs text-[var(--purple)] mb-3">⏳ This reward is habit-linked — it won&apos;t finalize for {redeemTarget.habitCooldownHours ?? 12}h, during which your Notary can reject it.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRedeemTarget(null)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
              <button
                onClick={() => { handleRedeem(redeemTarget.id); setRedeemTarget(null) }}
                className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]"
              >
                Redeem
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={buyOpen} onClose={() => setBuyOpen(false)} title="❄ Buy Streak Freeze">
        <p className="text-sm text-[var(--text2)] mb-2">Spend <strong>{FREEZE_COST} reward pts</strong> from your wallet.</p>
        <p className="text-xs text-[var(--text3)] mb-3">Max 2 purchased at a time. Milestone freezes stack beyond this cap.</p>
        <div className="bg-[var(--bg2)] rounded-lg p-3 mb-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span>Wallet balance</span><strong>{wallet}</strong></div>
          <div className="flex justify-between"><span>Purchased freezes held</span><strong>{freezesBought ?? 0}</strong></div>
          <div className="flex justify-between"><span>Total freeze tokens</span><strong>{freezeTokens}</strong></div>
        </div>
        {!canBuyFreeze && freezesBought < 2 && (
          <p className="text-xs text-[var(--amber)] mb-3">
            Need {Math.max(0, FREEZE_COST - wallet)} more wallet pts to buy a freeze.
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setBuyOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button
            onClick={handleBuy}
            disabled={!canBuyFreeze}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--blue-bg)] text-[var(--blue)] border border-[#4A9EE0] disabled:opacity-35"
          >
            {wallet < FREEZE_COST ? `Need ${FREEZE_COST} pts (have ${wallet})` : `Buy 1 freeze (${FREEZE_COST} pts)`}
          </button>
        </div>
      </Modal>
    </div>
  )
}
