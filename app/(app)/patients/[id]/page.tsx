import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Medication, DoseLog } from '@/lib/types'
import ManualLogButton from '@/components/ManualLogButton'
import TriggerCallButton from '@/components/TriggerCallButton'

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .single()

  if (!patient) notFound()

  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', id)
    .eq('active', true)
    .order('created_at') as { data: Medication[] | null }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayLogs } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', id)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString()) as { data: DoseLog[] | null }

  const { data: alerts } = await supabase
    .from('patient_alerts')
    .select('*')
    .eq('patient_id', id)

  const getMedStatus = (medId: string) => {
    const log = (todayLogs || []).find(l => l.medication_id === medId)
    if (!log) return 'pending'
    if (log.confirmed === true) return 'confirmed'
    if (log.confirmed === false) return 'missed'
    return 'pending'
  }

  const statusConfig = {
    confirmed: { icon: '✅', label: 'Taken', class: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    missed: { icon: '❌', label: 'Missed', class: 'bg-red-50 border-red-200 text-red-700' },
    pending: { icon: '⏳', label: 'Pending', class: 'bg-amber-50 border-amber-200 text-amber-700' },
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <Link href="/patients" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Patients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{patient.name}</h1>
            <p className="text-gray-500">{patient.phone} • {patient.timezone}</p>
          </div>
          <TriggerCallButton patientId={patient.id} patientName={patient.name} />
        </div>
      </div>

      {/* Today's Medications */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Today&apos;s Medications</h2>
          <Link
            href={`/patients/${id}/medications/new`}
            className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-xl transition-colors"
          >
            + Add Medication
          </Link>
        </div>

        {(!medications || medications.length === 0) ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
            <div className="text-4xl mb-3">💊</div>
            <h3 className="font-semibold text-gray-900 mb-1">No medications yet</h3>
            <p className="text-sm text-gray-500 mb-4">Add medications to start tracking.</p>
            <Link
              href={`/patients/${id}/medications/new`}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-6 rounded-xl inline-block text-sm transition-colors"
            >
              Add First Medication
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {medications.map(med => {
              const status = getMedStatus(med.id)
              const config = statusConfig[status]
              const log = (todayLogs || []).find(l => l.medication_id === med.id)

              return (
                <div key={med.id} className={`bg-white rounded-2xl border-2 p-5 ${config.class}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{config.icon}</span>
                      <div>
                        <h3 className="font-bold text-gray-900 text-2xl">{med.name}</h3>
                        {med.nickname && (
                          <p className="text-base text-teal-600 font-medium">"{med.nickname}"</p>
                        )}
                        {med.dosage && <p className="text-base text-gray-600">{med.dosage}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {med.reminder_times.map(t => (
                            <span key={t} className="text-sm font-semibold bg-white/80 px-3 py-1 rounded-full text-gray-700 border border-gray-200">
                              🕐 {formatTime(t)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.class}`}>
                        {config.label}
                      </span>
                      {status !== 'confirmed' && (
                        <ManualLogButton
                          medicationId={med.id}
                          patientId={patient.id}
                          medicationName={med.name}
                        />
                      )}
                    </div>
                  </div>
                  {log?.confirmed_at && (
                    <p className="text-xs text-gray-400 mt-2 ml-9">
                      {status === 'confirmed' ? 'Confirmed' : 'Recorded'} at {new Date(log.confirmed_at).toLocaleTimeString()}
                      {log.method && ` via ${log.method}`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Alert contacts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Alert Contacts</h2>
          <Link
            href={`/patients/${id}/alerts/new`}
            className="text-sm text-teal-600 hover:underline"
          >
            + Add contact
          </Link>
        </div>
        {(!alerts || alerts.length === 0) ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-500 text-center">
            No alert contacts yet. Add someone to be notified about missed doses.
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
      </section>
    </div>
  )
}
