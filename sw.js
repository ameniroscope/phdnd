/* PhDnD service worker — makes the site installable and offline-capable.

   Strategy: network-first, falling back to cache. Online visitors always get
   fresh content (the site talks to Firebase and uses versioned assets); once a
   page has been visited its files are cached, so it still opens with no network.

   Deliberately left alone:
   - cross-origin requests (Google Fonts, Firebase) pass straight through, so
     realtime data and web fonts keep working normally;
   - Range requests (audio seeking) pass through untouched, so the podcast
     player still seeks and we never cache multi-megabyte partial responses. */

const CACHE = 'phdnd-v1';

// Core shell seeded at install so the first offline load works. Listed without
// ?v= query strings; the fetch handler matches with ignoreSearch, and the
// static server serves the file regardless of query.
const CORE = [
  './',
  'index.html',
  'session.html',
  'chronicles.html',
  'luna.html',
  'pip.html',
  'manifest.json',
  'css/style.css',
  'js/session.js',
  'js/character.js',
  'js/firebase.js',
  'js/register-sw.js',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/background.jpg',
  'assets/background-mobile.jpg',
  'assets/geof.png',
  'assets/luna.png',
  'assets/pip.png',
  'images/recap.png',
  'images/fullmap.png',
  'images/fullmap_annotated.png',
  'images/objects/1.png',
  'images/objects/2.png',
  'images/objects/3.png',
  'images/objects/4.png',
  'images/objects/5.png',
  'images/objects/6.png',
];

// Add each URL on its own so one missing file can't abort the whole install.
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(CORE.map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Stash a fresh copy of successful, complete responses for offline use.
    if (response && response.ok && response.status === 200) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Last resort for a navigation we've never cached: hand back the shell.
    if (request.mode === 'navigate') {
      const shell = await caches.match('session.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs; let everything else (Firebase, fonts,
  // POSTs, Range/audio requests) go straight to the network.
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
