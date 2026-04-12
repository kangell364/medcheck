import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import AlertFilters, { type AlertFilter } from '@/components/AlertFilters'
import AlertRow from '@/components/AlertRow'
import ChangeRequestCard from '@/components/ChangeRequestCard'
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
  requests: [
    'med_change_request', 'change_approved', 'change_declined',
    'new_med_request', 'new_med_approved', 'new_med_declined',
  ],
}

const CHANGE_REQUEST_EVENT_TYPES = new Set([
  'med_change_request', 'new_med_request',
  'change_approved', 'change_declined',
  'new_med_approved', 'new_med_declined',
])

const SEVERITY_TEXT: Record<string, string> = {
  missed_dose: 'text-red-700 font-bold text-lg',
  med_change_request: 'text-amber-700 font-bold text-lg',
  new_med_request: 'text-amber-700 font-bold text-lg',
  change_approved: 'text-green-700 font-bold text-lg',
  new_med_approved: 'text-green-700 font-bold text-lg',
  change_declined: 'text-gray-600 font-medium',
  new_med_declined: 'text-gray-600 font-medium',
  enrollment: 'text-blue-600 font-medium',
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
    return <EmptyState activeFilter={activeFilter} />
  }

  query = query.in('patient_id', filteredPatientIds)

  if (activeFilter !== 'all') {
    const eventTypes = FILTER_EVENT_TYPES[activeFilter]
    query = query.in('event_type', eventTypes)
  }

  const { data: alertLogs } = await query

  // For change request alerts, fetch the actual request data + original med in one batch
  const changeRequestIds: string[] = []
  for (const alert of alertLogs || []) {
    const crId = (alert.internal_details as any)?.change_request_id
    if (crId && CHANGE_REQUEST_EVENT_TYPES.has(alert.event_type)) {
      changeRequestIds.push(crId)
    }
  }

  // Fetch all change requests in one query
  const changeRequestMap = new Map<string, any>()
  if (changeRequestIds.length > 0) {
    const { data: reqs } = await supabase
      .from('med_change_requests')
      .select('*')
      .in('id', changeRequestIds)
    for (const r of reqs || []) {
      changeRequestMap.set(r.id, r)
    }
  }

  // Fetch original medications for change requests
  const medicationIds: string[] = []
  for (const req of changeRequestMap.values()) {
    if (req.medication_id) medicationIds.push(req.medication_id)
  }
  const originalMedMap = new Map<string, any>()
  if (medicationIds.length > 0) {
    const { data: meds } = await supabase
      .from('medications')
      .select('id, name, nickname, dosage, frequency, reminder_times, notes')
      .in('id', medicationIds)
    for (const m of meds || []) {
      originalMedMap.set(m.id, m)
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Alert Log</h1>
        <p className="text-gray-500 mt-1">
          {patientId
            ? 'Activity for this member'
            : 'History of all activity across your members'}
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
            {alertLogs.map((alert: any) => {
              const isChangeEvent = CHANGE_REQUEST_EVENT_TYPES.has(alert.event_type)
              const crId = (alert.internal_details as any)?.change_request_id

              if (isChangeEvent && crId) {
                const reqData = changeRequestMap.get(crId) || null
                const originalMed = reqData?.medication_id ? originalMedMap.get(reqData.medication_id) || null : null

                return (
                  <ChangeRequestCard
                    key={alert.id}
                    alertId={alert.id}
                    patientName={alert.patient_name || null}
                    sentAt={alert.sent_at}
                    internalDetails={alert.internal_details}
                    eventType={alert.event_type}
                    changeRequestId={crId}
                    requestData={reqData}
                    originalMed={originalMed}
                  />
                )
              }

              // Normal alert row — apply severity text style if known
              const extraClass = SEVERITY_TEXT[alert.event_type] || ''
              return (
                <AlertRow
                  key={alert.id}
                  id={alert.id}
                  patientName={alert.patient_name || null}
                  medicationName={alert.medication_name || null}
                  displayMessage={alert.display_message || alert.message}
                  message={alert.message}
                  severity={alert.severity}
                  sentAt={alert.sent_at}
                  internalDetails={alert.internal_details}
                  isAdmin={isAdmin}
                  severityClass={extraClass}
                />
              )
            })}
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
        <p className="text-gray-500 mt-1">History of all activity across your members</p>
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
