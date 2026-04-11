'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  token: string
  email: string
  onDone: () => void      // created account
  onSkip: () => void      // skip for now
}

function getStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: '', color: 'bg-gray-200', width: 'w-0' }
  if (pw.length < 8)   return { label: 'Too short', color: 'bg-red-400', width: 'w-1/4' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNum   = /[0-9]/.test(pw)
  const hasSpec  = /[^A-Za-z0-9]/.test(pw)
  const score    = [hasUpper, hasNum, hasSpec].filter(Boolean).length
  if (score === 0) return { label: 'Weak',   color: 'bg-red-400',    width: 'w-1/3' }
  if (score === 1) return { label: 'OK',     color: 'bg-yellow-400', width: 'w-2/3' }
  return              { label: 'Strong', color: 'bg-green-500',  width: 'w-full' }
}

export default function AccountStep({ patientId, token, email, onDone, onSkip }: Props) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)

  const strength     = getStrength(password)
  const mismatch     = confirm.length > 0 && password !== confirm
  const canSubmit    = password.length >= 8 && password === confirm && !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/patient-account/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, email, password, permanent_token: token }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center px-5 py-10">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🔒</div>
          <h1 className="text-4xl font-bold text-teal-800">RxNudge</h1>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-3xl shadow-sm border border-teal-100 p-7 mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
            Protect Your Health Info
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed mb-7">
            Your medication information is private. Create a password to keep it secure — so only <strong>you</strong> can access it.
          </p>

          {/* Email (read-only) */}
          <div className="mb-5">
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-xl text-gray-500">
              {email || <span className="italic">No email on file</span>}
            </div>
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Create Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl text-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400 transition-colors pr-16"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400 hover:text-gray-600"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mb-5">
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
              </div>
              {strength.label && (
                <p className="text-lg text-gray-500 mt-1">{strength.label}</p>
              )}
            </div>
          )}
          {password.length === 0 && <div className="mb-5" />}

          {/* Confirm password */}
          <div className="mb-6">
            <label className="block text-xl font-semibold text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showCf ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className={`w-full px-5 py-4 border-2 rounded-2xl text-xl text-gray-900 placeholder-gray-400 focus:outline-none transition-colors pr-16 ${
                  mismatch ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 focus:border-teal-400'
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowCf(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400 hover:text-gray-600"
                aria-label={showCf ? 'Hide password' : 'Show password'}
              >
                {showCf ? '🙈' : '👁️'}
              </button>
            </div>
            {mismatch && (
              <p className="text-lg text-red-600 mt-2">Passwords don&apos;t match</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
              <p className="text-red-700 text-lg text-center">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all shadow-md ${
              canSubmit
                ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? '⏳ Creating account…' : '🔒 Create My Account'}
          </button>
        </div>

        {/* Skip link */}
        <div className="border-t border-gray-200 pt-6 text-center">
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600 text-xl underline transition-colors py-2 px-4"
          >
            Skip for now — use my link instead
          </button>
        </div>

      </div>
    </div>
  )
}
