'use client'

import { useState, useEffect } from 'react'
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
  showPasswordNudge?: boolean
  token?: string
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening'

type ChangeRequestStatus = 'none' | 'pending' | 'approved' | 'declined'

interface MedRequestState {
  status: ChangeRequestStatus
  caregiverNote?: string | null
}

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once daily' },
  { value: 'twice', label: 'Twice daily' },
  { value: 'three_times', label: 'Three times daily' },
]

function getTimeOfDay(timeStr: string): TimeOfDay {
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

function formatReminderTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

// ─── Change Request Modal ───────────────────────────────────────────────────

interface ChangeRequestModalProps {
  med: Medication
  patientId: string
  onClose: () => void
  onSubmitted: () => void
}

function ChangeRequestModal({ med, patientId, onClose, onSubmitted }: ChangeRequestModalProps) {
  const [reqName, setReqName] = useState(med.name)
  const [reqNickname, setReqNickname] = useState(med.nickname || '')
  const [reqDosage, setReqDosage] = useState(med.dosage || '')
  const [reqFrequency, setReqFrequency] = useState<'once' | 'twice' | 'three_times'>(med.frequency)
  const [reqTime, setReqTime] = useState(med.reminder_times?.[0]?.slice(0, 5) || '08:00')
  const [memberNote, setMemberNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/med-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          medication_id: med.id,
          type: 'change',
          requested_name: reqName !== med.name ? reqName : undefined,
          requested_dosage: reqDosage !== (med.dosage || '') ? reqDosage : undefined,
          requested_frequency: reqFrequency !== med.frequency ? reqFrequency : undefined,
          requested_reminder_times: reqTime !== (med.reminder_times?.[0]?.slice(0, 5) || '08:00')
            ? [reqTime + ':00']
            : undefined,
          requested_nickname: reqNickname !== (med.nickname || '') ? reqNickname : undefined,
          member_note: memberNote || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send request')
        return
      }
      onSubmitted()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">💬 Request a Change</h2>
              <p className="text-lg text-gray-500">{med.nickname || med.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
              <input
                type="text"
                value={reqName}
                onChange={e => setReqName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
              <input
                type="text"
                value={reqNickname}
                onChange={e => setReqNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="What do you call it?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
              <input
                type="text"
                value={reqDosage}
                onChange={e => setReqDosage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="e.g. 10mg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">How Often?</label>
              <select
                value={reqFrequency}
                onChange={e => setReqFrequency(e.target.value as 'once' | 'twice' | 'three_times')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg bg-white"
              >
                {FREQUENCY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Time</label>
              <input
                type="time"
                value={reqTime}
                onChange={e => setReqTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note to caregiver <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={memberNote}
                onChange={e => setMemberNote(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-lg"
                placeholder="Why are you requesting this change?"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-6 rounded-full text-xl transition-colors disabled:opacity-60"
            >
              {loading ? '⏳ Sending…' : '💬 Send Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-gray-200 text-gray-600 font-medium py-4 px-6 rounded-full text-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── New Medication Request Modal ───────────────────────────────────────────

interface NewMedRequestModalProps {
  patientId: string
  caregiverFirstName: string
  onClose: () => void
  onSubmitted: () => void
}

const FREQ_OPTIONS = [
  { value: 'once', label: 'Once daily', times: ['08:00'] },
  { value: 'twice', label: 'Twice daily', times: ['08:00', '20:00'] },
  { value: 'three_times', label: '3 times daily', times: ['08:00', '13:00', '20:00'] },
]

function NewMedRequestModal({ patientId, caregiverFirstName, onClose, onSubmitted }: NewMedRequestModalProps) {
  const [reqName, setReqName] = useState('')
  const [reqDosage, setReqDosage] = useState('')
  const [reqNickname, setReqNickname] = useState('')
  const [reqFrequency, setReqFrequency] = useState('once')
  const [reqTimes, setReqTimes] = useState(['08:00'])
  const [reqStartDate, setReqStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [memberNote, setMemberNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleFrequencyChange(freq: string) {
    setReqFrequency(freq)
    const opt = FREQ_OPTIONS.find(o => o.value === freq)
    if (opt) setReqTimes([...opt.times])
  }

  function updateTime(i: number, val: string) {
    const updated = [...reqTimes]
    updated[i] = val
    setReqTimes(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!memberNote.trim()) {
      setError('Please explain why you need this medication.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/med-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          medication_id: null,
          type: 'new_medication',
          requested_name: reqName,
          requested_dosage: reqDosage || undefined,
          requested_nickname: reqNickname || undefined,
          requested_frequency: reqFrequency,
          requested_reminder_times: reqTimes,
          requested_start_date: reqStartDate,
          member_note: memberNote,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to send request')
        return
      }
      onSubmitted()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">💊 Request a New Medication</h2>
              <p className="text-lg text-gray-500">{caregiverFirstName} will review your request</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medication Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reqName}
                onChange={e => setReqName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="e.g. Metoprolol"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dosage <span className="text-gray-400 font-normal">(if you know it)</span>
              </label>
              <input
                type="text"
                value={reqDosage}
                onChange={e => setReqDosage(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="e.g. 25mg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nickname <span className="text-gray-400 font-normal">(what do you call it?)</span>
              </label>
              <input
                type="text"
                value={reqNickname}
                onChange={e => setReqNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="e.g. heart pill"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={reqStartDate}
                onChange={e => setReqStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">How Often?</label>
              <div className="grid grid-cols-3 gap-2">
                {FREQ_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFrequencyChange(opt.value)}
                    className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                      reqFrequency === opt.value
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Times</label>
              <div className="space-y-2">
                {reqTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-20">
                      {i === 0 ? 'Morning' : i === 1 ? 'Evening' : 'Midday'}:
                    </span>
                    <input
                      type="time"
                      value={t}
                      onChange={e => updateTime(i, e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Why do you need this? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={memberNote}
                onChange={e => setMemberNote(e.target.value)}
                rows={3}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none text-lg"
                placeholder="e.g. My cardiologist prescribed this on Tuesday"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !reqName.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-6 rounded-full text-xl transition-colors disabled:opacity-60"
            >
              {loading ? '⏳ Sending…' : '💬 Send Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-gray-200 text-gray-600 font-medium py-4 px-6 rounded-full text-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MyMedsClient({
  patient,
  medications,
  todayLogs,
  streak,
  firstName,
  upcomingAppointments = [],
  patientTimezone = 'America/Chicago',
  todayLocalStr,
  showPasswordNudge = false,
  token,
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

  const [loggedMeds, setLoggedMeds] = useState<Map<string, string>>(new Map())
  const [loadingMed, setLoadingMed] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<TimeOfDay>>(new Set(['morning']))

  // Notification prefs modal
  const [showPrefsModal, setShowPrefsModal] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefsType | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(false)

  // Change request state per medication id
  const [medRequestState, setMedRequestState] = useState<Map<string, MedRequestState>>(new Map())
  // Which med's change request modal is open (null = none)
  const [changeReqModal, setChangeReqModal] = useState<Medication | null>(null)
  // New medication request modal
  const [showNewMedModal, setShowNewMedModal] = useState(false)
  // Success toast
  const [toast, setToast] = useState<string | null>(null)
  // Flash med IDs that just got approved
  const [approvedFlash, setApprovedFlash] = useState<Set<string>>(new Set())

  // Load existing pending change requests on mount
  useEffect(() => {
    if (medications.length === 0) return
    let cancelled = false

    async function fetchPendingRequests() {
      const medIds = medications.map(m => m.id)
      const { data } = await supabase
        .from('med_change_requests')
        .select('id, medication_id, status, caregiver_note, type, created_at')
        .eq('patient_id', patient.id)
        .eq('type', 'change')
        .in('medication_id', medIds)
        .order('created_at', { ascending: false })

      if (cancelled || !data) return

      // For each med, keep only the most recent request
      const stateMap = new Map<string, MedRequestState>()
      for (const req of data) {
        if (!req.medication_id) continue
        if (!stateMap.has(req.medication_id)) {
          stateMap.set(req.medication_id, {
            status: req.status as ChangeRequestStatus,
            caregiverNote: req.caregiver_note,
          })
        }
      }
      if (!cancelled) setMedRequestState(stateMap)
    }

    fetchPendingRequests()

    // Subscribe to realtime updates on med_change_requests
    const channel = supabase
      .channel('med-change-requests-member')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'med_change_requests',
          filter: `patient_id=eq.${patient.id}`,
        },
        (payload: any) => {
          const updated = payload.new
          if (!updated || !updated.medication_id) return
          setMedRequestState(prev => {
            const next = new Map(prev)
            next.set(updated.medication_id, {
              status: updated.status as ChangeRequestStatus,
              caregiverNote: updated.caregiver_note,
            })
            return next
          })
          // Flash the card if just approved
          if (updated.status === 'approved') {
            setApprovedFlash(prev => new Set(prev).add(updated.medication_id))
            setTimeout(() => {
              setApprovedFlash(prev => {
                const next = new Set(prev)
                next.delete(updated.medication_id)
                return next
              })
            }, 3000)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id])

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

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

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
          .update({ confirmed: true, confirmed_at: takenAt, method: 'app' })
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

  const groups: Record<TimeOfDay, Medication[]> = { morning: [], afternoon: [], evening: [] }

  for (const med of medications) {
    const times = med.reminder_times || []
    if (times.length === 0) {
      groups.morning.push(med)
    } else {
      groups[getTimeOfDay(times[0])].push(med)
    }
  }

  const sectionConfig = [
    { key: 'morning' as TimeOfDay, label: 'Morning Medications', icon: '🌅' },
    { key: 'afternoon' as TimeOfDay, label: 'Afternoon Medications', icon: '🌆' },
    { key: 'evening' as TimeOfDay, label: 'Evening Medications', icon: '🌙' },
  ]

  const allMedsToday = medications.length
  const takenToday = medications.filter(m => allLogged.has(m.id)).length

  // Caregiver first name (from patient.name — crude but works for "Jinky's caregiver is Keith")
  // We'll just use a generic label
  const caregiverName = 'your caregiver'

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

      {showPasswordNudge && token && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between gap-3">
          <span className="text-lg text-amber-800 leading-snug">
            🔒 Your info is protected by your personal link.
          </span>
          <a
            href={`/p/${token}?createAccount=1`}
            className="flex-shrink-0 text-lg font-semibold text-teal-700 underline whitespace-nowrap"
          >
            Create a password →
          </a>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-lg font-medium px-6 py-3 rounded-2xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

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
              <button onClick={() => setShowPrefsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
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

      {/* Change Request Modal */}
      {changeReqModal && (
        <ChangeRequestModal
          med={changeReqModal}
          patientId={patient.id}
          onClose={() => setChangeReqModal(null)}
          onSubmitted={() => {
            setMedRequestState(prev => {
              const next = new Map(prev)
              next.set(changeReqModal.id, { status: 'pending' })
              return next
            })
            showToast('✅ Request sent! Your caregiver will review it.')
          }}
        />
      )}

      {/* New Medication Request Modal */}
      {showNewMedModal && (
        <NewMedRequestModal
          patientId={patient.id}
          caregiverFirstName={caregiverName}
          onClose={() => setShowNewMedModal(false)}
          onSubmitted={() => {
            showToast('✅ Request sent! Your caregiver will review it.')
          }}
        />
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
                const isToday = todayLocalStr ? apptDateLocalStr === todayLocalStr : false
                const dayLabel = isToday ? 'Today' : 'Tomorrow'
                const timeStr = new Intl.DateTimeFormat('en-US', {
                  timeZone: patientTimezone,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }).format(apptDate)

                return (
                  <div key={appt.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-lg font-bold text-blue-700">{dayLabel} {timeStr}</p>
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
                    const reqState = medRequestState.get(med.id)
                    const isFlashing = approvedFlash.has(med.id)

                    return (
                      <div
                        key={med.id}
                        className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                          isFlashing
                            ? 'border-emerald-400 bg-emerald-50 animate-pulse'
                            : isTaken
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-gray-100'
                        }`}
                      >
                        {/* Medication name */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{isTaken ? '✅' : '💊'}</span>
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
                          {med.reminder_times?.[0] && (
                            <p className="text-base text-gray-400 ml-8">
                              ⏰ {formatReminderTime(med.reminder_times[0])}
                            </p>
                          )}
                        </div>

                        {/* Took it button */}
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

                        {/* Change request button area — only show if caregiver oversees meds */}
                        {!patient.member_can_self_manage && (
                          <div className="mt-3">
                            {reqState?.status === 'pending' ? (
                              <div className="w-full bg-amber-50 border border-amber-200 text-amber-700 font-medium py-3 px-4 rounded-full text-base text-center">
                                ⏳ Change Pending Approval
                              </div>
                            ) : reqState?.status === 'declined' ? (
                              <div className="space-y-1">
                                <button
                                  onClick={() => setChangeReqModal(med)}
                                  className="w-full border border-teal-300 text-teal-700 font-medium py-3 px-4 rounded-full text-base hover:bg-teal-50 transition-colors"
                                >
                                  💬 Request a Change
                                </button>
                                <p className="text-sm text-gray-500 text-center">
                                  Last request was declined.{' '}
                                  {reqState.caregiverNote ? `"${reqState.caregiverNote}"` : 'You can submit a new request.'}
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={() => setChangeReqModal(med)}
                                className="w-full border border-teal-300 text-teal-700 font-medium py-3 px-4 rounded-full text-base hover:bg-teal-50 transition-colors"
                              >
                                💬 Request a Change
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Request New Medication button — only show if caregiver oversees meds */}
        {!patient.member_can_self_manage && (
          <div className="mt-6">
            <button
              onClick={() => setShowNewMedModal(true)}
              className="w-full border-2 border-teal-400 text-teal-700 font-semibold py-4 px-6 rounded-2xl text-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-2xl">+</span>
              Request a New Medication
            </button>
          </div>
        )}

        {/* Streak */}
        {(streak > 0 || takenToday === allMedsToday) && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-2xl font-bold text-gray-800">
              📊 My streak: {streak > 0 ? streak : takenToday === allMedsToday ? 1 : 0}{' '}
              {streak === 1 ? 'day' : 'days'}
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
