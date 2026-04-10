'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  patientName: string
}

export default function TriggerCallButton({ patientId, patientName }: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function triggerCall() {
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/twilio/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`📞 Call initiated for ${patientName}!`)
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
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={triggerCall}
        disabled={loading}
        className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
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
  )
}
