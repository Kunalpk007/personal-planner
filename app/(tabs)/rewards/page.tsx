'use client'
import { useState }        from 'react'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { FREEZE_COST }     from '@/constants/points'

export default function RewardsPage() {
  const rewards      = usePlannerStore(s => s.rewards)
  const wallet       = usePlannerStore(s => s.rewardWallet)
  const freezeTokens = usePlannerStore(s => s.freezeTokens)
  const freezesBought= usePlannerStore(s => s.freezesBought)
  const redeemReward = usePlannerStore(s => s.redeemReward)
  const addReward    = usePlannerStore(s => s.addReward)
  const removeReward = usePlannerStore(s => s.removeReward)
  const buyFreeze    = usePlannerStore(s => s.buyFreeze)

  const [buyOpen,  setBuyOpen]  = useState(false)
  const [title,    setTitle]    = useState('')
  const [cost,     setCost]     = useState(15)
  const today = new Date().toISOString().slice(0, 10)

  function handleRedeem(id: string) {
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

      <div className="mb-4">
        {rewards.map(r => {
          const ok = wallet >= r.cost
          return (
            <div key={r.id} className={`flex items-center gap-2.5 p-3 rounded-[10px] border mb-2 ${ok ? 'border-[var(--green-mid)]' : 'border-[var(--border)]'} bg-[var(--bg)]`}>
              <span className="flex-1 text-[13px]">{r.title}</span>
              <span className={`text-xs font-semibold whitespace-nowrap ${ok ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>{r.cost} pts</span>
              <button onClick={() => handleRedeem(r.id)} disabled={!ok}
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
          <button onClick={() => { if (!title.trim() || cost < 15) { showToast('Min cost: 15 pts.'); return }; addReward({ title: title.trim(), cost }); setTitle(''); setCost(15); showToast('Reward added.') }}
            className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
            + Add
          </button>
        </div>
        <div className="text-[11px] text-[var(--text3)] mt-1">Min cost: 15 reward pts</div>
      </div>

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
