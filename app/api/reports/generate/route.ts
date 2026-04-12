import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { Medication, DoseLog, Patient } from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)

interface PatientGroup {
  patientId: string
  medicationIds: string[]
}

interface RequestBody {
  patientGroups: PatientGroup[]
  dateFrom: string
  dateTo: string
  email: string
  requestedBy: string
  pdfOnly?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00') // noon to avoid timezone edge cases
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime12(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case 'once': return 'Once daily'
    case 'twice': return 'Twice daily'
    case 'three_times': return 'Three times daily'
    default: return freq
  }
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

function getWeeksFromDays(days: Date[]): Date[][] {
  if (days.length === 0) return []
  // Group into weeks starting from Monday
  const weeks: Date[][] = []
  let week: Date[] = []

  // Pad the first week if it doesn't start on Monday
  const firstDay = days[0]
  const dayOfWeek = firstDay.getDay() // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  for (let i = 0; i < mondayOffset; i++) {
    week.push(new Date(0)) // placeholder
  }

  for (const day of days) {
    week.push(day)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(new Date(0)) // pad end
    weeks.push(week)
  }
  return weeks
}

function computeStreaks(days: Date[], logs: DoseLog[]): { current: number; longest: number } {
  const confirmed = new Set<string>()
  logs.forEach(l => {
    if (l.confirmed === true) {
      confirmed.add(new Date(l.scheduled_at).toDateString())
    }
  })

  let longest = 0
  let current = 0
  let runningStreak = 0

  for (const day of days) {
    if (confirmed.has(day.toDateString())) {
      runningStreak++
      if (runningStreak > longest) longest = runningStreak
    } else {
      runningStreak = 0
    }
  }

  // Current streak: count backwards from last day
  for (let i = days.length - 1; i >= 0; i--) {
    if (confirmed.has(days[i].toDateString())) {
      current++
    } else break
  }

  return { current, longest }
}

// ── HTML Email Builder ─────────────────────────────────────────────────────

function buildEmailHTML(params: {
  patients: Array<{
    patient: Patient
    medications: Array<{
      med: Medication & { nickname?: string }
      logs: DoseLog[]
    }>
  }>
  dateFrom: string
  dateTo: string
  requestedBy: string
  recipientEmail: string
  generatedDate: string
}): string {
  const { patients, dateFrom, dateTo, requestedBy, recipientEmail, generatedDate } = params

  const days = getDaysInRange(dateFrom, dateTo)
  const totalDays = days.length

  // Helper: get effective days for a medication respecting start_date
  function getEffectiveDays(med: Medication & { start_date?: string | null }, days: Date[]): number {
    const sd = (med as any).start_date as string | null | undefined
    if (!sd) return days.length
    const startMs = new Date(sd + 'T00:00:00').getTime()
    return days.filter(d => d.getTime() >= startMs).length
  }

  // Compute global stats — using start_date-aware denominators, per reminder_times slot
  let globalScheduled = 0
  let globalTaken = 0
  let globalManual = 0
  let globalSkipped = 0
  let globalMissed = 0

  patients.forEach(({ medications }) => {
    medications.forEach(({ med, logs }) => {
      const sd = (med as any).start_date as string | null | undefined
      const startMs = sd ? new Date(sd + 'T00:00:00').getTime() : 0
      const effectiveDays = getEffectiveDays(med, days)
      const slots = med.reminder_times?.length ? med.reminder_times : ['08:00']
      globalScheduled += effectiveDays * slots.length
      logs.forEach(l => {
        if (sd && new Date(l.scheduled_at).getTime() < startMs) return
        if (l.confirmed === true && l.method === 'manual') globalManual++
        else if (l.confirmed === true) globalTaken++
        else if (l.confirmed === false && l.method === 'manual') globalSkipped++
        else if (l.confirmed === false) globalMissed++
      })
    })
  })

  const globalPct = globalScheduled > 0 ? Math.round(((globalTaken + globalManual) / globalScheduled) * 100) : 0
  const summaryColor = globalPct >= 80 ? '#0d9488' : globalPct >= 50 ? '#d97706' : '#dc2626'
  const summaryBg = globalPct >= 80 ? '#f0fdfa' : globalPct >= 50 ? '#fffbeb' : '#fef2f2'
  const summaryBorder = globalPct >= 80 ? '#99f6e4' : globalPct >= 50 ? '#fde68a' : '#fecaca'

  // Build medication sections
  const medSections = patients.map(({ patient, medications }) => {
    if (medications.length === 0) return ''

    const patientSection = `
      <tr>
        <td style="padding: 0 0 8px 0;">
          <p style="margin: 32px 0 0 0; font-size: 13px; font-weight: 700; color: #0d9488; text-transform: uppercase; letter-spacing: 1px; border-top: 2px solid #ccfbf1; padding-top: 24px;">Patient: ${patient.name}</p>
        </td>
      </tr>
    `

    const medBlocks = medications.map(({ med, logs }) => {
      const nickname = (med as any).nickname || null
      const medStartDate = (med as any).start_date as string | null | undefined
      const startDateDisplay = medStartDate
        ? new Date(medStartDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : null
      const startedLine = startDateDisplay
        ? `<span style="color: #6b7280; font-size: 12px; font-weight: 400; margin-left: 8px;">Started: ${startDateDisplay}</span>`
        : ''
      const medTitle = nickname
        ? `${med.name} <span style="color: #6b7280; font-weight: 400;">(${nickname})</span>${startedLine}`
        : `${med.name}${startedLine}`

      // Use start_date-aware effective days for adherence
      const effectiveDays = getEffectiveDays(med, days)
      const startMs = medStartDate ? new Date(medStartDate + 'T00:00:00').getTime() : 0
      const slots = med.reminder_times?.length ? med.reminder_times : ['08:00']
      const totalSlotDays = effectiveDays * slots.length
      const taken = logs.filter(l => {
        if (l.confirmed !== true || l.method === 'manual') return false
        if (!medStartDate) return true
        return new Date(l.scheduled_at).getTime() >= startMs
      }).length
      const manual = logs.filter(l => {
        if (!(l.confirmed === true && l.method === 'manual')) return false
        if (!medStartDate) return true
        return new Date(l.scheduled_at).getTime() >= startMs
      }).length
      const skipped = logs.filter(l => {
        if (!(l.confirmed === false && l.method === 'manual')) return false
        if (!medStartDate) return true
        return new Date(l.scheduled_at).getTime() >= startMs
      }).length
      const missed = logs.filter(l => {
        if (l.confirmed !== false || l.method === 'manual') return false
        if (!medStartDate) return true
        return new Date(l.scheduled_at).getTime() >= startMs
      }).length
      const pct = totalSlotDays > 0 ? Math.round(((taken + manual) / totalSlotDays) * 100) : 0
      const pctColor = pct >= 80 ? '#0d9488' : pct >= 50 ? '#d97706' : '#dc2626'
      const streaks = computeStreaks(days, logs)

      const missedDates = logs
        .filter(l => l.confirmed === false && l.method !== 'manual')
        .map(l => formatDateShort(new Date(l.scheduled_at)))
        .join(', ')

      const weeks = getWeeksFromDays(days)
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

      // Build calendar cells
      const calendarRows = weeks.map(week => {
        const cells = week.map(day => {
          if (day.getTime() === 0) {
            return `<td style="width: 40px; padding: 2px;"><div style="width: 36px; height: 40px; border-radius: 6px; background: #f9fafb;"></div></td>`
          }
          // Hide cells before medication start_date
          if (medStartDate && day.getTime() < startMs) {
            return `<td style="width: 40px; padding: 2px;"><div style="width: 36px; height: 40px;"></div></td>`
          }
          const nextDay = new Date(day)
          nextDay.setDate(nextDay.getDate() + 1)
          const dayLog = logs.find(l => {
            const d = new Date(l.scheduled_at)
            return d >= day && d < nextDay
          })

          let bg = '#f3f4f6'
          let textColor = '#9ca3af'
          let icon = '—'

          // Skipped = confirmed:false, method:'manual'
          // Manual/late = confirmed:true, method:'manual'
          if (dayLog) {
            if (dayLog.confirmed === true && dayLog.method === 'manual') {
              bg = '#ccfbf1'
              textColor = '#0d9488'
              icon = '📝'
            } else if (dayLog.confirmed === true) {
              bg = '#d1fae5'
              textColor = '#065f46'
              icon = '✅'
            } else if (dayLog.confirmed === false && dayLog.method === 'manual') {
              bg = '#fef3c7'
              textColor = '#92400e'
              icon = '⏭️'
            } else if (dayLog.confirmed === false) {
              bg = '#fee2e2'
              textColor = '#991b1b'
              icon = '❌'
            }
          }

          const dateNum = day.getDate()
          return `
            <td style="width: 40px; padding: 2px;">
              <div style="width: 36px; height: 40px; border-radius: 6px; background: ${bg}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                <span style="font-size: 9px; color: ${textColor}; font-weight: 600; display: block; line-height: 1;">${dateNum}</span>
                <span style="font-size: 10px; display: block; line-height: 1.4;">${icon}</span>
              </div>
            </td>
          `
        }).join('')
        return `<tr>${cells}</tr>`
      }).join('')

      const calendarHeader = dayNames.map(d => `<th style="width: 40px; padding: 2px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600;">${d}</th>`).join('')

      return `
        <tr>
          <td style="padding: 0 0 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f9fafb; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
              <tr>
                <td style="padding: 20px 24px 16px 24px;">
                  <!-- Med title -->
                  <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #111827;">${medTitle}</p>
                  <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">
                    ${med.dosage ? `${med.dosage} · ` : ''}${frequencyLabel(med.frequency)} · ${med.reminder_times.map(formatTime12).join(', ')}
                  </p>

                  <!-- Stats row -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                    <tr>
                      <td style="width: 20%; text-align: center; background: white; border-radius: 8px; padding: 10px 6px;">
                        <span style="display: block; font-size: 20px; font-weight: 800; color: ${pctColor};">${pct}%</span>
                        <span style="display: block; font-size: 10px; color: #6b7280; font-weight: 500;">Adherence</span>
                      </td>
                      <td style="width: 4px;"></td>
                      <td style="width: 20%; text-align: center; background: white; border-radius: 8px; padding: 10px 6px;">
                        <span style="display: block; font-size: 20px; font-weight: 800; color: #065f46;">${taken}</span>
                        <span style="display: block; font-size: 10px; color: #6b7280; font-weight: 500;">✅ Taken</span>
                      </td>
                      <td style="width: 4px;"></td>
                      <td style="width: 20%; text-align: center; background: white; border-radius: 8px; padding: 10px 6px;">
                        <span style="display: block; font-size: 20px; font-weight: 800; color: #0d9488;">${manual}</span>
                        <span style="display: block; font-size: 10px; color: #6b7280; font-weight: 500;">📝 Late</span>
                      </td>
                      <td style="width: 4px;"></td>
                      <td style="width: 20%; text-align: center; background: white; border-radius: 8px; padding: 10px 6px;">
                        <span style="display: block; font-size: 20px; font-weight: 800; color: #d97706;">${skipped}</span>
                        <span style="display: block; font-size: 10px; color: #6b7280; font-weight: 500;">⏭️ Skipped</span>
                      </td>
                      <td style="width: 4px;"></td>
                      <td style="width: 20%; text-align: center; background: white; border-radius: 8px; padding: 10px 6px;">
                        <span style="display: block; font-size: 20px; font-weight: 800; color: #dc2626;">${missed}</span>
                        <span style="display: block; font-size: 10px; color: #6b7280; font-weight: 500;">❌ Missed</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Calendar -->
                  <div style="overflow-x: auto;">
                    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border-spacing: 0;">
                      <thead>
                        <tr>${calendarHeader}</tr>
                      </thead>
                      <tbody>
                        ${calendarRows}
                      </tbody>
                    </table>
                  </div>

                  <!-- Streak & missed -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 14px;">
                    <tr>
                      <td>
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #374151;">
                          🔥 <strong>Current streak:</strong> ${streaks.current} day${streaks.current !== 1 ? 's' : ''}
                          &nbsp;&nbsp;
                          🏆 <strong>Longest streak:</strong> ${streaks.longest} day${streaks.longest !== 1 ? 's' : ''}
                        </p>
                        ${missedDates ? `<p style="margin: 0; font-size: 12px; color: #dc2626;">⚠️ <strong>Missed on:</strong> ${missedDates}</p>` : `<p style="margin: 0; font-size: 12px; color: #059669;">✨ No missed doses in this period!</p>`}
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
    }).join('')

    return patientSection + medBlocks
  }).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medication Adherence Report — RxNudge</title>
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f1f5f9; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Main card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- ── HEADER ───────────────────────────────────────── -->
          <tr>
            <td style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 36px 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Logo wordmark -->
                    <p style="margin: 0 0 20px 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">
                      Rx<span style="color: #99f6e4;">Nudge</span>
                    </p>
                    <h1 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 800; color: white; line-height: 1.2;">
                      Medication Adherence Report
                    </h1>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 0 20px 0 0;">
                          <p style="margin: 0; font-size: 13px; color: #ccfbf1; font-weight: 500;">
                            Report Period
                          </p>
                          <p style="margin: 2px 0 0 0; font-size: 14px; color: white; font-weight: 700;">
                            ${formatDateDisplay(dateFrom)} — ${formatDateDisplay(dateTo)}
                          </p>
                        </td>
                      </tr>
                      <tr><td style="height: 10px;"></td></tr>
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 13px; color: #ccfbf1; font-weight: 500;">Generated</p>
                          <p style="margin: 2px 0 0 0; font-size: 14px; color: white; font-weight: 700;">${generatedDate}</p>
                        </td>
                      </tr>
                      <tr><td style="height: 10px;"></td></tr>
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 13px; color: #ccfbf1; font-weight: 500;">Prepared by</p>
                          <p style="margin: 2px 0 0 0; font-size: 14px; color: white; font-weight: 700;">${requestedBy}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── SUMMARY BOX ──────────────────────────────────── -->
          <tr>
            <td style="padding: 32px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${summaryBg}; border: 2px solid ${summaryBorder}; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width: 130px; text-align: center; border-right: 2px solid ${summaryBorder}; padding-right: 24px;">
                          <span style="display: block; font-size: 56px; font-weight: 900; color: ${summaryColor}; line-height: 1;">${globalPct}%</span>
                          <span style="display: block; font-size: 12px; font-weight: 600; color: ${summaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Overall</span>
                        </td>
                        <td style="padding-left: 24px;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td style="padding-bottom: 8px; padding-right: 12px;">
                                <p style="margin: 0; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Scheduled</p>
                                <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 800; color: #111827;">${globalScheduled}</p>
                              </td>
                              <td style="padding-bottom: 8px; padding-right: 12px;">
                                <p style="margin: 0; font-size: 11px; color: #059669; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">✅ Taken</p>
                                <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 800; color: #059669;">${globalTaken}</p>
                              </td>
                              <td style="padding-bottom: 8px; padding-right: 12px;">
                                <p style="margin: 0; font-size: 11px; color: #0d9488; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📝 Late</p>
                                <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 800; color: #0d9488;">${globalManual}</p>
                              </td>
                              <td style="padding-bottom: 8px; padding-right: 12px;">
                                <p style="margin: 0; font-size: 11px; color: #d97706; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">⏭️ Skipped</p>
                                <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 800; color: #d97706;">${globalSkipped}</p>
                              </td>
                              <td style="padding-bottom: 8px;">
                                <p style="margin: 0; font-size: 11px; color: #dc2626; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">❌ Missed</p>
                                <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: 800; color: #dc2626;">${globalMissed}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── DISCLAIMER ───────────────────────────────────── -->
          <tr>
            <td style="padding: 20px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-left: 3px solid #cbd5e1; border-radius: 0 6px 6px 0;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.6; font-style: italic;">
                      <strong style="font-style: normal; color: #475569;">ℹ️ About this report:</strong> This report was generated by RxNudge, a medication adherence tracking service.
                      It reflects patient self-reported confirmations via phone call or app. This document is intended to support clinical
                      discussions and is not a substitute for medical advice.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MEDICATION SECTIONS ──────────────────────────── -->
          <tr>
            <td style="padding: 28px 40px 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${medSections}
              </table>
            </td>
          </tr>

          <!-- ── LEGEND ───────────────────────────────────────── -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right: 16px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: #d1fae5; vertical-align: middle; margin-right: 4px;"></span>
                    <span style="font-size: 11px; color: #6b7280; vertical-align: middle;">Taken</span>
                  </td>
                  <td style="padding-right: 16px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: #ccfbf1; vertical-align: middle; margin-right: 4px;"></span>
                    <span style="font-size: 11px; color: #6b7280; vertical-align: middle;">Logged late</span>
                  </td>
                  <td style="padding-right: 16px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: #fef3c7; vertical-align: middle; margin-right: 4px;"></span>
                    <span style="font-size: 11px; color: #6b7280; vertical-align: middle;">Skipped</span>
                  </td>
                  <td style="padding-right: 16px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: #fee2e2; vertical-align: middle; margin-right: 4px;"></span>
                    <span style="font-size: 11px; color: #6b7280; vertical-align: middle;">Missed</span>
                  </td>
                  <td>
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: #f3f4f6; border: 1px solid #e5e7eb; vertical-align: middle; margin-right: 4px;"></span>
                    <span style="font-size: 11px; color: #6b7280; vertical-align: middle;">No data</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ───────────────────────────────────────── -->
          <tr>
            <td style="background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #0d9488;">
                      RxNudge <span style="color: #94a3b8; font-weight: 400;">|</span> <a href="https://rxnudge.app" style="color: #0d9488; text-decoration: none;">rxnudge.app</a>
                    </p>
                    <p style="margin: 0 0 4px 0; font-size: 11px; color: #94a3b8;">
                      This report was requested by ${recipientEmail} on ${generatedDate}
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                      To manage report preferences, log in to <a href="https://rxnudge.app/settings" style="color: #0d9488; text-decoration: none;">rxnudge.app/settings</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Main card -->

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const { patientGroups, dateFrom, dateTo, email, requestedBy, pdfOnly } = body

    if (!patientGroups || patientGroups.length === 0) {
      return NextResponse.json({ error: 'No patients/medications selected.' }, { status: 400 })
    }
    if (!email || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    // Fetch all patient + med + log data
    const patients: Array<{
      patient: Patient
      medications: Array<{ med: Medication & { nickname?: string }; logs: DoseLog[] }>
    }> = []

    for (const group of patientGroups) {
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', group.patientId)
        .single() as { data: Patient | null }

      if (!patient) continue

      const medications: Array<{ med: Medication & { nickname?: string }; logs: DoseLog[] }> = []

      for (const medId of group.medicationIds) {
        const { data: med } = await supabase
          .from('medications')
          .select('*')
          .eq('id', medId)
          .single() as { data: (Medication & { nickname?: string }) | null }

        if (!med) continue

        const { data: logs } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('medication_id', medId)
          .eq('patient_id', group.patientId)
          .gte('scheduled_at', dateFrom + 'T00:00:00')
          .lte('scheduled_at', dateTo + 'T23:59:59')
          .order('scheduled_at', { ascending: true }) as { data: DoseLog[] | null }

        medications.push({ med, logs: logs || [] })
      }

      patients.push({ patient, medications })
    }

    if (patients.length === 0) {
      return NextResponse.json({ error: 'No data found for selected patients.' }, { status: 404 })
    }

    // Build HTML report
    const html = buildEmailHTML({
      patients,
      dateFrom,
      dateTo,
      requestedBy,
      recipientEmail: email,
      generatedDate,
    })

    // PDF-only mode: return HTML for browser print-to-PDF
    if (pdfOnly) {
      // Wrap with print-friendly styles
      const printHtml = html.replace(
        '</head>',
        `<style>
          @media print {
            body { background: white !important; }
            @page { margin: 0.5in; size: A4; }
          }
        </style></head>`
      )
      return NextResponse.json({ success: true, html: printHtml })
    }

    // Determine subject
    const patientNames = patients.map(p => p.patient.name).join(', ')
    const subject = `Medication Adherence Report — ${patientNames} (${formatDateDisplay(dateFrom)} to ${formatDateDisplay(dateTo)})`

    // Send via Resend
    const { error: sendError } = await resend.emails.send({
      from: 'RxNudge Reports <onboarding@resend.dev>',
      to: [email],
      subject,
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Report sent to ${email}` })
  } catch (err) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
