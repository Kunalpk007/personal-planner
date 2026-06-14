'use client'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { isWeekend }       from '@/lib/engine/cutoff'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function dayIcon(e: { date: string; mood?: string; pct: number; frozen: boolean; rest: boolean }) {
  if (e.frozen) return '❄'
  if (e.rest) return '🟡'
  if (e.mood === 'sick') return '🤒'
  if (isWeekend(e.date)) return '🌤'
  if (e.pct >= 100) return '✅'
  return '⚠'
}

export function StreakHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const history = usePlannerStore(s => s.history)

  const months = new Map<string, typeof history>()
  for (const e of [...history].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = e.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key)!.push(e)
  }

  return (
    <Modal open={open} onClose={onClose} title="🔥 Streak History">
      <div className="text-[11px] text-[var(--text2)] mb-3 flex flex-wrap gap-3">
        <span>✅ Complete</span>
        <span>🟡 Rest day</span>
        <span>❄ Freeze used</span>
        <span>🤒 Sick</span>
        <span>🌤 Light day</span>
        <span>⚠ Missed</span>
      </div>
      {months.size === 0 && (
        <p className="text-sm text-[var(--text3)] py-2">No history yet.</p>
      )}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {[...months.entries()].map(([key, entries]) => {
          const [y, m] = key.split('-')
          return (
            <div key={key}>
              <div className="text-xs font-semibold text-[var(--text2)] mb-1.5">{MONTHS[+m - 1]} {y}</div>
              <div className="flex flex-wrap gap-1.5">
                {[...entries].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                  <div
                    key={e.date}
                    title={e.date}
                    className="flex flex-col items-center justify-center w-9 h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[13px]"
                  >
                    <span>{dayIcon(e)}</span>
                    <span className="text-[9px] text-[var(--text3)] leading-none">{+e.date.slice(8, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
