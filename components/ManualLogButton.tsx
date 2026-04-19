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
  // Store taken time internally as 24h HH:MM.
  const [takenTime, setTakenTime] = useState(scheduledTime)

  function to12h(hhmm: string): string {
    const [hStr, mStr] = hhmm.split(':')
    const h = parseInt(hStr || '0', 10)
    const m = parseInt(mStr || '0', 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = ((h + 11) % 12) + 1
    const mm = String(m).padStart(2, '0')
    return `${h12}:${mm} ${ampm}`
  }

  function from12h(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
    const h = ampm === 'PM' ? (hour12 % 12) + 12 : (hour12 % 12)
    const hh = String(h).padStart(2, '0')
    const mm = String(minute).padStart(2, '0')
    return `${hh}:${mm}`
  }

  function toPicker(hhmm: string): { hour12: number; minute: number; ampm: 'AM' | 'PM' } {
    const [hStr, mStr] = hhmm.split(':')
    const h = parseInt(hStr || '0', 10)
    const minute = parseInt(mStr || '0', 10)
    const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
    const hour12 = ((h + 11) % 12) + 1
    return { hour12, minute, ampm }
  }
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

      alert(`Saved ${to12h(takenTime)} for the ${to12h(scheduledTime)} dose.`)
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

            {/* 12-hour picker (avoids device-specific 24h time input rendering) */}
            {(() => {
              const p = toPicker(takenTime)
              const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
              return (
                <div className="w-full rounded-xl border border-gray-200 p-4 mb-5">
                  <div className="text-3xl font-bold text-gray-900 mb-3">{to12h(takenTime)}</div>
                  <div className="flex gap-3">
                    <select
                      value={p.hour12}
                      onChange={e => setTakenTime(from12h(parseInt(e.target.value, 10), p.minute, p.ampm))}
                      className="flex-1 px-3 py-3 rounded-xl border border-gray-200 text-lg"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <select
                      value={p.minute}
                      onChange={e => setTakenTime(from12h(p.hour12, parseInt(e.target.value, 10), p.ampm))}
                      className="flex-1 px-3 py-3 rounded-xl border border-gray-200 text-lg"
                    >
                      {minuteOptions.map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>

                    <select
                      value={p.ampm}
                      onChange={e => setTakenTime(from12h(p.hour12, p.minute, e.target.value as 'AM' | 'PM'))}
                      className="flex-1 px-3 py-3 rounded-xl border border-gray-200 text-lg"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              )
            })()}
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
