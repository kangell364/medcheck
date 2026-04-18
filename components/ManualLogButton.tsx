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
      const scheduledAt = `${dateStr}T${takenTime}:00`
      const scheduledAtPlus = `${dateStr}T${takenTime}:00.000Z`
      const now = new Date().toISOString()

      const { data: existingRows, error: existingError } = await supabase
        .from('dose_logs')
        .select('id')
        .eq('patient_id', patientId)
        .eq('medication_id', medicationId)
        .gte('scheduled_at', `${dateStr}T00:00:00`)
        .lte('scheduled_at', `${dateStr}T23:59:59`)
        .order('scheduled_at', { ascending: false })

      const existing = (existingRows && existingRows.length > 0) ? existingRows[0] : null

      if (existingError) {
        console.error('[ManualLogButton] lookup error', existingError)
        alert(`Could not log dose: ${existingError.message}`)
        return
      }


      if (existing) {
        // If the chosen time already exists as another row, fall back to updating WITHOUT changing scheduled_at.
        const { error: updateError } = await supabase.from('dose_logs').update({
          confirmed: true,
          confirmed_at: now,
          method: 'manual',
          scheduled_at: scheduledAt,
        }).eq('id', existing.id)

        if (updateError && /duplicate key value violates unique constraint/i.test(updateError.message)) {
          const { error: fallbackError } = await supabase.from('dose_logs').update({
            confirmed: true,
            confirmed_at: now,
            method: 'manual',
          }).eq('id', existing.id)

          if (fallbackError) {
            console.error('[ManualLogButton] update fallback error', fallbackError)
            alert(`Could not log dose: ${fallbackError.message}`)
            return
          }

          setShowModal(false)
          router.refresh()
          return
        }

        if (updateError) {
          console.error('[ManualLogButton] update error', updateError)
          alert(`Could not log dose: ${updateError.message}`)
          return
        }
      } else {
        const { error: insertError } = await supabase.from('dose_logs').insert({
          patient_id: patientId,
          medication_id: medicationId,
          medication_name: medicationName,
          scheduled_at: scheduledAt,
          confirmed: true,
          confirmed_at: now,
          method: 'manual',
        })

        // If a row already exists for that exact scheduled_at, just update that row instead.
        if (insertError && /duplicate key value violates unique constraint/i.test(insertError.message)) {
          const { data: existingExact, error: exactErr } = await supabase
            .from('dose_logs')
            .select('id')
            .eq('patient_id', patientId)
            .eq('medication_id', medicationId)
            .eq('scheduled_at', scheduledAt)
            .maybeSingle()

          if (exactErr) {
            console.error('[ManualLogButton] exact lookup error', exactErr)
            alert(`Could not log dose: ${exactErr.message}`)
            return
          }

          if (existingExact?.id) {
            const { error: exactUpdateErr } = await supabase.from('dose_logs').update({
              confirmed: true,
              confirmed_at: now,
              method: 'manual',
            }).eq('id', existingExact.id)

            if (exactUpdateErr) {
              console.error('[ManualLogButton] exact update error', exactUpdateErr)
              alert(`Could not log dose: ${exactUpdateErr.message}`)
              return
            }

            setShowModal(false)
            router.refresh()
            return
          }
        }

        if (insertError) {
          console.error('[ManualLogButton] insert error', insertError)
          alert(`Could not log dose: ${insertError.message}`)
          return
        }
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
        className="text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-300 px-2.5 py-1 rounded-full hover:bg-teal-50 transition-colors"
      >
        📝 Log Anyway
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
