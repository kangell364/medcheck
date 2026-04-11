'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function PatientLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('No login token found. Please use the link sent to your phone.')
      return
    }

    async function loginWithToken() {
      try {
        const res = await fetch('/api/patient-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          setStatus('error')
          setErrorMsg(data.error || 'Login failed. Please try again or contact your caregiver.')
          return
        }

        // Set the session on the client
        const supabase = createClient()
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        setStatus('success')
        setTimeout(() => {
          router.push('/my-meds')
          router.refresh()
        }, 1000)
      } catch {
        setStatus('error')
        setErrorMsg('Something went wrong. Please try again or contact your caregiver.')
      }
    }

    loginWithToken()
  }, [token, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-sm text-center">
        <div className="text-6xl mb-6">💊</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">RxNudge</h1>

        {status === 'loading' && (
          <>
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xl text-gray-600">Signing you in…</span>
            </div>
            <p className="text-gray-400 mt-3 text-lg">Just a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mt-4 mb-4">✅</div>
            <p className="text-xl font-semibold text-emerald-700">You&apos;re signed in!</p>
            <p className="text-gray-500 mt-2 text-lg">Taking you to your medications…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mt-4 mb-4">😕</div>
            <p className="text-xl font-semibold text-red-700 mb-3">{errorMsg}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
              <p className="text-lg text-amber-800">
                📱 Ask your caregiver to send you a new login link to your phone.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-500">Loading…</div>
      </div>
    }>
      <PatientLoginInner />
    </Suspense>
  )
}
