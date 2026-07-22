'use client'
import { RouteErrorFallback } from '@/ui/RouteErrorFallback'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} label="Dashboard" />
}
