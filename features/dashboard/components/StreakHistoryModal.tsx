'use client'
import { useState }       from 'react'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { isWeekend, getWeekMonday, formatDate } from '@/lib/engine/cutoff'
import { getMinPts }       from '@/lib/engine/scoring'
import { useDayKey }       from '@/hooks/useDayKey'
import type { AppConfig, HistoryEntry } from '@/store/types'

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function dayAbbr(dateStr: string): string {
  return SHORT_DAY[new Date(`${dateStr}T12:00:00`).getDay()]
}

function dayIcon(e: HistoryEntry, cfg: AppConfig) {
  if (e.frozen) return '❄'
  if (e.rest) return '🟡'
  if (e.mood === 'sick') return '🤒'
  // ✅ = hit the weekday bar (70+), regardless of whether it's a weekend
  // 🌤 = weekend-only light pass: met the lower weekend bar (20+) but below 70
  const weekdayMin = cfg.minPts ?? 70
  const weekendMin = cfg.weekendPts ?? 20
  if (e.rxp >= weekdayMin) return '✅'
  if (isWeekend(e.date) && e.rxp >= weekendMin) return '🌤'
  return '⚠'
}

export function StreakHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { today }      = useDayKey()
  const history        = usePlannerStore(s => s.history)
  const cfg            = usePlannerStore(s => s.cfg)
  const isSettledToday = usePlannerStore(s => !!s.submittedDays[today])
  const streak         = usePlannerStore(s => s.streak)
  const restAvailable  = usePlannerStore(s => !s.weekRestUsed[getWeekMonday(today)])
  const freezeTokens   = usePlannerStore(s => s.freezeTokens)
  const useFreeze      = usePlannerStore(s => s.useFreeze)
  const declareRestDay = usePlannerStore(s => s.declareRestDay)

  const [restConfirmOpen, setRestConfirmOpen]     = useState(false)
  const [freezeConfirmOpen, setFreezeConfirmOpen] = useState(false)

  const months = new Map<string, typeof history>()
  for (const e of [...history].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = e.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key)!.push(e)
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="🔥 Streak History" variant="vx">
        {/* Today's Actions now leads the modal (was previously below the
            calendar, requiring a scroll to reach the actually-actionable
            part) — per explicit feedback that the useful buttons should be
            immediately visible on open. */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text3)] mb-0.5">Today&apos;s Actions</div>
          <button
            onClick={() => setRestConfirmOpen(true)}
            disabled={isSettledToday || !restAvailable || streak <= 0}
            className="vx-pill vx-tinted w-full text-left justify-start disabled:opacity-35"
            data-tone="amber"
          >
            🟡 Take Rest Day
            {streak <= 0 && <span className="block text-[11px] opacity-80 font-normal">No streak to protect</span>}
            {streak > 0 && !restAvailable && <span className="block text-[11px] opacity-80 font-normal">Already used this week</span>}
          </button>
          <button
            onClick={() => setFreezeConfirmOpen(true)}
            disabled={isSettledToday || freezeTokens <= 0 || streak <= 0}
            className="vx-pill vx-tinted w-full text-left justify-start disabled:opacity-35"
            data-tone="cyan"
          >
            ❄ Use Freeze
            {streak <= 0 && <span className="block text-[11px] opacity-80 font-normal">No streak to protect</span>}
            {streak > 0 && freezeTokens <= 0 && <span className="block text-[11px] opacity-80 font-normal">No freeze tokens available</span>}
          </button>
          {/* Always-visible freeze balance — previously only discoverable by
              hitting the disabled "no tokens" state on the button itself. */}
          <div className="text-[11px] text-[var(--text3)] pl-0.5">
            ❄ {freezeTokens} streak freeze{freezeTokens === 1 ? '' : 's'} available
          </div>
        </div>

        <div className="text-[11px] text-[var(--text2)] mb-3 flex flex-wrap gap-3 border-t border-[var(--vx-border)] pt-3">
          <span>✅ Complete</span>
          <span>🟡 Rest day</span>
          <span>❄ Freeze used</span>
          <span>🤒 Sick</span>
          <span>🌤 Weekend pass</span>
          <span>⚠ Missed</span>
        </div>
        {months.size === 0 && (
          <p className="text-sm text-[var(--text3)] py-2">No history yet.</p>
        )}
        <div className="space-y-3 max-h-[45vh] overflow-y-auto">
          {[...months.entries()].map(([key, entries]) => {
            const [y, m] = key.split('-')
            return (
              <div key={key}>
                <div className="text-xs font-semibold text-[var(--text2)] mb-1.5">{MONTHS[+m - 1]} {y}</div>
                <div className="vx-cal-grid">
                  {[...entries].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                    <div
                      key={e.date}
                      title={`${formatDate(e.date)} · ${e.rxp} pts`}
                      className="vx-cal-chip"
                    >
                      <span>{dayIcon(e, cfg)}</span>
                      <span className="text-[9px] text-[var(--text3)] leading-none font-medium">{+e.date.slice(8, 10)}</span>
                      <span className="text-[8px] text-[var(--text3)] leading-none">{dayAbbr(e.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <Modal open={restConfirmOpen} onClose={() => setRestConfirmOpen(false)} title="🟡 Take Rest Day" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">
          Streak is protected — unchanged. 1 rest day per week, resets Monday.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setRestConfirmOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--vx-border)] bg-transparent text-sm text-[var(--text2)]">Cancel</button>
          <button
            onClick={() => { declareRestDay(today); setRestConfirmOpen(false); onClose(); showToast('🟡 Rest day taken. Streak protected.') }}
            className="vx-pill vx-tinted"
            data-tone="amber"
          >
            Take Rest Day
          </button>
        </div>
      </Modal>

      {/* Freeze confirmation — previously fired immediately on click with no
          confirm step, unlike Rest Day which already had one. */}
      <Modal open={freezeConfirmOpen} onClose={() => setFreezeConfirmOpen(false)} title="❄ Use Freeze" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">
          Spend 1 of your {freezeTokens} streak freeze{freezeTokens === 1 ? '' : 's'} to protect today&apos;s streak? This can&apos;t be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setFreezeConfirmOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--vx-border)] bg-transparent text-sm text-[var(--text2)]">Cancel</button>
          <button
            onClick={() => { useFreeze(today); setFreezeConfirmOpen(false); onClose(); showToast('❄ Freeze used. Streak protected.') }}
            className="vx-pill vx-tinted"
            data-tone="cyan"
          >
            Use Freeze
          </button>
        </div>
      </Modal>
    </>
  )
}
