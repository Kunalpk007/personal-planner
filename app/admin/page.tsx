'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getClientAuth, waitForAuth } from '@/lib/firebase/client'
import { listUserIndex, listBugReports, type BugReport } from '@/lib/firebase/firestore'

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID ?? ''

type Row = { id: string; displayName?: string; email?: string; rankXP?: number; streak?: number }

export default function AdminPage() {
  const [state, setState] = useState<'loading' | 'denied' | 'ready' | 'error'>('loading')
  const [users, setUsers] = useState<Row[]>([])
  const [bugs, setBugs] = useState<BugReport[]>([])
  const [tab, setTab] = useState<'users' | 'bugs'>('users')

  useEffect(() => {
    (async () => {
      const ready = await waitForAuth()
      const uid = getClientAuth().currentUser?.uid ?? null
      if (!ready || !uid || !ADMIN_UID || uid !== ADMIN_UID) { setState('denied'); return }
      try {
        const [u, b] = await Promise.all([listUserIndex(), listBugReports()])
        setUsers(u)
        setBugs(b)
        setState('ready')
      } catch {
        setState('error')
      }
    })()
  }, [])

  if (state === 'loading') {
    return <Shell><p style={{ color: 'var(--text3)', fontSize: 13 }}>Checking admin access…</p></Shell>
  }
  if (state === 'denied') {
    return (
      <Shell>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Admin</h1>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
          You&apos;re not authorised to view this page. Sign in with the admin account.
        </p>
        <Link href="/login" style={{ color: 'var(--green)', fontSize: 13 }}>Go to login →</Link>
      </Shell>
    )
  }
  if (state === 'error') {
    return (
      <Shell>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Admin</h1>
        <p style={{ color: 'var(--red)', fontSize: 13 }}>Couldn&apos;t load admin data. Make sure the Firestore rules grant your uid access (see firestore.rules).</p>
      </Shell>
    )
  }

  const totalXP = users.reduce((s, u) => s + (u.rankXP ?? 0), 0)
  const activeStreaks = users.filter(u => (u.streak ?? 0) > 0).length
  const openBugs = bugs.filter(b => (b.status ?? 'open') === 'open').length

  return (
    <Shell>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admin dashboard</h1>
      <p style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>Read-only overview across all users.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Stat label="Users" value={users.length} />
        <Stat label="Active streaks" value={activeStreaks} />
        <Stat label="Total rank XP" value={totalXP} />
        <Stat label="Open bug reports" value={openBugs} />
      </div>

      <div style={{ display: 'inline-flex', background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
        {(['users', 'bugs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--bg)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text2)',
            }}>
            {t === 'users' ? 'Users' : `Bug reports (${bugs.length})`}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text3)', fontSize: 11 }}>
                <th style={{ padding: '6px 8px' }}>Name</th><th style={{ padding: '6px 8px' }}>Email</th>
                <th style={{ padding: '6px 8px' }}>Rank XP</th><th style={{ padding: '6px 8px' }}>Streak</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{u.displayName ?? '—'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text2)' }}>{u.email ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{u.rankXP ?? 0}</td>
                  <td style={{ padding: '6px 8px' }}>{u.streak ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bugs' && (
        <div>
          {bugs.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 13 }}>No reports yet.</p>}
          {bugs.map(b => (
            <div key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{b.category}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.email || b.uid}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{b.message}</p>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px', minHeight: '100vh' }}>
      {children}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  )
}
