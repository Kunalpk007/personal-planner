'use client'
import { useEffect, useRef, useState } from 'react'

/** Debounced autosave for free-text fields — saves 3s after typing stops,
 *  but force-flushes immediately on blur, the tab/app going to background,
 *  or the page closing, so normal navigation (or closing the tab mid-type)
 *  never loses more than a few seconds of unsaved text.
 *
 *  Relies on the CALLER remounting this field (e.g. `key={date}` on the
 *  containing form) whenever the underlying record changes — that triggers
 *  this hook's unmount flush before the next value is shown, instead of
 *  needing to detect a changed `initialValue` prop mid-life. */
export function useDebouncedSave(initialValue: string, onSave: (v: string) => void, delayMs = 3000) {
  const [local, setLocal] = useState(initialValue)
  const localRef = useRef(local)
  const savedRef = useRef(initialValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { localRef.current = local }, [local])

  function flush() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (localRef.current !== savedRef.current) {
      savedRef.current = localRef.current
      onSave(localRef.current)
    }
  }

  function change(next: string) {
    setLocal(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, delayMs)
  }

  useEffect(() => {
    const onHide = () => flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      flush()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
    // Intentionally empty deps — flush/change close over refs, not state,
    // so they stay correct without needing to be in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { value: local, onChange: change, onBlur: flush }
}
