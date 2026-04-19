/**
 * GET /api/debug/dose-logs?patientId=...&medicationId=...&sinceHours=48
 *
 * Returns raw dose_logs for a patient (optionally filtered to a medication) over a time window.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const medicationId = searchParams.get('medicationId')
  const sinceHours = parseInt(searchParams.get('sinceHours') || '48', 10)

  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

  const supabase = createAdminClient()
  const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  let q = supabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('scheduled_at', sinceIso)
    .order('scheduled_at', { ascending: false })

  if (medicationId) q = q.eq('medication_id', medicationId)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    patientId,
    medicationId: medicationId || null,
    sinceHours,
    sinceIso,
    rows: data || [],
  })
}
