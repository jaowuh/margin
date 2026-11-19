/* Margin service worker — makes the app work offline.
   The version and file list below are filled in at build time (see vite.config.ts). */
const VERSION = '0ba0c4eeb1';
const CACHE = `margin-${VERSION}`;
const PRECACHE = [
  "./",
  "./index.html",
  "./assets/nunito-sans-latin-400-normal-AkRraKH2.woff2",
  "./assets/nunito-sans-latin-600-normal-BtVRvDNj.woff2",
  "./assets/nunito-sans-latin-700-normal-CICRJDmU.woff2",
  "./assets/nunito-sans-latin-800-normal-MgCk9Q3Y.woff2",
  "./assets/nunito-sans-latin-900-normal-BhewUpNa.woff2",
  "./assets/nunito-sans-latin-600-normal-DLks-Kj1.woff",
  "./assets/nunito-sans-latin-700-normal-CLVG92B9.woff",
  "./assets/nunito-sans-latin-800-normal-DOf_K5Iw.woff",
  "./assets/nunito-sans-latin-900-normal-CVRJ8ULY.woff",
  "./assets/nunito-sans-latin-400-normal-DY9yCUyQ.woff",
  "./assets/credits-by-dr-jao-C_6CoZ6i.png",
  "./assets/margin-letters-eNt1NMLb.png",
  "./assets/game-sprites-oyfzJUTc.png",
  "./assets/anim-sprites-C6EKiT_q.png",
  "./assets/fx-sprites-Dcf2PPZX.png",
  "./assets/knight-sprites-Ca-ACY72.png",
  "./assets/index-CqkU-N3Q.css",
  "./assets/index-kHPBMKoH.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png",
  "./icons/wordmark.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('margin-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: try the network first so updates arrive, fall back to the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))),
    );
    return;
  }

  // Everything else (hashed JS/CSS/fonts/icons): saved copy first, network as backup.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })),
  );
});
