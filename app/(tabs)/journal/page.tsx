'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useDayKey }       from '@/hooks/useDayKey'
import { formatDate }      from '@/lib/engine/cutoff'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { Pagination }      from '@/ui/Pagination'
import { usePagination }   from '@/hooks/usePagination'
import { showToast }       from '@/ui/Toast'
import { PinGate }         from '@/ui/PinGate'
import { VoiceControls }   from '@/features/journal/VoiceControls'
import { tryUnlock, encryptText, decryptText, validatePassphrase } from '@/lib/crypto/journal-encrypt'
import { hasJournalKey, getJournalKey, setJournalKey, clearJournalKey } from '@/lib/crypto/journal-key'
import { createEncryptionKey } from '@/lib/crypto/journal-encrypt'

/** Grows the textarea to fit its content instead of staying a fixed size
 *  with an internal scrollbar — used as both a ref callback (initial size on
 *  mount/entry switch) and an onInput handler (as the user types). */
function autosizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export default function JournalPage() {
  const { today }   = useDayKey()
  const [mode, setMode] = useState<'write' | 'history'>('write')
  const [text, setText] = useState('')
  const [editKey, setEditKey]   = useState<string | null>(null)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Resize to fit whenever the loaded/cleared entry changes (new entry,
  // switching to edit an old one, or discarding) — typing itself is also
  // covered live by the textarea's own onInput handler.
  useEffect(() => { autosizeTextarea(textareaRef.current) }, [editKey, text])

  const journal     = usePlannerStore(s => s.journal)
  const encToken    = usePlannerStore(s => s.journalEncryptionToken)
  const saveEntry   = usePlannerStore(s => s.saveJournalEntry)
  const deleteEntry = usePlannerStore(s => s.deleteJournalEntry)

  // ── Encryption gate ──────────────────────────────────────────────────────

  const [encPass, setEncPass]       = useState('')
  const [encError, setEncError]     = useState('')
  const [encBusy, setEncBusy]       = useState(false)
  const [encSetup, setEncSetup]     = useState(false)
  const [encSetupPass, setEncSetupPass]        = useState('')
  const [encSetupConfirm, setEncSetupConfirm]    = useState('')
  const [encSetupError, setEncSetupError]      = useState('')
  const [disablePass, setDisablePass]          = useState('')
  const [disableError, setDisableError]        = useState('')
  const [disableBusy, setDisableBusy]          = useState(false)
  const [showDisable, setShowDisable]          = useState(false)
  const [decrypted, setDecrypted] = useState<Record<string, string> | null>(null)

  const needsPassphrase = !!encToken && !hasJournalKey() && decrypted === null
  const waitingDecrypt  = !!encToken && hasJournalKey() && decrypted === null
  const showJournal     = !encToken || (hasJournalKey() && decrypted !== null)

  async function decryptAllEntries(key: CryptoKey): Promise<Record<string, string>> {
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(journal)) {
      try { map[k] = await decryptText(v, key) } catch { map[k] = v }
    }
    return map
  }

  // Decrypt on mount (SPA re-entry) or when journal changes after save/delete
  useEffect(() => {
    if (!hasJournalKey()) return
    const key = getJournalKey()!
    ;(async () => {
      setDecrypted(await decryptAllEntries(key))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal])

  async function handleEncUnlock() {
    if (!encToken) return
    setEncBusy(true)
    setEncError('')
    const key = await tryUnlock(encPass, encToken)
    if (key) {
      setJournalKey(key)
      const map = await decryptAllEntries(key)
      setDecrypted(map)
      setEncPass('')
      setEncError('')
    } else {
      setEncError('Wrong passphrase.')
    }
    setEncBusy(false)
  }

  async function handleDisableEnc() {
    if (!encToken) return
    setDisableBusy(true)
    setDisableError('')
    const key = await tryUnlock(disablePass, encToken)
    if (!key) {
      setDisableError('Wrong passphrase.')
      setDisableBusy(false)
      return
    }
    try {
      const plaintext = await decryptAllEntries(key)
      usePlannerStore.setState({ journal: plaintext, journalEncryptionToken: null })
      clearJournalKey()
      setShowDisable(false)
      setDisablePass('')
      setDisableError('')
      setDecrypted(null)
      showToast('Encryption disabled. Entries are now stored as plaintext.')
    } catch {
      setDisableError('Decryption failed.')
    }
    setDisableBusy(false)
  }

  async function handleEncSetup() {
    if (encSetupPass !== encSetupConfirm) { setEncSetupError('Passphrases do not match.'); return }
    const v = validatePassphrase(encSetupPass)
    if (!v.ok) { setEncSetupError(v.reason); return }
    setEncBusy(true)
    setEncSetupError('')
    try {
      const { key, verificationToken } = await createEncryptionKey(encSetupPass)
      const encrypted: Record<string, string> = {}
      for (const [k, v] of Object.entries(journal)) {
        encrypted[k] = await encryptText(v, key)
      }
      usePlannerStore.setState({ journal: encrypted, journalEncryptionToken: verificationToken })
      setJournalKey(key)
      const map = await decryptAllEntries(key)
      setDecrypted(map)
      setEncSetup(false)
      setEncSetupPass('')
      setEncSetupConfirm('')
      showToast('Journal encryption enabled. Save your recovery phrase somewhere safe.')
    } catch {
      setEncSetupError('Encryption failed. Try again.')
    }
    setEncBusy(false)
  }

  // ── Journal actions ──────────────────────────────────────────────────────

  // Save is gated behind a confirmation modal (requestSave opens it,
  // handleSave runs after the user confirms) so an entry is never written
  // by an accidental tap.
  function requestSave() {
    if (!text.trim()) { showToast('Write something first.'); return }
    setConfirmSaveOpen(true)
  }

  async function handleSave() {
    if (!text.trim()) { setConfirmSaveOpen(false); return }
    const key = hasJournalKey() ? getJournalKey()! : null
    let savedText = text.trim()
    if (key) {
      savedText = await encryptText(savedText, key)
    }
    const wasEdit = !!editKey
    const { isFirst } = saveEntry(today, savedText, editKey ?? undefined)
    setText('')
    setEditKey(null)
    setConfirmSaveOpen(false)
    showToast(wasEdit ? 'Entry updated.' : isFirst ? '+5 Rank XP + 2 wallet pts for journaling!' : 'Entry saved.')
  }

  function handleEdit(key: string) {
    const entry = (decrypted !== null ? decrypted : journal)[key]
    setText(entry ?? '')
    setEditKey(key)
    setMode('write')
  }

  function confirmDelete(key: string) {
    setDeleteKey(key)
  }

  function handleDelete() {
    if (!deleteKey) return
    deleteEntry(deleteKey)
    if (decrypted !== null) {
      setDecrypted(prev => { const n = { ...prev }; delete n[deleteKey]; return n })
    }
    setDeleteKey(null)
    showToast('Entry deleted.')
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const displayEntries = decrypted !== null ? decrypted : journal

  const todayEntries = Object.keys(displayEntries).filter(k => k.startsWith(today))

  const allKeys  = Object.keys(displayEntries).sort().reverse()
  const byDay: Record<string, string[]> = {}
  const dayOrder: string[] = []
  allKeys.forEach(k => {
    const day = k.slice(0, 10)
    if (!byDay[day]) { byDay[day] = []; dayOrder.push(day) }
    byDay[day].push(k)
  })
  const JOURNAL_PAGE_SIZE = 10
  const { page: historyPage, totalPages: historyTotalPages, pageItems: dayOrderPage, hasPrev, hasNext, prevPage, nextPage } = usePagination(dayOrder, JOURNAL_PAGE_SIZE)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PinGate title="Journal PIN">
    <div>
      {/* Privacy badge */}
      {encToken && (
        <div className="vx-tile vx-accent-l flex items-center gap-1.5 mb-3 px-2.5 py-1.5 text-[11px]" data-tone="cyan" style={{ color: 'var(--vx-emerald)' }}>
          <span>🔒</span>
          <span>End-to-end encrypted. The developer cannot read your entries.</span>
        </div>
      )}

      {/* Loading state — key loaded, still decrypting */}
      {waitingDecrypt && (
        <div className="flex justify-center items-end min-h-[80vh] pb-20">
          <div className="text-sm" style={{ color: 'var(--vx-fg-4)' }}>Decrypting journal entries…</div>
        </div>
      )}

      {/* Encryption gate — passphrase prompt */}
      {needsPassphrase && (
        <div className="flex justify-center items-end min-h-[80vh] pb-20">
          <div className="w-full max-w-sm text-center">
            <div className="text-[15px] font-semibold mb-1">Journal Encryption</div>
            <div className="text-xs mb-4" style={{ color: 'var(--vx-fg-4)' }}>
              Enter your encryption passphrase to decrypt journal entries.
            </div>
            <input
              type="password"
              value={encPass}
              onChange={e => setEncPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEncUnlock()}
              placeholder="Encryption passphrase"
              className="w-full vx-field mb-2"
            />
            <div className="text-xs h-4 mb-2" style={{ color: 'var(--red)' }}>{encError}</div>
            <button
              onClick={handleEncUnlock}
              disabled={encBusy || !encPass}
              className="vx-btn vx-btn-primary w-full py-2 text-sm disabled:opacity-40"
            >
              {encBusy ? 'Decrypting…' : 'Unlock Journal'}
            </button>
            {!showDisable && (
              <button
                onClick={() => setShowDisable(true)}
                className="mt-2 text-xs underline"
                style={{ color: 'var(--vx-fg-4)' }}
              >
                Disable encryption
              </button>
            )}
            {showDisable && (
              <div className="mt-3 text-left">
                <div className="text-xs mb-2" style={{ color: 'var(--vx-fg-4)' }}>Enter passphrase to decrypt all entries and disable encryption:</div>
                <input
                  type="password"
                  value={disablePass}
                  onChange={e => setDisablePass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDisableEnc()}
                  placeholder="Current passphrase"
                  className="w-full vx-field mb-1"
                />
                <div className="text-xs h-4 mb-1" style={{ color: 'var(--red)' }}>{disableError}</div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDisableEnc}
                    disabled={disableBusy || !disablePass}
                    className="vx-btn vx-btn-danger flex-1 text-xs disabled:opacity-40"
                  >
                    {disableBusy ? 'Decrypting…' : 'Disable Encryption'}
                  </button>
                  <button
                    onClick={() => { setShowDisable(false); setDisablePass(''); setDisableError('') }}
                    className="vx-btn vx-btn-ghost text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Encryption setup form */}
      {encSetup && (
        <div className="vx-tile max-w-sm mx-auto mb-4 p-3">
          <div className="text-[13px] font-semibold mb-1">Set encryption passphrase</div>
          <div className="text-[11px] mb-3" style={{ color: 'var(--vx-fg-4)' }}>
            Min 8 characters, at least one capital letter. Existing entries will be encrypted.
          </div>
          <input
            type="password"
            value={encSetupPass}
            onChange={e => setEncSetupPass(e.target.value)}
            placeholder="Passphrase"
            className="w-full vx-field mb-2"
          />
          <input
            type="password"
            value={encSetupConfirm}
            onChange={e => setEncSetupConfirm(e.target.value)}
            placeholder="Confirm passphrase"
            className="w-full vx-field mb-2"
          />
          <div className="text-xs h-4 mb-1" style={{ color: 'var(--red)' }}>{encSetupError}</div>
          <div className="flex gap-2">
            <button
              onClick={handleEncSetup}
              disabled={encBusy}
              className="vx-btn vx-btn-primary flex-1 text-xs disabled:opacity-40"
            >
              {encBusy ? 'Encrypting…' : 'Enable Encryption'}
            </button>
            <button
              onClick={() => { setEncSetup(false); setEncSetupError(''); setEncSetupPass(''); setEncSetupConfirm('') }}
              className="vx-btn vx-btn-ghost text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Journal UI — only shown when encryption is unlocked or not set */}
      {showJournal && (
        <>
          {mode === 'history' && (
            <>
              <div className="vx-modeswitch mb-3.5 w-auto inline-flex">
                {[{k:'write',l:'Write'},{k:'history',l:'Past entries'}].map(m => (
                  <button key={m.k} onClick={() => setMode(m.k as any)} className={`vx-modeswitch-item px-4 py-1.5 text-[13px] ${mode === m.k ? 'vx-active' : ''}`}>
                    {mode === m.k && (
                      <motion.div layoutId="vx-journal-mode-indicator" className="vx-modeswitch-indicator" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                    )}
                    <span className="relative z-10">{m.l}</span>
                  </button>
                ))}
              </div>
              {!encToken && !encSetup && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => setEncSetup(true)}
                    className="vx-pill vx-tinted text-xs font-semibold"
                    data-tone="emerald"
                  >
                    🔒 Encrypt Journal
                  </button>
                </div>
              )}
            </>
          )}

          {mode === 'write' && (
            <div className="flex flex-col justify-center min-h-[70vh]">
              <div className="vx-modeswitch mb-3.5 w-auto inline-flex self-start">
                {[{k:'write',l:'Write'},{k:'history',l:'Past entries'}].map(m => (
                  <button key={m.k} onClick={() => setMode(m.k as any)} className={`vx-modeswitch-item px-4 py-1.5 text-[13px] ${mode === m.k ? 'vx-active' : ''}`}>
                    {mode === m.k && (
                      <motion.div layoutId="vx-journal-mode-indicator" className="vx-modeswitch-indicator" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                    )}
                    <span className="relative z-10">{m.l}</span>
                  </button>
                ))}
              </div>
              {!encToken && !encSetup && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => setEncSetup(true)}
                    className="vx-pill vx-tinted text-xs font-semibold"
                    data-tone="emerald"
                  >
                    🔒 Encrypt Journal
                  </button>
                </div>
              )}
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vx-fg-4)' }}>
                {editKey ? `Editing: ${formatDate(editKey.slice(0, 10))} at ${editKey.slice(11)}` : `Today's entry — ${formatDate(today)}`}
              </div>
              <VoiceControls dateKey={today} onAppendText={(t) => setText(prev => (prev ? prev.replace(/\s*$/, ' ') : '') + t)} />
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onInput={e => autosizeTextarea(e.currentTarget)}
                placeholder="What's on your mind today? Thoughts, wins, blockers, reflections..."
                className="w-full min-h-[140px] vx-field leading-relaxed resize-none overflow-hidden"
              />
              <div className="flex gap-2 mt-2.5 items-center flex-wrap">
                <button onClick={requestSave} className="vx-btn vx-btn-primary text-xs">
                  {editKey ? 'Update entry' : 'Save entry (+5 XP)'}
                </button>
                <button
                  onClick={() => { setText(''); setEditKey(null) }}
                  className="vx-btn vx-btn-ghost text-xs"
                >
                  ↺ Reset
                </button>
                {todayEntries.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--vx-fg-4)' }}>
                    Saved {todayEntries.length} entr{todayEntries.length === 1 ? 'y' : 'ies'} today ✓
                  </span>
                )}
              </div>
            </div>
          )}

          {mode === 'history' && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vx-fg-4)' }}>All journal entries</div>
              {dayOrder.length === 0 && <div className="text-[13px] py-3.5 text-center" style={{ color: 'var(--vx-fg-4)' }}>No entries yet.</div>}
              {dayOrderPage.map(day => (
                <Accordion key={day} variant="vx" title={<span className="font-semibold">{formatDate(day)} <span className="text-[11px] font-normal ml-2" style={{ color: 'var(--vx-fg-4)' }}>{byDay[day].length} entr{byDay[day].length === 1 ? 'y' : 'ies'}</span></span>}>
                  {byDay[day].map(key => (
                    <div key={key} className="py-2.5" style={{ borderTop: '1px solid var(--vx-border)' }}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--vx-fg-4)' }}>{key.slice(11) || key}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEdit(key)} className="vx-btn vx-btn-icon">✏</button>
                          <button onClick={() => confirmDelete(key)} className="vx-btn vx-btn-icon vx-danger">🗑</button>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--vx-fg-1)' }}>{displayEntries[key]}</p>
                    </div>
                  ))}
                </Accordion>
              ))}
              <Pagination page={historyPage} totalPages={historyTotalPages} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
            </>
          )}

          <Modal open={confirmSaveOpen} onClose={() => setConfirmSaveOpen(false)} title={editKey ? 'Update entry?' : 'Save entry?'} variant="vx">
            <p className="text-sm mb-4" style={{ color: 'var(--vx-fg-2)' }}>
              {editKey
                ? 'Save your changes to this journal entry?'
                : 'Save this journal entry for today?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmSaveOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleSave}
                className="vx-btn vx-btn-primary text-sm"
              >
                {editKey ? 'Update' : 'Save'}
              </button>
            </div>
          </Modal>

          <Modal open={!!deleteKey} onClose={() => setDeleteKey(null)} title="Delete entry?" variant="vx">
            <p className="text-sm mb-4" style={{ color: 'var(--vx-fg-2)' }}>
              This journal entry will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteKey(null)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                className="vx-btn vx-btn-danger text-sm"
              >
                Delete
              </button>
            </div>
          </Modal>
        </>
      )}
    </div>
    </PinGate>
  )
}
