import Link from 'next/link'
import { relativeTime } from '@/lib/relativeTime'
import { AlertLog } from '@/lib/types'

type Severity = 'info' | 'warning' | 'error' | 'success'

const SEVERITY_ICONS: Record<Severity, string> = {
  success: '✅',
  warning: '⚠️',
  error: '🔴',
  info: 'ℹ️',
}

interface RecentActivityListProps {
  patientId: string
  recentAlerts: AlertLog[]
}

export default function RecentActivityList({ patientId, recentAlerts }: RecentActivityListProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">Recent Activity</h3>
        <Link
          href={`/alerts?patientId=${patientId}`}
          className="text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
        >
          View full log →
        </Link>
      </div>

      {recentAlerts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No recent activity for this patient.</p>
      ) : (
        <div className="space-y-2">
          {recentAlerts.map(alert => {
            const sev: Severity = (alert.severity as Severity) || 'info'
            const icon = SEVERITY_ICONS[sev]
            const msg = alert.display_message || alert.message || 'Event recorded'
            return (
              <div key={alert.id} className="flex items-start gap-2.5 py-2 border-b border-gray-100 last:border-0">
                <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-tight">{msg}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{relativeTime(alert.sent_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
