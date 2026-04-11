'use client'

import { useState } from 'react'
import { Medication, DoseLog, Patient } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import NotificationPrefs, { NotificationPrefsType } from '@/components/NotificationPrefs'

interface UpcomingAppointment {
  id: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  doctor_name: string
  location?: string | null
}

interface Props {
  patient: Patient
  medications: Medication[]
  todayLogs: DoseLog[]
  streak: number
  firstName: string
  upcomingAppointments?: UpcomingAppointment[]
  patientTimezone?: string
  todayLocalStr?: string
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

function getTimeOfDay(timeStr: string): TimeOfDay {
  // timeStr is HH:MM:SS
  const [hourStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function MyMedsClient({
  patient,
  medications,
  todayLogs,
  streak,
  firstName,
  upcomingAppointments = [],
  patientTimezone = 'America/Chicago',
  todayLocalStr,
}: Props) {
  const supabase = createClient()
  const now = new Date()
  const hour = now.getHours()
  const greeting = getGreeting(hour)

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Track which meds have been logged this session
  const [loggedMeds, setLoggedMeds] = useState<Map<string, string>>(new Map())
  const [loadingMed, setLoadingMed] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<TimeOfDay>>(new Set(['morning']))

  // Notification prefs modal
  const [showPrefsModal, setShowPrefsModal] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefsType | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(false)

  async function openPrefsModal() {
    setShowPrefsModal(true)
    if (!notifPrefs) {
      setLoadingPrefs(true)
      try {
        const res = await fetch(`/api/patients/${patient.id}/notification-prefs`)
        if (res.ok) {
          const data = await res.json()
          setNotifPrefs(data)
        }
      } finally {
        setLoadingPrefs(false)
      }
    }
  }

  // Pre-populate from server logs
  const serverLogged = new Map<string, string>()
  for (const log of todayLogs) {
    if (log.confirmed === true && log.confirmed_at) {
      serverLogged.set(log.medication_id, log.confirmed_at)
    }
  }

  const allLogged = new Map([...serverLogged, ...loggedMeds])

  async function handleTookIt(med: Medication) {
    if (loadingMed) return
    setLoadingMed(med.id)

    const now = new Date()
    const takenAt = now.toISOString()

    try {
      // Check if a dose_log already exists for today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: existing } = await supabase
        .from('dose_logs')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('medication_id', med.id)
        .gte('scheduled_at', today.toISOString())
        .lt('scheduled_at', tomorrow.toISOString())
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from('dose_logs')
          .update({
            confirmed: true,
            confirmed_at: takenAt,
            method: 'app',
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('dose_logs')
          .insert({
            patient_id: patient.id,
            medication_id: med.id,
            medication_name: med.nickname || med.name,
            scheduled_at: takenAt,
            confirmed: true,
            confirmed_at: takenAt,
            method: 'app',
          })
      }

      setLoggedMeds(prev => new Map(prev).set(med.id, takenAt))
    } catch (err) {
      console.error('Failed to log dose:', err)
    } finally {
      setLoadingMed(null)
    }
  }

  // Group meds by time of day
  const groups: Record<TimeOfDay, Medication[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  }

  for (const med of medications) {
    const times = med.reminder_times || []
    if (times.length === 0) {
      groups.morning.push(med)
    } else {
      // Use first reminder time to categorize
      const tod = getTimeOfDay(times[0])
      groups[tod].push(med)
    }
  }

  const sectionConfig = [
    { key: 'morning' as TimeOfDay, label: 'Morning Medications', icon: '🌅' },
    { key: 'afternoon' as TimeOfDay, label: 'Afternoon Medications', icon: '🌆' },
    { key: 'evening' as TimeOfDay, label: 'Evening Medications', icon: '🌙' },
  ]

  const allMedsToday = medications.length
  const takenToday = medications.filter(m => allLogged.has(m.id)).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💊</span>
          <span className="text-xl font-bold text-teal-700">RxNudge</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-gray-700">{firstName}</span>
          <button
            onClick={openPrefsModal}
            className="text-gray-400 hover:text-teal-600 transition-colors text-xl"
            title="Notification Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Notification Prefs Modal */}
      {showPrefsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowPrefsModal(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div />
              <button
                onClick={() => setShowPrefsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-4 pb-8">
              {loadingPrefs ? (
                <div className="py-12 text-center text-gray-400 text-lg">Loading…</div>
              ) : notifPrefs ? (
                <NotificationPrefs
                  patientId={patient.id}
                  initialPrefs={notifPrefs}
                  onSave={() => setShowPrefsModal(false)}
                />
              ) : (
                <div className="py-12 text-center text-gray-400 text-lg">Could not load settings.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {greeting}, {firstName}! 💊
          </h1>
          <p className="text-xl text-gray-500 mt-1">{dateLabel}</p>
        </div>

        {/* Today progress */}
        {allMedsToday > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-medium text-gray-700">Today&apos;s Progress</span>
              <span className="text-lg font-bold text-teal-600">{takenToday}/{allMedsToday}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${takenToday === allMedsToday ? 'bg-emerald-500' : 'bg-teal-500'}`}
                style={{ width: `${allMedsToday > 0 ? Math.round((takenToday / allMedsToday) * 100) : 0}%` }}
              />
            </div>
            {takenToday === allMedsToday && allMedsToday > 0 && (
              <p className="text-lg text-emerald-600 font-semibold mt-2 text-center">
                All done! Great job! 🌟
              </p>
            )}
          </div>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-100 p-5 mb-6">
            <h2 className="text-xl font-bold text-blue-800 mb-3 flex items-center gap-2">
              📅 Upcoming Appointments
            </h2>
            <div className="divide-y divide-blue-50">
              {upcomingAppointments.map(appt => {
                const apptDate = new Date(`${appt.appointment_date}T${appt.appointment_time}`)
                const apptDateLocalStr = new Intl.DateTimeFormat('en-CA', {
                  timeZone: patientTimezone,
                }).format(apptDate)
                const isToday = todayLocalStr
                  ? apptDateLocalStr === todayLocalStr
                  : false
                const dayLabel = isToday ? 'Today' : 'Tomorrow'
                const timeStr = new Intl.DateTimeFormat('en-US', {
                  timeZone: patientTimezone,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }).format(apptDate)

                return (
                  <div key={appt.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-lg font-bold text-blue-700">
                      {dayLabel} {timeStr}
                    </p>
                    <p className="text-xl font-semibold text-gray-900 mt-0.5">
                      {appt.doctor_name} — {appt.appointment_type}
                    </p>
                    {appt.location && (
                      <p className="text-lg text-gray-500 mt-0.5">{appt.location}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No medications */}
        {medications.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="text-5xl mb-4">😊</div>
            <p className="text-xl text-gray-700">No medications set up yet.</p>
            <p className="text-lg text-gray-500 mt-2">Ask your caregiver to add your medications.</p>
          </div>
        )}

        {/* Medication sections */}
        {sectionConfig.map(({ key, label, icon }) => {
          const meds = groups[key]
          if (meds.length === 0) return null

          const isExpanded = expanded.has(key)
          const doneCount = meds.filter(m => allLogged.has(m.id)).length

          return (
            <div key={key} className="mb-4">
              {/* Section header */}
              <button
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between py-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xl font-bold text-gray-800">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-gray-500">{doneCount}/{meds.length}</span>
                    <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-3">
                  {meds.map(med => {
                    const takenAt = allLogged.get(med.id)
                    const isTaken = !!takenAt
                    const isLoading = loadingMed === med.id

                    return (
                      <div
                        key={med.id}
                        className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                          isTaken ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100'
                        }`}
                      >
                        {/* Medication name */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">
                              {isTaken ? '✅' : '💊'}
                            </span>
                            <p className="text-2xl font-bold text-gray-900">
                              {med.nickname || med.name}
                            </p>
                          </div>
                          {med.nickname && (
                            <p className="text-lg text-gray-500 ml-8">{med.name}</p>
                          )}
                          {med.dosage && (
                            <p className="text-lg text-gray-500 ml-8">{med.dosage}</p>
                          )}
                        </div>

                        {/* Button */}
                        {isTaken ? (
                          <div className="w-full bg-emerald-100 text-emerald-700 font-semibold py-4 px-6 rounded-full text-xl text-center">
                            ✅ Taken at {formatTime(takenAt!)}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleTookIt(med)}
                            disabled={isLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-5 px-6 rounded-full text-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                          >
                            {isLoading ? '⏳ Logging…' : '✅ I TOOK IT'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Streak */}
        {(streak > 0 || takenToday === allMedsToday) && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-2xl font-bold text-gray-800">
              📊 My streak: {streak > 0 ? streak : takenToday === allMedsToday ? 1 : 0} {streak === 1 ? 'day' : 'days'}
            </p>
            {streak >= 7 && (
              <p className="text-lg text-teal-600 mt-1">Keep it up! 🌟</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
