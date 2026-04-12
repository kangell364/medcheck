'use client'

import { useState } from 'react'
import { relativeTime, absoluteTime } from '@/lib/relativeTime'
import { useRouter } from 'next/navigation'

interface ChangeRequestCardProps {
  alertId: string
  patientName: string | null
  sentAt: string
  internalDetails: Record<string, unknown> | null
  eventType: string
  // These come from internal_details or are pre-fetched
  changeRequestId?: string
  requestData?: {
    id: string
    type: 'change' | 'new_medication'
    status: 'pending' | 'approved' | 'declined'
    patient_id: string
    medication_id: string | null
    requested_name: string | null
    requested_dosage: string | null
    requested_frequency: string | null
    requested_reminder_times: string[] | null
    requested_nickname: string | null
    requested_notes: string | null
    member_note: string | null
    caregiver_note: string | null
  } | null
  // Original medication values (for diff display)
  originalMed?: {
    name: string
    nickname: string | null
    dosage: string | null
    frequency: string
    reminder_times: string[]
    notes: string | null
  } | null
}

const FREQ_LABELS: Record<string, string> = {
  once: 'Once daily',
  twice: 'Twice daily',
  three_times: 'Three times daily',
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function ChangeRequestCard({
  patientName,
  sentAt,
  requestData,
  originalMed,
  eventType,
}: ChangeRequestCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const [showDeclineNote, setShowDeclineNote] = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const [done, setDone] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  if (!requestData) return null

  const isNew = requestData.type === 'new_medication'
  const isPending = requestData.status === 'pending' && !done

  // Build diff for change requests
  const diffs: { label: string; from: string; to: string }[] = []
  if (!isNew && originalMed) {
    if (requestData.requested_name && requestData.requested_name !== originalMed.name) {
      diffs.push({ label: 'Name', from: originalMed.name, to: requestData.requested_name })
    }
    if (requestData.requested_nickname !== null && requestData.requested_nickname !== originalMed.nickname) {
      diffs.push({
        label: 'Nickname',
        from: originalMed.nickname || '(none)',
        to: requestData.requested_nickname || '(none)',
      })
    }
    if (requestData.requested_dosage !== null && requestData.requested_dosage !== originalMed.dosage) {
      diffs.push({
        label: 'Dosage',
        from: originalMed.dosage || '(none)',
        to: requestData.requested_dosage || '(none)',
      })
    }
    if (requestData.requested_frequency && requestData.requested_frequency !== originalMed.frequency) {
      diffs.push({
        label: 'Frequency',
        from: FREQ_LABELS[originalMed.frequency] || originalMed.frequency,
        to: FREQ_LABELS[requestData.requested_frequency] || requestData.requested_frequency,
      })
    }
    if (
      requestData.requested_reminder_times &&
      JSON.stringify(requestData.requested_reminder_times) !== JSON.stringify(originalMed.reminder_times)
    ) {
      diffs.push({
        label: 'Times',
        from: (originalMed.reminder_times || []).map(formatTime).join(', '),
        to: requestData.requested_reminder_times.map(formatTime).join(', '),
      })
    }
  }

  async function handleApprove() {
    if (!requestData) return
    setLoading('approve')
    try {
      if (isNew) {
        // For new medication: mark approved then redirect caregiver to add form
        await fetch(`/api/med-change-requests/${requestData.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        // Build query params for pre-fill
        const qp = new URLSearchParams()
        if (requestData.requested_name) qp.set('name', requestData.requested_name)
        if (requestData.requested_dosage) qp.set('dosage', requestData.requested_dosage)
        if (requestData.requested_nickname) qp.set('nickname', requestData.requested_nickname)
        router.push(`/patients/${requestData.patient_id}/medications/new?${qp.toString()}`)
        return
      }

      const res = await fetch(`/api/med-change-requests/${requestData.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('approve error:', err)
        return
      }
      setDone(true)
      setDoneMsg('✅ Approved and applied!')
    } finally {
      setLoading(null)
    }
  }

  async function handleDecline() {
    if (!requestData) return
    setLoading('decline')
    try {
      const res = await fetch(`/api/med-change-requests/${requestData.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiver_note: declineNote || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('decline error:', err)
        return
      }
      setDone(true)
      setDoneMsg('❌ Request declined.')
    } finally {
      setLoading(null)
      setShowDeclineNote(false)
    }
  }

  // Resolved states (already approved/declined before page load, or just acted)
  const resolvedStatus = done ? (doneMsg.startsWith('✅') ? 'approved' : 'declined') : requestData.status
  const isResolved = resolvedStatus !== 'pending'

  const headerColor = isNew
    ? 'text-amber-700'
    : eventType === 'change_approved' || eventType === 'new_med_approved'
      ? 'text-green-700'
      : eventType === 'change_declined' || eventType === 'new_med_declined'
        ? 'text-gray-600'
        : 'text-amber-700'

  const borderColor = isNew
    ? 'border-l-amber-500'
    : eventType === 'change_approved' || eventType === 'new_med_approved'
      ? 'border-l-emerald-500'
      : eventType === 'change_declined' || eventType === 'new_med_declined'
        ? 'border-l-gray-400'
        : 'border-l-amber-500'

  const headerText = isNew ? '💊 NEW MEDICATION REQUEST' : '💬 MEDICATION CHANGE REQUEST'
  const headerIcon = isNew ? '💊' : '💬'

  const medDisplayName = requestData.requested_name
    ? (requestData.requested_nickname
        ? `${requestData.requested_name} ("${requestData.requested_nickname}")`
        : requestData.requested_name)
    : originalMed?.name || 'medication'

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${borderColor} p-5 shadow-sm`}>
      <div className="flex items-start gap-4">
        <span className="text-2xl flex-shrink-0 mt-0.5">{headerIcon}</span>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <p className={`font-bold text-lg ${headerColor}`}>{headerText}</p>

          {/* Patient + med name */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {patientName && (
              <span className="font-semibold text-gray-900">{patientName}</span>
            )}
            {!isNew && originalMed && (
              <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full border border-teal-200">
                {originalMed.nickname || originalMed.name}
              </span>
            )}
          </div>

          {/* New med request summary */}
          {isNew && (
            <div className="mt-2">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Wants to add:</span>{' '}
                {medDisplayName}
                {requestData.requested_dosage ? ` — ${requestData.requested_dosage}` : ''}
              </p>
            </div>
          )}

          {/* Member note */}
          {requestData.member_note && (
            <p className="text-sm text-gray-600 mt-1 italic">
              &ldquo;{requestData.member_note}&rdquo;
            </p>
          )}

          {/* Diff for change requests */}
          {!isNew && diffs.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Changes requested:</p>
              <ul className="space-y-1">
                {diffs.map(d => (
                  <li key={d.label} className="text-sm text-gray-700">
                    <span className="font-medium">{d.label}:</span>{' '}
                    <span className="line-through text-gray-400">{d.from}</span>
                    {' → '}
                    <span className="text-teal-700 font-medium">{d.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No diff (all fields same or none provided) */}
          {!isNew && diffs.length === 0 && requestData.status === 'pending' && (
            <p className="text-sm text-gray-500 mt-2 italic">No specific field changes detected — see member note.</p>
          )}

          {/* Resolved status */}
          {done && (
            <p className={`mt-3 text-sm font-semibold ${doneMsg.startsWith('✅') ? 'text-emerald-600' : 'text-gray-500'}`}>
              {doneMsg}
            </p>
          )}
          {!done && isResolved && (
            <p className={`mt-3 text-sm font-semibold ${resolvedStatus === 'approved' ? 'text-emerald-600' : 'text-gray-500'}`}>
              {resolvedStatus === 'approved' ? '✅ Previously approved' : '❌ Previously declined'}
              {requestData.caregiver_note && ` — "${requestData.caregiver_note}"`}
            </p>
          )}

          {/* Action buttons — only for pending requests */}
          {isPending && !showDeclineNote && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={handleApprove}
                disabled={loading !== null}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {loading === 'approve' ? '⏳ Approving…' : (isNew ? '✅ Add It' : '✅ Approve & Apply')}
              </button>
              <button
                onClick={() => setShowDeclineNote(true)}
                disabled={loading !== null}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:border-red-300 hover:text-red-600 text-gray-600 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                ❌ Decline
              </button>
            </div>
          )}

          {/* Decline note field */}
          {isPending && showDeclineNote && (
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Reason for declining <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={declineNote}
                onChange={e => setDeclineNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                placeholder="e.g. Please discuss with your doctor first"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
                >
                  {loading === 'decline' ? '⏳ Declining…' : '❌ Confirm Decline'}
                </button>
                <button
                  onClick={() => { setShowDeclineNote(false); setDeclineNote('') }}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <span
            className="text-xs text-gray-400 mt-3 block cursor-default"
            title={absoluteTime(sentAt)}
          >
            {relativeTime(sentAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
