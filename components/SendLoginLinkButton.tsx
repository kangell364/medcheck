'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  patientPhone: string
  hasUserAccount: boolean
}

export default function SendLoginLinkButton({ patientId, patientPhone, hasUserAccount }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSend() {
    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch(`/api/patients/${patientId}/send-login-link`, {
        method: 'POST',
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
        setMessage(data.warning || `Login link sent to ${patientPhone}`)
        setTimeout(() => setStatus('idle'), 5000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to send link')
        setTimeout(() => setStatus('idle'), 5000)
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleSend}
        disabled={status === 'loading'}
        title={hasUserAccount ? 'Send new login link to patient' : 'Create account and send login link'}
        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-2 px-3 rounded-xl text-sm transition-colors disabled:opacity-60"
      >
        {status === 'loading' ? (
          <>
            <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>Sending…</span>
          </>
        ) : (
          <>
            <span>📲</span>
            <span>App Link</span>
          </>
        )}
      </button>

      {/* Feedback toast */}
      {(status === 'success' || status === 'error') && (
        <div
          className={`absolute right-0 top-full mt-2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg whitespace-nowrap ${
            status === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {status === 'success' ? '✅ ' : '❌ '}{message}
        </div>
      )}
    </div>
  )
}
