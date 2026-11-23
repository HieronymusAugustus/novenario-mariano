const CACHE_NAME = 'novenario-mariano-v1.0.0';
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./data/novenas.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/images/brasao_congregacao.png",
  "./assets/images/novena_01_purificacao.jpg",
  "./assets/images/novena_02_lourdes.jpg",
  "./assets/images/novena_03_anunciacao.jpg",
  "./assets/images/novena_04_bom_conselho.jpg",
  "./assets/images/novena_05_dores.jpg",
  "./assets/images/novena_06_rainha.jpg",
  "./assets/images/novena_07_visitacao.jpg",
  "./assets/images/novena_08_carmo.jpg",
  "./assets/images/novena_09_assuncao.jpg",
  "./assets/images/novena_10_natividade.jpg",
  "./assets/images/novena_11_medianeira.jpg",
  "./assets/images/novena_12_aparecida.jpg",
  "./assets/images/novena_13_apresentacao.jpg",
  "./assets/images/novena_14_imaculada.jpg",
  "./assets/images/novena_15_salette.svg"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
