'use client'
import { useRouter } from 'next/navigation'
import { useDayKey } from '@/hooks/useDayKey'
import { useHabit100Bootstrap } from '@/hooks/useHabit100Bootstrap'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { ProgressView } from '@/features/habit100/ProgressView'

export default function Habit100ProgressPage() {
  const router = useRouter()
  const { today } = useDayKey()
  useHabit100Bootstrap()
  const meta = useHabit100Store(s => s.meta)

  return (
    <div className="pb-20">
      <button onClick={() => router.push('/habit100')} className="vx-btn vx-btn-ghost text-xs mb-3" style={{ display: 'inline-flex' }}>
        ← Home
      </button>
      {meta ? <ProgressView today={today} /> : (
        <p className="text-[13px]" style={{ color: 'var(--vx-fg-3)' }}>Set up the Consistency Tracker from Home first.</p>
      )}
    </div>
  )
}
