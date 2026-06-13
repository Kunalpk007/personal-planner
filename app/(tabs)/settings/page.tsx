'use client'
import { useState, useEffect } from 'react'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { PinPad }          from '@/ui/PinPad'
import { PinSetup }        from '@/ui/PinSetup'
import { exportJSON, importJSON } from '@/lib/persistence/export'
import { getBackupFolderName, pickBackupFolder, fsBackupSupported } from '@/lib/persistence/fsBackup'
import pkg from '@/package.json'

export default function SettingsPage() {
  const [tab, setTab] = useState<'general' | 'streak' | 'rules' | 'phase2'>('general')

  const cfg         = usePlannerStore(s => s.cfg)
  const setConfig   = usePlannerStore(s => s.setConfig)
  const zones       = usePlannerStore(s => s.zones)
  const addZone     = usePlannerStore(s => s.addZone)
  const removeZone  = usePlannerStore(s => s.removeZone)
  const streak      = usePlannerStore(s => s.streak)
  const bestStreak  = usePlannerStore(s => s.bestStreak)
  const daysActive  = usePlannerStore(s => s.daysActive)
  const freezesUsed = usePlannerStore(s => s.freezesUsed)
  const rankXP      = usePlannerStore(s => s.rankXP)
  const badges      = usePlannerStore(s => s.badges)
  const pauseStreak = usePlannerStore(s => s.pauseStreak)
  const invalidate  = usePlannerStore(s => s.invalidateStreak)
  const resetRank   = usePlannerStore(s => s.resetRankXP)
  const journalPin  = usePlannerStore(s => s.journalPin)
  const setJournalPin = usePlannerStore(s => s.setJournalPin)
  const setJournalSecurity = usePlannerStore(s => s.setJournalSecurity)
  const changeLog   = usePlannerStore(s => s.changeLog)
  const taskDeletions = changeLog.filter(c => c.action === 'task-deleted').length
  const state       = usePlannerStore(s => s)

  const [zoneName,   setZoneName]  = useState('')
  const [zoneColor,  setZoneColor] = useState('#639922')
  const [pauseReason, setPauseReason] = useState('')
  const [pauseOpen,  setPauseOpen] = useState(false)
  const [invText,    setInvText]   = useState('')
  const [invOpen,    setInvOpen]   = useState(false)
  const [invPinOk,   setInvPinOk]  = useState(false)
  const [rrText,     setRrText]    = useState('')
  const [rrOpen,     setRrOpen]    = useState(false)
  const [rrPinOk,    setRrPinOk]   = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)

  // App PIN management modal
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinStep, setPinStep] = useState<'verify-old' | 'set-new' | 'remove-verify'>('set-new')

  function openPinModal(action: 'set-or-change' | 'remove') {
    if (action === 'remove') {
      setPinStep('remove-verify')
    } else {
      setPinStep(journalPin ? 'verify-old' : 'set-new')
    }
    setPinModalOpen(true)
  }

  const TABS = [
    { k: 'general', l: 'General' },
    { k: 'streak',  l: 'Streak & Badges' },
    { k: 'rules',   l: 'Rules & Guide' },
    { k: 'phase2',  l: 'Phase 2' },
  ]

  return (
    <div>
      <div className="inline-flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${tab === t.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div>
          <SectionLabel>Appearance</SectionLabel>
          <SettingCard>
            <SettingRow label="Theme" sub="System preference syncing is planned for a future update">
              <select value={cfg.theme ?? 'dark'} onChange={e => setConfig({ theme: e.target.value as any })} className="setting-input">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Manager</SectionLabel>
          <SettingCard>
            <SettingRow label="Manager name" sub="How your coach is addressed">
              <input value={cfg.managerName} onChange={e => setConfig({ managerName: e.target.value })}
                className="setting-input" style={{ width: 150 }} />
            </SettingRow>
            <SettingRow label="Manager tone">
              <select value={cfg.tone} onChange={e => setConfig({ tone: e.target.value as any })} className="setting-input">
                <option value="balanced">Balanced</option>
                <option value="strict">Strict</option>
                <option value="encouraging">Encouraging</option>
              </select>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Submission rules</SectionLabel>
          <SettingCard>
            <SettingRow label="Min points to submit" sub="Default: 70 pts">
              <input type="number" value={cfg.minPts} onChange={e => setConfig({ minPts: +e.target.value })} min={20} max={200} className="setting-input" />
            </SettingRow>
            <SettingRow label="Weekend pulse minimum" sub="Default: 20 pts (Sat/Sun)">
              <input type="number" value={cfg.weekendPts} onChange={e => setConfig({ weekendPts: +e.target.value })} min={5} max={60} className="setting-input" />
            </SettingRow>
            <SettingRow label="Day cutoff hour (AM)" sub="1 = 1:00 AM, max 4">
              <input type="number" value={cfg.cutoffHour} onChange={e => setConfig({ cutoffHour: Math.min(4, Math.max(1, +e.target.value)) })} min={1} max={4} className="setting-input" />
            </SettingRow>
          </SettingCard>

          <SectionLabel>Mood multipliers</SectionLabel>
          <SettingCard>
            <SettingRow label="⚡ Motivated multiplier" sub="Default: 1.2×">
              <input type="number" value={cfg.moodMot} onChange={e => setConfig({ moodMot: +e.target.value })} min={1} max={2} step={0.05} className="setting-input" />
            </SettingRow>
            <SettingRow label="🤒 Sick multiplier" sub="Default: 0.5×">
              <input type="number" value={cfg.moodSick} onChange={e => setConfig({ moodSick: +e.target.value })} min={0.2} max={1} step={0.05} className="setting-input" />
            </SettingRow>
          </SettingCard>

          <SectionLabel>Pomodoro</SectionLabel>
          <SettingCard>
            <SettingRow label="Focus duration (minutes)" sub="Default: 25, range 5–60">
              <input type="number" value={cfg.pomoDuration} onChange={e => setConfig({ pomoDuration: +e.target.value })} min={5} max={60} className="setting-input" />
            </SettingRow>
          </SettingCard>

          <SectionLabel>Security</SectionLabel>
          <SettingCard>
            <SettingRow label="App PIN" sub={journalPin ? 'Set — protects Journal and destructive streak/XP actions' : 'Not set — Journal and destructive actions are unprotected'}>
              <div className="flex gap-2">
                <button onClick={() => openPinModal('set-or-change')} className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
                  {journalPin ? 'Change PIN' : 'Set PIN'}
                </button>
                {journalPin && (
                  <button onClick={() => openPinModal('remove')} className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
                    Remove PIN
                  </button>
                )}
              </div>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Auto-export</SectionLabel>
          <SettingCard>
            <SettingRow label="Auto-export on submit" sub="Writes a dated backup JSON to a folder you choose each session (Chrome/Edge only)">
              <select value={cfg.autoExportEnabled ? '1' : '0'} onChange={e => setConfig({ autoExportEnabled: e.target.value === '1' })} className="setting-input">
                <option value="1">On</option><option value="0">Off</option>
              </select>
            </SettingRow>
            {cfg.autoExportEnabled && <AutoExportFolderRow />}
          </SettingCard>

          <SectionLabel>Motivational quotes</SectionLabel>
          <SettingCard>
            <SettingRow label="Morning quote" sub="Full-screen overlay on first open after 4 AM">
              <select value={cfg.quoteMorning ? '1' : '0'} onChange={e => setConfig({ quoteMorning: e.target.value === '1' })} className="setting-input">
                <option value="1">On</option><option value="0">Off</option>
              </select>
            </SettingRow>
            <SettingRow label="Evening quote" sub="Shown after day submission">
              <select value={cfg.quoteEvening ? '1' : '0'} onChange={e => setConfig({ quoteEvening: e.target.value === '1' })} className="setting-input">
                <option value="1">On</option><option value="0">Off</option>
              </select>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Zone management</SectionLabel>
          <div className="mb-3">
            {zones.map(z => (
              <div key={z.id} className="flex items-center gap-2.5 p-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.color }} />
                <span className="flex-1 text-[13px]">{z.name}</span>
                <button onClick={() => removeZone(z.id)} className="btn-icon danger">×</button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap items-center mt-2">
              <input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Zone name..."
                className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <input type="color" value={zoneColor} onChange={e => setZoneColor(e.target.value)} style={{ width: 44, height: 36 }} className="border-none bg-none cursor-pointer rounded" />
              <button onClick={() => { if (!zoneName.trim()) return; addZone(zoneName.trim(), zoneColor); setZoneName(''); showToast('Zone added.') }}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
                + Add zone
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-[var(--border)] flex gap-2.5 flex-wrap">
            <button onClick={() => exportJSON(state)} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--blue-bg)] text-[var(--blue)] border border-[#4A9EE0]">⬇ Export backup</button>
            <label className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] cursor-pointer">
              ⬆ Import backup
              <input type="file" accept=".json" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return
                setPendingImportFile(f)
                setImportOpen(true)
                e.target.value = ''
              }} />
            </label>
          </div>

          <div className="text-[11px] text-[var(--text3)] mt-4 text-center">
            Kunal&apos;s Planner v{pkg.version}
          </div>
        </div>
      )}

      {tab === 'streak' && (
        <div>
          <SectionLabel>All-time</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-gap)', marginBottom: '1.5rem' }}>
            {[
              { l: 'Best streak', v: bestStreak },
              { l: 'Days active',  v: daysActive },
              { l: 'Freezes used', v: freezesUsed },
              { l: 'Rank XP',      v: rankXP },
            ].map(c => (
              <div key={c.l} className="stat-card">
                <div className="stat-label">{c.l}</div>
                <div className="stat-value">{c.v}</div>
              </div>
            ))}
          </div>

          <SectionLabel>Badges</SectionLabel>
          <div className="mb-4">
            {badges.length === 0
              ? <span className="text-[13px] text-[var(--text3)]">No badges yet. Keep going.</span>
              : badges.map(b => <span key={b.id} className="badge">{b.icon} {b.label}</span>)}
          </div>

          <SectionLabel>Streak controls</SectionLabel>
          <div className="flex gap-2.5 flex-wrap mb-2">
            <button onClick={() => setPauseOpen(true)} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">⏸ Pause streak</button>
            <button onClick={() => setInvOpen(true)}   className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">🗑 Invalidate streak</button>
            <button onClick={() => setRrOpen(true)}    className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">↺ Reset Rank XP</button>
          </div>
          <p className="text-xs text-[var(--text3)]">Pause for off-grid trips. Invalidate if streak wasn&apos;t honestly earned. Reset rank if you want a fresh start.</p>

          <SectionLabel>Activity log</SectionLabel>
          <p className="text-xs text-[var(--text3)]">
            Tasks deleted: <strong className="text-[var(--text)]">{taskDeletions}</strong>
            {taskDeletions > 0 && ' — tracked for spotting misjudged priorities or repeated avoidance.'}
          </p>
        </div>
      )}

      {tab === 'rules' && (
        <div>
          <Accordion title="📌 Points system" defaultOpen>
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>High = 20pts · Medium = 12pts · Low = 6pts · ⭐ Special = custom</li>
              <li>Deadline on time = 100% · within 1hr late = 70% · after 1hr = 40%</li>
              <li>Slot mismatch: -20% if done outside assigned time block</li>
              <li>Mood: ⚡ Motivated 1.2× · 😐 Neutral 1.0× · 🤒 Sick 0.5×</li>
              <li>Carried task: -2pts per day carried (max 3 days)</li>
              <li>Journaling: +5 Rank XP for first entry of the day</li>
            </ul>
          </Accordion>
          <Accordion title="🪙 Reward wallet">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Every 2 task pts earned = 1 wallet pt</li>
              <li>Wallet is permanent — never resets daily or weekly</li>
              <li>50% decay on your 1-year app anniversary</li>
              <li>Redeem rewards anytime — no need to submit day first</li>
              <li>Buy freeze: 250 wallet pts = 1 freeze (max 2 held at a time)</li>
            </ul>
          </Accordion>
          <Accordion title="🔥 Streak rules">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Full day (min pts met) → streak +1</li>
              <li>Weekend pulse (20+ pts Sat/Sun) → streak +1</li>
              <li>Rest Day → streak unchanged (protected, not incremented)</li>
              <li>Freeze → streak unchanged (protected, not incremented)</li>
              <li>Paused → streak frozen until you restore</li>
              <li>Miss → streak = 0</li>
            </ul>
          </Accordion>
          <Accordion title="⏰ Day cutoff & auto-submit">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Default cutoff: 1:00 AM. Configurable up to 4:00 AM.</li>
              <li>At cutoff: 1. Min pts met → auto-submit · 2. No activity + rest day unused → auto-rest · 3. Freeze available → auto-freeze · 4. None → streak breaks</li>
              <li>Late manual submit (before noon) flagged permanently in history.</li>
            </ul>
          </Accordion>
          <Accordion title="💬 Motivational quotes">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Morning quote: full-screen overlay on first open after 4 AM</li>
              <li>Evening quote: shown once after day submission</li>
              <li>Both are independently toggleable in Settings → General</li>
              <li>Comeback theme on streak-break days</li>
            </ul>
          </Accordion>
        </div>
      )}

      {tab === 'phase2' && (
        <div>
          <div className="bg-[var(--blue-bg)] border border-[var(--blue)] rounded-[10px] p-3 mb-3.5 text-[13px] text-[var(--blue)]">
            🚀 Planned for Phase 2. Not active yet.
          </div>
          <Accordion title="📊 History graph" defaultOpen>
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">Day-by-day pts and tasks chart. Trend lines, best weeks, mood vs output correlation.</p>
          </Accordion>
          <Accordion title="🗓 Notion / Google Calendar sync">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">Two-way sync of tasks with Notion databases and Google Calendar events.</p>
          </Accordion>
          <Accordion title="🤖 AI weekly summary">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">Auto-generated weekly review from journal entries, task history, and mood patterns.</p>
          </Accordion>
          <Accordion title="📱 Telegram / WhatsApp notifications">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">Daily task reminders via Telegram Bot or WhatsApp (Twilio). GitHub Actions cron job.</p>
          </Accordion>
        </div>
      )}

      {/* Modals */}
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="⏸ Pause streak">
        <p className="text-sm text-[var(--text2)] mb-2">For off-grid trips. Streak freezes for up to 20 days.</p>
        <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Spiti trip, no signal..."
          className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3 min-h-[64px] resize-y" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setPauseOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={() => { if (!pauseReason.trim()) { showToast('Describe your situation.'); return }; pauseStreak(pauseReason); setPauseOpen(false); showToast('Streak paused.') }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">
            Pause
          </button>
        </div>
      </Modal>

      <Modal open={invOpen} onClose={() => { setInvOpen(false); setInvPinOk(false); setInvText('') }} title="Invalidate streak">
        <p className="text-sm text-[var(--text2)] mb-2">Resets streak to 0. This cannot be undone.</p>
        {journalPin && !invPinOk ? (
          <PinPad mode="verify" storedHash={journalPin} title="Enter App PIN to confirm" onSuccess={() => setInvPinOk(true)} onCancel={() => setInvOpen(false)} />
        ) : (
          <>
            {!journalPin && (
              <>
                <p className="text-sm text-[var(--text2)] mb-2">Type <strong>CONFIRM</strong> to proceed.</p>
                <input value={invText} onChange={e => setInvText(e.target.value)} placeholder="Type CONFIRM..."
                  className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3" />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setInvOpen(false); setInvPinOk(false); setInvText('') }} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
              <button onClick={() => {
                  if (!journalPin && invText !== 'CONFIRM') { showToast('Type CONFIRM.'); return }
                  invalidate(); setInvText(''); setInvPinOk(false); setInvOpen(false); showToast('Streak reset.')
                }}
                className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
                Reset Streak
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={rrOpen} onClose={() => { setRrOpen(false); setRrPinOk(false); setRrText('') }} title="Reset Rank XP">
        <p className="text-sm text-[var(--text2)] mb-2">Returns to Rookie (0 XP). This cannot be undone.</p>
        {journalPin && !rrPinOk ? (
          <PinPad mode="verify" storedHash={journalPin} title="Enter App PIN to confirm" onSuccess={() => setRrPinOk(true)} onCancel={() => setRrOpen(false)} />
        ) : (
          <>
            {!journalPin && (
              <>
                <p className="text-sm text-[var(--text2)] mb-2">Type <strong>RESETRANK</strong> to proceed.</p>
                <input value={rrText} onChange={e => setRrText(e.target.value)} placeholder="Type RESETRANK..."
                  className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3" />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRrOpen(false); setRrPinOk(false); setRrText('') }} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
              <button onClick={() => {
                  if (!journalPin && rrText !== 'RESETRANK') { showToast('Type RESETRANK.'); return }
                  resetRank(); setRrText(''); setRrPinOk(false); setRrOpen(false); showToast('Rank XP reset.')
                }}
                className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
                Reset Rank
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* App PIN management */}
      <Modal open={pinModalOpen} onClose={() => setPinModalOpen(false)} title={pinStep === 'remove-verify' ? 'Remove App PIN' : journalPin ? 'Change App PIN' : 'Set App PIN'}>
        {pinStep === 'verify-old' && journalPin && (
          <PinPad mode="verify" storedHash={journalPin} title="Enter current PIN" onSuccess={() => setPinStep('set-new')} onCancel={() => setPinModalOpen(false)} />
        )}
        {pinStep === 'set-new' && (
          <PinSetup
            title="Set a new 4-digit PIN"
            onComplete={(hash, q, aHash) => { setJournalSecurity(hash, q, aHash); setPinModalOpen(false); showToast('App PIN saved.') }}
            onCancel={() => setPinModalOpen(false)}
          />
        )}
        {pinStep === 'remove-verify' && journalPin && (
          <PinPad mode="verify" storedHash={journalPin} title="Enter PIN to remove it" onSuccess={() => { setJournalPin(null); setPinModalOpen(false); showToast('App PIN removed.') }} onCancel={() => setPinModalOpen(false)} />
        )}
      </Modal>

      {/* Import confirmation */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setPendingImportFile(null) }} title="⚠ Import backup">
        <p className="text-sm text-[var(--text2)] mb-2">
          This will <strong>permanently overwrite</strong> all current data — tasks, history, streaks, XP, journal, and settings — with the contents of the selected file.
        </p>
        <p className="text-sm text-[var(--red)] mb-3">This cannot be undone. Your existing data will be lost unless you&apos;ve exported a backup.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setImportOpen(false); setPendingImportFile(null) }} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={async () => {
              if (!pendingImportFile) return
              try {
                const data = await importJSON(pendingImportFile)
                usePlannerStore.setState(data)
                showToast('Backup imported ✓')
              } catch { showToast('Import failed.') }
              setImportOpen(false); setPendingImportFile(null)
            }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
            Overwrite &amp; Import
          </button>
        </div>
      </Modal>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2 mt-4 first:mt-0">{children}</div>
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return <div className="card mb-3.5">{children}</div>
}

function AutoExportFolderRow() {
  const [folder, setFolder] = useState<string | null>(null)

  useEffect(() => {
    getBackupFolderName().then(setFolder)
  }, [])

  if (!fsBackupSupported()) {
    return (
      <div className="text-[11px] text-[var(--text3)] py-2">
        Not supported in this browser — use manual export instead.
      </div>
    )
  }

  return (
    <SettingRow label="Backup folder" sub={folder ? `Currently: ${folder} (permission re-confirmed each session)` : 'No folder chosen yet'}>
      <button
        onClick={async () => {
          const name = await pickBackupFolder()
          if (name) { setFolder(name); showToast(`Backup folder set: ${name}`) }
        }}
        className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]"
      >
        Choose folder
      </button>
    </SettingRow>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0 gap-2.5 flex-wrap">
      <div className="flex-1 min-w-[160px]">
        <div className="text-[13px] font-medium">{label}</div>
        {sub && <div className="text-[11px] text-[var(--text3)]">{sub}</div>}
      </div>
      {children}
    </div>
  )
}
