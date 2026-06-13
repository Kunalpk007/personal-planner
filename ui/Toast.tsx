'use client'
import { useEffect, useState } from 'react'

interface ToastState {
  message: string
  visible: boolean
}

let _setToast: ((msg: string) => void) | null = null

export function showToast(msg: string) {
  _setToast?.(msg)
}

export function Toast() {
  const [state, setState] = useState<ToastState>({ message: '', visible: false })
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    _setToast = (msg: string) => {
      setState({ message: msg, visible: true })
      if (timer) clearTimeout(timer)
      const t = setTimeout(() => setState(s => ({ ...s, visible: false })), 2800)
      setTimer(t)
    }
    return () => { _setToast = null }
  }, [])

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-2.5 rounded-xl
        text-sm font-medium pointer-events-none transition-opacity duration-300
        bg-[#1a2e0a] text-[#c0dd97] max-w-[90vw] text-center
        ${state.visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {state.message}
    </div>
  )
}
