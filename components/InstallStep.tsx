'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Props {
  onDone: () => void
}

export default function InstallStep({ onDone }: Props) {
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  const [isChrome, setIsChrome] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as typeof window & { MSStream?: unknown }).MSStream
    const android = /android/i.test(ua)
    const chrome = /chrome/i.test(ua) && !/edg/i.test(ua)

    setIsIOS(!!ios)
    setIsAndroid(!!android)
    setIsChrome(!!chrome)
    setCurrentUrl(window.location.href)

    // Listen for beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        localStorage.setItem('rxnudge_install_dismissed', '1')
        onDone()
        return
      }
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
    // If dismissed, just stay on screen so they can tap "later"
  }

  const handleLater = () => {
    localStorage.setItem('rxnudge_install_dismissed', '1')
    onDone()
  }

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-start px-5 py-10">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💊</div>
          <h1 className="text-4xl font-bold text-teal-800">RxNudge</h1>
        </div>

        {/* Hero card */}
        <div className="bg-white rounded-3xl shadow-sm border border-teal-100 p-8 mb-6 text-center">
          <div className="text-6xl mb-5">📱</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
            Add RxNudge to your home screen!
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Get medication reminders even when your phone is locked 🔒
          </p>
        </div>

        {/* iOS instructions */}
        {isIOS && (
          <div className="bg-white rounded-3xl shadow-sm border border-teal-100 p-7 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-5">
              iPhone instructions:
            </h3>
            <ol className="space-y-4">
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-xl font-bold">1</span>
                <span className="text-xl text-gray-700 leading-snug pt-1">
                  Tap the <strong>Share button</strong> 📤<br />
                  <span className="text-gray-500 text-lg">(at the bottom of Safari)</span>
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-xl font-bold">2</span>
                <span className="text-xl text-gray-700 leading-snug pt-1">
                  Scroll down and tap<br />
                  <strong>&ldquo;Add to Home Screen&rdquo;</strong> 📲
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-xl font-bold">3</span>
                <span className="text-xl text-gray-700 leading-snug pt-1">
                  Tap <strong>&ldquo;Add&rdquo;</strong> in the top right
                </span>
              </li>
            </ol>

            <button
              onClick={onDone}
              className="w-full mt-7 py-5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl text-2xl font-bold transition-colors shadow-md"
            >
              Got it! ✅
            </button>
          </div>
        )}

        {/* Android install button */}
        {isAndroid && (
          <div className="mb-6">
            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl text-2xl font-bold transition-colors shadow-md flex items-center justify-center gap-3"
              >
                {installing ? <>⏳ Installing…</> : <>➕ Add to Home Screen</>}
              </button>
            ) : !isChrome ? (
              <div className="bg-white rounded-3xl border border-teal-100 p-7 text-center">
                <div className="text-5xl mb-4">🌐</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Open in Chrome</h3>
                <p className="text-xl text-gray-600 leading-relaxed mb-6">
                  To add RxNudge to your home screen, you need to open this page in <strong>Chrome</strong>.
                </p>
                <a
                  href={`intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`}
                  className="block w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-2xl font-bold transition-colors shadow-md text-center"
                >
                  🌐 Open in Chrome
                </a>
                <p className="text-gray-400 text-base mt-4">
                  Don&apos;t have Chrome?{' '}
                  <a href="https://play.google.com/store/apps/details?id=com.android.chrome" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">
                    Download it free
                  </a>
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-teal-100 p-6 text-center">
                <p className="text-xl text-gray-600 leading-relaxed">
                  Tap the menu <strong>(⋮)</strong> at the top right,<br />
                  then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Non-iOS, non-Android fallback (desktop or unknown) */}
        {!isIOS && !isAndroid && (
          <div className="bg-white rounded-3xl border border-teal-100 p-6 text-center mb-6">
            <p className="text-xl text-gray-600 leading-relaxed">
              Open this page on your phone to add it to your home screen for quick access.
            </p>
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full mt-5 py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-2xl font-bold transition-colors shadow-md"
              >
                {installing ? '⏳ Installing…' : '➕ Add to Home Screen'}
              </button>
            )}
          </div>
        )}

        {/* Divider + skip link */}
        <div className="border-t border-gray-200 pt-6 text-center">
          <button
            onClick={handleLater}
            className="text-gray-400 hover:text-gray-600 text-xl underline transition-colors py-2 px-4"
          >
            I&apos;ll do it later →
          </button>
        </div>

      </div>
    </div>
  )
}
