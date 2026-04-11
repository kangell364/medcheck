'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

interface PatientPrefs {
  notification_sound: string
  notification_volume: number
  notification_style: 'silent' | 'normal' | 'alarm'
  id: string
}

interface EscalationInfo {
  id: string
  medication_ids: string[]
  medications?: { name: string; nickname?: string | null }[]
}

function AlarmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const escalationId = searchParams.get('escalationId')
  const patientToken = searchParams.get('token') // optional

  const [prefs, setPrefs] = useState<PatientPrefs | null>(null)
  const [escalation, setEscalation] = useState<EscalationInfo | null>(null)
  const [volume, setVolume] = useState(80)
  const [isSilent, setIsSilent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [snoozed, setSnoozed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (loopRef.current) {
      clearInterval(loopRef.current)
      loopRef.current = null
    }
  }, [])

  const startAlarm = useCallback((soundId: string, vol: number) => {
    stopAlarm()
    const audio = new Audio(`/sounds/${soundId}.mp3`)
    audio.volume = vol / 100
    audioRef.current = audio

    const playLoop = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }
    }

    playLoop()
    // Re-play every 4 seconds for looping effect
    loopRef.current = setInterval(playLoop, 4000)
  }, [stopAlarm])

  useEffect(() => {
    async function load() {
      try {
        // Try to get patient prefs from escalation
        if (escalationId) {
          const escRes = await fetch(`/api/reminders/escalation/${escalationId}`)
          if (escRes.ok) {
            const escData = await escRes.json()
            setEscalation(escData)

            // Load patient prefs
            if (escData.patient_id) {
              const prefsRes = await fetch(`/api/patients/${escData.patient_id}/notification-prefs`)
              if (prefsRes.ok) {
                const p = await prefsRes.json()
                setPrefs({ ...p, id: escData.patient_id })
                setVolume(p.notification_volume ?? 80)
              }
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [escalationId])

  useEffect(() => {
    if (!loading && prefs && !isSilent) {
      startAlarm(prefs.notification_sound || 'default', volume)
    }
    return () => stopAlarm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, prefs])

  // Update volume in real-time
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  async function handleTookThem() {
    stopAlarm()
    setConfirmed(true)
    if (escalationId) {
      await fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId }),
      }).catch(() => {})
    }
    setTimeout(() => {
      window.close()
      router.push('/my-meds')
    }, 1200)
  }

  async function handleSnooze() {
    stopAlarm()
    setSnoozed(true)
    if (escalationId) {
      await fetch('/api/reminders/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId, minutes: 30 }),
      }).catch(() => {})
    }
    setTimeout(() => {
      window.close()
      router.push('/my-meds?snooze=1')
    }, 1200)
  }

  function handleGoSilent() {
    stopAlarm()
    setIsSilent(true)
    if (prefs) {
      fetch(`/api/patients/${prefs.id}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_style: 'silent' }),
      }).catch(() => {})
    }
  }

  async function handleVolumeChange(newVolume: number) {
    setVolume(newVolume)
    if (prefs) {
      await fetch(`/api/patients/${prefs.id}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_volume: newVolume }),
      }).catch(() => {})
    }
  }

  const medNames = escalation?.medications
    ?.map(m => m.nickname || m.name)
    .filter(Boolean) ?? []

  if (loading) {
    return (
      <div className="min-h-screen bg-red-600 flex items-center justify-center">
        <p className="text-white text-2xl animate-pulse">Loading…</p>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-7xl">✅</div>
        <p className="text-white text-3xl font-bold text-center">Great job!</p>
        <p className="text-white text-xl text-center">Dose logged successfully.</p>
      </div>
    )
  }

  if (snoozed) {
    return (
      <div className="min-h-screen bg-amber-500 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-7xl">⏰</div>
        <p className="text-white text-3xl font-bold text-center">Snoozed 30 min</p>
        <p className="text-white text-xl text-center">We&apos;ll remind you again.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6 text-white">
      {/* App badge */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-4xl">💊</span>
        <span className="text-2xl font-bold">RxNudge</span>
      </div>

      {/* Main alarm title */}
      <div className="text-center mb-8">
        <p className="text-4xl font-bold mb-2 animate-pulse">⏰ TIME FOR YOUR MEDS! ⏰</p>
        {medNames.length > 0 && (
          <div className="mt-4 space-y-1">
            {medNames.map((name, i) => (
              <p key={i} className="text-2xl font-semibold">{name}</p>
            ))}
          </div>
        )}
      </div>

      {/* Main action buttons */}
      <div className="w-full max-w-sm space-y-4 mb-8">
        <button
          onClick={handleTookThem}
          className="w-full bg-white text-emerald-700 font-extrabold py-6 rounded-2xl text-2xl shadow-lg hover:bg-emerald-50 active:scale-95 transition-all"
        >
          ✅ I TOOK THEM
        </button>
        <button
          onClick={handleSnooze}
          className="w-full bg-amber-400 text-white font-bold py-5 rounded-2xl text-xl shadow-lg hover:bg-amber-500 active:scale-95 transition-all"
        >
          ⏰ Snooze 30 min
        </button>
      </div>

      {/* Volume control */}
      <div className="w-full max-w-sm mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={e => handleVolumeChange(Number(e.target.value))}
            className="flex-1 h-3 accent-white"
          />
          <span className="text-xl">🔊</span>
        </div>
        <p className="text-center text-white/70 text-sm mt-1">Volume: {volume}%</p>
      </div>

      {/* Go silent */}
      {!isSilent ? (
        <button
          onClick={handleGoSilent}
          className="text-white/80 hover:text-white border border-white/40 rounded-xl px-6 py-3 text-base transition-colors"
        >
          🔕 Go Silent
        </button>
      ) : (
        <p className="text-white/70 text-base">🔕 Alarm silenced</p>
      )}
    </div>
  )
}

export default function AlarmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-red-600 flex items-center justify-center">
        <p className="text-white text-2xl">Loading…</p>
      </div>
    }>
      <AlarmContent />
    </Suspense>
  )
}
