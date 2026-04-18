'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Medication, DoseLog, PatientAlert, Patient } from '@/lib/types'
import ManualLogButton from '@/components/ManualLogButton'
import LogDoseButton from '@/components/LogDoseButton'
import DeleteMedButton from '@/components/DeleteMedButton'
import ArchiveMedButton from '@/components/ArchiveMedButton'
import DeleteDoctorButton from '@/components/DeleteDoctorButton'
import PatientHistory from '@/components/PatientHistory'
import RecentActivityList from '@/components/RecentActivityList'
import { AlertLog } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Doctor {
  id: string
  name: string
  specialty: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

interface Appointment {
  id: string
  doctor_name: string
  location: string | null
  appointment_date: string
  appointment_time: string
  appointment_type: string | null
  needs_ride: boolean
  notes: string | null
  status: string | null
}

interface PatientTabsProps {
  patient: Patient & { timezone: string }
  medications: Medication[]
  archivedMedications?: Medication[]
  todayLogs: DoseLog[]
  alerts: PatientAlert[]
  pendingCallbacks: any[]
  appointments: Appointment[]
  doctors: Doctor[]
  recentAlerts?: AlertLog[]
}

type TabId = 'medications' | 'doctors' | 'appointments' | 'contacts' | 'history'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeInTz(time: string, timezone: string): string {
  const [hourStr, minuteStr] = time.split(':')
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const fakeDate = new Date(`${todayStr}T${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}:00`)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(fakeDate)
}

function formatIsoInTz(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString))
}

function formatAppointmentDate(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr}`)
  const date = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  let hours = dt.getHours()
  const minutes = dt.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const minStr = minutes === 0 ? '00' : minutes.toString().padStart(2, '0')
  return `${date} at ${hours}:${minStr} ${ampm}`
}

const statusConfig = {
  confirmed: { icon: '✅', label: 'Taken', class: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  missed: { icon: '❌', label: 'Missed', class: 'bg-red-50 border-red-200 text-red-700' },
  pending: { icon: '⏳', label: 'Pending', class: 'bg-amber-50 border-amber-200 text-amber-700' },
  snoozed: { icon: '😴', label: 'Snoozed', class: 'bg-amber-50 border-amber-200 text-amber-700' },
} as const

const apptStatusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: 'Upcoming', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  missed: { label: 'Missed', class: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-600 border-gray-200' },
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientTabs({
  patient,
  medications,
  archivedMedications = [],
  todayLogs,
  alerts,
  pendingCallbacks,
  appointments,
  doctors,
  recentAlerts = [],
}: PatientTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const initialTab = (searchParams.get('tab') as TabId) || 'medications'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [selfManage, setSelfManage] = useState<boolean>(!!patient.member_can_self_manage)
  const [togglingControl, setTogglingControl] = useState(false)
  // snoozeMap tracks optimistic snooze_until per medication ID after user clicks Snooze
  const [snoozeMap, setSnoozeMap] = useState<Record<string, string>>({})

  // If we were deep-linked from the dashboard to log a specific medication,
  // auto-scroll it into view.
  useEffect(() => {
    const medId = searchParams.get('med')
    if (!medId) return
    // wait for render
    setTimeout(() => {
      document.getElementById(`med-${medId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [searchParams])

  const toggleMemberControl = useCallback(async () => {
    setTogglingControl(true)
    const newVal = !selfManage
    const { error } = await supabase
      .from('patients')
      .update({ member_can_self_manage: newVal })
      .eq('id', patient.id)
    if (!error) setSelfManage(newVal)
    setTogglingControl(false)
  }, [selfManage, patient.id, supabase])

  function handleMedSnooze(medId: string, snoozeUntil: string) {
    setSnoozeMap(prev => ({ ...prev, [medId]: snoozeUntil }))
  }

  // Sync tab state with URL
  function switchTab(tab: TabId) {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // ─── Medication helpers ─────────────────────────────────────────────────

  // Extract HH:MM from a scheduled_at ISO string in patient's timezone
  function getLogTimeInTz(isoStr: string): string {
    try {
      const d = new Date(isoStr)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: patient.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d)
      const h = parts.find(p => p.type === 'hour')?.value ?? '00'
      const m = parts.find(p => p.type === 'minute')?.value ?? '00'
      const normalizedH = h === '24' ? '00' : h
      return `${normalizedH}:${m}`
    } catch {
      return '00:00'
    }
  }

  // Find the dose_log for a specific med + reminder_time slot.
  // Use a strict match on the scheduled slot time (not fuzzy) so logging one row
  // can never change another row.
  function getSlotLog(medId: string, reminderTime: string): DoseLog | undefined {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: patient.timezone })
    const slot = `${today}T${reminderTime}:00`

    return todayLogs.find(l => l.medication_id === medId && l.scheduled_at === slot)
  }

  // Slot status: confirmed | missed | skipped | snoozed | pending
  function getSlotStatus(medId: string, reminderTime: string): 'confirmed' | 'missed' | 'skipped' | 'snoozed' | 'pending' {
    const optimisticSnooze = snoozeMap[medId]
    if (optimisticSnooze && new Date(optimisticSnooze) > new Date()) return 'snoozed'

    const log = getSlotLog(medId, reminderTime)
    if (!log) {
      // Check if past due
      const [rh, rm] = reminderTime.split(':').map(Number)
      const patientNow = new Date(new Date().toLocaleString('en-US', { timeZone: patient.timezone }))
      const currentMins = patientNow.getHours() * 60 + patientNow.getMinutes()
      const slotMins = rh * 60 + rm
      // If past due by > 60 min and no log, mark as missed
      if (currentMins > slotMins + 60) return 'missed'
      return 'pending'
    }
    if (log.snooze_until && new Date(log.snooze_until) > new Date()) return 'snoozed'
    if (log.confirmed === true) return 'confirmed'
    if (log.method === 'manual' && log.confirmed === false) return 'skipped'
    if (log.confirmed === false) return 'missed'
    return 'pending'
  }

  // Get snooze_until for a med (optimistic first, then from server logs)
  const getMedSnoozeUntil = (medId: string): string | null => {
    if (snoozeMap[medId]) return snoozeMap[medId]
    const log = todayLogs.find(l => l.medication_id === medId)
    return log?.snooze_until ?? null
  }

  const getPendingCallback = (medId: string) => {
    return pendingCallbacks.find(cb => cb.medication_id === medId) || null
  }

  const todayStr = new Date().toISOString()

  // Pick the most relevant reminder time for snooze: the one that is currently due/overdue,
  // or the next upcoming one, falling back to the first in the list.
  function getRelevantReminderTime(reminderTimes: string[]): string {
    if (!reminderTimes || reminderTimes.length === 0) return '09:00'
    if (reminderTimes.length === 1) return reminderTimes[0]

    const patientNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: patient.timezone })
    )
    const currentMinutes = patientNow.getHours() * 60 + patientNow.getMinutes()

    // Find the latest time that is already due (current or overdue), i.e. largest <= currentMinutes
    let bestDue: string | null = null
    let bestDueMinutes = -1

    // Find the next upcoming time (smallest > currentMinutes)
    let bestUpcoming: string | null = null
    let bestUpcomingMinutes = Infinity

    for (const t of reminderTimes) {
      const [h, m] = t.split(':').map(Number)
      const mins = h * 60 + m
      if (mins <= currentMinutes && mins > bestDueMinutes) {
        bestDue = t
        bestDueMinutes = mins
      }
      if (mins > currentMinutes && mins < bestUpcomingMinutes) {
        bestUpcoming = t
        bestUpcomingMinutes = mins
      }
    }

    return bestDue ?? bestUpcoming ?? reminderTimes[0]
  }

  // ─── Tab Button ─────────────────────────────────────────────────────────

  const TabButton = ({ id, label, emoji }: { id: TabId; label: string; emoji: string }) => {
    const isActive = activeTab === id
    return (
      <button
        onClick={() => switchTab(id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-sm font-semibold rounded-xl transition-all ${
          isActive
            ? 'bg-teal-600 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        <span>{emoji}</span>
        <span>{label}</span>
      </button>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5 mb-6">
        <TabButton id="medications" label="Medications" emoji="💊" />
        <TabButton id="doctors" label="Doctors" emoji="👨‍⚕️" />
        <TabButton id="appointments" label="Appointments" emoji="📅" />
        <TabButton id="contacts" label="Contacts" emoji="🔔" />
        <TabButton id="history" label="History" emoji="📋" />
      </div>

      {/* ── Tab 1: Medications ── */}
      {activeTab === 'medications' && (
        <div>
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Today&apos;s Medications</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMemberControl}
                  disabled={togglingControl}
                  title={selfManage ? 'Member currently controls their own meds' : 'Member can only request changes'}
                  className={`text-xs font-medium py-2 px-3 rounded-xl border transition-colors disabled:opacity-50 ${
                    selfManage
                      ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {togglingControl ? '…' : selfManage ? '🔒 Take Back Control' : '🔓 Grant Member Control'}
                </button>
                <Link
                  href={`/patients/${patient.id}/medications/new`}
                  className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
                >
                  + Add Medication
                </Link>
              </div>
            </div>

            {medications.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">💊</div>
                <h3 className="font-semibold text-gray-900 mb-1">No medications yet</h3>
                <p className="text-sm text-gray-500 mb-4">Add medications to start tracking.</p>
                <Link
                  href={`/patients/${patient.id}/medications/new`}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-xl inline-block text-sm transition-colors"
                >
                  Add First Medication
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {medications.map(med => {
                  const times = med.reminder_times?.length > 0 ? med.reminder_times : ['00:00']
                  const pendingCallback = getPendingCallback(med.id)
                  // Overall med-level status: use first non-pending slot or pending
                  const overallStatus = (() => {
                    const optimisticSnooze = snoozeMap[med.id]
                    if (optimisticSnooze && new Date(optimisticSnooze) > new Date()) return 'snoozed'
                    const allConfirmed = times.every(rt => getSlotStatus(med.id, rt) === 'confirmed')
                    if (allConfirmed) return 'confirmed'
                    const anyMissed = times.some(rt => getSlotStatus(med.id, rt) === 'missed')
                    if (anyMissed) return 'missed'
                    return 'pending'
                  })()
                  const overallConfig = statusConfig[overallStatus] || statusConfig.pending

                  return (
                    <div id={`med-${med.id}`} key={med.id} className={`bg-white rounded-2xl border-2 p-5 ${overallConfig.class} scroll-mt-24`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5">{overallConfig.icon}</span>
                          <div>
                            <h3 className="font-bold text-gray-900 text-2xl">{med.name}</h3>
                            {(med as any).nickname && (
                              <p className="text-base text-teal-600 font-medium">&quot;{(med as any).nickname}&quot;</p>
                            )}
                            {med.dosage && /[a-zA-Z]/.test(med.dosage) && (
                              <p className="text-base text-gray-600">{med.dosage}</p>
                            )}
                            {pendingCallback && (
                              <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full border border-orange-200">
                                📞 Callback at {formatIsoInTz(pendingCallback.scheduled_for, patient.timezone)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${overallConfig.class}`}>
                              {overallConfig.label}
                            </span>
                        </div>
                      </div>

                      {/* Per-time-slot rows */}
                      <div className="grid grid-cols-[1fr_auto] gap-2 mb-2 px-1">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Scheduled</div>
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-right">Logged</div>
                      </div>
                      <div className="space-y-2 mb-3">
                        {times.map(rt => {
                          const slotStatus = getSlotStatus(med.id, rt)
                          const slotLog = getSlotLog(med.id, rt)

                          const slotStatusConfig = {
                            confirmed: { icon: '✅', label: 'Taken', class: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                            missed: { icon: '❌', label: 'Missed', class: 'bg-red-50 border-red-200 text-red-700' },
                            skipped: { icon: '⏭️', label: 'Skipped', class: 'bg-gray-50 border-gray-200 text-gray-500' },
                            snoozed: { icon: '😴', label: 'Snoozed', class: 'bg-amber-50 border-amber-200 text-amber-700' },
                            pending: { icon: '', label: '', class: 'bg-white border-gray-100 text-gray-500' },
                          }[slotStatus] || { icon: '', label: '', class: 'bg-white border-gray-100 text-gray-500' }

                          return (
                            <div key={rt} className={`flex items-center justify-between rounded-xl border p-3 ${slotStatusConfig.class}`}>
                              {/* Scheduled (left column) */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">
                                  {formatTimeInTz(rt, patient.timezone)}
                                </span>
                              </div>

                              {/* Logged (right column) */}
                              <div className="flex items-center justify-end gap-2 text-right">
                                {slotStatus === 'confirmed' && slotLog?.confirmed_at ? (
                                  <span className="text-xs text-gray-500">
                                    {formatIsoInTz(slotLog.confirmed_at, patient.timezone)}
                                    {slotLog.method && <span className="text-gray-400"> via {slotLog.method}</span>}
                                  </span>
                                ) : slotStatus === 'missed' ? (
                                  <span className="text-xs font-semibold text-red-700">Missed</span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}

                                {slotStatus === 'missed' ? (
                                  <ManualLogButton
                                    medicationId={med.id}
                                    patientId={patient.id}
                                    medicationName={med.name}
                                    scheduledTime={rt}
                                    patientTimezone={patient.timezone}
                                  />
                                ) : slotStatus === 'confirmed' ? null : (
                                  <LogDoseButton
                                    medicationId={med.id}
                                    patientId={patient.id}
                                    reminderTime={rt}
                                    patientTimezone={patient.timezone}
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <Link
                          href={`/patients/${patient.id}/medications/${med.id}/edit`}
                          className="text-xs text-gray-400 hover:text-teal-600 transition-colors"
                        >
                          ✏️ Edit
                        </Link>
                        <ArchiveMedButton medId={med.id} medName={med.name} patientId={patient.id} />
                        <DeleteMedButton medId={med.id} medName={med.name} patientId={patient.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Archived Medications ── */}
          {archivedMedications.length > 0 && (
            <section className="mt-2">
              <button
                onClick={() => setArchiveOpen(o => !o)}
                className="flex items-center gap-2 w-full text-left py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <span className="text-base">{archiveOpen ? '🔽' : '▶️'}</span>
                <span className="text-sm font-semibold text-gray-500">
                  Archived Medications ({archivedMedications.length})
                </span>
              </button>

              {archiveOpen && (
                <div className="mt-3 space-y-3">
                  {archivedMedications.map(med => (
                    <div key={med.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-5 opacity-70">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">📦</span>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-500 text-xl line-through">{med.name}</h3>
                          {(med as any).nickname && (
                            <p className="text-sm text-gray-400">&quot;{(med as any).nickname}&quot;</p>
                          )}
                          {med.dosage && (
                            <p className="text-sm text-gray-400">{med.dosage}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {med.reminder_times.map(t => (
                              <span key={t} className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-500">
                                🕐 {formatTimeInTz(t, patient.timezone)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3 ml-11">
                        <ArchiveMedButton medId={med.id} medName={med.name} patientId={patient.id} isArchived />
                        <DeleteMedButton medId={med.id} medName={med.name} patientId={patient.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ── Tab 2: Doctors ── */}
      {activeTab === 'doctors' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Doctors</h2>
            <Link
              href={`/patients/${patient.id}/doctors/new`}
              className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              + Add Doctor
            </Link>
          </div>

          {doctors.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">👨‍⚕️</div>
              <h3 className="font-semibold text-gray-900 mb-1">No doctors yet</h3>
              <p className="text-sm text-gray-500 mb-4">Add doctors associated with this member.</p>
              <Link
                href={`/patients/${patient.id}/doctors/new`}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-xl inline-block text-sm transition-colors"
              >
                Add First Doctor
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map(doc => (
                <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">👨‍⚕️</span>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">Dr. {doc.name}</h3>
                        {doc.specialty && (
                          <p className="text-sm text-teal-700 font-medium">{doc.specialty}</p>
                        )}
                        {doc.phone && (
                          <p className="text-sm text-gray-600 mt-1">📱 {doc.phone}</p>
                        )}
                        {doc.address && (
                          <p className="text-sm text-gray-500 mt-0.5">📍 {doc.address}</p>
                        )}
                        {doc.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">{doc.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 ml-9">
                    <DeleteDoctorButton doctorId={doc.id} doctorName={doc.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Tab 3: Appointments ── */}
      {activeTab === 'appointments' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Appointments</h2>
            <Link
              href={`/appointments/new?patientId=${patient.id}`}
              className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              + Add Appointment
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-semibold text-gray-900 mb-1">No appointments yet</h3>
              <p className="text-sm text-gray-500 mb-4">Schedule appointments for this member.</p>
              <Link
                href={`/appointments/new?patientId=${patient.id}`}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-xl inline-block text-sm transition-colors"
              >
                Add First Appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(appt => {
                const status = appt.status || 'upcoming'
                const cfg = apptStatusConfig[status] || apptStatusConfig.upcoming

                return (
                  <div key={appt.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-base font-bold text-gray-900">Dr. {appt.doctor_name}</span>
                          {appt.needs_ride && (
                            <span className="text-sm" title="Needs transportation">🚗</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800">
                          🗓 {formatAppointmentDate(appt.appointment_date, appt.appointment_time)}
                        </p>
                        {appt.location && (
                          <p className="text-sm text-gray-500 mt-1">📍 {appt.location}</p>
                        )}
                        {appt.appointment_type && appt.appointment_type !== 'checkup' && (
                          <p className="text-xs text-gray-400 mt-1 capitalize">{appt.appointment_type}</p>
                        )}
                        {appt.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">{appt.notes}</p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.class}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Tab 4: Contacts ── */}
      {activeTab === 'contacts' && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Alert Contacts</h2>
            <Link
              href={`/patients/${patient.id}/alerts/new`}
              className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              + Add Contact
            </Link>
          </div>
          <p className="text-sm text-gray-500 mb-4">These people are notified when a dose is missed.</p>

          {alerts.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">🔔</div>
              <h3 className="font-semibold text-gray-900 mb-1">No alert contacts yet</h3>
              <p className="text-sm text-gray-500 mb-4">Add someone to be notified about missed doses.</p>
              <Link
                href={`/patients/${patient.id}/alerts/new`}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-xl inline-block text-sm transition-colors"
              >
                Add First Contact
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="font-medium text-gray-900">{alert.name}</p>
                    <p className="text-sm text-gray-500">
                      {alert.phone && `📱 ${alert.phone}`}
                      {alert.email && ` • 📧 ${alert.email}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Activity */}
          <RecentActivityList patientId={patient.id} recentAlerts={recentAlerts} />
        </section>
      )}

      {/* ── Tab 5: History ── */}
      {activeTab === 'history' && (
        <section>
          <PatientHistory
            patientId={patient.id}
            patientName={patient.name}
            patientTimezone={patient.timezone}
          />
        </section>
      )}
    </div>
  )
}
