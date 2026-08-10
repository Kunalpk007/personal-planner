'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlannerStore }  from '@/store'
import { Toast }            from '@/ui/Toast'
import { ManagerModal }     from '@/ui/ManagerModal'
import { ThemeApplier }     from '@/ui/ThemeApplier'
import { FontScaleApplier } from '@/ui/FontScaleApplier'
import { useOvernightCheck } from '@/hooks/useOvernightCheck'
import { StoreBootstrap }   from '@/features/auth/StoreBootstrap'
import { PwaBootstrap }     from '@/features/pwa/PwaBootstrap'
import { WaterReminder }    from '@/features/wellness/WaterReminder'
import { AppShellErrorBoundary } from './AppShellErrorBoundary'
import { SyncStatusBadge }  from '@/ui/SyncStatusBadge'
import { NotificationBell } from '@/ui/NotificationBell'
import { FLAGS }            from '@/constants/feature-flags'

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
function FriendsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
  '/friends': FriendsIcon,
  '/history': HistoryIcon,
  '/settings': SettingsIcon,
}

// Friends used to be its own top-level tab; it's now a mode on the Tasks
// page instead (alongside Today's Tasks / Recurring Templates — see
// app/(tabs)/tasks/page.tsx) so it doesn't cost a nav slot of its own.
const TABS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/tasks',     label: 'Tasks' },
  { href: '/journal',   label: 'Journal' },
  { href: '/rewards',   label: 'Rewards' },
  { href: '/history',   label: 'History' },
  { href: '/settings',  label: 'Settings' },
]

const SCOPE_CLASS: Record<string, string> = {
  dark:  'vx-dark-scope',
  light: 'vx-light-scope',
  cream: 'vx-cream-scope',
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const theme     = usePlannerStore(s => s.cfg.theme)
  const prevPath  = useRef(pathname)
  const touchX    = useRef(0)
  const touchY    = useRef(0)
  const ignoreSwipe = useRef(false)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey, setAnimKey] = useState(0)
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null)
  // Tab switches (and swipes) can take a visible moment — a dev-mode route
  // compile, a slow device, etc. — during which the screen used to show no
  // feedback at all ("looks dead"). `navigating` flips true the instant a
  // switch is requested and false once the new pathname actually commits;
  // `showLoader` only renders the bar after a short delay so a genuinely
  // instant switch doesn't flash it needlessly.
  const [navigating, setNavigating] = useState(false)
  const [showLoader, setShowLoader] = useState(false)
  const loaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useOvernightCheck()

  useEffect(() => {
    if (navigating) {
      loaderTimerRef.current = setTimeout(() => setShowLoader(true), 120)
    } else {
      if (loaderTimerRef.current) clearTimeout(loaderTimerRef.current)
      setShowLoader(false)
    }
    return () => { if (loaderTimerRef.current) clearTimeout(loaderTimerRef.current) }
  }, [navigating])

  // Warm the client-side cache for every tab up front so the first click on
  // each is instant — the tab buttons use router.push (not <Link>), which
  // otherwise wouldn't prefetch and would fetch each route cold on click.
  useEffect(() => {
    TABS.forEach(t => router.prefetch(t.href))
  }, [router])

  // Detect route change → play slide animation
  useEffect(() => {
    if (prevPath.current === pathname) return
    const prevIdx = TABS.findIndex(t => t.href === prevPath.current)
    const currIdx = TABS.findIndex(t => t.href === pathname)
    if (prevIdx >= 0 && currIdx >= 0) {
      setSlideDir(currIdx > prevIdx ? 'right' : 'left')
      setAnimKey(k => k + 1)
    }
    setOptimisticTab(null)
    setNavigating(false)
    prevPath.current = pathname
  }, [pathname])

  const navigateTab = useCallback((href: string) => {
    if (href === pathname) return
    setOptimisticTab(href)
    setNavigating(true)
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
    // Don't let a stray swipe change tabs (and lose typed input) while a modal
    // is open or while the user is interacting with a field / scrollable list.
    const t = e.target as Element | null
    const inInteractive = !!t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')
    ignoreSwipe.current = inInteractive || !!document.querySelector('[role="dialog"]')
  }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (ignoreSwipe.current) { ignoreSwipe.current = false; return }
    const dx = e.changedTouches[0].clientX - touchX.current
    const dy = e.changedTouches[0].clientY - touchY.current
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = TABS.findIndex(t => t.href === pathname)
    if (dx < 0 && idx < TABS.length - 1) navigateTab(TABS[idx + 1].href)
    else if (dx > 0 && idx > 0) navigateTab(TABS[idx - 1].href)
  }, [pathname, navigateTab])

  const activeTab = optimisticTab ?? pathname

  return (
    <>
      {/* Ambient background — shared across every tab. Previously three
          large, brightly-colored blurred orbs (violet/pink/cyan); now a
          single, very low-opacity accent-tinted glow so the canvas reads as
          a calm, premium flat surface (see app/globals.css's `.vx-orb*`
          rules for the actual toning-down). */}
      <div className="vx-aurora">
        <div className="vx-orb vx-orb1" />
      </div>

      {/* Route-switch loading bar — see the `navigating`/`showLoader` state
          above. A thin animated bar at the very top of the viewport, the
          same pattern as GitHub/YouTube's top-of-page progress indicator,
          so a tab tap always gets immediate visual feedback even if the
          new page takes a moment to actually render. */}
      <AnimatePresence>
        {showLoader && (
          <motion.div
            className="vx-route-progress"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.82 }}
            exit={{ scaleX: 1, opacity: 0, transition: { scaleX: { duration: 0.15 }, opacity: { duration: 0.25, delay: 0.1 } } }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Top navigation bar — floating glass pill, spring-sliding active indicator
          (see project.md's "UI Redesign Initiative": shared app-shell chrome is
          upgraded now even though most tabs' own content isn't redesigned yet). */}
      <nav className="vx-nav-top">
        <div className="vx-nav-top-inner">
          <button
            onClick={() => navigateTab('/dashboard')}
            className="vx-nav-brand vx-text-hero"
          >
            Personal Planner
          </button>
          <div className="vx-tab-scroll">
            {TABS.map(tab => {
              const active = activeTab === tab.href
              return (
                <button
                  key={tab.href}
                  onClick={() => navigateTab(tab.href)}
                  className={`vx-tab-item ${active ? 'vx-active' : ''}`}
                >
                  {active && (
                    <motion.div
                      layoutId="vx-top-tab-indicator"
                      className="vx-nav-indicator"
                      style={{ inset: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              )
            })}
          </div>
          {FLAGS.FRIENDS && <NotificationBell />}
          <SyncStatusBadge />
        </div>
      </nav>

      {/* Page content with swipe + animation */}
      <main
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        // Swipe-to-navigate only registers on touches inside <main>. Without a
        // min-height, short/empty pages (e.g. history with no entries) leave
        // most of the viewport outside this element, so swipes there were
        // silently ignored. Force it to always cover at least the viewport.
        style={{ position: 'relative', minHeight: '100dvh' }}
      >
        <motion.div
          key={animKey ? `${pathname}-${animKey}` : pathname}
          // The redesigned app shell isn't forced dark regardless of the
          // user's theme choice — the scope class picked here (vx-dark-scope
          // / vx-light-scope / vx-cream-scope, see app/globals.css)
          // re-declares the same shared tokens to that theme's values for
          // this whole ancestor, so it also covers `.page-container`'s own
          // padding box (otherwise a light-themed user would see a
          // mismatched margin framing the card). Nav/bottom-nav/
          // notification-bell chrome now follows the theme too (see the
          // `[data-theme=...]` blocks in globals.css) — Light is genuinely
          // white end-to-end, not just the page content.
          className={`page-container ${SCOPE_CLASS[theme] ?? 'vx-dark-scope'}`}
          initial={{ opacity: 0.4, x: slideDir === 'right' ? 28 : -28, filter: 'blur(4px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom mobile nav — flush edge-to-edge bar (not a floating pill —
          see app/globals.css's `.vx-bottom-nav` comment for why). */}
      <nav className="vx-bottom-nav">
        {TABS.map(tab => {
          const Icon = TAB_ICONS[tab.href]
          const active = activeTab === tab.href
          return (
            <button
              key={tab.href}
              onClick={() => navigateTab(tab.href)}
              className={`vx-nav-btn ${active ? 'vx-active' : ''}`}
            >
              {active && (
                <motion.div
                  layoutId="vx-bottom-tab-indicator"
                  className="vx-nav-indicator"
                  style={{ inset: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <Toast />
      <ManagerModal />
      <PwaBootstrap />
      <WaterReminder />
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
      <FontScaleApplier />
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
