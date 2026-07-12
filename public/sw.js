const CACHE = 'kunals-planner-v2'

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
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return res
      }).catch(() => caches.match(event.request))
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