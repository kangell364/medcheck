'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  medicationId: string
  scheduledAt: string
  onSnooze: (snoozeUntil: string) => void
}

export default function SnoozeButton({ patientId, medicationId, scheduledAt, onSnooze }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSnooze(hours: 1 | 2) {
    setLoading(true)
    try {
      const res = await fetch('/api/dose/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, medicationId, scheduledAt, hours }),
      })
      if (res.ok) {
        const data = await res.json()
        onSnooze(data.snooze_until)
      }
    } catch (err) {
      console.error('Snooze error:', err)
    } finally {
      setLoading(false)
      setExpanded(false)
    }
  }

  if (expanded) {
    return (
      <div className="flex gap-1 items-center">
        <span className="text-xs text-amber-700 font-medium mr-1">Snooze:</span>
        <button
          onClick={() => handleSnooze(1)}
          disabled={loading}
          className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium py-1.5 px-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          1 Hour
        </button>
        <button
          onClick={() => handleSnooze(2)}
          disabled={loading}
          className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-medium py-1.5 px-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          2 Hours
        </button>
        <button
          onClick={() => setExpanded(false)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-gray-600 py-1.5 px-1 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 font-medium py-1.5 px-3 rounded-lg transition-colors border border-amber-200"
      title="Snooze reminder"
    >
      😴 Snooze
    </button>
  )
}
