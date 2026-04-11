import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Medication, DoseLog } from '@/lib/types'
import TriggerCallButton from '@/components/TriggerCallButton'
import PatientTabs from '@/components/PatientTabs'

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
    .lt('scheduled_at', tomorrow.toISOString()) as { data: (DoseLog & { snooze_until?: string | null })[] | null }

  const { data: alerts } = await supabase
    .from('patient_alerts')
    .select('*')
    .eq('patient_id', id)

  const { data: pendingCallbacks } = await supabase
    .from('callbacks')
    .select('*')
    .eq('patient_id', id)
    .eq('fulfilled', false)
    .gte('scheduled_for', new Date().toISOString())

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', id)
    .eq('owner_id', user!.id)
    .order('appointment_date', { ascending: true })

  const { data: doctors } = await supabase
    .from('doctors')
    .select('*')
    .eq('patient_id', id)
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: true })

  // Fetch last 5 alert_log entries for this patient
  const { data: recentAlerts } = await supabase
    .from('alert_log')
    .select('*')
    .eq('patient_id', id)
    .order('sent_at', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      {/* Patient Header */}
      <div className="mb-6">
        <Link href="/patients" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Patients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">{patient.name}</h1>
              <Link href={`/patients/${id}/edit`} className="text-sm text-gray-400 hover:text-teal-600 transition-colors">
                ✏️ Edit
              </Link>
            </div>
            <p className="text-gray-500">{patient.phone} • {patient.timezone}</p>
          </div>
          <TriggerCallButton
            patientId={patient.id}
            patientName={patient.name}
            medications={(medications || []).map(m => ({
              id: m.id,
              name: m.name,
              nickname: (m as any).nickname,
              reminder_times: m.reminder_times,
            }))}
            timezone={patient.timezone}
          />
        </div>
      </div>

      {/* Tabbed Content */}
      <PatientTabs
        patient={patient}
        medications={medications || []}
        todayLogs={todayLogs || []}
        alerts={alerts || []}
        pendingCallbacks={pendingCallbacks || []}
        appointments={appointments || []}
        doctors={doctors || []}
        recentAlerts={recentAlerts || []}
      />
    </div>
  )
}
