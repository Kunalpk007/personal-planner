const CACHE = 'kunals-planner-v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    })
  )
  self.clients.claim()
})

function isSameOrigin(req) {
  const url = new URL(req.url)
  return url.origin === self.location.origin
}

function isNav(req) {
  return req.mode === 'navigate'
}

function isAsset(req) {
  const url = new URL(req.url)
  return /\.(js|css|png|svg|ico|webp|jpg|jpeg|woff2?)$/.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // Never intercept cross-origin requests (e.g. Google APIs for sign-in)
  if (!isSameOrigin(event.request)) {
    event.respondWith(fetch(event.request))
    return
  }

  if (isAsset(event.request)) {
    // Stale-while-revalidate: serve the cached asset immediately for a fast,
    // app-like repeat load, and refresh the cache in the background so the
    // next load picks up changes. Static assets are content-hashed by Next.js
    // build output, so a cached hit is never stale in practice.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        const network = fetch(event.request).then((res) => {
          if (res.status === 200) cache.put(event.request, res.clone())
          return res
        }).catch(() => cached)
        return cached || network
      })
    )
    return
  }

  if (isNav(event.request)) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return res
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  event.respondWith(fetch(event.request))
})