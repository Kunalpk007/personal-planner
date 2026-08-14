'use client'
import { useState, useEffect }        from 'react'
import { motion } from 'framer-motion'
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
  const [redeemedReceipt, setRedeemedReceipt] = useState<{ title: string; cost: number } | null>(null)
  const rewardRedemptions = usePlannerStore(s => s.rewardRedemptions)
  const today = new Date().toISOString().slice(0, 10)

  const redeemedTodayTitles = new Set(
    rewardRedemptions.filter(r => r.date === today).map(r => r.title)
  )
  const availableRewards = rewards.filter(r => !redeemedTodayTitles.has(r.title))
  const redeemedToday = rewards.filter(r => redeemedTodayTitles.has(r.title))

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
    if (ok) { showToast('🎁 Reward redeemed!'); setRedeemedReceipt({ title: reward.title, cost: reward.cost }) }
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
    <div className="pt-3 sm:pt-0">
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <span className="vx-chip" data-tone="amber" style={{ fontSize: 13, padding: '6px 14px' }}>🪙 Wallet: <span className="ml-1 font-bold">{wallet}</span> pts</span>
        <button onClick={() => setBuyOpen(true)} className="vx-pill vx-tinted text-xs" data-tone="cyan">
          {freezeTokens} ❄ Buy Streak Freeze
        </button>
      </div>
      <div className="vx-chip inline-block mb-3" data-tone="neutral" style={{ fontWeight: 400 }}>
        Redeem from your wallet anytime. Earns 1 pt per 2 task pts.
      </div>

      {FLAGS.FRIENDS && notaries.length > 0 && (
        <div className="text-[12px] mb-3 flex items-center gap-2 flex-wrap">
          <span style={{ color: 'var(--vx-fg-4)' }}>Notary for gated redemptions:</span>
          <select
            value={notaryUid}
            onChange={e => setNotaryUid(e.target.value)}
            className="vx-field text-[12px] px-2 py-1 w-auto"
          >
            <option value="">None selected</option>
            {notaries.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
          </select>
          {notaryUid && (
            <span className="text-[11px]" style={{ color: 'var(--vx-fg-4)' }}>
              {notaryThreshold != null ? `Threshold: ${notaryThreshold} pts` : 'No threshold set yet — cost gate inactive'}
            </span>
          )}
        </div>
      )}

      <PendingApprovalsPanel />

      <div className="mb-4">
        {availableRewards.map(r => {
          const ok = wallet >= r.cost
          return (
            <motion.div layout key={r.id} className="vx-tile vx-accent-l flex items-center gap-2.5 mb-2" data-tone={ok ? 'cyan' : undefined}>
              <span className="flex-1 text-[13px]">
                {r.title}
                {r.habitLinked && <span className="ml-1.5 text-[10px]" style={{ color: 'var(--vx-violet)' }} title="Habit-linked — always gets a cooldown before it redeems">⏳</span>}
              </span>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: ok ? 'var(--vx-emerald)' : 'var(--vx-fg-4)' }}>{r.cost} pts</span>
              <button onClick={() => setRedeemTarget({ id: r.id, title: r.title, cost: r.cost, habitLinked: r.habitLinked, habitCooldownHours: r.habitCooldownHours })} disabled={!ok}
                className={`vx-btn text-xs ${ok ? 'vx-btn-primary' : 'vx-btn-ghost'}`}>
                Redeem
              </button>
              <button onClick={() => removeReward(r.id)} className="vx-btn vx-btn-icon vx-danger">×</button>
            </motion.div>
          )
        })}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vx-fg-4)' }}>Custom reward</div>
      <div className="vx-tile p-3.5">
        <div className="flex gap-2 flex-wrap items-center">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Reward name..."
            className="flex-1 min-w-[160px] vx-field" />
          <input type="number" value={cost} onChange={e => setCost(+e.target.value)} min={15} style={{ width: 80 }}
            className="vx-field" />
          <button onClick={() => { if (!title.trim() || cost < 15) { showToast('Min cost: 15 pts.'); return }; addReward({ title: title.trim(), cost, habitLinked }); setTitle(''); setCost(15); setHabitLinked(false); showToast('Reward added.') }}
            className="vx-btn vx-btn-primary text-xs">
            + Add Reward
          </button>
        </div>
        {FLAGS.FRIENDS && (
          <label className="flex items-center gap-1.5 text-[11px] mt-2 cursor-pointer" style={{ color: 'var(--vx-fg-4)' }}>
            <input type="checkbox" checked={habitLinked} onChange={e => setHabitLinked(e.target.checked)} />
            Linked to a habit I&apos;m trying to reduce (always gets a cooldown before it redeems, regardless of cost)
          </label>
        )}
        <div className="text-[11px] mt-1" style={{ color: 'var(--vx-fg-4)' }}>Min cost: 15 reward pts</div>
      </div>

      {redeemedToday.length > 0 && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: 'var(--vx-fg-4)' }}>Redeemed today</div>
          <div className="mb-4">
            {redeemedToday.map(r => (
              <div key={r.id} className="vx-tile flex items-center gap-2.5 mb-2 opacity-50">
                <span className="flex-1 text-[13px] line-through">{r.title}</span>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--vx-fg-4)' }}>{r.cost} pts</span>
                <span className="vx-chip" data-tone="neutral">
                  ✓ Redeemed
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Redemption receipt */}
      <Modal open={!!redeemedReceipt} onClose={() => setRedeemedReceipt(null)} title="🎉 Reward Redeemed" variant="vx">
        {redeemedReceipt && (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--vx-fg-2)' }}>
              <strong>{redeemedReceipt.title}</strong> redeemed for <strong>{redeemedReceipt.cost} pts</strong>.
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--vx-fg-4)' }}>Wallet balance: <strong>{wallet}</strong> pts.</p>
            <div className="flex justify-end">
              <button onClick={() => setRedeemedReceipt(null)} className="vx-btn vx-btn-primary text-sm">
                Done
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Redeem confirmation */}
      <Modal open={!!redeemTarget} onClose={() => setRedeemTarget(null)} title="🎁 Redeem Reward" variant="vx">
        {redeemTarget && (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--vx-fg-2)' }}>
              Redeem <strong>{redeemTarget.title}</strong> for <strong>{redeemTarget.cost} pts</strong>? This will be deducted from your wallet.
            </p>
            {FLAGS.FRIENDS && redeemTarget.habitLinked && (
              <p className="text-xs mb-3" style={{ color: 'var(--vx-violet)' }}>⏳ This reward is habit-linked — it won&apos;t finalize for {redeemTarget.habitCooldownHours ?? 12}h, during which your Notary can reject it.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRedeemTarget(null)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
              <button
                onClick={() => { handleRedeem(redeemTarget.id); setRedeemTarget(null) }}
                className="vx-btn vx-btn-primary text-sm"
              >
                Redeem
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={buyOpen} onClose={() => setBuyOpen(false)} title="❄ Buy Streak Freeze" variant="vx">
        <p className="text-sm mb-2" style={{ color: 'var(--vx-fg-2)' }}>Spend <strong>{FREEZE_COST} reward pts</strong> from your wallet.</p>
        <p className="text-xs mb-3" style={{ color: 'var(--vx-fg-4)' }}>Max 2 purchased at a time. Milestone freezes stack beyond this cap.</p>
        <div className="vx-tile mb-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span>Wallet balance</span><strong>{wallet}</strong></div>
          <div className="flex justify-between"><span>Purchased freezes held</span><strong>{freezesBought ?? 0}</strong></div>
          <div className="flex justify-between"><span>Total freeze tokens</span><strong>{freezeTokens}</strong></div>
        </div>
        {!canBuyFreeze && freezesBought < 2 && (
          <p className="text-xs mb-3" style={{ color: 'var(--vx-amber)' }}>
            Need {Math.max(0, FREEZE_COST - wallet)} more wallet pts to buy a freeze.
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setBuyOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleBuy}
            disabled={!canBuyFreeze}
            className="vx-btn vx-btn-cyan text-sm"
          >
            {wallet < FREEZE_COST ? `Need ${FREEZE_COST} pts (have ${wallet})` : `Buy 1 freeze (${FREEZE_COST} pts)`}
          </button>
        </div>
      </Modal>
    </div>
  )
}
