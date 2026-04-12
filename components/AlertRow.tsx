'use client'

import { useState } from 'react'
import { relativeTime, absoluteTime } from '@/lib/relativeTime'

type Severity = 'info' | 'warning' | 'error' | 'success'

interface AlertRowProps {
  id: string
  patientName?: string | null
  medicationName?: string | null
  displayMessage?: string | null
  message?: string | null
  severity?: Severity | null
  sentAt: string
  internalDetails?: Record<string, unknown> | null
  isAdmin: boolean
  /** Optional override for message text styling (e.g. bold red for missed doses) */
  severityClass?: string
}

const SEVERITY_CONFIG: Record<Severity, { border: string; icon: string; bg: string }> = {
  success: { border: 'border-l-emerald-500', icon: '✅', bg: 'bg-emerald-50' },
  warning: { border: 'border-l-amber-500', icon: '⚠️', bg: 'bg-amber-50' },
  error: { border: 'border-l-red-500', icon: '🔴', bg: 'bg-red-50' },
  info: { border: 'border-l-gray-400', icon: 'ℹ️', bg: 'bg-white' },
}

export default function AlertRow({
  patientName,
  medicationName,
  displayMessage,
  message,
  severity,
  sentAt,
  internalDetails,
  isAdmin,
  severityClass,
}: AlertRowProps) {
  const [expanded, setExpanded] = useState(false)
  const sev: Severity = severity || 'info'
  const cfg = SEVERITY_CONFIG[sev]
  const shownMessage = displayMessage || message || 'Alert recorded'

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${cfg.border} p-5 shadow-sm`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl flex-shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {patientName && (
              <span className="font-bold text-gray-900">{patientName}</span>
            )}
            {medicationName && (
              <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full border border-teal-200">
                {medicationName}
              </span>
            )}
          </div>
          <p className={`mt-1 ${severityClass || 'text-sm text-gray-700'}`}>{shownMessage}</p>
          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-xs text-gray-400 cursor-default"
              title={absoluteTime(sentAt)}
            >
              {relativeTime(sentAt)}
            </span>
            {isAdmin && internalDetails && Object.keys(internalDetails).length > 0 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
              >
                {expanded ? 'Hide details ▲' : 'Details ▼'}
              </button>
            )}
          </div>
          {expanded && internalDetails && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Internal Details (Admin)</p>
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all overflow-auto max-h-48">
                {JSON.stringify(internalDetails, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
