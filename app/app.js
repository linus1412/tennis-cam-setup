import { COURT, recommend, serveHeights, serveOptions } from './geometry.js';
import { PHONES, phoneLenses, DEFAULT_COURTS, DEFAULT_SETTINGS, STICK } from './data.js';
import { requestSensorPermission, watchTilt } from './sensor.js';

const $ = (s) => document.querySelector(s);
const fmt = (n, d = 2) => Number(n).toFixed(d);

// ---------- storage ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

let courts = store.get('courts', DEFAULT_COURTS);
// Bump when DEFAULT_SETTINGS change meaning, so stale saved values don't override them.
const SETTINGS_VERSION = 3;
const KEEP_ACROSS_VERSIONS = ['phone', 'mode', 'courtId', 'end', 'farPlayer'];
let settings = loadSettings();

function loadSettings() {
  const saved = store.get('settings', {});
  if (saved.v === SETTINGS_VERSION) return { ...DEFAULT_SETTINGS, ...saved };
  const kept = Object.fromEntries(KEEP_ACROSS_VERSIONS.filter((k) => k in saved).map((k) => [k, saved[k]]));
  return { ...DEFAULT_SETTINGS, ...kept };
}
const state = {
  courtId: settings.courtId || courts[0]?.id,
  end: settings.end || 'A',
  height: null, // null = use recommended
  offset: 0,
  target: null,
  choice: null, // { lensId, pitch } picked from the serve table
};

const saveCourts = () => store.set('courts', courts);
const saveSettings = () => store.set('settings', { ...settings, courtId: state.courtId, end: state.end, v: SETTINGS_VERSION });
const currentCourt = () => courts.find((c) => c.id === state.courtId) || courts[0];
const courtLabel = (c) => [c.club, c.name].filter(Boolean).join(' – ');

importFromHash();

// ---------- tabs ----------
document.querySelectorAll('.tabs button').forEach((b) =>
  b.addEventListener('click', () => showTab(b.dataset.tab)));

function showTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.tab').forEach((t) => { t.hidden = t.id !== `tab-${name}`; });
  if (name === '3d') open3d();
}

// The 3D view (three.js) only loads when its tab is first opened.
let view3d = null, lastSetup = null;
async function open3d() {
  if (view3d) return view3d.update(lastSetup);
  view3d = await import('./view3d.js');
  view3d.mount($('#scene'), lastSetup);
}

// ---------- setup tab ----------
function fillCourtSelects() {
  for (const sel of [$('#court'), $('#editCourt')]) {
    sel.innerHTML = courts.map((c) => `<option value="${c.id}">${escapeHtml(courtLabel(c))}</option>`).join('');
  }
  $('#court').value = state.courtId;
  $('#editCourt').value = state.courtId;
}

$('#phone').innerHTML = Object.entries(PHONES).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');

function bindSeg(el, get, set) {
  const paint = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === get()));
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set(b.dataset.v);
    paint();
    update();
  });
  paint();
}

bindSeg($('#end'), () => state.end, (v) => { state.end = v; state.height = null; state.choice = null; saveSettings(); });
bindSeg($('#mode'), () => settings.mode, (v) => { settings.mode = v; state.height = null; state.choice = null; saveSettings(); });

$('#court').addEventListener('change', (e) => { state.courtId = e.target.value; state.height = null; state.choice = null; saveSettings(); update(); });
$('#phone').addEventListener('change', (e) => { settings.phone = e.target.value; saveSettings(); update(); });
$('#height').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  state.height = Number.isFinite(v) && v > 0 ? v : null;
  update(false);
});
$('#offset').addEventListener('input', (e) => { state.offset = parseFloat(e.target.value) || 0; update(); });
$('#farPlayer').addEventListener('change', (e) => { settings.farPlayer = e.target.checked; saveSettings(); update(); });

// Serve inputs: height and racket shown in cm, stored in metres.
const SERVE_FIELDS = [['#playerHeight', 'playerHeight', 100], ['#racketLength', 'racketLength', 100], ['#jump', 'jump', 1], ['#tossAbove', 'tossAbove', 1]];
for (const [id, key, scale] of SERVE_FIELDS) {
  $(id).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!(v >= 0)) return;
    settings[key] = v / scale;
    saveSettings();
    update(false);
  });
}

// Highest camera height possible at this end: hook the fork over the top rail if you
// can lift it that high, otherwise into the mesh as high as you can reach.
function mountFor(end) {
  const reach = settings.gripHeight + settings.handleLength;
  if (reach >= end.fenceHeight) {
    return { height: end.fenceHeight + settings.stickAboveClamp, how: `Hook the fork over the ${fmt(end.fenceHeight, 1)} m top rail${sectionsHint(end.fenceHeight)}` };
  }
  if (reach < (end.wallHeight || 0)) {
    return { height: reach + settings.stickAboveClamp, how: `You can only lift the fork to ${fmt(reach, 1)} m, below the ${fmt(end.wallHeight, 1)} m wall – you'll need something to stand on` };
  }
  return { height: reach + settings.stickAboveClamp, how: `Open all three lower sections and hook the fence knob into the mesh as high as you can lift it (fork rest ~${fmt(reach, 1)} m)` };
}

// How many of the lower sections to open so the fork rest reaches `rail` with the base held overhead.
function sectionsHint(rail) {
  // Scale the measured sections if the user has changed the pole length.
  const k = (settings.handleLength - STICK.baseToRest) / STICK.lowerSections.reduce((a, b) => a + b, 0);
  let len = STICK.baseToRest, n = 0;
  while (settings.gripHeight + len < rail && n < STICK.lowerSections.length) len += STICK.lowerSections[n++] * k;
  return n === 0 ? ' (lower sections closed)' : ` (open ${n === 3 ? 'all three' : n} lower section${n > 1 ? 's' : ''})`;
}

function update(syncHeightField = true) {
  const court = currentCourt();
  if (!court) return;
  const end = court.ends[state.end];
  const lenses = phoneLenses(settings.phone);
  const base = { end, net: court.net, mode: settings.mode, lenses, offsetX: state.offset, farPlayer: settings.farPlayer };

  const mount = mountFor(end);
  const recHeight = mount.height;
  const height = state.height ?? recHeight;
  if (syncHeightField) $('#height').value = fmt(height);
  const r = recommend({ ...base, maxHeight: height });
  applyChoice(r);
  state.target = r.chosen.pitch;
  $('#targetInput').value = fmt(state.target, 0);
  renderTarget();
  renderResult(r, { end, recHeight, mount });
  renderSide(r, court);
  renderServe(r, base);
  lastSetup = {
    court, endKey: state.end, mode: settings.mode, r, offset: state.offset,
    handleLength: settings.handleLength, stickAboveClamp: settings.stickAboveClamp,
    player: { playerHeight: settings.playerHeight, racketLength: settings.racketLength, jump: settings.jump, tossAbove: settings.tossAbove },
  };
  if (view3d && !$('#tab-3d').hidden) view3d.update(lastSetup);
}

// Swap in a zoom/tilt picked from the serve table, if it still keeps the court in frame.
function applyChoice(r) {
  const c = state.choice;
  if (!c) return;
  const lens = r.lenses.find((l) => l.id === c.lensId);
  if (!lens || !lens.fits || c.pitch < lens.pitchRange[0] || c.pitch > lens.pitchRange[1]) {
    state.choice = null;
    return;
  }
  r.chosen = { ...lens, pitch: c.pitch, picked: true };
}

function renderServe(r, base) {
  const sh = serveHeights(settings);
  $('#serveHeights').innerHTML = `Contact ≈ <b>${fmt(sh.contact)} m</b> · toss peak ≈ <b>${fmt(sh.toss)} m</b>`;
  const opts = serveOptions({ ...base, height: r.height, distBehind: r.distBehind });
  const mark = (top) => top >= sh.toss ? ['vis-toss', '●'] : top >= sh.contact ? ['vis-contact', '◐'] : ['vis-cut', '○'];
  const cell = (top) => { const [c, m] = mark(top); return `<td class="${c}">${m} ${fmt(top, 1)} m</td>`; };
  const rows = [];
  for (const o of opts) {
    if (!o.fits) continue;
    for (const t of o.tilts) {
      const sel = r.chosen.id === o.lens.id && Math.abs(r.chosen.pitch - t.pitch) < 0.05;
      const rec = !state.choice && sel ? ' <span class="rec">recommended</span>' : '';
      rows.push(`<tr data-lens="${o.lens.id}" data-pitch="${t.pitch}" class="${sel ? 'sel' : ''}">
        <td>${o.lens.id}</td><td>${fmt(t.pitch, 0)}°${t.kind === 'aim high' ? ' ↑' : ''}${rec}</td>${cell(t.near)}${cell(t.far)}</tr>`);
    }
  }
  const tooTight = opts.filter((o) => !o.fits).map((o) => o.lens.id);
  $('#serveTable').innerHTML = `
    <thead><tr><th>Zoom</th><th>Tilt</th><th>Your end</th><th>Far end</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
    ${tooTight.length ? `<tfoot><tr><td colspan="4" class="hint small">${tooTight.join(', ')}: court doesn't fit.</td></tr></tfoot>` : ''}`;
}

$('#serveTable').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-lens]');
  if (!tr) return;
  state.choice = { lensId: tr.dataset.lens, pitch: parseFloat(tr.dataset.pitch) };
  update(false);
});

function renderResult(r, { end, recHeight, mount }) {
  const lens = r.chosen;
  const msgs = [];
  if (state.height == null) msgs.push(['info', `${mount.how}, top section fully raised.`]);
  if (lens.picked) msgs.push(['info', `Using your serve-check pick: ${lens.id} at ${fmt(lens.pitch, 0)}°. <button class="link" id="resetChoice">Back to recommended</button>`]);
  if (r.heightOk) {
    msgs.push(['ok', `Far service line clears the net by ${Math.round(r.clearance * 100)} cm.`]);
  } else if (r.clearance > 0) {
    msgs.push(['warn', `Far service line only just clears the net tape. Aim for ${fmt(r.minHeight)} m or more for a clear view.`]);
  } else {
    msgs.push(['warn', `Too low to see the far service line over the net. Need at least ${fmt(r.minHeight)} m (net hides it by ${Math.round(-r.clearance * 100)} cm).`]);
  }
  if (recHeight < r.minHeight) {
    msgs.push(['warn', `At this end the stick tops out at ${fmt(recHeight)} m – short of the ${fmt(r.minHeight)} m recommended.`]);
  }
  if (!lens.fits) {
    msgs.push(['warn', `Even ${lens.name} can't fit the whole ${settings.mode} court from here.`]);
  } else {
    if (!lens.picked) msgs.push(['info', `Zoom ${lens.id} is the tightest that keeps all four corners in view from ${fmt(r.distBehind)} m back.`]);
    if (lens.pitchRange) msgs.push(['info', `Anything from ${fmt(lens.pitchRange[0], 0)}° to ${fmt(lens.pitchRange[1], 0)}° keeps the court in frame${lens.picked ? '' : `; ${fmt(lens.pitch, 0)}° leaves the most room at the edges`}.`]);
  }

  $('#result').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${fmt(r.height)}<small> m</small></b><span>Height</span></div>
      <div class="stat"><b>${fmt(lens.pitch, 0)}°</b><span>Tilt down</span></div>
      <div class="stat"><b>${lens.id}</b><span>Zoom</span></div>
    </div>
    <ul class="msgs">${msgs.map(([c, t]) => `<li class="${c}">${t}</li>`).join('')}</ul>
    <div class="actions"><button class="primary" id="goLevel">Set phone to ${fmt(lens.pitch, 0)}° →</button></div>`;
  $('#resetChoice')?.addEventListener('click', () => { state.choice = null; update(false); });
  $('#goLevel').addEventListener('click', () => {
    $('#targetInput').value = fmt(lens.pitch, 0);
    renderTarget();
    showTab('level');
  });
}

// Side elevation: fence on the left, far baseline on the right.
function renderSide(r, court) {
  const lens = r.chosen;
  const W = 360, H = 150, pad = 10, ground = H - 18;
  const yMax = COURT.length + 3; // metres from near baseline at the right edge
  const s = (W - 2 * pad) / (r.distBehind + yMax);
  const vex = 2; // vertical exaggeration so heights are readable
  const X = (y) => pad + (y + r.distBehind) * s; // y = metres from near baseline
  const Z = (z) => ground - z * s * vex;
  const camX = X(-r.distBehind), camZ = Z(r.height);
  // Where a ray at `angDeg` below horizontal hits the ground or the right edge.
  const ray = (angDeg) => {
    const k = Math.tan((angDeg * Math.PI) / 180);
    const run = k > 0 ? r.height / k : Infinity;
    if (run <= yMax + r.distBehind) return [X(run - r.distBehind), ground];
    return [X(yMax), Z(r.height - k * (yMax + r.distBehind))];
  };
  const half = lens.fov.v / 2;
  const [tx, tz] = ray(lens.pitch - half);
  const [bx, bz] = ray(lens.pitch + half);
  const svcY = COURT.halfLength + COURT.serviceFromNet;
  const fence = court.ends[state.end].fenceHeight;

  $('#side').innerHTML = `
    <polygon points="${camX},${camZ} ${tx},${tz} ${W},${tz} ${W},${bz} ${bx},${bz}" fill="var(--ball)" opacity="0.18"/>
    <line x1="${camX}" y1="${camZ}" x2="${tx}" y2="${tz}" stroke="var(--muted)" stroke-width="1"/>
    <line x1="${camX}" y1="${camZ}" x2="${bx}" y2="${bz}" stroke="var(--muted)" stroke-width="1"/>
    <line x1="${pad}" y1="${ground}" x2="${W}" y2="${ground}" stroke="var(--ink)" stroke-width="1.5"/>
    <line x1="${X(0)}" y1="${ground}" x2="${X(COURT.length)}" y2="${ground}" stroke="var(--court)" stroke-width="4"/>
    <line x1="${X(-r.distBehind)}" y1="${ground}" x2="${X(-r.distBehind)}" y2="${Z(fence)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 2"/>
    <line x1="${X(COURT.halfLength)}" y1="${ground}" x2="${X(COURT.halfLength)}" y2="${Z(court.net.centre)}" stroke="var(--ink)" stroke-width="2"/>
    <line x1="${camX}" y1="${camZ}" x2="${X(svcY)}" y2="${ground}" stroke="${r.heightOk ? 'var(--ok)' : 'var(--warn)'}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <line x1="${X(-r.distBehind)}" y1="${camZ}" x2="${camX}" y2="${camZ}" stroke="var(--ink)" stroke-width="2"/>
    <circle cx="${camX}" cy="${camZ}" r="4" fill="var(--accent)"/>
    ${[0, svcY, COURT.length].map((y) => `<line x1="${X(y)}" y1="${ground - 4}" x2="${X(y)}" y2="${ground + 4}" stroke="var(--ink)"/>`).join('')}
    <text x="${X(0)}" y="${H - 3}" font-size="9" fill="var(--muted)" text-anchor="middle">baseline</text>
    <text x="${X(COURT.halfLength)}" y="${H - 3}" font-size="9" fill="var(--muted)" text-anchor="middle">net</text>
    <text x="${X(COURT.length) + 2}" y="${H - 3}" font-size="9" fill="var(--muted)" text-anchor="middle">far baseline</text>
    <text x="${W - 2}" y="12" font-size="8" fill="var(--muted)" text-anchor="end">heights ×${vex} · dashed = sight line to far service line</text>
    <text x="${camX + 7}" y="${camZ - 6}" font-size="10" fill="var(--ink)">${fmt(r.height)} m · ${fmt(lens.pitch, 0)}°</text>`;
}

// ---------- level tab ----------
let unwatch = null;
$('#enableSensors').addEventListener('click', async () => {
  const res = await requestSensorPermission();
  if (res !== 'granted') {
    $('#levelHint').textContent = res === 'unsupported'
      ? 'This browser has no tilt sensor access. Open the app in Safari on the iPhone.'
      : 'Motion access was refused. In Settings › Safari, allow Motion & Orientation Access, then reload.';
    return;
  }
  $('#gaugeOverlay').hidden = false;
  keepAwake();
  if (unwatch) unwatch();
  unwatch = watchTilt(renderTilt);
});

$('#closeGauge').addEventListener('click', () => {
  if (unwatch) unwatch();
  unwatch = null;
  $('#gaugeOverlay').hidden = true;
  releaseAwake();
});

$('#targetInput').addEventListener('input', renderTarget);

function renderTarget() {
  const t = parseFloat($('#targetInput').value);
  $('#targetVal').textContent = Number.isFinite(t) ? `${fmt(t, 1)}°` : '–';
}

// Which way the phone is held: +1 = right edge up, -1 = left edge up, 0 = upright portrait.
let held = 1;
function updateHeld(sideUp) {
  if (Math.abs(sideUp) > 0.6) held = Math.sign(sideUp);
  else if (Math.abs(sideUp) < 0.4) held = 0;
  const rot = $('#rot');
  // If the page hasn't rotated itself (rotation lock on), turn the gauge ourselves.
  const pagePortrait = window.innerHeight > window.innerWidth;
  const turn = held !== 0 && pagePortrait;
  rot.classList.toggle('turn', turn);
  rot.classList.toggle('upright', held === 0);
  rot.style.setProperty('--turn', `${held > 0 ? 90 : -90}deg`);
}

function renderTilt({ camDown, roll, sideUp }) {
  updateHeld(sideUp);
  const t = parseFloat($('#targetInput').value);
  $('#tiltVal').textContent = `${fmt(camDown, 1)}°`;
  const overlay = $('#gaugeOverlay');
  if (Number.isFinite(t)) {
    const d = camDown - t;
    const good = Math.abs(d) <= 1;
    overlay.classList.toggle('good', good);
    overlay.classList.toggle('off', !good);
    $('#deltaVal').textContent = good ? 'On target' : d > 0 ? `Aim up ${fmt(Math.abs(d), 1)}°` : `Aim down ${fmt(Math.abs(d), 1)}°`;
  }
  // The bubble floats to the high end of the phone's long edge, as seen from behind the screen.
  const side = held === 0 ? 1 : -held;
  const clamped = Math.max(-10, Math.min(10, roll)) * side;
  $('#bubble').style.left = `calc(${50 + clamped * 5}% - 9px)`;
  $('#rollVal').textContent = Math.abs(roll) < 1 ? 'Horizon level' : `Horizon ${fmt(Math.abs(roll), 1)}° off level`;
}

// Keep the screen on while the gauge is up (iOS 16.4+).
let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
}
function releaseAwake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('#gaugeOverlay').hidden) keepAwake();
});

// ---------- courts tab ----------
const form = $('#courtForm');
let editing = null;

function loadForm(c) {
  editing = c;
  form.club.value = c.club || '';
  form.name.value = c.name || '';
  form.netPost.value = c.net.post;
  form.netCentre.value = c.net.centre;
  form.aRunback.value = c.ends.A.runback;
  form.aFence.value = c.ends.A.fenceHeight;
  form.aWall.value = c.ends.A.wallHeight || 0;
  form.bRunback.value = c.ends.B.runback;
  form.bFence.value = c.ends.B.fenceHeight;
  form.bWall.value = c.ends.B.wallHeight || 0;
  $('#deleteCourt').hidden = !courts.some((x) => x.id === c.id);
}

$('#editCourt').addEventListener('change', (e) => loadForm(courts.find((c) => c.id === e.target.value)));
$('#newCourt').addEventListener('click', () => {
  loadForm({
    id: `c-${Date.now().toString(36)}`, club: '', name: '',
    net: { post: 1.07, centre: 0.914 },
    ends: { A: { runback: 6.4, fenceHeight: 3, wallHeight: 0 }, B: { runback: 6.4, fenceHeight: 3, wallHeight: 0 } },
  });
  form.name.focus();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const num = (v) => parseFloat(v);
  const c = {
    id: editing.id,
    club: form.club.value.trim(),
    name: form.name.value.trim(),
    net: { post: num(form.netPost.value), centre: num(form.netCentre.value) },
    ends: {
      A: { runback: num(form.aRunback.value), fenceHeight: num(form.aFence.value), wallHeight: num(form.aWall.value) || 0 },
      B: { runback: num(form.bRunback.value), fenceHeight: num(form.bFence.value), wallHeight: num(form.bWall.value) || 0 },
    },
  };
  const i = courts.findIndex((x) => x.id === c.id);
  if (i >= 0) courts[i] = c; else courts.push(c);
  saveCourts();
  state.courtId = c.id;
  saveSettings();
  fillCourtSelects();
  loadForm(c);
  update();
});

$('#deleteCourt').addEventListener('click', () => {
  if (courts.length <= 1) return;
  courts = courts.filter((c) => c.id !== editing.id);
  saveCourts();
  state.courtId = courts[0].id;
  fillCourtSelects();
  loadForm(courts[0]);
  update();
});

for (const [id, key] of [['#gripHeight', 'gripHeight'], ['#handleLength', 'handleLength'], ['#stickAbove', 'stickAboveClamp']]) {
  $(id).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!(v >= 0)) return;
    settings[key] = v;
    saveSettings();
    state.height = null;
    update();
  });
}

$('#shareCourts').addEventListener('click', async () => {
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(courts))));
  const url = `${location.origin}${location.pathname}#courts=${data}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Court Cam courts', url });
    else { await navigator.clipboard.writeText(url); $('#shareMsg').textContent = ' Copied.'; }
  } catch { /* cancelled */ }
});

function importFromHash() {
  const m = location.hash.match(/courts=([^&]+)/);
  if (!m) return;
  try {
    const incoming = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    for (const c of incoming) {
      const i = courts.findIndex((x) => x.id === c.id);
      if (i >= 0) courts[i] = c; else courts.push(c);
    }
    saveCourts();
  } catch { /* bad link */ }
  history.replaceState(null, '', location.pathname);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- init ----------
fillCourtSelects();
$('#phone').value = settings.phone;
$('#farPlayer').checked = settings.farPlayer;
for (const [id, key, scale] of SERVE_FIELDS) $(id).value = +(settings[key] * scale).toFixed(2);
$('#gripHeight').value = settings.gripHeight;
$('#handleLength').value = settings.handleLength;
$('#stickAbove').value = settings.stickAboveClamp;
loadForm(currentCourt());
update();

if ('serviceWorker' in navigator) {
  // When an update takes over, reload once so the page and its files are all the same version.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
