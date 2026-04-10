import { createClient } from '@/lib/supabase/server'
import { Patient, Medication, DoseLog } from '@/lib/types'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('owner_id', user!.id)
    .eq('active', true) as { data: Patient[] | null }

  // Get last 30 days
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

  // Build 30-day calendar
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Adherence History</h1>
        <p className="text-gray-500 mt-1">Last 30 days of medication tracking</p>
      </div>

      {patientData.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No history yet</h2>
          <p className="text-gray-500">Add patients and medications to see your adherence history.</p>
        </div>
      )}

      {patientData.map(({ patient, meds, logs }) => {
        const totalPossible = days.length * meds.length
        const confirmed = logs.filter(l => l.confirmed === true).length
        const overallPct = totalPossible > 0 ? Math.round((confirmed / totalPossible) * 100) : 0

        return (
          <div key={patient.id} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
                <p className="text-sm text-gray-500">{meds.length} medication{meds.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-teal-600">{overallPct}%</span>
                <p className="text-xs text-gray-400">30-day adherence</p>
              </div>
            </div>

            {/* Calendar heatmap */}
            <div className="overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {days.map((day, dayIdx) => {
                  const nextDay = new Date(day)
                  nextDay.setDate(nextDay.getDate() + 1)
                  const dayLogs = logs.filter(l => {
                    const d = new Date(l.scheduled_at)
                    return d >= day && d < nextDay
                  })
                  const dayConfirmed = dayLogs.filter(l => l.confirmed === true).length
                  const dayTotal = meds.length
                  const pct = dayTotal > 0 ? dayConfirmed / dayTotal : 0

                  let bg = 'bg-gray-100'
                  if (dayTotal > 0 && dayLogs.length === 0) bg = 'bg-gray-100'
                  else if (pct === 1) bg = 'bg-emerald-500'
                  else if (pct >= 0.5) bg = 'bg-emerald-300'
                  else if (pct > 0) bg = 'bg-amber-300'
                  else if (dayLogs.length > 0) bg = 'bg-red-400'

                  const isToday = dayIdx === 29

                  return (
                    <div key={dayIdx} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-7 h-7 rounded-md ${bg} ${isToday ? 'ring-2 ring-teal-500 ring-offset-1' : ''}`}
                        title={`${day.toLocaleDateString()}: ${dayConfirmed}/${dayTotal}`}
                      />
                      {(dayIdx % 7 === 0 || dayIdx === 29) && (
                        <span className="text-xs text-gray-400">
                          {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /> All taken</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-300" /> Partial</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /> Missed</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100" /> No data</div>
            </div>

            {/* Per-medication breakdown */}
            {meds.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Per Medication</h3>
                {meds.map(med => {
                  const medLogs = logs.filter(l => l.medication_id === med.id)
                  const medConfirmed = medLogs.filter(l => l.confirmed === true).length
                  const medPct = days.length > 0 ? Math.round((medConfirmed / days.length) * 100) : 0
                  return (
                    <div key={med.id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{med.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-teal-500 h-2 rounded-full"
                          style={{ width: `${medPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-10 text-right">{medPct}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
