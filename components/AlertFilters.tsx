'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export type AlertFilter = 'all' | 'missed' | 'calls' | 'appointments' | 'account' | 'delivery'

const FILTERS: { id: AlertFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '🔔' },
  { id: 'missed', label: 'Missed Doses', emoji: '⚠️' },
  { id: 'calls', label: 'Calls', emoji: '📞' },
  { id: 'appointments', label: 'Appointments', emoji: '📅' },
  { id: 'account', label: 'Account', emoji: '⚙️' },
  { id: 'delivery', label: 'Delivery', emoji: '📨' },
]

interface AlertFiltersProps {
  activeFilter: AlertFilter
}

export default function AlertFilters({ activeFilter }: AlertFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setFilter(filter: AlertFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', filter)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {FILTERS.map(f => (
        <button
          key={f.id}
          onClick={() => setFilter(f.id)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            activeFilter === f.id
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700'
          }`}
        >
          <span>{f.emoji}</span>
          <span>{f.label}</span>
        </button>
      ))}
    </div>
  )
}
