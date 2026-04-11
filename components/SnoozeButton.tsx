'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  medicationId: string
  scheduledAt: string
  onSnooze: (snoozeUntil: string) => void
  scheduledTime: string        // HH:MM wall-clock time the med is due (e.g. "09:00")
  patientTimezone: string      // IANA timezone (e.g. "America/Chicago")
  medicationName?: string      // for the "not due yet" message
}

// Check if the medication is due yet (compares current time in patient's timezone to scheduledTime)
function isMedDue(scheduledTime: string, patientTimezone: string): boolean {
  const now = new Date()
  const [hour, minute] = scheduledTime.split(':').map(Number)
  // Get current time in patient's timezone
  const patientNow = new Date(now.toLocaleString('en-US', { timeZone: patientTimezone }))
  const scheduledMinutes = hour * 60 + minute
  const currentMinutes = patientNow.getHours() * 60 + patientNow.getMinutes()
  return currentMinutes >= scheduledMinutes
}

function formatScheduledTime(scheduledTime: string, patientTimezone: string): string {
  try {
    const [hour, minute] = scheduledTime.split(':').map(Number)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: patientTimezone })
    const fakeDate = new Date(`${todayStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: patientTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(fakeDate)
  } catch {
    return scheduledTime
  }
}

export default function SnoozeButton({
  patientId,
  medicationId,
  scheduledAt,
  onSnooze,
  scheduledTime,
  patientTimezone,
  medicationName,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notDueMessage, setNotDueMessage] = useState(false)

  async function handleSnooze(hours: 1 | 2) {
    setLoading(true)
    try {
      const res = await fetch('/api/dose/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, medicationId, scheduledAt, hours, scheduledTime }),
      })
      if (res.ok) {
        const data = await res.json()
        onSnooze(data.snooze_until)
      } else {
        const err = await res.json()
        console.error('Snooze error:', err)
      }
    } catch (err) {
      console.error('Snooze error:', err)
    } finally {
      setLoading(false)
      setExpanded(false)
    }
  }

  function handleSnoozeClick() {
    if (!isMedDue(scheduledTime, patientTimezone)) {
      setNotDueMessage(true)
      return
    }
    setNotDueMessage(false)
    setExpanded(true)
  }

  // Show not-due message
  if (notDueMessage) {
    const formattedTime = formatScheduledTime(scheduledTime, patientTimezone)
    const medLabel = medicationName ? `${medicationName}` : 'This medication'
    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 max-w-xs">
          ⏰ {medLabel} isn&apos;t due until {formattedTime} — snooze is only available once the medication is due.
        </div>
        <button
          onClick={() => setNotDueMessage(false)}
          className="text-xs text-gray-400 hover:text-gray-600 self-end"
        >
          Dismiss
        </button>
      </div>
    )
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
      onClick={handleSnoozeClick}
      className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 font-medium py-1.5 px-3 rounded-lg transition-colors border border-amber-200"
      title="Snooze reminder"
    >
      😴 Snooze
    </button>
  )
}
