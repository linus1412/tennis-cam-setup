import test from 'node:test';
import assert from 'node:assert/strict';
import { lensFov, minHeightForServiceLine, recommend } from '../app/geometry.js';
import { tiltFromOrientation } from '../app/sensor.js';

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
