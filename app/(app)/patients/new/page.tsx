'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { US_STATES, TWO_PARTY_CONSENT_STATES, getTimezoneForState } from '@/lib/stateTimezone'

type PatientType = 'self' | 'household' | 'outside' | null

interface EnrollmentModal {
  name: string
  phone: string
}

export default function NewPatientPage() {
  const [patientType, setPatientType] = useState<PatientType>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState('TX')
  const [patientConsent, setPatientConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrollmentModal, setEnrollmentModal] = useState<EnrollmentModal | null>(null)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ full_name: string; phone: string | null; email: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Load current user profile for auto-fill
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
      if (data) setProfile({ full_name: data.full_name, phone: data.phone, email: user.email ?? '' })
    }
    loadProfile()
  }, [supabase])

  // Auto-fill fields based on patient type
  useEffect(() => {
    if (patientType === 'self' && profile) {
      setName(profile.full_name ?? '')
      setPhone(profile.phone ?? '')
      setEmail(profile.email ?? '')
      setPatientConsent(true)
    } else if (patientType === 'household' && profile) {
      setName('')
      setPhone(profile.phone ?? '')
      setEmail('')
      setPatientConsent(false)
    } else {
      setName('')
      setPhone('')
      setEmail('')
      setPatientConsent(false)
    }
  }, [patientType, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isSelf = patientType === 'self'
    const enrollmentStatus = isSelf ? 'active' : 'pending'

    const { data, error } = await supabase
      .from('patients')
      .insert({
        owner_id: user.id,
        name,
        phone,
        state,
        timezone: getTimezoneForState(state),
        is_self: isSelf,
        enrollment_status: enrollmentStatus,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!isSelf) {
      try {
        await fetch('/api/enrollment/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: data.id }),
        })
      } catch (smsErr) {
        console.error('Enrollment failed:', smsErr)
      }
      setLoading(false)
      setEnrollmentModal({ name: data.name, phone: data.phone })
    } else {
      router.push(`/patients/${data.id}`)
    }
  }

  const isSelf = patientType === 'self'
  const canSubmit = patientType !== null && name && phone && (isSelf || patientConsent)

  function getValidationMessage(): string | null {
    if (!patientType) return 'Please select who you are adding first.'
    if (!name) return 'Please enter a full name.'
    if (!phone) return 'Please enter a phone number.'
    if (!isSelf && !patientConsent) return 'Please confirm you have consent to enroll this person.'
    return null
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">

      {/* Validation warning modal */}
      {validationMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Hold on!</h2>
            <p className="text-gray-600 mb-6">{validationMsg}</p>
            <button
              onClick={() => setValidationMsg(null)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Enrollment confirmation modal */}
      {enrollmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Enrollment Sent!</h2>
            <p className="text-gray-600 mb-6">
              An enrollment message has been sent to{' '}
              <span className="font-semibold text-gray-900">{enrollmentModal.name}</span> at{' '}
              <span className="font-semibold text-gray-900">{enrollmentModal.phone}</span>.
              They must confirm before their profile becomes active.
            </p>
            <button
              onClick={() => { setEnrollmentModal(null); router.push('/patients') }}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <Link href="/patients" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Members
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Member</h1>
        <p className="text-gray-500 mt-1">Who are you setting this up for?</p>
      </div>

      {/* Patient Type Selector */}
      <div className="grid grid-cols-1 gap-3 mb-6">

        {/* Option 1 — Self */}
        <button
          type="button"
          onClick={() => setPatientType('self')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            patientType === 'self'
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🙋</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">This is for me</p>
              <p className="text-sm text-gray-500">Track my own medications — my info auto-fills</p>
            </div>
            {patientType === 'self' && <span className="ml-auto text-teal-500 text-xl">✓</span>}
          </div>
        </button>

        {/* Option 2 — Household */}
        <button
          type="button"
          onClick={() => setPatientType('household')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            patientType === 'household'
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🏠</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Someone I personally care for</p>
              <p className="text-sm text-gray-500">A family member at home I manage directly — I track their meds</p>
            </div>
            {patientType === 'household' && <span className="ml-auto text-teal-500 text-xl">✓</span>}
          </div>
        </button>

        {/* Option 3 — Outside */}
        <button
          type="button"
          onClick={() => setPatientType('outside')}
          className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
            patientType === 'outside'
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">📍</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Friend or family outside my home</p>
              <p className="text-sm text-gray-500">They live elsewhere — they'll get their own reminders and updates</p>
            </div>
            {patientType === 'outside' && <span className="ml-auto text-teal-500 text-xl">✓</span>}
          </div>
        </button>

      </div>

      {/* Add Patient button — always visible, shows popup if validation fails */}
      {!patientType && (
        <button
          type="button"
          onClick={() => setValidationMsg('Please select who you are adding first.')}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors mb-4"
        >
          Add Member
        </button>
      )}

      {/* Form — only show after type selected */}
      {patientType && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                readOnly={isSelf}
                className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg ${isSelf ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder={patientType === 'household' ? "Mom, Dad, spouse..." : "Their full name"}  
              />
              {isSelf && <p className="text-xs text-gray-400 mt-1">Auto-filled from your account</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                readOnly={isSelf}
                className={`w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg ${isSelf ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="+1 (555) 000-0000"
              />
              <p className="text-xs text-gray-400 mt-1">
                {isSelf ? 'Auto-filled from your account' : 'This is the number we will call or text for reminders'}
              </p>
            </div>

            {/* State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              >
                {US_STATES.map(({ abbr, name: stateName }) => (
                  <option key={abbr} value={abbr}>
                    {TWO_PARTY_CONSENT_STATES.has(abbr) ? `⚠️ ${stateName}` : stateName}
                  </option>
                ))}
              </select>
              {TWO_PARTY_CONSENT_STATES.has(state) && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠️ {US_STATES.find(s => s.abbr === state)?.name} requires all-party consent for call recording. A disclosure will play automatically.
                </p>
              )}
            </div>

            {/* Consent — required for non-self */}
            {!isSelf && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <input
                  type="checkbox"
                  id="patientConsent"
                  checked={patientConsent}
                  onChange={e => setPatientConsent(e.target.checked)}
                  className="mt-0.5 w-5 h-5 text-teal-600 rounded shrink-0 cursor-pointer"
                  required
                />
                <label htmlFor="patientConsent" className="text-sm text-amber-900 cursor-pointer leading-snug">
                  <span className="font-semibold">I confirm this person has consented</span> to receive
                  automated reminder calls and texts from RxNudge at the number above. I have permission
                  from this person to add them to my account and accept the{' '}
                  <a href="/terms" target="_blank" className="underline font-medium">Terms of Service</a>{' '}
                  on their behalf.
                </label>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const msg = getValidationMessage()
                if (msg) { setValidationMsg(msg); return }
                handleSubmit(new Event('submit') as unknown as React.FormEvent)
              }}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding member…' : 'Add Member'}
            </button>

          </form>
        </div>
      )}
    </div>
  )
}
