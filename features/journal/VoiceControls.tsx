'use client'
import { useEffect, useRef, useState } from 'react'
import { showToast } from '@/ui/Toast'
import { getClientAuth } from '@/lib/firebase/client'
import { uploadJournalAudio } from '@/lib/firebase/storage'

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

/** Speech-to-text (dictation) + optional voice-note recording for the journal.
 *  - Dictation appends transcribed text via onAppendText (no infra needed).
 *  - Recording captures audio and uploads it to Firebase Storage (best-effort);
 *    on success it appends a markdown link to the entry via onAppendText. */
export function VoiceControls({ dateKey, onAppendText }: {
  dateKey: string
  onAppendText: (text: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const srRef = useRef<SR | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const srSupported = !!getSR()
  const recSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined'

  useEffect(() => () => { try { srRef.current?.stop() } catch {}; try { recRef.current?.stop() } catch {} }, [])

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

  async function toggleRecording() {
    if (recording) { recRef.current?.stop(); return }
    if (!recSupported) { showToast('Recording not supported on this browser.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setLocalUrl(URL.createObjectURL(blob))
        setBusy(true)
        try {
          const uid = getClientAuth().currentUser?.uid ?? 'anon'
          const url = await uploadJournalAudio(uid, dateKey, blob)
          onAppendText(`\n🎙️ [Voice note](${url})\n`)
          showToast('Voice note saved.')
        } catch {
          showToast('Recorded — but cloud upload needs Firebase Storage enabled. Playable below for now.')
        }
        setBusy(false)
      }
      recRef.current = rec
      rec.start(); setRecording(true)
    } catch {
      showToast('Mic permission denied.')
    }
  }

  useEffect(() => {
    if (!recording) return
    const rec = recRef.current
    if (!rec) return
    const onStop = () => setRecording(false)
    rec.addEventListener('stop', onStop, { once: true })
    return () => rec.removeEventListener('stop', onStop)
  }, [recording])

  if (!srSupported && !recSupported) return null

  return (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      {srSupported && (
        <button type="button" onClick={toggleDictation}
          className={`text-[12px] px-2.5 py-1.5 rounded-md border ${listening ? 'bg-[var(--red-bg)] text-[var(--red)] border-[#E24B4A]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
          {listening ? '● Listening… tap to stop' : '🎤 Dictate'}
        </button>
      )}
      {recSupported && (
        <button type="button" onClick={toggleRecording} disabled={busy}
          className={`text-[12px] px-2.5 py-1.5 rounded-md border disabled:opacity-50 ${recording ? 'bg-[var(--red-bg)] text-[var(--red)] border-[#E24B4A]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
          {busy ? 'Saving…' : recording ? '■ Stop recording' : '🎙️ Record voice'}
        </button>
      )}
      {localUrl && <audio src={localUrl} controls className="h-8 max-w-[180px]" />}
    </div>
  )
}
