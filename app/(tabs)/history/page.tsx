'use client'
import dynamic              from 'next/dynamic'
import { usePlannerStore }  from '@/store'
import { Accordion }        from '@/ui/Accordion'
import { Pagination }       from '@/ui/Pagination'
import { usePagination }    from '@/hooks/usePagination'
import { formatDateShort }  from '@/lib/engine/cutoff'
import { FLAGS }            from '@/constants/feature-flags'

const HistoryChartsSection = dynamic(() => import('@/features/history/components/HistoryChartsSection'), {
  ssr: false,
  loading: () => <div className="text-[12px] py-4 text-center" style={{ color: 'var(--vx-fg-4)' }}>Loading charts…</div>,
})

const EOD_LABELS: Record<string, string> = {
  motivated: '⚡ Motivated', proud: '💪 Proud', content: '😌 Content', neutral: '😐 Neutral',
  tired: '😴 Tired', frustrated: '😤 Frustrated', anxious: '😰 Anxious', sad: '😢 Sad',
}
const AM_MOOD_LABELS: Record<string, string> = { motivated: '⚡ Motivated', neutral: '😐 Neutral', sick: '🤒 Sick' }
const SLEEP_LABELS: Record<string, string> = { poor: '😩 Poor sleep', ok: '😐 OK sleep', great: '😴 Great sleep' }

const PAGE_SIZE = 6

export default function HistoryPage() {
  const history     = usePlannerStore(s => s.history)
  const redemptions = usePlannerStore(s => s.rewardRedemptions)
  const amMood       = usePlannerStore(s => s.mood)
  const focusCheckins = usePlannerStore(s => s.focusCheckins)
  const lifestyleCheckins = usePlannerStore(s => s.lifestyleCheckins)
  const sorted  = [...history].reverse()
  const { page, totalPages, pageItems, hasPrev, hasNext, prevPage, nextPage } = usePagination(sorted, PAGE_SIZE)

  return (
    <div>
      {FLAGS.HISTORY_CHART && <HistoryChartsSection />}
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vx-fg-4)' }}>Completion log</div>
      {sorted.length === 0 && (
        <div className="text-[13px] py-3.5 text-center" style={{ color: 'var(--vx-fg-4)' }}>No history yet. Submit your first day.</div>
      )}
      {pageItems.map(e => {
        const dayTasks   = e.tasks ?? []
        const dayRewards = [
          ...(e.rewards ?? []).map(title => ({ title, cost: null as number | null })),
          ...redemptions.filter(r => r.date === e.date).map(r => ({ title: r.title, cost: r.cost })),
        ]
        return (
        <Accordion
          key={e.date}
          variant="vx"
          title={
            <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden text-[12px] sm:text-[13px]">
              <span className="font-semibold whitespace-nowrap">{formatDateShort(e.date)}</span>
              <span className="whitespace-nowrap" style={{ color: 'var(--vx-fg-3)' }}>{e.done}/{e.total}</span>
              {e.eodMood && <span className="truncate" style={{ color: 'var(--vx-fg-4)' }}>{EOD_LABELS[e.eodMood]}</span>}
              <span className="font-semibold whitespace-nowrap ml-auto" style={{ color: 'var(--vx-emerald)' }}>+{e.rxp}XP</span>
            </div>
          }
        >
          {dayTasks.length > 0 && (
            <Accordion variant="vx" title={`📋 Tasks (${e.done}/${e.total})`}>
              <div className="space-y-1">
                {dayTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs">
                    <span style={{ color: t.done ? 'var(--vx-emerald)' : 'var(--red)' }}>{t.done ? '✓' : '✗'}</span>
                    <span className="flex-1" style={{ color: t.done ? 'var(--vx-fg-1)' : 'var(--vx-fg-4)' }}>{t.title}</span>
                    <span style={{ color: 'var(--vx-fg-4)' }}>{t.priority}{t.level ? ` · ${t.level}` : ''}</span>
                    {t.completedAt && <span className="text-[10px]" style={{ color: 'var(--vx-emerald)' }}>{new Date(t.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
                  </div>
                ))}
              </div>
            </Accordion>
          )}
          {(() => {
            const focus = focusCheckins[e.date]
            const life  = lifestyleCheckins[e.date]
            const am    = amMood[e.date]
            const chips: string[] = []
            if (am) chips.push(AM_MOOD_LABELS[am] ?? am)
            if (life?.sleep) chips.push(SLEEP_LABELS[life.sleep])
            if (life?.moved !== undefined) chips.push(life.moved ? '🏃 Moved' : '🛋️ No movement')
            if (life?.stress) chips.push(`😖 Stress ${life.stress}/5`)
            if (focus?.score) chips.push(`🧠 Focus ${focus.score}/5`)
            if (chips.length === 0) return null
            return (
              <Accordion variant="vx" title="🧭 Check-in">
                <div className="flex flex-wrap gap-1.5 py-1">
                  {chips.map((c, i) => (
                    <span key={i} className="vx-chip text-[11px]">{c}</span>
                  ))}
                </div>
              </Accordion>
            )
          })()}
          <Accordion variant="vx" title={`🎁 Rewards redeemed (${dayRewards.length})`}>
            {dayRewards.length === 0 ? (
              <p className="text-xs py-1" style={{ color: 'var(--vx-fg-4)' }}>None redeemed this day.</p>
            ) : (
              <div className="space-y-1">
                {dayRewards.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1" style={{ color: 'var(--vx-emerald)' }}>
                    <span>🎁 {r.title}</span>
                    {r.cost != null && <span style={{ color: 'var(--vx-fg-4)' }}>-{r.cost} 🪙</span>}
                  </div>
                ))}
              </div>
            )}
          </Accordion>
        </Accordion>
        )
      })}
      <Pagination page={page} totalPages={totalPages} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
    </div>
  )
}
