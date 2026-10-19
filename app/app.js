import { COURT, recommend } from './geometry.js';
import { PHONES, phoneLenses, DEFAULT_COURTS, DEFAULT_SETTINGS } from './data.js';
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
let settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
const state = {
  courtId: settings.courtId || courts[0]?.id,
  end: settings.end || 'A',
  height: null, // null = use recommended
  offset: 0,
  target: null,
};

const saveCourts = () => store.set('courts', courts);
const saveSettings = () => store.set('settings', { ...settings, courtId: state.courtId, end: state.end });
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

bindSeg($('#end'), () => state.end, (v) => { state.end = v; state.height = null; saveSettings(); });
bindSeg($('#mode'), () => settings.mode, (v) => { settings.mode = v; state.height = null; saveSettings(); });

$('#court').addEventListener('change', (e) => { state.courtId = e.target.value; state.height = null; saveSettings(); update(); });
$('#phone').addEventListener('change', (e) => { settings.phone = e.target.value; saveSettings(); update(); });
$('#height').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  state.height = Number.isFinite(v) && v > 0 ? v : null;
  update(false);
});
$('#offset').addEventListener('input', (e) => { state.offset = parseFloat(e.target.value) || 0; update(); });
$('#farPlayer').addEventListener('change', (e) => { settings.farPlayer = e.target.checked; saveSettings(); update(); });

// Highest camera height possible at this end: clamp at the fence top (or as high as
// you can reach) and the stick lifts the phone above that.
function maxHeightFor(end) {
  return Math.min(end.fenceHeight, settings.maxClampHeight) + settings.stickAboveClamp;
}

function update(syncHeightField = true) {
  const court = currentCourt();
  if (!court) return;
  const end = court.ends[state.end];
  const lenses = phoneLenses(settings.phone);
  const base = { end, net: court.net, mode: settings.mode, lenses, offsetX: state.offset, farPlayer: settings.farPlayer };

  const recHeight = maxHeightFor(end);
  const height = state.height ?? recHeight;
  if (syncHeightField) $('#height').value = fmt(height);
  const r = recommend({ ...base, maxHeight: height });
  state.target = r.chosen.pitch;
  renderResult(r, { court, end, recHeight });
  renderSide(r, court);
}

function renderResult(r, { end, recHeight }) {
  const lens = r.chosen;
  const msgs = [];
  if (r.heightOk) {
    msgs.push(['ok', `Far service line clears the net by ${Math.round(r.clearance * 100)} cm.`]);
  } else if (r.clearance > 0) {
    msgs.push(['warn', `Far service line only just clears the net (${Math.round(r.clearance * 100)} cm). Aim for ${fmt(r.minHeight)} m or more.`]);
  } else {
    msgs.push(['warn', `Too low to see the far service line over the net. Need at least ${fmt(r.minHeight)} m (net hides it by ${Math.round(-r.clearance * 100)} cm).`]);
  }
  if (recHeight < r.minHeight) {
    msgs.push(['warn', `At this end the stick tops out at ${fmt(recHeight)} m – short of the ${fmt(r.minHeight)} m recommended.`]);
  }
  if (r.height > end.fenceHeight) {
    msgs.push(['info', `Camera is ${fmt(r.height - end.fenceHeight)} m above the ${fmt(end.fenceHeight, 1)} m fence top.`]);
  }
  if (!lens.fits) {
    msgs.push(['warn', `Even ${lens.name} can't fit the whole ${settings.mode} court from here.`]);
  } else {
    const other = r.lenses.find((l) => l !== lens);
    if (other && !other.fits) msgs.push(['info', `${other.name} is too narrow from ${fmt(r.distBehind)} m behind the baseline.`]);
    if (lens.pitchRange) msgs.push(['info', `Anything from ${fmt(lens.pitchRange[0], 0)}° to ${fmt(lens.pitchRange[1], 0)}° keeps the court in frame; ${fmt(lens.pitch, 0)}° centres it.`]);
  }

  $('#result').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${fmt(r.height)}<small> m</small></b><span>Height</span></div>
      <div class="stat"><b>${fmt(lens.pitch, 0)}°</b><span>Tilt down</span></div>
      <div class="stat"><b>${lens.id}</b><span>Lens</span></div>
    </div>
    <ul class="msgs">${msgs.map(([c, t]) => `<li class="${c}">${t}</li>`).join('')}</ul>
    <div class="actions"><button class="primary" id="goLevel">Set phone to ${fmt(lens.pitch, 0)}° →</button></div>`;
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
  $('#enableSensors').hidden = true;
  $('#gauge').hidden = false;
  if (unwatch) unwatch();
  unwatch = watchTilt(renderTilt);
});

$('#targetInput').addEventListener('input', renderTarget);

function renderTarget() {
  const t = parseFloat($('#targetInput').value);
  $('#targetVal').textContent = Number.isFinite(t) ? `${fmt(t, 1)}°` : '–';
}

function renderTilt({ camDown, roll }) {
  const t = parseFloat($('#targetInput').value);
  $('#tiltVal').textContent = `${fmt(camDown, 1)}°`;
  const card = document.querySelector('.level');
  if (Number.isFinite(t)) {
    const d = camDown - t;
    const good = Math.abs(d) <= 1;
    card.classList.toggle('good', good);
    card.classList.toggle('off', !good);
    $('#deltaVal').textContent = good ? 'On target' : d > 0 ? `Tilt up ${fmt(Math.abs(d), 1)}°` : `Tilt down ${fmt(Math.abs(d), 1)}°`;
  }
  const clamped = Math.max(-10, Math.min(10, roll));
  $('#bubble').style.left = `calc(${50 + clamped * 5}% - 9px)`;
  $('#rollVal').textContent = Math.abs(roll) < 1 ? 'Horizon level' : `Horizon ${fmt(Math.abs(roll), 1)}° off level`;
}

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
  form.bRunback.value = c.ends.B.runback;
  form.bFence.value = c.ends.B.fenceHeight;
  $('#deleteCourt').hidden = !courts.some((x) => x.id === c.id);
}

$('#editCourt').addEventListener('change', (e) => loadForm(courts.find((c) => c.id === e.target.value)));
$('#newCourt').addEventListener('click', () => {
  loadForm({
    id: `c-${Date.now().toString(36)}`, club: '', name: '',
    net: { post: 1.07, centre: 0.914 },
    ends: { A: { runback: 6.4, fenceHeight: 3 }, B: { runback: 6.4, fenceHeight: 3 } },
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
      A: { runback: num(form.aRunback.value), fenceHeight: num(form.aFence.value) },
      B: { runback: num(form.bRunback.value), fenceHeight: num(form.bFence.value) },
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

for (const [id, key] of [['#maxClamp', 'maxClampHeight'], ['#stickAbove', 'stickAboveClamp']]) {
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
$('#maxClamp').value = settings.maxClampHeight;
$('#stickAbove').value = settings.stickAboveClamp;
loadForm(currentCourt());
update();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
