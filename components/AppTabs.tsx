'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = {
  href: string
  label: string
  icon: string
  match?: (pathname: string) => boolean
}

const tabs: Tab[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: '🏠',
    match: (p) => p === '/dashboard' || p.startsWith('/dashboard/'),
  },
  {
    href: '/patients',
    label: 'Members',
    icon: '👥',
    match: (p) => p === '/patients' || p.startsWith('/patients/'),
  },
  {
    href: '/appointments',
    label: 'Appointments',
    icon: '📅',
    match: (p) => p === '/appointments' || p.startsWith('/appointments/'),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: '🔔',
    match: (p) => p === '/alerts' || p.startsWith('/alerts/'),
  },
]

export default function AppTabs({ className = '' }: { className?: string }) {
  const pathname = usePathname() || ''

  const current = tabs.find(t => (t.match ? t.match(pathname) : pathname === t.href))
  const visible = tabs.filter(t => t !== current)

  return (
    <nav aria-label="App sections" className={`mb-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2">
        {visible.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <span className="text-base" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
