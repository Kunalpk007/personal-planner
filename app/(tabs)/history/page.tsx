'use client'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { formatDate }      from '@/lib/engine/cutoff'

const MOOD_LABELS: Record<string, string> = {
  motivated: '⚡ Motivated', neutral: '😐 Neutral', sick: '🤒 Sick',
}
const EOD_LABELS: Record<string, string> = {
  motivated: '⚡ Motivated', neutral: '😐 Neutral', tired: '😤 Tired', content: '😌 Content',
}

export default function HistoryPage() {
  const history     = usePlannerStore(s => s.history)
  const redemptions = usePlannerStore(s => s.rewardRedemptions)
  const sorted  = [...history].reverse().slice(0, 60)

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Completion log</div>
      {sorted.length === 0 && (
        <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No history yet. Submit your first day.</div>
      )}
      {sorted.map(e => {
        const dayTasks   = e.tasks ?? []
        const dayRewards = [
          ...(e.rewards ?? []).map(title => ({ title, cost: null as number | null })),
          ...redemptions.filter(r => r.date === e.date).map(r => ({ title: r.title, cost: r.cost })),
        ]
        return (
        <Accordion
          key={e.date}
          title={
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="font-semibold min-w-[160px]">
                {formatDate(e.date)}
                {e.auto && <span className="ml-1.5 text-[10px] text-[var(--amber)] bg-[var(--amber-bg)] px-1.5 py-0.5 rounded">Auto</span>}
                {e.late && <span className="ml-1.5 text-[10px] text-[var(--red)] bg-[var(--red-bg)] px-1.5 py-0.5 rounded">Late</span>}
              </span>
              <span className="text-xs text-[var(--text2)]">{e.done}/{e.total}</span>
              {e.mood    && <span className="text-[11px] text-[var(--text3)]">{MOOD_LABELS[e.mood]}</span>}
              {e.eodMood && <span className="text-[11px] text-[var(--text3)]">→{EOD_LABELS[e.eodMood]}</span>}
              <span className="text-[13px] font-semibold text-[var(--green)]">+{e.rxp} RXP</span>
              {e.frozen && <span className="text-[var(--blue)]">❄</span>}
              {e.rest   && <span className="text-[var(--amber)]">🟡</span>}
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
    </div>
  )
}
