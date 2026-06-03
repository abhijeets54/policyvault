const CACHE_NAME = 'policyvault-v2'
const STATIC_ASSETS = ['/manifest.json', '/icon-192x192.png', '/icon-512x512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-same-origin requests entirely (Supabase, Google APIs, Groq, etc.).
  // When event.respondWith() is NOT called the browser handles the request
  // normally — no SW interception, no cache-first, no CSP collision.
  // This was the root cause of the "Failed to fetch" on login: the SW was
  // catching the auth/v1/token request and calling fetch() through its own
  // cache-first path, which the page's CSP then blocked at sw.js:46.
  if (url.origin !== self.location.origin) {
    return
  }

  // Network-first for Next.js API routes (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Network-first for HTML navigation (always serve fresh pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  // Cache-first for same-origin static assets (JS, CSS, icons, fonts)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  )
})