'use client'
import { useEffect, useRef, useState } from 'react'
import { showToast } from '@/ui/Toast'

// Minimal typing for the browser Speech Recognition API (not in TS DOM libs).
type SR = {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function getSR(): (new () => SR) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Speech-to-text (dictation) for the journal.
 *
 *  The "Record voice" (audio note upload) feature that used to live here has
 *  been removed for now — it always failed. TWO stacked root causes, found
 *  by reading top to bottom what actually happens when it's tapped:
 *  1. **The real blocker**: `next.config.ts`'s global security headers send
 *     `Permissions-Policy: microphone=()` on every response — an empty
 *     allowlist, which disables microphone access for every origin,
 *     including the app's own (`'self'` is not in the list). That header is
 *     enforced by the browser itself, before any app code runs, so
 *     `navigator.mediaDevices.getUserMedia({ audio: true })` was rejected
 *     every single time, surfacing as the "Mic permission denied" toast —
 *     not an actual OS/browser permission prompt being denied, but the page
 *     itself telling the browser the mic isn't allowed. (`camera=()` and
 *     `geolocation=()` are set the same way, presumably as a blanket
 *     hardening default when those headers were added — nothing else in the
 *     app currently needs camera/mic/location, so this had gone unnoticed.)
 *  2. **The second blocker, which would have fired even with #1 fixed**:
 *     the upload step used Firebase Storage via `uploadJournalAudio`
 *     (`lib/firebase/storage.ts`), which requires Storage's security rules
 *     to be deployed for this project. Neither a `storage.rules` file nor a
 *     `firebase.json` referencing one exist anywhere in this repo — Storage
 *     was never actually provisioned, so Firebase's default deny-all rules
 *     reject every upload attempt and `uploadBytes` throws.
 *  Fixing #1 is a one-line header change but still leaves #2 blocking a
 *  successful save, and #2 needs Firebase Storage enabled + rules deployed
 *  from the console/CLI with real project access — not something that can
 *  be done from here. So rather than "fix" it halfway and leave it visibly
 *  broken in a new way, it's been taken out entirely for now. Dictation
 *  (below) depends on neither — it's a pure browser Speech Recognition API
 *  with no mic-stream/Storage involvement — and is unaffected. */
export function VoiceControls({ dateKey: _dateKey, onAppendText }: {
  dateKey: string
  onAppendText: (text: string) => void
}) {
  const [listening, setListening] = useState(false)
  const srRef = useRef<SR | null>(null)

  const srSupported = !!getSR()

  useEffect(() => () => { try { srRef.current?.stop() } catch {} }, [])

  function toggleDictation() {
    if (listening) { srRef.current?.stop(); return }
    const Ctor = getSR()
    if (!Ctor) { showToast('Speech recognition not supported on this browser.'); return }
    const sr = new Ctor()
    sr.lang = 'en-US'; sr.continuous = true; sr.interimResults = false
    sr.onresult = (e) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
      }
      if (finalText) onAppendText(finalText.trim() + ' ')
    }
    sr.onerror = () => { setListening(false) }
    sr.onend   = () => { setListening(false) }
    srRef.current = sr
    try { sr.start(); setListening(true) } catch { showToast('Could not start the mic.') }
  }

  if (!srSupported) return null

  return (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      <button type="button" onClick={toggleDictation}
        className="vx-chip text-[12px]"
        style={listening
          ? { background: 'rgba(239,68,68,0.12)', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.4)' }
          : { background: 'var(--vx-card)', color: 'var(--vx-fg-3)', borderColor: 'var(--vx-border)' }}>
        {listening ? '● Listening… tap to stop' : '🎤 Dictate'}
      </button>
    </div>
  )
}
