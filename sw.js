const CACHE = '2048-v2';
const STATIC = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icon.png',
  './hero.jpg',
  './vp.jpg',
  './president.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase / CDN 요청은 항상 네트워크 사용
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
