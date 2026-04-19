'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  medicationId: string
  patientId: string
  medicationName: string
  scheduledTime: string
  patientTimezone: string
}

export default function ManualLogButton({
  medicationId,
  patientId,
  medicationName,
  scheduledTime,
  patientTimezone,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [takenTime, setTakenTime] = useState(scheduledTime)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = (() => {
    try {
      return createClient()
    } catch {
      return null
    }
  })()

  async function handleSave() {
    if (!supabase) {
      alert('App is not configured yet. Missing Supabase environment variables.')
      return
    }

    setSaving(true)
    try {
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: patientTimezone })
      const takenAtIso = new Date(`${dateStr}T${takenTime}:00`).toISOString()

      // Always anchor the log to the scheduled slot time (never the taken time).
      // This guarantees the UI/calendar slot flips from MISSED → CONFIRMED for that dose.
      const scheduledSlotLocal = `${dateStr}T${scheduledTime}:00`
      const scheduledSlotIso = new Date(scheduledSlotLocal).toISOString()

      // Upsert the unique row (patient_id, medication_id, scheduled_at)
      const { error: upsertError } = await supabase
        .from('dose_logs')
        .upsert(
          {
            patient_id: patientId,
            medication_id: medicationId,
            medication_name: medicationName,
            scheduled_at: scheduledSlotIso,
            confirmed: true,
            confirmed_at: takenAtIso,
            method: 'manual',
          },
          { onConflict: 'patient_id,medication_id,scheduled_at' }
        )

      if (upsertError) {
        console.error('[ManualLogButton] upsert error', upsertError)
        alert(`Could not log dose: ${upsertError.message}`)
        return
      }

      alert(`Saved ${takenTime} for the ${scheduledTime} dose.`)

      // Close modal first so the refreshed UI is visible immediately.
      setShowModal(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-300 px-2.5 py-1 rounded-full hover:bg-teal-50 transition-colors"
      >
        🕒 Log Time
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">📝 Log Missed Dose</h3>
            <p className="text-gray-500 text-sm mb-5">
              What time did <span className="font-semibold text-gray-700">{medicationName}</span> actually get taken?
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time taken</label>
            <input
              type="time"
              value={takenTime}
              onChange={e => setTakenTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xl focus:outline-none focus:ring-2 focus:ring-teal-500 mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : '✅ Save'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
