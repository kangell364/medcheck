import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Medication, DoseLog } from '@/lib/types'
import TriggerCallButton from '@/components/TriggerCallButton'
import PatientTabs from '@/components/PatientTabs'
import ReportModal from '@/components/ReportModal'

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

  const { data: archivedMedications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', id)
    .eq('active', false)
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
      {/* Pending enrollment banner */}
      {patient.enrollment_status === 'pending' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⏳</span>
          <p className="text-sm text-amber-800 font-medium">
            This patient hasn&apos;t approved their account yet.
          </p>
        </div>
      )}

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
          <div className="flex items-center gap-3">
            <ReportModal
              patientData={[{ patient, meds: medications || [] }]}
              userEmail={user?.email || ''}
              userName={patient.name}
            />
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
      </div>

      {/* Reminder Settings Card */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Reminder Settings</h2>
          <Link
            href={`/patients/${id}/edit`}
            className="text-xs text-teal-600 hover:underline"
          >
            Edit
          </Link>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {/* Reminders on/off indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                patient.reminders_enabled !== false ? 'bg-emerald-400' : 'bg-gray-300'
              }`}
            />
            <span className="text-gray-600">
              Reminders:{' '}
              <span className={`font-medium ${patient.reminders_enabled !== false ? 'text-emerald-600' : 'text-gray-500'}`}>
                {patient.reminders_enabled !== false ? 'ON' : 'OFF'}
              </span>
            </span>
          </div>

          {/* Contact method */}
          <div className="flex items-center gap-1.5 text-gray-600">
            <span>
              {patient.contact_method === 'call' ? '📞' : patient.contact_method === 'both' ? '📞💬' : '💬'}
            </span>
            <span>
              Method:{' '}
              <span className="font-medium text-gray-800 capitalize">
                {patient.contact_method ?? 'Text'}
              </span>
            </span>
          </div>

          {/* Reminder time */}
          <div className="flex items-center gap-1.5 text-gray-600">
            <span>🕗</span>
            <span>
              Time:{' '}
              <span className="font-medium text-gray-800">
                {patient.reminder_time
                  ? new Intl.DateTimeFormat('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: patient.timezone ?? 'America/Chicago',
                    }).format(
                      new Date(
                        `1970-01-01T${patient.reminder_time.length === 5 ? patient.reminder_time + ':00' : patient.reminder_time}`
                      )
                    )
                  : '8:00 AM'}
              </span>
            </span>
          </div>

          {/* SMS opt-out warning */}
          {patient.sms_opted_out && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <span>⚠️</span>
              <span className="font-medium">SMS opted out</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabbed Content */}
      <PatientTabs
        patient={patient}
        medications={medications || []}
        archivedMedications={archivedMedications || []}
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
