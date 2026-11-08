
/* ===== shell ===== */
function bar(){
  const t = T(); const during = t && tripDayIndex(t) > -1; const sy = syncInfo();
  const tab = (k, l, extra = '') => `<button type="button" class="tab" data-act="nav" data-to="${esc(k)}" ${S.screen === k ? 'aria-current="page"' : ''} ${k !== 'home' && !t ? 'disabled' : ''}>${l}${extra}</button>`;
  return `<header class="bar"><div class="wrap bar-in">
    <button type="button" class="wordmark" data-act="nav" data-to="home" aria-label="Milo &amp; Miles, home">${I('plane')}Milo &amp; Miles</button>
    <nav class="tabs" aria-label="Sections">${tab('home','Home')}${tab('overview','Overview')}${tab('itinerary','Itinerary', during ? ' <span class="today">Today</span>' : '')}${tab('budget','Budget')}</nav>
    <div class="bar-right">
      <button type="button" class="syncbtn" data-act="syncbtn" data-s="${sy.s}" aria-label="${esc(sy.long)}">${I(sy.ic)}<span class="synctext">${esc(sy.long)}</span><span class="syncshort">${esc(sy.short)}</span></button>
      <button type="button" class="syncbtn setbtn" data-act="nav" data-to="settings" aria-label="Settings" ${S.screen === 'settings' ? 'aria-current="page"' : ''}>${I('gear')}<span class="synctext">Settings</span></button>
    </div></div></header>`;
}
function syncBanner(){
  if(S.saveFail) return `<div class="banner bad"><span>This device's storage is full or blocked, so the latest changes aren't saved here. Download a backup now.</span><button type="button" class="btn" data-act="exportall">Download all trips</button></div>`;
  if(!sync.token) return '';
  const sy = syncInfo();
  if(sy.s === 'expiring') return `<div class="banner"><span>${tokenDaysLeft() < 0 ? 'Your GitHub token has expired.' : `Your GitHub token expires in ${tokenDaysLeft()} ${tokenDaysLeft() === 1 ? 'day' : 'days'}.`} Make a new one so sync keeps working.</span><button type="button" class="btn" data-act="dialog" data-d="token">Renew the token</button></div>`;
  if(sync.status === 'stopped') return `<div class="banner bad"><span>Sync stopped because GitHub turned the token down. Changes are still saved on this device.</span><button type="button" class="btn" data-act="dialog" data-d="token">Paste a new token</button></div>`;
  if(sync.status === 'error') return `<div class="banner bad"><span>Sync problem: ${esc(sync.error)}</span><button type="button" class="btn" data-act="nav" data-to="settings">Open Settings</button></div>`;
  return '';
}
// The trip's heading: name, dates, days (and spending). `extra` goes in the same panel, such as the day tabs.
function pageHead(showSpent = false, extra = ''){
  const t = T(); const tt = totals(t);
  return `<div class="headpanel"><header class="pagehead"><div><label class="visually-hidden" for="tripName">Trip name</label><input id="tripName" class="titleinput" data-in="tripname" value="${esc(t.tripName)}" placeholder="Name this trip"></div>
    <dl class="meta"><div><dt>Dates</dt><dd>${range(tripStart(t), tripEnd(t))}</dd></div><div><dt>Days</dt><dd>${t.kind === 'full' ? t.days.length : tripLen(t)}</dd></div>${showSpent ? `<div><dt>Spent</dt><dd>${fmt(t.baseCurrency, tt.all)}</dd></div>` : ''}</dl></header>${extra}</div>`;
}
const tripLabel = t => t.tripName || 'Untitled trip';

/* ===== Home ===== */
function scrHome(){
  const trips = Object.values(library.trips);
  const next = trips.filter(isUpcoming).sort((a, b) => tripStart(a).localeCompare(tripStart(b)))[0];
  const now = findTodayTrip();
  const band = now
    ? `<section class="todayband" aria-label="Today"><div class="nt"><p>Day ${now.i + 1}${now.t.days[now.i].city ? ' in ' + esc(now.t.days[now.i].city) : ''}</p><span>${esc(tripLabel(now.t))}, ${dLong(now.t.days[now.i].date)}</span></div><button type="button" class="btn btn--primary" data-act="gotoday">Open today's plan</button></section>`
    : next ? `<section class="todayband" aria-label="Next trip"><div class="nt"><p>${esc(tripLabel(next))} starts ${startsIn(daysUntil(tripStart(next)))}</p><span>${dLong(tripStart(next))}${tripCities(next).length ? '. ' + tripCities(next).map(esc).join(', ') : ''}</span></div><button type="button" class="btn btn--primary" data-act="opentrip" data-id="${esc(next.id)}">Open trip</button></section>` : '';
  const sorted = trips.slice().sort((a, b) => (tripStart(b) || '9999').localeCompare(tripStart(a) || '9999'));
  const rows = sorted.map(t => {
    const st = tripStart(t), en = tripEnd(t);
    const live = now && now.t === t; const up = isUpcoming(t); const done = isPast(t);
    const status = live ? 'Travelling now' : up ? `Starts ${startsIn(daysUntil(st))}` : done ? (t.kind === 'maponly' ? 'Map-only' : `${I('check','sm')}Done`) : okDate(st) ? 'Travelling now' : 'Being planned';
    const len = tripLen(t);
    return `<tr><td><button type="button" class="row-open" data-act="opentrip" data-id="${esc(t.id)}">${esc(tripLabel(t))}</button></td><td class="num">${range(st, en)}${len ? `<br><span class="sub">${len} ${len === 1 ? 'day' : 'days'}</span>` : ''}</td><td>${tripCities(t).map(esc).join(', ') || '<span class="sub">No towns yet</span>'}</td><td><span class="status ${done ? 'done' : 'now'}">${status}</span></td>
      <td><button type="button" class="iconbtn" data-act="askdeltrip" data-id="${esc(t.id)}" aria-label="Delete ${esc(tripLabel(t))}">${I('x')}</button></td></tr>`;
  }).join('');
  return `<div class="screen">${syncBanner()}${band}
    <section class="worldfig box" aria-labelledby="h-world"><h1 id="h-world">Where you've been</h1>
      ${footHTML()}
    </section>
    <section class="box" aria-labelledby="h-trips"><div class="sechead"><h2 id="h-trips">${I('plane')}Your trips</h2><div class="chips"><button type="button" class="btn" data-act="dialog" data-d="past">${I('plus','sm')}Add a past trip</button><button type="button" class="btn btn--primary" data-act="dialog" data-d="newtrip">${I('plus','sm')}New trip</button></div></div>
      ${trips.length ? `<div class="tablewrap"><table class="trips"><thead><tr><th scope="col">Trip</th><th scope="col">Dates</th><th scope="col">Cities</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Delete</span></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="sub" style="margin-top:var(--space-md)">Map-only trips just pin their cities. Open one to plan it day by day.</p>`
      : `<p class="empty">No trips yet. Start a new one, or add past trips so they show on the map. Moving from another device? Load a backup in <button type="button" class="link" data-act="nav" data-to="settings">Settings</button>.</p>`}
    </section></div>`;
}
const startsIn = n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;

/* ===== screens for a trip that has no days yet, or is map-only ===== */
function noDaysHTML(t){
  if(t.kind === 'maponly') return `<section class="box mapnote" aria-labelledby="h-mo"><h2 id="h-mo">Map-only trip</h2><p>It pins its cities on your world map. Edit them here, or plan the trip day by day.</p>
    <div class="grid2"><div class="field"><label for="mofrom">First day</label><input id="mofrom" type="date" class="input" data-in="mofrom" value="${esc(t.start)}"></div><div class="field"><label for="moto">Last day</label><input id="moto" type="date" class="input" data-in="moto" value="${esc(t.end)}"></div></div>
    <div class="field"><label for="mocities">Cities</label><input id="mocities" class="input" data-in="mocities" value="${esc(t.cities.join(', '))}" aria-describedby="moc-help"><span class="help" id="moc-help">Separate cities with commas.</span></div>
    <div><button type="button" class="btn btn--primary" data-act="planfull">Plan it day by day</button></div></section>`;
  return `<section class="box mapnote" aria-labelledby="h-nd"><h2 id="h-nd">No days yet</h2><p>Pick the first day of the trip. You can add more days after.</p>
    <div class="field" style="max-width:16rem"><label for="firstday">First day</label><input id="firstday" type="date" class="input" value="${isoLocal(today())}"></div>
    <div><button type="button" class="btn btn--primary" data-act="firstday">Add the first day</button></div></section>`;
}

/* ===== Overview ===== */
function spendSummary(t){
  const tt = totals(t); const cats = CATS.filter(c => tt.by[c.k]);
  return `<section class="summary box" aria-labelledby="h-spent">
      <div><h2 id="h-spent" class="visually-hidden">Spending</h2><p class="sub">Spent so far, in ${esc(t.baseCurrency)}</p><p class="figure">${fmt(t.baseCurrency, tt.all)}</p><p class="sub">${rateLine(t)}</p></div>
      ${cats.length ? `<dl class="bars">${barRows(t, tt, cats)}</dl>` : `<p class="sub">No expenses yet. <button type="button" class="link" data-act="nav" data-to="budget">Add them in Budget</button></p>`}
    </section>`;
}
function barRows(t, tt, cats){ return cats.map(c => `<dt><span class="cat-ic c-${CATKEY[c.k]}">${I(c.ic,'sm')}</span>${esc(c.k)}</dt><dd><span class="track"><span class="fill c-${CATKEY[c.k]}" style="width:${(tt.by[c.k] / tt.all * 100).toFixed(1)}%"></span></span></dd><dd class="v">${fmt(t.baseCurrency, tt.by[c.k])}</dd>`).join(''); }
function scrOverview(){
  const t = T(); const ti = tripDayIndex(t);
  if(!t.days.length) return `<div class="screen">${syncBanner()}${pageHead()}${t.expenses.length ? spendSummary(t) : ''}${noDaysHTML(t)}</div>`;
  const days = t.days.map((d, i) => {
    const hotels = [...new Set(d.places.filter(p => p.type === 'hotel').map(p => p.name))];
    const plan = planOf(d);
    const rows = plan.map(e => {
      if(e.kind === 'divider') return '<li class="anytime">Any time</li>';
      const grip = (what, idx, name) => `<button type="button" class="handle" data-drag="ov" data-what="${what}" data-day="${esc(i)}" data-idx="${esc(idx)}" aria-label="Move ${esc(name)}: drag, or use arrow keys (up and down within the day, left and right to another day)">${I('grip')}</button>`;
      if(e.kind === 'place'){ const p = e.p; return `<li class="ovrow" data-row="p:${esc(i)}:${esc(e.pi)}"><span class="pt">${esc(e.t || '')}</span>${grip('p', e.pi, p.name)}<span class="badge c-${p.category}">${e.n}</span><div class="ovtext"><b><span class="cat-ic c-${p.category}">${I(placeIcon(p),'sm')}</span>${esc(p.name)}</b>${p.note ? `<span class="ovnote">${esc(p.note)}</span>` : ''}</div></li>`; }
      if(e.kind === 'step') return `<li class="ovrow" data-row="s:${esc(i)}:${esc(e.k)}"><span class="pt">${esc(e.t || '')}</span>${grip('s', e.k, e.d || 'this step')}<span class="badge c-${esc(e.sk)}">${e.n}</span><div class="ovtext"><b><span class="cat-ic c-${esc(e.sk)}">${I(STEPIC[e.sk],'sm')}</span>${esc(e.d) || 'No description'}</b></div></li>`;
      const fp = e.p; const lands = e.t && e.t === fp.arriveTime && fp.arriveTime !== fp.departTime;
      return `<li class="ovrow" data-row="f:${esc(i)}:${esc(e.pi)}"><span class="pt">${esc(e.t || '')}</span><span></span><span class="badge c-air">${e.n}</span><div class="ovtext"><b><span class="cat-ic c-air">${I('plane','sm')}</span>${esc(fp.name)}</b><span class="ovnote">${e.t ? `${lands ? 'Lands' : 'Departs'} ${esc(e.t)}` : 'Times not set'}${fp.note ? '. ' + esc(fp.note) : ''}</span></div></li>`;
    }).join('');
    return `<li class="ov-day" data-day="${esc(i)}">
      <div class="ov-when"><b>Day ${i + 1}</b><span>${dMid(d.date)}</span>${i === ti ? '<span class="now">Today</span>' : ''}</div>
      <div class="ov-body">
        <h3><button type="button" class="row-open" data-act="day" data-i="${esc(i)}">${esc(d.city) || 'Where to?'}</button></h3>
        ${hotels.length ? `<ul class="facts">${hotels.map(h => `<li><span class="cat-ic c-hotel">${I('bed','sm')}</span>${esc(h)}</li>`).join('')}</ul>` : ''}
        ${d.notes ? `<p class="ovdaynote">${esc(d.notes)}</p>` : ''}
        ${plan.length ? `<ol class="ovplan">${rows}</ol>` : '<p class="sub">Nothing planned yet. Drop a place here from another day.</p>'}
      </div>
      <div class="ov-move"><button type="button" class="btn btn--quiet daymove" data-act="moveday" data-i="${esc(i)}" data-d="-1" aria-label="Move Day ${i + 1} earlier" ${i === 0 ? 'disabled' : ''}>${I('up','sm')}<span class="lbl">Earlier</span></button><button type="button" class="btn btn--quiet daymove" data-act="moveday" data-i="${esc(i)}" data-d="1" aria-label="Move Day ${i + 1} later" ${i === t.days.length - 1 ? 'disabled' : ''}>${I('down','sm')}<span class="lbl">Later</span></button></div>
    </li>`;
  }).join('');
  return `<div class="screen">${syncBanner()}${pageHead()}
    ${spendSummary(t)}
    ${tripMapPanel('ov')}
    <section aria-labelledby="h-days"><div class="sechead"><h2 id="h-days">Day by day</h2><button type="button" class="btn btn--quiet" data-act="print">${I('print','sm')}Save as PDF</button></div>
      <div class="ovkey"><ul class="legend" aria-label="Key">${[['attraction','pin','Sight'],['food','bowl','Food'],['activity','flag','Activity'],['transport','train','Transport'],['air','plane','Flight'],['hotel','bed','Hotel']].map(([c, ic, l]) => `<li><span class="keydot c-${c}"></span><span class="cat-ic c-${c}">${I(ic,'sm')}</span>${l}</li>`).join('')}</ul>
      <p class="sub">Drag a stop by its handle to move it to another day, or select the handle and use the arrow keys. Earlier and Later swap whole days; the dates stay in order.</p></div>
      <ol class="daylist">${days}</ol>
      <div style="margin-top:var(--space-lg)"><button type="button" class="btn" data-act="addday">${I('plus','sm')}Add a day</button></div></section></div>`;
}

/* ===== Itinerary ===== */
function moveSelect(id, attrs, i){ const t = T(); return `<div class="item-tools"><label for="${id}">Move to</label><select id="${id}" ${attrs}>${t.days.map((d, j) => `<option value="${esc(j)}" ${j === i ? 'selected' : ''}>${esc(dayLabel(d, j))}</option>`).join('')}</select></div>`; }
function itemHTML(p, i, pi, t = null, n = null){
  const trip = T(); const timed = t !== null;
  const flightSub = [p.departTime ? 'Departs ' + p.departTime : '', p.arriveTime ? 'arrives ' + p.arriveTime : ''].filter(Boolean).join(', ');
  const sub = p.type === 'flight' ? (flightSub ? flightSub[0].toUpperCase() + flightSub.slice(1) : 'Times not set') : p.type === 'hotel' ? `${stayText(trip, p.name)}${p.address ? '. ' + p.address : ''}` : p.address;
  const cls = p.type === 'activity' ? 'c-' + p.category : p.type === 'flight' ? 'c-air' : 'c-hotel';
  const badge = n != null ? `<span class="badge ${cls}">${n}</span>` : `<span class="badge ${cls}">${I(placeIcon(p),'sm')}</span>`;
  const editing = S.editItem === p.id;
  const noPin = p.type !== 'flight' && p.lat == null;
  const move = p.type !== 'hotel' ? moveSelect('mv' + p.id, `data-in="moveto" data-id="${esc(p.id)}"`, i) : '';
  const timeField = p.type === 'activity' ? `<div class="field" style="max-width:12rem"><label for="pt${esc(p.id)}">Time (optional)</label><input id="pt${esc(p.id)}" type="time" class="input num" data-in="ptime" data-id="${esc(p.id)}" value="${esc(p.time || '')}"></div>`
    : p.type === 'flight' ? `<div class="grid2"><div class="field"><label for="fd${esc(p.id)}">Departs</label><input id="fd${esc(p.id)}" type="time" class="input num" data-in="pdep" data-id="${esc(p.id)}" value="${esc(p.departTime || '')}"></div><div class="field"><label for="fa${esc(p.id)}">Arrives</label><input id="fa${esc(p.id)}" type="time" class="input num" data-in="parr" data-id="${esc(p.id)}" value="${esc(p.arriveTime || '')}"></div></div>` : '';
  const kindField = p.type === 'activity' ? `<div class="seg" role="group" aria-label="Type"><button type="button" data-act="pcat" data-id="${esc(p.id)}" data-c="attraction" aria-pressed="${p.category === 'attraction'}">Sight</button><button type="button" data-act="pcat" data-id="${esc(p.id)}" data-c="food" aria-pressed="${p.category === 'food'}">Food</button></div>` : '';
  const edit = editing ? `<div class="item-edit">${kindField}<div class="field"><label for="pn${esc(p.id)}">Name</label><input id="pn${esc(p.id)}" class="input" data-in="pname" data-id="${esc(p.id)}" value="${esc(p.name)}"></div>${timeField}<div class="field"><label for="nt${esc(p.id)}">${p.type === 'flight' ? 'Booking details' : 'Note'}</label><textarea id="nt${esc(p.id)}" class="input" rows="2" data-in="pnote" data-id="${esc(p.id)}" placeholder="${p.type === 'flight' ? 'Booking reference, seats, terminal' : 'Why you picked it, what to order'}">${esc(p.note)}</textarea></div>${move}<div class="chips"><button type="button" class="btn" data-act="doneitem">Done</button>${p.type !== 'flight' && p.lat != null ? `<button type="button" class="btn btn--quiet" data-act="pick" data-id="${esc(p.id)}">Move the pin</button>` : ''}</div></div>` : '';
  return `<li class="item ${timed ? 'timed' : ''}" ${p.type === 'activity' ? `data-drag-item="p:${esc(i)}:${esc(pi)}"` : ''}>
    ${timed ? `<span class="pt">${esc(t || '')}</span>` : ''}${p.type === 'activity' ? `<button type="button" class="handle" data-drag="it" data-what="p" data-day="${esc(i)}" data-idx="${esc(pi)}" aria-label="Move ${esc(p.name)}: drag, or use arrow keys">${I('grip')}</button>` : '<span></span>'}${badge}
    <div class="item-main"><div class="item-name">${n != null ? `<span class="cat-ic ${cls}">${I(placeIcon(p),'sm')}</span>` : ''}${p.lat != null ? `<button type="button" class="row-open" data-act="showpin" data-id="${esc(p.id)}" aria-label="Show ${esc(p.name)} on the map">${esc(p.name)}</button>` : esc(p.name)}</div>${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}
      ${p.note && !editing ? `<p class="item-note">${esc(p.note)}</p>` : ''}
      ${noPin ? `<div class="nomap">${I('alert','sm')}Not on the map yet. <button type="button" class="link" data-act="pick" data-id="${esc(p.id)}">Drop a pin</button></div>` : ''}${edit}</div>
    <span class="item-acts">${editing ? '' : `<button type="button" class="iconbtn" data-act="edititem" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${I('pen')}</button>`}<button type="button" class="iconbtn" data-act="delplace" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${I('x')}</button></span></li>`;
}
function stepHTML(e, i){
  const k = e.k; const s = T().days[i].logistics[k]; const sk = s.kind || 'transport';
  const grip = `<button type="button" class="handle" data-drag="it" data-what="s" data-day="${esc(i)}" data-idx="${esc(k)}" aria-label="Move ${esc(s.desc || 'this step')}: drag, or use arrow keys">${I('grip')}</button>`;
  if(S.editTime === k) return `<li class="item timed step editing" data-drag-item="s:${esc(i)}:${esc(k)}"><span class="pt">${esc(s.time || '')}</span>${grip}<span class="badge c-${esc(sk)}">${e.n}</span>
    <div class="item-main"><div class="item-name"><span class="cat-ic c-${esc(sk)}">${I(STEPIC[sk],'sm')}</span>${esc(s.desc) || 'New step'}</div><div class="item-edit"><div class="seg" role="group" aria-label="Kind of step"><button type="button" data-act="stepkind" data-k="${esc(k)}" data-v="activity" aria-pressed="${sk === 'activity'}">Activity</button><button type="button" data-act="stepkind" data-k="${esc(k)}" data-v="transport" aria-pressed="${sk === 'transport'}">Transport</button></div><div class="field" style="max-width:12rem"><label for="tt${esc(k)}">Time</label><input id="tt${esc(k)}" type="time" class="input num" data-in="ttime" data-k="${esc(k)}" value="${esc(s.time || '')}"></div>
    <div class="field"><label for="td${esc(k)}">What happens</label><textarea id="td${esc(k)}" class="input" rows="2" data-in="tdesc" data-k="${esc(k)}" placeholder="Grab to the airport, meet the driver in the lobby">${esc(s.desc)}</textarea></div>${moveSelect(`ms${esc(i)}-${esc(k)}`, `data-in="movestep" data-k="${esc(k)}"`, i)}<div><button type="button" class="btn" data-act="donetime">Done</button></div></div></div><span class="item-acts"></span></li>`;
  return `<li class="item timed step" data-drag-item="s:${esc(i)}:${esc(k)}"><span class="pt">${esc(s.time || '')}</span>${grip}<span class="badge c-${esc(sk)}">${e.n}</span><div class="item-main"><div class="item-name"><span class="cat-ic c-${esc(sk)}">${I(STEPIC[sk],'sm')}</span>${esc(s.desc) || '<span class="sub">No description</span>'}</div></div>
    <span class="item-acts"><button type="button" class="iconbtn" data-act="edittime" data-k="${esc(k)}" aria-label="Edit ${esc(s.desc || 'this step')}">${I('pen')}</button><button type="button" class="iconbtn" data-act="deltime" data-k="${esc(k)}" aria-label="Remove ${esc(s.desc || 'this step')}">${I('x')}</button></span></li>`;
}
// The trip map with its controls. Itinerary shows it beside the day; Overview shows it above the days.
// Either can go full screen.
function tripMapPanel(where){
  const t = T(); const nums = numbering(t); const i = S.day; const ov = where === 'ov';
  const focusPl = S.mapFocus ? findPlace(S.mapFocus) : null;
  const filter = focusPl ? t.days.indexOf(focusPl.d) : (ov || S.mapMode === 'trip') ? 'all' : i;
  const whole = filter === 'all';
  const groups = t.days.map((d, j) => { const o = d.places.filter(p => p.type !== 'flight' && p.lat != null); return o.length ? `<optgroup label="${esc(dayLabel(d, j).replace(/, \d+ \w+,/, ','))}">${o.map(p => `<option value="${esc(p.id)}" ${S.mapFocus === p.id ? 'selected' : ''}>${p.type === 'hotel' ? esc(p.name) + ' (hotel)' : nums[p.id] + '. ' + esc(p.name)}</option>`).join('')}</optgroup>` : ''; }).join('');
  const unplaced = ov ? [] : t.days[i].places.filter(p => p.lat == null && p.type !== 'flight');
  let popup = '';
  if(S.mapPopup){ const f = findPlace(S.mapPopup); if(f){ const p = f.p; const di = t.days.indexOf(f.d); popup = `<div class="popup"><div class="top"><b>${p.type === 'hotel' ? '' : (nums[p.id] || '') + '. '}${esc(p.name)}</b><button type="button" class="iconbtn" data-act="closepop" aria-label="Close details">${I('x','sm')}</button></div><span class="sub">${p.type === 'hotel' ? 'Hotel, ' + dayList(hotelDays(t, p.name)) : 'Day ' + (di + 1) + (f.d.city ? ', ' + esc(f.d.city) : '') + (p.time ? ', ' + p.time : '')}</span>${ov || di !== S.day ? `<div><button type="button" class="link" data-act="day" data-i="${esc(di)}">Open Day ${di + 1}</button></div>` : ''}${p.address ? `<span class="sub">${esc(p.address)}</span>` : ''}${p.note ? `<p>${esc(p.note)}</p>` : ''}<div class="chips"><a class="link" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener">Open in Google Maps</a></div></div>`; } }
  const picking = S.picking ? findPlace(S.picking) : null;
  S.lastMap = { filter, focus:S.mapFocus, picking:!!picking, curDay:i };
  const full = S.mapFull;
  const top = ov
    ? `<div class="sechead"><h2 id="h-map">${I('pin')}Map</h2>${full ? `<button type="button" class="btn" data-act="mapfull">${I('x','sm')}Close</button>` : ''}</div>`
    : `<div class="maptop"><div class="seg" role="group" aria-label="Map shows"><button type="button" data-act="mapm" data-m="day" aria-pressed="${S.mapMode === 'day'}">This day</button><button type="button" data-act="mapm" data-m="trip" aria-pressed="${S.mapMode === 'trip'}">Whole trip</button></div>${full ? `<button type="button" class="btn" data-act="mapfull">${I('x','sm')}Close</button>` : ''}</div>`;
  return `<${ov ? 'section' : 'aside'} class="${ov ? 'ovmap' : 'mapcol'} box ${full ? 'mapfull' : ''}" aria-label="Map" ${full ? 'role="dialog" aria-modal="true"' : ''}>
    ${top}
    ${whole && !focusPl ? `<div class="seg" role="group" aria-label="Pins show"><button type="button" data-act="tripshow" data-v="days" aria-pressed="false">Days</button><button type="button" data-act="tripshow" data-v="places" aria-pressed="false">Every place</button></div>` : ''}
    <div class="mapbox">${picking ? `<div class="pickbar"><span>Tap the map where ${esc(picking.p.name)} is.</span><button type="button" class="btn" data-act="pickcancel">Cancel</button></div>` : ''}<div class="tmapwrap" data-map="trip"></div>${full ? '' : `<button type="button" class="iconbtn mapfullbtn" data-act="mapfull" aria-label="Show the map full screen">${I('expand')}</button>`}</div>
    ${popup || `<p class="sub maphint">${whole && !focusPl ? 'Zoomed out, each day gets one marker. Zoom in, or tap a day marker, to see every place with its number.' : 'Select a pin to see its details.'}</p>`}
    ${S.mapFocus ? `<div><button type="button" class="link" data-act="unfocus">Show the whole ${whole || ov ? 'trip' : 'day'} again</button></div>` : ''}
    ${groups && (!ov || full) ? `<div class="field"><label for="findp">Find a place on the map</label><select id="findp" class="input" data-in="findplace"><option value="">Choose a place</option>${groups}</select></div>` : ''}
    ${whole && !focusPl && (!ov || full) ? `<div class="field"><span class="label" id="lbl-dk">Open a day</span><ul class="daykey" aria-labelledby="lbl-dk">${t.days.map((d, j) => `<li><button type="button" data-act="${ov ? 'day' : 'mapday'}" data-i="${esc(j)}">Day ${j + 1}${d.city ? ', ' + esc(cityName(d.city)) : ''}</button></li>`).join('')}</ul></div>` : ''}
    ${unplaced.length ? `<div class="unplaced"><b>${unplaced.length === 1 ? 'One place is' : unplaced.length + ' places are'} not on the map yet</b>${unplaced.map(p => `<div class="r"><span>${esc(p.name)}</span><button type="button" class="btn" data-act="pick" data-id="${esc(p.id)}">Drop a pin</button></div>`).join('')}</div>` : ''}
  </${ov ? 'section' : 'aside'}>`;
}
const mapAside = () => tripMapPanel('itin');

/* ===== Home: the footprint map ===== */
// The map's shapes are built once and kept; each visit only updates which regions are lit.
let FPSVG = null, FPLIT = '';
let FPV = null; // the current view [x, y, w, h] in map units; null until first shown
function footHTML(){
  const fp = footprint(); S.fp = fp;
  const sel = S.hlRegion && fp.lit[S.hlRegion]; wmPrep(); const su = S.hlRegion && WM.byKey[S.hlRegion];
  const cap = sel ? `<div class="hcap"><b>${esc(su.n)}${su.n !== WM.countries[su.cc][0] ? ', ' + esc(WM.countries[su.cc][0]) : ''}</b><span class="sub">${esc(sel.cities.join(', '))}</span>${[...sel.trips].map(t => `<button type="button" class="link" data-act="opentrip" data-id="${esc(t.id)}">${esc(tripLabel(t))}, ${range(tripStart(t), tripEnd(t))}</button>`).join('')}<button type="button" class="iconbtn" data-act="fpu" data-k="${esc(S.hlRegion)}" aria-label="Close">${I('x','sm')}</button></div>` : '';
  const pct = Math.max(fp.countries ? 1.5 : 0, fp.countries / 195 * 100).toFixed(1);
  const upLine = n => n ? `<span class="fp-up">${esc(n)} coming up</span>` : '';
  return `<div class="fp-card">
      <div class="fp-stat main"><span class="sub">Countries<span class="wide"> lit up</span></span><p class="fp-num"><b>${fp.countries}</b><span>/ 195</span></p><div class="fp-bar" role="img" aria-label="${fp.countries} of 195 countries"><span style="width:${pct}%"></span></div>${upLine(fp.upCountries)}</div>
      <div class="fp-stat main"><span class="sub">Regions<span class="wide"> lit up</span></span><p class="fp-num"><b>${fp.regions}</b></p>${upLine(fp.upRegions)}</div>
      <div class="fp-stat"><span class="sub">Cities</span><p class="fp-num"><b>${fp.cities}</b></p></div>
      <div class="fp-stat"><span class="sub">Days<span class="wide"> away</span></span><p class="fp-num"><b>${fp.days}</b></p></div>
      <div class="fp-stat"><span class="sub">Trips</span><p class="fp-num"><b>${fp.trips}</b></p></div>
    </div>
    <div class="fp-stage ${S.fpFull ? 'fpfull' : ''}" ${S.fpFull ? 'role="dialog" aria-modal="true" aria-labelledby="fpfull-h"' : ''}>
    ${S.fpFull ? `<div class="fp-fullbar"><h2 id="fpfull-h">Where you've been</h2><button type="button" class="btn" data-act="fpfull">${I('x','sm')}Close</button></div>` : ''}
    <ul class="legend fp-legend" aria-label="Map key"><li><span class="key"></span>Visited</li><li><span class="key up"></span>Coming up</li></ul>
    <div class="fp-map" id="fpmap" role="img" aria-label="World map with the places you've been lit up. Pinch, double-tap or use the buttons to zoom.">
      <div class="fp-svgslot"></div><div id="fplabs" aria-hidden="true"></div>${S.fpFull ? '' : `<button type="button" class="iconbtn mapfullbtn" data-act="fpfull" aria-label="Show the map full screen">${I('expand')}</button>`}
      <div class="wm-zoom"><button type="button" class="iconbtn" data-act="fpzoom" data-d="1" aria-label="Zoom in">${I('plus')}</button><button type="button" class="iconbtn" data-act="fpzoom" data-d="-1" aria-label="Zoom out">${I('minus')}</button><button type="button" class="btn btn--quiet wm-reset" data-act="fpfit">Fit my places</button><button type="button" class="btn btn--quiet wm-reset" data-act="fpworld">Whole world</button></div>
    </div>
    <p class="sub">Tap a lit region to see your trips there.</p>${cap}
    </div>`;
}
function mountFoot(){
  const slot = document.querySelector('#fpmap .fp-svgslot'); if(!slot) return;
  wmPrep();
  if(!FPSVG){
    const ns = 'http://www.w3.org/2000/svg';
    FPSVG = document.createElementNS(ns, 'svg'); FPSVG.setAttribute('id', 'fpsvg'); FPSVG.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    FPSVG.innerHTML = `<rect class="fp-sea" x="-4000" y="-4000" width="12000" height="10000"/><g>${WM.units.map(u => `<path class="fp-u" d="${u.d}" data-act="fpu" data-k="${esc(u.k)}"/>`).join('')}</g><path class="fp-b" d="${WM.borders}"/>`;
  }
  slot.appendChild(FPSVG);
  const sig = JSON.stringify(Object.entries(S.fp.lit).map(([k, v]) => [k, v.past]).concat([S.hlRegion]));
  if(sig !== FPLIT){
    FPLIT = sig;
    FPSVG.querySelectorAll('.fp-u.v, .fp-u.u, .fp-u.hl').forEach(p => p.classList.remove('v', 'u', 'hl'));
    Object.entries(S.fp.lit).forEach(([k, v]) => { const p = FPSVG.querySelector(`.fp-u[data-k="${CSS.escape(k)}"]`); if(p){ p.classList.add(v.past ? 'v' : 'u'); if(k === S.hlRegion) p.classList.add('hl'); p.parentNode.appendChild(p); } });
  }
  if(!FPV) fitFoot(); else paintFoot();
}
const fpAspect = () => { const el = document.getElementById('fpmap'); return el && el.clientHeight ? el.clientWidth / el.clientHeight : 2; };
// Start zoomed to the places you've been (with Singapore in view), like a footprint map.
function fitFoot(){
  const keys = Object.keys((S.fp || footprint()).lit);
  if(!keys.length) return worldFoot();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = ([a, b, c, d]) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  keys.forEach(k => { const u = WM.byKey[k]; if(u){ const r = Math.max(u.w * 0.6, 20); add([u.c[0] - r, u.c[1] - r * 0.7, u.c[0] + r, u.c[1] + r * 0.7]); } });
  const sg = wmProject(HOME.lat, HOME.lon); add([sg[0], sg[1], sg[0], sg[1]]);
  const a = fpAspect(); let w = Math.max((x1 - x0) * 1.35, 260), h = Math.max((y1 - y0) * 1.35, 260 / a);
  if(w / h < a) w = h * a; else h = w / a;
  setFoot((x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w);
}
function worldFoot(){ setFoot(0, 0, WM.vb[2]); }
// Keeps the same middle and width when the map's shape changes (full screen, a turned iPad).
function refitFoot(){ const v = FPV; if(!v) return; const a = fpAspect(); setFoot(v[0] + v[2] / 2 - v[2] / 2, v[1] + v[3] / 2 - v[2] / a / 2, v[2]); }
function setFoot(x, y, w){
  const a = fpAspect(); w = Math.max(70, Math.min(WM.vb[2] * 1.05, w)); const h = w / a;
  x = Math.max(-w * 0.25, Math.min(WM.vb[2] - w * 0.75, x)); y = Math.max(-h * 0.25, Math.min(WM.vb[3] - h * 0.75, y));
  FPV = [x, y, w, h]; paintFoot();
}
function zoomFoot(f, ux, uy){ const v = FPV; if(ux == null){ ux = v[0] + v[2] / 2; uy = v[1] + v[3] / 2; } const w = v[2] / f; setFoot(ux - (ux - v[0]) * (w / v[2]), uy - (uy - v[1]) * (w / v[2]), w); }
let fpRaf = 0;
function paintFoot(){
  if(!FPSVG || !FPV) return;
  FPSVG.setAttribute('viewBox', FPV.map(n => n.toFixed(1)).join(' '));
  cancelAnimationFrame(fpRaf); fpRaf = requestAnimationFrame(footLabels);
}
// Labels: zoomed out, the names of countries you've been to; zoomed in, region names too
// (lit ones first), wherever they fit without overlapping.
function footLabels(){
  const host = document.getElementById('fplabs'); const el = document.getElementById('fpmap'); if(!host || !el || !FPV) return;
  const v = FPV; const sc = el.clientWidth / v[2]; const lit = (S.fp || footprint()).lit;
  el.classList.toggle('z2', sc > 0.9);
  const inView = (x, y) => x > v[0] && x < v[0] + v[2] && y > v[1] && y < v[1] + v[3];
  const cand = [];
  const litCountries = {};
  Object.entries(lit).forEach(([k, o]) => { const u = WM.byKey[k]; if(!u) return; litCountries[u.cc] = litCountries[u.cc] || o.past; cand.push({ x:u.c[0], y:u.c[1], t:u.n, cls:o.past ? 'v' : 'u', pr:3, need:u.w * sc > 26 || sc > 0.9 }); });
  Object.entries(litCountries).forEach(([cc, past]) => { const c = WM.countries[cc]; if(c) cand.push({ x:c[1], y:c[2], t:c[0], cls:'c ' + (past ? 'v' : 'u'), pr:sc > 0.9 ? 1 : 4, need:true }); });
  // Countries you haven't been to are named once you zoom in; region names show inside the countries
  // you've been to, and everywhere once you're zoomed right in.
  if(sc > 0.7) Object.entries(WM.countries).forEach(([cc, c]) => { if(!litCountries[cc] && c[3] * sc > 90) cand.push({ x:c[1], y:c[2], t:c[0], cls:'c', pr:2, need:true }); });
  if(sc > 1.1) WM.units.forEach(u => { if(!lit[u.k] && (u.cc in litCountries || sc > 3) && u.w * sc > 46) cand.push({ x:u.c[0], y:u.c[1], t:u.n, cls:'', pr:0, need:true }); });
  const placed = []; let html = '';
  cand.filter(c => c.need && inView(c.x, c.y)).sort((a, b) => b.pr - a.pr).forEach(c => {
    const px = (c.x - v[0]) * sc, py = (c.y - v[1]) * sc; const w = c.t.length * 6.8 + 10, h = 16;
    const r = [px - w / 2, py - h / 2, px + w / 2, py + h / 2];
    if(placed.some(p => r[0] < p[2] && p[0] < r[2] && r[1] < p[3] && p[1] < r[3])) return;
    placed.push(r);
    html += `<span class="fp-lab ${c.cls}" style="left:${((c.x - v[0]) / v[2] * 100).toFixed(2)}%;top:${((c.y - v[1]) / v[3] * 100).toFixed(2)}%">${esc(c.t)}</span>`;
  });
  host.innerHTML = html;
}
// Drag to pan, pinch or ctrl-scroll (trackpad pinch) to zoom, double-tap to zoom in.
const FPP = { pts:new Map(), moved:0 };
const fpUnits = (cx, cy) => { const b = document.getElementById('fpmap').getBoundingClientRect(); const v = FPV; return [v[0] + (cx - b.left) / b.width * v[2], v[1] + (cy - b.top) / b.height * v[3]]; };
document.addEventListener('pointerdown', e => {
  if(!e.target.closest || !e.target.closest('#fpmap') || e.target.closest('.wm-zoom') || !FPV) return;
  FPP.pts.set(e.pointerId, [e.clientX, e.clientY]); FPP.moved = 0; FPP.user = true;
  if(FPP.pts.size === 2){ const [a, b] = [...FPP.pts.values()]; FPP.pinch = { d:Math.hypot(a[0] - b[0], a[1] - b[1]), w:FPV[2] }; }
});
document.addEventListener('pointermove', e => {
  if(!FPP.pts.has(e.pointerId)) return;
  const prev = FPP.pts.get(e.pointerId); FPP.pts.set(e.pointerId, [e.clientX, e.clientY]);
  if(FPP.pts.size === 2 && FPP.pinch){
    const [a, b] = [...FPP.pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const [ux, uy] = fpUnits((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); const v = FPV; const w = FPP.pinch.w * FPP.pinch.d / Math.max(d, 1);
    setFoot(ux - (ux - v[0]) * (w / v[2]), uy - (uy - v[1]) * (w / v[2]), w); FPP.moved = 99; e.preventDefault(); return;
  }
  const b = document.getElementById('fpmap').getBoundingClientRect(); const v = FPV;
  FPP.moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
  if(FPP.moved < 6) return;
  setFoot(v[0] - (e.clientX - prev[0]) / b.width * v[2], v[1] - (e.clientY - prev[1]) / b.height * v[3], v[2]); e.preventDefault();
}, { passive:false });
const fpEnd = e => { FPP.pts.delete(e.pointerId); if(FPP.pts.size < 2) FPP.pinch = null; };
document.addEventListener('pointerup', fpEnd); document.addEventListener('pointercancel', fpEnd);
document.addEventListener('wheel', e => { if(!e.target.closest || !e.target.closest('#fpmap') || !e.ctrlKey || !FPV) return; e.preventDefault(); const [ux, uy] = fpUnits(e.clientX, e.clientY); zoomFoot(Math.exp(-e.deltaY * 0.01), ux, uy); }, { passive:false });
document.addEventListener('dblclick', e => { if(!e.target.closest || !e.target.closest('#fpmap') || e.target.closest('.wm-zoom') || !FPV) return; const [ux, uy] = fpUnits(e.clientX, e.clientY); zoomFoot(2, ux, uy); });
// A tap at the end of a drag is not a tap on a region.
document.addEventListener('click', e => { if(FPP.moved > 8 && e.target.closest && e.target.closest('#fpmap')){ e.stopImmediatePropagation(); e.preventDefault(); FPP.moved = 0; } }, true);
window.addEventListener('resize', () => { if(FPV && document.getElementById('fpmap')) refitFoot(); });
function untilText(t, now){ const m = (+t.slice(0, 2) * 60 + +t.slice(3)) - (+now.slice(0, 2) * 60 + +now.slice(3)); if(m <= 0) return 'now'; const h = Math.floor(m / 60), mm = m % 60; return 'in ' + (h ? h + ' h' + (mm ? ' ' + mm + ' min' : '') : mm + ' min'); }
function nextUp(i){
  const d = T().days[i]; const now = today().toTimeString().slice(0, 5);
  const timed = planOf(d).filter(e => e.t).map(e => ({ t:e.t, txt: e.kind === 'step' ? e.d : e.p.name })).sort((a, b) => a.t.localeCompare(b.t));
  const next = timed.find(x => x.t >= now);
  return `<section class="nextup" aria-label="Next up">${next ? `<span class="t">${esc(next.t)}</span><div class="what"><span>Next up, ${untilText(next.t, now)}</span><b>${esc(next.txt)}</b></div>` : `<span class="t">${esc(now)}</span><div class="what"><span>Nothing else timed today</span></div>`}</section>`;
}
function scrItinerary(){
  const t = T();
  if(!t.days.length) return `<div class="screen">${syncBanner()}${pageHead(true)}${noDaysHTML(t)}</div>`;
  const i = Math.max(0, Math.min(S.day, t.days.length - 1)); S.day = i; const d = t.days[i]; const ti = tripDayIndex(t);
  const tabs = t.days.map((dd, j) => `<button type="button" class="daytab" data-act="day" data-i="${esc(j)}" aria-current="${j === i}"><b>${j === ti ? 'Today' : 'Day ' + (j + 1)}</b><span>${dShort(dd.date)}, ${esc(dd.city) || 'not set'}</span></button>`).join('') + `<button type="button" class="daytab add" data-act="addday">${I('plus','sm')}Add a day</button>`;
  const plan = planOf(d);
  const hotels = d.places.map((p, pi) => ({ p, pi })).filter(x => x.p.type === 'hotel');
  const rows = plan.map(e => e.kind === 'divider' ? '<li class="anytime">Any time</li>' : e.kind === 'step' ? stepHTML(e, i) : itemHTML(e.p, i, e.pi, e.t, e.n)).join('');
  const editDay = S.editDay ? `<section class="box dayedit" aria-labelledby="h-ed"><div class="sechead"><h3 id="h-ed">${I('pen')}Edit Day ${i + 1}</h3><button type="button" class="btn" data-act="doneday">Done</button></div>
      <div class="details"><div class="field"><label for="ddate">Date</label><input id="ddate" type="date" class="input" data-in="ddate" value="${esc(d.date)}"></div>
      <div class="field"><label for="dcity">Town</label><input id="dcity" class="input" data-in="dcity" value="${esc(d.city)}" placeholder="For example, Shantou" aria-describedby="dcity-help"><span class="help" id="dcity-help">Helps search find places nearby</span></div></div>
      <div class="field"><label for="dnotes">Day note</label><textarea id="dnotes" class="input" rows="2" data-in="dnotes" placeholder="Anything to remember for the whole day">${esc(d.notes)}</textarea></div>
      <div class="dayactions"><button type="button" class="btn btn--quiet" data-act="moveday" data-i="${esc(i)}" data-d="-1" ${i === 0 ? 'disabled' : ''}>${I('left','sm')}Move day earlier</button><button type="button" class="btn btn--quiet" data-act="moveday" data-i="${esc(i)}" data-d="1" ${i === t.days.length - 1 ? 'disabled' : ''}>Move day later${I('right','sm')}</button><button type="button" class="btn btn--danger" data-act="askdelday">Delete Day ${i + 1}</button></div></section>`
    : '';
  return `<div class="screen it-screen" style="gap:var(--space-xl)">${syncBanner()}${pageHead(true, `<nav class="daystrip" aria-label="Days">${tabs}</nav>`)}
    <div class="it-grid">
      <div class="plan">
        <div class="dayhead"><div><h2 style="font-size:var(--text-display)">${esc(d.city) || 'Where to?'}</h2><p>Day ${i + 1}, ${dLong(d.date)}</p>${!S.editDay && d.notes ? `<p class="daynote">${esc(d.notes)}</p>` : ''}</div>
          <div class="chips"><button type="button" class="btn" data-act="editday" aria-pressed="${!!S.editDay}">${I('pen','sm')}Edit day</button><button type="button" class="btn btn--primary" data-act="dialog" data-d="add">${I('plus','sm')}Add to this day</button></div></div>
        ${i === ti ? nextUp(i) : ''}
        ${editDay}
        <section class="box" aria-labelledby="h-plan"><div class="sechead"><h3 id="h-plan">${I('clock')}Plan for the day</h3></div>
          ${plan.length ? `<ul class="ruled">${rows}</ul>` : `<p class="empty">Nothing planned yet. Add a place, or a step such as a train or a check-in.</p>`}
          <p class="sub planhint">Timed stops sort by time. Drag the others into order.</p></section>
        <section class="box" aria-labelledby="h-st"><div class="sechead"><h3 id="h-st">${I('bed')}Where you stay</h3></div>${hotels.length ? `<ul class="ruled stays">${hotels.map(({ p, pi }) => itemHTML(p, i, pi)).join('')}</ul>` : '<p class="empty">No hotel yet. Add one with the button above.</p>'}</section>
      </div>
      ${mapAside()}
    </div></div>`;
}
function addCityHint(){ const t = T(); const di = S.addDay != null ? S.addDay : S.day; const d = t && t.days[di]; return d ? cityName(d.city) : ''; }
function addPanelHTML(i){
  const trip = T(); const t = S.addType; const di = S.addDay != null ? S.addDay : i; const step = t === 'do' || t === 'move';
  const dayOpts = sel => trip.days.map((d, j) => `<option value="${esc(j)}" ${j === sel ? 'selected' : ''}>${esc(dayLabel(d, j))}</option>`).join('');
  const dayField = `<div class="field"><label for="aday">Day</label><select id="aday" class="input" data-in="aday">${dayOpts(di)}</select></div>`;
  let main;
  if(step){
    main = `<div class="grid2"><div class="field"><label for="stime">Time</label><input id="stime" type="time" class="input num" data-in="stime" value="${esc(S.sTime)}"></div>${dayField}</div>
      <div class="field"><label for="swhat">${t === 'do' ? 'What is it?' : 'Route or details'}</label><input id="swhat" class="input" data-in="swhat" value="${esc(S.sWhat)}" placeholder="${t === 'do' ? 'Cooking class, hotel check-in, lunch' : 'JR Yamanote to Shinjuku, about 25 min'}"></div>
      <p class="sub">${t === 'do' ? 'For things without a map pin: a class, a check-in, a meal booking.' : 'Trains, buses, taxis and walks between places.'}</p>`;
  } else if(t === 'flight'){
    main = `<div class="field"><label for="fname">Flight</label><input id="fname" class="input" data-in="fname" value="${esc(S.fName)}" placeholder="SQ12 Singapore to Tokyo"></div>
      <div class="grid2"><div class="field"><label for="fdep">Departs</label><input id="fdep" type="time" class="input num" data-in="fdep" value="${esc(S.fDep)}"></div><div class="field"><label for="farr">Arrives</label><input id="farr" type="time" class="input num" data-in="farr" value="${esc(S.fArr)}"></div></div>${dayField}`;
  } else {
    const how = `<div class="seg" role="group" aria-label="How to find it"><button type="button" data-act="amode" data-m="search" aria-pressed="${S.addMode === 'search'}">Search by name</button><button type="button" data-act="amode" data-m="link" aria-pressed="${S.addMode === 'link'}">Paste a Google Maps link</button></div>`;
    const finder = S.addMode === 'search'
      ? `<div class="field"><label for="aq">${t === 'hotel' ? 'Hotel name' : 'Place name'}</label><input id="aq" class="input" data-in="aq" value="${esc(S.q)}" placeholder="${t === 'hotel' ? 'Hotel Gracery Shinjuku' : 'Ichiran'}" autocomplete="off" aria-describedby="ares"></div><div id="ares">${searchResHTML()}</div>`
      : `<div class="field"><label for="alink">Google Maps link</label><textarea id="alink" class="input" rows="2" data-in="alink" placeholder="https://maps.app.goo.gl/">${esc(S.link)}</textarea></div><div id="alinkres">${linkResHTML()}</div>`;
    const cat = t === 'activity' ? `<div class="field"><span class="label" id="lbl-cat">Type</span><div class="chips" role="group" aria-labelledby="lbl-cat"><button type="button" class="chip" data-act="acat" data-c="attraction" aria-pressed="${S.addCat === 'attraction'}"><span class="cat-ic c-sight">${I('pin','sm')}</span>Sight</button><button type="button" class="chip" data-act="acat" data-c="food" aria-pressed="${S.addCat === 'food'}"><span class="cat-ic c-food">${I('bowl','sm')}</span>Food</button></div></div>` : '';
    const days = t === 'hotel'
      ? `<div class="grid2"><div class="field"><label for="hfrom">First night</label><select id="hfrom" class="input" data-in="hfrom">${dayOpts(S.hFrom ?? di)}</select></div><div class="field"><label for="hto">Last night</label><select id="hto" class="input" data-in="hto">${dayOpts(S.hTo ?? di)}</select></div></div><p class="sub">The hotel is added to every day from the first night to the last.</p>`
      : dayField;
    main = `${cat}${how}${finder}${days}`;
  }
  const tb = (k, ic, cls, label) => `<button type="button" data-act="atype" data-t="${esc(k)}" aria-pressed="${t === k}"><span class="cat-ic ${cls}">${I(ic,'sm')}</span>${label}</button>`;
  return `<div class="seg addtypes" role="group" aria-label="What to add">${tb('activity','pin','c-sight','Place')}${tb('do','flag','c-activity','Activity')}${tb('move','train','c-transport','Transport')}${tb('hotel','bed','c-hotel','Hotel')}${tb('flight','plane','c-air','Flight')}</div>
    ${main}
    ${step ? '' : `<div class="field"><label for="anote">Note</label><textarea id="anote" class="input" rows="2" data-in="anote" placeholder="${t === 'flight' ? 'Booking reference, seat, terminal, bags' : t === 'hotel' ? 'Room type, check-in time, breakfast' : 'Why you picked it, what to order'}">${esc(S.addNote)}</textarea>
      ${t !== 'flight' ? `<div><button type="button" class="link" data-act="wiki">Fill in a description from Wikipedia</button></div>` : ''}<div id="wikires">${S.wiki ? `<p class="desc">${esc(S.wiki)}</p>` : ''}</div></div>`}
    ${S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}${S.addErr.includes('without a location') ? ` <button type="button" class="link" data-act="addnopin">Add it without a location</button>` : ''}</p>` : ''}<div><button type="button" class="btn btn--primary" data-act="addplace">${({ flight:'Add the flight', hotel:'Add the hotel', do:'Add the activity', move:'Add the transport' })[t] || 'Add the place'}</button></div>
`;
}
function searchResHTML(){
  const q = S.q.trim();
  if(q.length < 2) return `<p class="sub">${googleSearchOK() ? 'Searching Google Maps.' : 'Free search. Add a Google key in Settings for Google’s results.'} Results show the full address so you can pick the right branch.</p>`;
  if(S.picked && S.picked.pending) return `<p class="sub">Confirming the exact location of ${esc(S.picked.name)}…</p>`;
  if(S.picked) return `<div class="result ok">${I('check')}<div><b>${esc(S.picked.name)}</b><span>${esc(S.picked.addr || '')}</span> <button type="button" class="link" data-act="unpick">Pick another</button></div></div>`;
  if(S.searching && !S.results) return `<p class="sub">Searching…</p>`;
  const hits = S.results || [];
  if(!hits.length) return `<div class="result warn">${I('alert')}<div><b>Nothing found for “${esc(S.q)}”</b><span>Paste a Google Maps link for it instead, or add it without a location.</span> <button type="button" class="link" data-act="amode" data-m="link">Use a link</button></div></div>`;
  return `<ul class="results">${hits.map((h, k) => `<li><button type="button" data-act="pickres" data-i="${esc(k)}"><b>${esc(h.label)}</b><span>${esc(h.sub)}</span></button></li>`).join('')}</ul>`;
}
function paintResults(){ const el = document.getElementById('ares'); if(el) el.innerHTML = searchResHTML(); }

/* ===== Budget ===== */
function blankDraft(t, cat = 'Hotel'){
  const td = isoLocal(today()); const st = tripStart(t);
  return { cat, desc:'', date: t.days.some(d => d.date === td) ? td : (st || td), cur:t.currency, total:'', nights:'', unit:'', qty:'' };
}
function draftPreview(){
  const t = T(); const d = S.draft; const m = catOf(d.cat).mode; const tb = t.baseCurrency; const cv = (n) => conv(t, d.cur, tb, n);
  if(m === 'nights'){ const tot = parseFloat(d.total), n = parseInt(d.nights); if(!(tot > 0)) return { empty:true, big:'Fill in the total and nights to see the price per night' }; if(!(n > 0)) return { big:fmt(d.cur, tot), small:'Add the number of nights to see the price per night' }; return { big:`${fmt(d.cur, tot / n)} a night`, small:`${fmt(d.cur, tot)} for ${n} ${n === 1 ? 'night' : 'nights'}${d.cur !== tb ? `${isFinite(cv(1)) ? `, about ${fmt(tb, cv(tot / n))} a night` : `. Add a ${esc(d.cur)} rate to see it in ${esc(tb)}`}` : ''}` }; }
  if(m === 'pax'){ const u = parseFloat(d.unit), q = parseInt(d.qty); if(!(u > 0)) return { empty:true, big:'Enter the price for one person and how many people' }; if(!(q > 0)) return { big:`${fmt(d.cur, u)} each`, small:'Add how many people to see the total' }; const sg = cv(u * q); return { big:`${fmt(d.cur, u * q)} in all`, small:`${q} ${q === 1 ? 'person' : 'people'} × ${fmt(d.cur, u)}${d.cur !== tb ? (isFinite(sg) ? `, about ${fmt(tb, sg)}` : `. Add a ${esc(d.cur)} rate to see it in ${esc(tb)}`) : ''}` }; }
  const tot = parseFloat(d.total); if(!(tot > 0)) return { empty:true, big:'Enter the amount' }; return { big:fmt(d.cur, tot), small:d.cur !== tb ? (isFinite(cv(tot)) ? `About ${fmt(tb, cv(tot))}` : `Add a ${esc(d.cur)} rate to see it in ${esc(tb)}`) : '' };
}
function calcHTML(){ const p = draftPreview(); return `<div class="calc ${p.empty ? 'empty' : ''}" id="calc" aria-live="polite"><span class="big">${esc(p.big)}</span>${p.small ? `<span class="small">${esc(p.small)}</span>` : ''}</div>`; }
function scrBudget(){
  const t = T(); const tt = totals(t); if(!S.draft || S.draft.trip !== t.id) S.draft = Object.assign(blankDraft(t), { trip:t.id });
  const d = S.draft; const m = catOf(d.cat).mode; const editing = S.editing ? t.expenses.find(e => e.id === S.editing) : null;
  const used = [...new Set([t.baseCurrency, t.currency, ...t.expenses.map(e => e.currency)])];
  const opt = (c, val) => `<option value="${esc(c)}" ${c === val ? 'selected' : ''}>${esc(c)}, ${esc(CUR_NAMES[c] || c)}</option>`;
  const curSel = (id, val, attr) => `<select id="${id}" class="input" ${attr}><optgroup label="On this trip">${used.map(c => opt(c, val)).join('')}</optgroup><optgroup label="All currencies">${CURS.filter(c => !used.includes(c)).map(c => opt(c, val)).join('')}</optgroup></select>`;
  const inv = f => S.expErr && S.expErr.f === f ? 'aria-invalid="true" aria-describedby="experr"' : '';
  const amount = m === 'nights'
    ? `<div class="grid3"><div class="field"><label for="ftotal">Total for the stay</label><input id="ftotal" class="input num" ${inv('ftotal')} inputmode="decimal" data-f="total" value="${esc(d.total)}" ></div><div class="field"><label for="fnights">Nights</label><input id="fnights" class="input num" ${inv('fnights')} inputmode="numeric" data-f="nights" value="${esc(d.nights)}" ></div><div class="field"><label for="fcur">Currency</label>${curSel('fcur', d.cur, 'data-f="cur"')}</div></div>`
    : m === 'pax'
    ? `<div class="grid3"><div class="field"><label for="funit">Price for one person</label><input id="funit" class="input num" ${inv('funit')} inputmode="decimal" data-f="unit" value="${esc(d.unit)}" ></div><div class="field"><label for="fqty">People</label><input id="fqty" class="input num" ${inv('fqty')} inputmode="numeric" data-f="qty" value="${esc(d.qty)}" ></div><div class="field"><label for="fcur">Currency</label>${curSel('fcur', d.cur, 'data-f="cur"')}</div></div>`
    : `<div class="grid2"><div class="field"><label for="ftotal">Amount</label><input id="ftotal" class="input num" ${inv('ftotal')} inputmode="decimal" data-f="total" value="${esc(d.total)}" ></div><div class="field"><label for="fcur">Currency</label>${curSel('fcur', d.cur, 'data-f="cur"')}</div></div>`;
  const rows = [...t.expenses].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => `<tr class="${S.editing === e.id ? 'editing' : ''}"><td class="num">${okDate(e.date) ? dShort(e.date) : ''}</td><td class="what"><b>${esc(e.desc) || esc(e.category)}</b><span><span class="cat-ic c-${CATKEY[e.category]}">${I(catOf(e.category).ic,'sm')}</span>${esc(e.category)}</span></td><td class="brk">${esc(breakdown(e))}</td><td class="r">${fmt(e.currency, expTotal(e))}</td><td class="r">${fmt(t.baseCurrency, conv(t, e.currency, t.baseCurrency, expTotal(e)))}</td>
    <td><span class="acts"><button type="button" class="btn btn--quiet" data-act="editexp" data-id="${esc(e.id)}">Edit</button><button type="button" class="iconbtn" data-act="delexp" data-id="${esc(e.id)}" aria-label="Delete ${esc(e.desc || e.category)}">${I('x')}</button></span></td></tr>`).join('');
  const cats = CATS.filter(c => tt.by[c.k]);
  return `<div class="screen">${syncBanner()}${pageHead()}
    <div class="bud-top">
      <section class="box" aria-labelledby="h-tot" style="display:flex;flex-direction:column;gap:var(--space-lg)"><div><h2 id="h-tot" class="visually-hidden">Total</h2><p class="sub">Spent so far, in ${esc(t.baseCurrency)}</p><p class="figure">${fmt(t.baseCurrency, tt.all)}</p><p class="sub">${rateLine(t)}</p>${tt.left ? `<p class="formerr">${I('alert','sm')}${tt.left} ${tt.left === 1 ? 'expense is' : 'expenses are'} left out until you add a rate for ${tt.missing.join(' and ')}.</p>` : ''}</div>
        ${cats.length ? `<dl class="bars">${barRows(t, tt, cats)}</dl>` : ''}
        <div class="grid2"><div class="field"><label for="lcur">Spending currency</label>${curSel('lcur', t.currency, 'data-in="lcur" aria-describedby="lcur-help"')}<span class="help" id="lcur-help">New expenses start in this currency</span></div><div class="field"><label for="bcur">Show totals in</label>${curSel('bcur', t.baseCurrency, 'data-in="bcur"')}</div></div>
        <fieldset class="rates"><legend>Exchange rate for this trip</legend><p class="sub">Enter the rate you actually got, for example from your money changer. Every total on this trip uses it.</p>
          ${tripCurs(t).map(c => `<div class="raterow"><label for="rate-${esc(c)}">1 ${esc(t.baseCurrency)} =</label><input id="rate-${esc(c)}" class="input num" inputmode="decimal" data-rate="${esc(c)}" value="${t.rates[c] ? fmtRate(t.rates[c]).replace(/,/g, '') : ''}" ${t.rates[c] ? '' : 'aria-invalid="true"'}><span>${esc(c)}</span></div>`).join('') || '<p class="sub">All expenses are in ' + t.baseCurrency + ', so no rate is needed.</p>'}</fieldset></section>
      <section class="panel" aria-labelledby="h-add"><div class="dialog-h"><h2 id="h-add">${editing ? 'Edit the expense' : 'Add an expense'}</h2>${editing ? '<button type="button" class="link" data-act="canceledit">Cancel</button>' : ''}</div>
        <form class="plan" style="gap:var(--space-md)" onsubmit="return false" data-form="exp">
          <div class="field"><span class="label" id="lbl-ecat">Category</span><div class="chips" role="group" aria-labelledby="lbl-ecat">${CATS.map(c => `<button type="button" class="chip" data-act="cat" data-c="${esc(c.k)}" aria-pressed="${d.cat === c.k}"><span class="cat-ic c-${CATKEY[c.k]}">${I(c.ic,'sm')}</span>${esc(c.k)}</button>`).join('')}</div></div>
          <div class="grid2"><div class="field"><label for="fdesc">Description</label><input id="fdesc" class="input" data-f="desc" value="${esc(d.desc)}" placeholder="${m === 'nights' ? 'Hotel name' : 'SQ flight to Tokyo'}"></div><div class="field"><label for="fdate">Date</label><input id="fdate" type="date" class="input" data-f="date" value="${esc(d.date)}"></div></div>
          ${amount}${calcHTML()}${S.expErr ? `<p class="formerr" id="experr" role="alert">${I('alert','sm')}${esc(S.expErr.msg)}</p>` : ''}
          <div class="chips"><button type="button" class="btn btn--primary" data-act="saveexp">${editing ? 'Save the changes' : 'Add the expense'}</button>${editing ? `<button type="button" class="btn btn--danger" data-act="delexp" data-id="${esc(editing.id)}">Delete it</button>` : ''}</div></form></section>
    </div>
    <section class="box" aria-labelledby="h-led"><div class="sechead"><h2 id="h-led">${I('receipt')}All expenses</h2><span class="sub">Oldest first</span></div>
      ${t.expenses.length ? `<div class="tablewrap"><table class="ledger"><thead><tr><th scope="col">Date</th><th scope="col">Item</th><th scope="col">Breakdown</th><th scope="col" class="r">Amount</th><th scope="col" class="r">In ${esc(t.baseCurrency)}</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">No expenses yet. Add the flights first, they are usually the biggest cost.</p>`}</section></div>`;
}

/* ===== Settings ===== */
function bioSecHTML(){
  const err = S.bioErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.bioErr)}</p>` : '';
  if(bioOn()) return `<p class="state ok">${I('check','sm')}On. Open the app with your passkey (fingerprint, face or device PIN), or with the passcode.</p>${err}
      <div class="chips"><button type="button" class="btn btn--quiet" data-act="bioff">Turn off the passkey</button></div>`;
  if(!S.bioAvail) return `<p class="sub">This browser doesn't offer passkeys that can unlock. It works in Safari 18 or later (iPadOS 18, iOS 18, macOS 15) and in recent Chrome or Edge.</p>`;
  return `<p>Open the app with a passkey instead of typing: Touch ID or Face ID on the iPad or a Mac, Windows Hello on a Windows laptop, or your phone if the laptop has neither (the browser shows a QR code). Type your passcode once to turn it on.</p>
      <div class="field"><label for="bp">Passcode</label><input id="bp" type="password" class="input" autocomplete="current-password"></div>${err}
      <div class="chips"><button type="button" class="btn btn--primary" data-act="bioon" ${S.lockBusy ? 'disabled' : ''}>${S.lockBusy ? 'Waiting for the check…' : 'Turn on the passkey'}</button></div>`;
}
function lockSecHTML(){
  if(!vaultOn()) return `<p>This device opens Milo & Miles without a lock. With one, the app asks for a passcode or passkey when it opens, and your trips, keys and GitHub token are stored scrambled.</p>
      <div class="chips"><button type="button" class="btn btn--primary" data-act="gsetupopen">Set up the lock</button></div>`;
  return `<p class="state ok">${I('lock','sm')}On</p><p>The app asks for your passcode or passkey each time it opens. Your trips, keys and GitHub token are stored scrambled on this device.</p>
      <div class="chips"><button type="button" class="btn" data-act="locknow">Lock now</button><button type="button" class="btn" data-act="dialog" data-d="chpass">Change the passcode</button></div>
      <h3>Passkey</h3>${bioSecHTML()}`;
}
/* ===== the lock screen, shown before the app ===== */
function gateHTML(){
  const err = S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}</p>` : '';
  const busy = S.lockBusy ? 'disabled' : '';
  const head = (h, p) => `<div class="gate-brand">${I('plane')}<span>Milo &amp; Miles</span></div><h1 id="gate-h">${h}</h1>${p ? `<p>${p}</p>` : ''}`;
  let body;
  if(S.gate === 'unlock') body = head('Welcome back', bioOn() ? '' : 'Type your passcode to open your trips.')
    + (bioOn() ? `<div class="chips"><button type="button" class="btn btn--primary gate-main" data-act="gbio" ${busy}>${I('lock','sm')}Unlock with your passkey</button></div><p class="sub">Or type your passcode:</p>` : '')
    + `<div class="field"><label for="upass">Passcode</label><input id="upass" type="password" class="input" autocomplete="current-password" ${busy}></div>${err}
      <div class="chips"><button type="button" class="btn ${bioOn() ? '' : 'btn--primary gate-main'}" data-act="gunlock" ${busy}>${S.lockBusy ? 'Unlocking…' : 'Unlock'}</button></div>
      <p class="sub gate-foot">Forgot it? <button type="button" class="link" data-act="gforgot">Start again on this device</button></p>`;
  else if(S.gate === 'setup') body = head('Lock the app', 'Choose a passcode. Milo &amp; Miles asks for it each time it opens on this device, and your trips, keys and GitHub token are stored scrambled until then.')
    + `<div class="field"><label for="lp1">Passcode</label><input id="lp1" type="password" class="input" autocomplete="new-password" aria-describedby="lp-help" ${busy}></div>
      <div class="field"><label for="lp2">Type it again</label><input id="lp2" type="password" class="input" autocomplete="new-password" ${busy}></div>
      <p class="help" id="lp-help">At least ${PASS_MIN} characters. Three short words make a strong one that's easy to type. It can't be recovered, so keep it somewhere safe.</p>${err}
      <div class="chips"><button type="button" class="btn btn--primary gate-main" data-act="gsetup" ${busy}>${S.lockBusy ? 'Locking…' : 'Lock the app'}</button></div>
      <p class="sub gate-foot"><button type="button" class="link" data-act="gskip">Not now</button>. You can set it up later in Settings.</p>`;
  else body = head('Add a passkey?', 'Then you can open the app with Touch ID, Face ID or Windows Hello, or with your phone, instead of typing the passcode. The passcode still works too.')
    + `${err}<div class="chips"><button type="button" class="btn btn--primary gate-main" data-act="gbioon" ${busy}>${S.lockBusy ? 'Waiting for the check…' : 'Add a passkey'}</button><button type="button" class="btn" data-act="gdone" ${busy}>Skip</button></div>`;
  return `<main class="gate" id="main"><section class="gate-card box" aria-labelledby="gate-h">${body}</section></main>${S.dialog === 'confirm' ? dialogHTML() : ''}`;
}
function scrSettings(){
  const t = T(); const sy = syncInfo(); const dl = tokenDaysLeft(); const key = gkey();
  const tok = !sync.token ? '' : sync.status === 'stopped' ? '<span class="state bad">Turned down by GitHub</span>' : dl == null ? '<span class="sub">Expiry date not entered</span>' : dl < 0 ? `<span class="state bad">Expired on ${dLong(sync.expires)}</span>` : dl <= 14 ? `<span class="state warn">Expires on ${dLong(sync.expires)}</span>` : `<span class="state ok">Working until ${dLong(sync.expires)}</span>`;
  const syncSec = sync.token
    ? `<p>Trips save to your private GitHub repo, so the iPad and the computer always match. Every save is kept as a version.</p>
      <dl class="kv"><dt>Status</dt><dd>${esc(sy.long)}${sync.error ? `<br><span class="sub">${esc(sync.error)}</span>` : ''}</dd><dt>Saved in</dt><dd>${esc(sync.repo)}, a private GitHub repo</dd><dt>Access token</dt><dd>${tok}<br><span class="sub">Stored on this device only. It can open your trip data and nothing else.</span></dd></dl>
      <div class="chips"><button type="button" class="btn btn--primary" data-act="syncnow">Sync now</button><button type="button" class="btn" data-act="dialog" data-d="token">Change the token</button><a class="btn btn--quiet" href="https://github.com/${esc(sync.repo)}/commits" target="_blank" rel="noopener">See saved versions</a><button type="button" class="btn btn--quiet" data-act="askdisconnect">Disconnect</button></div>
      <p class="sub">If you edit a trip on two devices before they sync, the newer edit wins and the older one is kept as a copy.</p>`
    : `<p>Right now trips are saved in this browser only. Connect a private GitHub repo and the iPad and the computer always match, with every save kept as a version.</p>
      <div class="chips"><button type="button" class="btn btn--primary" data-act="dialog" data-d="token">Connect GitHub</button></div>`;
  const usage = USAGE.map(([k, l, c]) => { const v = usageTotal(k); return `<dt>${l}</dt><dd><span class="track"><span class="fill" style="width:${Math.min(100, v / c * 100).toFixed(1)}%"></span></span></dd><dd class="num">${v.toLocaleString()} of ${c.toLocaleString()}</dd>`; }).join('');
  return `<div class="screen">${syncBanner()}<header class="pagehead"><h1>Settings</h1><button type="button" class="btn" data-act="nav" data-to="${t ? 'overview' : 'home'}">Close settings</button></header>
  <div class="set-grid">
    <section class="set box" aria-labelledby="h-sync"><h2 id="h-sync">Sync</h2>${syncSec}</section>
    <section class="set box" aria-labelledby="h-lock"><h2 id="h-lock">Passcode lock</h2>${lockSecHTML()}</section>
    <section class="set box" aria-labelledby="h-key"><h2 id="h-key">Google Maps key</h2><p>Powers the map and place search. ${sync.token ? 'It\'s saved in your private repo, so you enter it once for every device.' : 'Without one, the map and search use free services that find fewer places and show local-language names.'}</p>
      <dl class="kv"><dt>Key</dt><dd class="num">${key ? `Saved, ends in ${esc(key.slice(-3))}` : 'Not added'}</dd></dl>
      <div class="chips"><button type="button" class="btn" data-act="dialog" data-d="key">${key ? 'Change the key' : 'Add a key'}</button>${key ? '<button type="button" class="btn btn--quiet" data-act="askdelkey">Remove it</button>' : ''}</div>
      <p class="sub">Browsers can still read a map key, so in Google Cloud restrict yours to vibe-coder-milo.github.io. That stops other sites from using it.</p>
      ${key ? `<h3>Google's free monthly allowance${sync.token ? ', all devices' : ', this device'}</h3><dl class="usage">${usage}</dl><p class="sub">If any of these reaches 90%, the app quietly uses the free map and search for that part until next month, so you stay inside Google's free allowance.</p>` : ''}</section>
    <section class="set box" aria-labelledby="h-help"><h2 id="h-help">Short-link reader</h2><p>Google Maps on the iPad shares short links that hide the location. This small script in your Google account opens them so the app can place the pin.</p>
      <p class="state ${library.helperUrl ? 'ok' : 'warn'}">${I(library.helperUrl ? 'check' : 'alert','sm')}${library.helperUrl ? 'Connected' : 'Not set up'}</p>
      <div class="chips"><button type="button" class="btn" data-act="dialog" data-d="helper">${library.helperUrl ? 'Change it' : 'Set it up'}</button>${library.helperUrl ? '<button type="button" class="btn btn--quiet" data-act="delhelper">Disconnect</button>' : ''}</div></section>
    <section class="set box" aria-labelledby="h-look"><h2 id="h-look">Appearance</h2><p>Automatic follows this device's light or dark setting.</p>
      <div class="seg" role="group" aria-label="Appearance"><button type="button" data-act="theme" data-v="auto" aria-pressed="${dev.theme === 'auto'}">Automatic</button><button type="button" data-act="theme" data-v="light" aria-pressed="${dev.theme === 'light'}">Light</button><button type="button" data-act="theme" data-v="dark" aria-pressed="${dev.theme === 'dark'}">Dark</button></div>
      <h3 style="margin-top:var(--space-sm)">Map look</h3>
      <p class="sub">${gkey() ? 'How the Google map looks on this device. It changes straight away.' : 'These are for the Google map, so they need the Google key. Without it the app uses the free map.'}</p>
      <div class="chips maplook" role="group" aria-label="Map look">${MAP_LOOKS.map(([k, l]) => `<button type="button" class="chip" data-act="maplook" data-v="${esc(k)}" aria-pressed="${mapLook() === k}" ${gkey() ? '' : 'disabled'}>${esc(l)}</button>`).join('')}</div>
      ${gkey() && T() && T().days.length ? '<div><button type="button" class="link" data-act="maplookgo">See it on the trip map</button></div>' : ''}</section>
    <section class="set box" aria-labelledby="h-size"><h2 id="h-size">Text size on this device</h2><p>The iPad and the computer each keep their own size.</p>
      <div class="chips" style="align-items:center"><button type="button" class="btn" data-act="sz" data-d="-1" aria-label="Smaller text">Smaller</button><span class="num" style="min-width:4rem;text-align:center">${Math.round(dev.scale * 100)}%</span><button type="button" class="btn" data-act="sz" data-d="1" aria-label="Larger text">Larger</button></div></section>
    <section class="set box" aria-labelledby="h-bk"><h2 id="h-bk">Backups</h2><p>${sync.token ? 'Sync already keeps every version. ' : ''}A downloaded backup is an extra copy you keep yourself, for example in Google Drive. Keys and tokens are never in it.</p>
      <div class="chips">${t ? '<button type="button" class="btn" data-act="exporttrip">Download this trip</button>' : ''}<button type="button" class="btn" data-act="exportall" ${Object.keys(library.trips).length ? '' : 'disabled'}>Download all trips</button><button type="button" class="btn" data-act="import">Load a backup</button></div>
      <p class="sub">Loading a backup adds its trips alongside yours. Backups from the old Trip Tracker still load.</p>
      ${t ? `<div><button type="button" class="btn btn--danger" data-act="askclear">Clear ${esc(tripLabel(t))}</button></div>` : ''}</section>
  </div></div>`;
}

/* ===== dialogs ===== */
const HELPER_SCRIPT = %%HELPER%%;
function dialogHTML(){
  const k = S.dialog; if(!k) return '';
  const box = (title, body) => `<div class="overlay" data-act="closebg"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-h"><div class="dialog-h"><h2 id="dlg-h">${title}</h2><button type="button" class="iconbtn" data-act="close" aria-label="Close">${I('x')}</button></div>${body}</div></div>`;
  if(k === 'add') return box('Add to the plan', addPanelHTML(S.day));
  if(k === 'past'){
    const f = S.pastForm; const cs = f.cities.split(',').map(s => s.trim()).filter(Boolean);
    return box('Add a past trip', `<p>Just enough to put it on your world map. You can plan it in full later.</p>
      <div class="field"><label for="pname">Trip name</label><input id="pname" class="input" data-pf="name" value="${esc(f.name)}" placeholder="Hong Kong weekend"></div>
      <div class="grid2"><div class="field"><label for="pfrom">First day</label><input id="pfrom" type="date" class="input" data-pf="from" value="${esc(f.from)}"></div><div class="field"><label for="pto">Last day</label><input id="pto" type="date" class="input" data-pf="to" value="${esc(f.to)}"></div></div>
      <div class="field"><label for="pcities">Cities</label><input id="pcities" class="input" data-pf="cities" value="${esc(f.cities)}" placeholder="Hong Kong, Shanghai" aria-describedby="pc-help"><span class="help" id="pc-help">Separate cities with commas.</span></div>
      <div id="pcheck">${pastCheckHTML(cs)}</div>
      ${S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}</p>` : ''}
      <div><button type="button" class="btn btn--primary" data-act="savepast">Add to my map</button></div>`);
  }
  if(k === 'newtrip'){ const n = S.newTrip; return box('New trip', `<div class="field"><label for="ntname">Trip name</label><input id="ntname" class="input" data-nt="name" value="${esc(n.name)}" placeholder="Hokkaido in winter"></div><div class="grid2"><div class="field"><label for="ntfrom">First day</label><input id="ntfrom" type="date" class="input" data-nt="from" value="${esc(n.from)}"></div><div class="field"><label for="ntto">Last day (optional)</label><input id="ntto" type="date" class="input" data-nt="to" value="${esc(n.to)}"></div></div><p class="sub">Every day from the first to the last is set up for you. You can add or remove days later.</p>${S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}</p>` : ''}<div><button type="button" class="btn btn--primary" data-act="createtrip">Create the trip</button></div>`); }
  if(k === 'chpass') return box('Change the passcode', `<div class="field"><label for="cp0">Current passcode</label><input id="cp0" type="password" class="input" autocomplete="current-password"></div>
    <div class="field"><label for="cp1">New passcode</label><input id="cp1" type="password" class="input" autocomplete="new-password"></div>
    <div class="field"><label for="cp2">Type it again</label><input id="cp2" type="password" class="input" autocomplete="new-password"></div>
    <p class="help">At least ${PASS_MIN} characters. Your passkey keeps working.</p>
    ${S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}</p>` : ''}
    <div class="chips"><button type="button" class="btn btn--primary" data-act="chpass" ${S.lockBusy ? 'disabled' : ''}>${S.lockBusy ? 'Saving…' : 'Change it'}</button></div>`);
  if(k === 'token') return box('Connect GitHub', `<p>Trips are saved as files in a private repo on your GitHub account. It takes a few minutes, once:</p>
    <ol class="steps"><li>On GitHub, <a href="https://github.com/new?name=Trip-Tracker-data&visibility=private" target="_blank" rel="noopener">create a new repo</a> named Trip-Tracker-data. Choose <b>Private</b> and tick <b>Add a README file</b>.</li><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub, Settings, Fine-grained tokens</a>. Under Repository access pick only Trip-Tracker-data. Under Permissions set Contents to Read and write.</li><li>Copy the token and paste it below. Do this on each device; the token never leaves the device.</li></ol>
    <div class="field"><label for="trepo">Repo</label><input id="trepo" class="input num" value="${esc(sync.repo)}" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label for="tok">Token</label><input id="tok" type="password" class="input num" placeholder="github_pat_" autocomplete="off" spellcheck="false"></div>
    <div class="field" style="max-width:16rem"><label for="texp">Token expires on</label><input id="texp" type="date" class="input" value="${esc(sync.expires)}" aria-describedby="texp-help"><span class="help" id="texp-help">GitHub shows it when you make the token. The app warns you two weeks before.</span></div>
    ${S.addErr ? `<p class="formerr" role="alert">${I('alert','sm')}${esc(S.addErr)}</p>` : ''}
    <div><button type="button" class="btn btn--primary" data-act="savetoken">Save and sync</button></div>`);
  if(k === 'key') return box('Google Maps key', `<div class="field"><label for="gk">Key</label><input id="gk" type="password" class="input num" placeholder="${gkey() ? 'Saved, ends in ' + esc(gkey().slice(-3)) + '. Paste a new one to replace it' : 'AIza…'}" autocomplete="off" spellcheck="false"></div><p class="sub">${sync.token ? 'Saved to your private data repo and synced to your devices.' : 'Saved in this browser. Connect GitHub to have it on every device.'} It is never put in a downloaded backup.</p>
    <details><summary>Map tiles key (optional)</summary><div class="field"><label for="ck">CARTO key</label><input id="ck" type="password" class="input num" placeholder="${library.cartoApiKey ? 'Saved, ends in ' + esc(library.cartoApiKey.slice(-3)) + '. Paste a new one to replace it' : ''}" autocomplete="off" spellcheck="false"></div>${library.cartoApiKey ? '<div><button type="button" class="link" data-act="delcarto">Remove the CARTO key</button></div>' : ''}<p class="sub">Optional. The map uses free OpenStreetMap tiles without it. With a free CARTO key it switches to CARTO's cleaner light and dark styles.</p></details>
    <div><button type="button" class="btn btn--primary" data-act="savekey">Save the key</button></div>`);
  if(k === 'helper') return box('Short-link reader', `<p>A tiny script that runs free in your own Google account. It opens a short Google Maps link and tells the app where it leads.</p>
    <ol class="steps"><li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">Google Apps Script, New project</a>.</li><li>Replace everything in the editor with the script below, then save.</li><li>Choose Deploy, New deployment, type Web app. Execute as Me, access Anyone. Deploy and allow access.</li><li>Copy the Web app URL and paste it below.</li></ol>
    <div class="field"><label for="hscript">Script</label><textarea id="hscript" class="input num codebox" rows="8" readonly>${esc(HELPER_SCRIPT)}</textarea></div>
    <div><button type="button" class="btn" data-act="copyscript">Copy the script</button></div>
    <div class="field"><label for="hurl">Web app URL</label><input id="hurl" class="input num" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" spellcheck="false" value="${esc(library.helperUrl)}"></div>
    <div id="htest"></div>
    <div class="chips"><button type="button" class="btn btn--primary" data-act="savehelper">Save and test</button></div>`);
  if(k === 'confirm'){ const c = S.confirm; return box(c.title, `<p>${c.body}</p><div class="chips"><button type="button" class="btn btn--danger" data-act="confirmyes">${c.yes}</button><button type="button" class="btn" data-act="close">Keep it</button></div>`); }
  return '';
}
function pastCheckHTML(cs){
  if(!cs.length) return '';
  return `<ul class="facts">${cs.map(c => { const k = c.toLowerCase(); const g = library.cityCache[k]; const found = g && !g.miss; if(!g && !cityQueue.has(k)){ cityQueue.add(k); pumpCities(); } return `<li>${I(found ? 'check' : 'alert','sm')}${esc(c)}${found ? (g.country ? `, ${esc(g.country)}` : '') : g ? ', not found. Check the spelling' : ', looking it up…'}</li>`; }).join('')}</ul>`;
}
