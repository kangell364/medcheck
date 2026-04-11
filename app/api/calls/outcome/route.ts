/**
 * POST /api/calls/outcome
 *
 * Updates an escalation record based on the outcome of an AI voice call.
 * Called by the realtime bridge (lib/realtimeBridge.ts) when a call ends.
 *
 * Body: { escalationId, outcome: 'confirmed'|'declined'|'snoozed'|'timeout', snoozeMinutes? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminLogEvent } from '@/lib/logEvent'

export type CallOutcome = 'confirmed' | 'declined' | 'snoozed' | 'timeout'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { escalationId, outcome, snoozeMinutes } = body as {
      escalationId: string
      outcome: CallOutcome
      snoozeMinutes?: number
    }

    if (!escalationId || !outcome) {
      return NextResponse.json(
        { error: 'escalationId and outcome required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: escalation, error: fetchError } = await supabase
      .from('reminder_escalations')
      .select('*, patients(id, name, owner_id)')
      .eq('id', escalationId)
      .single()

    if (fetchError || !escalation) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 })
    }

    const patient = (escalation as Record<string, unknown>).patients as {
      id: string
      name: string
      owner_id: string
    } | null

    const now = new Date()
    let updatePayload: Record<string, unknown> = {}

    switch (outcome) {
      case 'confirmed':
        updatePayload = {
          status: 'confirmed',
          confirmed_at: now.toISOString(),
        }
        break

      case 'declined':
        updatePayload = {
          status: 'declined',
        }
        break

      case 'snoozed': {
        const snoozeMs = (snoozeMinutes ?? 60) * 60 * 1000
        updatePayload = {
          status: 'snoozed',
          snoozed_until: new Date(now.getTime() + snoozeMs).toISOString(),
        }
        break
      }

      case 'timeout':
        // Treat timeout same as if the call step didn't resolve — advance will handle it
        updatePayload = {
          step: 4, // move past the call step
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    }

    await supabase
      .from('reminder_escalations')
      .update(updatePayload)
      .eq('id', escalationId)

    if (patient) {
      const eventTypeMap: Record<CallOutcome, 'call_confirmed' | 'call_declined' | 'call_snoozed' | 'call_timeout'> = {
        confirmed: 'call_confirmed',
        declined: 'call_declined',
        snoozed: 'call_snoozed',
        timeout: 'call_timeout',
      }
      await adminLogEvent({
        patientId: patient.id,
        ownerId: patient.owner_id,
        eventType: eventTypeMap[outcome],
        patientName: patient.name,
        internalDetails: { escalationId, outcome, snoozeMinutes },
      })
    }

    return NextResponse.json({ success: true, outcome, escalationId })
  } catch (error: unknown) {
    console.error('[calls/outcome] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
