import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check user type from cookie (set by middleware) or DB
  const cookieStore = await cookies()
  let userType = cookieStore.get('rxnudge_user_type')?.value

  if (!userType) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()
    userType = profile?.user_type ?? 'caregiver'
  }

  // Patient view — no sidebar, full-screen layout
  if (userType === 'patient') {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-0 md:ml-64 flex flex-col">
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white/60 backdrop-blur px-6 md:px-8 py-4 text-xs text-gray-500">
          <div className="max-w-5xl">
            <span className="font-semibold text-gray-700">RxNudge</span> is a service provided by{' '}
            <span className="font-semibold text-gray-700">Lendpromise</span>.{' '}
            <a href="/terms" className="text-teal-700 hover:underline">Terms</a> •{' '}
            <a href="/privacy" className="text-teal-700 hover:underline">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  )
}
