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
          reminder_time: reminderTime,
          action: 'taken',
          timezone: patientTimezone,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(json?.details || json?.error || 'Could not log dose')
        return
      }

      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={handleLogTaken}
      disabled={saving}
      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
    >
      {saving ? 'Saving…' : '✅ Log Taken'}
    </button>
  )
}
