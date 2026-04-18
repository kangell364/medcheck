import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppTabs from '@/components/AppTabs'

function formatAppointmentDate(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr}`)
  const date = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  let hours = dt.getHours()
  const minutes = dt.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  const minStr = minutes === 0 ? '00' : minutes.toString().padStart(2, '0')
  const time = `${hours}:${minStr} ${ampm}`
  return `${date} at ${time}`
}

const statusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: 'Upcoming', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  missed: { label: 'Missed', class: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-600 border-gray-200' },
}

import { redirect } from 'next/navigation'

export default async function AppointmentsPage() {
  // Global appointments view removed — appointments live under each member only.
  // Keep this page as a simple redirect to avoid build/typecheck errors.
  redirect('/patients')
}
