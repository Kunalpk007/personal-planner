'use client'
import { RouteErrorFallback } from '@/ui/RouteErrorFallback'

export default function FriendsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} label="Friends" />
}
