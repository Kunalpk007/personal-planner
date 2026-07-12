'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
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
  const pathname  = usePathname()
  const router    = useRouter()
  const prevPath  = useRef(pathname)
  const touchX    = useRef(0)
  const touchY    = useRef(0)
  const [navigating, setNavigating] = useState(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey, setAnimKey] = useState(0)
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null)

  useOvernightCheck()

  // Detect route change → play slide animation + clear loading state
  useEffect(() => {
    if (prevPath.current === pathname) return
    const prevIdx = TABS.findIndex(t => t.href === prevPath.current)
    const currIdx = TABS.findIndex(t => t.href === pathname)
    if (prevIdx >= 0 && currIdx >= 0) {
      setSlideDir(currIdx > prevIdx ? 'right' : 'left')
      setAnimKey(k => k + 1)
    }
    setNavigating(false)
    setOptimisticTab(null)
    prevPath.current = pathname
  }, [pathname])

  const navigateTab = useCallback((href: string) => {
    if (href === pathname) return
    setNavigating(true)
    setOptimisticTab(href)
    const currIdx = TABS.findIndex(t => t.href === href)
    const prevIdx = TABS.findIndex(t => t.href === pathname)
    if (prevIdx >= 0 && currIdx >= 0) {
      setSlideDir(currIdx > prevIdx ? 'right' : 'left')
    }
    router.push(href)
  }, [pathname, router])

  // Touch swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
    touchY.current = e.touches[0].clientY
  }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = TABS.findIndex(t => t.href === pathname)
    if (dx < 0 && idx < TABS.length - 1) navigateTab(TABS[idx + 1].href)
    else if (dx > 0 && idx > 0) navigateTab(TABS[idx - 1].href)
  }, [pathname, navigateTab])

  return (
    <>
      {/* Top navigation bar */}
      <nav className="nav-top">
        <div className="nav-top-inner">
          <button
            onClick={() => navigateTab('/dashboard')}
            className="nav-brand"
          >
            Personal Planner
          </button>
          <div className="tab-bar-scroll">
            {TABS.map(tab => (
              <button
                key={tab.href}
                onClick={() => navigateTab(tab.href)}
                className={`tab-item ${(optimisticTab ?? pathname) === tab.href ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <SyncStatusBadge />
        </div>
      </nav>

      {/* Loading bar shown during tab transitions */}
      {navigating && <div className="nav-loading-bar" />}

      {/* Page content with swipe + animation */}
      <main
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ position: 'relative' }}
      >
        <div key={animKey ? `${pathname}-${animKey}` : pathname} className={`page-container page-enter-${slideDir}`}>
          {children}
        </div>
      </main>

      {/* Bottom mobile nav */}
      <nav className="bottom-nav">
        {TABS.map(tab => {
          const Icon = TAB_ICONS[tab.href]
          const active = (optimisticTab ?? pathname) === tab.href
          return (
            <button
              key={tab.href}
              onClick={() => navigateTab(tab.href)}
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
