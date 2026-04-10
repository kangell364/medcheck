import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Patient, Medication, DoseLog } from '@/lib/types'

function formatApptDateTime(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr}`)
  const date = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  let hours = dt.getHours()
  const minutes = dt.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const minStr = minutes === 0 ? '00' : minutes.toString().padStart(2, '0')
  return `${date} at ${hours}:${minStr} ${ampm}`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('owner_id', user!.id)
    .eq('active', true)
    .order('created_at', { ascending: true }) as { data: Patient[] | null }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Get all meds and today's logs for each patient
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
        .gte('scheduled_at', today.toISOString())
        .lt('scheduled_at', tomorrow.toISOString()) as { data: DoseLog[] | null }

      const totalDoses = (meds || []).length
      const confirmedDoses = (logs || []).filter(l => l.confirmed === true).length
      const missedDoses = (logs || []).filter(l => l.confirmed === false).length

      return { patient, meds: meds || [], logs: logs || [], totalDoses, confirmedDoses, missedDoses }
    })
  )

  const { data: recentAlerts } = await supabase
    .from('alert_log')
    .select('*')
    .in('patient_id', (patients || []).map(p => p.id))
    .order('sent_at', { ascending: false })
    .limit(5)

  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select('*, patients(id, name)')
    .eq('owner_id', user!.id)
    .eq('status', 'upcoming')
    .gte('appointment_date', today.toISOString().split('T')[0])
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(3)

  const displayName = profile?.full_name?.split(' ')[0] || 'there'
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{getGreeting()}, {displayName}! 👋</h1>
        <p className="text-gray-500 mt-1">{dateStr}</p>
      </div>

      {/* No patients yet */}
      {(!patients || patients.length === 0) && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">💊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No patients yet</h2>
          <p className="text-gray-500 mb-6">Add a patient to start tracking medications.</p>
          <Link
            href="/patients/new"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-xl inline-block transition-colors"
          >
            Add Your First Patient
          </Link>
        </div>
      )}

      {/* Patient cards */}
      {patientData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {patientData.map(({ patient, totalDoses, confirmedDoses, missedDoses }) => {
            const pct = totalDoses > 0 ? Math.round((confirmedDoses / totalDoses) * 100) : 0
            const statusColor = pct === 100 ? 'text-emerald-600' : missedDoses > 0 ? 'text-red-500' : 'text-amber-500'
            const statusBg = pct === 100 ? 'bg-emerald-50 border-emerald-200' : missedDoses > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'

            return (
              <div key={patient.id} className={`bg-white rounded-2xl border-2 p-6 ${statusBg}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{patient.name}</h3>
                    <p className="text-sm text-gray-500">{patient.phone}</p>
                  </div>
                  <span className={`text-2xl font-bold ${statusColor}`}>{pct}%</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{confirmedDoses} of {totalDoses} doses taken today</span>
                    {missedDoses > 0 && <span className="text-red-500">{missedDoses} missed</span>}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : missedDoses > 0 ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex-1 text-center bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/patients/${patient.id}?log=true`}
                    className="flex-1 text-center bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
                  >
                    Log Dose ✓
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick actions */}
      {patients && patients.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/patients/new"
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <span>➕</span> Add Patient
          </Link>
          <Link
            href="/history"
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <span>📅</span> View History
          </Link>
          <Link
            href="/alerts"
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <span>🔔</span> Alert Log
          </Link>
        </div>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppointments && upcomingAppointments.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
            <Link href="/appointments" className="text-sm text-teal-600 hover:underline">View all</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {upcomingAppointments.map((appt: any) => (
              <div key={appt.id} className="px-5 py-4 flex items-start gap-3">
                <span className="text-xl mt-0.5">📆</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">Dr. {appt.doctor_name}</p>
                    {appt.needs_ride && <span className="text-sm" title="Needs ride">🚗</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {(appt.patients as any)?.name} • {formatApptDateTime(appt.appointment_date, appt.appointment_time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {recentAlerts.map((alert: any) => (
              <div key={alert.id} className="px-5 py-4 flex items-start gap-3">
                <span className="text-xl mt-0.5">🔔</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(alert.sent_at).toLocaleString()} • sent to {alert.sent_to}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
