'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Members', icon: '👤' },
  { href: '/appointments', label: 'Appointments', icon: '📆' },
  { href: '/history', label: 'History', icon: '📅' },
  { href: '/alerts', label: 'Alerts', icon: '🔔' },
  { href: '/affiliate', label: 'Affiliate', icon: '🤝' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex-col z-10">
        <div className="p-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💊</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-none">RxNudge</h1>
              <p className="text-xs text-gray-400">Medication Tracker</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="text-lg">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-10 flex">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'text-teal-600'
                : 'text-gray-500'
            }`}
          >
            <span className="text-2xl mb-0.5">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
