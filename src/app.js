'use strict';
/* Milo & Miles (formerly Trip Tracker). One self-contained page. Trips live in this browser (localStorage) and, once a
   GitHub token is added in Settings, in a private GitHub repo so every device matches.
   Data-shape changes go through migrateState() so old backups always load. */

const HOME = { name:'Singapore', lat:1.35, lon:103.82 };
// Storage keys keep the old app's names so trips saved by Trip Tracker carry over.
const LS_KEY = 'trip-tracker-library-v1', LS_LEGACY = 'trip-tracker-data', LS_DEVICE = 'trip-tracker-device-v1', LS_SYNC = 'trip-tracker-sync-v1';
const DATA_REPO_DEFAULT = 'Vibe-coder-Milo/Trip-Tracker-data';

const CUR_NAMES = { SGD:'Singapore dollar', JPY:'Japanese yen', KRW:'South Korean won', CNY:'Chinese yuan', HKD:'Hong Kong dollar', TWD:'New Taiwan dollar', MOP:'Macau pataca',
  THB:'Thai baht', MYR:'Malaysian ringgit', IDR:'Indonesian rupiah', VND:'Vietnamese dong', PHP:'Philippine peso', KHR:'Cambodian riel', LAK:'Lao kip', MMK:'Myanmar kyat', BND:'Brunei dollar',
  INR:'Indian rupee', LKR:'Sri Lankan rupee', NPR:'Nepalese rupee', MVR:'Maldivian rufiyaa', BDT:'Bangladeshi taka', AUD:'Australian dollar', NZD:'New Zealand dollar', FJD:'Fijian dollar',
  USD:'US dollar', CAD:'Canadian dollar', MXN:'Mexican peso', BRL:'Brazilian real', ARS:'Argentine peso', CLP:'Chilean peso', PEN:'Peruvian sol', GBP:'British pound', EUR:'Euro',
  CHF:'Swiss franc', SEK:'Swedish krona', NOK:'Norwegian krone', DKK:'Danish krone', ISK:'Icelandic krona', PLN:'Polish zloty', CZK:'Czech koruna', HUF:'Hungarian forint', RON:'Romanian leu',
  TRY:'Turkish lira', GEL:'Georgian lari', AED:'UAE dirham', SAR:'Saudi riyal', QAR:'Qatari riyal', OMR:'Omani rial', JOD:'Jordanian dinar', ILS:'Israeli new shekel', EGP:'Egyptian pound',
  MAD:'Moroccan dirham', ZAR:'South African rand', KES:'Kenyan shilling', TZS:'Tanzanian shilling', KZT:'Kazakhstani tenge', UZS:'Uzbekistani som', MNT:'Mongolian tugrik' };
const CURS = Object.keys(CUR_NAMES);
const ZERO_DEC = new Set(['JPY','KRW','VND','IDR','KHR','LAK','MMK','CLP','ISK','HUF','UZS','MNT','TZS']);
const SYM = { SGD:'S$', JPY:'¥', EUR:'€', GBP:'£', USD:'US$', AUD:'A$', NZD:'NZ$', HKD:'HK$', MYR:'RM', THB:'฿', KRW:'₩', CNY:'CN¥', TWD:'NT$', INR:'₹', PHP:'₱', VND:'₫', IDR:'Rp' };
const CATS = [
  { k:'Air ticket', ic:'plane', mode:'pax' }, { k:'Hotel', ic:'bed', mode:'nights' },
  { k:'Attractions', ic:'ticket', mode:'pax' }, { k:'Food', ic:'bowl', mode:'single' },
  { k:'Transport', ic:'train', mode:'pax' }, { k:'Misc', ic:'receipt', mode:'single' },
];
const catOf = k => CATS.find(c => c.k === k) || CATS[5];
const CATKEY = { 'Air ticket':'air', 'Hotel':'hotel', 'Attractions':'sight', 'Food':'food', 'Transport':'transport', 'Misc':'misc' };
const CATEGORY_RENAME_MAP = { 'Flights':'Air ticket', 'Hotels':'Hotel', 'Other':'Misc' };
// Google's free monthly allowance per call type. Place Details asks for basic fields only, which keeps
// it in the Essentials tier (10,000 a month). Text Search is Pro tier (5,000), so it only runs when
// suggestions come back empty. Never add editorialSummary, ratings or hours: they move to costlier tiers.
const USAGE = [['mapLoads','Map loads',10000],['autocomplete','Suggestions as you type',10000],['textSearch','Name searches',5000],['placeDetails','Place details',10000]];

/* ===== small helpers ===== */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const round2 = n => Math.round(n * 100) / 100;
function readJSON(k){ try{ const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
function writeJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function geoKey(place, city){ return (String(place).trim() + '|' + String(city || '').trim()).toLowerCase(); }
function normalizeTimeForInput(str){
  if(!str) return '';
  str = String(str).trim();
  if(/^([01]\d|2[0-3]):[0-5]\d$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})(?:[:.]([0-5]\d))?\s*([AaPp][Mm])?$/);
  if(!m) return '';
  let hour = parseInt(m[1], 10); const min = m[2] || '00'; const ap = m[3] ? m[3].toUpperCase() : null;
  if(ap === 'PM' && hour < 12) hour += 12;
  if(ap === 'AM' && hour === 12) hour = 0;
  if(hour < 0 || hour > 23) return '';
  return String(hour).padStart(2, '0') + ':' + min;
}

/* ===== device settings: theme, colour and text size belong to each device ===== */
// Older versions also kept a dark-mode colour choice (accent, accentPicked). There is one dark colour now,
// so those fields are simply ignored; they stay in the saved settings untouched.
const dev = Object.assign({ scale:1, theme:'auto', id:uid() }, readJSON(LS_DEVICE) || {});
function saveDev(){ writeJSON(LS_DEVICE, dev); }
saveDev();

/* ===== library ===== */
let library = null;
// The settings every device shares through the private data repo. The GitHub token is never one of them.
const SHARED_KEYS = ['googleApiKey', 'cartoApiKey', 'helperUrl'];
const sharedOf = o => Object.fromEntries(SHARED_KEYS.map(k => [k, o[k]]));
function defaultTrip(){
  const now = new Date().toISOString();
  return { id:uid(), createdAt:now, updatedAt:now, tripName:'', kind:'full', currency:'SGD', baseCurrency:'SGD', rates:{}, budgetTarget:null, start:'', end:'', cities:[], days:[], expenses:[], geocodeCache:{} };
}
function newDay(date = ''){ return { id:uid(), date, city:'', notes:'', logistics:[], places:[] }; }

// Brings any saved trip, from any version of this app, up to the current shape, so old backups keep
// loading. It adds missing fields and tidies old ones. The only thing it removes is an expense row with
// nothing in it at all (no description, amount, date or unit).
function migrateState(t){
  if(!t || typeof t !== 'object') return t;
  if(!t.id) t.id = uid();
  if(!t.createdAt) t.createdAt = new Date().toISOString();
  if(!t.updatedAt) t.updatedAt = t.createdAt;
  if(typeof t.tripName !== 'string') t.tripName = String(t.tripName || '');
  // A copy kept when two devices edited the same trip. It is a backup, so Home doesn't count it again.
  if(t.olderCopy !== true && / \(older copy\)$/.test(t.tripName)) t.olderCopy = true;
  if(!t.currency) t.currency = 'SGD';
  if(!t.baseCurrency) t.baseCurrency = 'SGD';
  if(!t.rates || typeof t.rates !== 'object' || Array.isArray(t.rates)) t.rates = {};
  if(t.kind !== 'maponly') t.kind = 'full';
  if(!Array.isArray(t.cities)) t.cities = [];
  if(typeof t.start !== 'string') t.start = '';
  if(typeof t.end !== 'string') t.end = '';
  if(!Array.isArray(t.days)) t.days = [];
  if(!Array.isArray(t.expenses)) t.expenses = [];
  if(!t.geocodeCache || typeof t.geocodeCache !== 'object') t.geocodeCache = {};
  t.days.forEach(d => {
    if(!d.id) d.id = uid();
    if(typeof d.date !== 'string') d.date = '';
    if(typeof d.city !== 'string') d.city = String(d.city || '');
    if(typeof d.notes !== 'string') d.notes = String(d.notes || '');
    if(!Array.isArray(d.places)){
      d.places = [];
      if(d.hotel) d.places.push({ id:uid(), type:'hotel', name:d.hotel, lat:null, lon:null });
      if(Array.isArray(d.activities)) d.activities.forEach(a => d.places.push({ id:uid(), type:'activity', name:a, lat:null, lon:null }));
      delete d.hotel; delete d.activities;
    }
    if(!Array.isArray(d.logistics)) d.logistics = [];
    d.logistics.forEach(l => {
      l.time = normalizeTimeForInput(l.time);
      if(typeof l.desc !== 'string') l.desc = String(l.desc || '');
      if(l.kind !== 'activity') l.kind = 'transport';
    });
    d.places.forEach(p => {
      if(!p.id) p.id = uid();
      if(!['hotel','flight','activity'].includes(p.type)) p.type = 'activity';
      if(p.type === 'activity' && p.category !== 'food') p.category = 'attraction';
      if(typeof p.name !== 'string') p.name = String(p.name || '');
      if(typeof p.note !== 'string') p.note = String(p.note || '');
      if(typeof p.lat !== 'number' || typeof p.lon !== 'number'){
        p.lat = null; p.lon = null;
        const c = t.geocodeCache[geoKey(p.name, d.city)];
        if(c && typeof c.lat === 'number'){ p.lat = c.lat; p.lon = c.lon; }
      }
      if(p.type === 'activity') p.time = normalizeTimeForInput(p.time);
      if(p.type === 'flight'){ p.departTime = normalizeTimeForInput(p.departTime); p.arriveTime = normalizeTimeForInput(p.arriveTime); }
    });
  });
  // Blank rows from the old app's "+ Add expense" carry nothing: no description, amount or date.
  t.expenses = t.expenses.filter(e => e && (e.desc || Number(e.amount) || e.date || e.unit));
  t.expenses.forEach(e => {
    if(!e.id) e.id = uid();
    if(CATEGORY_RENAME_MAP[e.category]) e.category = CATEGORY_RENAME_MAP[e.category];
    if(!CATS.some(c => c.k === e.category)) e.category = 'Misc';
    if(!e.currency) e.currency = t.currency || 'SGD';
    if(typeof e.desc !== 'string') e.desc = String(e.desc || '');
    if(typeof e.date !== 'string') e.date = '';
    if(e.unit != null && e.qty != null) e.amount = round2(Number(e.unit) * Number(e.qty));
    e.amount = Number(e.amount) || 0;
  });
  return t;
}
function loadLibrary(){
  let lib = readJSON(LS_KEY);
  if(!lib){
    const old = readJSON(LS_LEGACY);
    if(old && Array.isArray(old.days)){ const t = Object.assign(defaultTrip(), old, { id:uid() }); lib = { activeTripId:t.id, trips:{ [t.id]:t } }; }
  }
  library = migrateLibrary(lib);
}
// The same for the whole library (every trip plus the shared settings).
function migrateLibrary(lib){
  if(!lib || typeof lib !== 'object') lib = {};
  if(!lib.trips || typeof lib.trips !== 'object') lib.trips = {};
  SHARED_KEYS.forEach(k => { if(typeof lib[k] !== 'string') lib[k] = ''; });
  if(!lib.cityCache || typeof lib.cityCache !== 'object') lib.cityCache = {};
  if(!lib.usage || typeof lib.usage !== 'object') lib.usage = {};
  if(lib.apiUsage && lib.apiUsage.month){ lib.usage[dev.id] = Object.assign({}, lib.apiUsage); delete lib.apiUsage; }
  Object.values(lib.trips).forEach(migrateState);
  // An empty, unnamed trip is what older versions created on first open. It isn't a real trip, so it goes.
  Object.values(lib.trips).forEach(t => { if(!t.tripName && !t.days.length && !t.expenses.length && Object.keys(lib.trips).length > 1) delete lib.trips[t.id]; });
  if(!lib.trips[lib.activeTripId]) lib.activeTripId = Object.keys(lib.trips)[0] || null;
  return lib;
}
const T = () => (library.activeTripId && library.trips[library.activeTripId]) || null;

/* ===== saving ===== */
let saveTimer = null;
function saveNow(){
  clearTimeout(saveTimer);
  let ok = true;
  try{ localStorage.setItem(LS_KEY, JSON.stringify(library)); }catch(e){ ok = false; }
  if(ok !== !S.saveFail) return;
  S.saveFail = !ok; render();
}
function saveSoon(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
// Call after any change to a trip. Marks it for sync and saves on this device.
function changed(t = T()){
  if(t){ t.updatedAt = new Date().toISOString(); const m = syncMeta(t.id); m.dirty = true; m.v = (m.v || 0) + 1; }
  saveSoon(); syncSoon();
}
function settingsChanged(){ sync.settingsDirty = true; saveSync(); saveSoon(); syncSoon(); }

/* ===== money ===== */
function fmt(cur, n){ if(!isFinite(n)) return 'No rate yet'; const dec = ZERO_DEC.has(cur) ? 0 : 2; return (SYM[cur] || cur + ' ') + Number(n).toLocaleString('en-SG', { minimumFractionDigits:dec, maximumFractionDigits:dec }); }
const rateOf = (t, cur) => cur === t.baseCurrency ? 1 : t.rates[cur];
const conv = (t, from, to, n) => { const a = rateOf(t, from), b = rateOf(t, to); return a && b ? n / a * b : NaN; };
const fmtRate = n => Number(n).toLocaleString('en-SG', { maximumFractionDigits:4 });
function tripCurs(t){ const s = new Set([t.currency]); t.expenses.forEach(e => s.add(e.currency)); s.delete(t.baseCurrency); return [...s]; }
function rateLine(t){ const l = tripCurs(t).filter(c => t.rates[c]).map(c => `1 ${t.baseCurrency} = ${fmtRate(t.rates[c])} ${c}`); return l.length ? `Rate: ${l.join(', ')}` : (tripCurs(t).length ? 'No exchange rate set yet' : ''); }
function changeBase(t, N){
  const r = t.rates, B = t.baseCurrency; if(N === B) return;
  const k = r[N]; const nr = {};
  if(k){ Object.entries(r).forEach(([c, v]) => { if(c !== N) nr[c] = v / k; }); nr[B] = 1 / k; }
  t.rates = nr; t.baseCurrency = N;
}
const expTotal = e => Number(e.amount) || 0;
function breakdown(e){
  const m = catOf(e.category).mode;
  if(m === 'pax' && e.unit != null && e.qty) return `${e.qty} ${e.qty == 1 ? 'person' : 'people'} × ${fmt(e.currency, e.unit)}`;
  if(m === 'nights' && e.nights) return `${e.nights} ${e.nights == 1 ? 'night' : 'nights'} at ${fmt(e.currency, expTotal(e) / e.nights)}`;
  return '';
}
function totals(t){
  const by = {}; let all = 0; const missing = new Set(); let left = 0;
  t.expenses.forEach(e => { const v = conv(t, e.currency, t.baseCurrency, expTotal(e)); if(!isFinite(v)){ missing.add(e.currency); left++; return; } by[e.category] = (by[e.category] || 0) + v; all += v; });
  return { by, all, missing:[...missing], left };
}

/* ===== dates ===== */
const today = () => new Date();
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const okDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '');
const dLong = iso => okDate(iso) ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' }) : 'No date set';
const dMid = iso => okDate(iso) ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) : 'No date';
const dShort = iso => okDate(iso) ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : 'No date';
const year = iso => iso.slice(0, 4);
const daysUntil = iso => Math.round((new Date(iso + 'T00:00:00') - new Date(today().toDateString())) / 864e5);
function addDaysISO(iso, n){ const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); }
function range(a, b){ if(!okDate(a)) return 'Dates not set'; if(!okDate(b) || a === b) return `${dShort(a)} ${year(a)}`; return year(a) === year(b) ? `${dShort(a)} to ${dShort(b)} ${year(b)}` : `${dShort(a)} ${year(a)} to ${dShort(b)} ${year(b)}`; }
function tripStart(t){ if(t.kind === 'maponly') return t.start; const ds = t.days.map(d => d.date).filter(okDate).sort(); return ds[0] || ''; }
function tripEnd(t){ if(t.kind === 'maponly') return t.end || t.start; const ds = t.days.map(d => d.date).filter(okDate).sort(); return ds[ds.length - 1] || ''; }
function tripLen(t){ const a = tripStart(t), b = tripEnd(t); return okDate(a) && okDate(b) ? Math.round((new Date(b) - new Date(a)) / 864e5) + 1 : (t.kind === 'full' ? t.days.length : 0); }
const isPast = t => okDate(tripEnd(t)) && new Date(tripEnd(t) + 'T23:59:59') < today();
const isUpcoming = t => okDate(tripStart(t)) && daysUntil(tripStart(t)) > 0;
const tripDayIndex = (t = T()) => t ? t.days.findIndex(d => d.date === isoLocal(today())) : -1;
function findTodayTrip(){ for(const t of Object.values(library.trips)){ if(t.kind !== 'full') continue; const i = tripDayIndex(t); if(i > -1) return { t, i }; } return null; }

/* ===== plan for a day ===== */
const STEPIC = { activity:'flag', transport:'train' };
function flightTime(p){ const a = p.arriveTime, d = p.departTime; return a && d && a < d ? a : (d || a || ''); }
function planOf(d){
  const places = d.places.map((p, pi) => ({ kind:'place', p, pi, t:p.time || '' })).filter(x => x.p.type === 'activity');
  const extra = d.logistics.map((s, k) => ({ kind:'step', sk:s.kind || 'transport', t:s.time || '', d:s.desc || '', k }))
    .concat(d.places.map((p, pi) => ({ p, pi })).filter(x => x.p.type === 'flight').map(x => ({ kind:'flight', p:x.p, pi:x.pi, t:flightTime(x.p) })));
  const timed = places.filter(x => x.t).concat(extra.filter(x => x.t)).sort((a, b) => a.t.localeCompare(b.t) || (a.kind === 'place' ? 1 : -1));
  const untimed = places.filter(x => !x.t).concat(extra.filter(x => !x.t));
  // Numbers run through the whole trip: Day 2 carries on from where Day 1 stopped.
  const t = T(); let n = 0;
  if(t && t.days.includes(d)) for(const x of t.days){ if(x === d) break; n += x.places.filter(p => p.type === 'activity' || p.type === 'flight').length + x.logistics.length; }
  timed.concat(untimed).forEach(e => { e.n = ++n; });
  return untimed.length && timed.length ? timed.concat([{ kind:'divider' }], untimed) : timed.concat(untimed);
}
function numbering(t){ const m = {}; t.days.forEach(d => planOf(d).forEach(e => { if(e.kind === 'place') m[e.p.id] = e.n; })); return m; }
function hotelDays(t, name){ return t.days.map((d, i) => d.places.some(p => p.type === 'hotel' && p.name === name) ? i + 1 : null).filter(Boolean); }
function stayText(t, name){
  const ds = hotelDays(t, name); const n = ds.length; if(!n) return '';
  const a = t.days[ds[0] - 1].date, l = t.days[ds[n - 1] - 1].date;
  return `${n} ${n === 1 ? 'night' : 'nights'}` + (okDate(a) && okDate(l) ? `, ${dShort(a)} to ${dShort(addDaysISO(l, 1))}` : '');
}
function dayList(nums){ return nums.length > 2 && nums[nums.length - 1] - nums[0] === nums.length - 1 ? `Days ${nums[0]} to ${nums[nums.length - 1]}` : (nums.length > 1 ? 'Days ' : 'Day ') + nums.join(' and '); }
const placeIcon = p => p.type === 'flight' ? 'plane' : p.type === 'hotel' ? 'bed' : p.category === 'food' ? 'bowl' : 'pin';
function findPlace(id, t = T()){ if(!t) return null; for(const d of t.days){ const i = d.places.findIndex(p => p.id === id); if(i > -1) return { d, i, p:d.places[i] }; } return null; }
const dayLabel = (d, j) => `Day ${j + 1}${okDate(d.date) ? ', ' + dShort(d.date) : ''}${d.city ? ', ' + d.city : ''}`;

/* ===== feedback ===== */
function announce(msg){ const l = document.getElementById('live'); if(!l) return; l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }
function undoToast(msg, fn){ clearTimeout(toast.t); document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = `<span>${esc(msg)}</span> <button type="button" class="link undo" data-act="undo">Undo</button>`; document.body.appendChild(t); S.undo = fn; toast.t = setTimeout(() => { t.remove(); S.undo = null; }, 7000); }
function toast(msg){ clearTimeout(toast.t); document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); toast.t = setTimeout(() => t.remove(), 3600); }

/* ===== screen state (not saved) ===== */
const S = {
  screen:'home', day:0, mapMode:'day', dialog:null, mapFocus:null, mapPopup:null, picking:null,
  addType:'activity', addCat:'attraction', addMode:'search', q:'', results:null, searching:false, picked:null, link:'', linkRes:null,
  addDay:null, hFrom:null, hTo:null, fName:'', fDep:'', fArr:'', addNote:'', wiki:null, sTime:'', sWhat:'',
  draft:null, editing:null, editDay:false, scrollDay:false, editTime:null, undo:null, editItem:null, expErr:null, addErr:null,
  hlCity:null, confirm:null, showKey:false, pastForm:{ name:'', from:'', to:'', cities:'' }, newTrip:{ name:'', from:'', to:'' }, saveFail:false,
};

/* ===== Google Places (needs the key in Settings) and free search fallbacks ===== */
const gkey = () => (library.googleApiKey || '').trim();
function trackApiCall(kind){
  const mk = isoLocal(today()).slice(0, 7);
  let u = library.usage[dev.id];
  if(!u || u.month !== mk) u = library.usage[dev.id] = { month:mk };
  u[kind] = (u[kind] || 0) + 1;
  saveSoon(); // counts go up with the next sync; they never mark the keys as changed
}
function usageTotal(kind){ const mk = isoLocal(today()).slice(0, 7); return Object.values(library.usage).reduce((a, u) => a + (u && u.month === mk ? (u[kind] || 0) : 0), 0); }
let googleSessionToken = null, googleMapsLoadingPromise = null;
function loadGoogleMapsScript(apiKey){
  if(window.google && window.google.maps && window.google.maps.importLibrary) return Promise.resolve();
  if(googleMapsLoadingPromise) return googleMapsLoadingPromise;
  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    try{
      // Google's official bootstrap loader (verbatim), parameterised with the user's key.
      (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key: apiKey, v: "weekly", language: "en"});
      window.google.maps.importLibrary('places').then(() => resolve()).catch(reject);
    }catch(err){ reject(err); }
  });
  googleMapsLoadingPromise.catch(() => { googleMapsLoadingPromise = null; });
  return googleMapsLoadingPromise;
}
async function searchPlacesGoogle(query, cityHint){
  try{
    await loadGoogleMapsScript(gkey());
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await google.maps.importLibrary('places');
    if(!googleSessionToken) googleSessionToken = new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: cityHint ? `${query}, ${cityHint}` : query, sessionToken: googleSessionToken });
    trackApiCall('autocomplete');
    return suggestions.map(s => { const pp = s.placePrediction; if(!pp) return null; return { label: pp.mainText ? pp.mainText.text : pp.text.text, sub: pp.secondaryText ? pp.secondaryText.text : '', googlePrediction: pp }; }).filter(Boolean);
  }catch(e){ console.error('Google suggestions failed, using free search', e); return null; }
}
// Suggestions are tuned for short type-ahead text and can miss longer names that Google Maps finds,
// because Maps uses full Text Search. It bills at the smaller Pro allowance, so it is only a fallback.
async function searchPlacesGoogleText(query, cityHint){
  try{
    await loadGoogleMapsScript(gkey());
    const { Place } = await google.maps.importLibrary('places');
    const { places } = await Place.searchByText({ textQuery: cityHint ? `${query}, ${cityHint}` : query, fields:['displayName','formattedAddress','location'], maxResultCount:8 });
    trackApiCall('textSearch');
    return (places || []).map(p => p.location ? { label: (p.displayName && p.displayName.text) || p.displayName || query, sub: p.formattedAddress || '', lat: p.location.lat(), lon: p.location.lng() } : null).filter(Boolean);
  }catch(e){ console.error('Google name search failed', e); return null; }
}
async function resolveGooglePlace(pp){
  try{
    const place = pp.toPlace();
    // Basic fields only: location and formattedAddress stay in the free Essentials tier.
    await place.fetchFields({ fields:['location','formattedAddress'] });
    trackApiCall('placeDetails'); googleSessionToken = null;
    return place.location ? { lat: place.location.lat(), lon: place.location.lng(), addr: place.formattedAddress || '' } : null;
  }catch(e){ console.error('Could not confirm the Google place', e); return null; }
}
async function searchPlaces(query, cityHint){
  const q = cityHint ? `${query}, ${cityHint}` : query;
  try{
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`);
    const data = await res.json();
    if(!data || !Array.isArray(data.features)) return [];
    return data.features.map(f => {
      const p = f.properties || {}; const c = f.geometry && f.geometry.coordinates; if(!c) return null;
      const street = [p.housenumber, p.street].filter(Boolean).join(' '); const cityLine = [p.postcode, p.city].filter(Boolean).join(' ');
      let parts = [street, p.district, cityLine, p.state && p.state !== p.city ? p.state : null, p.country].filter(Boolean);
      parts = parts.filter((v, i) => i === 0 || v !== parts[i - 1]);
      return { lat:c[1], lon:c[0], label:p.name || p.street || query, sub:parts.join(', ') || 'No address details' };
    }).filter(Boolean);
  }catch(e){ return []; }
}
async function geocodePlace(place, city){
  const r = await searchPlaces(place, city);
  return r && r[0] ? { lat:r[0].lat, lon:r[0].lon } : null;
}
// Free description from Wikipedia. Good for landmarks; a hotel branch rarely has an article.
async function fetchWikipediaSummary(query){
  try{
    const s = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`)).json();
    const hit = s && s.query && s.query.search && s.query.search[0]; if(!hit) return null;
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`); if(!r.ok) return null;
    const j = await r.json(); return j.type === 'disambiguation' ? null : (j.extract || null);
  }catch(e){ return null; }
}

/* ===== city locations for the world map (free lookup, cached on this device) ===== */
function cityName(c){ return String(c || '').split(/\s+to\s+|\s*→\s*|\s*->\s*|\s*\/\s*/i)[0].trim(); }
function tripCities(t){ if(t.kind === 'maponly') return t.cities.filter(Boolean); const s = []; t.days.forEach(d => { const c = cityName(d.city); if(c && !s.some(x => x.toLowerCase() === c.toLowerCase())) s.push(c); }); return s; }
const cityQueue = new Set(); let cityBusy = false;
async function lookupCity(name){
  try{
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=1&lang=en&osm_tag=place`);
    const j = await r.json(); const f = j && j.features && j.features[0];
    if(!f) return { miss:true, at:Date.now() };
    const pr = f.properties || {};
    return { lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], country:pr.country || '', cc:(pr.countrycode || '').toUpperCase(), state:pr.state || '', name:pr.name || name };
  }catch(e){ return null; }
}
function cityGeo(name){
  const k = name.toLowerCase(); const c = library.cityCache[k];
  if(c && !c.miss){ if(c.cc === undefined && !cityQueue.has(k)){ c.cc = ''; cityQueue.add(k); pumpCities(); } return c; } // older entries: look again for the country code
  if(c && c.miss && Date.now() - c.at < 7 * 864e5) return null;
  if(!cityQueue.has(k)){ cityQueue.add(k); pumpCities(); }
  return null;
}
async function pumpCities(){
  if(cityBusy) return; cityBusy = true; let got = false;
  while(cityQueue.size){
    const k = cityQueue.values().next().value;
    const r = await lookupCity(k);
    cityQueue.delete(k);
    if(r){ library.cityCache[k] = r; got = true; }
    await sleep(300);
  }
  cityBusy = false;
  if(!got) return;
  saveSoon();
  const pc = document.getElementById('pcheck');
  if(pc) pc.innerHTML = pastCheckHTML(S.pastForm.cities.split(',').map(s => s.trim()).filter(Boolean));
  else if(S.screen === 'home' && !S.dialog){ footCache.clear(); if(!FPP.user) FPV = null; render(); }
}
// Where a city sits: the looked-up point, or failing that the middle of the trip's pinned places there.
function cityPoint(name, t){
  const g = cityGeo(name); if(g) return g;
  if(!t || t.kind !== 'full') return null;
  const ps = []; t.days.forEach(d => { if(cityName(d.city).toLowerCase() === name.toLowerCase()) d.places.forEach(p => { if(p.lat != null) ps.push(p); }); });
  if(!ps.length) return null;
  return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length, country:'' };
}

/* ===== what has been travelled so far ===== */
// Days and cities count once they have happened: past trips in full, and the trip you're on up to today.
function travelled(t){
  const td = isoLocal(today());
  if(t.kind === 'maponly'){
    const a = t.start, b = okDate(t.end) ? t.end : t.start;
    if(!okDate(a) || a > td) return { days:0, dates:[], cities:[] };
    const end = b < td ? b : td;
    const dates = []; for(let d = new Date(a + 'T12:00:00'); isoLocal(d) <= end; d.setDate(d.getDate() + 1)) dates.push(isoLocal(d));
    return { days:dates.length, dates, cities:t.cities.filter(Boolean) };
  }
  const past = isPast(t);
  const done = t.days.filter(d => okDate(d.date) ? d.date <= td : past);
  const cities = [];
  done.forEach(d => { const c = cityName(d.city); if(c && !cities.some(x => x.toLowerCase() === c.toLowerCase())) cities.push(c); });
  // A past day with no date still counts as a day away; it gets a key of its own.
  return { days:done.length, dates:done.map((d, i) => okDate(d.date) ? d.date : t.id + '#' + i), cities };
}

/* ===== footprint: one world map with every place you've been lit up =====
   WM holds the shapes: each country divided into regions people know (Chinese provinces, US states,
   Japanese prefectures, England/Scotland/Wales, Italian regions…), smaller countries whole, plus the
   country borders. The projection is kept so a city's coordinates can be placed inside its region. */
const WM = %%WORLD2%%;
let wmReady = false;
function wmPrep(){
  if(wmReady) return; wmReady = true;
  WM.units = WM.units.map(([n, cc, cx, cy, w, d]) => {
    const rings = d.split('M').filter(Boolean).map(seg => { const v = seg.match(/-?\d+/g).map(Number); let x = v[0], y = v[1]; const r = [[x, y]]; for(let i = 2; i + 1 < v.length; i += 2){ x += v[i]; y += v[i + 1]; r.push([x, y]); } return r; });
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings.forEach(r => r.forEach(([x, y]) => { if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }));
    return { n, cc, k:cc + ':' + n, c:[cx, cy], w, d, rings, bb:[x0, y0, x1, y1] };
  });
  WM.byKey = {}; WM.units.forEach(u => { WM.byKey[u.k] = u; });
}
function wmProject(lat, lon){ // Natural Earth, turned so Singapore is in the middle
  const P = lat * Math.PI / 180, L = (((lon + WM.rot + 540) % 360) - 180) * Math.PI / 180; const p2 = P * P, p4 = p2 * p2;
  const X = L * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const Y = P * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [WM.t[0] + WM.k * X, WM.t[1] - WM.k * Y];
}
function inRing(x, y, ring){ let c = false; for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){ const [xi, yi] = ring[i], [xj, yj] = ring[j]; if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
// The region a point is in; a point just off a simplified coastline goes to the nearest region within `near` units.
function unitAt(lat, lon, near = 0, only = null){
  wmPrep(); const [x, y] = wmProject(lat, lon); const list = only || WM.units;
  for(const u of list){ if(x < u.bb[0] || x > u.bb[2] || y < u.bb[1] || y > u.bb[3]) continue; let inside = false; u.rings.forEach(g => { if(inRing(x, y, g)) inside = !inside; }); if(inside) return u; }
  if(!near) return null;
  let best = null, bd = near;
  for(const u of list){ if(x < u.bb[0] - near || x > u.bb[2] + near || y < u.bb[1] - near || y > u.bb[3] + near) continue; u.rings.forEach(g => g.forEach(p => { const dd = Math.hypot(p[0] - x, p[1] - y); if(dd < bd){ bd = dd; best = u; } })); }
  return best;
}
const footCache = new Map();
function cityUnit(name, pt){
  const key = name.toLowerCase() + '|' + pt.lat.toFixed(3) + ',' + pt.lon.toFixed(3);
  if(footCache.has(key)) return footCache.get(key);
  let u = unitAt(pt.lat, pt.lon) || unitAt(pt.lat, pt.lon, 8);
  // If the search says the city is in a different country, trust it and pick that country's nearest region.
  const g = library.cityCache[name.toLowerCase()];
  if(g && g.cc && (!u || u.cc !== g.cc)){ const own = WM.units.filter(x => x.cc === g.cc); if(own.length === 1) u = own[0]; else if(own.length) u = unitAt(pt.lat, pt.lon, 60, own) || u; }
  const k = u ? u.k : null; footCache.set(key, k); return k;
}
const COUNTS_AS = { HK:'CN', MO:'CN' }; // for the country count
function footprint(){
  // Older copies are left out, and a day covered by two trips (a map-only trip and a planned one) counts once.
  const lit = {}; let trips = 0; const dates = new Set(), cityNames = new Set();
  realTrips().forEach(t => { const tv = travelled(t); if(tv.days){ trips++; tv.dates.forEach(d => dates.add(d)); tv.cities.forEach(c => cityNames.add(c.toLowerCase())); } });
  const days = dates.size;
  mapCities().forEach(c => {
    const k = cityUnit(c.name, c.pt); if(!k) return;
    const o = lit[k] || (lit[k] = { past:false, cities:[], trips:new Set() });
    o.past = o.past || c.past; if(!o.cities.includes(c.name)) o.cities.push(c.name); c.trips.forEach(t => o.trips.add(t));
  });
  const past = Object.keys(lit).filter(k => lit[k].past);
  const countries = new Set(past.map(k => { const cc = k.split(':')[0]; return COUNTS_AS[cc] || cc; }));
  return { lit, regions:past.length, countries:countries.size, days, trips, cities:cityNames.size };
}

/* ===== cities on the home map ===== */
const realTrips = () => Object.values(library.trips).filter(t => !t.olderCopy);
function mapCities(){
  const out = new Map();
  realTrips().forEach(t => {
    const seen = travelled(t).cities.map(c => c.toLowerCase());
    tripCities(t).forEach(name => {
      const pt = cityPoint(name, t); if(!pt) return;
      const k = name.toLowerCase(); const o = out.get(k) || { name, pt, past:false, trips:[] };
      o.past = o.past || seen.includes(k); o.trips.push(t); out.set(k, o);
    });
  });
  return [...out.values()];
}

/* ===== Google Maps links ===== */
// What a shared link can hold: coordinates (full links), or only the text Google searched for. Links shared
// from the Google Maps app usually open to maps.google.com/?q=<name and address>&ftid=..., with no coordinates.
const COUNTRY_NAMES = (() => { const s = new Set(); try{ const dn = new Intl.DisplayNames(['en'], { type:'region' }); for(let a = 65; a < 91; a++) for(let b = 65; b < 91; b++){ const c = String.fromCharCode(a, b); try{ const n = dn.of(c); if(n && n !== c) s.add(n.toLowerCase()); }catch(e){} } }catch(e){} ['china','japan','south korea','korea','taiwan','hong kong','usa','united states','uk','united kingdom'].forEach(n => s.add(n)); return s; })();
// "China, Chao Zhou Shi, Xiang Qiao Qu, 广济桥 邮政编码: 521021" → name 广济桥, town Chao Zhou Shi.
// "Ichiran Shibuya, 1-22-7 Jinnan, Shibuya City, Tokyo 150-0041, Japan" → name Ichiran Shibuya, town Tokyo.
function splitPlaceText(q){
  const clean = String(q || '').replace(/(邮政编码|郵便番号|우편번호|postal code|postcode|zip)\s*[:：]?\s*[\w-]+/gi, '').replace(/\s+/g, ' ').trim();
  let segs = clean.split(/\s*[,，]\s*/).map(s => s.trim()).filter(Boolean);
  if(segs.length > 1 && COUNTRY_NAMES.has(segs[0].toLowerCase())) segs = segs.slice(1).reverse(); // address written country first
  else if(segs.length > 1 && COUNTRY_NAMES.has(segs[segs.length - 1].toLowerCase())) segs = segs.slice(0, -1);
  const name = (segs[0] || clean).replace(/\s+\d{3}-?\d{3,4}$/, '').trim();
  const town = segs.length > 2 ? segs[segs.length - 1].replace(/\s+[\d-]{4,}$/, '').trim() : (segs[1] || '');
  return { query:clean, name, town };
}
// "Chao Zhou Shi" → "chaozhou", so it matches the "Chaozhou" a search result gives.
const townKey = s => String(s || '').toLowerCase().replace(/\b(shi|qu|xian|zhen|city|ku|shi district|district|prefecture|province)\b/g, '').replace(/[^a-zÀ-ɏ一-鿿]/g, '');
const stripTown = s => String(s || '').replace(/\s+(Shi|Qu|Xian|Zhen|City|Ku)$/i, '').trim();
// Distance in km between two {lat, lon} points.
function nearKm(a, b){ const R = Math.PI / 180, x = (b.lon - a.lon) * R * Math.cos((a.lat + b.lat) / 2 * R), y = (b.lat - a.lat) * R; return Math.hypot(x, y) * 6371; }
function parseMaps(text){
  const raw = (text || '').trim(); if(!raw) return { kind:'empty' };
  const urlM = raw.match(/https?:\/\/\S+/); const t = urlM ? urlM[0] : raw;
  const lines = raw.split(/\n+/).map(s => s.trim()).filter(s => s && !/^https?:\/\//.test(s));
  const num = '(-?\\d{1,3}\\.\\d+)';
  // !3d…!4d… and q=lat,lon are the place itself. @lat,lon is only where the map was centred.
  const m = t.match(new RegExp('!3d' + num + '!4d' + num))
    || t.match(new RegExp('[?&](?:q|query|ll|destination|center|daddr)=' + num + '(?:,|%2C)\\s*\\+?' + num))
    || t.match(new RegExp('/(?:search|place|dir)/' + num + '(?:,|%2C)\\+?' + num));
  const view = !m && t.match(new RegExp('@' + num + ',' + num));
  const placeM = t.match(/\/maps\/place\/([^/@?]+)/); const qM = t.match(/[?&](?:q|query)=([^&#]+)/);
  const dec = s => { try{ return decodeURIComponent(s.replace(/\+/g, ' ')); }catch(e){ return s.replace(/\+/g, ' '); } };
  const text2 = placeM ? dec(placeM[1]) : qM ? dec(qM[1]) : (lines[0] || '');
  const parts = /^-?\d/.test(text2) ? { query:'', name:'', town:'' } : splitPlaceText(text2);
  if(m) return { kind:'coords', lat:+m[1], lon:+m[2], name:parts.name || 'Pinned place', via:'link' };
  if(view) return Object.assign({ kind:'coords', lat:+view[1], lon:+view[2], via:'view' }, parts, { name:parts.name || 'Pinned place' });
  if(/maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs/.test(t)) return Object.assign({ kind:'short', url:t }, parts);
  if(/google\.[a-z.]+\/maps|maps\.google\.|google\.[a-z.]+\/\?q=/.test(t) && parts.query) return Object.assign({ kind:'nameonly' }, parts);
  if(!urlM && parts.query) return Object.assign({ kind:'nameonly' }, parts); // pasted a name or an address
  return { kind:'unknown' };
}
// Finds a place from the text in a link: Google if there is a key, otherwise the free search, trying
// a few wordings and preferring a result in the right town.
async function findFromText(p){
  const hint = addCityHint();
  if(gkey()){ const g = await searchPlacesGoogleText(p.query, ''); if(g && g.length) return g[0]; }
  const tk = townKey(p.town || hint);
  const tries = [];
  if(p.town) tries.push([`${p.name} ${stripTown(p.town)}`, '']);
  if(hint && !p.town) tries.push([p.name, hint]);
  tries.push([p.name, '']);
  if(p.query && p.query !== p.name) tries.push([p.query, '']);
  let first = null;
  for(const [q, h] of tries){
    const res = await searchPlaces(q, h);
    if(!res.length) continue;
    if(!first) first = res[0];
    const inTown = tk ? res.find(r => townKey(r.sub).includes(tk)) : res[0];
    if(inTown) return inTown;
  }
  return first;
}
let linkSeq = 0;
async function resolveLink(){
  const seq = ++linkSeq; let r = parseMaps(S.link);
  if(r.kind === 'short'){
    if(!library.helperUrl){ S.linkRes = { kind:'nohelper' }; paintLink(); return; }
    S.linkRes = { kind:'loading' }; paintLink();
    try{
      const res = await fetch(library.helperUrl + (library.helperUrl.includes('?') ? '&' : '?') + 'u=' + encodeURIComponent(r.url));
      const j = await res.json(); if(seq !== linkSeq) return;
      const r2 = j && j.url ? parseMaps(j.url) : { kind:'unknown' };
      const parts = j && j.q ? splitPlaceText(j.q) : r2;
      // The name: from the link if it has one, else from the reader's search text, else what was pasted with it.
      const name = [r2.name, parts.name, r.name].find(n => n && n !== 'Pinned place') || 'Pinned place';
      const geo = j && typeof j.lat === 'number' ? { kind:'coords', lat:j.lat, lon:j.lon, name, addr:j.address || '', via:'helper' } : null;
      if(r2.kind === 'coords' && r2.via === 'link') r = Object.assign(r2, { via:'helper', name });
      else if(r2.kind === 'coords') r = geo && nearKm(geo, r2) < 30 ? geo : Object.assign(r2, { name, query:parts.query || r2.query || r.query || '' });
      else if(geo) r = geo;
      else if(parts && parts.query) r = Object.assign({ kind:'nameonly' }, parts);
      else r = { kind:'helperfail', detail:j && j.error };
    }catch(e){ if(seq !== linkSeq) return; r = { kind:'helperfail' }; }
  }
  // Only the map's centre is known: search for the place by name and use it if it is nearby.
  if(r.kind === 'coords' && r.via === 'view' && r.query){
    S.linkRes = { kind:'loading' }; paintLink();
    const hit = await findFromText(r);
    if(seq !== linkSeq) return;
    if(hit && nearKm(hit, r) < 30) r = { kind:'coords', lat:hit.lat, lon:hit.lon, name:r.name, addr:hit.sub, found:hit.label, via:'name' };
  }
  if(r.kind === 'nameonly'){
    S.linkRes = { kind:'loading' }; paintLink();
    const hit = await findFromText(r);
    if(seq !== linkSeq) return;
    r = hit ? { kind:'coords', lat:hit.lat, lon:hit.lon, name:r.name, addr:hit.sub, found:hit.label, via:'name' } : { kind:'notfound', name:r.name };
  }
  S.linkRes = r; paintLink();
}
function linkResHTML(){
  const r = S.linkRes || { kind:'empty' };
  if(r.kind === 'empty') return `<p class="sub">In Google Maps, tap Share, then Copy link, and paste it here. Short and full links both work.</p>`;
  if(r.kind === 'loading') return `<p class="sub">Reading the link…</p>`;
  if(r.kind === 'coords') return `<div class="result ok">${I('check')}<div><span class="num">${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</span>${r.found && r.found !== r.name ? ` <span>${esc(r.found)}</span>` : ''}${r.addr ? `<br><span>${esc(r.addr)}</span>` : ''}<br><span>${r.via === 'helper' ? 'Found through your short-link reader.' : r.via === 'name' ? 'The link had no exact location, so the pin comes from a search. Check it on the map after adding.' : r.via === 'view' ? 'The link only shows the area of the map, so the pin is roughly there. Check it on the map after adding.' : 'The location was read straight from the link.'}</span></div></div>
    <div class="field"><label for="lname">Name</label><input id="lname" class="input" data-in="lname" value="${esc(r.name)}"></div>`;
  if(r.kind === 'nohelper') return `<div class="result warn">${I('alert')}<div><b>Short links need the short-link reader</b><span>Set it up once in Settings. For now, search by name, or add it without a location and drop a pin.</span></div></div>`;
  if(r.kind === 'helperfail') return `<div class="result warn">${I('alert')}<div><b>The short-link reader didn't answer</b><span>${r.detail ? esc(r.detail) + '. ' : ''}Check the reader in Settings, or search by name for now.</span></div></div>`;
  if(r.kind === 'notfound') return `<div class="result warn">${I('alert')}<div><b>Couldn't find “${esc(r.name)}”</b><span>Add it without a location and drop a pin on the map.</span></div></div>`;
  return `<div class="result warn">${I('alert')}<div><b>This isn't a Google Maps link</b><span>Copy the link from the Share button in Google Maps and paste it here.</span></div></div>`;
}
function paintLink(){ const el = document.getElementById('alinkres'); if(el) el.innerHTML = linkResHTML(); }

/* ===== GitHub sync ===== */
const sync = Object.assign({ token:'', repo:DATA_REPO_DEFAULT, expires:'', meta:{}, deleted:{}, settingsSha:'', settingsDirty:false, lastSync:'', status:'', error:'' }, readJSON(LS_SYNC) || {});
function saveSync(){ writeJSON(LS_SYNC, sync); }
function syncMeta(id){ return sync.meta[id] || (sync.meta[id] = { sha:'', dirty:true }); }
let syncTimer = null, syncing = false, syncAgain = false;
function syncSoon(ms = 60000){ if(!sync.token) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms); if(S.syncState !== 'saving'){ S.syncState = 'pending'; paintSync(); } }
function b64encode(str){ const bytes = new TextEncoder().encode(str); let bin = ''; for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64decode(b64){ const bin = atob(String(b64).replace(/\s/g, '')); const bytes = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
async function gh(path, opts = {}){
  const res = await fetch('https://api.github.com/repos/' + sync.repo + path, Object.assign({ cache:'no-store' }, opts, {
    headers:Object.assign({ Authorization:'Bearer ' + sync.token, Accept:'application/vnd.github+json' }, opts.body ? { 'Content-Type':'application/json' } : {}),
  }));
  // "Not found" only means a missing file when reading one. For writes it means no access.
  if(res.status === 404 && (!opts.method || opts.method === 'GET')) return null;
  if(!res.ok){ const e = new Error('GitHub ' + res.status); e.status = res.status; try{ e.detail = (await res.json()).message; }catch(_){} throw e; }
  return res.status === 204 ? {} : res.json();
}
async function ghGet(path){ const j = await gh('/contents/' + path); return j && j.content != null ? { sha:j.sha, data:JSON.parse(b64decode(j.content)) } : null; }
async function ghPut(path, data, sha, msg){ const j = await gh('/contents/' + path, { method:'PUT', body:JSON.stringify({ message:msg, content:b64encode(JSON.stringify(data, null, 1)), sha:sha || undefined }) }); return j && j.content ? j.content.sha : ''; }
// Uploads a trip. If it was edited while uploading, it stays marked for the next sync.
async function pushTrip(id, sha, msg){ const m = syncMeta(id); const v = m.v || 0; const t = library.trips[id]; m.sha = await ghPut(`trips/${id}.json`, t, sha, msg + ' ' + (t.tripName || 'a trip')); m.dirty = (m.v || 0) !== v; }
async function ghDelete(path, sha, msg){ await gh('/contents/' + path, { method:'DELETE', body:JSON.stringify({ message:msg, sha }) }); }
const sameContent = (a, b) => JSON.stringify({ n:a.tripName, d:a.days, e:a.expenses, c:a.cities }) === JSON.stringify({ n:b.tripName, d:b.days, e:b.expenses, c:b.cities });
function keepCopy(t){ const c = JSON.parse(JSON.stringify(t)); c.id = uid(); c.tripName = (t.tripName || 'Untitled trip') + ' (older copy)'; c.olderCopy = true; library.trips[c.id] = c; syncMeta(c.id).dirty = true; return c; }
async function syncSettings(){
  const r = await ghGet('settings.json'); const remote = r ? r.data : {};
  let changedLocal = false;
  // Keys changed on this device win; otherwise what another device saved is taken up here, a removed key
  // included. On this device's first sync an empty remote value doesn't wipe a key it already has.
  const synced = !!sync.settingsSha;
  if(!sync.settingsDirty && r) SHARED_KEYS.forEach(k => { if(typeof remote[k] === 'string' && (remote[k] || synced) && remote[k] !== library[k]){ library[k] = remote[k]; changedLocal = true; } });
  const usage = Object.assign({}, remote.usage || {}); if(library.usage[dev.id]) usage[dev.id] = library.usage[dev.id];
  Object.keys(usage).forEach(k => { if(k !== dev.id) library.usage[k] = usage[k]; });
  const out = Object.assign(sharedOf(library), { usage });
  if(!r || JSON.stringify(out) !== JSON.stringify(Object.assign(sharedOf(remote), { usage:remote.usage || {} }))){
    sync.settingsSha = await ghPut('settings.json', out, r && r.sha, 'Update settings');
  } else sync.settingsSha = r.sha;
  sync.settingsDirty = false;
  return changedLocal;
}
async function syncNow(){
  clearTimeout(syncTimer);
  if(!sync.token) return;
  if(syncing){ syncAgain = true; return; }
  if(!navigator.onLine){ S.syncState = 'offline'; paintSync(); return; }
  syncing = true; S.syncState = 'saving'; paintSync();
  saveNow();
  const before = JSON.stringify([library.trips, sharedOf(library)]);
  try{
    // GitHub answers "not found" for a private repo the token can't see, so check the repo itself first.
    const info = await gh('');
    if(!info) throw Object.assign(new Error('no repo'), { status:404, detail:`Can't find ${sync.repo}, or the token isn't allowed to open it. Check the repo name, and that the token's Repository access includes it.` });
    if(!info.private) throw Object.assign(new Error('public repo'), { status:451, detail:`${sync.repo} is public, so anyone could read your trips and Google key. Nothing was saved there. Make the repo private on GitHub (Settings, Danger zone, Change visibility), then sync again.` });
    if(info.permissions && info.permissions.push === false) throw Object.assign(new Error('read only'), { status:403 });
    const list = await gh('/contents/trips');
    const remote = {}; (Array.isArray(list) ? list : []).forEach(f => { if(f.name.endsWith('.json')) remote[f.name.slice(0, -5)] = f.sha; });
    await syncSettings();
    for(const [id, sha] of Object.entries(sync.deleted)){
      if(remote[id]) await ghDelete(`trips/${id}.json`, remote[id], 'Delete a trip');
      delete remote[id]; delete sync.deleted[id]; delete sync.meta[id];
    }
    const downloaded = {};
    for(const [id, sha] of Object.entries(remote)){
      const m = sync.meta[id]; const local = library.trips[id];
      if(local && m && m.sha === sha){ if(m.dirty) await pushTrip(id, sha, 'Save'); continue; }
      const got = await ghGet(`trips/${id}.json`); if(!got) continue;
      const data = migrateState(got.data); data.id = id;
      if(!local){ library.trips[id] = data; sync.meta[id] = { sha:got.sha, dirty:false }; downloaded[id] = data; continue; }
      if(!m || !m.dirty){ library.trips[id] = data; sync.meta[id] = { sha:got.sha, dirty:false }; continue; }
      // Edited on both devices since the last sync: the newer edit wins, the older is kept as a copy.
      if(!sameContent(local, data)){
        if(local.updatedAt >= data.updatedAt){ keepCopy(data); }
        else { keepCopy(local); library.trips[id] = data; sync.meta[id] = { sha:got.sha, dirty:false }; continue; }
      }
      await pushTrip(id, got.sha, 'Save');
    }
    for(const [id, t] of Object.entries(library.trips)){
      if(remote[id] || downloaded[id]) continue;
      const m = sync.meta[id];
      if(m && m.sha && !m.dirty){ delete library.trips[id]; delete sync.meta[id]; continue; } // deleted on another device
      // Same trip loaded from a backup on two devices before sync existed: match on name and creation time.
      const twin = Object.values(downloaded).find(d => d.createdAt === t.createdAt && d.tripName === t.tripName);
      if(twin){
        if(sameContent(twin, t)){ delete library.trips[id]; delete sync.meta[id]; if(library.activeTripId === id) library.activeTripId = twin.id; continue; }
        if(t.updatedAt < twin.updatedAt){ t.tripName = (t.tripName || 'Untitled trip') + ' (older copy)'; t.olderCopy = true; }
        else {
          // This device's copy is newer: it takes the synced trip's place, the synced one is kept as a copy.
          keepCopy(twin);
          const mine = JSON.parse(JSON.stringify(t)); mine.id = twin.id; library.trips[twin.id] = mine;
          delete library.trips[id]; delete sync.meta[id]; syncMeta(twin.id).dirty = true;
          if(library.activeTripId === id) library.activeTripId = twin.id;
          continue;
        }
      }
      syncMeta(id).sha = ''; await pushTrip(id, '', 'Add');
    }
    for(const [id, m] of Object.entries(sync.meta)){ if(m.dirty && library.trips[id]) await pushTrip(id, m.sha || '', 'Save'); }
    Object.keys(sync.meta).forEach(id => { if(!library.trips[id]) delete sync.meta[id]; });
    if(!library.trips[library.activeTripId]) library.activeTripId = Object.keys(library.trips)[0] || null;
    sync.lastSync = new Date().toISOString(); sync.status = 'ok'; sync.error = '';
    S.syncState = 'synced';
  }catch(e){
    console.error('Sync failed', e);
    if(e.status === 401){ sync.status = 'stopped'; sync.error = 'GitHub turned the token down. It may have expired.'; }
    else if(e.detail && (e.status === 404 || e.status === 451)){ sync.status = 'error'; sync.error = e.detail; }
    else if(e.status === 409 || (e.status === 404 && /empty/i.test(e.detail || ''))){ sync.status = 'error'; sync.error = `${sync.repo} has no files yet. On GitHub, open it and choose "creating a new file" or add a README, then sync again.`; }
    else if(e.status === 404){ sync.status = 'error'; sync.error = `GitHub refused to save to ${sync.repo}. Give the token Contents read and write access to that repo.`; }
    else if(e.status === 403){ sync.status = 'error'; sync.error = 'The token cannot write to ' + sync.repo + '. Give it Contents read and write access to that repo.'; }
    else if(!navigator.onLine || e instanceof TypeError){ sync.status = 'offline'; sync.error = ''; }
    else { sync.status = 'error'; sync.error = (e.detail || e.message || 'Unknown problem'); }
    S.syncState = sync.status;
  }finally{
    syncing = false; saveSync(); saveNow();
    // Only redraw when something arrived from another device, and never under someone's typing.
    const typing = document.activeElement && document.activeElement.matches('input, textarea, select');
    const arrived = before !== JSON.stringify([library.trips, sharedOf(library)]);
    const bannerChanged = !!document.querySelector('.banner') !== !!syncBanner();
    if((arrived || bannerChanged) && !typing && !S.dialog && !drag) render();
    else paintSync();
    if(syncAgain){ syncAgain = false; syncSoon(2000); }
  }
}
function tokenDaysLeft(){ return okDate(sync.expires) ? daysUntil(sync.expires) : null; }
function syncInfo(){
  if(!sync.token) return { ic:'cloud-off', short:'This device', long:'Saved on this device only', s:'local' };
  const st = S.syncState || sync.status;
  if(st === 'stopped') return { ic:'alert', short:'Sync stopped', long:'Sync stopped, the token was refused', s:'stopped' };
  if(st === 'error') return { ic:'alert', short:'Sync problem', long:'Sync problem, see Settings', s:'stopped' };
  if(st === 'saving') return { ic:'cloud-up', short:'Syncing', long:'Saving to GitHub', s:'saving' };
  if(st === 'offline') return { ic:'cloud-off', short:'Offline', long:'Offline, saved on this device', s:'offline' };
  const dl = tokenDaysLeft();
  if(dl != null && dl <= 14) return { ic:'alert', short:'Token expiring', long:dl < 0 ? 'Sync token has expired' : `Sync token expires in ${dl} ${dl === 1 ? 'day' : 'days'}`, s:'expiring' };
  if(st === 'pending') return { ic:'cloud-up', short:'Saved here', long:'Saved here, syncs in a minute', s:'saving' };
  return { ic:'cloud', short:'Synced', long:sync.lastSync ? 'Synced ' + ago(sync.lastSync) : 'Synced', s:'synced' };
}
function ago(iso){ const m = Math.round((Date.now() - new Date(iso)) / 60000); if(m < 1) return 'just now'; if(m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`; const h = Math.round(m / 60); if(h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`; return 'on ' + new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' }); }
function paintSync(){ const b = document.querySelector('.syncbtn[data-act="syncbtn"]'); if(!b) return; const sy = syncInfo(); b.dataset.s = sy.s; b.setAttribute('aria-label', sy.long); b.innerHTML = `${I(sy.ic)}<span class="synctext">${esc(sy.long)}</span><span class="syncshort">${esc(sy.short)}</span>`; }

/* ===== backups ===== */
function download(name, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = s => (s || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'trip';
function exportTrip(t){ download(slug(t.tripName) + '-backup.json', t); }
// Keys and tokens never go into a downloaded file.
function exportAll(){ download(`milo-and-miles-all-trips-${isoLocal(today())}.json`, { app:'milo-and-miles', version:2, exportedAt:new Date().toISOString(), trips:Object.values(library.trips) }); }
function importBackup(text){
  let parsed; try{ parsed = JSON.parse(text); }catch(e){ toast('Could not read that file. Pick a backup downloaded from Milo & Miles or Trip Tracker.'); return; }
  let list = [];
  if(parsed && Array.isArray(parsed.trips)) list = parsed.trips;
  else if(parsed && parsed.trips && typeof parsed.trips === 'object') list = Object.values(parsed.trips);
  else if(parsed && Array.isArray(parsed.days)) list = [parsed];
  list = list.filter(x => x && typeof x === 'object' && (Array.isArray(x.days) || x.kind === 'maponly'));
  if(!list.length){ toast('This file doesn\'t look like a trip backup.'); return; }
  let last = null;
  list.forEach(x => { const t = migrateState(Object.assign(defaultTrip(), x, { id:uid() })); if(!t.tripName) t.tripName = 'Imported trip'; library.trips[t.id] = t; syncMeta(t.id).dirty = true; last = t; });
  library.activeTripId = last.id; S.day = 0; S.screen = list.length === 1 ? 'overview' : 'home';
  saveNow(); syncSoon(3000); render(); window.scrollTo(0, 0);
  announce(list.length === 1 ? `Loaded ${last.tripName}` : `Loaded ${list.length} trips`);
}
