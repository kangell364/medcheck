'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-medium py-3 px-6 rounded-xl transition-colors"
    >
      Sign Out
    </button>
  )
}
