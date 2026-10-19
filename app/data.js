import { lensFov } from './geometry.js';

// iPhone 12 and 12 mini share the same rear camera modules.
export const PHONES = {
  'iphone-12': {
    name: 'iPhone 12',
    lenses: [
      { id: '1x', name: '1× wide', eqFocal: 26 },
      { id: '0.5x', name: '0.5× ultra-wide', eqFocal: 13 },
    ],
  },
  'iphone-12-mini': {
    name: 'iPhone 12 mini',
    lenses: [
      { id: '1x', name: '1× wide', eqFocal: 26 },
      { id: '0.5x', name: '0.5× ultra-wide', eqFocal: 13 },
    ],
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

// Swing Stick: the phone sits ~0.6 m above where the stick clamps (one review; unconfirmed).
// maxClampHeight = highest point on a fence you can clamp the stick to. Default: a 183 cm
// person reaches ~2.43 m (1.33 × height) at full stretch; ~2.3 m to work a clamp.
export const DEFAULT_SETTINGS = {
  phone: 'iphone-12',
  mode: 'singles',
  stickAboveClamp: 0.6,
  maxClampHeight: 2.3,
  farPlayer: true,
};
