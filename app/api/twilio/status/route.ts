import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Webhook for call status updates from Twilio
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const callSid = formData.get('CallSid') as string
  const callStatus = formData.get('CallStatus') as string

  console.log(`Call ${callSid} status: ${callStatus}`)

  const supabase = createAdminClient()

  // Update dose_logs with call status
  if (['failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
    // Find and update logs for this call
    const { data: logs } = await supabase
      .from('dose_logs')
      .select('*')
      .eq('call_sid', callSid)
      .is('confirmed', null)

    if (logs && logs.length > 0) {
      // Log call outcome in alert log
      const supabaseAdmin = createAdminClient()
      for (const log of logs) {
        await supabaseAdmin.from('alert_log').insert({
          patient_id: log.patient_id,
          medication_id: log.medication_id,
          alert_type: callStatus === 'no-answer' ? 'call_no_answer' : 'call_failed',
          message: `Reminder call ${callStatus} — could not reach patient`,
          sent_to: 'system',
          sent_at: new Date().toISOString(),
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
