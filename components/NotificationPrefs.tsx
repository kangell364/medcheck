'use client'

import { useState, useRef, useCallback } from 'react'

export interface NotificationPrefsType {
  notification_style: 'silent' | 'normal' | 'alarm'
  notification_volume: number
  notification_sound: string
}

const SOUNDS: { id: string; label: string; emoji: string }[] = [
  { id: 'default', label: 'Default Chime', emoji: '🔔' },
  { id: 'gentle-bells', label: 'Gentle Bells', emoji: '🎵' },
  { id: 'classic-alarm', label: 'Classic Alarm', emoji: '📯' },
  { id: 'soft-piano', label: 'Soft Piano', emoji: '🎶' },
  { id: 'loud-buzzer', label: 'Loud Buzzer', emoji: '📣' },
  { id: 'wake-up', label: 'Wake Up!', emoji: '🎺' },
]

interface Props {
  patientId: string
  initialPrefs: NotificationPrefsType
  onSave?: () => void
}

export default function NotificationPrefs({ patientId, initialPrefs, onSave }: Props) {
  const [style, setStyle] = useState<NotificationPrefsType['notification_style']>(
    initialPrefs.notification_style ?? 'normal'
  )
  const [volume, setVolume] = useState<number>(initialPrefs.notification_volume ?? 80)
  const [sound, setSound] = useState<string>(initialPrefs.notification_sound ?? 'default')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  const playSound = useCallback(
    (soundId: string) => {
      stopAudio()
      const audio = new Audio(`/sounds/${soundId}.mp3`)
      audio.volume = volume / 100
      audioRef.current = audio
      audio.play().catch(() => {
        // Browser may block autoplay — that's OK
      })
    },
    [volume, stopAudio]
  )

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/patients/${patientId}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_style: style,
          notification_volume: volume,
          notification_sound: sound,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSave?.()
    } finally {
      setSaving(false)
    }
  }

  const currentSound = SOUNDS.find(s => s.id === sound) ?? SOUNDS[0]

  return (
    <div className="bg-white rounded-2xl p-5 space-y-6">
      {/* Header */}
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        🔔 Reminder Settings
      </h2>

      {/* Sound picker */}
      <div>
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Alarm Sound
        </label>
        {/* Selected sound bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between bg-gray-50">
            <span className="text-base font-medium text-gray-800">
              {currentSound.emoji} {currentSound.label}
            </span>
            <span className="text-gray-400 text-sm">▼</span>
          </div>
          <button
            onClick={() => playSound(sound)}
            className="bg-teal-100 hover:bg-teal-200 text-teal-700 font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
          >
            ▶ Preview
          </button>
        </div>

        {/* Sound list */}
        <div className="space-y-2">
          {SOUNDS.map(s => (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 cursor-pointer transition-all ${
                sound === s.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
              onClick={() => setSound(s.id)}
            >
              <span className={`text-base font-medium ${sound === s.id ? 'text-teal-800' : 'text-gray-800'}`}>
                {s.emoji} {s.label}
              </span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  playSound(s.id)
                }}
                className="bg-gray-100 hover:bg-teal-100 text-gray-600 hover:text-teal-700 rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Volume slider */}
      <div>
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Volume
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-12">Silent</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="flex-1 h-2 accent-teal-600"
          />
          <span className="text-sm text-gray-500 w-10 text-right">Loud</span>
          <span className="text-sm font-semibold text-teal-700 w-10 text-right">{volume}%</span>
        </div>
      </div>

      {/* Style picker */}
      <div>
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Notification Style
        </label>
        <div className="space-y-2">
          {[
            { value: 'silent', emoji: '🔕', label: 'Silent notification', desc: 'No sound, no vibration' },
            { value: 'normal', emoji: '🔔', label: 'Sound + vibrate', desc: 'Default — plays chime once' },
            { value: 'alarm', emoji: '🚨', label: 'Alarm', desc: 'Repeating until dismissed' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 border-2 cursor-pointer transition-all ${
                style === opt.value
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="notification_style"
                value={opt.value}
                checked={style === opt.value}
                onChange={() => setStyle(opt.value as NotificationPrefsType['notification_style'])}
                className="mt-0.5 accent-teal-600"
              />
              <div>
                <span className="text-base font-medium text-gray-800">
                  {opt.emoji} {opt.label}
                </span>
                <p className="text-sm text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-full text-lg transition-colors disabled:opacity-60 shadow-sm"
      >
        {saved ? '✅ Saved!' : saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
