'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CaregiverOnboardingPage() {
  const [myName, setMyName] = useState('')
  const [myPhone, setMyPhone] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update my profile
    await supabase.from('profiles').update({
      user_type: 'caregiver',
      full_name: myName,
      phone: myPhone,
    }).eq('id', user.id)

    // Create patient profile
    const { data, error } = await supabase
      .from('patients')
      .insert({
        owner_id: user.id,
        name: patientName,
        phone: patientPhone,
        is_self: false,
        timezone: 'America/Chicago',
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Add myself as an alert contact
      await supabase.from('patient_alerts').insert({
        patient_id: data.id,
        name: myName,
        phone: myPhone,
        alert_sms: true,
      })
      router.push(`/patients/${data.id}/medications/new`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">👨‍👩‍👧</div>
          <h1 className="text-2xl font-bold text-gray-900">Family Caregiver Setup</h1>
          <p className="text-gray-500 mt-1">Set up tracking for your family member</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-teal-50 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Your Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
              <input
                type="text"
                value={myName}
                onChange={e => setMyName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg bg-white"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Phone (for alerts)</label>
              <input
                type="tel"
                value={myPhone}
                onChange={e => setMyPhone(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg bg-white"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Patient Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
              <input
                type="text"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg bg-white"
                placeholder="Mom, Dad, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Phone (for calls)</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg bg-white"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
