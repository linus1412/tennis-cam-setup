// 3D view of the court, fences and phone. Loaded on demand when the 3D tab opens.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { COURT } from './geometry.js';

// App coordinates: x right, y down the court from the camera-end baseline, z up.
// three.js: y up, so map (x, y, z) -> (x, z, -y).
const V = (x, y, z) => new THREE.Vector3(x, z, -y);

const COLORS = {
  sky: 0xdfe8ee,
  surround: 0x2f6b4f,
  court: 0x3d7fb0,
  line: 0xffffff,
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

export function mount(el, s) {
  container = el;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.querySelector('.scene-canvas').appendChild(renderer.domElement);
  hud = container.querySelector('.scene-hud');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-10, 20, 8);
  scene.add(sun);

  cam = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
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
  scene.add(root);
  hud.textContent = `${s.r.height.toFixed(2)} m · ${s.r.chosen.pitch.toFixed(0)}° down · ${s.r.chosen.id} · ${s.mode}`;
  requestRender();
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
  g.add(flatBox(-halfOuter - 2, halfOuter + 2, -near.runback - 2, L + far.runback + 2, -0.004, 0x6f7f74));
  g.add(flatBox(-halfOuter, halfOuter, -near.runback, L + far.runback, -0.002, COLORS.surround));
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
  for (const [x0, x1, y0, y1] of lines) g.add(flatBox(x0, x1, y0, y1, 0.002, COLORS.line));
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
  const p = presets()[name];
  if (!p) return;
  container.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
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
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
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

function render() {
  renderer.render(scene, cam);
}
