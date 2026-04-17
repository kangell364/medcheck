import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppTabs from '@/components/AppTabs'

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
  const time = `${hours}:${minStr} ${ampm}`
  return `${date} at ${time}`
}

const statusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: 'Upcoming', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  missed: { label: 'Missed', class: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export default async function AppointmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(id, name)')
    .eq('owner_id', user!.id)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">Manage patient appointments and reminders</p>
        </div>
        <Link
          href="/appointments/new"
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> Add Appointment
        </Link>
      </div>

      <AppTabs className="mt-0 mb-6" />

      {/* Appointments list */}
      {(!appointments || appointments.length === 0) ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No appointments yet</h2>
          <p className="text-gray-500 mb-6">Add appointments to track and send reminders.</p>
          <Link
            href="/appointments/new"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-xl inline-block transition-colors"
          >
            Add First Appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt: any) => {
            const status = appt.status || 'upcoming'
            const cfg = statusConfig[status] || statusConfig.upcoming

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
                    <p className="text-sm text-gray-600 mb-1">
                      👤 {(appt.patients as any)?.name || 'Unknown patient'}
                    </p>
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
    </div>
  )
}
