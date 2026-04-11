'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  token: string
  firstName: string
  caregiverName: string
  onAccepted: () => void
}

export default function ConsentScreenClient({ patientId, token, firstName, caregiverName, onAccepted }: Props) {
  const [termsChecked, setTermsChecked] = useState(false)
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const bothChecked = termsChecked && disclaimerChecked

  async function handleSubmit() {
    if (!bothChecked || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/patient-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, token }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Something went wrong')
      }

      // Call the callback to advance to install step
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center px-5 py-10">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💊</div>
          <h1 className="text-4xl font-bold text-teal-800">RxNudge</h1>
        </div>

        {/* Welcome card */}
        <div className="bg-white rounded-3xl shadow-sm border border-teal-100 p-7 mb-6">
          <p className="text-2xl font-semibold text-gray-800 mb-2">
            Hi {firstName}! 👋
          </p>
          <p className="text-xl text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">{caregiverName}</span> has set up
            daily medication reminders for you using RxNudge.
          </p>
          <p className="text-xl text-gray-600 mt-3 leading-relaxed">
            Before we get started, please read and accept the terms below.
          </p>
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-4 mb-6">

          {/* Terms + SMS consent */}
          <label
            className={`flex items-start gap-4 bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${
              termsChecked ? 'border-teal-400 bg-teal-50' : 'border-gray-200'
            }`}
          >
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={e => setTermsChecked(e.target.checked)}
              className="w-6 h-6 mt-1 flex-shrink-0 accent-teal-600 cursor-pointer"
            />
            <span className="text-xl text-gray-700 leading-relaxed">
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 underline font-medium"
                onClick={e => e.stopPropagation()}
              >
                Terms of Service
              </a>{' '}
              and consent to receive automated medication reminder calls and text messages from RxNudge.{' '}
              <span className="text-gray-500">Message &amp; data rates may apply. Reply STOP to opt out at any time.</span>
            </span>
          </label>

          {/* Medical disclaimer */}
          <label
            className={`flex items-start gap-4 bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${
              disclaimerChecked ? 'border-teal-400 bg-teal-50' : 'border-gray-200'
            }`}
          >
            <input
              type="checkbox"
              checked={disclaimerChecked}
              onChange={e => setDisclaimerChecked(e.target.checked)}
              className="w-6 h-6 mt-1 flex-shrink-0 accent-teal-600 cursor-pointer"
            />
            <span className="text-xl text-gray-700 leading-relaxed">
              I understand RxNudge is a <span className="font-semibold">reminder tool only</span> — not medical advice.
              I am responsible for taking my medications correctly and consulting my doctor with any questions.
            </span>
          </label>
        </div>

        {/* View full terms link */}
        <p className="text-center text-lg text-gray-500 mb-6">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 underline"
          >
            View Full Terms of Service ↗
          </a>
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <p className="text-red-700 text-lg text-center">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!bothChecked || loading}
          className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all shadow-md ${
            bothChecked && !loading
              ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? '⏳ Saving…' : "Let's Get Started! 🚀"}
        </button>

        {!bothChecked && (
          <p className="text-center text-lg text-gray-400 mt-3">
            Please check both boxes above to continue
          </p>
        )}
      </div>
    </div>
  )
}
