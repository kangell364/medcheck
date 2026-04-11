'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { US_STATES, TWO_PARTY_CONSENT_STATES, getTimezoneForState } from '@/lib/stateTimezone'

interface EnrollmentModal {
  name: string
  phone: string
}

export default function NewPatientPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('TX')
  const [isSelf, setIsSelf] = useState(false)
  const [patientConsent, setPatientConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrollmentModal, setEnrollmentModal] = useState<EnrollmentModal | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
      // Send enrollment MMS in background (non-blocking)
      try {
        await fetch('/api/enrollment/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: data.id }),
        })
      } catch (smsErr) {
        console.error('Enrollment SMS failed:', smsErr)
        // Don't block the flow — show modal anyway
      }

      setLoading(false)
      setEnrollmentModal({ name: data.name, phone: data.phone })
    } else {
      router.push(`/patients/${data.id}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      {/* Enrollment confirmation modal */}
      {enrollmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Enrollment Text Sent!</h2>
            <p className="text-gray-600 mb-6">
              An enrollment text has been sent to{' '}
              <span className="font-semibold text-gray-900">{enrollmentModal.name}</span> at{' '}
              <span className="font-semibold text-gray-900">{enrollmentModal.phone}</span>.
              They must reply <span className="font-semibold text-teal-600">YES</span> before
              their profile becomes active.
            </p>
            <button
              onClick={() => {
                setEnrollmentModal(null)
                router.push('/patients')
              }}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <Link href="/patients" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Patients
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Patient</h1>
        <p className="text-gray-500 mt-1">Set up a new patient profile</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="Mom, Dad, or patient name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="+1 (555) 000-0000"
            />
            <p className="text-xs text-gray-400 mt-1">This is the number we will call for reminders</p>
          </div>

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
              <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
                <span>⚠️</span>
                <span>{US_STATES.find(s => s.abbr === state)?.name ?? state} requires all-party consent. A recording disclosure will be played automatically at the start of each call.</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 bg-teal-50 rounded-xl p-4">
            <input
              type="checkbox"
              id="isSelf"
              checked={isSelf}
              onChange={e => {
                setIsSelf(e.target.checked)
                // If tracking self, consent is implicit
                if (e.target.checked) setPatientConsent(true)
                else setPatientConsent(false)
              }}
              className="w-5 h-5 text-teal-600 rounded"
            />
            <label htmlFor="isSelf" className="text-sm font-medium text-gray-700 cursor-pointer">
              This is me — I am tracking my own medications
            </label>
          </div>

          {/* Patient consent — required when adding someone else */}
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
                <span className="font-semibold">I confirm that this person has consented</span> to receive
                automated reminder phone calls and text messages from RxNudge at the number provided.
                I have the legal authority to enroll this person and accept the{' '}
                <a href="/terms" target="_blank" className="underline font-medium">Terms of Service</a>{' '}
                on their behalf. I understand that providing false consent is a violation of these Terms
                and may expose me to legal liability.
              </label>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!isSelf && !patientConsent)}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding patient…' : 'Add Patient'}
          </button>
        </form>
      </div>
    </div>
  )
}
