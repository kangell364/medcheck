'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once daily', defaultTimes: ['08:00'] },
  { value: 'twice', label: 'Twice daily', defaultTimes: ['08:00', '20:00'] },
  { value: 'three_times', label: 'Three times daily', defaultTimes: ['08:00', '13:00', '20:00'] },
]

export default function NewMedicationPage() {
  const params = useParams()
  const patientId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('once')
  const [reminderTimes, setReminderTimes] = useState(['08:00'])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleFrequencyChange(freq: string) {
    setFrequency(freq)
    const opt = FREQUENCY_OPTIONS.find(o => o.value === freq)
    if (opt) setReminderTimes([...opt.defaultTimes])
  }

  function updateTime(index: number, value: string) {
    const updated = [...reminderTimes]
    updated[index] = value
    setReminderTimes(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('medications').insert({
      patient_id: patientId,
      name,
      dosage: dosage || null,
      frequency,
      reminder_times: reminderTimes,
      notes: notes || null,
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
          ← Back to Patient
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Medication</h1>
        <p className="text-gray-500 mt-1">Set up a new medication with reminder times</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. Metformin, Lisinopril"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. 500mg, 1 tablet"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How Often?</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFrequencyChange(opt.value)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    frequency === opt.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Times</label>
            <div className="space-y-2">
              {reminderTimes.map((time, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20">
                    {i === 0 ? 'Morning' : i === 1 ? 'Evening' : 'Afternoon'}:
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={e => updateTime(i, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Take with food, avoid grapefruit, etc."
            />
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
            {loading ? 'Adding medication…' : 'Add Medication'}
          </button>
        </form>
      </div>
    </div>
  )
}
