'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Patient } from '@/lib/types'
import { Toast, useToast } from '@/components/Toast'

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPopup, setPendingPopup] = useState<Patient | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const { toasts, addToast, dismissToast } = useToast()
  // Track previous enrollment statuses to detect transitions to 'active'
  const prevStatusRef = useRef<Record<string, string>>({})

  useEffect(() => {
    let userId: string | null = null

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })

      const loaded = (data as Patient[]) || []
      setPatients(loaded)
      setLoading(false)

      // Seed previous status map
      const statusMap: Record<string, string> = {}
      for (const p of loaded) {
        statusMap[p.id] = p.enrollment_status
      }
      prevStatusRef.current = statusMap

      // Subscribe to real-time changes on patients for this caregiver
      // NOTE: Requires the patients table to be in the supabase_realtime publication.
      // See supabase/migrations/20260411270000_enable_realtime.sql
      const channel = supabase
        .channel('members-status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'patients',
            filter: `owner_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as Patient

            // Detect pending → active transition and show toast
            const prevStatus = prevStatusRef.current[updated.id]
            if (prevStatus === 'pending' && updated.enrollment_status === 'active') {
              addToast(`✅ ${updated.name} has accepted their enrollment! Their profile is now active.`)
            }

            // Update status tracking map
            prevStatusRef.current = {
              ...prevStatusRef.current,
              [updated.id]: updated.enrollment_status,
            }

            // Update local state
            setPatients((prev) =>
              prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            )
          }
        )
        .subscribe()

      // Cleanup on unmount
      return () => {
        supabase.removeChannel(channel)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto pb-20 md:pb-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Members</h1>
            <p className="text-gray-500 mt-1">Manage medication tracking for your members</p>
          </div>
        </div>
        <div className="text-center py-12 text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Pending enrollment popup */}
      {pendingPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Awaiting Confirmation</h2>
            <p className="text-gray-600 mb-6">
              This member hasn&apos;t confirmed enrollment yet. Their profile will unlock
              once they reply <span className="font-semibold text-teal-600">YES</span> to our text.
            </p>
            <button
              onClick={() => setPendingPopup(null)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 mt-1">Manage medication tracking for your members</p>
        </div>
        <Link
          href="/patients/new"
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
        >
          <span>➕</span> Add Member
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No members yet</h2>
          <p className="text-gray-500 mb-6">Add a member to start tracking their medications.</p>
          <Link
            href="/patients/new"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-xl inline-block transition-colors"
          >
            Add First Member
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => {
            const isPending = patient.enrollment_status === 'pending'

            return (
              <div
                key={patient.id}
                onClick={() => {
                  if (isPending) {
                    setPendingPopup(patient)
                  } else {
                    router.push(`/patients/${patient.id}`)
                  }
                }}
                className={`bg-white rounded-2xl border p-5 flex items-center gap-4 transition-all group cursor-pointer ${
                  isPending
                    ? 'border-amber-200 opacity-80'
                    : 'border-gray-100 hover:border-teal-200 hover:shadow-sm'
                }`}
              >
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {patient.is_self ? '🙋' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-lg">{patient.name}</h3>
                    {patient.is_self && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Me</span>
                    )}
                    {isPending && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Pending Approval</span>
                    )}
                    {!patient.active && !isPending && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{patient.phone}</p>
                  <p className="text-xs text-gray-400">{patient.timezone}</p>
                </div>
                <span className={`transition-colors text-xl ${isPending ? 'text-amber-300' : 'text-gray-300 group-hover:text-teal-400'}`}>
                  {isPending ? '🔒' : '→'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
