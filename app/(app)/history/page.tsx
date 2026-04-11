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
      const { data: meds } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('active', true) as { data: Medication[] | null }

      const { data: logs } = await supabase
        .from('dose_logs')
        .select('*')
        .eq('patient_id', patient.id)
        .gte('scheduled_at', thirtyDaysAgo.toISOString())
        .order('scheduled_at', { ascending: false }) as { data: DoseLog[] | null }

      return { patient, meds: meds || [], logs: logs || [] }
    })
  )

  // Build 30-day array
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
        // Overall adherence across all meds
        const totalPossible = days.length * meds.length
        const totalConfirmed = logs.filter(l => l.confirmed === true).length
        const overallPct = totalPossible > 0 ? Math.round((totalConfirmed / totalPossible) * 100) : 0

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

            {/* Date header row */}
            <div className="overflow-x-auto">
              <div className="min-w-max">

                {/* Date labels */}
                <div className="flex items-center mb-2">
                  {/* Sticky spacer to match label column width */}
                  <div className="w-48 shrink-0 sticky left-0 z-10 bg-white" />
                  {days.map((day, i) => (
                    <div key={i} className="w-7 shrink-0 text-center">
                      {(i % 7 === 0 || i === 29) && (
                        <span className="text-xs text-gray-400">
                          {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* No medications message */}
                {meds.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No medications added yet.
                  </div>
                )}

                {/* One row per medication */}
                {meds.map((med, medIdx) => {
                  const medLogs = logs.filter(l => l.medication_id === med.id)
                  const medConfirmed = medLogs.filter(l => l.confirmed === true).length
                  const medMissed = medLogs.filter(l => l.confirmed === false).length
                  const medPct = days.length > 0 ? Math.round((medConfirmed / days.length) * 100) : 0
                  const displayName = (med as any).nickname || med.name

                  return (
                    <div
                      key={med.id}
                      className={`flex items-center gap-1 mb-3 ${medIdx < meds.length - 1 ? 'pb-3 border-b border-gray-50' : ''}`}
                    >
                      {/* Medication label — sticky left column */}
                      <div className="w-48 shrink-0 pr-3 sticky left-0 z-10 bg-white">
                        <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                        {(med as any).nickname && (
                          <p className="text-xs text-gray-400 truncate">{med.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-bold ${medPct >= 80 ? 'text-teal-600' : medPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {medPct}%
                          </span>
                          {medMissed > 0 && (
                            <span className="text-xs text-red-400">{medMissed} missed</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {med.reminder_times.map(t => (
                            <span key={t} className="text-xs text-gray-400">{formatTime(t)}</span>
                          ))}
                        </div>
                      </div>

                      {/* Day squares */}
                      {days.map((day, dayIdx) => {
                        const nextDay = new Date(day)
                        nextDay.setDate(nextDay.getDate() + 1)
                        const dayLog = medLogs.find(l => {
                          const d = new Date(l.scheduled_at)
                          return d >= day && d < nextDay
                        })

                        let bg = 'bg-gray-100 border border-gray-200'
                        let title = `${day.toLocaleDateString()} — No data`

                        if (dayLog) {
                          if (dayLog.confirmed === true) {
                            bg = 'bg-emerald-500'
                            title = `${day.toLocaleDateString()} — ✅ Taken`
                            if (dayLog.confirmed_at) {
                              title += ` at ${new Date(dayLog.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            }
                          } else if (dayLog.confirmed === false) {
                            bg = 'bg-red-400'
                            title = `${day.toLocaleDateString()} — ❌ Missed`
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
            </div>

          </div>
        )
      })}
    </div>
  )
}
