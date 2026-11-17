// Offline cache for qPCR Workbench (Reader and Plate Designer). Bump VERSION on every release so users get the new files.
const VERSION = 'qpcr-workbench-v2.4.0';
const FILES = ['./', './index.html', './designer.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/icon-180.png', './icons/icon-32.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Network first, revalidating with the server (GitHub Pages lets browsers reuse files for 10 minutes otherwise),
// so a new release shows up on the next reload when online; fall back to the cache offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
