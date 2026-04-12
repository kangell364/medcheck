import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Patient, Medication, DoseLog } from '@/lib/types'

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getDaysInRange(dateFrom: string, dateTo: string): Date[] {
  const days: Date[] = []
  const start = new Date(dateFrom + 'T00:00:00')
  const end = new Date(dateTo + 'T23:59:59')
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case 'once': return 'Once daily'
    case 'twice': return 'Twice daily'
    case 'three_times': return 'Three times daily'
    default: return freq
  }
}

function buildMemberReportHTML(params: {
  patient: Patient
  medications: Medication[]
  logs: DoseLog[]
  dateFrom: string
  dateTo: string
}): string {
  const { patient, medications, logs, dateFrom, dateTo } = params
  const days = getDaysInRange(dateFrom, dateTo)
  const totalDays = days.length

  let globalScheduled = 0
  let globalTaken = 0

  const medRows = medications.map(med => {
    const medLogs = logs.filter(l => l.medication_id === med.id)
    const taken = medLogs.filter(l => l.confirmed === true).length
    const scheduled = totalDays
    globalScheduled += scheduled
    globalTaken += taken
    const pct = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 0
    const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:600;font-size:16px;">${med.nickname || med.name}</div>
          ${med.nickname ? `<div style="color:#888;font-size:13px;">${med.name}</div>` : ''}
          ${med.dosage ? `<div style="color:#888;font-size:13px;">${med.dosage}</div>` : ''}
          <div style="color:#888;font-size:13px;">${frequencyLabel(med.frequency)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
          ${taken} / ${scheduled}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
          <span style="color:${color};font-weight:700;font-size:18px;">${pct}%</span>
        </td>
      </tr>
    `
  }).join('')

  const overallPct = globalScheduled > 0 ? Math.round((globalTaken / globalScheduled) * 100) : 0
  const overallColor = overallPct >= 80 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#ef4444'
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Medication Report — ${patient.name}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px; color: #111; }
  .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 32px; }
  .header h1 { margin: 0 0 4px; font-size: 26px; }
  .header p { margin: 0; opacity: 0.85; font-size: 15px; }
  .summary { padding: 24px 32px; background: #f0fdfa; border-bottom: 1px solid #ccfbf1; display: flex; align-items: center; gap: 24px; }
  .big-pct { font-size: 48px; font-weight: 800; color: ${overallColor}; line-height: 1; }
  .summary-text { font-size: 15px; color: #555; }
  .summary-text strong { font-size: 18px; color: #111; display: block; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 10px 12px; text-align: left; background: #f8fafc; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
  thead th:not(:first-child) { text-align: center; }
  .footer { padding: 20px 32px; color: #9ca3af; font-size: 13px; text-align: center; border-top: 1px solid #f0f0f0; }
  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; border-radius: 0; }
    @page { margin: 0.5in; size: A4; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>💊 Medication Report</h1>
    <p>${patient.name} · ${formatDateDisplay(dateFrom)} – ${formatDateDisplay(dateTo)}</p>
  </div>

  <div class="summary">
    <div class="big-pct">${overallPct}%</div>
    <div class="summary-text">
      <strong>Overall Adherence</strong>
      ${globalTaken} of ${globalScheduled} doses taken over ${totalDays} days
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Medication</th>
        <th>Doses Taken</th>
        <th>Adherence</th>
      </tr>
    </thead>
    <tbody>
      ${medRows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#9ca3af;">No medications in this period.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Generated on ${generatedDate} · RxNudge
  </div>
</div>
</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params
  const token = req.nextUrl.searchParams.get('token')

  // Determine date range (default: last 30 days)
  const today = new Date()
  const defaultDateTo = today.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 29)
  const defaultDateFrom = thirtyDaysAgo.toISOString().slice(0, 10)

  const dateFrom = req.nextUrl.searchParams.get('from') || defaultDateFrom
  const dateTo = req.nextUrl.searchParams.get('to') || defaultDateTo

  let patient: Patient | null = null
  let medications: Medication[] = []
  let logs: DoseLog[] = []

  // Token-based access
  if (token) {
    const adminSupabase = createAdminClient()

    const { data: p } = await adminSupabase
      .from('patients')
      .select('*')
      .eq('permanent_token', token)
      .eq('id', patientId)
      .single() as { data: Patient | null }

    if (!p) {
      return NextResponse.json({ error: 'Invalid token or patient' }, { status: 401 })
    }
    patient = p
  } else {
    // Auth-based
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Patient user
    const { data: patientUser } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', patientId)
      .single() as { data: Patient | null }

    if (patientUser) {
      patient = patientUser
    } else {
      // Caregiver
      const { data: caregiverPatient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('owner_id', user.id)
        .single() as { data: Patient | null }

      if (!caregiverPatient) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      patient = caregiverPatient
    }
  }

  // Fetch medications and logs
  const adminSupabase = createAdminClient()

  const { data: meds } = await adminSupabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('active', true)
    .is('archived_at', null) as { data: Medication[] | null }

  medications = meds || []

  const { data: doseLogs } = await adminSupabase
    .from('dose_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('scheduled_at', dateFrom + 'T00:00:00')
    .lte('scheduled_at', dateTo + 'T23:59:59')
    .order('scheduled_at', { ascending: true }) as { data: DoseLog[] | null }

  logs = doseLogs || []

  const html = buildMemberReportHTML({ patient, medications, logs, dateFrom, dateTo })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
