import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface RefPageProps {
  params: Promise<{ code: string }>
}

export default async function RefPage({ params }: RefPageProps) {
  const { code } = await params
  const supabase = await createClient()

  // Set the referral cookie (expires in 30 days)
  const cookieStore = await cookies()
  cookieStore.set('rxnudge_ref', code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  })

  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
