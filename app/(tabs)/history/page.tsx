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
  loading: () => <div className="text-[12px] text-[var(--text3)] py-4 text-center">Loading charts…</div>,
})

const EOD_LABELS: Record<string, string> = {
  motivated: '⚡ Motivated', proud: '💪 Proud', content: '😌 Content', neutral: '😐 Neutral',
  tired: '😴 Tired', frustrated: '😤 Frustrated', anxious: '😰 Anxious', sad: '😢 Sad',
}

const PAGE_SIZE = 8

export default function HistoryPage() {
  const history     = usePlannerStore(s => s.history)
  const redemptions = usePlannerStore(s => s.rewardRedemptions)
  const sorted  = [...history].reverse()
  const { page, totalPages, pageItems, hasPrev, hasNext, prevPage, nextPage } = usePagination(sorted, PAGE_SIZE)

  return (
    <div>
      {FLAGS.HISTORY_CHART && <HistoryChartsSection />}
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Completion log</div>
      {sorted.length === 0 && (
        <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No history yet. Submit your first day.</div>
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
          title={
            <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden text-[12px] sm:text-[13px]">
              <span className="font-semibold whitespace-nowrap">{formatDateShort(e.date)}</span>
              <span className="text-[var(--text2)] whitespace-nowrap">{e.done}/{e.total}</span>
              {e.eodMood && <span className="text-[var(--text3)] truncate">{EOD_LABELS[e.eodMood]}</span>}
              <span className="font-semibold text-[var(--green)] whitespace-nowrap ml-auto">+{e.rxp}XP</span>
            </div>
          }
        >
          {dayTasks.length > 0 && (
            <Accordion title={`📋 Tasks (${e.done}/${e.total})`}>
              <div className="space-y-1">
                {dayTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs">
                    <span className={t.done ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{t.done ? '✓' : '✗'}</span>
                    <span className={`flex-1 ${t.done ? '' : 'text-[var(--text3)]'}`}>{t.title}</span>
                    <span className="text-[var(--text3)]">{t.priority}{t.level ? ` · ${t.level}` : ''}</span>
                    {t.completedAt && <span className="text-[10px] text-[var(--green)]">{new Date(t.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
                  </div>
                ))}
              </div>
            </Accordion>
          )}
          <Accordion title={`🎁 Rewards redeemed (${dayRewards.length})`}>
            {dayRewards.length === 0 ? (
              <p className="text-xs text-[var(--text3)] py-1">None redeemed this day.</p>
            ) : (
              <div className="space-y-1">
                {dayRewards.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-[var(--green)] py-1">
                    <span>🎁 {r.title}</span>
                    {r.cost != null && <span className="text-[var(--text3)]">-{r.cost} 🪙</span>}
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
