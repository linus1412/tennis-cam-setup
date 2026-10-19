// 3D view of the court, fences and phone. Loaded on demand when the 3D tab opens.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { COURT, cameraBasis, project, netHeightAt } from './geometry.js';

// App coordinates: x right, y down the court from the camera-end baseline, z up.
// three.js: y up, so map (x, y, z) -> (x, z, -y).
const V = (x, y, z) => new THREE.Vector3(x, z, -y);

const COLORS = {
  sky: 0xdfe8ee,
  surround: 0x2f6b4f,
  court: 0x3d7fb0,
  line: 0xffffff,
  lineOut: 0xe0402a, // court line outside the phone's frame
  cone: 0xff8a1f,
  shadow: 0x2a0f3d,
  net: 0x1b1f1d,
  post: 0x2c3a33,
  wall: 0x9a5a43,
  fence: 0x1f3a2a,
  stick: 0x222222,
  phone: 0x111418,
};

const SIDE_RUNOFF = 3.66;
const PHONE = { long: 0.147, short: 0.0715, thick: 0.0074 }; // iPhone 12, landscape

let renderer, scene, cam, controls, root, container, hud, setup, frame = null;
// What the phone sees: same position and tilt as the phone, its zoom's field of view, 16:9.
let phoneCam, mode = 'orbit', phoneHud;
// On/off switches under the view, remembered per device.
const show = { split: true, cone: true, shadow: true };
try { Object.assign(show, JSON.parse(localStorage.getItem('view3d') || '{}')); } catch { /* defaults */ }
const VIDEO_ASPECT = 16 / 9;

export function mount(el, s) {
  container = el;
  // Log depth avoids flicker between the thin ground layers when viewed from far away.
  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.querySelector('.scene-canvas').appendChild(renderer.domElement);
  hud = container.querySelector('.scene-hud');
  phoneHud = container.querySelector('.phone-hud');
  container.querySelectorAll('[data-toggle]').forEach((b) => {
    const key = b.dataset.toggle;
    const paint = () => { b.classList.toggle('on', show[key]); b.setAttribute('aria-pressed', String(show[key])); };
    paint();
    b.addEventListener('click', () => {
      show[key] = !show[key];
      paint();
      try { localStorage.setItem('view3d', JSON.stringify(show)); } catch { /* private mode */ }
      if (key === 'split') requestRender(); else update(setup);
    });
  });

  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-10, 20, 8);
  scene.add(sun);

  cam = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  cam.layers.enable(OVERLAY); // the phone camera only sees layer 0, so no cone in its view
  phoneCam = new THREE.PerspectiveCamera(40, VIDEO_ASPECT, 0.1, 300);
  controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // stay above the ground
  controls.addEventListener('change', requestRender);

  new ResizeObserver(resize).observe(container.querySelector('.scene-canvas'));
  container.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => goTo(b.dataset.view)));

  update(s);
  goTo('iso', false);
}

export function update(s) {
  setup = s;
  if (!scene) return;
  if (root) {
    scene.remove(root);
    root.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  }
  root = new THREE.Group();
  buildCourt(root, s);
  buildNet(root, s.court.net);
  buildFences(root, s);
  buildRig(root, s);
  if (show.cone) buildCone(root, s);
  if (show.shadow) buildNetShadow(root, s);
  scene.add(root);
  placePhoneCam(s);
  renderHud();
  requestRender();
}

function renderHud() {
  const s = setup;
  const prefix = mode === 'phone' ? 'Phone view · ' : '';
  hud.textContent = `${prefix}${s.r.height.toFixed(2)} m · ${s.r.chosen.pitch.toFixed(0)}° down · ${s.r.chosen.id} · ${s.mode}`;
}

// three.js cameras look along −z, the same way as the phone's rear camera in buildRig.
function placePhoneCam(s) {
  const { r, offset = 0 } = s;
  phoneCam.fov = r.chosen.fov.v;
  phoneCam.updateProjectionMatrix();
  phoneCam.position.copy(V(offset, -r.distBehind + 0.06, r.height));
  phoneCam.rotation.set(-THREE.MathUtils.degToRad(r.chosen.pitch), -THREE.MathUtils.degToRad(r.chosen.yaw || 0), 0, 'YXZ');
}

// ---------- scene pieces ----------

function flatBox(x0, x1, y0, y1, z, color) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), 0.004, Math.abs(y1 - y0));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, z));
  return m;
}

function buildCourt(g, s) {
  const near = s.court.ends[s.endKey], far = s.court.ends[s.endKey === 'A' ? 'B' : 'A'];
  const L = COURT.length, hw = COURT.doublesHalfWidth, sw = COURT.singlesHalfWidth;
  const halfOuter = hw + SIDE_RUNOFF;
  g.add(flatBox(-halfOuter - 2, halfOuter + 2, -near.runback - 2, L + far.runback + 2, -0.03, 0x6f7f74));
  g.add(flatBox(-halfOuter, halfOuter, -near.runback, L + far.runback, -0.015, COLORS.surround));
  g.add(flatBox(-hw, hw, 0, L, 0, COLORS.court));

  const lines = [];
  const line = (x0, x1, y0, y1) => lines.push([x0, x1, y0, y1]);
  const svcNear = COURT.halfLength - COURT.serviceFromNet, svcFar = COURT.halfLength + COURT.serviceFromNet;
  line(-hw, hw, -0.1, 0); // baselines are 10 cm, drawn inside the court
  line(-hw, hw, L, L + 0.1);
  for (const x of [-hw, hw - 0.05, -sw, sw - 0.05]) line(x, x + 0.05, 0, L);
  line(-sw, sw, svcNear - 0.025, svcNear + 0.025);
  line(-sw, sw, svcFar - 0.025, svcFar + 0.025);
  line(-0.025, 0.025, svcNear, svcFar);
  line(-0.025, 0.025, 0, 0.1); // centre marks
  line(-0.025, 0.025, L - 0.1, L);
  // Split each line into runs inside / outside the phone's frame; outside runs are red.
  const inFrame = show.cone ? frameTest(s) : () => true;
  for (const [x0, x1, y0, y1] of lines) {
    const alongX = x1 - x0 > y1 - y0;
    const len = alongX ? x1 - x0 : y1 - y0;
    const n = Math.max(1, Math.ceil(len / 0.05));
    const at = (t) => alongX ? [x0 + (x1 - x0) * t, (y0 + y1) / 2] : [(x0 + x1) / 2, y0 + (y1 - y0) * t];
    let start = 0, inside = inFrame(...at(0));
    for (let i = 1; i <= n; i++) {
      const now = i === n ? !inside : inFrame(...at(i / n));
      if (now === inside) continue;
      const t0 = start, t1 = i / n;
      const color = inside ? COLORS.line : COLORS.lineOut;
      g.add(alongX ? flatBox(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, y0, y1, 0.01, color)
                   : flatBox(x0, x1, y0 + (y1 - y0) * t0, y0 + (y1 - y0) * t1, 0.01, color));
      start = i / n;
      inside = now;
    }
  }
}

function buildNet(g, net) {
  const y = COURT.halfLength, px = COURT.postHalfWidth;
  // Net mesh as a flat polygon dipping to the centre strap.
  const shape = new THREE.Shape();
  shape.moveTo(-px, 0);
  shape.lineTo(-px, net.post);
  shape.lineTo(0, net.centre);
  shape.lineTo(px, net.post);
  shape.lineTo(px, 0);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: COLORS.net, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  mesh.position.copy(V(0, y, 0));
  g.add(mesh);
  // White tape along the top.
  for (const sx of [-1, 1]) {
    const a = V(sx * px, y, net.post), b = V(0, y, net.centre);
    const len = a.distanceTo(b);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.02), new THREE.MeshLambertMaterial({ color: COLORS.line }));
    tape.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0, -0.03, 0));
    tape.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    g.add(tape);
  }
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, net.post, 12), new THREE.MeshLambertMaterial({ color: COLORS.post }));
    post.position.copy(V(sx * px, y, net.post / 2));
    g.add(post);
  }
}

let meshTexture = null;
function chainLinkTexture() {
  if (meshTexture) return meshTexture.clone();
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(30,45,38,0.9)';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(0, 32); x.lineTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.closePath();
  x.stroke();
  meshTexture = new THREE.CanvasTexture(c);
  meshTexture.wrapS = meshTexture.wrapT = THREE.RepeatWrapping;
  return meshTexture.clone();
}

function buildFence(g, yPos, end, width) {
  const wall = end.wallHeight || 0;
  if (wall > 0) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(width, wall, 0.25), new THREE.MeshLambertMaterial({ color: COLORS.wall }));
    w.position.copy(V(0, yPos, wall / 2));
    g.add(w);
  }
  const h = end.fenceHeight - wall;
  if (h > 0) {
    const tex = chainLinkTexture();
    tex.repeat.set(width / 0.25, h / 0.25); // ~5 cm diamonds would be too dense to see; 25 cm reads well
    tex.needsUpdate = true;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(width, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    f.position.copy(V(0, yPos, wall + h / 2));
    g.add(f);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, width, 8), new THREE.MeshLambertMaterial({ color: COLORS.post }));
    rail.rotation.z = Math.PI / 2;
    rail.position.copy(V(0, yPos, end.fenceHeight));
    g.add(rail);
  }
}

function buildFences(g, s) {
  const near = s.court.ends[s.endKey], far = s.court.ends[s.endKey === 'A' ? 'B' : 'A'];
  const width = 2 * (COURT.doublesHalfWidth + SIDE_RUNOFF);
  buildFence(g, -near.runback, near, width);
  buildFence(g, COURT.length + far.runback, far, width);
}

// Swing Stick and phone at the camera position.
function buildRig(g, s) {
  const { r, offset = 0, stickAboveClamp = 0.8, handleLength = 1.1 } = s;
  const y = -r.distBehind + 0.04; // just on the court side of the fence
  const fork = r.height - stickAboveClamp;
  const bottom = Math.max(fork - handleLength, 0);
  const top = r.height - 0.06;
  const matStick = new THREE.MeshLambertMaterial({ color: COLORS.stick });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, top - bottom, 10), matStick);
  pole.position.copy(V(offset, y, (top + bottom) / 2));
  g.add(pole);
  const forkMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.09), matStick);
  forkMesh.position.copy(V(offset, y - 0.02, fork));
  g.add(forkMesh);

  // Phone: landscape, rear camera facing down the court, tilted down by the pitch.
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(PHONE.long, PHONE.short, PHONE.thick), new THREE.MeshLambertMaterial({ color: COLORS.phone }));
  phone.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), new THREE.MeshBasicMaterial({ color: 0x5aa0ff }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-PHONE.long / 2 + 0.02, PHONE.short / 2 - 0.02, -PHONE.thick / 2 - 0.002); // rear face = -z
  phone.add(lens);
  phone.position.copy(V(offset, y + 0.02, r.height));
  const pitch = THREE.MathUtils.degToRad(r.chosen.pitch), yaw = THREE.MathUtils.degToRad(r.chosen.yaw || 0);
  phone.rotation.set(-pitch, -yaw, 0, 'YXZ');
  g.add(phone);
}

// ---------- viewing cone ----------

const OVERLAY = 1; // three.js layer for things only the orbit view shows

function phoneFrame(s) {
  const { r, offset = 0 } = s;
  const fov = r.chosen.fov;
  return {
    cam: [offset, -r.distBehind + 0.06, r.height],
    basis: cameraBasis(r.chosen.pitch, r.chosen.yaw || 0),
    tanH: Math.tan(THREE.MathUtils.degToRad(fov.h / 2)),
    tanV: Math.tan(THREE.MathUtils.degToRad(fov.v / 2)),
    fov,
  };
}

// Is a ground point inside the phone's frame?
function frameTest(s) {
  const f = phoneFrame(s);
  return (x, y) => {
    const q = project([x, y, 0], f.cam, f.basis, f.fov);
    return !!q && Math.abs(q.u) <= 1 && Math.abs(q.v) <= 1;
  };
}

const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function buildCone(g, s) {
  const f = phoneFrame(s);
  const far = s.court.ends[s.endKey === 'A' ? 'B' : 'A'];
  const yFar = COURT.length + far.runback;
  // Corner rays, in frame order: top-left, top-right, bottom-right, bottom-left.
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) =>
    add3(add3(f.basis.fwd, f.basis.right, sx * f.tanH), f.basis.up, sy * f.tanV));
  // Each ray stops at the ground, or level with the far baseline if it never reaches the ground.
  const ends = corners.map((d) => {
    const tGround = d[2] < 0 ? -f.cam[2] / d[2] : Infinity;
    const tFar = (COURT.length - f.cam[1]) / d[1];
    return add3(f.cam, d, Math.min(tGround, tFar > 0 ? tFar : Infinity, 60));
  });

  const apex = V(...f.cam);
  const pts = [];
  for (let i = 0; i < 4; i++) pts.push(apex, V(...ends[i]), V(...ends[(i + 1) % 4]));
  const sides = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.MeshBasicMaterial({ color: COLORS.cone, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  // WebGL lines are always 1px, so draw edges as thin tubes: four rays plus the rim.
  const edges = new THREE.Group();
  const edgeMat = new THREE.MeshBasicMaterial({ color: COLORS.cone });
  for (let i = 0; i < 4; i++) {
    // Taper from fine at the phone to thick far away, so edges read at overview distances.
    edges.add(tube(apex, V(...ends[i]), 0.02, edgeMat, 0.14));
    edges.add(tube(V(...ends[i]), V(...ends[(i + 1) % 4]), 0.12, edgeMat));
  }
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12), edgeMat);
  marker.position.copy(apex);
  edges.add(marker);

  // Ground footprint: the surround clipped to the four sides of the frame.
  const halfOuter = COURT.doublesHalfWidth + SIDE_RUNOFF;
  const near = s.court.ends[s.endKey];
  let poly = [[-halfOuter, -near.runback], [halfOuter, -near.runback], [halfOuter, yFar], [-halfOuter, yFar]];
  const planes = [
    add3(f.basis.fwd.map((c) => c * f.tanH), f.basis.right, -1),
    add3(f.basis.fwd.map((c) => c * f.tanH), f.basis.right, 1),
    add3(f.basis.fwd.map((c) => c * f.tanV), f.basis.up, -1),
    add3(f.basis.fwd.map((c) => c * f.tanV), f.basis.up, 1),
  ];
  for (const n of planes) poly = clip(poly, ([x, y]) => dot3(n, [x - f.cam[0], y - f.cam[1], -f.cam[2]]));
  const footprint = new THREE.Group();
  if (poly.length >= 3) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: COLORS.cone, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    // Shape is drawn in the x/y plane; lay it flat on the ground (app y -> three −z).
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.025;
    footprint.add(fill);
    for (let i = 0; i < poly.length; i++) {
      const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
      footprint.add(tube(V(a[0], a[1], 0.05), V(b[0], b[1], 0.05), 0.09, edgeMat));
    }
  }

  for (const o of [sides, edges, footprint]) {
    o.traverse((c) => c.layers.set(OVERLAY));
    g.add(o);
  }
}

// ---------- net shadow ----------

// Ground beyond the net that the phone only sees through the mesh: for each point along
// the net tape, the sight line over the tape lands on the ground further back; everything
// between the net and that landing point is behind the net.
function buildNetShadow(g, s) {
  const { r, offset = 0 } = s;
  const net = s.court.net;
  const C = [offset, -r.distBehind + 0.06, r.height];
  const far = s.court.ends[s.endKey === 'A' ? 'B' : 'A'];
  const yMax = COURT.length + far.runback;
  const yNet = COURT.halfLength, px = COURT.postHalfWidth;
  const edge = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const xn = -px + (2 * px * i) / n;
    const h = netHeightAt(xn, net);
    // Point on the tape, then extend the ray from the camera through it down to the ground.
    const k = h < C[2] ? C[2] / (C[2] - h) : Infinity;
    let gx = C[0] + (xn - C[0]) * k, gy = C[1] + (yNet - C[1]) * k;
    if (!(gy <= yMax)) { // capped at the far fence
      const kf = (yMax - C[1]) / (yNet - C[1]);
      gx = C[0] + (xn - C[0]) * kf;
      gy = yMax;
    }
    edge.push([gx, gy]);
  }
  const poly = [[-px, yNet], [px, yNet], ...edge.reverse()];
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: COLORS.shadow, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.layers.set(OVERLAY);
  g.add(mesh);
}

// A thin cylinder from a to b (three.js vectors), radius rA at a and rB at b.
function tube(a, b, rA, material, rB = rA) {
  const dir = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, dir.length(), 8, 1, true), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// Sutherland–Hodgman: keep the part of a 2D polygon where side(p) >= 0.
function clip(poly, side) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// ---------- viewing ----------

function presets() {
  const s = setup, L = COURT.length;
  const centre = V(0, L / 2, 0);
  return {
    iso: { pos: V(-22, -14, 22), target: V(0, L / 2 - 2, 0) },
    top: { pos: V(0, L / 2 - 0.01, 48), target: centre },
    side: { pos: V(-34, L / 2, 4), target: V(0, L / 2, 2) },
    // Close-up of the stick and phone, from the court side of the fence.
    stick: { pos: V(1.6, -s.r.distBehind + 2.2, s.r.height + 0.2), target: V(0, -s.r.distBehind, s.r.height - 0.6) },
  };
}

function goTo(name, animate = true) {
  container.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  mode = name === 'phone' ? 'phone' : 'orbit';
  controls.enabled = mode === 'orbit';
  container.classList.toggle('phone-mode', mode === 'phone');
  renderHud();
  if (mode === 'phone') return requestRender();
  const p = presets()[name];
  if (!p) return;
  if (!animate) {
    cam.position.copy(p.pos);
    controls.target.copy(p.target);
    controls.update();
    requestRender();
    return;
  }
  const fromPos = cam.position.clone(), fromTarget = controls.target.clone();
  const t0 = performance.now(), dur = 450;
  const step = (now) => {
    const k = Math.min((now - t0) / dur, 1), e = k * k * (3 - 2 * k);
    cam.position.lerpVectors(fromPos, p.pos, e);
    controls.target.lerpVectors(fromTarget, p.target, e);
    controls.update();
    render();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function resize() {
  const el = container.querySelector('.scene-canvas');
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  requestRender();
}

// Render on demand; keep going while orbit damping settles.
function requestRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (controls.update()) requestRender();
    render();
  });
}

// Viewports use WebGL's bottom-left origin.
function render() {
  const el = renderer.domElement;
  const w = el.clientWidth, h = el.clientHeight;
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();

  if (mode === 'phone') {
    // Letterbox the 16:9 phone frame in the middle of the canvas.
    let fw = w, fh = w / VIDEO_ASPECT;
    if (fh > h) { fh = h; fw = h * VIDEO_ASPECT; }
    drawPhone((w - fw) / 2, (h - fh) / 2, fw, fh);
    phoneHud.hidden = true;
    return;
  }

  if (!show.split) {
    drawOrbit(0, 0, w, h);
    phoneHud.hidden = true;
    return;
  }

  // Split: phone frame along the bottom, 3D view above it with a 2px gap.
  let fh = Math.min(w / VIDEO_ASPECT, h * 0.45), fw = fh * VIDEO_ASPECT;
  drawPhone((w - fw) / 2, 0, fw, fh);
  drawOrbit(0, fh + 2, w, h - fh - 2);
  phoneHud.hidden = false;
  phoneHud.style.top = `${h - fh + 6}px`;
  phoneHud.style.left = `${(w - fw) / 2 + 6}px`;
}

function drawOrbit(x, y, w, h) {
  if (Math.abs(cam.aspect - w / h) > 1e-3) {
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(scene, cam);
}

function drawPhone(x, y, w, h) {
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(scene, phoneCam);
}
