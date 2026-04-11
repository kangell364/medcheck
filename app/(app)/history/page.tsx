import { createClient } from '@/lib/supabase/server'
import { Patient, Medication, DoseLog } from '@/lib/types'
import ReportModal from '@/components/ReportModal'

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

/**
 * Extract the HH:MM portion from a scheduled_at ISO timestamp
 * using the patient's timezone.
 */
function scheduledTimeInTz(scheduledAt: string, timezone: string): string {
  try {
    const date = new Date(scheduledAt)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const h = parts.find(p => p.type === 'hour')?.value ?? '00'
    const m = parts.find(p => p.type === 'minute')?.value ?? '00'
    // Normalize "24:xx" → "00:xx" (midnight edge case)
    const normalizedH = h === '24' ? '00' : h
    return `${normalizedH}:${m}`
  } catch {
    // Fallback: raw UTC time
    const d = new Date(scheduledAt)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
}

/**
 * Get YYYY-MM-DD date string for a day, in the patient's timezone.
 */
function dateStrInTz(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const y = parts.find(p => p.type === 'year')?.value ?? '2000'
    const mo = parts.find(p => p.type === 'month')?.value ?? '01'
    const d = parts.find(p => p.type === 'day')?.value ?? '01'
    return `${y}-${mo}-${d}`
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Get YYYY-MM-DD of a scheduled_at timestamp in the patient's timezone.
 */
function scheduledDateInTz(scheduledAt: string, timezone: string): string {
  return dateStrInTz(new Date(scheduledAt), timezone)
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user profile for display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('owner_id', user!.id)
    .eq('active', true) as { data: Patient[] | null }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const patientData = await Promise.all(
    (patients || []).map(async (patient) => {
      // Fetch logs in the 30-day window first
      const { data: logs } = await supabase
        .from('dose_logs')
        .select('*')
        .eq('patient_id', patient.id)
        .gte('scheduled_at', thirtyDaysAgo.toISOString())
        .order('scheduled_at', { ascending: false }) as { data: DoseLog[] | null }

      const allLogs = logs || []

      // Fetch ALL medications (active AND inactive) — then filter to only those
      // that are either active OR have at least one dose_log in the 30-day window
      const { data: allMeds } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patient.id) as { data: Medication[] | null }

      const loggedMedIds = new Set(allLogs.map(l => l.medication_id))

      const meds = (allMeds || []).filter(
        med => med.active || loggedMedIds.has(med.id)
      )

      return { patient, meds, logs: allLogs }
    })
  )

  // Build 30-day array (local wall-clock days, oldest first)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Data to pass to the report modal
  const modalPatientData = patientData.map(({ patient, meds }) => ({ patient, meds }))

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adherence History</h1>
          <p className="text-gray-500 mt-1">Last 30 days — per medication breakdown</p>
        </div>
        <div className="mt-1">
          <ReportModal
            patientData={modalPatientData}
            userEmail={user!.email ?? ''}
            userName={profile?.full_name ?? null}
          />
        </div>
      </div>

      {patientData.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No history yet</h2>
          <p className="text-gray-500">Add patients and medications to start tracking.</p>
        </div>
      )}

      {patientData.map(({ patient, meds, logs }) => {
        const timezone = patient.timezone || 'America/Chicago'

        // Overall adherence across all meds — only counting days from each med's start_date
        function getDaysFromStartDate(med: Medication): number {
          const sd = (med as any).start_date as string | null
          if (!sd) return days.length
          // Count days in the `days` array that are >= start_date
          return days.filter(d => dateStrInTz(d, timezone) >= sd).length
        }
        const totalSlots = meds.reduce((sum, med) => sum + (med.reminder_times.length || 1) * getDaysFromStartDate(med), 0)
        const totalConfirmed = logs.filter(l => {
          if (l.confirmed !== true) return false
          const med = meds.find(m => m.id === l.medication_id)
          if (!med) return false
          const sd = (med as any).start_date as string | null
          if (!sd) return true
          return scheduledDateInTz(l.scheduled_at, timezone) >= sd
        }).length
        const overallPct = totalSlots > 0 ? Math.round((totalConfirmed / totalSlots) * 100) : 0

        /**
         * Build adherence lookup:
         *   slotMap[medId][time][dateStr] = log | undefined
         *
         * time is the "HH:MM" reminder string (e.g. "08:00", "21:00")
         * dateStr is YYYY-MM-DD in the patient timezone
         */
        const slotMap: Record<string, Record<string, Record<string, DoseLog>>> = {}

        for (const med of meds) {
          slotMap[med.id] = {}
          for (const rt of med.reminder_times) {
            slotMap[med.id][rt] = {}
          }
        }

        for (const log of logs) {
          const medId = log.medication_id
          if (!slotMap[medId]) continue

          const logTime = scheduledTimeInTz(log.scheduled_at, timezone)
          const logDate = scheduledDateInTz(log.scheduled_at, timezone)

          // Find the closest reminder_time (within ±5 min tolerance)
          const med = meds.find(m => m.id === medId)
          if (!med) continue

          // Try exact match first, then closest
          let matchedTime: string | null = null
          if (slotMap[medId][logTime]) {
            matchedTime = logTime
          } else {
            // Find nearest reminder_time
            const [lh, lm] = logTime.split(':').map(Number)
            const logMins = lh * 60 + lm
            let minDiff = Infinity
            for (const rt of med.reminder_times) {
              const [rh, rm] = rt.split(':').map(Number)
              const rtMins = rh * 60 + rm
              const diff = Math.abs(logMins - rtMins)
              if (diff < minDiff) {
                minDiff = diff
                matchedTime = rt
              }
            }
          }

          if (matchedTime && slotMap[medId][matchedTime]) {
            // Keep the log with the most definitive status if there are duplicates
            const existing = slotMap[medId][matchedTime][logDate]
            if (!existing || (existing.confirmed === null && log.confirmed !== null)) {
              slotMap[medId][matchedTime][logDate] = log
            }
          }
        }

        // Day date strings in patient timezone for header matching
        const dayDateStrs = days.map(d => dateStrInTz(d, timezone))

        return (
          <div key={patient.id} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">

            {/* Patient header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
                <p className="text-sm text-gray-500">{meds.length} medication{meds.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <span className={`text-3xl font-bold ${overallPct >= 80 ? 'text-teal-600' : overallPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                  {overallPct}%
                </span>
                <p className="text-xs text-gray-400">overall 30-day</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mb-6 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /> Taken</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /> Missed</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> No data</div>
            </div>

            {/* Scrollable grid */}
            <div className="overflow-x-auto">
              <div className="min-w-max">

                {/* Date header row — must use same gap-1 as data rows so labels align */}
                <div className="flex items-end gap-1 mb-2">
                  {/* Spacer: med name column (w-44) + time label column (w-20) */}
                  <div className="w-44 shrink-0 sticky left-0 z-20 bg-white" />
                  <div className="w-20 shrink-0 sticky left-[180px] z-20 bg-white" />
                  {days.map((day, i) => {
                    // Show label every 7th day (0, 7, 14, 21) and last day
                    const showLabel = i % 7 === 0 || i === days.length - 1
                    return (
                      <div key={i} className="w-7 shrink-0 text-center overflow-visible">
                        {showLabel && (
                          <span className="text-[10px] text-gray-400 leading-none whitespace-nowrap">
                            {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* No medications message */}
                {meds.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No medications added yet.
                  </div>
                )}

                {/* One grouped block per medication */}
                {meds.map((med, medIdx) => {
                  const isInactive = !med.active
                  // Use nickname for display, fall back to official name
                  const displayName = (med as any).nickname || med.name
                  const times = med.reminder_times.length > 0 ? med.reminder_times : ['00:00']

                  // For inactive meds: derive a display name from snapshotted logs if available
                  const logsForThisMed = logs.filter(l => l.medication_id === med.id)
                  const snapshotName = logsForThisMed.find(l => l.medication_name)?.medication_name ?? null

                  // Per-med adherence: only count days from start_date onward
                  const medStartDate = (med as any).start_date as string | null
                  const medDaysCount = getDaysFromStartDate(med)
                  const medTotalSlots = times.length * medDaysCount
                  const medConfirmed = times.reduce((sum, rt) => {
                    const byDate = slotMap[med.id]?.[rt] ?? {}
                    return sum + Object.values(byDate).filter(l => {
                      if (l.confirmed !== true) return false
                      if (!medStartDate) return true
                      return scheduledDateInTz(l.scheduled_at, timezone) >= medStartDate
                    }).length
                  }, 0)
                  const medMissed = times.reduce((sum, rt) => {
                    const byDate = slotMap[med.id]?.[rt] ?? {}
                    return sum + Object.values(byDate).filter(l => {
                      if (l.confirmed !== false) return false
                      if (!medStartDate) return true
                      return scheduledDateInTz(l.scheduled_at, timezone) >= medStartDate
                    }).length
                  }, 0)
                  const medPct = medTotalSlots > 0 ? Math.round((medConfirmed / medTotalSlots) * 100) : 0

                  // Format start_date label
                  const startDateLabel = medStartDate
                    ? new Date(medStartDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null

                  const isLastMed = medIdx === meds.length - 1

                  // Label used for display (prefer snapshot for inactive, otherwise display name)
                  const headingName = isInactive ? (snapshotName || displayName) : displayName

                  return (
                    <div
                      key={med.id}
                      className={`${!isLastMed ? 'mb-4 pb-4 border-b border-gray-100' : 'mb-2'} ${isInactive ? 'opacity-60' : ''}`}
                    >
                      {times.map((rt, timeIdx) => {
                        const isFirstTime = timeIdx === 0
                        const byDate = slotMap[med.id]?.[rt] ?? {}

                        return (
                          <div key={rt} className="flex items-center gap-1 min-h-[2rem]">

                            {/* ── Left sticky: med name + % (only on first time row) ── */}
                            <div className="w-44 shrink-0 sticky left-0 z-10 bg-white self-stretch flex flex-col justify-center pr-2">
                              {isFirstTime ? (
                                <>
                                  <p className={`text-sm font-semibold truncate leading-tight ${isInactive ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {headingName}
                                  </p>
                                  {(med as any).nickname && !isInactive && (
                                    <p className="text-xs text-gray-400 truncate">{med.name}</p>
                                  )}
                                  {startDateLabel && !isInactive && (
                                    <p className="text-xs text-gray-400 mt-0.5">Started {startDateLabel}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {isInactive ? (
                                      <span className="text-xs text-gray-400 font-medium">archived</span>
                                    ) : (
                                      <>
                                        <span className={`text-xs font-bold ${medPct >= 80 ? 'text-teal-600' : medPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                          {medPct}%
                                        </span>
                                        {medMissed > 0 && (
                                          <span className="text-xs text-red-400">{medMissed} missed</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* empty placeholder to keep sticky column aligned */
                                <div />
                              )}
                            </div>

                            {/* ── Time label (sticky after med name col, left-0 + w-44 + gap-1(4px) = 180px) ── */}
                            <div className="w-20 shrink-0 sticky left-[180px] z-10 bg-white pr-2 self-stretch flex items-center">
                              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                                {formatTime(rt)}
                              </span>
                            </div>

                            {/* ── 30 day dots for this time slot ── */}
                            {dayDateStrs.map((dateStr, dayIdx) => {
                              // Hide cells before start_date — render empty spacer
                              if (medStartDate && dateStr < medStartDate) {
                                return (
                                  <div
                                    key={dayIdx}
                                    className="w-7 h-7 shrink-0"
                                  />
                                )
                              }

                              const log = byDate[dateStr]

                              let bg = 'bg-gray-100 border border-gray-200'
                              // Use snapshotted medication_name if available, else fall back to official name
                              const logMedName = log?.medication_name || med.name
                              let title = `${days[dayIdx].toLocaleDateString()} ${formatTime(rt)} — No data`

                              if (log) {
                                if (log.confirmed === true) {
                                  bg = 'bg-emerald-500'
                                  title = `${days[dayIdx].toLocaleDateString()} ${formatTime(rt)} — ✅ Taken (${logMedName})`
                                  if (log.confirmed_at) {
                                    title += ` at ${new Date(log.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  }
                                } else if (log.confirmed === false) {
                                  bg = 'bg-red-400'
                                  title = `${days[dayIdx].toLocaleDateString()} ${formatTime(rt)} — ❌ Missed (${logMedName})`
                                }
                              }

                              const isToday = dayIdx === 29

                              return (
                                <div
                                  key={dayIdx}
                                  className={`w-7 h-7 shrink-0 rounded-md ${bg} ${isToday ? 'ring-2 ring-teal-500 ring-offset-1' : ''} cursor-pointer`}
                                  title={title}
                                />
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

              </div>
            </div>

          </div>
        )
      })}
    </div>
  )
}
