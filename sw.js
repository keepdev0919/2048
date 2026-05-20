const CACHE = '2048-v8';
const STATIC = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icon.png',
  './images/human-1.jpg',
  './images/human-2.jpg',
  './images/human-3.jpg',
  './images/human-4.jpg',
  './images/human-5.jpg',
  './images/human-6.jpg',
  './images/human-7.jpg',
  './images/human-8.jpg',
  './images/human-9.jpg',
  './images/human-10.jpg',
  './images/human-11.jpg',
  './images/human-12.jpg',
  './images/oni-1.png',
  './images/oni-2.webp',
  './images/oni-3.jpg',
  './images/oni-4.jpg',
  './images/oni-5.jpg',
  './images/oni-6.jpg',
  './images/oni-7.jpg',
  './images/oni-8.png',
  './images/oni-9.jpg',
  './images/oni-10.jpg',
  './images/oni-11.jpg',
  './images/oni-12.jpg',
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
