'use client'
import { useRouter } from 'next/navigation'
import { useDayKey } from '@/hooks/useDayKey'
import { useHabit100Bootstrap } from '@/hooks/useHabit100Bootstrap'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { HistoryView } from '@/features/habit100/HistoryView'

export default function Habit100HistoryPage() {
  const router = useRouter()
  const { today } = useDayKey()
  useHabit100Bootstrap()
  const meta = useHabit100Store(s => s.meta)
  const archivedRuns = useHabit100Store(s => s.archivedRuns)

  return (
    <div className="pb-20">
      <button onClick={() => router.push('/habit100')} className="vx-btn vx-btn-ghost text-xs mb-3" style={{ display: 'inline-flex' }}>
        ← Home
      </button>
      {meta || archivedRuns.length > 0 ? <HistoryView today={today} /> : (
        <p className="text-[13px]" style={{ color: 'var(--vx-fg-3)' }}>Set up the Consistency Tracker from Home first.</p>
      )}
    </div>
  )
}
