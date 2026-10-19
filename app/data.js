import { lensFov } from './geometry.js';

// SwingVision zooms from 0.5× to 1.0× in 0.1 steps; 1× is the 26 mm wide lens.
// It advises zooming in as far as possible while keeping all four corners in view.
const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((z) => ({
  id: `${z.toFixed(1)}×`,
  name: `${z.toFixed(1)}× zoom`,
  eqFocal: 26 * z,
}));

// iPhone 12 and 12 mini share the same rear camera modules.
export const PHONES = {
  'iphone-12': {
    name: 'iPhone 12',
    lenses: ZOOMS,
  },
  'iphone-12-mini': {
    name: 'iPhone 12 mini',
    lenses: ZOOMS,
  },
};

// Video stabilisation crops roughly 10% of the frame (approximate, ±3°).
export const STABILISATION_CROP = 1.1;

export function phoneLenses(phoneId) {
  return PHONES[phoneId].lenses.map((l) => ({ ...l, fov: lensFov(l.eqFocal, STABILISATION_CROP) }));
}

export const DEFAULT_COURTS = [
  {
    id: 'albert-1',
    club: 'Albert Club',
    name: 'Court 1',
    net: { post: 1.06, centre: 0.895 },
    ends: {
      A: { runback: 4.72, fenceHeight: 6.0 },
      B: { runback: 4.69, fenceHeight: 2.7 },
    },
  },
];

// Swing Stick (1st gen): a fork hooks over the fence's top rail; the pole below it
// (22–72") is a handle for lifting it up there, and the top section raises the phone
// up to 24". Camera ends up ~0.8 m above the fork when fully raised (measured from
// SwingVision's product photo). Backup: clamp the fork to the mesh with the rear knob.
// Defaults for a 183 cm person: hands ~2.3 m overhead + ~1.1 m of handle = ~3.4 m rail;
// tightening the rear knob on the mesh needs your hands at the fork, ~2.3 m.
export const DEFAULT_SETTINGS = {
  phone: 'iphone-12',
  mode: 'singles',
  stickAboveClamp: 0.8,
  maxRailHeight: 3.4,
  maxClampHeight: 2.3,
  farPlayer: true,
};
