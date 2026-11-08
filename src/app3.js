
/* ===== maps =====
   With a Google key: a Google map in a quiet style with English labels. Each map shown on a visit is one
   "map load", well inside Google's free 10,000 a month. Without a key, or offline: Leaflet with muted
   OpenStreetMap tiles. Both sit behind the same few calls. There are two maps: the trip map on
   Itinerary and the world map on Home. */
const MAPS = { trip:null, home:null };
let GOOGLE_MAPS = null, googleBroken = false, googleLoading = false;
window.gm_authFailure = () => {
  googleBroken = true;
  Object.keys(MAPS).forEach(k => { if(MAPS[k] && MAPS[k].kind === 'google'){ MAPS[k].el.remove(); MAPS[k] = null; } });
  toast('Google turned the map key down, so the free map is showing. Check the key in Settings.');
  if(S.screen === 'itinerary' || S.screen === 'home') render();
};
const worldPx = (lat, lon, z) => { const s = 256 * 2 ** z; const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin(lat * Math.PI / 180))); return [(lon + 180) / 360 * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s]; };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// Map tiles without a key: OpenStreetMap, muted by CSS. A CARTO key, if saved, switches to CARTO's styles.
function tileLayer(dark){
  const k = (library.cartoApiKey || '').trim();
  if(k) return L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(k)}`, { maxZoom:20, subdomains:'abcd', attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' });
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, className:'osm-tiles', attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
}
function leafletAdapter(el, opts){
  const map = L.map(el, { zoomControl:true, worldCopyJump:true, scrollWheelZoom:!opts.home, minZoom:opts.home ? 2 : 0 });
  map.attributionControl.setPrefix(false); map.setView([HOME.lat, HOME.lon], 4);
  const layer = L.layerGroup().addTo(map); let tiles = null, tileSig = '';
  return { kind:'leaflet', el,
    theme(dark){ const sig = dark + '|' + library.cartoApiKey; if(sig === tileSig) return; tileSig = sig; if(tiles) map.removeLayer(tiles); tiles = tileLayer(dark).addTo(map); },
    zoom: () => map.getZoom(),
    setView: (lat, lon, z) => map.setView([lat, lon], z),
    fit: (pts, maxZoom) => map.fitBounds(L.latLngBounds(pts), { padding:[40, 40], maxZoom }),
    clear: () => layer.clearLayers(),
    pin: (lat, lon, o) => { const w = o.w || o.size; L.marker([lat, lon], { icon:L.divIcon({ className:'lpin-wrap', html:o.html, iconSize:[w, o.size], iconAnchor:[o.ax ?? w / 2, o.ay ?? o.size / 2] }), title:o.title, alt:o.title, keyboard:true, riseOnHover:true, zIndexOffset:o.z || 0 }).on('click', o.onClick).addTo(layer); },
    line: (pts, o = {}) => L.polyline(pts, { className:o.cls || 'lroute', weight:o.weight || 2, dashArray:o.dashed ? '5 6' : null, interactive:false }).addTo(layer),
    onClick: cb => map.on('click', ev => cb(ev.latlng.lat, ev.latlng.lng)),
    onZoom: cb => map.on('zoomend', cb),
    picking: on => el.classList.toggle('picking', on),
    resize: () => map.invalidateSize({ pan:false }),
  };
}
const GS_BASE = [
  { featureType:'poi', stylers:[{ visibility:'off' }] }, { featureType:'poi.park', elementType:'geometry', stylers:[{ visibility:'on' }] },
  { featureType:'transit', elementType:'labels.icon', stylers:[{ visibility:'off' }] }, { featureType:'road', elementType:'labels.icon', stylers:[{ visibility:'off' }] },
];
const GSTYLE_LIGHT = GS_BASE.concat([
  { elementType:'geometry', stylers:[{ color:'#f2f3f5' }] }, { featureType:'water', elementType:'geometry', stylers:[{ color:'#cde0ea' }] },
  { featureType:'poi.park', elementType:'geometry', stylers:[{ color:'#e2ece3' }] }, { featureType:'road', elementType:'geometry', stylers:[{ color:'#ffffff' }] },
  { featureType:'road.highway', elementType:'geometry', stylers:[{ color:'#e4e6ea' }] }, { featureType:'transit.line', elementType:'geometry', stylers:[{ color:'#d9dce2' }] },
  { elementType:'labels.text.fill', stylers:[{ color:'#5a606c' }] }, { elementType:'labels.text.stroke', stylers:[{ color:'#ffffff' }] },
  { featureType:'administrative', elementType:'geometry.stroke', stylers:[{ color:'#c6cbd3' }] },
]);
const GSTYLE_DARK = GS_BASE.concat([
  { elementType:'geometry', stylers:[{ color:'#1b1b20' }] }, { featureType:'water', elementType:'geometry', stylers:[{ color:'#11141d' }] },
  { featureType:'poi.park', elementType:'geometry', stylers:[{ color:'#1d2520' }] }, { featureType:'road', elementType:'geometry', stylers:[{ color:'#2a2b32' }] },
  { featureType:'road.highway', elementType:'geometry', stylers:[{ color:'#34353e' }] }, { featureType:'transit.line', elementType:'geometry', stylers:[{ color:'#2c2d34' }] },
  { elementType:'labels.text.fill', stylers:[{ color:'#9b9fab' }] }, { elementType:'labels.text.stroke', stylers:[{ color:'#16161a' }] },
  { featureType:'administrative', elementType:'geometry.stroke', stylers:[{ color:'#4a4b56' }] },
  { featureType:'administrative.country', elementType:'labels.text.fill', stylers:[{ color:'#c4c7d0' }] },
]);
// Clean white: a bright map whatever the app's theme. Midnight: the dark map in the app's own indigo.
const GSTYLE_WHITE = GS_BASE.concat([
  { elementType:'geometry', stylers:[{ color:'#ffffff' }] }, { featureType:'landscape.man_made', elementType:'geometry', stylers:[{ color:'#f7f7f8' }] },
  { featureType:'water', elementType:'geometry', stylers:[{ color:'#d4e6f1' }] }, { featureType:'poi.park', elementType:'geometry', stylers:[{ color:'#e3f1e4' }] },
  { featureType:'road', elementType:'geometry', stylers:[{ color:'#ececef' }] }, { featureType:'road.highway', elementType:'geometry', stylers:[{ color:'#e0e1e6' }] },
  { featureType:'road', elementType:'geometry.stroke', stylers:[{ visibility:'off' }] }, { featureType:'transit.line', elementType:'geometry', stylers:[{ color:'#dcdde3' }] },
  { elementType:'labels.text.fill', stylers:[{ color:'#4a505c' }] }, { elementType:'labels.text.stroke', stylers:[{ color:'#ffffff' }] },
  { featureType:'administrative', elementType:'geometry.stroke', stylers:[{ color:'#c9ccd4' }] },
]);
const GSTYLE_MIDNIGHT = GS_BASE.concat([
  { elementType:'geometry', stylers:[{ color:'#191b2e' }] }, { featureType:'water', elementType:'geometry', stylers:[{ color:'#0f1020' }] },
  { featureType:'poi.park', elementType:'geometry', stylers:[{ color:'#1b2430' }] }, { featureType:'road', elementType:'geometry', stylers:[{ color:'#272a45' }] },
  { featureType:'road.highway', elementType:'geometry', stylers:[{ color:'#33365a' }] }, { featureType:'transit.line', elementType:'geometry', stylers:[{ color:'#2a2d4a' }] },
  { elementType:'labels.text.fill', stylers:[{ color:'#a9abc8' }] }, { elementType:'labels.text.stroke', stylers:[{ color:'#14152a' }] },
  { featureType:'administrative', elementType:'geometry.stroke', stylers:[{ color:'#4a4d75' }] },
  { featureType:'administrative.locality', elementType:'labels.text.fill', stylers:[{ color:'#d6d7ee' }] },
]);
// The Google map's look, picked per device in Settings. 'auto' is how the map always looked.
const MAP_LOOKS = [['auto', 'Follow the app'], ['midnight', 'Follow the app, midnight dark'], ['white', 'Clean white'], ['standard', 'Google standard'], ['terrain', 'Terrain'], ['satellite', 'Satellite']];
const mapLook = () => MAP_LOOKS.some(([k]) => k === dev.mapLook) ? dev.mapLook : 'auto';
function gLook(dark){
  const l = mapLook();
  if(l === 'satellite') return { mapTypeId:'hybrid', styles:null };
  if(l === 'terrain') return { mapTypeId:'terrain', styles:GS_BASE };
  if(l === 'standard') return { mapTypeId:'roadmap', styles:GS_BASE };
  if(l === 'white') return { mapTypeId:'roadmap', styles:GSTYLE_WHITE };
  return { mapTypeId:'roadmap', styles:dark ? (l === 'midnight' ? GSTYLE_MIDNIGHT : GSTYLE_DARK) : GSTYLE_LIGHT };
}
function googleAdapter(el, g, opts){
  const map = new g.Map(el, Object.assign({ center:{ lat:HOME.lat, lng:HOME.lon }, zoom:4, minZoom:opts.home ? 2 : 0, disableDefaultUI:true, zoomControl:true, clickableIcons:false, gestureHandling:opts.home ? 'cooperative' : 'greedy', keyboardShortcuts:false }, gLook(isDark())));
  trackApiCall('mapLoads');
  let items = [], lookSig = mapLook() + isDark();
  class Pin extends g.OverlayView {
    constructor(lat, lon, o){ super(); this.at = new google.maps.LatLng(lat, lon); this.o = o; }
    onAdd(){
      const o = this.o; const d = this.d = document.createElement('div');
      d.className = 'gmap-pin'; d.innerHTML = o.html; d.title = o.title; d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', o.title);
      d.style.width = (o.w || o.size) + 'px'; d.style.height = o.size + 'px'; d.style.zIndex = String(100 + (o.z || 0));
      const go = e => { e.stopPropagation(); o.onClick(); };
      d.addEventListener('click', go); d.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(e); } });
      g.OverlayView.preventMapHitsAndGesturesFrom(d);
      this.getPanes().overlayMouseTarget.appendChild(d);
    }
    draw(){ const p = this.getProjection().fromLatLngToDivPixel(this.at); if(!p || !this.d) return; const w = this.o.w || this.o.size; this.d.style.left = (p.x - (this.o.ax ?? w / 2)) + 'px'; this.d.style.top = (p.y - (this.o.ay ?? this.o.size / 2)) + 'px'; }
    onRemove(){ if(this.d) this.d.remove(); }
  }
  return { kind:'google', el,
    theme: dark => { const sig = mapLook() + dark; if(sig !== lookSig){ lookSig = sig; map.setOptions(gLook(dark)); } },
    zoom: () => map.getZoom(),
    setView: (lat, lon, z) => { map.setCenter({ lat, lng:lon }); map.setZoom(z); },
    fit: (pts, maxZoom) => { const b = new google.maps.LatLngBounds(); pts.forEach(p => b.extend({ lat:p[0], lng:p[1] })); map.fitBounds(b, 40); google.maps.event.addListenerOnce(map, 'idle', () => { if(map.getZoom() > maxZoom) map.setZoom(maxZoom); }); },
    clear: () => { items.forEach(i => i.setMap(null)); items = []; },
    pin: (lat, lon, o) => { const p = new Pin(lat, lon, o); p.setMap(map); items.push(p); },
    line: (pts, o = {}) => {
      const color = mapLook() === 'satellite' ? '#ffffff' : cssVar(o.color || '--color-ink-2') || '#666'; // white shows on photos
      items.push(new g.Polyline(Object.assign({ map, path:pts.map(p => ({ lat:p[0], lng:p[1] })), clickable:false },
        o.dashed ? { strokeOpacity:0, icons:[{ icon:{ path:'M 0,-1 0,1', strokeOpacity:0.85, strokeColor:color, scale:2 }, offset:'0', repeat:'11px' }] } : { strokeColor:color, strokeOpacity:0.8, strokeWeight:o.weight || 2 })));
    },
    onClick: cb => map.addListener('click', ev => cb(ev.latLng.lat(), ev.latLng.lng())),
    onZoom: cb => { let t; map.addListener('zoom_changed', () => { clearTimeout(t); t = setTimeout(cb, 120); }); },
    picking: on => map.setOptions({ draggableCursor: on ? 'crosshair' : null }),
    resize: () => {},
  };
}
// Puts map `key` into `host`, making it on first use. Returns null while Google's script is still loading.
function ensureMap(key, host, opts){
  const want = gkey() && !googleBroken && navigator.onLine && !nearCap('mapLoads') ? 'google' : 'leaflet';
  let M = MAPS[key];
  if(M && M.kind !== want){ M.el.remove(); M = MAPS[key] = null; }
  if(!M){
    if(want === 'google' && !GOOGLE_MAPS){
      host.innerHTML = '<p class="sub mapoff">Loading the map…</p>';
      if(!googleLoading){
        googleLoading = true;
        loadGoogleMapsScript(gkey()).then(() => google.maps.importLibrary('maps')).then(g => { GOOGLE_MAPS = g; })
          .catch(() => { googleBroken = true; }).finally(() => { googleLoading = false; if(S.screen === 'itinerary' || S.screen === 'overview') mountMap(); });
      }
      return null;
    }
    if(want === 'leaflet' && typeof L === 'undefined'){ host.innerHTML = '<p class="empty mapoff">The map could not load. Check the internet connection and open this page again.</p>'; return null; }
    host.innerHTML = '';
    const el = document.createElement('div'); el.className = 'lmap'; host.appendChild(el);
    M = MAPS[key] = want === 'google' ? googleAdapter(el, GOOGLE_MAPS, opts) : leafletAdapter(el, opts);
    M.view = ''; M.sig = ''; opts.init(M);
  } else { host.innerHTML = ''; host.appendChild(M.el); }
  M.theme(isDark()); M.resize();
  return M;
}

/* ===== trip map on Itinerary ===== */
function mountMap(){
  const host = document.querySelector('[data-map="trip"]'); if(!host) return;
  const M = ensureMap('trip', host, { init: M => {
    M.onClick((lat, lon) => { if(S.picking) dropPin(lat, lon); });
    M.onZoom(() => { if(S.lastMap && S.lastMap.filter === 'all' && M.el.isConnected) drawMarkers(); });
  } });
  if(!M) return;
  M.picking(!!S.picking);
  drawMarkers();
}
function dayRange(days){
  const n = days.map(i => i + 1); const parts = [];
  for(let i = 0; i < n.length; i++){ let j = i; while(j + 1 < n.length && n[j + 1] === n[j] + 1) j++; parts.push(j > i + 1 ? `${n[i]}–${n[j]}` : j === i + 1 ? `${n[i]}, ${n[j]}` : `${n[i]}`); i = j; }
  return (days.length > 1 ? 'Days ' : 'Day ') + parts.join(', ');
}
// Where each day happens: the middle of its pinned stops, or its hotel if it has no stops.
function dayCentres(t){
  return t.days.map((d, i) => {
    let ps = d.places.filter(p => p.type === 'activity' && p.lat != null);
    if(!ps.length) ps = d.places.filter(p => p.type === 'hotel' && p.lat != null);
    return ps.length ? { i, lat:ps.reduce((a, p) => a + p.lat, 0) / ps.length, lon:ps.reduce((a, p) => a + p.lon, 0) / ps.length, pts:ps.map(p => [p.lat, p.lon]) } : null;
  }).filter(Boolean);
}
const ZOOM_PLACES = 12;
// The zoom at which these points just fit in the element, like fitBounds would pick.
function fitZoom(pts, el){
  const a = pts.map(p => worldPx(p[0], p[1], 0)); const xs = a.map(p => p[0]), ys = a.map(p => p[1]);
  const dx = Math.max(...xs) - Math.min(...xs) || 1e-9, dy = Math.max(...ys) - Math.min(...ys) || 1e-9;
  return Math.floor(Math.log2(Math.min((el.clientWidth - 80) / dx, (el.clientHeight - 80) / dy)));
}
function drawMarkers(){
  const MAP = MAPS.trip; const t = T(); const nums = numbering(t); const { filter, focus } = S.lastMap; const z = MAP.zoom();
  const marks = []; let route = []; const all = [];
  const popup = id => () => { if(S.picking) return; S.mapPopup = id; render(); };
  const on = id => focus === id || S.mapPopup === id ? 'focus' : '';
  const stopPin = p => ({ lat:p.lat, lon:p.lon, html:`<span class="lpin ${on(p.id)}">${nums[p.id] || ''}</span>`, size:28, w:String(nums[p.id] || '').length > 2 ? 34 : 28, title:`${nums[p.id]}. ${p.name}`, z:100, onClick:popup(p.id) });
  const hotelPin = p => ({ lat:p.lat, lon:p.lon, html:`<span class="lpin hotel ${on(p.id)}">H</span>`, size:24, title:'Hotel: ' + p.name, z:0, onClick:popup(p.id) });
  let shown = null;
  if(filter === 'all'){
    // Whole trip, zoomed out: one marker per day ("Day 1", or "Days 1–3" where days share a town).
    // Zoomed in, or with "Every place" picked: every stop with its trip-wide number.
    const centres = dayCentres(t);
    centres.forEach(c => all.push(...c.pts));
    // "Every place" always shows every stop. Otherwise the zoom decides: day markers when zoomed out, every
    // stop once you zoom in past S.placesZoom. Tapping "Days" fits the whole trip and sets that point one
    // step closer than the fit; tapping a day marker sets it to that day's zoom, so its places appear.
    if(S.daysPick){ S.daysPick = false; S.placesZoom = Math.max(ZOOM_PLACES, Math.min(15, all.length > 1 ? fitZoom(all, MAP.el) : 14) + 1); }
    shown = S.tripShow === 'places' ? 'places' : (z >= (S.placesZoom ?? ZOOM_PLACES) ? 'places' : 'days');
    if(shown === 'days'){
      const groups = [];
      centres.forEach(c => { const px = worldPx(c.lat, c.lon, z); const g = groups.find(g => Math.hypot(g.px[0] - px[0], g.px[1] - px[1]) < 64); if(g) g.m.push(c); else groups.push({ px, m:[c] }); });
      groups.forEach(g => {
        const label = dayRange(g.m.map(c => c.i)); const lat = g.m.reduce((a, c) => a + c.lat, 0) / g.m.length, lon = g.m.reduce((a, c) => a + c.lon, 0) / g.m.length;
        marks.push({ lat, lon, html:`<span class="lpin bubble">${label}</span>`, size:30, w:24 + label.length * 7.5, title:`${label}. Show its places`, z:200, onClick:() => { S.tripShow = null; const pts = g.m.flatMap(c => c.pts); const fz = Math.min(16, fitZoom(pts, MAPS.trip.el)); S.placesZoom = Math.min(ZOOM_PLACES, fz); MAPS.trip.view = 'manual'; MAPS.trip.fit(pts, 16); drawMarkers(); } });
      });
      route = centres.map(c => [c.lat, c.lon]);
    } else {
      const seen = new Set();
      t.days.forEach(d => d.places.forEach(p => {
        if(p.lat == null || p.type === 'flight') return;
        if(p.type === 'hotel'){ if(!seen.has(p.name)){ seen.add(p.name); marks.push(hotelPin(p)); } return; }
        marks.push(stopPin(p));
      }));
    }
  } else {
    const d = t.days[filter];
    if(d){
      d.places.forEach(p => { if(p.lat == null || p.type === 'flight') return; all.push([p.lat, p.lon]); marks.push(p.type === 'hotel' ? hotelPin(p) : stopPin(p)); });
      planOf(d).forEach(e => { if(e.kind === 'place' && e.p.lat != null) route.push([e.p.lat, e.p.lon]); });
    }
  }
  document.querySelectorAll('[data-act="tripshow"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === shown)));
  const sig = JSON.stringify([marks.map(m => [m.lat, m.lon, m.html, m.title]), route, isDark()]);
  if(sig !== MAP.sig){
    MAP.sig = sig; MAP.clear();
    if(route.length > 1) MAP.line(route, { dashed:true });
    marks.forEach(m => MAP.pin(m.lat, m.lon, m));
  }
  if(MAP.view === 'manual'){ MAP.view = JSON.stringify([filter, focus, t.id, all.length, S.tripShow]); return; }
  const viewSig = JSON.stringify([filter, focus, filter === 'all' ? t.id : (t.days[filter] || {}).id, all.length, S.tripShow]);
  if(viewSig !== MAP.view){
    MAP.view = viewSig;
    const f = focus && findPlace(focus);
    if(f && f.p.lat != null) MAP.setView(f.p.lat, f.p.lon, 16);
    else if(all.length === 1) MAP.setView(all[0][0], all[0][1], 14);
    else if(all.length) MAP.fit(all, 15);
    else {
      const d = filter === 'all' ? null : t.days[filter]; const gc = d && cityName(d.city) ? cityGeo(cityName(d.city)) : null;
      const anyPin = []; t.days.forEach(dd => dd.places.forEach(p => { if(p.lat != null) anyPin.push([p.lat, p.lon]); }));
      if(gc) MAP.setView(gc.lat, gc.lon, 12); else if(anyPin.length) MAP.fit(anyPin, 13); else MAP.setView(HOME.lat, HOME.lon, 3);
    }
  }
}

function dropPin(lat, lon){
  const f = findPlace(S.picking); S.picking = null; if(!f) return render();
  const t = T(); const same = t.days.flatMap(d => d.places).filter(p => p.type === 'hotel' && f.p.type === 'hotel' && p.name === f.p.name);
  (same.length ? same : [f.p]).forEach(p => { p.lat = +lat.toFixed(6); p.lon = +lon.toFixed(6); });
  S.mapPopup = f.p.id; announce(`Pinned ${f.p.name}`); changed(); render();
}
// Places from older versions may have no pin yet: look each one up once with the free search, like the old map did.
let geoBusy = false;
async function autoLocate(){
  const t = T(); if(geoBusy || !t || S.screen !== 'itinerary') return;
  const todo = []; t.days.forEach(d => d.places.forEach(p => { if(p.type !== 'flight' && p.lat == null && !(geoKey(p.name, d.city) in t.geocodeCache)) todo.push({ p, d }); }));
  if(!todo.length) return;
  geoBusy = true; let hit = false;
  for(const { p, d } of todo.slice(0, 12)){
    const c = await geocodePlace(p.name, cityName(d.city));
    t.geocodeCache[geoKey(p.name, d.city)] = c;
    if(c && p.lat == null){ p.lat = c.lat; p.lon = c.lon; hit = true; }
    await sleep(350);
  }
  geoBusy = false; saveSoon();
  if(hit){ changed(t); if(S.screen === 'itinerary' && !S.dialog && !document.activeElement.matches('input, textarea, select')) render(); }
}

/* ===== render ===== */
const app = document.getElementById('app');
function isDark(){ return dev.theme === 'dark' || (dev.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); }
function applyPrefs(){
  const r = document.documentElement;
  r.style.setProperty('--scale', dev.scale);
  if(dev.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', dev.theme);
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = isDark() ? '#101010' : '#f8fafb';
}
function render(){
  applyPrefs();
  if(S.gate){ app.innerHTML = gateHTML(); document.title = 'Milo & Miles'; if(!document.activeElement || document.activeElement === document.body) document.querySelector('.gate input, .gate .gate-main')?.focus(); return; }
  if(!T() && S.screen !== 'settings') S.screen = 'home';
  const scr = { home:scrHome, overview:scrOverview, itinerary:scrItinerary, budget:scrBudget, settings:scrSettings }[S.screen]();
  Object.values(MAPS).forEach(M => { if(M && M.el.parentNode) M.el.remove(); });
  app.innerHTML = `${bar()}<main class="wrap" id="main">${scr}</main>${dialogHTML()}`;
  document.title = (S.screen !== 'home' && S.screen !== 'settings' && T() ? tripLabel(T()) + ', ' : '') + 'Milo & Miles';
  if(S.screen === 'itinerary' && T() && T().days.length){ mountMap(); setTimeout(autoLocate, 1500); }
  if(S.screen === 'overview' && T() && T().days.length) mountMap();
  if(S.screen === 'home') mountFoot();
  document.body.classList.toggle('noscroll', !!S.mapFull);
  if(S.scrollDay){ S.scrollDay = false; const ds = document.querySelector('.daystrip'); if(ds && ds.getBoundingClientRect().top < 0) ds.scrollIntoView({ block:'start' }); }
  if(S.dialog){ const f = document.querySelector('.dialog input:not([readonly]), .dialog select, .dialog textarea:not([readonly]), .dialog button:not([data-act="close"])'); if(f && !document.querySelector('.dialog').contains(document.activeElement)) f.focus({ preventScroll:true }); }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if(dev.theme === 'auto') render(); });

/* ===== actions ===== */
function resetAdd(){ Object.assign(S, { addMode:'search', q:'', results:null, searching:false, picked:null, link:'', linkRes:null, addErr:null, addNote:'', wiki:null, sTime:'', sWhat:'', fName:'', fDep:'', fArr:'', addDay:null, hFrom:null, hTo:null }); }
function addPlace(noPin = false){
  const trip = T(); const t = S.addType; const di = S.addDay != null ? S.addDay : S.day; const day = trip.days[di];
  if(t === 'do' || t === 'move'){
    if(!S.sWhat.trim()){ S.addErr = t === 'do' ? 'Say what the activity is first.' : 'Add the route or details first.'; render(); return; }
    day.logistics.push({ time:S.sTime, desc:S.sWhat.trim(), kind: t === 'do' ? 'activity' : 'transport' });
    announce(`Added ${S.sWhat.trim()} to Day ${di + 1}`);
  } else if(t === 'flight'){
    if(!S.fName.trim()){ S.addErr = 'Enter the flight name or number first.'; render(); return; }
    day.places.unshift({ id:uid(), type:'flight', name:S.fName.trim(), departTime:S.fDep, arriveTime:S.fArr, note:S.addNote, lat:null, lon:null });
    announce(`Added ${S.fName.trim()} to Day ${di + 1}`);
  } else {
    let found = null;
    if(noPin){
      const name = S.addMode === 'search' ? S.q.trim() : ((S.linkRes && S.linkRes.name) || parseMaps(S.link).name || '').trim();
      if(!name){ S.addErr = 'Type the name of the place first.'; render(); return; }
      found = { name, addr:'', lat:null, lon:null };
    } else if(S.addMode === 'search'){
      if(S.picked && S.picked.pending){ S.addErr = 'Still confirming the location. Try again in a moment.'; render(); return; }
      if(!S.picked){ S.addErr = S.q.trim() ? 'Pick a result from the list so the place lands on the map, or add it without a location and drop a pin later.' : 'Search for the place first.'; render(); return; }
      found = S.picked;
    } else {
      const r = S.linkRes;
      if(!r || r.kind !== 'coords'){ S.addErr = r && (r.kind === 'notfound' || r.kind === 'nohelper' || r.kind === 'helperfail') ? 'This link has no location the app can read. You can add it without a location and drop a pin later.' : 'Paste a Google Maps link that shows a location first.'; render(); return; }
      found = { name:r.name, addr:r.addr || '', lat:r.lat, lon:r.lon };
    }
    const base = { name:found.name, address:found.addr || '', lat:found.lat, lon:found.lon, note:S.addNote };
    if(t === 'hotel'){
      const a = S.hFrom ?? di, b = S.hTo ?? di; const lo = Math.min(a, b), hi = Math.max(a, b);
      for(let j = lo; j <= hi; j++){ const ps = trip.days[j].places; ps.splice(ps.filter(p => p.type === 'flight').length, 0, Object.assign({ id:uid(), type:'hotel' }, base)); }
      announce(`Added ${found.name} to ${dayList(Array.from({ length:hi - lo + 1 }, (_, k) => lo + k + 1))}`);
    } else {
      day.places.push(Object.assign({ id:uid(), type:'activity', category:S.addCat, time:'' }, base));
      announce(`Added ${found.name} to Day ${di + 1}`);
    }
  }
  resetAdd(); S.dialog = null; S.day = di; changed(); render();
}
function saveExpense(){
  const t = T(); const d = S.draft; const m = catOf(d.cat).mode;
  const e = S.editing ? t.expenses.find(x => x.id === S.editing) : { id:uid() };
  const o = { category:d.cat, desc:d.desc.trim() || d.cat, date:d.date, currency:d.cur };
  const fail = (f, msg) => { S.expErr = { f, msg }; render(); document.getElementById(f)?.focus(); };
  if(m === 'pax'){
    const u = parseFloat(d.unit), q = parseInt(d.qty);
    if(!(u > 0)) return fail('funit', 'Enter the price for one person, then add the expense.');
    if(!(q > 0)) return fail('fqty', 'Enter how many people, then add the expense.');
    Object.assign(o, { unit:u, qty:q, amount:round2(u * q), nights:undefined });
  } else {
    const tot = parseFloat(d.total);
    if(!(tot > 0)) return fail('ftotal', m === 'nights' ? 'Enter the total for the stay, then add the expense.' : 'Enter the amount, then add the expense.');
    Object.assign(o, { amount:tot, nights:m === 'nights' ? (parseInt(d.nights) || undefined) : undefined, unit:undefined, qty:undefined });
  }
  S.expErr = null; Object.assign(e, o); ['unit','qty','nights'].forEach(k => { if(e[k] === undefined) delete e[k]; });
  if(!S.editing) t.expenses.unshift(e);
  announce(`${S.editing ? 'Saved' : 'Added'} ${e.desc}, ${fmt(e.currency, expTotal(e))}`);
  S.editing = null; S.draft = Object.assign(blankDraft(t, d.cat), { date:d.date, trip:t.id }); changed(); render();
}
/* ===== the lock screen's actions ===== */
let pendingPass = ''; // between "Lock the app" and "Add a passkey" only, then cleared
const val = id => (document.getElementById(id) || {}).value || '';
const busy = on => { S.lockBusy = on; render(); };
function lockErrText(e){ return e.wait ? `Too many wrong tries. Wait ${Math.max(1, Math.ceil((unlockWait - Date.now()) / 1000))} seconds, then try again.` : e.wrong ? 'That passcode isn\'t right.' : 'Something went wrong in this browser. Try again.'; }
async function gateUnlock(){
  if(S.lockBusy) return; const pass = val('upass');
  if(!pass){ S.addErr = 'Type your passcode.'; render(); document.getElementById('upass')?.focus(); return; }
  S.addErr = null; busy(true);
  try{ await unlock(pass); S.lockBusy = false; startApp(); announce('Unlocked'); }
  catch(e){ S.addErr = lockErrText(e); busy(false); document.getElementById('upass')?.focus(); }
}
async function gateBio(){
  if(S.lockBusy) return; S.addErr = null; busy(true);
  try{ await bioUnlock(); S.lockBusy = false; startApp(); announce('Unlocked'); }
  catch(e){ S.addErr = e.cancelled ? 'The passkey check was cancelled. Try again, or type your passcode.' : e.noprf ? 'This browser can\'t unlock with a passkey. Type your passcode.' : 'The passkey didn\'t unlock it. Type your passcode.'; busy(false); }
}
async function gateSetup(){
  if(S.lockBusy) return; const a = val('lp1'), b = val('lp2');
  S.addErr = a.length < PASS_MIN ? `Use at least ${PASS_MIN} characters.` : a !== b ? 'The two passcodes are different. Type them again.' : null;
  if(S.addErr){ render(); return; }
  busy(true);
  try{ await lockOn(a); dev.lock = 'on'; saveDev(); S.lockBusy = false; if(S.bioAvail){ pendingPass = a; S.gate = 'passkey'; render(); } else startApp(); }
  catch(e){ S.addErr = 'Could not lock the app in this browser.'; busy(false); }
}
function bioErrText(e){ return e.wrong ? 'That passcode isn\'t right.' : e.wait ? 'Too many wrong tries. Wait a little, then try again.' : e.noprf ? 'This browser can make passkeys but can\'t unlock with them yet. It works in Safari 18 or later and in recent Chrome or Edge. You can delete the "Milo & Miles lock" passkey it just made.' : e && e.name === 'NotAllowedError' ? 'The passkey check was cancelled.' : 'Could not add a passkey in this browser.'; }
async function gateBioOn(){
  if(S.lockBusy) return; S.addErr = null; busy(true);
  try{ await bioTurnOn(pendingPass); pendingPass = ''; S.lockBusy = false; startApp(); toast('Passkey added'); }
  catch(e){ S.addErr = bioErrText(e); busy(false); }
}
async function doBioOn(){
  if(S.lockBusy) return; const pass = val('bp');
  if(!pass){ S.bioErr = 'Type your passcode first.'; render(); return; }
  S.bioErr = null; busy(true);
  try{ await bioTurnOn(pass); busy(false); toast('Passkey on'); }
  catch(e){ S.bioErr = bioErrText(e); busy(false); }
}
async function doChangePass(){
  if(S.lockBusy) return; const c = val('cp0'), a = val('cp1'), b = val('cp2');
  S.addErr = a.length < PASS_MIN ? `Use at least ${PASS_MIN} characters for the new passcode.` : a !== b ? 'The two new passcodes are different.' : null;
  if(S.addErr){ render(); return; }
  busy(true);
  try{ await changePass(c, a); S.lockBusy = false; S.dialog = null; render(); toast('Passcode changed'); }
  catch(e){ S.addErr = lockErrText(e); busy(false); }
}
function confirmBox(title, body, yes, fn){ S.confirm = { title, body, yes, fn }; S.dialog = 'confirm'; render(); }
function openTrip(id, screen = 'overview'){ library.activeTripId = id; S.day = 0; S.mapMode = 'day'; S.tripShow = S.placesZoom = null; S.daysPick = false; S.mapFocus = S.mapPopup = S.picking = null; S.editing = null; S.draft = null; S.editDay = false; S.screen = screen; saveSoon(); window.scrollTo(0, 0); }
function deleteTrip(id){
  const t = library.trips[id]; if(!t) return;
  const m = sync.meta[id]; if(m && m.sha) sync.deleted[id] = m.sha;
  delete library.trips[id]; delete sync.meta[id]; saveSync();
  if(library.activeTripId === id) library.activeTripId = Object.keys(library.trips)[0] || null;
  saveNow(); syncSoon(3000); announce(`Deleted ${tripLabel(t)}`);
}
function datesBetween(a, b){ const out = []; if(!okDate(a)) return out; let d = a; const end = okDate(b) && b >= a ? b : a; while(d <= end && out.length < 120){ out.push(d); d = addDaysISO(d, 1); } return out; }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const a = el.dataset.act; if(a === 'closebg' && e.target !== el) return;
  const t = T();
  switch(a){
    case 'gotoday': { const h = findTodayTrip(); if(h){ openTrip(h.t.id, 'itinerary'); S.day = h.i; } } break;
    case 'nav': S.screen = el.dataset.to; S.dialog = null; S.picking = null; S.mapFull = false; S.mapFocus = S.mapPopup = null; window.scrollTo(0, 0); break;
    case 'syncbtn': if(sync.token){ syncNow(); return; } S.screen = 'settings'; window.scrollTo(0, 0); break;
    case 'syncnow': syncNow(); return;
    case 'savetoken': {
      const tok = document.getElementById('tok').value.trim(); const repo = document.getElementById('trepo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '');
      if(!tok && !sync.token){ S.addErr = 'Paste the token first.'; break; }
      if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){ S.addErr = 'Write the repo as owner/name, for example Vibe-coder-Milo/Trip-Tracker-data.'; break; }
      if(repo !== sync.repo){ sync.meta = {}; sync.deleted = {}; sync.settingsSha = ''; Object.keys(library.trips).forEach(id => { syncMeta(id).dirty = true; }); }
      if(tok) sync.token = tok; sync.repo = repo; sync.expires = document.getElementById('texp').value; sync.status = ''; sync.error = '';
      saveSync(); S.addErr = null; S.dialog = null; announce('Token saved on this device. Syncing now'); render(); syncNow(); return;
    }
    case 'askdisconnect': confirmBox('Disconnect sync on this device?', 'The token is removed from this device. Your trips stay here and in the GitHub repo.', 'Disconnect', () => { sync.token = ''; sync.status = ''; sync.error = ''; S.syncState = ''; saveSync(); announce('Sync turned off on this device'); render(); }); return;
    case 'savekey': {
      const g = document.getElementById('gk').value.trim(), ck = (document.getElementById('ck')?.value || '').trim();
      if(g && !KEY_OK.googleApiKey(g)){ toast('That doesn’t look like a Google key. Copy it again from Google Cloud.'); return; }
      if(ck && !KEY_OK.cartoApiKey(ck)){ toast('That doesn’t look like a CARTO key.'); return; }
      library.googleApiKey = g || library.googleApiKey; googleBroken = false; library.cartoApiKey = ck || library.cartoApiKey; googleMapsLoadingPromise = null; S.dialog = null; settingsChanged(); announce('Key saved'); } break;
    case 'askdelkey': confirmBox('Remove the Google key?', 'Search falls back to the free service.' + (sync.token ? ' It is removed from every device.' : ''), 'Remove the key', () => { library.googleApiKey = ''; settingsChanged(); render(); }); return;
    case 'copyscript': navigator.clipboard?.writeText(HELPER_SCRIPT).then(() => toast('Script copied'), () => { const ta = document.getElementById('hscript'); ta.select(); toast('Select all and copy'); }); return;
    case 'savehelper': {
      const url = document.getElementById('hurl').value.trim(); const out = document.getElementById('htest');
      if(!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)){ out.innerHTML = `<p class="formerr" role="alert">${I('alert','sm')}Paste the Web app URL. It starts with https://script.google.com/</p>`; return; }
      out.innerHTML = '<p class="sub">Testing the reader…</p>';
      fetch(url + (url.includes('?') ? '&' : '?') + 'u=' + encodeURIComponent('https://maps.app.goo.gl/test')).then(r => r.json()).then(() => {
        library.helperUrl = url; settingsChanged(); S.dialog = null; render(); toast('Short-link reader connected');
      }).catch(() => { out.innerHTML = `<p class="formerr" role="alert">${I('alert','sm')}The reader didn't answer. Check that it's deployed as a Web app with access for Anyone.</p>`; });
      return;
    }
    case 'delhelper': library.helperUrl = ''; settingsChanged(); break;
    case 'maplook': dev.mapLook = el.dataset.v; saveDev(); if(MAPS.trip && MAPS.trip.kind === 'google'){ MAPS.trip.theme(isDark()); MAPS.trip.sig = ''; } break;
    case 'maplookgo': S.screen = 'itinerary'; S.mapMode = 'trip'; S.mapFocus = S.mapPopup = null; window.scrollTo(0, 0); break;
    case 'delcarto': library.cartoApiKey = ''; MAPS.trip && MAPS.trip.theme && MAPS.trip.theme(isDark()); settingsChanged(); toast('CARTO key removed'); break;
    case 'theme': dev.theme = el.dataset.v; saveDev(); break;
    case 'sz': dev.scale = Math.max(.8, Math.min(1.5, +(dev.scale + .1 * el.dataset.d).toFixed(1))); saveDev(); break;
    case 'print': window.print(); return;
    case 'dialog':
      S.dialog = el.dataset.d; S.addErr = null; if(el.dataset.d === 'add'){ resetAdd(); } break;
    case 'gunlock': gateUnlock(); return;
    case 'gbio': gateBio(); return;
    case 'gsetup': gateSetup(); return;
    case 'gbioon': gateBioOn(); return;
    case 'gdone': pendingPass = ''; startApp(); return;
    case 'gskip': dev.lock = 'skipped'; saveDev(); startApp(); return;
    case 'gsetupopen': S.gate = 'setup'; S.addErr = null; break;
    case 'gforgot': confirmBox('Start again on this device?', 'Without the passcode, the scrambled trips, keys and token on this device can\'t be opened, so they are deleted. If you sync with GitHub, connect again with your token and your trips and Google key come back. Trips that never synced are lost.', 'Delete and start again', () => { lockReset(); }); return;
    case 'bioon': doBioOn(); return;
    case 'bioff': confirmBox('Turn off the passkey?', 'You\'ll type the passcode to open the app. To remove the passkey itself, delete "Milo & Miles lock" in the Passwords app or your browser\'s passkeys.', 'Turn it off', () => { bioTurnOff(); S.bioErr = null; toast('Passkey off'); render(); }); return;
    case 'chpass': doChangePass(); return;
    case 'locknow': lockNow(); return;
    case 'close': case 'closebg': S.dialog = null; S.addErr = null; break;
    case 'confirmyes': { const fn = S.confirm.fn; S.dialog = null; fn(); } break;
    case 'fpu': { const k = el.dataset.k; if(S.fp && S.fp.lit[k]){ S.hlRegion = S.hlRegion === k ? null : k; break; } return; }
    case 'fpzoom': FPP.user = true; zoomFoot(el.dataset.d === '1' ? 2 : 0.5); return;
    case 'fpfit': fitFoot(); return;
    case 'fpworld': worldFoot(); return;
    case 'mapfull': S.mapFull = !S.mapFull; if(MAPS.trip) MAPS.trip.view = ''; break;
    case 'tripshow': S.tripShow = el.dataset.v === 'places' ? 'places' : null; S.daysPick = el.dataset.v === 'days'; S.placesZoom = null; if(MAPS.trip) MAPS.trip.view = ''; break;
    case 'opentrip': openTrip(el.dataset.id); break;
    case 'createtrip': {
      const n = S.newTrip; if(!n.name.trim()){ S.addErr = 'Give the trip a name first.'; break; }
      const tr = defaultTrip(); tr.tripName = n.name.trim(); tr.days = datesBetween(n.from, n.to).map(newDay);
      if(t){ tr.currency = t.currency; tr.baseCurrency = t.baseCurrency; }
      library.trips[tr.id] = tr; S.newTrip = { name:'', from:'', to:'' }; S.dialog = null; S.addErr = null; openTrip(tr.id); changed(tr); announce(`Created ${tr.tripName}`);
    } break;
    case 'savepast': {
      const f = S.pastForm; const cs = f.cities.split(',').map(s => s.trim()).filter(Boolean);
      if(!f.name.trim() || !okDate(f.from) || !cs.length){ S.addErr = 'Add a name, a first day and at least one city.'; break; }
      const tr = Object.assign(defaultTrip(), { tripName:f.name.trim(), kind:'maponly', start:f.from, end:okDate(f.to) && f.to >= f.from ? f.to : f.from, cities:cs.map(c => { const g = library.cityCache[c.toLowerCase()]; return g && !g.miss && g.name ? g.name : c; }) });
      library.trips[tr.id] = tr; changed(tr);
      S.pastForm = { name:'', from:'', to:'', cities:'' }; S.dialog = null; S.addErr = null; S.screen = 'home'; announce(`Added ${tr.tripName}. ${cs.join(' and ')} now on your map`); window.scrollTo(0, 0);
    } break;
    case 'planfull': { const ds = datesBetween(t.start, t.end); t.days = (ds.length ? ds : ['']).map(newDay); t.days.forEach(d => { d.city = t.cities[0] || ''; }); t.kind = 'full'; changed(); S.screen = 'itinerary'; S.day = 0; } break;
    case 'firstday': { const v = document.getElementById('firstday').value; t.days.push(newDay(okDate(v) ? v : '')); changed(); S.screen = 'itinerary'; S.day = 0; } break;
    case 'askdeltrip': { const tr = library.trips[el.dataset.id]; confirmBox('Delete this trip?', `${esc(tripLabel(tr))} will be removed${sync.token ? ' from every device. Older versions stay in your GitHub history' : ' from this device'}.`, 'Delete the trip', () => { deleteTrip(tr.id); render(); }); } return;
    case 'askclear': confirmBox(`Clear ${esc(tripLabel(t))}?`, 'Every day, place and expense in it will be removed. The trip name stays.', 'Clear the trip', () => { t.days = []; t.expenses = []; t.rates = {}; changed(); announce('Trip cleared'); render(); }); return;
    case 'exporttrip': exportTrip(t); return;
    case 'exportall': exportAll(); return;
    case 'import': document.getElementById('importFile').click(); return;
    case 'edititem': S.editItem = el.dataset.id; S.editTime = null; break;
    case 'doneitem': S.editItem = null; break;
    case 'pcat': { const f = findPlace(el.dataset.id); f.p.category = el.dataset.c; changed(); } break;
    case 'editday': S.editDay = !S.editDay; break;
    case 'doneday': S.editDay = false; break;
    case 'stepkind': t.days[S.day].logistics[+el.dataset.k].kind = el.dataset.v; changed(); break;
    case 'mapm': S.mapMode = el.dataset.m; S.mapFocus = null; S.mapPopup = null; S.tripShow = null; S.placesZoom = null; break;
    case 'mapday': S.day = +el.dataset.i; S.mapMode = 'day'; S.mapFocus = null; S.mapPopup = null; S.editItem = null; S.editTime = null; S.scrollDay = true; break;
    case 'closepop': S.mapPopup = null; S.mapFocus = null; break;
    case 'unfocus': S.mapFocus = null; break;
    case 'showpin': S.mapFocus = el.dataset.id; S.mapPopup = el.dataset.id; if(matchMedia('(max-width: 64rem)').matches) setTimeout(() => document.querySelector('.mapcol')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50); break;
    case 'pick': { S.picking = el.dataset.id; S.editItem = null; const f = findPlace(el.dataset.id); S.screen = 'itinerary'; S.day = t.days.indexOf(f.d); S.mapMode = 'day'; S.mapFocus = null; S.mapPopup = null; render(); document.querySelector('.mapcol')?.scrollIntoView({ behavior:'smooth', block:'nearest' }); } return;
    case 'pickcancel': S.picking = null; break;
    case 'day': S.mapFull = false; S.editTime = null; S.editItem = null; S.editDay = false; S.scrollDay = true; if(S.screen !== 'itinerary'){ S.screen = 'itinerary'; window.scrollTo(0, 0); } S.day = +el.dataset.i; S.addDay = null; S.hFrom = S.hTo = null; S.mapFocus = null; S.mapPopup = null; S.picking = null; break;
    case 'addday': { const last = t.days[t.days.length - 1]; const d = newDay(last && okDate(last.date) ? addDaysISO(last.date, 1) : ''); if(last) d.city = last.city; t.days.push(d); S.day = t.days.length - 1; S.screen = 'itinerary'; S.editDay = true; changed(); announce(`Added Day ${t.days.length}, ${dLong(d.date)}`); } break;
    case 'moveday': {
      const i = +el.dataset.i, j = i + +el.dataset.d; if(j < 0 || j >= t.days.length) return;
      const dates = t.days.map(d => d.date);
      [t.days[i], t.days[j]] = [t.days[j], t.days[i]];
      t.days.forEach((d, k) => d.date = dates[k]);
      if(S.screen === 'itinerary') S.day = j;
      changed(); announce(`Moved ${t.days[j].city || 'the day'} to Day ${j + 1}. Dates stay in order`);
      render(); document.querySelector(`.daymove[data-i="${j}"][data-d="${el.dataset.d}"]:not(:disabled)`)?.focus(); return;
    }
    case 'askdelday': { const i = S.day; confirmBox(`Delete Day ${i + 1}?`, 'Everything planned for this day, including its hotel night, flights and notes, will be removed.', 'Delete the day', () => { t.days.splice(i, 1); S.day = Math.max(0, i - 1); S.editDay = false; changed(); announce(`Deleted Day ${i + 1}`); render(); }); } return;
    case 'delplace': { const f = findPlace(el.dataset.id); f.d.places.splice(f.i, 1); if(S.mapPopup === f.p.id) S.mapPopup = S.mapFocus = null; changed(); undoToast(`Removed ${f.p.name}`, () => { f.d.places.splice(f.i, 0, f.p); changed(); }); } break;
    case 'undo': { const fn = S.undo; S.undo = null; document.querySelector('.toast')?.remove(); if(fn){ fn(); announce('Restored'); } } break;
    case 'edittime': S.editTime = +el.dataset.k; S.editItem = null; break;
    case 'donetime': S.editTime = null; break;
    case 'deltime': { const dd = t.days[S.day]; const k = +el.dataset.k; const [x] = dd.logistics.splice(k, 1); S.editTime = null; changed(); undoToast(`Removed ${x.desc || 'the step'}`, () => { dd.logistics.splice(k, 0, x); changed(); }); } break;
    case 'atype': S.addType = el.dataset.t; S.wiki = null; S.addErr = null; break;
    case 'acat': S.addCat = el.dataset.c; break;
    case 'amode': S.addMode = el.dataset.m; S.addErr = null; break;
    case 'pickres': {
      const r = (S.results || [])[+el.dataset.i]; if(!r) return;
      S.addErr = null;
      if(r.lat != null){ S.picked = { name:r.label, addr:r.sub, lat:r.lat, lon:r.lon }; S.q = r.label; }
      else {
        S.picked = { name:r.label, addr:r.sub, pending:true }; S.q = r.label;
        resolveGooglePlace(r.googlePrediction).then(loc => { if(!S.picked || S.picked.name !== r.label) return; if(loc){ S.picked = { name:r.label, addr:loc.addr || r.sub, lat:loc.lat, lon:loc.lon }; } else { S.picked = null; S.results = []; } paintResults(); });
      }
      const q = document.getElementById('aq'); if(q) q.value = S.q; paintResults(); return;
    }
    case 'unpick': S.picked = null; paintResults(); document.getElementById('aq')?.focus(); return;
    case 'wiki': {
      const name = S.addMode === 'search' ? ((S.picked && S.picked.name) || S.q) : ((S.linkRes && S.linkRes.name) || '');
      const out = document.getElementById('wikires'); if(!name.trim()){ if(out) out.innerHTML = '<p class="sub">Search for the place first.</p>'; return; }
      if(out) out.innerHTML = '<p class="sub">Looking on Wikipedia…</p>';
      fetchWikipediaSummary(name).then(txt => {
        S.wiki = txt || `No Wikipedia summary found for “${name}”. Write your own note instead.`;
        if(txt && !S.addNote.trim()){ S.addNote = txt; const n = document.getElementById('anote'); if(n) n.value = txt; }
        const o = document.getElementById('wikires'); if(o) o.innerHTML = `<p class="desc">${esc(S.wiki)}</p>`;
      });
      return;
    }
    case 'addplace': addPlace(); return;
    case 'addnopin': addPlace(true); return;
    case 'cat': S.draft.cat = el.dataset.c; S.expErr = null; break;
    case 'saveexp': saveExpense(); return;
    case 'editexp': { const x = t.expenses.find(y => y.id === el.dataset.id); S.editing = x.id; S.expErr = null; S.draft = { trip:t.id, cat:x.category, desc:x.desc, date:x.date, cur:x.currency, total:x.unit != null ? '' : (x.amount ?? ''), nights:x.nights ?? '', unit:x.unit ?? (catOf(x.category).mode === 'pax' ? x.amount : ''), qty:x.qty ?? '1' }; render(); document.querySelector('[data-form="exp"]')?.scrollIntoView({ block:'center' }); } return;
    case 'canceledit': S.editing = null; S.expErr = null; S.draft = Object.assign(blankDraft(t, S.draft.cat), { trip:t.id }); break;
    case 'delexp': { const i = t.expenses.findIndex(y => y.id === el.dataset.id); const x = t.expenses[i]; t.expenses.splice(i, 1); if(S.editing === x.id){ S.editing = null; S.draft = Object.assign(blankDraft(t, S.draft.cat), { trip:t.id }); } changed(); undoToast(`Removed ${x.desc || x.category}`, () => { t.expenses.splice(i, 0, x); changed(); }); } break;
    default: return;
  }
  render();
});

let pastTimer = null, searchTimer = null, searchSeq = 0, linkTimer = null;
async function runSearch(q){
  const seq = ++searchSeq; const hint = addCityHint();
  let res = null;
  if(googleSearchOK()){ res = await searchPlacesGoogle(q, hint); if(res && !res.length && !nearCap('textSearch')) res = await searchPlacesGoogleText(q, hint); }
  if(!res) res = await searchPlaces(q, hint);
  if(seq !== searchSeq) return;
  S.results = res || []; S.searching = false; paintResults();
}
document.addEventListener('input', e => {
  const t = e.target; const trip = T(); const d = trip && trip.days[S.day];
  if(t.dataset.f){ S.draft[t.dataset.f] = t.value; if(S.expErr && t.id === S.expErr.f){ S.expErr = null; t.removeAttribute('aria-invalid'); document.getElementById('experr')?.remove(); } const c = document.getElementById('calc'); if(c) c.outerHTML = calcHTML(); return; }
  if(t.dataset.pf){ S.pastForm[t.dataset.pf] = t.value; if(t.dataset.pf === 'cities'){ clearTimeout(pastTimer); pastTimer = setTimeout(() => { const el = document.getElementById('pcheck'); if(el) el.innerHTML = pastCheckHTML(t.value.split(',').map(s => s.trim()).filter(Boolean)); }, 600); } return; }
  if(t.dataset.nt){ S.newTrip[t.dataset.nt] = t.value; return; }
  switch(t.dataset.in){
    case 'tripname': trip.tripName = t.value; changed(); break;
    case 'dcity': d.city = t.value; changed(); break;
    case 'dnotes': d.notes = t.value; changed(); break;
    case 'ttime': d.logistics[+t.dataset.k].time = t.value; changed(); break;
    case 'tdesc': d.logistics[+t.dataset.k].desc = t.value; changed(); break;
    case 'pnote': findPlace(t.dataset.id).p.note = t.value; changed(); break;
    case 'pname': { const f = findPlace(t.dataset.id); const old = f.p.name; f.p.name = t.value; if(f.p.type === 'hotel') trip.days.forEach(dd => dd.places.forEach(p => { if(p.type === 'hotel' && p.name === old) p.name = t.value; })); changed(); } break;
    case 'ptime': findPlace(t.dataset.id).p.time = t.value; changed(); break;
    case 'pdep': findPlace(t.dataset.id).p.departTime = t.value; changed(); break;
    case 'parr': findPlace(t.dataset.id).p.arriveTime = t.value; changed(); break;
    case 'mocities': trip.cities = t.value.split(',').map(s => s.trim()).filter(Boolean); changed(); break;
    case 'aq': {
      S.q = t.value; S.picked = null; S.addErr = null; clearTimeout(searchTimer);
      if(S.q.trim().length < 2){ S.results = null; S.searching = false; paintResults(); break; }
      S.searching = true; S.results = null; paintResults();
      searchTimer = setTimeout(() => runSearch(S.q.trim()), 350);
    } break;
    case 'lname': if(S.linkRes) S.linkRes.name = t.value; break;
    case 'alink': S.link = t.value; S.addErr = null; clearTimeout(linkTimer); linkTimer = setTimeout(resolveLink, 250); break;
    case 'fname': S.fName = t.value; break;
    case 'swhat': S.sWhat = t.value; break;
    case 'anote': S.addNote = t.value; break;
  }
});
document.addEventListener('change', e => {
  const t = e.target; const trip = T();
  if(t.id === 'importFile'){ const file = t.files[0]; if(!file) return; const rd = new FileReader(); rd.onload = () => importBackup(rd.result); rd.readAsText(file); t.value = ''; return; }
  if(t.dataset.f === 'cur'){ S.draft.cur = t.value; const c = document.getElementById('calc'); if(c) c.outerHTML = calcHTML(); return; }
  if(t.dataset.rate){ const v = parseFloat(String(t.value).replace(/,/g, '')); if(v > 0) trip.rates[t.dataset.rate] = v; else delete trip.rates[t.dataset.rate]; changed(); render(); return; }
  switch(t.dataset.in){
    case 'ddate': trip.days[S.day].date = t.value; changed(); render(); break;
    case 'ptime': case 'pdep': case 'parr': render(); document.getElementById(t.id)?.focus(); break;
    case 'ttime': render(); document.getElementById(t.id)?.focus(); break;
    case 'fdep': S.fDep = t.value; break;
    case 'farr': S.fArr = t.value; break;
    case 'stime': S.sTime = t.value; break;
    case 'aday': S.addDay = +t.value; break;
    case 'hfrom': S.hFrom = +t.value; break;
    case 'hto': S.hTo = +t.value; break;
    case 'lcur': trip.currency = t.value; if(S.draft) S.draft.cur = t.value; changed(); render(); break;
    case 'bcur': changeBase(trip, t.value); changed(); render(); break;
    case 'mofrom': trip.start = t.value; changed(); break;
    case 'moto': trip.end = t.value; changed(); break;
    case 'findplace': S.mapFocus = t.value || null; S.mapPopup = t.value || null; render(); break;
    case 'movestep': { const from = trip.days[S.day]; const [x] = from.logistics.splice(+t.dataset.k, 1); trip.days[+t.value].logistics.push(x); S.editTime = null; changed(); announce(`Moved ${x.desc || 'the step'} to Day ${+t.value + 1}`); render(); } break;
    case 'moveto': { const f = findPlace(t.dataset.id); const to = +t.value; f.d.places.splice(f.i, 1); trip.days[to].places.push(f.p); S.editItem = null; changed(); announce(`Moved ${f.p.name} to Day ${to + 1}`); render(); } break;
  }
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && (S.dialog || S.picking || S.mapFull)){ if(S.dialog || S.picking){ S.dialog = null; S.picking = null; S.addErr = null; } else S.mapFull = false; render(); return; }
  if(e.key === 'Enter' && e.target.id === 'upass'){ e.preventDefault(); gateUnlock(); return; }
  if(e.key === 'Enter' && (e.target.id === 'lp1' || e.target.id === 'lp2')){ e.preventDefault(); gateSetup(); return; }
  if(e.key === 'Enter' && /^cp[012]$/.test(e.target.id)){ e.preventDefault(); doChangePass(); return; }
  if(e.key === 'Enter' && e.target.id === 'bp'){ e.preventDefault(); doBioOn(); return; }
  if(e.key === 'Enter' && e.target.id === 'aq'){ e.preventDefault(); const first = document.querySelector('#ares .results button'); if(first && !S.picked) first.click(); return; }
  const h = e.target.closest && e.target.closest('.handle[data-drag]');
  if(!h || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const t = T(); const what = h.dataset.what || 'p', day = +h.dataset.day, idx = +h.dataset.idx, key = what === 's' ? 'logistics' : 'places';
  const arr = t.days[day][key]; let toDay = day, toIdx;
  if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
    const step = e.key === 'ArrowUp' ? -1 : 1; let j = idx + step;
    while(j >= 0 && j < arr.length && what === 'p' && arr[j].type !== 'activity') j += step;
    if(j < 0 || j >= arr.length) return;
    toIdx = step < 0 ? j : j + 1;
  } else {
    toDay = day + (e.key === 'ArrowLeft' ? -1 : 1); if(toDay < 0 || toDay >= t.days.length) return; toIdx = null;
  }
  const finalIdx = toDay === day ? (toIdx > idx ? toIdx - 1 : toIdx) : t.days[toDay][key].length;
  moveItem(what, day, idx, toDay, toIdx);
  document.querySelector(`.handle[data-drag="${h.dataset.drag}"][data-what="${what}"][data-day="${toDay}"][data-idx="${finalIdx}"]`)?.focus();
});

/* ===== drag and drop (touch and mouse) ===== */
let drag = null;
function moveItem(what, fromDay, fromIdx, toDay, toIdx){
  const t = T(); const key = what === 's' ? 'logistics' : 'places';
  const src = t.days[fromDay][key]; const [x] = src.splice(fromIdx, 1); const dst = t.days[toDay][key];
  let at = toIdx == null ? dst.length : toIdx; if(fromDay === toDay && fromIdx < at) at -= 1;
  dst.splice(Math.max(0, Math.min(at, dst.length)), 0, x);
  const name = what === 's' ? (x.desc || 'the step') : x.name;
  changed(); announce(fromDay === toDay ? `Moved ${name}` : `Moved ${name} to Day ${toDay + 1}`);
  render();
}
function clearMarks(){ document.querySelectorAll('.drop,.before,.after').forEach(n => n.classList.remove('drop', 'before', 'after')); }
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-drag]'); if(!h) return;
  const kind = h.dataset.drag; const srcEl = kind === 'ov' ? h.closest('.ovrow') : h.closest('.item');
  drag = { kind, what:h.dataset.what || 'p', day:+h.dataset.day, idx:+h.dataset.idx, x:e.clientX, y:e.clientY, started:false, srcEl, ghost:null, target:null };
});
document.addEventListener('pointermove', e => {
  if(!drag) return;
  if(!drag.started){ if(Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return; drag.started = true;
    const r = drag.srcEl.getBoundingClientRect(); const g = drag.srcEl.cloneNode(true); g.classList.add('dragghost'); g.style.width = r.width + 'px'; g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; document.body.appendChild(g);
    drag.ghost = g; drag.ox = drag.x - r.left; drag.oy = drag.y - r.top; drag.srcEl.classList.add('src'); }
  e.preventDefault();
  drag.ghost.style.left = (e.clientX - drag.ox) + 'px'; drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
  const edge = 80; if(e.clientY < edge) window.scrollBy(0, -14); else if(e.clientY > innerHeight - edge) window.scrollBy(0, 14);
  clearMarks(); drag.ghost.style.display = 'none'; const under = document.elementFromPoint(e.clientX, e.clientY); drag.ghost.style.display = ''; drag.target = null;
  if(!under) return;
  const sel = drag.kind === 'ov' ? '.ovrow[data-row]' : '.item[data-drag-item]';
  const rowEl = under.closest(sel); const dayEl = drag.kind === 'ov' ? under.closest('.ov-day') : null;
  if(rowEl && rowEl !== drag.srcEl){
    const [what, dd, ii] = (rowEl.dataset.row || rowEl.dataset.dragItem).split(':'); const r = rowEl.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2;
    rowEl.classList.add(before ? 'before' : 'after');
    drag.target = what === drag.what ? { day:+dd, idx:+ii + (before ? 0 : 1) } : { day:+dd, idx:null };
  } else if(dayEl){ dayEl.classList.add('drop'); drag.target = { day:+dayEl.dataset.day, idx:null }; }
}, { passive:false });
document.addEventListener('pointerup', () => {
  if(!drag) return; const d = drag; drag = null;
  if(!d.started) return;
  d.ghost.remove(); clearMarks(); d.srcEl.classList.remove('src');
  if(d.target && !(d.target.day === d.day && (d.target.idx === d.idx || d.target.idx === d.idx + 1 || d.target.idx === null))) moveItem(d.what, d.day, d.idx, d.target.day, d.target.idx);
});
document.addEventListener('pointercancel', () => { if(drag){ drag.ghost?.remove(); clearMarks(); drag.srcEl.classList.remove('src'); drag = null; } });

/* ===== start ===== */
// With the lock on, the lock screen comes first and the library is only opened by the passcode or passkey.
// Without it, the first open on a device offers to set it up ("Not now" is remembered on the device).
function startApp(){
  S.gate = null; S.addErr = null; S.dialog = null;
  const hit = findTodayTrip();
  if(hit){ library.activeTripId = hit.t.id; S.screen = 'itinerary'; S.day = hit.i; }
  else S.screen = 'home';
  window.scrollTo(0, 0); render(); saveNow();
  if(sync.token) setTimeout(syncNow, 600);
}
if(vaultOn()){ S.gate = 'unlock'; render(); }
else { loadLibrary(); if(dev.lock === 'skipped' || dev.lock === 'on') startApp(); else { S.gate = 'setup'; render(); } }
bioAvailable().then(v => { S.bioAvail = v; if(S.screen === 'settings' || S.gate) render(); });
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden'){ saveNow(); if(sync.token && Object.values(sync.meta).some(m => m.dirty)) syncNow(); }
  else if(sync.token) syncNow();
});
window.addEventListener('online', () => { if(sync.token) syncNow(); });
window.addEventListener('offline', () => { if(sync.token){ S.syncState = 'offline'; paintSync(); } });
window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(() => { Object.values(MAPS).forEach(M => { if(M && M.el.isConnected) M.resize(); }); }, 150); });
setInterval(() => { if(document.visibilityState === 'visible' && !S.dialog && !document.activeElement.matches('input, textarea, select')) paintSync(); }, 60000);
if('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) navigator.serviceWorker.register('sw.js').catch(() => {});
