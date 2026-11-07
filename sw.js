/* Milo & Miles offline support. The page itself is fetched fresh when online (so updates arrive) and
   served from the cache when offline. Libraries, fonts and map tiles you've already seen are cached.
   Nothing from GitHub, Google or search is cached: those always go to the network. */
const CORE = 'milo-miles-core-v1', LIBS = 'milo-miles-libs-v1', TILES = 'milo-miles-tiles-v1';
const CORE_URLS = ['./', './index.html', './manifest.webmanifest'];
const LIB_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
const MAX_TILES = 600;

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CORE).then(c => c.addAll(CORE_URLS)),
    caches.open(LIBS).then(c => c.addAll(LIB_URLS)).catch(() => {}),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![CORE, LIBS, TILES].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trimTiles(){
  const c = await caches.open(TILES); const keys = await c.keys();
  for(let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === location.origin){
    // Network first for the app, so a new version shows up straight away when online.
    e.respondWith(fetch(req).then(res => { if(res.ok){ const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch:true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  if(url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if(res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(LIBS).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  if(url.hostname.endsWith('basemaps.cartocdn.com') || url.hostname === 'tile.openstreetmap.org'){
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if(res.ok || res.type === 'opaque'){ c.put(req, res.clone()); trimTiles(); } return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
