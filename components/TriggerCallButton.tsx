'use client'

import { useState } from 'react'

interface Medication {
  id: string
  name: string
  nickname?: string
  reminder_times: string[]
}

interface Props {
  patientId: string
  patientName: string
  medications: Medication[]
  timezone: string
}

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

function getNextDueTime(medications: Medication[], timezone: string): { hasDue: boolean; nextTime: string | null; nextMedName: string | null } {
  const now = new Date()
  // Get current time in patient's timezone as HH:MM
  const patientTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [currentHour, currentMin] = patientTimeStr.split(':').map(Number)
  const currentMinutes = currentHour * 60 + currentMin

  // Collect all reminder times across all meds
  const allTimes: { time: string; totalMinutes: number; medName: string }[] = []
  for (const med of medications) {
    for (const t of med.reminder_times) {
      const [h, m] = t.split(':').map(Number)
      allTimes.push({
        time: t,
        totalMinutes: h * 60 + m,
        medName: med.nickname || med.name,
      })
    }
  }

  if (allTimes.length === 0) return { hasDue: false, nextTime: null, nextMedName: null }

  // Check if any time is NOW or in the past (overdue/due)
  const dueTimes = allTimes.filter(t => t.totalMinutes <= currentMinutes)
  if (dueTimes.length > 0) {
    return { hasDue: true, nextTime: null, nextMedName: null }
  }

  // Find the next upcoming time
  const upcoming = allTimes
    .filter(t => t.totalMinutes > currentMinutes)
    .sort((a, b) => a.totalMinutes - b.totalMinutes)

  if (upcoming.length > 0) {
    return {
      hasDue: false,
      nextTime: formatTime(upcoming[0].time),
      nextMedName: upcoming[0].medName,
    }
  }

  // All times passed today — meds are overdue
  return { hasDue: true, nextTime: null, nextMedName: null }
}

export default function TriggerCallButton({ patientId, patientName, medications, timezone }: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')

  const { hasDue, nextTime, nextMedName } = getNextDueTime(medications, timezone)

  async function handleClick() {
    // If no meds are due yet, show popup instead of calling
    if (!hasDue && nextTime) {
      setBlockedReason(`Next medication due at ${nextTime}${nextMedName ? ` — ${nextMedName}` : ''}`)
      setShowBlockedModal(true)
      return
    }

    // Meds are due — proceed with call
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/twilio/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, manual: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (data?.skipped) {
          setMessage(`Skipped: ${data.reason || 'unknown'}`)
        } else if (data?.callSid) {
          setMessage(`📞 Calling ${patientName}… (sid ${data.callSid})`)
        } else {
          setMessage(`📞 Calling ${patientName}…`)
        }
      } else {
        setMessage(`Error: ${data.error || 'Failed to start call'}`)
      }
    } catch {
      setMessage('Network error — please try again.')
    }
    setLoading(false)
    setTimeout(() => setMessage(''), 5000)
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={handleClick}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-base transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <span>📞</span>
          {loading ? 'Calling…' : 'Call Now'}
        </button>
        {message && (
          <p className={`text-xs ${message.startsWith('Error') ? 'text-red-500' : 'text-teal-600'}`}>
            {message}
          </p>
        )}
      </div>

      {/* Blocked modal — meds not due yet */}
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="text-5xl mb-4">⏰</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No Medications Due Yet
            </h3>
            <p className="text-gray-600 mb-1">
              {blockedReason}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Calls are only placed when medications are due or overdue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockedModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Got it
              </button>
              <button
                onClick={async () => {
                  setShowBlockedModal(false)
                  // Override — call anyway
                  setLoading(true)
                  try {
                    const res = await fetch('/api/twilio/outbound', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ patientId, manual: true }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      if (data?.skipped) setMessage(`Skipped: ${data.reason || 'unknown'}`)
                      else if (data?.callSid) setMessage(`📞 Calling ${patientName}… (sid ${data.callSid})`)
                      else setMessage(`📞 Calling ${patientName}…`)
                    } else {
                      setMessage(`Error: ${data.error || 'Failed to start call'}`)
                    }
                  } catch {
                    setMessage('Network error.')
                  }
                  setLoading(false)
                  setTimeout(() => setMessage(''), 5000)
                }}
                className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
              >
                Call Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
