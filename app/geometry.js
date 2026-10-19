// Court / camera geometry. Pure functions, no DOM.
// Coordinates (metres): origin = centre of the NEAR baseline on the ground,
// +y runs down the court towards the far end, +x to the right, +z up.

export const COURT = {
  length: 23.77,
  halfLength: 11.885,
  serviceFromNet: 6.40,
  singlesHalfWidth: 4.115,
  doublesHalfWidth: 5.485,
  postHalfWidth: 6.40, // posts sit 0.914 m outside the doubles sideline
};

// Rectilinear field of view for 16:9 landscape video. The 35mm-equivalent
// focal length refers to a 43.27 mm diagonal; iPhone sensors are 4:3 and
// 16:9 video uses the full sensor width.
export function lensFov(eqFocalMm, cropFactor = 1) {
  const diag = 43.27;
  const w = diag * 0.8, h43 = diag * 0.6;
  const h169 = (w * 9) / 16;
  const f = eqFocalMm * cropFactor;
  const deg = (r) => (r * 180) / Math.PI;
  return {
    h: deg(2 * Math.atan(w / 2 / f)),
    v: deg(2 * Math.atan(h169 / 2 / f)),
    v43: deg(2 * Math.atan(h43 / 2 / f)),
  };
}

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Height of the net tape at lateral position x (linear sag from post to centre strap).
export function netHeightAt(x, net) {
  const t = Math.min(Math.abs(x) / COURT.postHalfWidth, 1);
  return net.centre + (net.post - net.centre) * t;
}

export function halfWidth(mode) {
  return mode === 'doubles' ? COURT.doublesHalfWidth : COURT.singlesHalfWidth;
}

// Minimum camera height so the whole far service line is seen above the net tape.
// `distBehind` = horizontal distance from camera to the near baseline.
export function minHeightForServiceLine({ distBehind, offsetX = 0, mode, net, clearance = 0.05 }) {
  const ySvc = COURT.halfLength + COURT.serviceFromNet;
  const t = (COURT.halfLength + distBehind) / (ySvc + distBehind); // fraction of the ray at the net
  const hw = halfWidth(mode);
  let worst = 0;
  for (let i = 0; i <= 20; i++) {
    const px = -hw + (2 * hw * i) / 20;
    const xNet = offsetX + (px - offsetX) * t;
    worst = Math.max(worst, (netHeightAt(xNet, net) + clearance) / (1 - t));
  }
  return worst;
}

// How far above the net tape (m) the sight line to the far service line passes, worst case.
export function serviceLineClearance({ distBehind, height, offsetX = 0, mode, net }) {
  const ySvc = COURT.halfLength + COURT.serviceFromNet;
  const t = (COURT.halfLength + distBehind) / (ySvc + distBehind);
  const hw = halfWidth(mode);
  let worst = Infinity;
  for (let i = 0; i <= 20; i++) {
    const px = -hw + (2 * hw * i) / 20;
    const xNet = offsetX + (px - offsetX) * t;
    worst = Math.min(worst, height * (1 - t) - netHeightAt(xNet, net));
  }
  return worst;
}

// Points that must be inside the frame.
export function requiredPoints({ mode, farPlayer = true }) {
  const hw = halfWidth(mode);
  const L = COURT.length;
  const pts = [
    { name: 'near baseline L', p: [-hw, 0, 0] },
    { name: 'near baseline R', p: [hw, 0, 0] },
    { name: 'far baseline L', p: [-hw, L, 0] },
    { name: 'far baseline R', p: [hw, L, 0] },
  ];
  // Far player standing ~1.5 m behind the baseline, head ~1.8 m up.
  if (farPlayer) pts.push({ name: 'far player', p: [0, L + 1.5, 1.8] });
  return pts;
}

// Camera basis for pitch (deg, down from horizontal) and yaw (deg, + = right).
export function cameraBasis(pitchDeg, yawDeg = 0) {
  const p = rad(pitchDeg), y = rad(yawDeg);
  const fwd = [Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), -Math.sin(p)];
  const right = [Math.cos(y), -Math.sin(y), 0];
  const up = [Math.sin(y) * Math.sin(p), Math.cos(y) * Math.sin(p), Math.cos(p)];
  return { fwd, right, up };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Project a world point into normalised image coords: -1..1 is inside the frame.
export function project(point, cam, basis, fov) {
  const v = [point[0] - cam[0], point[1] - cam[1], point[2] - cam[2]];
  const z = dot(v, basis.fwd);
  if (z <= 0) return null;
  return {
    u: dot(v, basis.right) / z / Math.tan(rad(fov.h / 2)),
    v: dot(v, basis.up) / z / Math.tan(rad(fov.v / 2)),
  };
}

// For one lens: scan pitch and find the angle that best centres the required points.
export function solvePitch({ height, distBehind, offsetX = 0, mode, fov, farPlayer = true }) {
  const cam = [offsetX, -distBehind, height];
  // Aim at the court's centre line.
  const yaw = deg(Math.atan2(-offsetX, COURT.halfLength + distBehind));
  const pts = requiredPoints({ mode, farPlayer });
  let best = null;
  const ok = [];
  for (let p10 = 0; p10 <= 700; p10++) {
    const pitch = p10 / 10;
    const basis = cameraBasis(pitch, yaw);
    let margin = Infinity;
    for (const { p } of pts) {
      const q = project(p, cam, basis, fov);
      if (!q) { margin = -Infinity; break; }
      margin = Math.min(margin, 1 - Math.abs(q.u), 1 - Math.abs(q.v));
    }
    if (margin >= 0) ok.push(pitch);
    if (!best || margin > best.margin) best = { pitch, margin };
  }
  return {
    fits: best.margin >= 0,
    pitch: best.pitch,
    yaw,
    margin: best.margin, // fraction of half-frame left spare at the tightest point
    pitchRange: ok.length ? [ok[0], ok[ok.length - 1]] : null,
  };
}

// Full recommendation for one court end.
export function recommend({ end, net, mode, lenses, maxHeight, offsetX = 0, standoff = 0, farPlayer = true }) {
  const distBehind = Math.max(end.runback - standoff, 0.1);
  const minH = minHeightForServiceLine({ distBehind, offsetX, mode, net });
  // Higher is better for SwingVision tracking; use the highest reachable height.
  const height = maxHeight;
  const clearance = serviceLineClearance({ distBehind, height, offsetX, mode, net });
  const lensResults = lenses.map((lens) => ({
    ...lens,
    ...solvePitch({ height, distBehind, offsetX, mode, fov: lens.fov, farPlayer }),
  }));
  // Prefer the narrowest lens that fits with a little spare (more pixels on the ball).
  const fitting = lensResults.filter((l) => l.fits && l.margin >= 0.03);
  const chosen = fitting.sort((a, b) => b.eqFocal - a.eqFocal)[0]
    || lensResults.slice().sort((a, b) => b.margin - a.margin)[0];
  return { distBehind, height, minHeight: minH, heightOk: height >= minH, clearance, lenses: lensResults, chosen };
}
