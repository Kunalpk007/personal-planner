'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Friends used to be its own top-level tab; it's now a mode on the Tasks
// page (alongside Today's Tasks / Recurring Templates) so it doesn't need
// its own nav slot — see app/(tabs)/tasks/page.tsx. This route stays as a
// redirect so old links/bookmarks (and the notification bell) still land
// somewhere sensible.
export default function FriendsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/tasks?mode=friends')
  }, [router])
  return null
}
