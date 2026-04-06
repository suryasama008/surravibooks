const CACHE_NAME = 'cashbook-v2'
const OFFLINE_URLS = ['/', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

// Push notification handler
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(data.title || '📒 Cash Book Reminder', {
      body: data.body || "Don't forget to record today's transactions!",
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
      actions: [
        { action: 'add-expense', title: '+ Add Expense' },
        { action: 'add-income',  title: '+ Add Income' },
      ],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.action === 'add-expense' ? '/?action=expense'
            : e.action === 'add-income'  ? '/?action=income'
            : e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// Background sync for end-of-day reminder
self.addEventListener('periodicsync', e => {
  if (e.tag === 'daily-reminder') {
    e.waitUntil(checkAndNotify())
  }
})

async function checkAndNotify() {
  const now = new Date()
  const hour = now.getHours()
  if (hour >= 20) { // after 8pm
    self.registration.showNotification('📒 Daily Entry Reminder', {
      body: "Have you recorded all transactions for today?",
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: '/' },
    })
  }
}
