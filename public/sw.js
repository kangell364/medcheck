const CACHE = 'rxnudge-v1'

self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('<h1>RxNudge</h1><p>Please connect to internet</p>', {
          headers: { 'Content-Type': 'text/html' },
        })
      )
    )
  }
})

self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'RxNudge 💊', {
      body: d.body || 'Time for your medications!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: d,
      actions: [
        { action: 'took', title: '✅ I took them' },
        { action: 'snooze', title: '⏰ Snooze 30 min' },
      ],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'took' && e.notification.data?.escalationId) {
    e.waitUntil(
      fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId: e.notification.data.escalationId }),
      })
    )
  }
  e.waitUntil(
    clients.openWindow(e.action === 'snooze' ? '/my-meds?snooze=1' : '/my-meds')
  )
})
