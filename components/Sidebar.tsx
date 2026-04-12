'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'

const BASE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/patients', label: 'Members', icon: '👤' },
  { href: '/appointments', label: 'Appointments', icon: '📆' },
  { href: '/history', label: 'History', icon: '📅' },
  { href: '/alerts', label: 'Alerts', icon: '🔔', hasAlertBadge: true },
  { href: '/affiliate', label: 'Affiliate', icon: '🤝' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [unreadCount, setUnreadCount] = useState(0)
  const [flashBadge, setFlashBadge] = useState(false)
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null)
  const prevCountRef = useRef(0)

  // Fetch initial unread alert count
  useEffect(() => {
    let cancelled = false

    async function fetchUnread() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // Get owner's patient IDs
      const { data: patients } = await supabase
        .from('patients')
        .select('id')
        .eq('owner_id', user.id)

      const patientIds = (patients || []).map((p: any) => p.id)
      if (patientIds.length === 0) return

      // Count alerts from the last 7 days that are "active" (pending requests + unread)
      // We treat all alerts in the last 24h as "unread" for badge purposes
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('alert_log')
        .select('id', { count: 'exact', head: true })
        .in('patient_id', patientIds)
        .gte('sent_at', since)

      if (!cancelled) {
        setUnreadCount(count || 0)
        prevCountRef.current = count || 0
      }
    }

    fetchUnread()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime subscription for new alerts — flash badge when new alert arrives
  useEffect(() => {
    let patientIds: string[] = []
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: patients } = await supabase
        .from('patients')
        .select('id')
        .eq('owner_id', user.id)

      patientIds = (patients || []).map((p: any) => p.id)
      if (patientIds.length === 0) return

      channel = supabase
        .channel('alert-badge')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alert_log',
          },
          (payload: any) => {
            // Only care about alerts for our patients
            if (!patientIds.includes(payload.new?.patient_id)) return

            setUnreadCount(prev => {
              const next = prev + 1
              prevCountRef.current = next
              return next
            })

            // Flash badge for 3 seconds
            setFlashBadge(true)
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
            flashTimerRef.current = setTimeout(() => setFlashBadge(false), 3000)
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset badge count when user visits alerts page
  useEffect(() => {
    if (pathname === '/alerts') {
      setUnreadCount(0)
      setFlashBadge(false)
    }
  }, [pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function AlertBadge({ className = '' }: { className?: string }) {
    if (unreadCount === 0) return null
    return (
      <span
        className={`
          inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
          text-xs font-bold text-white bg-red-500 rounded-full
          ${flashBadge ? 'animate-pulse ring-2 ring-red-300' : ''}
          ${className}
        `}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )
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
          {BASE_NAV_ITEMS.map(item => (
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
              <span className="flex-1">{item.label}</span>
              {item.hasAlertBadge && <AlertBadge />}
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
        {BASE_NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors relative ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'text-teal-600'
                : 'text-gray-500'
            }`}
          >
            <span className="relative text-2xl mb-0.5">
              {item.icon}
              {item.hasAlertBadge && unreadCount > 0 && (
                <span
                  className={`
                    absolute -top-1 -right-1 inline-flex items-center justify-center
                    min-w-[1rem] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full
                    ${flashBadge ? 'animate-pulse' : ''}
                  `}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
