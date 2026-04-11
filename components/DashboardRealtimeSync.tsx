'use client'

/**
 * DashboardRealtimeSync
 *
 * Client component mounted inside the (server-rendered) DashboardPage.
 * Subscribes to Supabase real-time changes on the patients table for the
 * current caregiver. When enrollment_status transitions to 'active', it:
 *   1. Shows a toast notification
 *   2. Triggers a router.refresh() so the server component re-fetches data
 *
 * NOTE: Requires the patients table to be in the supabase_realtime publication.
 * See supabase/migrations/20260411270000_enable_realtime.sql
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Toast, useToast } from '@/components/Toast'
import { Patient } from '@/lib/types'

interface DashboardRealtimeSyncProps {
  userId: string
  /** Initial patient list so we can track prior enrollment statuses */
  patients: Pick<Patient, 'id' | 'name' | 'enrollment_status'>[]
}

export default function DashboardRealtimeSync({ userId, patients }: DashboardRealtimeSyncProps) {
  const supabase = createClient()
  const router = useRouter()
  const { toasts, addToast, dismissToast } = useToast()
  const prevStatusRef = useRef<Record<string, string>>({})

  // Seed status map from initial props
  useEffect(() => {
    const statusMap: Record<string, string> = {}
    for (const p of patients) {
      statusMap[p.id] = p.enrollment_status
    }
    prevStatusRef.current = statusMap
  }, [patients])

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-members-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'patients',
          filter: `owner_id=eq.${userId}`,
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

          // Refresh server component data (re-fetches from Supabase)
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return <Toast toasts={toasts} onDismiss={dismissToast} />
}
