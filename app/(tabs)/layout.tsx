'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Toast }               from '@/ui/Toast'
import { ManagerModal }         from '@/ui/ManagerModal'
import { ThemeApplier }         from '@/ui/ThemeApplier'
import { useOvernightCheck }   from '@/hooks/useOvernightCheck'

const TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/tasks',     label: 'Tasks',     icon: '✅' },
  { href: '/journal',   label: 'Journal',   icon: '📓' },
  { href: '/rewards',   label: 'Rewards',   icon: '🎁' },
  { href: '/history',   label: 'History',   icon: '📅' },
  { href: '/settings',  label: 'Settings',  icon: '⚙️' },
]

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  // Run all startup checks on mount
  useOvernightCheck()

  return (
    <>
      <ThemeApplier />
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid var(--color-border)',
        padding: '0 var(--spacing-page)',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', height: 56, gap: 32 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', flexShrink: 0 }}>
            Kunal's Planner
          </span>
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
