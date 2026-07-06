'use client'
export default function SettingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <p className="text-[var(--text2)] text-sm mb-3">Settings failed to load.</p>
      <button onClick={reset} className="px-4 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
        Try again
      </button>
    </div>
  )
}
