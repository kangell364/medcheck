'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { US_STATES, TWO_PARTY_CONSENT_STATES, getTimezoneForState } from '@/lib/stateTimezone'

type ContactMethod = 'call' | 'text' | 'both'

const CONTACT_OPTIONS: { value: ContactMethod; label: string; icon: string }[] = [
  { value: 'call', label: 'Call', icon: '📞' },
  { value: 'text', label: 'Text', icon: '💬' },
  { value: 'both', label: 'Both', icon: '📞💬' },
]

export default function EditPatientPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('TX')

  // Reminder preferences
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [contactMethod, setContactMethod] = useState<ContactMethod>('text')
  const [reminderTime, setReminderTime] = useState('08:00')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPatient() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: patient, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .single()

      if (fetchError || !patient) {
        setError('Member not found.')
        setLoading(false)
        return
      }

      setName(patient.name)
      setPhone(patient.phone)
      setState(patient.state ?? 'TX')

      // Reminder preferences — fall back to safe defaults if columns not yet present
      setRemindersEnabled(patient.reminders_enabled ?? true)
      setContactMethod((patient.contact_method as ContactMethod) ?? 'text')
      // DB stores HH:MM:SS; <input type="time"> expects HH:MM
      const rt: string = patient.reminder_time ?? '08:00:00'
      setReminderTime(rt.slice(0, 5))

      setLoading(false)
    }

    loadPatient()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch(`/api/patients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        state,
        reminders_enabled: remindersEnabled,
        contact_method: contactMethod,
        // Send as HH:MM:SS for Postgres TIME column
        reminder_time: `${reminderTime}:00`,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Failed to save changes.')
      setSaving(false)
      return
    }

    router.push(`/patients/${id}`)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto pb-20 md:pb-0">
        <p className="text-gray-500 mt-8 text-center">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <Link href={`/patients/${id}`} className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Member
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Member</h1>
        <p className="text-gray-500 mt-1">Update contact information and reminder preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Contact Information ────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="Mom, Dad, or member name"
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
            <p className="text-xs text-gray-400 mt-1">This is the number we will call or text for reminders</p>
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

          {/* ── Reminder Preferences ──────────────────────── */}
          <div className="border-t border-gray-100 pt-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Reminder Preferences</h2>

            {/* Reminders toggle */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-medium text-gray-700">Daily Reminders</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  When off, no calls or texts will be sent
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={remindersEnabled}
                onClick={() => setRemindersEnabled(v => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  remindersEnabled ? 'bg-teal-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    remindersEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Contact method + time (only shown when reminders are ON) */}
            <div className={`space-y-5 transition-opacity duration-200 ${remindersEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>

              {/* Contact method segmented control */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Method</label>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  {CONTACT_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setContactMethod(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors
                        ${contactMethod === opt.value
                          ? 'bg-teal-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                        }
                        ${idx > 0 ? 'border-l border-gray-200' : ''}
                      `}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reminder time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily reminder time
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Reminders are sent in the member&apos;s timezone ({getTimezoneForState(state)})
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <Link
              href={`/patients/${id}`}
              className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
