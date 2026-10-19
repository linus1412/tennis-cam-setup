// Phone tilt from DeviceOrientation. Works in any orientation because it only
// uses rotation-matrix elements, which don't depend on the Euler decomposition.
//   R = Rz(alpha) · Rx(beta) · Ry(gamma)
//   up-component of the screen normal (+z)   = cos(beta)·cos(gamma)
//   up-component of the long axis (+y)       = sin(beta)
// The rear camera looks along −z, so its angle below the horizon is
//   asin(cos(beta)·cos(gamma)).

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function tiltFromOrientation(beta, gamma) {
  const b = rad(beta), g = rad(gamma);
  const camDown = deg(Math.asin(Math.max(-1, Math.min(1, Math.cos(b) * Math.cos(g)))));
  // In landscape the long axis should be horizontal for a level horizon.
  const roll = deg(Math.asin(Math.max(-1, Math.min(1, Math.sin(b)))));
  return { camDown, roll };
}

export async function requestSensorPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return 'unsupported';
  if (typeof DOE.requestPermission === 'function') {
    try {
      return await DOE.requestPermission(); // 'granted' | 'denied'
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

// Calls onTilt({camDown, roll}) with light smoothing. Returns an unsubscribe fn.
export function watchTilt(onTilt, smoothing = 0.25) {
  let s = null;
  const handler = (e) => {
    if (e.beta == null || e.gamma == null) return;
    const t = tiltFromOrientation(e.beta, e.gamma);
    s = s ? {
      camDown: s.camDown + (t.camDown - s.camDown) * smoothing,
      roll: s.roll + (t.roll - s.roll) * smoothing,
    } : t;
    onTilt(s);
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}
