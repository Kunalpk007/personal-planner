'use client'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { usePlannerStore }  from '@/store'
import { Modal }            from '@/ui/Modal'
import { showToast }        from '@/ui/Toast'
import { fireConfetti }     from '@/ui/Confetti'
import { todayEarned, getMoodAdjustedMinPts } from '@/lib/engine/scoring'
import { goalPtsEarnedOn }  from '@/lib/engine/goals'
import { getDailyQuote }    from '@/lib/engine/quotes'
import { writeBackupFile }  from '@/lib/persistence/fsBackup'
import { syncNow }          from '@/lib/sync/sync'
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

export function SubmitArea({ today, pinned }: { today: string; pinned?: boolean }) {
  const cfg          = usePlannerStore(s => s.cfg)
  const allTasks     = usePlannerStore(s => s.tasks)
  const tasks        = useMemo(() => allTasks.filter(t => t.date === today && !t.cancelledAt), [allTasks, today])
  const done         = tasks.filter(t => t.done)
  const mood         = usePlannerStore(s => s.mood[today])
  const isSubmitted  = usePlannerStore(s => !!s.submittedDays[today])

  const submitDay    = usePlannerStore(s => s.submitDay)
  const setEodMood   = usePlannerStore(s => s.setEodMood)
  const goals        = usePlannerStore(s => s.goals)

  const [modalOpen, setModalOpen]     = useState(false)
  const [eodMood, setEodMoodLocal]    = useState<EodMood | ''>('')
  const [eveningQuote, setEveningQuote] = useState(false)
  const [celebrate, setCelebrate]     = useState<{ milestoneStreak: number | null; freezeBonus: number } | null>(null)

  const goalPtsToday = goalPtsEarnedOn(goals, today)
  const earned = todayEarned(done, mood, cfg, goalPtsToday)
  const minPts = getMoodAdjustedMinPts(today, mood, cfg)
  const diff   = minPts - earned
  const canSubmit = diff <= 0

  // Dashboard usage (no `pinned`) gets the vibrant redesign; Tasks-page usage
  // (`pinned`, its own not-yet-redesigned page) keeps the exact prior look —
  // see project.md's "UI Redesign Initiative" for the agreed Dashboard-first
  // rollout order.
  const vx = !pinned

  function handleSubmit() {
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
    if (vx) {
      fireConfetti()
      setCelebrate({ milestoneStreak, freezeBonus })
    } else if (cfg.quoteEvening) {
      setEveningQuote(true)
    }
    if (milestoneStreak) {
      showToast(`🎉 You've earned a Streak Freeze ❄ — ${milestoneStreak}-day streak! +${freezeBonus} freeze${freezeBonus > 1 ? 's' : ''}!`)
    } else {
      showToast(`Day submitted! Streak protected 🔥`)
    }
    if (cfg.autoExportEnabled) {
      writeBackupFile(usePlannerStore.getState())
    }
    syncNow()
  }

  function closeCelebrate() {
    setCelebrate(null)
    if (cfg.quoteEvening) setEveningQuote(true)
  }

  // ── Tasks-page ("pinned") path — unchanged from before this redesign ──────
  if (!vx) {
    // `vx-submit-bar-pinned` narrows + restyles the shared `.fixed-bottom-bar`
    // specifically for this usage — it used to inherit that class's full
    // ~860px-wide default, which made it visibly wider than (and misaligned
    // with) the `.vx-bottom-nav` pill floating right below it. Matching the
    // nav's own width formula and glass styling here (not by changing
    // `.fixed-bottom-bar` itself, which Settings' Save bar also uses and was
    // never reported as a problem) makes the two read as one aligned unit.
    const wrapClass = pinned
      ? 'fixed-bottom-bar vx-submit-bar-pinned'
      : 'mt-4 pt-3.5 border-t border-[var(--border)]'
    const activeWrapClass = pinned
      ? 'fixed-bottom-bar vx-submit-bar-pinned vx-submit-bar-active'
      : 'mt-4 pt-3.5 border-t border-[var(--border)]'

    // `pinned` usage lives inside app/(tabs)/layout.tsx's `page-container`
    // motion.div, which animates `filter` (blur in/out on route change). A
    // non-`none` filter on an ancestor creates a new containing block for
    // `position: fixed` descendants (same rule documented at length
    // elsewhere in this file for the evening-quote overlays) — so without a
    // portal, `.fixed-bottom-bar` was being "fixed" relative to the full
    // scrollable page-container box instead of the real viewport, which is
    // exactly why it scrolled away instead of staying pinned above the
    // bottom nav. Portalling to <body> escapes that entirely.
    const content = isSubmitted ? (
      <div className={wrapClass}>
        <div className="w-full py-3 rounded-[10px] text-sm font-semibold text-center bg-[var(--bg3)] text-[var(--text3)] border border-[var(--border2)] opacity-50">
          ✓ Day submitted
        </div>
      </div>
    ) : (
      <div className={activeWrapClass}>
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
        {/* Evening quote overlay — portalled to <body>: this lives inside
            app/(tabs)/layout.tsx's `page-container` motion.div, which animates
            `filter` (blur in/out on route change). A non-`none` `filter` on an
            ancestor creates a new containing block for `position: fixed`
            descendants (same rule as `transform`), so without a portal this
            "fixed, centered" overlay gets centered against the full scrollable
            page instead of the actual viewport. */}
        {eveningQuote && (() => {
          const q = getDailyQuote(today, 'evening')
          return createPortal(
            <div
              style={{ position:'fixed', inset:0, height:'100dvh', zIndex:200, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
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
            </div>,
            document.body
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

    return pinned ? createPortal(content, document.body) : content
  }

  // ── Dashboard ("vx") path — vibrant redesign ──────────────────────────────
  if (isSubmitted) {
    return (
      <motion.div
        className="vx-glass text-center"
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.84 }}
      >
        <div className="vx-eyebrow justify-center">✓ Day submitted</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="vx-glass"
      initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.84 }}
    >
      <div className="vx-eyebrow mb-2">✅ Submit My Day</div>
      <div className="text-xs text-[var(--text2)] mb-3">
        {canSubmit
          ? `${earned} pts — ready to submit! (min ${minPts})`
          : `Need ${diff} more pts to submit (${earned}/${minPts})`}
      </div>
      <button
        onClick={() => canSubmit && setModalOpen(true)}
        disabled={!canSubmit}
        className="vx-submit-btn"
      >
        {canSubmit ? '✓ Submit My Day' : `Need ${diff} more pts`}
      </button>

      {/* Evening quote overlay (shown after the celebration is dismissed) —
          portalled to <body> for the same reason as the non-vx overlay above:
          this component's own ancestor `motion.div` (this file, `vx-glass`)
          also animates `filter`, which would otherwise contain this "fixed"
          overlay to this card's box instead of the real viewport. */}
      {eveningQuote && (() => {
        const q = getDailyQuote(today, 'evening')
        return createPortal(
          <div
            className="vx-modal-backdrop"
            style={{ position: 'fixed', zIndex: 200, height: '100dvh' }}
            onClick={() => setEveningQuote(false)}
          >
            <div className="vx-modal-sheet max-w-[440px] text-center" onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🌙</div>
              <p className="text-[13px] text-[var(--text3)] mb-2">Day submitted · Great work!</p>
              <p className="text-lg font-semibold leading-relaxed mb-3">&ldquo;{q.t}&rdquo;</p>
              <p className="text-[13px] text-[var(--text3)] mb-7">— {q.a}</p>
              <button onClick={() => setEveningQuote(false)} className="vx-celebrate-btn">Rest well ✓</button>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* Day-complete celebration */}
      <Modal open={!!celebrate} onClose={closeCelebrate} variant="vx">
        <div className="vx-celebrate-card">
          <div className="vx-celebrate-emoji">{celebrate?.milestoneStreak ? '❄️' : '🎉'}</div>
          <div className="vx-celebrate-title vx-text-hero">
            {celebrate?.milestoneStreak ? 'Streak Freeze earned!' : 'Day complete!'}
          </div>
          <p className="text-[12.5px] text-[var(--text2)] leading-relaxed mb-5">
            {celebrate?.milestoneStreak
              ? `${celebrate.milestoneStreak}-day streak — +${celebrate.freezeBonus} freeze${celebrate.freezeBonus > 1 ? 's' : ''} banked, on top of today's ${earned} pts.`
              : `${earned} pts locked in and your streak is protected. See you tomorrow.`}
          </p>
          <button onClick={closeCelebrate} className="vx-celebrate-btn">Nice — keep going</button>
        </div>
      </Modal>

      {/* Submit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Submit your day" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">
          Locking today. <strong>{done.length}</strong> done · <strong>{tasks.filter(t => !t.done).length}</strong> incomplete · <strong>{earned} pts</strong> earned.
        </p>
        {tasks.filter(t => !t.done).length > 0 && (
          <p className="text-xs text-[var(--vx-amber)] mb-3">
            {tasks.filter(t => !t.done).length} task(s) can be carried to tomorrow.
          </p>
        )}
        <div className="border-t border-[var(--vx-border)] pt-3 mt-1">
          <div className="text-xs text-[var(--text3)] mb-2">End-of-day reflection (optional):</div>
          <div className="flex gap-1.5 flex-wrap">
            {EOD_MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => setEodMoodLocal(m.key as EodMood)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  ...m.style,
                  background:  'var(--vx-surface-tint)',
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
          <button onClick={() => setModalOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--vx-border)] bg-transparent text-sm text-[var(--text2)]">
            Go back
          </button>
          <button onClick={handleSubmit} className="px-3.5 py-1.5 rounded-md text-sm font-medium vx-text-hero border border-[var(--vx-border)]" style={{ background: 'var(--color-accent-dim)' }}>
            Confirm &amp; lock
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}
