import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RxNudge — Medication Adherence',
  description: 'Track medications and stay on schedule for you or your loved ones.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d9488" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RxNudge" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

      </head>
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-gray-200 bg-white px-6 py-4 text-xs text-gray-500">
            <div className="max-w-5xl mx-auto">
              <span className="font-semibold text-gray-700">RxNudge</span> is a service provided by{' '}
              <span className="font-semibold text-gray-700">Lendpromise</span>.{' '}
              <a href="/terms" className="text-teal-700 hover:underline">Terms</a> •{' '}
              <a href="/privacy" className="text-teal-700 hover:underline">Privacy</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
