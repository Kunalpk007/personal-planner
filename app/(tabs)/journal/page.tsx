'use client'
import { useState, useEffect } from 'react'
import { useDayKey }       from '@/hooks/useDayKey'
import { formatDate }      from '@/lib/engine/cutoff'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { PinGate }         from '@/ui/PinGate'
import { tryUnlock, encryptText, decryptText, validatePassphrase } from '@/lib/crypto/journal-encrypt'
import { hasJournalKey, getJournalKey, setJournalKey, clearJournalKey } from '@/lib/crypto/journal-key'
import { createEncryptionKey } from '@/lib/crypto/journal-encrypt'

export default function JournalPage() {
  const { today }   = useDayKey()
  const [mode, setMode] = useState<'write' | 'history'>('write')
  const [text, setText] = useState('')
  const [editKey, setEditKey]   = useState<string | null>(null)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)

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

  async function handleSave() {
    if (!text.trim()) { showToast('Write something first.'); return }
    const key = hasJournalKey() ? getJournalKey()! : null
    let savedText = text.trim()
    if (key) {
      savedText = await encryptText(savedText, key)
    }
    const { isFirst } = saveEntry(today, savedText, editKey ?? undefined)
    setText('')
    setEditKey(null)
    showToast(editKey ? 'Entry updated.' : isFirst ? '+5 Rank XP + 2 wallet pts for journaling!' : 'Entry saved.')
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PinGate title="Journal PIN">
    <div>
      {/* Privacy badge */}
      {encToken && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-[8px] text-[11px] border border-[var(--green-mid)] bg-[var(--green-bg)] text-[var(--green)]">
          <span>🔒</span>
          <span>End-to-end encrypted. The developer cannot read your entries.</span>
        </div>
      )}

      {/* Loading state — key loaded, still decrypting */}
      {waitingDecrypt && (
        <div className="flex justify-center pt-10">
          <div className="text-sm text-[var(--text3)]">Decrypting journal entries…</div>
        </div>
      )}

      {/* Encryption gate — passphrase prompt */}
      {needsPassphrase && (
        <div className="flex justify-center pt-6">
          <div className="w-full max-w-sm text-center">
            <div className="text-[15px] font-semibold mb-1">Journal Encryption</div>
            <div className="text-xs text-[var(--text3)] mb-4">
              Enter your encryption passphrase to decrypt journal entries.
            </div>
            <input
              type="password"
              value={encPass}
              onChange={e => setEncPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEncUnlock()}
              placeholder="Encryption passphrase"
              className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-2"
            />
            <div className="text-xs text-red-500 h-4 mb-2">{encError}</div>
            <button
              onClick={handleEncUnlock}
              disabled={encBusy || !encPass}
              className="w-full px-3.5 py-2 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-40"
            >
              {encBusy ? 'Decrypting…' : 'Unlock Journal'}
            </button>
            {!showDisable && (
              <button
                onClick={() => setShowDisable(true)}
                className="mt-2 text-xs text-[var(--text3)] underline"
              >
                Disable encryption
              </button>
            )}
            {showDisable && (
              <div className="mt-3 text-left">
                <div className="text-xs text-[var(--text3)] mb-2">Enter passphrase to decrypt all entries and disable encryption:</div>
                <input
                  type="password"
                  value={disablePass}
                  onChange={e => setDisablePass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDisableEnc()}
                  placeholder="Current passphrase"
                  className="w-full text-[13px] p-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-1"
                />
                <div className="text-xs text-red-500 h-4 mb-1">{disableError}</div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDisableEnc}
                    disabled={disableBusy || !disablePass}
                    className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/30 disabled:opacity-40"
                  >
                    {disableBusy ? 'Decrypting…' : 'Disable Encryption'}
                  </button>
                  <button
                    onClick={() => { setShowDisable(false); setDisablePass(''); setDisableError('') }}
                    className="px-3 py-1.5 rounded-md text-xs border border-[var(--border2)] text-[var(--text3)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Encryption setup prompt (when no token set yet) */}
      {!encToken && !encSetup && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setEncSetup(true)}
            className="px-2.5 py-1 rounded-md text-[11px] border border-[var(--border2)] text-[var(--text3)]"
          >
            🔒 Encrypt journal
          </button>
        </div>
      )}

      {/* Encryption setup form */}
      {encSetup && (
        <div className="max-w-sm mx-auto mb-4 p-3 rounded-[10px] border border-[var(--border2)] bg-[var(--bg2)]">
          <div className="text-[13px] font-semibold mb-1">Set encryption passphrase</div>
          <div className="text-[11px] text-[var(--text3)] mb-3">
            Min 8 characters, at least one capital letter. Existing entries will be encrypted.
          </div>
          <input
            type="password"
            value={encSetupPass}
            onChange={e => setEncSetupPass(e.target.value)}
            placeholder="Passphrase"
            className="w-full text-[13px] p-2 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none mb-2"
          />
          <input
            type="password"
            value={encSetupConfirm}
            onChange={e => setEncSetupConfirm(e.target.value)}
            placeholder="Confirm passphrase"
            className="w-full text-[13px] p-2 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none mb-2"
          />
          <div className="text-xs text-red-500 h-4 mb-1">{encSetupError}</div>
          <div className="flex gap-2">
            <button
              onClick={handleEncSetup}
              disabled={encBusy}
              className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-40"
            >
              {encBusy ? 'Encrypting…' : 'Enable Encryption'}
            </button>
            <button
              onClick={() => { setEncSetup(false); setEncSetupError(''); setEncSetupPass(''); setEncSetupConfirm('') }}
              className="px-3 py-1.5 rounded-md text-xs border border-[var(--border2)] text-[var(--text3)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Journal UI — only shown when encryption is unlocked or not set */}
      {showJournal && (
        <>
          <div className="inline-flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5">
            {[{k:'write',l:'Write'},{k:'history',l:'Past entries'}].map(m => (
              <button key={m.k} onClick={() => setMode(m.k as any)}
                className={`px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${mode === m.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
                {m.l}
              </button>
            ))}
          </div>

          {mode === 'write' && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
                {editKey ? `Editing: ${formatDate(editKey.slice(0, 10))} at ${editKey.slice(11)}` : `Today's entry — ${formatDate(today)}`}
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="What's on your mind today? Thoughts, wins, blockers, reflections..."
                className="w-full min-h-[140px] text-[13px] p-3 rounded-[10px] border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none font-sans leading-relaxed resize-y"
              />
              <div className="flex gap-2 mt-2.5 items-center flex-wrap">
                <button onClick={handleSave} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
                  {editKey ? 'Update entry' : 'Save entry (+5 XP)'}
                </button>
                <button
                  onClick={() => { setText(''); setEditKey(null) }}
                  className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]"
                >
                  ↺ Reset
                </button>
                {todayEntries.length > 0 && (
                  <span className="text-xs text-[var(--text3)]">
                    Saved {todayEntries.length} entr{todayEntries.length === 1 ? 'y' : 'ies'} today ✓
                  </span>
                )}
              </div>
            </>
          )}

          {mode === 'history' && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">All journal entries</div>
              {dayOrder.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No entries yet.</div>}
              {dayOrder.map(day => (
                <Accordion key={day} title={<span className="font-semibold">{formatDate(day)} <span className="text-[11px] text-[var(--text3)] font-normal ml-2">{byDay[day].length} entr{byDay[day].length === 1 ? 'y' : 'ies'}</span></span>}>
                  {byDay[day].map(key => (
                    <div key={key} className="border-t border-[var(--border)] py-2.5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-[var(--text3)] font-semibold">{key.slice(11) || key}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleEdit(key)} className="btn-icon">✏</button>
                          <button onClick={() => confirmDelete(key)} className="btn-icon danger">🗑</button>
                        </div>
                      </div>
                      <p className="text-[13px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{displayEntries[key]}</p>
                    </div>
                  ))}
                </Accordion>
              ))}
            </>
          )}

          <Modal open={!!deleteKey} onClose={() => setDeleteKey(null)} title="Delete entry?">
            <p className="text-sm text-[var(--text2)] mb-4">
              This journal entry will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteKey(null)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-red-500/10 text-red-500 border border-red-500/30"
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
