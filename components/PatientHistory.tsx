'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Medication, DoseLog } from '@/lib/types'
import PatientHistoryCalendar from '@/components/PatientHistoryCalendar'


// ─── Types ───────────────────────────────────────────────────────────────────

interface PatientHistoryProps {
  patientId: string
  patientName: string
  patientTimezone: string
}

type DateRangeOption = '30d' | '60d' | 'custom'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

function scheduledTimeInTz(scheduledAt: string, timezone: string): string {
  try {
    const date = new Date(scheduledAt)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const h = parts.find(p => p.type === 'hour')?.value ?? '00'
    const m = parts.find(p => p.type === 'minute')?.value ?? '00'
    const normalizedH = h === '24' ? '00' : h
    return `${normalizedH}:${m}`
  } catch {
    const d = new Date(scheduledAt)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }
}

function dateStrInTz(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const y = parts.find(p => p.type === 'year')?.value ?? '2000'
    const mo = parts.find(p => p.type === 'month')?.value ?? '01'
    const d = parts.find(p => p.type === 'day')?.value ?? '01'
    return `${y}-${mo}-${d}`
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function scheduledDateInTz(scheduledAt: string, timezone: string): string {
  return dateStrInTz(new Date(scheduledAt), timezone)
}

function getDateRange(
  range: DateRangeOption,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  let start = new Date()

  if (range === '30d') start.setDate(start.getDate() - 29)
  else if (range === '60d') start.setDate(start.getDate() - 59)
  else if (range === 'custom' && customStart && customEnd) {
    return {
      start: new Date(customStart),
      end: new Date(customEnd + 'T23:59:59'),
    }
  }

  start.setHours(0, 0, 0, 0)
  return { start, end }
}

function getRangeLabel(range: DateRangeOption): string {
  if (range === '30d') return 'Last 30 days — per medication breakdown'
  if (range === '60d') return 'Last 60 days — per medication breakdown'
  return 'Custom date range — per medication breakdown'
}

// Build array of dates (midnight each day) from start to end
function buildDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cur <= endDay) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// Today's date string in local env — used to highlight "today"
function todayLocalStr(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientHistory({
  patientId,
  patientName,
  patientTimezone,
}: PatientHistoryProps) {
  const timezone = patientTimezone || 'America/Chicago'

  const [dateRange, setDateRange] = useState<DateRangeOption>('30d')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [medications, setMedications] = useState<Medication[]>([])
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)

    // For custom range with incomplete dates, skip fetch
    if (dateRange === 'custom' && (!customStart || !customEnd)) {
      setLoading(false)
      return
    }

    const { start, end } = getDateRange(dateRange, customStart, customEnd)
    const supabase = createClient()

    const [{ data: meds }, { data: logs }] = await Promise.all([
      supabase.from('medications').select('*').eq('patient_id', patientId),
      supabase
        .from('dose_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString()),
    ])

    const allLogs = logs || []
    const loggedMedIds = new Set(allLogs.map((l: DoseLog) => l.medication_id))
    const filteredMeds = (meds || []).filter(
      (med: Medication) => med.active || loggedMedIds.has(med.id)
    )

    setMedications(filteredMeds)
    setDoseLogs(allLogs)
    setLoading(false)
  }, [patientId, dateRange, customStart, customEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Derived data ─────────────────────────────────────────────────────────

  const { start, end } =
    dateRange === 'custom' && customStart && customEnd
      ? getDateRange(dateRange, customStart, customEnd)
      : getDateRange(dateRange)

  const days = buildDaysArray(start, end)
  const dayDateStrs = days.map(d => dateStrInTz(d, timezone))
  const todayStr = todayLocalStr()

  // Calendar month paging (month view)
  function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const [visibleMonth, setVisibleMonth] = useState<string>(() => monthKey(end))

  // Keep visible month within the selected range
  useEffect(() => {
    const endKey = monthKey(end)
    if (visibleMonth > endKey) setVisibleMonth(endKey)
  }, [end, visibleMonth])

  // Build slot map: slotMap[medId][reminderTime][dateStr] = DoseLog
  const slotMap: Record<string, Record<string, Record<string, DoseLog>>> = {}
  for (const med of medications) {
    slotMap[med.id] = {}
    for (const rt of med.reminder_times) {
      slotMap[med.id][rt] = {}
    }
  }
  for (const log of doseLogs) {
    const medId = log.medication_id
    if (!slotMap[medId]) continue
    const logTime = scheduledTimeInTz(log.scheduled_at, timezone)
    const logDate = scheduledDateInTz(log.scheduled_at, timezone)
    const med = medications.find(m => m.id === medId)
    if (!med) continue

    let matchedTime: string | null = null
    if (slotMap[medId][logTime]) {
      matchedTime = logTime
    } else {
      const [lh, lm] = logTime.split(':').map(Number)
      const logMins = lh * 60 + lm
      let minDiff = Infinity
      for (const rt of med.reminder_times) {
        const [rh, rm] = rt.split(':').map(Number)
        const diff = Math.abs(logMins - (rh * 60 + rm))
        if (diff < minDiff) {
          minDiff = diff
          matchedTime = rt
        }
      }
    }

    if (matchedTime && slotMap[medId][matchedTime]) {
      const existing = slotMap[medId][matchedTime][logDate]
      if (!existing || (existing.confirmed === null && log.confirmed !== null)) {
        slotMap[medId][matchedTime][logDate] = log
      }
    }
  }

  // Count days in the range that are >= a given start_date string (YYYY-MM-DD)
  function getDaysFromStartDate(med: Medication): number {
    const sd = med.start_date as string | null
    if (!sd) return days.length
    return dayDateStrs.filter(dateStr => dateStr >= sd).length
  }

  // Overall adherence stats — only counting days from each med's start_date onward
  const totalSlots = medications.reduce(
    (sum, med) => sum + (med.reminder_times.length || 1) * getDaysFromStartDate(med),
    0
  )
  const totalConfirmed = doseLogs.filter(l => {
    if (l.confirmed !== true) return false
    const med = medications.find(m => m.id === l.medication_id)
    if (!med) return false
    const sd = med.start_date as string | null
    if (!sd) return true
    return scheduledDateInTz(l.scheduled_at, timezone) >= sd
  }).length
  const overallPct = totalSlots > 0 ? Math.round((totalConfirmed / totalSlots) * 100) : 0

  // ─── UI ───────────────────────────────────────────────────────────────────

  const rangeButtons: { key: DateRangeOption; label: string }[] = [
    { key: '30d', label: '30 Days' },
    { key: '60d', label: '60 Days' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Adherence History</h2>
          <p className="text-sm text-gray-500 mt-0.5">{getRangeLabel(dateRange)}</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <div className="text-right">
              <span
                className={`text-2xl font-bold ${
                  overallPct >= 80
                    ? 'text-teal-600'
                    : overallPct >= 50
                    ? 'text-amber-500'
                    : 'text-red-500'
                }`}
              >
                {overallPct}%
              </span>
              <p className="text-xs text-gray-400">overall</p>
            </div>
          )}

        </div>
      </div>

      {/* Date range toggle */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {rangeButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setDateRange(btn.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              dateRange === btn.key
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      {dateRange === 'custom' && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-gray-400 text-sm">📅</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400 font-medium">From</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              />
            </div>
            <span className="text-gray-400 text-sm mt-4">→</span>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-400 font-medium">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-8 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          Loading history...
        </div>
      )}

      {/* Custom range — waiting for dates */}
      {!loading && dateRange === 'custom' && (!customStart || !customEnd) && (
        <div className="py-8 text-center text-gray-400 text-sm">
          Select a start and end date above to view history.
        </div>
      )}

      {/* Empty state */}
      {!loading && medications.length === 0 && !(dateRange === 'custom' && (!customStart || !customEnd)) && (
        <div className="py-8 text-center text-gray-400 text-sm">
          No medication history for this period.
        </div>
      )}

      {/* Calendar month view */}
      {!loading && medications.length > 0 && (
        dateRange === '60d' ? (
          <div className="space-y-4">
            <PatientHistoryCalendar
              timezone={timezone}
              start={start}
              end={end}
              visibleMonth={visibleMonth}
              setVisibleMonth={setVisibleMonth}
              medications={medications}
              doseLogs={doseLogs}
              slotMap={slotMap}
            />
            <PatientHistoryCalendar
              timezone={timezone}
              start={start}
              end={end}
              visibleMonth={(() => {
                const [y, m] = visibleMonth.split('-').map(Number)
                const d = new Date(y, (m || 1) - 1, 1)
                d.setMonth(d.getMonth() + 1)
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              })()}
              setVisibleMonth={setVisibleMonth}
              medications={medications}
              doseLogs={doseLogs}
              slotMap={slotMap}
            />
          </div>
        ) : (
          <PatientHistoryCalendar
            timezone={timezone}
            start={start}
            end={end}
            visibleMonth={visibleMonth}
            setVisibleMonth={setVisibleMonth}
            medications={medications}
            doseLogs={doseLogs}
            slotMap={slotMap}
          />
        )
      )}
    </div>
  )
}
