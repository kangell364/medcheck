'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SnoozeButton from './SnoozeButton'

interface Props {
  medicationId: string
  patientId: string
  medicationName: string
  scheduledAt?: string
  snoozeUntil?: string | null
  /** HH:MM wall-clock time the med is due for the current slot (e.g. "09:00") */
  scheduledTime: string
  /** IANA timezone for the patient (e.g. "America/Chicago") */
  patientTimezone: string
  /** Optional callback fired when snooze is successfully set, with the snooze_until ISO string */
  onSnooze?: (snoozeUntil: string) => void
}

function formatSnoozeTime(isoString: string): string {
  const date = new Date(isoString)
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const minStr = minutes === 0 ? '00' : minutes.toString().padStart(2, '0')
  return `${hours}:${minStr} ${ampm}`
}

export default function ManualLogButton({
  medicationId,
  patientId,
  medicationName,
  scheduledAt,
  snoozeUntil: initialSnoozeUntil,
  scheduledTime,
  patientTimezone,
  onSnooze,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(initialSnoozeUntil ?? null)
  const router = useRouter()
  const supabase = createClient()

  const scheduledAtStr = scheduledAt || (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()

  // Check if snooze is still active
  const isSnoozed = snoozeUntil !== null && new Date(snoozeUntil) > new Date()

  async function logDose(confirmed: boolean) {
    setLoading(true)
    const now = new Date()

    await supabase.from('dose_logs').upsert({
      patient_id: patientId,
      medication_id: medicationId,
      medication_name: medicationName,
      scheduled_at: scheduledAtStr,
      confirmed,
      confirmed_at: now.toISOString(),
      method: 'app',
    }, {
      onConflict: 'patient_id,medication_id,scheduled_at',
    })

    router.refresh()
    setLoading(false)
  }

  function handleSnooze(snoozeUntilTimestamp: string) {
    setSnoozeUntil(snoozeUntilTimestamp)
    onSnooze?.(snoozeUntilTimestamp)
  }

  if (isSnoozed) {
    return (
      <div className="flex items-center">
        <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
          ⏰ Snoozed — AI will call at {formatSnoozeTime(snoozeUntil!)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex gap-1">
        <button
          onClick={() => logDose(true)}
          disabled={loading}
          className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
          title={`Mark ${medicationName} as taken`}
        >
          ✓ Taken
        </button>
        <button
          onClick={() => logDose(false)}
          disabled={loading}
          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
          title={`Mark ${medicationName} as missed`}
        >
          ✗ Skip
        </button>
      </div>
      <SnoozeButton
        patientId={patientId}
        medicationId={medicationId}
        scheduledAt={scheduledAtStr}
        onSnooze={handleSnooze}
        scheduledTime={scheduledTime}
        patientTimezone={patientTimezone}
        medicationName={medicationName}
      />
    </div>
  )
}
