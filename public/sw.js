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
  const style = d.style || 'normal'
  const escalationId = d.escalationId || null

  let notifOptions = {
    body: d.body || 'Time for your medications!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: d,
    actions: [
      { action: 'took', title: '✅ I took them' },
      { action: 'snooze', title: '⏰ Snooze 30 min' },
    ],
  }

  if (style === 'silent') {
    // Silent notification — no sound, no vibration
    notifOptions = {
      ...notifOptions,
      silent: true,
      vibrate: [],
    }
  } else if (style === 'alarm') {
    // Alarm mode — show notification then open full-screen alarm page
    notifOptions = {
      ...notifOptions,
      requireInteraction: true,
    }
  }

  e.waitUntil(
    self.registration
      .showNotification(d.title || 'RxNudge 💊', notifOptions)
      .then(() => {
        if (style === 'alarm' && escalationId) {
          // Open the alarm page so it can play sound on loop
          return clients.openWindow(`/alarm?escalationId=${escalationId}`)
        }
      })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const d = e.notification.data || {}
  const style = d.style || 'normal'
  const escalationId = d.escalationId

  if (e.action === 'took' && escalationId) {
    e.waitUntil(
      fetch('/api/reminders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalationId }),
      })
    )
  }

  if (style === 'alarm' && escalationId) {
    e.waitUntil(clients.openWindow(`/alarm?escalationId=${escalationId}`))
    return
  }

  e.waitUntil(
    clients.openWindow(e.action === 'snooze' ? '/my-meds?snooze=1' : '/my-meds')
  )
})
