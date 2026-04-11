/**
 * Shared helpers for the reminder escalation engine.
 * SMS formatting, time utilities, med list builders.
 */

export type EscalationStatus = 'pending' | 'confirmed' | 'declined' | 'missed' | 'snoozed'

export interface MedForSms {
  id?: string
  name: string
  nickname: string | null | undefined
  dosage: string | null | undefined
  reminder_times?: string[] // HH:MM strings
}

/**
 * Escalation steps:
 * 1 = SMS #1 sent (waiting for YES)
 * 2 = SMS #2 sent (waiting for YES)
 * 3 = AI call placed (waiting for outcome)
 * 4 = Post-snooze SMS sent (waiting for YES)
 * 5 = Final SMS sent (waiting for YES)
 * 6 = MISSED — caregiver alert sent
 */
export const ESCALATION_STEPS = {
  SMS1: 1,
  SMS2: 2,
  CALL: 3,
  POST_SNOOZE_SMS: 4,
  FINAL_SMS: 5,
  MISSED: 6,
} as const

/** How many minutes to wait at each step before advancing */
export const STEP_WAIT_MINUTES: Record<number, number> = {
  1: 30, // wait 30 min after SMS1 before SMS2
  2: 30, // wait 30 min after SMS2 before call
  3: 5,  // wait 5 min after call attempt before checking call outcome
  4: 30, // wait 30 min after post-snooze SMS before final SMS
  5: 30, // wait 30 min after final SMS before marking missed
}

// ─── Time-of-day helpers ──────────────────────────────────────────────────────

/** 
 * Classify a HH:MM time string into a time-of-day label.
 * Morning: 04:00–11:59, Afternoon: 12:00–16:59, Evening: 17:00–03:59
 */
export function classifyTimeOfDay(hhmm: string): 'morning' | 'afternoon' | 'evening' {
  const [h] = hhmm.split(':').map(Number)
  if (h >= 4 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  return 'evening'
}

/**
 * Determine the current time-of-day in the patient's timezone.
 */
export function currentTimeOfDay(timezone: string): 'morning' | 'afternoon' | 'evening' {
  const h = parseInt(
    new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }),
    10
  )
  if (h >= 4 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  return 'evening'
}

/** Capitalise first letter */
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ─── SMS body builders ────────────────────────────────────────────────────────

/**
 * Build a bulleted medication list for use in SMS bodies.
 * Format: • Lisinopril 10mg (Blue Pill)
 */
function buildBulletList(meds: MedForSms[]): string {
  return meds
    .map(m => {
      const base = m.name + (m.dosage ? ` ${m.dosage}` : '')
      const nick = m.nickname ? ` (${m.nickname})` : ''
      return `• ${base}${nick}`
    })
    .join('\n')
}

/**
 * Group medications by time-of-day based on their reminder_times.
 * A med with multiple reminder times is included in all matching groups.
 * Falls back to 'morning' if reminder_times is empty.
 */
export function groupMedsByTimeOfDay(
  meds: MedForSms[],
  targetTod: 'morning' | 'afternoon' | 'evening'
): MedForSms[] {
  return meds.filter(m => {
    if (!m.reminder_times || m.reminder_times.length === 0) {
      return targetTod === 'morning'
    }
    return m.reminder_times.some(t => classifyTimeOfDay(t) === targetTod)
  })
}

export interface SmsTexts {
  sms1: string
  sms2: string
  postSnoozeSms: string
  finalSms: string
  confirmedReply: string
  noReply: string
}

/**
 * Build all SMS variants for a given patient + medication group.
 * @param firstName  Patient's first name
 * @param meds       Medications for this reminder slot
 * @param tod        Time-of-day label
 * @param caregiverName  Name of the caregiver (for final SMS warning)
 */
export function buildEscalationSmsTexts(
  firstName: string,
  meds: MedForSms[],
  tod: 'morning' | 'afternoon' | 'evening',
  caregiverName: string
): SmsTexts {
  const todLabel = cap(tod)
  const bullets = buildBulletList(meds)

  const sms1 =
    `💊 Good morning ${firstName}! Did you take your ${tod} medications?\n\n` +
    `${bullets}\n\n` +
    `Reply YES when done or NO if you haven't. Reply STOP to opt out.`

  const sms2 =
    `⏰ Reminder: Don't forget your ${tod} medications, ${firstName}!\n\n` +
    `${bullets}\n\n` +
    `Reply YES when taken.`

  const postSnoozeSms =
    `No problem! We'll check back in a bit. 💊\n\n` +
    `${bullets}`

  const finalSms =
    `Last chance reminder for your ${tod} medications, ${firstName}.\n\n` +
    `${bullets}\n\n` +
    `Reply YES or we'll let ${caregiverName} know. 💊`

  const confirmedReply =
    `✅ ${todLabel} medications marked as taken. Have a wonderful day, ${firstName}!`

  const noReply =
    `No problem! We'll check back in a bit. 💊`

  return { sms1, sms2, postSnoozeSms, finalSms, confirmedReply, noReply }
}

// ─── Voice call helpers ───────────────────────────────────────────────────────

/**
 * Build a natural verbal list of medication names for AI voice calls.
 * Uses nickname if set, otherwise the official name. Does NOT include dosage.
 * Result: "your Lisinopril, Metformin, and Aspirin"
 */
export function buildVoiceMedList(meds: MedForSms[]): string {
  const names = meds.map(m => m.nickname || m.name)
  if (names.length === 0) return 'your medications'
  if (names.length === 1) return `your ${names[0]}`
  if (names.length === 2) return `your ${names[0]} and ${names[1]}`
  return `your ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

// ─── Quiet hours / timezone helpers ──────────────────────────────────────────

/** Returns true if it's between 9PM–8AM in the given timezone */
export function isQuietHours(timezone: string): boolean {
  const h = parseInt(
    new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }),
    10
  )
  return h >= 21 || h < 8
}

/** Get today's date in YYYY-MM-DD for a given timezone */
export function getTodayInTimezone(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone })
}
