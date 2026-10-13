const CACHE_NAME = 'paqueteria-v6';

// Lista de archivos locales estrictamente necesarios para que la app funcione offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/auth.js',
  './js/db.js',
  './js/api.js',
  './js/sync.js',
  './js/scanner.js',
  './js/print.js',
  './js/reports.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usamos un ciclo o carga individual para evitar que un fallo crítico bloquee todo
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) {
          return caches.delete(k);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Si está en caché, lo devuelve; si no, va a la red y opcionalmente lo almacena
      return cached || fetch(e.request).then(response => {
        // Opcional: clonar y guardar dinámicamente recursos externos si se desea
        return response;
      }).catch(() => {
        // Aquí puedes retornar una página de respaldo offline si lo requieres
      });
    })
  );
});
