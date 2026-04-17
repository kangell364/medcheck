'use client'

import { useMemo } from 'react'
import type { Medication, DoseLog } from '@/lib/types'

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

function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

function monthKeyToDate(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1)
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(key: string, delta: number): string {
  const d = monthKeyToDate(key)
  d.setMonth(d.getMonth() + delta)
  return monthKey(d)
}

function clampMonth(key: string, minKey: string, maxKey: string): string {
  if (key < minKey) return minKey
  if (key > maxKey) return maxKey
  return key
}

export default function PatientHistoryCalendar({
  timezone,
  start,
  end,
  visibleMonth,
  setVisibleMonth,
  medications,
  slotMap,
}: {
  timezone: string
  start: Date
  end: Date
  visibleMonth: string
  setVisibleMonth: (m: string) => void
  medications: Medication[]
  doseLogs: DoseLog[]
  slotMap: Record<string, Record<string, Record<string, DoseLog>>>
}) {
  const minMonth = monthKey(start)
  const maxMonth = monthKey(end)

  const monthStart = useMemo(() => monthKeyToDate(clampMonth(visibleMonth, minMonth, maxMonth)), [visibleMonth, minMonth, maxMonth])

  const weeks = useMemo(() => {
    const first = new Date(monthStart)
    first.setDate(1)
    const last = new Date(monthStart)
    last.setMonth(last.getMonth() + 1)
    last.setDate(0) // last day of month

    // start on Sunday
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - first.getDay())

    // end on Saturday
    const gridEnd = new Date(last)
    gridEnd.setDate(last.getDate() + (6 - last.getDay()))

    const out: Date[][] = []
    const cur = new Date(gridStart)
    while (cur <= gridEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      out.push(week)
    }
    return out
  }, [monthStart])

  const startStr = dateStrInTz(start, timezone)
  const endStr = dateStrInTz(end, timezone)

  function dayInRange(day: Date): boolean {
    const ds = dateStrInTz(day, timezone)
    return ds >= startStr && ds <= endStr
  }

  function buildDayLines(day: Date): { text: string; kind: 'taken' | 'missed' | 'pending' }[] {
    const dateStr = dateStrInTz(day, timezone)
    const lines: { text: string; kind: 'taken' | 'missed' | 'pending' }[] = []

    for (const med of medications) {
      const times = med.reminder_times?.length ? med.reminder_times : ['00:00']
      for (const rt of times) {
        const log = slotMap?.[med.id]?.[rt]?.[dateStr]
        if (!log) continue

        if (log.confirmed === true) {
          lines.push({ text: `${med.name} — ${formatTime(rt)}`, kind: 'taken' })
        } else if (log.confirmed === false) {
          lines.push({ text: `${med.name} — missed`, kind: 'missed' })
        } else {
          lines.push({ text: `${med.name} — ${formatTime(rt)}`, kind: 'pending' })
        }
      }
    }

    // Keep cell readable
    return lines.slice(0, 3)
  }

  const title = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const canPrev = visibleMonth > minMonth
  const canNext = visibleMonth < maxMonth

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setVisibleMonth(clampMonth(addMonths(visibleMonth, -1), minMonth, maxMonth))}
          className={`px-3 py-2 rounded-xl border text-sm ${canPrev ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-300'}`}
        >
          ←
        </button>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setVisibleMonth(clampMonth(addMonths(visibleMonth, 1), minMonth, maxMonth))}
          className={`px-3 py-2 rounded-xl border text-sm ${canNext ? 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700' : 'bg-gray-50 border-gray-100 text-gray-300'}`}
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-600 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day, idx) => {
          const inMonth = day.getMonth() === monthStart.getMonth()
          const inRange = dayInRange(day)
          const dateStr = dateStrInTz(day, timezone)
          const lines = inRange ? buildDayLines(day) : []

          return (
            <div
              key={`${idx}-${dateStr}`}
              className={`min-h-[110px] md:min-h-[140px] rounded-none border p-2 ${
                !inMonth ? 'bg-gray-50 border-gray-200 text-gray-300' : !inRange ? 'bg-white border-gray-200 opacity-60' : 'bg-white border-gray-300'
              }`}
            >
              <div className="text-[12px] font-semibold text-gray-700">{day.getDate()}</div>

              <div className="mt-1 space-y-1">
                {lines.map((l, i) => (
                  <div
                    key={i}
                    className={`text-[10px] leading-tight ${
                      l.kind === 'taken' ? 'text-gray-900' : l.kind === 'missed' ? 'text-gray-900' : 'text-gray-500'
                    }`}
                    title={l.text}
                  >
                    {l.text}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
