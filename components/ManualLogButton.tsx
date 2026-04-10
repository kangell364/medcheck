'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  medicationId: string
  patientId: string
  medicationName: string
}

export default function ManualLogButton({ medicationId, patientId, medicationName }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function logDose(confirmed: boolean) {
    setLoading(true)
    const now = new Date()
    // Set scheduled_at to start of today
    const scheduledAt = new Date()
    scheduledAt.setHours(0, 0, 0, 0)

    await supabase.from('dose_logs').upsert({
      patient_id: patientId,
      medication_id: medicationId,
      scheduled_at: scheduledAt.toISOString(),
      confirmed,
      confirmed_at: now.toISOString(),
      method: 'app',
    }, {
      onConflict: 'patient_id,medication_id,scheduled_at',
    })

    router.refresh()
    setLoading(false)
  }

  return (
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
  )
}
