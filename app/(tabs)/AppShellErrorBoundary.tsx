'use client'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AppShellErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[AppShellErrorBoundary]', error)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleHardReset = () => {
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 40,
          background: 'var(--color-bg-primary)',
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 12,
            background: 'var(--color-accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            marginBottom: 4,
          }}>!</div>
          <h2 style={{ color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ maxWidth: 320, lineHeight: 1.5 }}>
            The app encountered an unexpected error. You can try reloading or signing in again.
          </p>
          {this.state.error && !this.state.error.message.includes('NEXT_REDIRECT') && (
            <pre style={{
              fontSize: 11, maxWidth: 400, overflow: 'auto',
              padding: 12, borderRadius: 8,
              background: 'var(--color-bg-secondary)',
              border: '0.5px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={this.handleRetry}
              className="btn-primary">Try again</button>
            <button onClick={this.handleHardReset}
              className="btn-secondary">Sign in again</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}