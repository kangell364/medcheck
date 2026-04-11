import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import AlertFilters, { type AlertFilter } from '@/components/AlertFilters'
import AlertRow from '@/components/AlertRow'
import LoadMoreAlerts from '@/components/LoadMoreAlerts'

const PAGE_SIZE = 50

// Map filter slugs → event_type arrays
const FILTER_EVENT_TYPES: Record<Exclude<AlertFilter, 'all'>, string[]> = {
  missed: ['missed_dose', 'snooze_expired'],
  calls: [
    'call_placed', 'call_answered', 'call_failed', 'call_no_answer',
    'dose_confirmed_call', 'dose_declined_call', 'callback_scheduled',
    'callback_fulfilled', 'snooze_started',
  ],
  appointments: ['appointment_reminder', 'appointment_completed', 'appointment_missed'],
  account: ['med_added', 'med_deleted', 'med_edited', 'patient_updated', 'contact_added'],
  delivery: ['sms_failed', 'delivery_delayed', 'system_error'],
}

interface PageProps {
  searchParams: Promise<{ filter?: string; page?: string; patientId?: string }>
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const { filter, page, patientId } = await searchParams

  const activeFilter = (filter || 'all') as AlertFilter
  const currentPage = Math.max(1, parseInt(page || '1', 10))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Check if current user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = (profile as any)?.is_admin === true

  // Get patient IDs owned by this user
  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .eq('owner_id', user.id)

  const patientIds = (patients || []).map((p: any) => p.id)

  // If patientId filter provided, restrict to that patient
  const filteredPatientIds = patientId
    ? patientIds.filter(id => id === patientId)
    : patientIds

  let query = supabase
    .from('alert_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filteredPatientIds.length === 0) {
    // No patients — return empty
    return <EmptyState activeFilter={activeFilter} />
  }

  query = query.in('patient_id', filteredPatientIds)

  // Apply filter
  if (activeFilter !== 'all') {
    const eventTypes = FILTER_EVENT_TYPES[activeFilter]
    query = query.in('event_type', eventTypes)
  }

  const { data: alertLogs } = await query

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Alert Log</h1>
        <p className="text-gray-500 mt-1">
          {patientId
            ? 'Activity for this patient'
            : 'History of all activity across your patients'}
        </p>
      </div>

      <Suspense fallback={null}>
        <AlertFilters activeFilter={activeFilter} />
      </Suspense>

      {(!alertLogs || alertLogs.length === 0) ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No alerts yet</h2>
          <p className="text-gray-500">
            {activeFilter === 'all'
              ? "You'll see activity here when medications are due"
              : `No ${activeFilter.replace(/_/g, ' ')} events yet`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {alertLogs.map((alert: any) => (
              <AlertRow
                key={alert.id}
                id={alert.id}
                patientName={alert.patient_name || (alert as any).patients?.name || null}
                medicationName={alert.medication_name || null}
                displayMessage={alert.display_message || alert.message}
                message={alert.message}
                severity={alert.severity}
                sentAt={alert.sent_at}
                internalDetails={alert.internal_details}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          <Suspense fallback={null}>
            <LoadMoreAlerts currentCount={alertLogs.length} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}

function EmptyState({ activeFilter }: { activeFilter: AlertFilter }) {
  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Alert Log</h1>
        <p className="text-gray-500 mt-1">History of all activity across your patients</p>
      </div>
      <Suspense fallback={null}>
        <AlertFilters activeFilter={activeFilter} />
      </Suspense>
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">🔔</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No alerts yet</h2>
        <p className="text-gray-500">You&apos;ll see activity here when medications are due</p>
      </div>
    </div>
  )
}
