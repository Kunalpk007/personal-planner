'use client'
import { useState, useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Toast }            from '@/ui/Toast'
import { ManagerModal }     from '@/ui/ManagerModal'
import { ThemeApplier }     from '@/ui/ThemeApplier'
import { useOvernightCheck } from '@/hooks/useOvernightCheck'
import { StoreBootstrap }   from '@/features/auth/StoreBootstrap'
import { PwaBootstrap }     from '@/features/pwa/PwaBootstrap'
import { AppShellErrorBoundary } from './AppShellErrorBoundary'
import { SyncStatusBadge }  from '@/ui/SyncStatusBadge'

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function TasksIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function JournalIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}
function RewardsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l2 2 4-4" />
    </svg>
  )
}
function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const TAB_ICONS: Record<string, React.ComponentType> = {
  '/dashboard': DashboardIcon,
  '/tasks': TasksIcon,
  '/journal': JournalIcon,
  '/rewards': RewardsIcon,
  '/history': HistoryIcon,
  '/settings': SettingsIcon,
}

const TABS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/tasks',     label: 'Tasks' },
  { href: '/journal',   label: 'Journal' },
  { href: '/rewards',   label: 'Rewards' },
  { href: '/history',   label: 'History' },
  { href: '/settings',  label: 'Settings' },
]

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  useOvernightCheck()

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid var(--color-border)',
        padding: '0 var(--spacing-page)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }} className="banner-scroll">
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 32, flexShrink: 0 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Personal Planner
          </button>
          <div className="tab-group desktop-tabs" style={{ border: 'none', marginBottom: 0, flex: 1 }}>
            {TABS.map(tab => {
              const emojiMap: Record<string, string> = { '/dashboard': '🏠', '/tasks': '✅', '/journal': '📓', '/rewards': '🎁', '/history': '📅', '/settings': '⚙️' }
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`tab-item ${pathname === tab.href ? 'active' : ''}`}
                >
                  <span className="mr-1.5">{emojiMap[tab.href]}</span>{tab.label}
                </button>
              )
            })}
          </div>
          <SyncStatusBadge />
        </div>
      </nav>

      <main className="page-container">
        {children}
      </main>

      <nav className="bottom-nav">
        {TABS.map(tab => {
          const Icon = TAB_ICONS[tab.href]
          const active = pathname === tab.href
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`bottom-tab ${active ? 'active' : ''}`}
            >
              <Icon />
              <span className="bottom-tab__label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <Toast />
      <ManagerModal />
      <PwaBootstrap />
    </>
  )
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const [storeReady, setStoreReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const onReady = useCallback(() => setStoreReady(true), [])

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <ThemeApplier />
      <StoreBootstrap onReady={onReady} />

      {storeReady ? (
        <AppShellErrorBoundary>
          <AppShell>{children}</AppShell>
        </AppShellErrorBoundary>
      ) : timedOut ? (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 40,
          color: 'var(--color-text-muted)',
          fontSize: 13,
          textAlign: 'center',
        }}>
          <p>Loading is taking longer than expected.</p>
          <button onClick={() => window.location.href = '/login'}
            className="btn-secondary" style={{ fontSize: 13 }}>
            Back to login
          </button>
        </div>
      ) : (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 13,
        }}>
          Loading…
        </div>
      )}
    </>
  )
}
