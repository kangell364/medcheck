'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Don't show on /p/[token] pages — those have a full-screen install step
    if (pathname?.startsWith('/p/')) return

    // Don't show if already running as standalone (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Don't show if already dismissed
    if (localStorage.getItem('rxnudge_install_dismissed') === '1') return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as typeof window & { MSStream?: unknown }).MSStream

    if (ios) {
      setIsIOS(true)
      setShowBanner(true)
      return
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('rxnudge_install_dismissed', '1')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-white border border-teal-200 rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">📲</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Add RxNudge to your home screen</p>
            <p className="text-gray-500 text-xs mt-0.5">Get reminders even when the app is closed</p>
            {isIOS && (
              <p className="text-teal-700 text-xs mt-1">
                Tap <strong>Share</strong> then <strong>&ldquo;Add to Home Screen&rdquo;</strong>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
            >
              Add to Home Screen
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`${isIOS ? 'flex-1' : ''} bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors`}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}
