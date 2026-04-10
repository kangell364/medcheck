import { createClient } from '@/lib/supabase/server'

export default async function AlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .eq('owner_id', user!.id)

  const patientIds = (patients || []).map((p: any) => p.id)

  const { data: alertLogs } = patientIds.length > 0
    ? await supabase
        .from('alert_log')
        .select(`
          *,
          patients(name)
        `)
        .in('patient_id', patientIds)
        .order('sent_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const alertTypeConfig: Record<string, { icon: string; color: string }> = {
    missed_dose: { icon: '❌', color: 'text-red-600' },
    late_confirmation: { icon: '⏰', color: 'text-amber-600' },
    call_failed: { icon: '📵', color: 'text-orange-600' },
    call_completed: { icon: '✅', color: 'text-emerald-600' },
    default: { icon: '🔔', color: 'text-gray-600' },
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Alert Log</h1>
        <p className="text-gray-500 mt-1">History of alerts sent for missed doses</p>
      </div>

      {(!alertLogs || alertLogs.length === 0) ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No alerts yet</h2>
          <p className="text-gray-500">Alerts will appear here when medications are missed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {(alertLogs || []).map((alert: any) => {
            const typeConfig = alertTypeConfig[alert.alert_type] || alertTypeConfig.default
            return (
              <div key={alert.id} className="px-5 py-4 flex items-start gap-4">
                <span className={`text-2xl flex-shrink-0 mt-0.5 ${typeConfig.color}`}>
                  {typeConfig.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {alert.patients?.name || 'Unknown patient'}
                    </span>
                    {alert.alert_type && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                  {alert.sent_to && (
                    <p className="text-xs text-gray-400 mt-1">Sent to: {alert.sent_to}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(alert.sent_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
