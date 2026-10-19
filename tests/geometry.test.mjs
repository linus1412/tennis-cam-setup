import test from 'node:test';
import assert from 'node:assert/strict';
import { lensFov, minHeightForServiceLine, recommend, serveHeights, serveOptions } from '../app/geometry.js';
import { tiltFromOrientation } from '../app/sensor.js';
import { phoneLenses } from '../app/data.js';

const net = { post: 1.06, centre: 0.895 };
const lenses = [
  { id: '1.0×', eqFocal: 26, fov: lensFov(26) },
  { id: '0.5×', eqFocal: 13, fov: lensFov(13) },
];

test('lens FOV for 16:9 video', () => {
  assert.ok(Math.abs(lensFov(26).h - 67.3) < 0.5);
  assert.ok(Math.abs(lensFov(13).h - 106.2) < 0.5);
});

test('min height to see far service line over the net (Court 1, end A)', () => {
  const singles = minHeightForServiceLine({ distBehind: 4.72, mode: 'singles', net });
  const doubles = minHeightForServiceLine({ distBehind: 4.72, mode: 'doubles', net });
  assert.ok(singles > 3.5 && singles < 3.8, String(singles));
  assert.ok(doubles > singles);
});

test('Court 1 needs the ultra-wide for doubles', () => {
  const r = recommend({ end: { runback: 4.72 }, net, mode: 'doubles', lenses, maxHeight: 4 });
  assert.equal(r.chosen.id, '0.5×');
  assert.ok(r.chosen.fits);
});

test('tilt sensor maths', () => {
  assert.ok(Math.abs(tiltFromOrientation(0, 0).camDown - 90) < 1e-9); // flat, screen up
  assert.ok(Math.abs(tiltFromOrientation(90, 0).camDown) < 1e-9); // upright portrait
  assert.ok(Math.abs(tiltFromOrientation(0, 60).camDown - 30) < 1e-9); // landscape, 30° down
  assert.ok(tiltFromOrientation(0, -60).sideUp > 0.8); // landscape, right edge up
  assert.ok(tiltFromOrientation(0, 60).sideUp < -0.8); // landscape, left edge up
  assert.ok(Math.abs(tiltFromOrientation(80, 0).sideUp) < 1e-9); // portrait
});

test('serve contact height for a 183 cm player', () => {
  const { contact, toss } = serveHeights({ playerHeight: 1.83, racketLength: 0.686, jump: 0.2, tossAbove: 0.6 });
  assert.ok(contact > 2.8 && contact < 3.1, String(contact));
  assert.ok(Math.abs(toss - contact - 0.6) < 1e-9);
});

test('aiming higher shows more above the far server', () => {
  const [wide] = serveOptions({ height: 4.2, distBehind: 4.72, mode: 'singles', lenses: [lenses[1]] });
  const [centred, high] = wide.tilts;
  assert.ok(high.pitch < centred.pitch);
  assert.ok(high.far > centred.far);
});

test('serve tilt: most tilt that keeps both tosses in, and it drives the recommendation', () => {
  const serve = { contact: 2.96, toss: 3.56 };
  const base = { end: { runback: 4.72 }, net, mode: 'singles', lenses: phoneLenses('iphone-12'), maxHeight: 4.75, farPlayer: false, serve };
  const r = recommend(base);
  // Albert Club End A: 0.8× at 25°, not the 0.9× that can't show the far toss.
  assert.ok(r.chosen.forServe);
  assert.equal(r.chosen.id, '0.8×');
  assert.equal(r.chosen.pitch, 25);
  const opts = serveOptions({ height: 4.75, distBehind: 4.72, mode: 'singles', lenses: [r.chosen], farPlayer: false, serve });
  const row = opts[0].tilts.find((t) => t.kind === 'serve');
  assert.equal(row.pitch, r.chosen.pitch);
  assert.ok(Math.min(row.near, row.far) >= serve.toss);
  // The centred tilt (steeper here) cuts off the far server's toss.
  const centred = opts[0].tilts.find((t) => t.kind === 'centred');
  assert.ok(centred.pitch > row.pitch && centred.far < serve.toss);
});
