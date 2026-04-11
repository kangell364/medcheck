'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EditMedicationPage() {
  const params = useParams()
  const patientId = params.id as string
  const medId = params.medId as string
  const router = useRouter()
  const supabase = createClient()

  const todayStr = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [dosage, setDosage] = useState('')
  const [startDate, setStartDate] = useState(todayStr)
  const [reminderTimes, setReminderTimes] = useState(['08:00'])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)

  useEffect(() => {
    async function loadMedication() {
      setFetchLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch medication
      const { data: med, error: medErr } = await supabase
        .from('medications')
        .select('*')
        .eq('id', medId)
        .single()

      if (medErr || !med) {
        setError('Medication not found.')
        setFetchLoading(false)
        return
      }

      // Verify ownership via patient
      const { data: patient } = await supabase
        .from('patients')
        .select('owner_id')
        .eq('id', patientId)
        .single()

      if (!patient || patient.owner_id !== user.id) {
        setError('Access denied.')
        setFetchLoading(false)
        return
      }

      setName(med.name || '')
      setNickname((med as any).nickname || '')
      setDosage(med.dosage || '')
      setStartDate((med as any).start_date || todayStr)
      setReminderTimes(med.reminder_times && med.reminder_times.length > 0 ? med.reminder_times : ['08:00'])
      setNotes(med.notes || '')
      setFetchLoading(false)
    }

    loadMedication()
  }, [medId, patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateTime(index: number, value: string) {
    const updated = [...reminderTimes]
    updated[index] = value
    setReminderTimes(updated)
  }

  function addTime() {
    setReminderTimes([...reminderTimes, '08:00'])
  }

  function removeTime(index: number) {
    if (reminderTimes.length <= 1) return
    setReminderTimes(reminderTimes.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/medications/${medId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nickname, dosage, start_date: startDate, reminder_times: reminderTimes, notes }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update medication.')
      setLoading(false)
    } else {
      router.push(`/patients/${patientId}`)
    }
  }

  // What the AI will say on the call
  const callName = nickname || name

  if (fetchLoading) {
    return (
      <div className="max-w-lg mx-auto pb-20 md:pb-0">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <Link href={`/patients/${patientId}`} className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Member
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Medication</h1>
        <p className="text-gray-500 mt-1">Update medication details and reminder times</p>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex gap-2 items-start">
        <span className="text-amber-500 text-base mt-0.5">ℹ️</span>
        <p className="text-sm text-amber-800">
          Changing the medication name won&apos;t affect past history — old records will continue to show the previous name.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Medication Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medication Name (Official) *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. Lisinopril"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use the official drug name — this appears on reports and PDFs sent to doctors.
            </p>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname (Optional)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. blood pressure pill, water pill, heart med"
            />
            <p className="text-xs text-gray-400 mt-1">
              A friendly name used in phone calls and reminders. E.g. &apos;heart pill&apos;, &apos;little white one&apos;.
            </p>

            {/* Live preview */}
            {name && (
              <div className="mt-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                <p className="text-xs text-teal-600 font-medium mb-1">📞 AI will say on the call:</p>
                <p className="text-sm text-teal-800 italic">
                  &quot;Did you take your <strong>{callName}</strong>?&quot;
                </p>
              </div>
            )}
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. 500mg, 1 tablet, 10mg"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
            />
            <p className="text-xs text-gray-400 mt-1">
              When did this medication begin? Used to calculate adherence accurately.
            </p>
          </div>

          {/* Reminder Times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Times</label>
            <div className="space-y-2">
              {reminderTimes.map((time, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="time"
                    value={time}
                    onChange={e => updateTime(i, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(i)}
                    disabled={reminderTimes.length <= 1}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xl font-semibold w-8 h-8 flex items-center justify-center"
                    title="Remove this time"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTime}
              className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 transition-colors"
            >
              ＋ Add Time
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
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

          <div className="flex gap-3">
            <Link
              href={`/patients/${patientId}`}
              className="flex-1 text-center border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !name}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
