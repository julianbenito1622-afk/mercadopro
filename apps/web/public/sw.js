// Versión inyectada en build por Vite (vite.config.ts → generateBundle).
// En desarrollo se usa 'dev'. En producción se reemplaza con el hash del build.
const APP_VERSION = self.__APP_VERSION__ ?? 'dev'
const CACHE_NAME = `mercadopro-${APP_VERSION}`

// Assets críticos para que la app cargue offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

// ── Install: pre-cachear shell HTML ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: limpiar caches de versiones anteriores ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('mercadopro-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Eliminando cache viejo:', k)
            return caches.delete(k)
          })
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo interceptar requests del mismo origen
  if (url.origin !== self.location.origin) return

  // Network-first para llamadas a la API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // Cache-first para todo lo demás (JS, CSS, WASM, SVG, etc.)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached

      return fetch(request).then(response => {
        // Solo cachear respuestas GET exitosas
        if (response.ok && request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
