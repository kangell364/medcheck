'use client'

import { useState, useEffect } from 'react'
import NotificationPrefs, { NotificationPrefsType } from '@/components/NotificationPrefs'

const STYLE_LABELS: Record<string, string> = {
  silent: 'Silent',
  normal: 'Normal',
  alarm: 'Alarm',
}

const SOUND_LABELS: Record<string, string> = {
  default: 'Default Chime',
  'gentle-bells': 'Gentle Bells',
  'classic-alarm': 'Classic Alarm',
  'soft-piano': 'Soft Piano',
  'loud-buzzer': 'Loud Buzzer',
  'wake-up': 'Wake Up!',
}

interface Props {
  patientId: string
}

export default function NotificationSettingsCard({ patientId }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function loadPrefs() {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notification-prefs`)
      if (res.ok) {
        const data = await res.json()
        setPrefs(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrefs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const soundLabel = prefs ? (SOUND_LABELS[prefs.notification_sound] ?? prefs.notification_sound) : '—'
  const styleLabel = prefs ? (STYLE_LABELS[prefs.notification_style] ?? prefs.notification_style) : '—'
  const volumeLabel = prefs ? `${prefs.notification_volume}%` : '—'

  return (
    <>
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">🔔 Notification Settings</h2>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-teal-600 hover:underline font-medium"
          >
            Edit
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : prefs ? (
          <p className="text-sm text-gray-600">
            Sound: <span className="font-medium text-gray-800">{soundLabel}</span>
            {' · '}
            Volume: <span className="font-medium text-gray-800">{volumeLabel}</span>
            {' · '}
            Style: <span className="font-medium text-gray-800">{styleLabel}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-400">Could not load notification settings.</p>
        )}
      </div>

      {/* Edit modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">🔔 Edit Notification Settings</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-4 pb-6 pt-4">
              {prefs && (
                <NotificationPrefs
                  patientId={patientId}
                  initialPrefs={prefs}
                  onSave={() => {
                    setShowModal(false)
                    loadPrefs()
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
