import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { Medication, DoseLog, Patient } from '@/lib/types'
import PatientOnboarding from './PatientOnboarding'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PatientTokenPage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  // Look up patient by permanent_token
  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('permanent_token', token)
    .single() as { data: (Patient & { permanent_token: string; terms_accepted_at: string | null; caregiver_name?: string }) | null; error: unknown }

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center max-w-sm">
          <div className="text-7xl mb-5">🔍</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Link not found</h1>
          <p className="text-xl text-gray-500">
            This medication link is invalid or has expired. Please ask your caregiver for a new link.
          </p>
        </div>
      </div>
    )
  }

  // Store patient_id in a readable cookie (for dose logging from this page)
  const cookieStore = await cookies()
  cookieStore.set('rxnudge_patient_id', patient.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // JS-readable so client components can log doses
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  const firstName = patient.name.split(' ')[0]
  const patientEmail: string = (patient as Patient & { email?: string | null }).email ?? ''

  // Get caregiver name
  let caregiverName = 'Your caregiver'
  const { data: caregiverProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', patient.owner_id)
    .single()
  if (caregiverProfile?.full_name) {
    caregiverName = caregiverProfile.full_name
  }

  // Load medications data
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('active', true)
    .is('archived_at', null)
    .order('created_at') as { data: Medication[] | null }

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

  // Calculate streak
  const { data: recentLogs } = await supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patient.id)
    .lt('scheduled_at', today.toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(200) as { data: DoseLog[] | null }

  let streak = 0
  if (recentLogs && recentLogs.length > 0) {
    const logsByDate = new Map<string, DoseLog[]>()
    for (const log of recentLogs) {
      const dateKey = log.scheduled_at.slice(0, 10)
      if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, [])
      logsByDate.get(dateKey)!.push(log)
    }

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

  // Enrich patient with email for onboarding component
  const enrichedPatient = {
    ...patient,
    email: patientEmail,
  }

  return (
    <PatientOnboarding
      patient={enrichedPatient}
      firstName={firstName}
      caregiverName={caregiverName}
      medications={medications || []}
      todayLogs={todayLogs || []}
      streak={streak}
    />
  )
}
