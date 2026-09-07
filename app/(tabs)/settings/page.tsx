'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'
import { useSocialStore } from '@/store/social/social.store'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { PinPad }          from '@/ui/PinPad'
import { PinSetup }        from '@/ui/PinSetup'
import { exportJSON, importJSON } from '@/lib/persistence/export'
import { pad } from '@/lib/engine/cutoff'
import { PIN_LENGTH, OLD_PIN_LENGTH, PIN_LOCKOUT_THRESHOLD } from '@/constants/points'
import { deleteAllUserData, submitBugReport } from '@/lib/firebase/firestore'
import { uploadBugReportImage } from '@/lib/firebase/storage'
import { getClientAuth } from '@/lib/firebase/client'
import { signOut, deleteUser } from 'firebase/auth'
import { syncNow, destroySync } from '@/lib/sync/sync'
import { setUserScope } from '@/store/userScope'
import { STORAGE_KEY, INITIAL_STATE } from '@/store/defaults'
import pkg from '@/package.json'
import type { AppConfig } from '@/store/types'
import { FLAGS } from '@/constants/feature-flags'
import { APP_URL, APP_SHARE_MESSAGE } from '@/constants/social'
import { getWeekMonday } from '@/lib/engine/cutoff'

const SUPPORT_EMAIL = 'kunalpk007@gmail.com'
const MAX_ZONE_NAME = 15

function inviteLink(uid: string, name: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/tasks?mode=friends&code=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'general' | 'streak' | 'rules' | 'phase2' | 'help'>('general')

  const cfg         = usePlannerStore(s => s.cfg)
  const setConfig   = usePlannerStore(s => s.setConfig)
  const zones       = usePlannerStore(s => s.zones)
  const addZone     = usePlannerStore(s => s.addZone)
  const removeZone  = usePlannerStore(s => s.removeZone)
  const setZoneWeight = usePlannerStore(s => s.setZoneWeight)
  const streak      = usePlannerStore(s => s.streak)
  const bestStreak  = usePlannerStore(s => s.bestStreak)
  const daysActive  = usePlannerStore(s => s.daysActive)
  const freezesUsed = usePlannerStore(s => s.freezesUsed)
  const rankXP      = usePlannerStore(s => s.rankXP)
  const badges      = usePlannerStore(s => s.badges)
  const pauseStreak = usePlannerStore(s => s.pauseStreak)
  const restoreStreak = usePlannerStore(s => s.restoreStreak)
  const pausedStreak = usePlannerStore(s => s.pausedStreak)
  const resetRank   = usePlannerStore(s => s.resetRankXP)
  const journalPin  = usePlannerStore(s => s.journalPin)
  const journalPinLength = usePlannerStore(s => s.journalPinLength)
  // A PIN hashed before the 5→6 digit upgrade needs the shorter length when
  // verifying it here too (see ui/PinGate.tsx's migrate-verify step for the
  // Journal's own equivalent flow).
  const verifyPinLength = journalPinLength && journalPinLength === PIN_LENGTH ? PIN_LENGTH : OLD_PIN_LENGTH
  const setJournalPin = usePlannerStore(s => s.setJournalPin)
  const setJournalSecurity = usePlannerStore(s => s.setJournalSecurity)
  const changeLog   = usePlannerStore(s => s.changeLog)
  const taskDeletions = changeLog.filter(c => c.action === 'task-deleted').length
  const state       = usePlannerStore(s => s)

  // Draft copy of cfg — edits apply here until "Save Settings" is pressed
  const [draft, setDraft] = useState<AppConfig>(cfg)
  useEffect(() => { setDraft(cfg) }, [cfg])
  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg)

  // Light Days can only actually change once per Monday-start calendar week
  // (see store/slices/config.slice.ts#setConfig) — reflect that here so the
  // picker reads as locked (buttons disabled) rather than letting the user
  // fiddle with a selection that'll silently get dropped on save.
  const lightDaysLockedThisWeek = !!cfg.lightDaysChangedAt
    && getWeekMonday(cfg.lightDaysChangedAt.slice(0, 10)) === getWeekMonday(new Date().toISOString().slice(0, 10))

  function saveSettings() {
    const result = setConfig(draft)
    if (result.blockedLightDays) {
      setDraft(d => ({ ...d, lightDays: cfg.lightDays }))
      showToast('Light Days can only be changed once a week (week starts Monday) — everything else saved.')
    } else {
      showToast('Settings saved ✓')
    }
  }

  const [zoneName,   setZoneName]  = useState('')
  const [zoneColor,  setZoneColor] = useState('#639922')
  const [pauseReason, setPauseReason] = useState('')
  const [pauseOpen,  setPauseOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
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

  // Friend code / invite link
  const myName = useSocialStore(s => s.displayName)
  const [myUid, setMyUid] = useState<string | null>(null)
  useEffect(() => {
    setMyUid(getClientAuth().currentUser?.uid ?? null)
  }, [])

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
      <div className="vx-modeswitch mb-3.5" style={{ display: 'inline-flex', flexWrap: 'wrap', width: 'auto', rowGap: 6 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`vx-modeswitch-item ${tab === t.k ? 'vx-active' : ''}`} style={{ flex: 'none', padding: '0.5rem 1rem' }}>
            {tab === t.k && (
              <motion.div layoutId="vx-settings-tab-indicator" className="vx-modeswitch-indicator"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="pb-20">
          <SectionLabel>Appearance</SectionLabel>
          <SettingCard>
            <SettingRow label="Theme" sub="Applies immediately across the whole app">
              <div className="flex gap-1.5">
                {(['dark', 'light', 'cream'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setConfig({ theme: t }); setDraft(d => ({ ...d, theme: t })) }}
                    className={`vx-pill text-xs ${(cfg.theme ?? 'dark') === t ? 'vx-tinted' : ''}`}
                    data-tone={(cfg.theme ?? 'dark') === t ? 'emerald' : undefined}
                  >
                    {t === 'dark' ? '🌙 Dark' : t === 'light' ? '☀️ Light' : '☕ Cream'}
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
                    className={`vx-pill text-xs ${(cfg.fontScale ?? 'normal') === f ? 'vx-tinted' : ''}`}
                    data-tone={(cfg.fontScale ?? 'normal') === f ? 'emerald' : undefined}
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
            <SettingRow label="Light Day minimum" sub={`Currently: ${draft.weekendPts} pts required to submit on a Light Day`}>
              <input type="number" value={draft.weekendPts} onChange={e => setDraft(d => ({ ...d, weekendPts: +e.target.value }))} min={5} max={60} className="setting-input" />
            </SettingRow>
            <SettingRow label="Light Days" sub={lightDaysLockedThisWeek
              ? 'Already changed this week — changes again next Monday.'
              : `${draft.lightDays.length}/2 selected — these days use the Light Day minimum above instead of the regular one`}>
              <div className="flex gap-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label, i) => {
                  const active = draft.lightDays.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={lightDaysLockedThisWeek}
                      onClick={() => setDraft(d => {
                        if (d.lightDays.includes(i)) return { ...d, lightDays: d.lightDays.filter(x => x !== i) }
                        if (d.lightDays.length >= 2) return d
                        return { ...d, lightDays: [...d.lightDays, i].sort((a, b) => a - b) }
                      })}
                      className={`w-8 h-8 rounded-md text-[11px] font-medium border ${active ? '' : 'vx-btn-ghost'}`}
                      style={{
                        ...(active ? { background: 'var(--color-accent-dim)', color: 'var(--vx-emerald)', borderColor: 'color-mix(in srgb, var(--vx-emerald) 40%, transparent)' } : undefined),
                        ...(lightDaysLockedThisWeek ? { opacity: 0.4, cursor: 'not-allowed' } : undefined),
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
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

          <SectionLabel>Wellness</SectionLabel>
          <SettingCard>
            <SettingRow label="Daily water target" sub={`Currently: ${(draft.waterTargetMl / 1000).toFixed(2)} litres/day — drives the Water Intake tile and its completion animation`}>
              <input
                type="number"
                value={draft.waterTargetMl / 1000}
                onChange={e => setDraft(d => ({ ...d, waterTargetMl: Math.round(Math.max(0.25, +e.target.value) * 1000) }))}
                min={0.25} max={10} step={0.25}
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

          <SectionLabel>Security</SectionLabel>
          <SettingCard>
            <SettingRow label="App PIN" sub={journalPin ? 'Set — protects Journal and destructive streak/XP actions' : 'Not set — Journal and destructive actions are unprotected'}>
              <div className="flex gap-2">
                <button onClick={() => openPinModal('set-or-change')} className="vx-btn vx-btn-ghost text-xs">
                  {journalPin ? 'Change PIN' : 'Set PIN'}
                </button>
                {journalPin && (
                  <button onClick={() => openPinModal('remove')} className="vx-btn vx-btn-danger text-xs">
                    Remove PIN
                  </button>
                )}
              </div>
            </SettingRow>
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
              <div key={z.id} className="vx-tile flex items-center gap-2.5 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.color }} />
                <span className="flex-1 text-[13px]">{z.name}</span>
                {FLAGS.LIFE_SCORE && (
                  <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--vx-fg-4)' }}>
                    Weight
                    <input
                      type="number" min={0} max={10} step={0.5} value={z.weight ?? 1}
                      onChange={e => setZoneWeight(z.id, +e.target.value)}
                      className="w-14 vx-field text-[12px] px-1.5 py-1"
                    />
                  </label>
                )}
                <button onClick={() => removeZone(z.id)} className="vx-btn vx-btn-icon vx-danger">×</button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap items-start mt-2">
              <div className="flex-1 min-w-[160px]">
                <input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Zone name..."
                  className={`w-full vx-field ${zoneName.length > MAX_ZONE_NAME ? 'vx-error' : ''}`} />
                {zoneName.length > MAX_ZONE_NAME && <div className="text-[11px] mt-0.5" style={{ color: 'var(--red)' }}>Max length {MAX_ZONE_NAME}</div>}
              </div>
              <input type="color" value={zoneColor} onChange={e => setZoneColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} className="border-2 border-[var(--vx-border)] bg-none cursor-pointer rounded-full overflow-hidden" />
              <button
                disabled={!zoneName.trim() || zoneName.length > MAX_ZONE_NAME}
                onClick={() => { if (!zoneName.trim() || zoneName.length > MAX_ZONE_NAME) return; addZone(zoneName.trim(), zoneColor); setZoneName(''); showToast('Zone added.') }}
                className="vx-btn vx-btn-primary text-xs">
                + Add zone
              </button>
            </div>
            {FLAGS.LIFE_SCORE && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--vx-fg-4)' }}>Weights control each zone&apos;s share of your Life Score on the dashboard. Default is 1 (equal weight).</p>
            )}
          </div>

          <SectionLabel>Refer the app</SectionLabel>
          <SettingCard>
            <SettingRow label="Share Personal Planner" sub="Sends the app URL">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(APP_URL); showToast('App link copied.')
                  }}
                  className="vx-btn vx-btn-ghost text-xs">
                  Copy link
                </button>
                <button
                  onClick={() => {
                    window.open(`https://wa.me/?text=${encodeURIComponent(APP_SHARE_MESSAGE)}`, '_blank', 'noopener,noreferrer')
                  }}
                  className="vx-btn vx-btn-ghost text-xs" style={{ color: '#25D366' }}>
                  📱 Send App URL via WhatsApp
                </button>
              </div>
            </SettingRow>
            {myUid && (
              <SettingRow label="Your friend code" sub="Share this so a friend can add you">
                <div className="flex flex-col items-end gap-2 max-w-full">
                  <div className="flex items-center gap-2 max-w-full">
                    <code className="text-[12px] font-semibold truncate max-w-[140px]">{myUid}</code>
                    <button onClick={() => { navigator.clipboard?.writeText(myUid); showToast('Code copied.') }}
                      className="vx-btn vx-btn-ghost text-xs flex-shrink-0">Copy code</button>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={() => { navigator.clipboard?.writeText(inviteLink(myUid, myName)); showToast('Invite link copied.') }}
                      className="vx-btn vx-btn-ghost text-xs">🔗 Copy invite link</button>
                    <button
                      onClick={() => {
                        const link = inviteLink(myUid, myName)
                        const msg = `Add me on Personal Planner — just open this link and tap Add Friend 💪\n\n${link}`
                        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
                      }}
                      className="vx-btn vx-btn-ghost text-xs" style={{ color: '#25D366' }}
                      title="Share invite link via WhatsApp">
                      📱 WhatsApp
                    </button>
                  </div>
                </div>
              </SettingRow>
            )}
          </SettingCard>

          <SectionLabel>Account</SectionLabel>
          <SettingCard>
            <SettingRow label="Sign out" sub="End your current session">
              <button onClick={handleSignOut} className="vx-btn vx-btn-ghost text-xs">
                Sign out
              </button>
            </SettingRow>
            <SettingRow label="Disable account" sub="Clears local data. Cloud data is preserved — sign in again to restore.">
              <button onClick={() => setDisableOpen(true)} className="vx-btn vx-btn-ghost text-xs">
                Disable
              </button>
            </SettingRow>
            <SettingRow label="Delete account" sub="Permanently removes all data from cloud and this device. Irreversible.">
              <button onClick={() => setDeleteOpen(true)}
                className="vx-btn vx-btn-danger text-xs">
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
            className={`vx-btn w-full py-3 text-sm ${dirty ? 'vx-btn-primary' : 'vx-btn-ghost'}`}
          >
            💾 {dirty ? 'Save Settings' : 'Saved'}
          </button>
        </div>
      )}

      {/* Disable confirmation */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable account?" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-4">
          Your planner data will be cleared from this device. Your cloud backup in Firestore will be preserved
          so you can restore everything by signing in again.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDisableOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={handleDisable} className="vx-btn vx-btn-ghost text-sm">
            Disable
          </button>
        </div>
      </Modal>

      {/* Delete confirmation — type DELETE to proceed */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?" variant="vx">
        <p className="text-sm text-[var(--red)] mb-2 font-medium">This permanently removes all data — tasks, streaks, XP, journal entries, everything.</p>
        <p className="text-sm text-[var(--text2)] mb-3">Your Firebase Authentication account will also be deleted. This cannot be undone.</p>
        <p className="text-sm text-[var(--text2)] mb-2">Type <strong>DELETE</strong> to confirm.</p>
        <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Type DELETE..."
          className="w-full vx-field mb-3" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setDeleteOpen(false); setDeleteText('') }} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={handleDelete} disabled={deleteText !== 'DELETE' || deleteBusy}
            className="vx-btn vx-btn-danger text-sm">
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
              ? <span className="text-[13px]" style={{ color: 'var(--vx-fg-4)' }}>No badges yet. Keep going.</span>
              : badges.map(b => <span key={b.id} className="badge">{b.icon} {b.label}</span>)}
          </div>

          <SectionLabel>Streak controls</SectionLabel>
          <div className="flex gap-2.5 flex-wrap mb-2">
            {pausedStreak
              ? <button onClick={() => setResumeOpen(true)} className="vx-btn vx-btn-ghost text-xs" style={{ color: 'var(--vx-amber)' }}>▶ Resume Streak</button>
              : <button onClick={() => setPauseOpen(true)} className="vx-btn vx-btn-ghost text-xs" style={{ color: 'var(--vx-amber)' }}>⏸ Pause Streak</button>}
            <button onClick={() => setRrOpen(true)}    className="vx-btn vx-btn-ghost text-xs">↺ Reset Rank XP</button>
          </div>
          <p className="text-xs" style={{ color: 'var(--vx-fg-4)' }}>Pause for off-grid trips. Reset rank if you want a fresh start.</p>

          <SectionLabel>Activity log</SectionLabel>
          <p className="text-xs" style={{ color: 'var(--vx-fg-4)' }}>
            Tasks deleted: <strong style={{ color: 'var(--vx-fg-1)' }}>{taskDeletions}</strong>
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
              <li>App/Journal PIN is now {PIN_LENGTH} digits (was {OLD_PIN_LENGTH}) — you&apos;ll be asked to verify your old PIN once, then set a new {PIN_LENGTH}-digit one. Locks for 2 hours after {PIN_LOCKOUT_THRESHOLD} wrong attempts</li>
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
          <div className="vx-tile vx-accent-l p-3 mb-3.5 text-[13px]" data-tone="cyan" style={{ color: 'var(--vx-cyan)' }}>
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
          <div className="vx-tile p-3.5 mb-3.5">
            <div className="text-[13px] font-medium mb-1">Need help?</div>
            <p className="text-[12px] text-[var(--text2)] mb-2.5 leading-relaxed">
              Can&apos;t find your answer below, or hit a bug? Reach out directly — screenshots and steps to reproduce help the most.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Personal Planner — support request")}`}
              className="vx-btn vx-btn-primary inline-flex items-center gap-1.5 text-[13px]">
              ✉️ Email {SUPPORT_EMAIL}
            </a>
          </div>

          <SectionLabel>Report a bug or complaint</SectionLabel>
          <SettingCard>
            <BugReportForm />
          </SettingCard>

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
      <Modal open={pauseOpen} onClose={() => setPauseOpen(false)} title="⏸ Pause Streak" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-2">For off-grid trips. Streak freezes for up to 20 days.</p>
        <textarea value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="e.g. Spiti trip, no signal..."
          className="w-full vx-field mb-3 min-h-[64px] resize-y" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setPauseOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={() => { if (!pauseReason.trim()) { showToast('Describe your situation.'); return }; pauseStreak(pauseReason); setPauseOpen(false); showToast('Streak paused.') }}
            className="vx-btn vx-btn-ghost text-sm" style={{ color: 'var(--vx-amber)' }}>
            Pause Streak
          </button>
        </div>
      </Modal>

      <Modal open={resumeOpen} onClose={() => setResumeOpen(false)} title="▶ Resume Streak" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">
          Restore your streak to <strong style={{ color: 'var(--vx-fg-1)' }}>{pausedStreak?.streakAtPause ?? 0}</strong> and resume normal tracking?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setResumeOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={() => { restoreStreak(); setResumeOpen(false); showToast('Streak resumed.') }}
            className="vx-btn vx-btn-ghost text-sm" style={{ color: 'var(--vx-amber)' }}>
            Resume Streak
          </button>
        </div>
      </Modal>

      <Modal open={rrOpen} onClose={() => { setRrOpen(false); setRrPinOk(false); setRrText('') }} title="Reset Rank XP" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-2">Returns to Rookie (0 XP). This cannot be undone.</p>
        {journalPin && !rrPinOk ? (
          <PinPad mode="verify" storedHash={journalPin} length={verifyPinLength} title="Enter App PIN to confirm" onSuccess={() => setRrPinOk(true)} onCancel={() => setRrOpen(false)} />
        ) : (
          <>
            {!journalPin && (
              <>
                <p className="text-sm text-[var(--text2)] mb-2">Type <strong>RESETRANK</strong> to proceed.</p>
                <input value={rrText} onChange={e => setRrText(e.target.value)} placeholder="Type RESETRANK..."
                  className="w-full vx-field mb-3" />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRrOpen(false); setRrPinOk(false); setRrText('') }} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
              <button onClick={() => {
                  if (!journalPin && rrText !== 'RESETRANK') { showToast('Type RESETRANK.'); return }
                  resetRank(); setRrText(''); setRrPinOk(false); setRrOpen(false); showToast('Rank XP reset.')
                }}
                className="vx-btn vx-btn-danger text-sm">
                Reset Rank XP
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* App PIN management */}
      <Modal open={pinModalOpen} onClose={() => setPinModalOpen(false)} title={pinStep === 'remove-verify' ? 'Remove App PIN' : journalPin ? 'Change App PIN' : 'Set App PIN'} variant="vx">
        {pinStep === 'verify-old' && journalPin && (
          <PinPad mode="verify" storedHash={journalPin} length={verifyPinLength} title="Enter current PIN" onSuccess={() => setPinStep('set-new')} onCancel={() => setPinModalOpen(false)} />
        )}
        {pinStep === 'set-new' && (
          <PinSetup
            title={`Set a new ${PIN_LENGTH}-digit PIN`}
            onComplete={(hash, q, aHash) => { setJournalSecurity(hash, q, aHash); setPinModalOpen(false); showToast('App PIN saved.') }}
            onCancel={() => setPinModalOpen(false)}
          />
        )}
        {pinStep === 'remove-verify' && journalPin && (
          <PinPad mode="verify" storedHash={journalPin} length={verifyPinLength} title="Enter PIN to remove it" onSuccess={() => { setJournalPin(null); setPinModalOpen(false); showToast('App PIN removed.') }} onCancel={() => setPinModalOpen(false)} />
        )}
      </Modal>

      {/* Import confirmation */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setPendingImportFile(null) }} title="⚠ Import backup" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-2">
          This will <strong>permanently overwrite</strong> all current data — tasks, history, streaks, XP, journal, and settings — with the contents of the selected file.
        </p>
        <p className="text-sm text-[var(--red)] mb-3">This cannot be undone. Your existing data will be lost unless you&apos;ve exported a backup.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setImportOpen(false); setPendingImportFile(null) }} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={async () => {
              if (!pendingImportFile) return
              try {
                const data = await importJSON(pendingImportFile)
                usePlannerStore.setState(data)
                showToast('Backup imported ✓')
              } catch { showToast('Import failed.') }
              setImportOpen(false); setPendingImportFile(null)
            }}
            className="vx-btn vx-btn-danger text-sm">
            Overwrite &amp; Import
          </button>
        </div>
      </Modal>
    </div>
  )
}

const MAX_BUG_IMAGE_MB = 5

function BugReportForm() {
  const [category, setCategory] = useState('bug')
  const [message, setMessage] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  function pickImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); return }
    if (file.size > MAX_BUG_IMAGE_MB * 1024 * 1024) { showToast(`Image must be under ${MAX_BUG_IMAGE_MB}MB.`); return }
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(null)
    setImagePreview(null)
  }

  async function submit() {
    if (!message.trim()) { showToast('Describe the issue first.'); return }
    setBusy(true)
    try {
      const user = getClientAuth().currentUser
      const uid = user?.uid ?? 'anon'
      let imageUrl: string | undefined
      if (image) {
        try { imageUrl = await uploadBugReportImage(uid, image) }
        catch { showToast('Report sent, but the photo upload failed.') }
      }
      await submitBugReport(uid, user?.email ?? '', category, message.trim(), imageUrl)
      setSent(true); setMessage(''); clearImage()
      showToast('Thanks! Your report was sent.')
    } catch {
      showToast('Could not send — check your connection.')
    }
    setBusy(false)
  }

  if (sent) {
    return (
      <div className="py-2 text-[13px] text-[var(--text2)]">
        ✓ Report received — thank you. <button onClick={() => setSent(false)} className="underline" style={{ color: 'var(--vx-emerald)' }}>Send another</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 py-1">
      <p className="text-[11px]" style={{ color: 'var(--vx-fg-4)' }}>Found a bug or want to complain about something? Send it straight to the app admin.</p>
      <select value={category} onChange={e => setCategory(e.target.value)} className="setting-input">
        <option value="bug">🐞 Bug</option>
        <option value="complaint">😕 Complaint</option>
        <option value="feature">💡 Feature request</option>
        <option value="other">Other</option>
      </select>
      <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 1000))}
        placeholder="What happened? Steps to reproduce help a lot…"
        className="vx-field min-h-[80px] resize-y" />

      {imagePreview ? (
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Attached screenshot" className="rounded-lg" style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid var(--vx-border)' }} />
          <span className="text-[11px]" style={{ color: 'var(--vx-fg-4)' }}>{image?.name}</span>
          <button onClick={clearImage} className="vx-btn vx-btn-icon vx-danger" title="Remove photo" aria-label="Remove photo">×</button>
        </div>
      ) : (
        <label className="vx-btn vx-btn-ghost text-xs inline-flex w-fit cursor-pointer">
          📷 Attach a screenshot
          <input type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} />
        </label>
      )}

      <div className="flex justify-end">
        <button onClick={submit} disabled={busy || !message.trim()}
          className="vx-btn vx-btn-primary text-xs">
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 mt-4 first:mt-0" style={{ color: 'var(--vx-fg-4)' }}>{children}</div>
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return <div className="vx-tile p-3.5 mb-3.5">{children}</div>
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 gap-2.5 flex-wrap" style={{ borderColor: 'var(--vx-border)' }}>
      <div className="flex-1 min-w-[160px]">
        <div className="text-[13px] font-medium">{label}</div>
        {sub && <div className="text-[11px]" style={{ color: 'var(--vx-fg-4)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}
