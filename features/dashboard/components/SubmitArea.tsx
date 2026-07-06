'use client'
import { useMemo, useState } from 'react'
import { usePlannerStore }  from '@/store'
import { Modal }            from '@/ui/Modal'
import { showToast }        from '@/ui/Toast'
import { todayEarned, getMoodAdjustedMinPts } from '@/lib/engine/scoring'
import { getDayKey }        from '@/lib/engine/cutoff'
import { getDailyQuote }    from '@/lib/engine/quotes'
import { writeBackupFile }  from '@/lib/persistence/fsBackup'
import type { HistoryEntry, EodMood } from '@/store/types'

const EOD_MOODS = [
  { key: 'motivated',  label: '⚡ Motivated',  style: { borderColor: '#639922', color: 'var(--green)' } },
  { key: 'proud',      label: '💪 Proud',      style: { borderColor: '#2563eb', color: '#2563eb' } },
  { key: 'content',    label: '😌 Content',    style: { borderColor: '#534AB7', color: 'var(--purple)' } },
  { key: 'neutral',    label: '😐 Neutral',    style: { borderColor: 'var(--border2)', color: 'var(--text2)' } },
  { key: 'tired',      label: '😴 Tired',      style: { borderColor: '#E24B4A', color: 'var(--red)' } },
  { key: 'frustrated', label: '😤 Frustrated', style: { borderColor: '#dc2626', color: '#dc2626' } },
  { key: 'anxious',    label: '😰 Anxious',    style: { borderColor: '#d97706', color: '#d97706' } },
  { key: 'sad',        label: '😢 Sad',        style: { borderColor: '#6b7280', color: '#6b7280' } },
]

export function SubmitArea({ today }: { today: string }) {
  const cfg          = usePlannerStore(s => s.cfg)
  const allTasks     = usePlannerStore(s => s.tasks)
  const tasks        = useMemo(() => allTasks.filter(t => t.date === today), [allTasks, today])
  const done         = tasks.filter(t => t.done)
  const mood         = usePlannerStore(s => s.mood[today])
  const isSubmitted  = usePlannerStore(s => !!s.submittedDays[today])
  const restUsed     = usePlannerStore(s => {
    const mon = today.slice(0, 8) + '01' // rough
    return Object.keys(s.weekRestUsed).some(k => s.weekRestUsed[k])
  })

  const submitDay    = usePlannerStore(s => s.submitDay)
  const setEodMood   = usePlannerStore(s => s.setEodMood)

  const [modalOpen, setModalOpen]     = useState(false)
  const [eodMood, setEodMoodLocal]    = useState<EodMood | ''>('')
  const [eveningQuote, setEveningQuote] = useState(false)

  const earned = todayEarned(done, mood, cfg)
  const minPts = getMoodAdjustedMinPts(today, mood, cfg)
  const diff   = minPts - earned
  const canSubmit = diff <= 0

  function handleSubmit() {
    const incomplete = tasks.filter(t => !t.done)
    const entry: HistoryEntry = {
      date:    today,
      done:    done.length,
      total:   tasks.length,
      pct:     tasks.length ? Math.round(done.length / tasks.length * 100) : 0,
      rxp:     earned,
      mood:    mood ?? '',
      eodMood: eodMood,
      frozen:  false,
      rest:    false,
      auto:    false,
      late:    false,
      tasks:   tasks.map(t => ({
        title:       t.title,
        priority:    t.isSpecial ? 'special' : t.priority,
        done:        t.done,
        zone:        t.zone,
        completedAt: t.completedAt,
        level:       t.level,
      })),
      rewards: [],
    }
    const { freezeBonus, milestoneStreak } = submitDay(entry)
    setModalOpen(false)
    if (eodMood) setEodMood(today, eodMood)
    if (cfg.quoteEvening) setEveningQuote(true)
    if (milestoneStreak) {
      showToast(`🎉 You've earned a Streak Freeze ❄ — ${milestoneStreak}-day streak! +${freezeBonus} freeze${freezeBonus > 1 ? 's' : ''}!`)
    } else {
      showToast(`Day submitted! Streak protected 🔥`)
    }
    if (cfg.autoExportEnabled) {
      writeBackupFile(usePlannerStore.getState())
    }
  }

  if (isSubmitted) {
    return (
      <div className="mt-4 pt-3.5 border-t border-[var(--border)]">
        <div className="w-full py-3 rounded-[10px] text-sm font-semibold text-center bg-[var(--bg3)] text-[var(--text3)] border border-[var(--border2)] opacity-50">
          ✓ Day submitted
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 pt-3.5 border-t border-[var(--border)]">
      <div className="text-xs text-[var(--text2)] mb-2.5 min-h-[18px]">
        {canSubmit
          ? `✅ ${earned} pts — ready to submit! (min ${minPts})`
          : `⚠ Need ${diff} more pts to submit (${earned}/${minPts})`}
      </div>
      <button
        onClick={() => canSubmit && setModalOpen(true)}
        disabled={!canSubmit}
        className="w-full py-3 rounded-[10px] text-sm font-semibold transition-all border-[1.5px]"
        title={!canSubmit ? `Need ${diff} more pts` : ''}
        style={{
          background:  canSubmit ? 'var(--green-bg)' : 'var(--bg3)',
          color:       canSubmit ? 'var(--green)'    : 'var(--text3)',
          borderColor: canSubmit ? 'var(--green-mid)': 'var(--border2)',
          opacity:     canSubmit ? 1 : 0.4,
          cursor:      canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        ✓ Submit My Day
      </button>
      {/* Evening quote overlay */}
      {eveningQuote && (() => {
        const q = getDailyQuote(today, 'evening')
        return (
          <div
            style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
            onClick={() => setEveningQuote(false)}
          >
            <div
              style={{ maxWidth:440, width:'100%', background:'var(--bg)', borderRadius:16, border:'1px solid var(--border)', padding:'36px 32px', textAlign:'center' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize:36, marginBottom:16 }}>🌙</div>
              <p style={{ fontSize:13, color:'var(--text3)', marginBottom:8 }}>Day submitted · Great work!</p>
              <p style={{ fontSize:18, fontWeight:600, lineHeight:1.5, color:'var(--text)', marginBottom:12 }}>&ldquo;{q.t}&rdquo;</p>
              <p style={{ fontSize:13, color:'var(--text3)', marginBottom:28 }}>— {q.a}</p>
              <button onClick={() => setEveningQuote(false)} style={{ padding:'10px 28px', borderRadius:10, fontSize:13, fontWeight:600, background:'var(--green-bg)', color:'var(--green)', border:'1.5px solid var(--green-mid)', cursor:'pointer' }}>
                Rest well ✓
              </button>
            </div>
          </div>
        )
      })()}

      {/* Submit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit your day">
        <p className="text-sm text-[var(--text2)] mb-3">
          Locking today. <strong>{done.length}</strong> done · <strong>{tasks.filter(t => !t.done).length}</strong> incomplete · <strong>{earned} pts</strong> earned.
        </p>
        {tasks.filter(t => !t.done).length > 0 && (
          <p className="text-xs text-[var(--amber)] mb-3">
            {tasks.filter(t => !t.done).length} task(s) can be carried to tomorrow.
          </p>
        )}
        <div className="border-t border-[var(--border)] pt-3 mt-1">
          <div className="text-xs text-[var(--text3)] mb-2">End-of-day reflection (optional):</div>
          <div className="flex gap-1.5 flex-wrap">
            {EOD_MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => setEodMoodLocal(m.key as EodMood)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  ...m.style,
                  background:  'var(--bg)',
                  borderWidth: eodMood === m.key ? '1.5px' : '0.5px',
                  opacity:     eodMood && eodMood !== m.key ? 0.4 : 1,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={() => setModalOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">
            Go back
          </button>
          <button onClick={handleSubmit} className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
            Confirm &amp; lock
          </button>
        </div>
      </Modal>

    </div>
  )
}
