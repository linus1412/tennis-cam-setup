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
//   fork height  = grip height (hands overhead) + pole length from the base up to the fork rest
//   camera height = fork height + lens height above the fork rest
// Measured on the user's 1st-gen Swing Stick (2026-10-19), all distances to the fork rest
// (the part of the fork that sits on the top rail):
//   base → rest: 54 cm collapsed; the three lower sections add 41 (lowest), 43, 43 cm → 181 cm
//   rest → top of the phone clamp: 22 cm collapsed, 70 cm with the top section raised (+48 cm)
//   rest → bottom jaw of the phone clamp ≈ 12.5 cm collapsed (scaled from the user's photo), so 60.5 cm raised
//   lens ≈ 1.3–5.9 cm above the bottom jaw, depending which way up the phone is clamped → 3.5 cm
//   the fence-hook knob sits 3 cm below the rest.
export const STICK = {
  baseToRest: 0.54,
  lowerSections: [0.43, 0.43, 0.41], // open the longer ones first
  restToLensRaised: 0.64,
  restToLensCollapsed: 0.16,
};
export const DEFAULT_SETTINGS = {
  phone: 'iphone-12',
  mode: 'singles',
  gripHeight: 2.3,
  handleLength: 1.81,
  stickAboveClamp: 0.64,
  farPlayer: true,
  // Serve check
  playerHeight: 1.83,
  racketLength: 0.686,
  jump: 0.2,
  tossAbove: 0.6,
};
