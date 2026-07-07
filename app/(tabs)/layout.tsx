'use client'
import { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Toast }            from '@/ui/Toast'
import { ManagerModal }     from '@/ui/ManagerModal'
import { ThemeApplier }     from '@/ui/ThemeApplier'
import { useOvernightCheck } from '@/hooks/useOvernightCheck'
import { StoreBootstrap }   from '@/features/auth/StoreBootstrap'
import { signOut }          from 'firebase/auth'
import { getClientAuth }    from '@/lib/firebase/client'
import { usePlannerStore }  from '@/store'
import { setUserScope }     from '@/store/userScope'
import { INITIAL_STATE }    from '@/store/defaults'
import { SyncStatusBadge }  from '@/ui/SyncStatusBadge'

const TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/tasks',     label: 'Tasks',     icon: '✅' },
  { href: '/journal',   label: 'Journal',   icon: '📓' },
  { href: '/rewards',   label: 'Rewards',   icon: '🎁' },
  { href: '/history',   label: 'History',   icon: '📅' },
  { href: '/settings',  label: 'Settings',  icon: '⚙️' },
]

/**
 * Rendered only after the store is hydrated with the correct user's data.
 * Keeps useOvernightCheck away from the empty-store initial render.
 */
async function handleSignOut() {
  try {
    await fetch('/api/auth/signout', { method: 'POST' })
  } catch { /* ignore network errors — cookie will still be deleted */ }
  try {
    await signOut(getClientAuth())
  } catch { /* ignore if Firebase client not initialized */ }
  // Scope → null so the persist write goes to the __anon__ key,
  // leaving this user's scoped localStorage data untouched for their next login.
  setUserScope(null)
  usePlannerStore.setState({ ...INITIAL_STATE })
  // Full page reload instead of router.push — Next.js 16 client-side navigation
  // keeps the JS bundle alive (Zustand module stays in memory), so router.push
  // cannot guarantee isolation between users.  A hard reload re-initialises all
  // modules and the new user's StoreBootstrap starts from a clean slate.
  window.location.href = '/login'
}

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
            {TABS.map(tab => (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={`tab-item ${pathname === tab.href ? 'active' : ''}`}
              >
                <span className="mr-1.5">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
          <SyncStatusBadge />
          <button onClick={() => handleSignOut()} title="Sign out"
            style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: '0.5px solid var(--color-border)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="page-container">
        {children}
      </div>

      <nav className="bottom-nav">
        {TABS.map(tab => (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`bottom-tab ${pathname === tab.href ? 'active' : ''}`}
          >
            <span className="bottom-tab__icon">{tab.icon}</span>
          </button>
        ))}
      </nav>

      <Toast />
      <ManagerModal />
    </>
  )
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const [storeReady, setStoreReady] = useState(false)
  const onReady = useCallback(() => setStoreReady(true), [])

  return (
    <>
      <ThemeApplier />
      <StoreBootstrap onReady={onReady} />

      {storeReady ? (
        <AppShell>{children}</AppShell>
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
