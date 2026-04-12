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

// Slot log shape used in slotLogMap
interface SlotLog {
  confirmed: boolean | null
  method: string | null
  confirmed_at: string | null
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

  // loggedMeds: Map<"med_id:HH:MM", "ISO timestamp" | "skipped">
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

  // ── Build slotLogMap: "med_id:HH:MM" → SlotLog ─────────────────────────
  const slotLogMap = new Map<string, SlotLog>()
  for (const log of todayLogs) {
    // scheduled_at may be "2026-04-11T08:00:00" or ISO with TZ
    const timeStr = log.scheduled_at.slice(11, 16) // "08:00"
    const key = `${log.medication_id}:${timeStr}`
    slotLogMap.set(key, {
      confirmed: log.confirmed,
      method: log.method,
      confirmed_at: log.confirmed_at,
    })
  }

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

  // ── Per-slot action handler ──────────────────────────────────────────────
  async function handleSlotAction(med: Medication, reminderTime: string, action: 'taken' | 'skipped') {
    const key = `${med.id}:${reminderTime}`
    if (loadingMed === key) return
    setLoadingMed(key)

    try {
      const res = await fetch('/api/dose-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          medication_id: med.id,
          reminder_time: reminderTime,
          action,
          timezone: (patient.timezone as string) || patientTimezone || 'America/Chicago',
        }),
      })

      if (res.ok) {
        setLoggedMeds(prev => {
          const next = new Map(prev)
          next.set(key, action === 'taken' ? new Date().toISOString() : 'skipped')
          return next
        })
      }
    } catch (err) {
      console.error('Failed to log dose:', err)
    } finally {
      setLoadingMed(null)
    }
  }

  // ── Helper to get slot status ────────────────────────────────────────────
  function getSlotStatus(med: Medication, reminderTime: string): {
    isTaken: boolean
    isSkipped: boolean
    takenAt: string | null
  } {
    const key = `${med.id}:${reminderTime}`

    // Check optimistic state first
    const optimistic = loggedMeds.get(key)
    if (optimistic) {
      if (optimistic === 'skipped') return { isTaken: false, isSkipped: true, takenAt: null }
      return { isTaken: true, isSkipped: false, takenAt: optimistic }
    }

    // Fall back to server data
    const serverLog = slotLogMap.get(key)
    if (serverLog) {
      if (serverLog.confirmed === false) {
        // method='manual' + confirmed=false = skipped
        const isSkipped = serverLog.method === 'manual'
        return { isTaken: false, isSkipped, takenAt: null }
      }
      if (serverLog.confirmed === true) {
        return { isTaken: true, isSkipped: false, takenAt: serverLog.confirmed_at }
      }
    }

    return { isTaken: false, isSkipped: false, takenAt: null }
  }

  // ── Group medications by time-of-day (based on first reminder time) ──────
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

  // ── Today's progress: count total slots and taken slots ──────────────────
  const allMedsToday = medications.reduce((sum, m) => sum + (m.reminder_times?.length || 1), 0)
  const takenToday = medications.reduce((sum, m) => {
    return sum + (m.reminder_times?.length ? m.reminder_times : ['08:00']).filter(t => {
      const { isTaken } = getSlotStatus(m, t)
      return isTaken
    }).length
  }, 0)

  const caregiverName = 'your caregiver'

  // ── Dashboard tab state ────────────────────────────────────────────────────
  type DashTab = 'today' | 'history' | 'appointments' | 'report'
  const [dashTab, setDashTab] = useState<DashTab>('today')

  // ── Appointments state ────────────────────────────────────────────────────
  interface ApptRow { id: string; doctor_name: string; appointment_date: string; appointment_time: string; location: string | null; appointment_type: string | null; notes: string | null; status: string | null }
  const [appts, setAppts] = useState<ApptRow[]>([])
  const [loadingAppts, setLoadingAppts] = useState(false)
  const [showApptForm, setShowApptForm] = useState(false)
  const [apptDoctor, setApptDoctor] = useState('')
  const [apptDate, setApptDate] = useState('')
  const [apptTime, setApptTime] = useState('')
  const [apptLocation, setApptLocation] = useState('')
  const [apptNotes, setApptNotes] = useState('')
  const [savingAppt, setSavingAppt] = useState(false)

  useEffect(() => {
    if (dashTab !== 'appointments') return
    setLoadingAppts(true)
    supabase.from('appointments').select('*').eq('patient_id', patient.id).order('appointment_date', { ascending: true }).then(({ data }) => {
      setAppts((data as ApptRow[]) || [])
      setLoadingAppts(false)
    })
  }, [dashTab, patient.id, supabase])

  async function saveAppt() {
    if (!apptDoctor || !apptDate || !apptTime) return
    setSavingAppt(true)
    const { data } = await supabase.from('appointments').insert({ patient_id: patient.id, owner_id: patient.owner_id, doctor_name: apptDoctor, appointment_date: apptDate, appointment_time: apptTime, location: apptLocation || null, notes: apptNotes || null, status: 'upcoming' }).select().single()
    if (data) { setAppts(prev => [...prev, data as ApptRow]); setShowApptForm(false); setApptDoctor(''); setApptDate(''); setApptTime(''); setApptLocation(''); setApptNotes('') }
    setSavingAppt(false)
  }

  async function updateApptStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  // ── History helpers ────────────────────────────────────────────────────────
  // We need all logs for history — todayLogs only covers today.
  // For now use todayLogs for today and a separate fetch for history.
  const [allLogs, setAllLogs] = useState<DoseLog[] | null>(null)

  useEffect(() => {
    if (dashTab !== 'history') return
    if (allLogs !== null) return
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    supabase
      .from('dose_logs')
      .select('*')
      .eq('patient_id', patient.id)
      .gte('scheduled_at', thirtyDaysAgo.toISOString())
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => {
        setAllLogs((data as DoseLog[]) || [])
      })
  }, [dashTab, patient.id, supabase, allLogs])

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })

  // Build history slots: one per med per reminder_time
  const historySlots: Array<{ med: Medication; time: string; label: string }> = []
  for (const med of medications) {
    const times = med.reminder_times?.length ? med.reminder_times : ['08:00']
    times.forEach((t, i) => {
      historySlots.push({
        med,
        time: t,
        label: i === 0 ? (med.nickname || med.name) : `  ↳ ${formatReminderTime(t)}`,
      })
    })
  }

  // Adherence calculation based on history slots × 30 days
  const totalCells = historySlots.length * 30
  let takenCells = 0
  if (allLogs) {
    for (const slot of historySlots) {
      for (const day of last30) {
        const log = allLogs.find(l =>
          l.medication_id === slot.med.id &&
          l.scheduled_at.startsWith(day) &&
          l.scheduled_at.includes(`T${slot.time}`)
        )
        if (log?.confirmed === true) takenCells++
      }
    }
  }
  const adherencePct = totalCells > 0 ? Math.round((takenCells / totalCells) * 100) : 0

  // ── Report download ───────────────────────────────────────────────────────
  const [downloadingReport, setDownloadingReport] = useState(false)
  async function downloadReport() {
    setDownloadingReport(true)
    try {
      const res = await fetch(`/api/report/patient/${patient.id}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `RxNudge-Report-${firstName}.pdf`; a.click()
        URL.revokeObjectURL(url)
      }
    } finally { setDownloadingReport(false) }
  }

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

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-[65px] z-10 bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto flex">
          {([['today','💊','Today'],['history','📋','History'],['appointments','📅','Appts'],['report','📄','Report']] as [DashTab,string,string][]).map(([id,emoji,label]) => (
            <button key={id} onClick={() => setDashTab(id)}
              className={`flex-1 py-3 text-sm font-semibold flex flex-col items-center gap-0.5 border-b-2 transition-colors ${dashTab === id ? 'border-teal-500 text-teal-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <span className="text-xl">{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── History Tab ──────────────────────────────────────────────────── */}
      {dashTab === 'history' && (
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">📋 My History</h2>
          <p className="text-lg text-gray-500 mb-5">Last 30 days</p>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 text-center">
            <p className="text-5xl font-bold text-teal-600">{adherencePct}%</p>
            <p className="text-lg text-gray-500 mt-1">Overall adherence</p>
          </div>
          {medications.length === 0 ? (
            <p className="text-center text-gray-400 text-lg">No medications yet.</p>
          ) : allLogs === null ? (
            <p className="text-center text-gray-400 text-lg py-8">Loading history…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-sm text-gray-500 font-medium pr-2 pb-2 min-w-[90px]">Med / Time</th>
                    {last30.slice(-14).map(d => (
                      <th key={d} className="text-center text-gray-400 pb-2 w-7">{new Date(d + 'T12:00:00').getDate()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historySlots.map((slot, idx) => (
                    <tr key={`${slot.med.id}:${slot.time}:${idx}`}>
                      <td className="text-sm text-gray-700 pr-2 py-1 truncate max-w-[90px]">
                        {slot.label}
                        {slot.med.reminder_times?.length > 1 && idx === historySlots.findIndex(s => s.med.id === slot.med.id) && (
                          <span className="ml-1 text-xs text-gray-400">{formatReminderTime(slot.time)}</span>
                        )}
                      </td>
                      {last30.slice(-14).map(d => {
                        const log = allLogs.find(l =>
                          l.medication_id === slot.med.id &&
                          l.scheduled_at.startsWith(d) &&
                          l.scheduled_at.includes(`T${slot.time}`)
                        )
                        const cell = log?.confirmed ? '✅' : (log?.confirmed === false && log?.method === 'manual') ? '⏭️' : '⬜'
                        return (
                          <td key={d} className="text-center py-1">
                            <span className="text-base">{cell}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3 text-center">Showing last 14 days</p>
            </div>
          )}
        </div>
      )}

      {/* ── Appointments Tab ─────────────────────────────────────────────── */}
      {dashTab === 'appointments' && (
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-gray-900">📅 Appointments</h2>
            <button onClick={() => setShowApptForm(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors">+ Add</button>
          </div>
          {showApptForm && (
            <div className="bg-white rounded-2xl border border-teal-200 p-5 mb-5 space-y-3">
              <h3 className="text-lg font-bold text-gray-900">New Appointment</h3>
              <input type="text" placeholder="Doctor / Clinic name *" value={apptDoctor} onChange={e => setApptDoctor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <input type="text" placeholder="Location (optional)" value={apptLocation} onChange={e => setApptLocation(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <textarea placeholder="Notes (optional)" value={apptNotes} onChange={e => setApptNotes(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              <div className="flex gap-3">
                <button onClick={saveAppt} disabled={savingAppt || !apptDoctor || !apptDate || !apptTime} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl text-lg disabled:opacity-50 transition-colors">{savingAppt ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setShowApptForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-lg hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          )}
          {loadingAppts ? (
            <p className="text-center text-gray-400 text-lg py-8">Loading…</p>
          ) : appts.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="text-5xl mb-3">📅</div>
              <p className="text-xl text-gray-500">No appointments yet</p>
              <button onClick={() => setShowApptForm(true)} className="mt-4 text-teal-600 text-lg font-semibold underline">Add your first one</button>
            </div>
          ) : (
            <div className="space-y-3">
              {appts.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl border p-5 ${a.status === 'completed' ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{a.doctor_name}</p>
                      <p className="text-lg text-gray-600">{new Date(a.appointment_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {a.appointment_time}</p>
                      {a.location && <p className="text-base text-gray-500">📍 {a.location}</p>}
                      {a.notes && <p className="text-base text-gray-500 mt-1 italic">{a.notes}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ml-2 shrink-0 ${a.status === 'completed' ? 'bg-green-100 text-green-700' : a.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>{a.status || 'upcoming'}</span>
                  </div>
                  {a.status !== 'completed' && a.status !== 'cancelled' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => updateApptStatus(a.id, 'completed')} className="flex-1 border border-green-300 text-green-700 font-medium py-2 rounded-xl text-sm hover:bg-green-50 transition-colors">✅ Done</button>
                      <button onClick={() => updateApptStatus(a.id, 'cancelled')} className="flex-1 border border-gray-200 text-gray-500 font-medium py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">❌ Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Report Tab ───────────────────────────────────────────────────── */}
      {dashTab === 'report' && (
        <div className="max-w-lg mx-auto px-4 py-10 pb-24 text-center">
          <div className="text-7xl mb-5">📄</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">My Medication Report</h2>
          <p className="text-xl text-gray-500 mb-8">Download a PDF summary of your medication history and adherence.</p>
          <button onClick={downloadReport} disabled={downloadingReport}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-5 px-6 rounded-2xl text-2xl transition-colors disabled:opacity-60 shadow-md">
            {downloadingReport ? '⏳ Generating…' : '📄 Download My Report'}
          </button>
          <p className="text-base text-gray-400 mt-5">Your caregiver can also download this report from their dashboard.</p>
        </div>
      )}

      {/* ── Today Tab ────────────────────────────────────────────────────── */}
      {dashTab === 'today' && <div className="max-w-lg mx-auto px-4 py-6 pb-24">
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

        {/* Medication sections — one row per reminder_time slot */}
        {sectionConfig.map(({ key, label, icon }) => {
          const meds = groups[key]
          if (meds.length === 0) return null

          const isExpanded = expanded.has(key)

          // Count total slots and taken slots for this section
          const totalSlots = meds.reduce((s, m) => s + (m.reminder_times?.length || 1), 0)
          const doneSlots = meds.reduce((s, m) => {
            const times = m.reminder_times?.length ? m.reminder_times : ['08:00']
            return s + times.filter(t => getSlotStatus(m, t).isTaken).length
          }, 0)

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
                    <span className="text-lg text-gray-500">{doneSlots}/{totalSlots}</span>
                    <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-3">
                  {meds.map(med => {
                    const times = med.reminder_times?.length ? med.reminder_times : ['08:00']
                    const reqState = medRequestState.get(med.id)
                    const isFlashing = approvedFlash.has(med.id)

                    return (
                      <div
                        key={med.id}
                        className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                          isFlashing ? 'border-emerald-400 bg-emerald-50 animate-pulse' : 'border-gray-100'
                        }`}
                      >
                        {/* Medication name + details */}
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">💊</span>
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

                        {/* One row per reminder time */}
                        <div className="space-y-2">
                          {times.map((reminderTime, tIdx) => {
                            const slotKey = `${med.id}:${reminderTime}`
                            const isLoading = loadingMed === slotKey
                            const { isTaken, isSkipped, takenAt } = getSlotStatus(med, reminderTime)

                            return (
                              <div
                                key={reminderTime}
                                className={`rounded-xl p-3 border ${
                                  isTaken
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : isSkipped
                                      ? 'bg-gray-50 border-gray-200'
                                      : 'bg-white border-gray-100'
                                }`}
                              >
                                {/* Time label */}
                                <p className="text-base font-semibold text-gray-600 mb-2">
                                  ⏰ {formatReminderTime(reminderTime)}
                                  {times.length > 1 && (
                                    <span className="ml-2 text-xs text-gray-400 font-normal">
                                      Dose {tIdx + 1} of {times.length}
                                    </span>
                                  )}
                                </p>

                                {isTaken ? (
                                  <div className="w-full bg-emerald-100 text-emerald-700 font-semibold py-3 px-4 rounded-full text-lg text-center">
                                    ✅ Taken{takenAt ? ` at ${formatTime(takenAt)}` : ''}
                                  </div>
                                ) : isSkipped ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-100 text-gray-500 font-semibold py-3 px-4 rounded-full text-lg text-center">
                                      ⏭️ Skipped
                                    </div>
                                    <button
                                      onClick={() => handleSlotAction(med, reminderTime, 'taken')}
                                      disabled={!!loadingMed}
                                      className="text-sm text-teal-600 hover:text-teal-700 font-medium underline whitespace-nowrap disabled:opacity-50"
                                    >
                                      Undo
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSlotAction(med, reminderTime, 'taken')}
                                      disabled={isLoading || !!loadingMed}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 px-4 rounded-full text-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
                                    >
                                      {isLoading ? '⏳' : '✅ I TOOK IT'}
                                    </button>
                                    <button
                                      onClick={() => handleSlotAction(med, reminderTime, 'skipped')}
                                      disabled={isLoading || !!loadingMed}
                                      className="flex-1 border-2 border-gray-300 text-gray-600 font-bold py-4 px-4 rounded-full text-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                                    >
                                      ⏭️ Skip
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

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
      </div>}{/* end Today tab */}
    </div>
  )
}
