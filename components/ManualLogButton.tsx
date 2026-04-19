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
  // We log manually via a server route (service role) to avoid client-side RLS/auth issues.
  // (Keep supabase client import for other components; not used here.)
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
      const res = await fetch('/api/dose-log/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          medicationId,
          medicationName,
          scheduledTime,
          takenTime,
          patientTimezone,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`Could not log dose: ${json?.error || res.statusText}`)
        return
      }

      alert(`Saved ${takenTime} for the ${scheduledTime} dose.`)
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
