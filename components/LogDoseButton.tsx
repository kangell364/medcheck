'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  medicationId: string
  patientId: string
  reminderTime: string // "HH:MM" in patient's timezone
  patientTimezone: string
}

export default function LogDoseButton({ medicationId, patientId, reminderTime, patientTimezone }: Props) {
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [takenTime, setTakenTime] = useState(reminderTime)
  const router = useRouter()

  async function handleLogTaken() {
    setSaving(true)
    try {
      const res = await fetch('/api/dose-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          medication_id: medicationId,
          reminder_time: takenTime,
          action: 'taken',
          timezone: patientTimezone,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(json?.details || json?.error || 'Could not log dose')
        return
      }

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
        disabled={saving}
        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
      >
        ✅ Mark Taken
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">✅ Mark Taken</h3>
            <p className="text-gray-500 text-sm mb-5">What time was it taken?</p>

            <label className="block text-sm font-medium text-gray-700 mb-2">Time taken</label>
            <input
              type="time"
              value={takenTime}
              onChange={e => setTakenTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogTaken}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
