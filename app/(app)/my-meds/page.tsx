import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyMedsClient from './MyMedsClient'
import InstallPrompt from '@/components/InstallPrompt'
import { Medication, DoseLog, Patient } from '@/lib/types'
import { getTimezoneForState } from '@/lib/stateTimezone'

export default async function MyMedsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Find the patient record linked to this user
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .single() as { data: Patient | null }

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">💊</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No account found</h1>
          <p className="text-gray-600">
            Your patient account isn&apos;t set up yet. Ask your caregiver to send you a login link.
          </p>
        </div>
      </div>
    )
  }

  // Get medications
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('active', true)
    .is('archived_at', null)
    .order('created_at') as { data: Medication[] | null }

  // Get today's dose logs
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayLogs } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patient.id)
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString()) as { data: DoseLog[] | null }

  // Calculate streak (consecutive days all doses taken)
  const { data: recentLogs } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patient.id)
    .lt('scheduled_at', today.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(200) as { data: DoseLog[] | null }

  let streak = 0
  if (recentLogs && recentLogs.length > 0) {
    // Group by date
    const logsByDate = new Map<string, DoseLog[]>()
    for (const log of recentLogs) {
      const dateKey = log.scheduled_at.slice(0, 10)
      if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, [])
      logsByDate.get(dateKey)!.push(log)
    }

    // Walk backwards from yesterday
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let checkDate = new Date(yesterday)
    while (true) {
      const dateKey = checkDate.toISOString().slice(0, 10)
      const dayLogs = logsByDate.get(dateKey)
      if (!dayLogs || dayLogs.length === 0) break
      const allTaken = dayLogs.every(l => l.confirmed === true)
      if (!allTaken) break
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }
  }

  const firstName = patient.name.split(' ')[0]

  // Fetch upcoming appointments for today & tomorrow
  const patientTimezone = patient.timezone || (patient.state ? getTimezoneForState(patient.state) : 'America/Chicago')
  const todayLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: patientTimezone }).format(new Date())
  const tomorrowLocalDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
  const tomorrowLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: patientTimezone }).format(tomorrowLocalDate)

  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select('id, appointment_date, appointment_time, appointment_type, doctor_name, location')
    .eq('patient_id', patient.id)
    .eq('status', 'upcoming')
    .gte('appointment_date', todayLocalStr)
    .lte('appointment_date', tomorrowLocalStr)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })

  return (
    <>
      <MyMedsClient
        patient={patient}
        medications={medications || []}
        todayLogs={todayLogs || []}
        streak={streak}
        firstName={firstName}
        upcomingAppointments={upcomingAppointments || []}
        patientTimezone={patientTimezone}
        todayLocalStr={todayLocalStr}
      />
      <InstallPrompt />
    </>
  )
}
