'use client'
import { useState, useEffect } from 'react'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { PinPad }          from '@/ui/PinPad'
import { PinSetup }        from '@/ui/PinSetup'
import { exportJSON, importJSON } from '@/lib/persistence/export'
import { pad, uid } from '@/lib/engine/cutoff'
import { PIN_LENGTH, PIN_LOCKOUT_THRESHOLD } from '@/constants/points'
import { getBackupFolderName, pickBackupFolder, fsBackupSupported } from '@/lib/persistence/fsBackup'
import { deleteAllUserData } from '@/lib/firebase/firestore'
import { getClientAuth } from '@/lib/firebase/client'
import { signOut, deleteUser } from 'firebase/auth'
import { syncNow, destroySync } from '@/lib/sync/sync'
import { setUserScope } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'
import pkg from '@/package.json'
import type { AppConfig, GoalCadence, GoalTargetType } from '@/store/types'
import { FLAGS } from '@/constants/feature-flags'

const SUPPORT_EMAIL = 'kunalpk007@gmail.com'
const MAX_ZONE_NAME = 15

export default function SettingsPage() {
  const [tab, setTab] = useState<'general' | 'streak' | 'rules' | 'phase2' | 'help'>('general')

  const cfg         = usePlannerStore(s => s.cfg)
  const setConfig   = usePlannerStore(s => s.setConfig)
  const zones       = usePlannerStore(s => s.zones)
  const addZone     = usePlannerStore(s => s.addZone)
  const removeZone  = usePlannerStore(s => s.removeZone)
  const setZoneWeight = usePlannerStore(s => s.setZoneWeight)
  const goals       = usePlannerStore(s => s.goals)
  const addGoal     = usePlannerStore(s => s.addGoal)
  const removeGoal  = usePlannerStore(s => s.removeGoal)
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

  // Draft copy of cfg — edits apply here until "Save Settings" is pressed
  const [draft, setDraft] = useState<AppConfig>(cfg)
  useEffect(() => { setDraft(cfg) }, [cfg])
  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg)

  function saveSettings() {
    setConfig(draft)
    showToast('Settings saved ✓')
  }

  const [zoneName,   setZoneName]  = useState('')
  const [zoneColor,  setZoneColor] = useState('#639922')
  const [goalTitle,      setGoalTitle]      = useState('')
  const [goalCadence,    setGoalCadence]    = useState<GoalCadence>('weekly')
  const [goalZoneId,     setGoalZoneId]     = useState('')
  const [goalTargetType, setGoalTargetType] = useState<GoalTargetType>('taskCount')
  const [goalTarget,     setGoalTarget]     = useState(5)
  const [goalChecklist,  setGoalChecklist]  = useState<string[]>([])
  const [goalChecklistDraft, setGoalChecklistDraft] = useState('')
  const [goalEndDate,    setGoalEndDate]    = useState('')
  // Goal/challenge end dates: today through +2 months, matching the "End
  // date not more than 2 months" rule for goal-type friend challenges.
  const minGoalEndDate = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`
  const maxGoalEndDate = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 2)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })()
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

  // Account management
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  // App PIN management modal
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinStep, setPinStep] = useState<'verify-old' | 'set-new' | 'remove-verify'>('set-new')

  function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
    return m ? decodeURIComponent(m[1]) : null
  }

  /** Clear all local data and sign out. Firestore data is preserved. */
  async function handleDisable() {
    try { await fetch('/api/auth/signout', { method: 'POST' }) } catch {}
    try { await deleteUser(getClientAuth().currentUser!) } catch {}
    setUserScope(null)
    localStorage.removeItem(`${STORAGE_KEY}:${readCookie('kp_uid')}`)
    usePlannerStore.setState({ ...INITIAL_STATE })
    setDisableOpen(false)
    showToast('Local data cleared. You can sign in again to restore from cloud.')
    window.location.href = '/login'
  }

  /** Permanently delete Firestore data + Auth user + local data. */
  async function handleDelete() {
    setDeleteBusy(true)
    try {
      const uid = readCookie('kp_uid')
      if (uid) {
        try { await deleteAllUserData(uid) } catch {}
      }
      try { await fetch('/api/auth/signout', { method: 'POST' }) } catch {}
      try { await deleteUser(getClientAuth().currentUser!) } catch {}
      setUserScope(null)
      localStorage.removeItem(`${STORAGE_KEY}:${uid}`)
      usePlannerStore.setState({ ...INITIAL_STATE })
      showToast('Account deleted. All data permanently removed.')
      window.location.href = '/login'
    } catch (e) {
      showToast('Deletion failed. Try again.')
    }
    setDeleteBusy(false)
  }

  async function handleSignOut() {
    try { await syncNow() } catch {}
    destroySync()
    try { await fetch('/api/auth/signout', { method: 'POST' }) } catch {}
    try { await signOut(getClientAuth()) } catch {}
    setUserScope(null)
    usePlannerStore.setState({ ...INITIAL_STATE })
    window.location.replace('/login')
  }

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
    { k: 'help',    l: 'FAQ & Help' },
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
        <div className="pb-20">
          <SectionLabel>Appearance</SectionLabel>
          <SettingCard>
            <SettingRow label="Theme" sub="Takes effect immediately">
              <div className="flex gap-1.5">
                {(['dark', 'light', 'system'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setConfig({ theme: t }); setDraft(d => ({ ...d, theme: t })) }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                    style={{
                      background:  (cfg.theme ?? 'dark') === t ? 'var(--green-bg)' : 'var(--bg2)',
                      color:       (cfg.theme ?? 'dark') === t ? 'var(--green)'    : 'var(--text2)',
                      borderColor: (cfg.theme ?? 'dark') === t ? 'var(--green-mid)': 'var(--border2)',
                    }}
                  >
                    {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '🖥 System'}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Text size" sub="Takes effect immediately — useful on mobile">
              <div className="flex gap-1.5">
                {(['normal', 'large', 'xlarge'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setConfig({ fontScale: f }); setDraft(d => ({ ...d, fontScale: f })) }}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                    style={{
                      background:  (cfg.fontScale ?? 'normal') === f ? 'var(--green-bg)' : 'var(--bg2)',
                      color:       (cfg.fontScale ?? 'normal') === f ? 'var(--green)'    : 'var(--text2)',
                      borderColor: (cfg.fontScale ?? 'normal') === f ? 'var(--green-mid)': 'var(--border2)',
                    }}
                  >
                    {f === 'normal' ? 'A Normal' : f === 'large' ? 'A Large' : 'A Extra large'}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Manager</SectionLabel>
          <SettingCard>
            <SettingRow label="Manager name" sub="How your coach is addressed">
              <input value={draft.managerName} onChange={e => setDraft(d => ({ ...d, managerName: e.target.value }))}
                className="setting-input" style={{ width: 150 }} />
            </SettingRow>
            <SettingRow label="Manager tone">
              <select value={draft.tone} onChange={e => setDraft(d => ({ ...d, tone: e.target.value as any }))} className="setting-input">
                <option value="balanced">Balanced</option>
                <option value="strict">Strict</option>
                <option value="encouraging">Encouraging</option>
              </select>
            </SettingRow>
          </SettingCard>

          <SectionLabel>Submission rules</SectionLabel>
          <SettingCard>
            <SettingRow label="Min points to submit" sub={`Currently: ${draft.minPts} pts required to submit a weekday`}>
              <input type="number" value={draft.minPts} onChange={e => setDraft(d => ({ ...d, minPts: +e.target.value }))} min={20} max={200} className="setting-input" />
            </SettingRow>
            <SettingRow label="Week-off Hours (Light Day) minimum" sub={`Currently: ${draft.weekendPts} pts required to submit on Sat/Sun`}>
              <input type="number" value={draft.weekendPts} onChange={e => setDraft(d => ({ ...d, weekendPts: +e.target.value }))} min={5} max={60} className="setting-input" />
            </SettingRow>
            <SettingRow label="Day-end time" sub={`Your "day" ends and resets at ${draft.cutoffHour}:00 AM — set this later for night-shift schedules`}>
              <input
                type="time"
                value={`${pad(draft.cutoffHour)}:00`}
                onChange={e => {
                  const h = +e.target.value.split(':')[0]
                  setDraft(d => ({ ...d, cutoffHour: Math.min(4, Math.max(1, h)) }))
                }}
                step={3600}
                min="01:00" max="04:00"
                className="setting-input"
              />
            </SettingRow>
          </SettingCard>

          <SectionLabel>Mood multipliers</SectionLabel>
          <SettingCard>
            <SettingRow label="⚡ Motivated multiplier" sub="Default: 1.2×">
              <input type="number" value={draft.moodMot} onChange={e => setDraft(d => ({ ...d, moodMot: +e.target.value }))} min={1} max={2} step={0.05} className="setting-input" />
            </SettingRow>
            <SettingRow label="🤒 Sick multiplier" sub="Default: 0.5×">
              <input type="number" value={draft.moodSick} onChange={e => setDraft(d => ({ ...d, moodSick: +e.target.value }))} min={0.2} max={1} step={0.05} className="setting-input" />
            </SettingRow>
          </SettingCard>

          <SectionLabel>Pomodoro</SectionLabel>
          <SettingCard>
            <SettingRow label="Focus duration (minutes)" sub="Default: 25, range 5–60">
              <input type="number" value={draft.pomoDuration} onChange={e => setDraft(d => ({ ...d, pomoDuration: +e.target.value }))} min={5} max={60} className="setting-input" />
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
              <select value={draft.autoExportEnabled ? '1' : '0'} onChange={e => setDraft(d => ({ ...d, autoExportEnabled: e.target.value === '1' }))} className="setting-input">
                <option value="1">On</option><option value="0">Off</option>
              </select>
            </SettingRow>
            {draft.autoExportEnabled && <AutoExportFolderRow />}
          </SettingCard>

          <SectionLabel>Motivational quotes</SectionLabel>
          <SettingCard>
            <SettingRow label="Morning quote" sub="Full-screen overlay on first open after 4 AM">
              <select value={draft.quoteMorning ? '1' : '0'} onChange={e => setDraft(d => ({ ...d, quoteMorning: e.target.value === '1' }))} className="setting-input">
                <option value="1">On</option><option value="0">Off</option>
              </select>
            </SettingRow>
            <SettingRow label="Evening quote" sub="Shown after day submission">
              <select value={draft.quoteEvening ? '1' : '0'} onChange={e => setDraft(d => ({ ...d, quoteEvening: e.target.value === '1' }))} className="setting-input">
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
                {FLAGS.LIFE_SCORE && (
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
                    Weight
                    <input
                      type="number" min={0} max={10} step={0.5} value={z.weight ?? 1}
                      onChange={e => setZoneWeight(z.id, +e.target.value)}
                      className="w-14 text-[12px] px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
                    />
                  </label>
                )}
                <button onClick={() => removeZone(z.id)} className="btn-icon danger">×</button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap items-start mt-2">
              <div className="flex-1 min-w-[160px]">
                <input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Zone name..."
                  style={{ borderWidth: 1, borderStyle: 'solid', borderColor: zoneName.length > MAX_ZONE_NAME ? '#E24B4A' : 'var(--border2)' }}
                  className="w-full text-[13px] px-2.5 py-2 rounded-md bg-[var(--bg2)] text-[var(--text)] outline-none" />
                {zoneName.length > MAX_ZONE_NAME && <div className="text-[11px] text-[var(--red)] mt-0.5">Max length {MAX_ZONE_NAME}</div>}
              </div>
              <input type="color" value={zoneColor} onChange={e => setZoneColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} className="border-2 border-[var(--border2)] bg-none cursor-pointer rounded-full overflow-hidden" />
              <button
                disabled={!zoneName.trim() || zoneName.length > MAX_ZONE_NAME}
                onClick={() => { if (!zoneName.trim() || zoneName.length > MAX_ZONE_NAME) return; addZone(zoneName.trim(), zoneColor); setZoneName(''); showToast('Zone added.') }}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-40">
                + Add zone
              </button>
            </div>
            {FLAGS.LIFE_SCORE && (
              <p className="text-[11px] text-[var(--text3)] mt-2">Weights control each zone&apos;s share of your Life Score on the dashboard. Default is 1 (equal weight).</p>
            )}
          </div>

          {FLAGS.GOALS && (
            <>
              <SectionLabel>Goals</SectionLabel>
              <div className="mb-3">
                {goals.map(g => {
                  const zoneName = g.zoneId ? zones.find(z => z.id === g.zoneId)?.name : null
                  const detail = g.targetType === 'checklist'
                    ? `${g.checklist?.length ?? 0} tasks${g.endDate ? ` · by ${g.endDate}` : ''}`
                    : g.targetType === 'points' ? `${g.target} pts` : `${g.target} tasks`
                  return (
                    <div key={g.id} className="flex items-center gap-2.5 p-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-2">
                      <span className="flex-1 text-[13px]">
                        {g.title}
                        <span className="text-[var(--text3)]"> · {g.cadence} · {detail}{zoneName ? ` · ${zoneName}` : ''}{g.challengedBy ? ` · from ${g.challengedBy}` : ''}</span>
                      </span>
                      <button onClick={() => removeGoal(g.id)} className="btn-icon danger">×</button>
                    </div>
                  )
                })}
                <div className="flex gap-2 flex-wrap items-center mt-2">
                  <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="Goal title..."
                    className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
                  <select value={goalCadence} onChange={e => setGoalCadence(e.target.value as GoalCadence)} className="setting-input">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <select value={goalTargetType} onChange={e => setGoalTargetType(e.target.value as GoalTargetType)} className="setting-input">
                    <option value="taskCount">Tasks completed</option>
                    <option value="points">Points earned</option>
                    <option value="checklist">Checklist (multiple tasks)</option>
                  </select>
                  {goalTargetType === 'taskCount' && (
                    <select value={goalZoneId} onChange={e => setGoalZoneId(e.target.value)} className="setting-input">
                      <option value="">All zones</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  )}
                  {goalTargetType !== 'checklist' && (
                    <input type="number" value={goalTarget} onChange={e => setGoalTarget(+e.target.value)} min={1} style={{ width: 80 }}
                      className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
                  )}
                  {goalTargetType !== 'checklist' && (
                    <button
                      onClick={() => {
                        if (!goalTitle.trim() || goalTarget < 1) { showToast('Give the goal a title and a target > 0.'); return }
                        addGoal({
                          title: goalTitle.trim(), cadence: goalCadence, targetType: goalTargetType, target: goalTarget,
                          ...(goalTargetType === 'taskCount' && goalZoneId ? { zoneId: goalZoneId } : {}),
                        })
                        setGoalTitle(''); setGoalZoneId(''); setGoalTarget(5)
                        showToast('Goal added.')
                      }}
                      className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
                      + Add goal
                    </button>
                  )}
                </div>

                {goalTargetType === 'checklist' && (
                  <div className="mt-2 p-2.5 rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]">
                    <div className="flex gap-2 flex-wrap items-center">
                      <input
                        value={goalChecklistDraft}
                        onChange={e => setGoalChecklistDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key !== 'Enter' || !goalChecklistDraft.trim()) return
                          setGoalChecklist(l => [...l, goalChecklistDraft.trim()]); setGoalChecklistDraft('')
                        }}
                        placeholder="Task in this goal... (Enter to add)"
                        className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none" />
                      <button
                        onClick={() => { if (!goalChecklistDraft.trim()) return; setGoalChecklist(l => [...l, goalChecklistDraft.trim()]); setGoalChecklistDraft('') }}
                        className="px-3 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)]">
                        + Add task
                      </button>
                    </div>
                    {goalChecklist.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {goalChecklist.map((t, i) => (
                          <span key={i} className="text-[12px] px-2 py-1 rounded-full border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] flex items-center gap-1.5">
                            {t}
                            <button onClick={() => setGoalChecklist(l => l.filter((_, idx) => idx !== i))} className="text-[var(--text3)]">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap items-center mt-2.5">
                      <label className="text-[12px] text-[var(--text3)]">End date (optional, max 2 months out):</label>
                      <input type="date" value={goalEndDate} onChange={e => setGoalEndDate(e.target.value)}
                        min={minGoalEndDate} max={maxGoalEndDate}
                        className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none" />
                    </div>
                    <button
                      onClick={() => {
                        if (!goalTitle.trim() || goalChecklist.length === 0) { showToast('Give the goal a title and at least one task.'); return }
                        addGoal({
                          title: goalTitle.trim(), cadence: goalCadence, targetType: 'checklist', target: goalChecklist.length,
                          checklist: goalChecklist.map(t => ({ id: uid(), title: t, done: false })),
                          ...(goalEndDate ? { endDate: goalEndDate } : {}),
                        })
                        setGoalTitle(''); setGoalChecklist([]); setGoalChecklistDraft(''); setGoalEndDate('')
                        showToast('Goal added.')
                      }}
                      className="mt-2.5 px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
                      + Add goal
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-[var(--text3)] mt-2">Progress is shown on the Dashboard. Zone-scoped goals only support &quot;Tasks completed&quot; — per-task points aren&apos;t tracked per zone.</p>
              </div>
            </>
          )}

          <SectionLabel>Account</SectionLabel>
          <SettingCard>
            <SettingRow label="Sign out" sub="End your current session">
              <button onClick={handleSignOut}
                className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
                Sign out
              </button>
            </SettingRow>
            <SettingRow label="Disable account" sub="Clears local data. Cloud data is preserved — sign in again to restore.">
              <button onClick={() => setDisableOpen(true)}
                className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
                Disable
              </button>
            </SettingRow>
            <SettingRow label="Delete account" sub="Permanently removes all data from cloud and this device. Irreversible.">
              <button onClick={() => setDeleteOpen(true)}
                className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
                Delete
              </button>
            </SettingRow>
          </SettingCard>

          <div className="pb-24"></div>
        </div>
      )}

      {/* Fixed bottom bar */}
      {tab === 'general' && (
        <div className="fixed-bottom-bar">
          <button
            onClick={saveSettings}
            disabled={!dirty}
            className="w-full py-3 rounded-[10px] text-sm font-semibold border-[1.5px] transition-all disabled:opacity-40"
            style={{
              background:  dirty ? 'var(--green-bg)' : 'var(--bg3)',
              color:       dirty ? 'var(--green)'    : 'var(--text3)',
              borderColor: dirty ? 'var(--green-mid)': 'var(--border2)',
              cursor:      dirty ? 'pointer' : 'not-allowed',
            }}
          >
            💾 {dirty ? 'Save Settings' : 'Saved'}
          </button>
        </div>
      )}

      {/* Disable confirmation */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable account?">
        <p className="text-sm text-[var(--text2)] mb-4">
          Your planner data will be cleared from this device. Your cloud backup in Firestore will be preserved
          so you can restore everything by signing in again.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDisableOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={handleDisable}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
            Disable
          </button>
        </div>
      </Modal>

      {/* Delete confirmation — type DELETE to proceed */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <p className="text-sm text-[var(--red)] mb-2 font-medium">This permanently removes all data — tasks, streaks, XP, journal entries, everything.</p>
        <p className="text-sm text-[var(--text2)] mb-3">Your Firebase Authentication account will also be deleted. This cannot be undone.</p>
        <p className="text-sm text-[var(--text2)] mb-2">Type <strong>DELETE</strong> to confirm.</p>
        <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE..."
          className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setDeleteOpen(false); setDeleteText('') }} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={handleDelete} disabled={deleteText !== 'DELETE' || deleteBusy}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A] disabled:opacity-40">
            {deleteBusy ? 'Deleting…' : 'Permanently Delete'}
          </button>
        </div>
      </Modal>

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
            <button onClick={() => setPauseOpen(true)} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">⏸ Pause Streak</button>
            <button onClick={() => setInvOpen(true)}   className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">🗑 Invalidate Streak</button>
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
          <Accordion title="📝 Recent changes">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Incomplete tasks now automatically carry forward to the next day at cutoff, instead of being dropped</li>
              <li>"Fix missed check-offs" lets you retroactively mark a past day's tasks done and redeem rewards earned that day — available once per day, then hides itself</li>
              <li>Redeeming a reward now asks for confirmation before deducting wallet points</li>
              <li>Journal PIN is now {PIN_LENGTH} digits (was 4), and locks for 2 hours after {PIN_LOCKOUT_THRESHOLD} wrong attempts</li>
              <li>"Take Rest Day" and "Use Freeze" moved into the ⋯ menu on the dashboard</li>
              <li>Tap the streak badge to view your month-by-month streak history</li>
              <li>"Weekend Pulse" renamed to "Week-off Hours / Light Day" — same rule, clearer name</li>
              <li>Reward wallet was always permanent — clarified in the rules below (no decay, ever)</li>
            </ul>
          </Accordion>
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
              <li>Wallet is permanent — never resets or decays. Earned via consistency, yours to keep</li>
              <li>Redeem rewards anytime — no need to submit day first</li>
              <li>Buy freeze: 250 wallet pts = 1 freeze. You can hold at most 2 purchased freezes at once — use one before buying another</li>
            </ul>
          </Accordion>
          <Accordion title="🔥 Streak rules">
            <ul className="text-[13px] text-[var(--text2)] leading-relaxed mt-2 pl-4 list-disc space-y-1">
              <li>Full day (min pts met) → streak +1</li>
              <li>Week-off Hours / Light Day (Sat/Sun, lower minimum) → streak +1</li>
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

      {tab === 'help' && (
        <div className="pb-20">
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3.5">
            <div className="text-[13px] font-medium mb-1">Need help?</div>
            <p className="text-[12px] text-[var(--text2)] mb-2.5 leading-relaxed">
              Can&apos;t find your answer below, or hit a bug? Reach out directly — screenshots and steps to reproduce help the most.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Kunal's Planner — support request")}`}
              className="inline-flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-md font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
              ✉️ Email {SUPPORT_EMAIL}
            </a>
          </div>

          <SectionLabel>Sync & devices</SectionLabel>
          <Accordion title="Why don't my tasks/streak show up on another device?" defaultOpen>
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Cross-device sync needs Firebase set up and you signed into the same account on both devices. Check the sync badge in the top nav — &quot;Saved ✓&quot; means it&apos;s working, &quot;No cloud sync ⚠&quot; means Firebase isn&apos;t configured on this deployment (common on a fresh Netlify deploy if the Firebase environment variables weren&apos;t added to the site&apos;s build settings). &quot;Offline ⚠&quot; just means no network right now — it&apos;ll catch up once you&apos;re back online.
            </p>
          </Accordion>
          <Accordion title="My journal syncs but tasks/streak don't — why?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              This was a real bug (fixed — see BUG-030 in the bug tracker): journaling on a device could make that device&apos;s data look &quot;newer&quot; than another device&apos;s real task/streak sync, even with no local tasks, which then wrongly overwrote real cloud data. The sync merge now also checks whether local data looks empty before trusting its timestamp. If you still see this, force a refresh and check the sync badge.
            </p>
          </Accordion>
          <Accordion title="What does the sync status badge in the top bar mean?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Saving… = a change is being written to the cloud right now. Saved ✓ = everything&apos;s up to date. Offline ⚠ = no network, changes are queued locally. No cloud sync ⚠ = this deployment has no Firebase connection at all, so nothing leaves this device/browser.
            </p>
          </Accordion>

          <SectionLabel>Tasks, streaks & points</SectionLabel>
          <Accordion title="How does the daily cutoff work?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Your &quot;day&quot; runs until your configured cutoff hour (default 1:00 AM, adjustable up to 4:00 AM in Settings → General), not midnight. At cutoff, the app auto-submits if you&apos;ve hit your minimum points, auto-rests or auto-freezes if available, or breaks the streak if none of those apply.
            </p>
          </Accordion>
          <Accordion title="What happens to tasks I don't finish?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Incomplete tasks automatically carry forward to the next day at cutoff (up to 3 days), losing a small number of points per day carried — unless the task is marked &quot;Blocked&quot; by a dependency, in which case it carries with no penalty.
            </p>
          </Accordion>
          <Accordion title="What's the difference between a Rest Day and a Freeze?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Both protect your streak from breaking without incrementing it. A Rest Day is a manual, self-declared day off. A Freeze is a limited resource (earned or bought with 250 wallet pts) that gets consumed automatically if cutoff arrives with no activity. Neither works if your streak is already 0 — there's nothing to protect.
            </p>
          </Accordion>
          <Accordion title="How are points calculated?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Base points by priority (High 20 / Medium 12 / Low 6 / ⭐ Special custom), adjusted by deadline timing, slot mismatch, and your mood setting for the day. Full details are in the Rules & Guide tab → &quot;Points system&quot;.
            </p>
          </Accordion>
          <Accordion title="What's the difference between Rank XP and Wallet points?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Rank XP drives your overall rank/level and never gets spent. Wallet points are what you redeem for rewards — every 2 task points earned adds 1 wallet point, and the wallet never decays.
            </p>
          </Accordion>
          <Accordion title="How do I redeem a reward, and what's a reward approval?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Redeem anytime from the Rewards tab — no need to submit the day first. If a reward is above a cost threshold or linked to a habit, a friend you've tagged as Notary needs to approve it (or it auto-approves after a cooldown if they don't respond) — this is an anti-cheat check, not a hard block.
            </p>
          </Accordion>

          <SectionLabel>Friends, challenges & goals</SectionLabel>
          <Accordion title="How do I add a friend?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Go to Tasks → Friends mode, share your friend code (copy it or send it via the WhatsApp button), and have them paste it into their own &quot;Add a friend&quot; box. There's a soft cap on how many friends you can add at once — remove someone first if you're at the limit.
            </p>
          </Accordion>
          <Accordion title="What happens if I remove a friend?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Only your own friend list changes. Any challenges, validations, or reward approvals already in progress with them aren't affected, and they can re-add you later with your friend code. Removal always asks for confirmation first.
            </p>
          </Accordion>
          <Accordion title="What's the difference between a task challenge and a goal challenge?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              A task challenge sends a single task straight onto your friend's list for today. A goal challenge sends a checklist of multiple tasks with an end date (up to 2 months out) — accepting it creates a whole Goal on their Goals list instead of one task, tagged with who challenged them.
            </p>
          </Accordion>
          <Accordion title="Why do challenge tasks use fixed zones (Health/Fitness/Finance/Personal/Other) instead of my own zones?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Zones are personal/custom per account, so a zone id from your list might not exist — or might mean something completely different — on your friend's account. Challenges always use a fixed, shared zone set so it renders sensibly on both sides.
            </p>
          </Accordion>
          <Accordion title="What does the notification bell show?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Incoming friend requests, tasks/rewards waiting on your review, incoming challenges, and updates on things you sent out (accepted, declined, or completed). It's driven by live listeners, not polling, so it should reflect changes within a second or two.
            </p>
          </Accordion>
          <Accordion title="How do checklist goals work?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Add a goal in Settings → Goals with type &quot;Checklist (multiple tasks)&quot;, list out the individual tasks, and optionally set an end date. Progress is just how many of the checklist items you've checked off — shown as checkboxes on your Dashboard's Goals card.
            </p>
          </Accordion>
          <Accordion title="Can I set weekly or monthly goals?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Yes — cadence (Weekly/Monthly) applies to points-based and task-count goals, which reset and re-track each period automatically. Checklist goals (including goal challenges from friends) are one-off and time-bound by their own end date instead.
            </p>
          </Accordion>
          <Accordion title="Who can validate my tasks, and why would I need that?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              You can ask any friend to sign off on a task before it counts — useful for anything easy to fake (gym check-ins, etc). Points stay withheld until they approve or reject; there's no silent auto-approve for validations (unlike reward approvals, which do auto-approve after a cooldown).
            </p>
          </Accordion>

          <SectionLabel>Privacy & account</SectionLabel>
          <Accordion title="Is my journal private?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Yes — journal entries are yours alone; friends never see them. You can additionally lock the journal behind an app PIN and optional encryption in Settings → General.
            </p>
          </Accordion>
          <Accordion title="How do I report a bug or request something?">
            <p className="text-[13px] text-[var(--text2)] mt-2 leading-relaxed">
              Email {SUPPORT_EMAIL} with what happened and, if possible, a screenshot or the steps to reproduce it. Every bug found and fixed in this app gets logged in an internal bug tracker so nothing gets silently forgotten.
            </p>
          </Accordion>
        </div>
      )}

      {/* Modals */}
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="⏸ Pause Streak">
        <p className="text-sm text-[var(--text2)] mb-2">For off-grid trips. Streak freezes for up to 20 days.</p>
        <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Spiti trip, no signal..."
          className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3 min-h-[64px] resize-y" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setPauseOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={() => { if (!pauseReason.trim()) { showToast('Describe your situation.'); return }; pauseStreak(pauseReason); setPauseOpen(false); showToast('Streak paused.') }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">
            Pause Streak
          </button>
        </div>
      </Modal>

      <Modal open={invOpen} onClose={() => { setInvOpen(false); setInvPinOk(false); setInvText('') }} title="Invalidate Streak">
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
                Reset Rank XP
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
