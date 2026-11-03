// Service worker mínimo: permite instalar la app y abrirla sin red mostrando la última versión.
// La API (/api, /socket.io) nunca se cachea: los pedidos siempre vienen del server.
const CACHE = 'fino-comandas-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return
  // Red primero; si no hay conexión, lo último guardado.
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  )
})
