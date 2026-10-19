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
      A: { runback: 4.72, fenceHeight: 6.0, wallHeight: 2.0 }, // 2 m brick wall, mesh above
      B: { runback: 4.69, fenceHeight: 2.7, wallHeight: 0 },
    },
  },
];

// Swing Stick (1st gen): a fork hooks over the top rail or into a hole in the mesh.
// You hold the bottom of the pole overhead and lift the fork into place, so
//   fork height  = grip height (hands overhead) + handle length below the fork
//   camera height = fork height + ~0.8 m (top section fully raised; measured from
//                   SwingVision's product photo)
// Defaults: a 183 cm person grips ~2.3 m overhead; handle ~1.1 m (72" pole minus
// the 24" top section, less a hand's width). Both are estimates – measure yours.
export const DEFAULT_SETTINGS = {
  phone: 'iphone-12',
  mode: 'singles',
  gripHeight: 2.3,
  handleLength: 1.1,
  stickAboveClamp: 0.8,
  farPlayer: true,
  // Serve check
  playerHeight: 1.83,
  racketLength: 0.686,
  jump: 0.2,
  tossAbove: 0.6,
};
