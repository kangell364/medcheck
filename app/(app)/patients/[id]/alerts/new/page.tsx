'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewAlertContactPage() {
  const params = useParams()
  const patientId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [alertSms, setAlertSms] = useState(true)
  const [alertEmail, setAlertEmail] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!phone && !email) {
      setError('Please provide at least a phone number or email address.')
      return
    }
    if (alertSms && !phone) {
      setError('A phone number is required for SMS alerts.')
      return
    }
    if (alertEmail && !email) {
      setError('An email address is required for email alerts.')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('patient_alerts').insert({
      patient_id: patientId,
      name,
      phone: phone || null,
      email: email || null,
      alert_sms: alertSms,
      alert_email: alertEmail,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(`/patients/${patientId}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <Link href={`/patients/${patientId}`} className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Member
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Alert Contact</h1>
        <p className="text-gray-500 mt-1">This person will be notified when a dose is missed</p>
      </div>

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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. Sarah Johnson"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="sarah@example.com"
            />
          </div>

          {/* Alert preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How should we alert them?
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors hover:bg-gray-50"
                style={{ borderColor: alertSms ? '#0d9488' : '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={alertSms}
                  onChange={e => setAlertSms(e.target.checked)}
                  className="w-5 h-5 rounded accent-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900">📱 SMS Text Message</p>
                  <p className="text-sm text-gray-500">Instant text when a dose is missed</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors hover:bg-gray-50"
                style={{ borderColor: alertEmail ? '#0d9488' : '#e5e7eb' }}>
                <input
                  type="checkbox"
                  checked={alertEmail}
                  onChange={e => setAlertEmail(e.target.checked)}
                  className="w-5 h-5 rounded accent-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900">📧 Email</p>
                  <p className="text-sm text-gray-500">Email notification for missed doses</p>
                </div>
              </label>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
            <p className="text-sm text-teal-700">
              💡 This contact will receive alerts when the member misses a dose or doesn&apos;t respond to a reminder call. You can add multiple contacts — great for siblings sharing care responsibilities.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding contact…' : 'Add Alert Contact'}
          </button>
        </form>
      </div>
    </div>
  )
}
