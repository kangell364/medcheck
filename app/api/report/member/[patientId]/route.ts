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

function formatTime12(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

type CellStatus = 'taken' | 'manual' | 'skipped' | 'missed' | 'none'

// Skipped = confirmed:false, method:'manual'  (app skip button)
// Manual/late = confirmed:true, method:'manual'  (caregiver manual log)
function getSlotCell(logs: DoseLog[], medId: string, time: string, day: string): CellStatus {
  const log = logs.find(l =>
    l.medication_id === medId &&
    l.scheduled_at.startsWith(day) &&
    l.scheduled_at.includes(`T${time}`)
  )
  if (!log) return 'none'
  if (log.confirmed === true && log.method === 'manual') return 'manual'
  if (log.confirmed === true) return 'taken'
  if (log.confirmed === false && log.method === 'manual') return 'skipped'
  if (log.confirmed === false) return 'missed'
  return 'none'
}

function cellLabel(status: CellStatus, confirmedAt?: string | null): string {
  switch (status) {
    case 'taken':   return confirmedAt ? `✅ ${new Date(confirmedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}` : '✅ Taken'
    case 'manual':  return confirmedAt ? `📝 ${new Date(confirmedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}` : '📝 Late'
    case 'skipped': return '⏭️ Skipped'
    case 'missed':  return '❌ Missed'
    default:        return '—'
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
  const allDays = getDaysInRange(dateFrom, dateTo)
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Global stats (per-slot, respecting start_date)
  let globalScheduled = 0
  let globalTaken = 0
  let globalManual = 0
  let globalSkipped = 0
  let globalMissed = 0

  // Build per-med sections
  const medSections = medications.map(med => {
    const times = med.reminder_times?.length ? med.reminder_times : ['08:00']
    const startDate = med.start_date || null
    // Days relevant to this med
    const medDays = allDays.filter(d => {
      const ds = d.toISOString().slice(0, 10)
      return !startDate || ds >= startDate
    })

    let medTaken = 0, medManual = 0, medSkipped = 0, medMissed = 0
    const totalSlots = times.length * medDays.length
    globalScheduled += totalSlots

    // Build per-slot tables
    const slotTables = times.map(time => {
      const dayRows = medDays.map(day => {
        const ds = day.toISOString().slice(0, 10)
        const log = logs.find(l =>
          l.medication_id === med.id &&
          l.scheduled_at.startsWith(ds) &&
          l.scheduled_at.includes(`T${time}`)
        )
        const status = getSlotCell(logs, med.id, time, ds)
        const label = cellLabel(status, log?.confirmed_at)
        const dateLabel = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        let bg = '#f9fafb'; let fg = '#6b7280'
        if (status === 'taken')   { bg = '#d1fae5'; fg = '#065f46' }
        if (status === 'manual')  { bg = '#ccfbf1'; fg = '#0d9488' }
        if (status === 'skipped') { bg = '#fef3c7'; fg = '#92400e' }
        if (status === 'missed')  { bg = '#fee2e2'; fg = '#991b1b' }

        return `<tr>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;width:90px;">${dateLabel}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;">
            <span style="background:${bg};color:${fg};font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;">${label}</span>
          </td>
        </tr>`
      }).join('')

      // Count for this slot
      medDays.forEach(day => {
        const ds = day.toISOString().slice(0, 10)
        const s = getSlotCell(logs, med.id, time, ds)
        if (s === 'taken')   medTaken++
        if (s === 'manual')  medManual++
        if (s === 'skipped') medSkipped++
        if (s === 'missed')  medMissed++
      })

      return `
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#374151;">⏰ ${formatTime12(time)} slot</p>
          <table width="100%" style="border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
            ${dayRows || '<tr><td colspan="2" style="padding:10px;color:#9ca3af;font-size:13px;">No data</td></tr>'}
          </table>
        </div>`
    }).join('')

    globalTaken   += medTaken
    globalManual  += medManual
    globalSkipped += medSkipped
    globalMissed  += medMissed

    const medTotal = medTaken + medManual
    const medPct = totalSlots > 0 ? Math.round((medTotal / totalSlots) * 100) : 0
    const pctColor = medPct >= 80 ? '#10b981' : medPct >= 50 ? '#f59e0b' : '#ef4444'
    const startedLine = startDate
      ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">Started ${new Date(startDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>`
      : ''

    return `
      <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f0f0f0;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px;">
          <div>
            <span style="font-size:17px;font-weight:700;color:#111;">${med.nickname || med.name}</span>
            ${med.nickname ? `<span style="font-size:13px;color:#6b7280;margin-left:6px;">(${med.name})</span>` : ''}
            ${startedLine}
          </div>
          <span style="font-size:20px;font-weight:800;color:${pctColor};">${medPct}%</span>
        </div>
        ${med.dosage ? `<p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">${med.dosage} · ${frequencyLabel(med.frequency)}</p>` : `<p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">${frequencyLabel(med.frequency)}</p>`}
        <div style="display:flex;gap:16px;margin-bottom:14px;font-size:12px;">
          <span style="color:#059669;font-weight:600;">✅ Taken: ${medTaken}</span>
          <span style="color:#0d9488;font-weight:600;">📝 Late: ${medManual}</span>
          <span style="color:#d97706;font-weight:600;">⏭️ Skipped: ${medSkipped}</span>
          <span style="color:#dc2626;font-weight:600;">❌ Missed: ${medMissed}</span>
        </div>
        ${slotTables}
      </div>`
  }).join('')

  const overallTaken = globalTaken + globalManual
  const overallPct = globalScheduled > 0 ? Math.round((overallTaken / globalScheduled) * 100) : 0
  const overallColor = overallPct >= 80 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#ef4444'

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
  .content { padding: 28px 32px; }
  .summary { padding: 20px 32px; background: #f0fdfa; border-bottom: 1px solid #ccfbf1; }
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
    <div style="display:flex;align-items:center;gap:24px;">
      <div style="font-size:48px;font-weight:800;color:${overallColor};line-height:1;">${overallPct}%</div>
      <div>
        <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:6px;">Overall Adherence</div>
        <div style="display:flex;gap:16px;font-size:13px;">
          <span style="color:#059669;font-weight:600;">✅ Taken: ${globalTaken}</span>
          <span style="color:#0d9488;font-weight:600;">📝 Late: ${globalManual}</span>
          <span style="color:#d97706;font-weight:600;">⏭️ Skipped: ${globalSkipped}</span>
          <span style="color:#dc2626;font-weight:600;">❌ Missed: ${globalMissed}</span>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">${overallTaken} of ${globalScheduled} scheduled doses taken</div>
      </div>
    </div>
  </div>

  <div class="content">
    ${medSections || '<p style="color:#9ca3af;text-align:center;">No medications in this period.</p>'}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        <strong>Legend:</strong>
        ✅ Taken on time &nbsp;·&nbsp; 📝 Logged late (manual) &nbsp;·&nbsp; ⏭️ Skipped &nbsp;·&nbsp; ❌ Missed &nbsp;·&nbsp; — No data
      </p>
    </div>
  </div>

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
