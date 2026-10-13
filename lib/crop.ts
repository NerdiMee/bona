// The crop the phone chooses with its fingers, sent to the desk over a data channel.
// s = zoom (1 = full frame), cx/cy = centre of the visible window in frame units (0..1).
export type Crop = { s: number; cx: number; cy: number; mirror: boolean; w: number; h: number };

export const MAX_ZOOM = 4;
export const defaultCrop = (w = 1920, h = 1080): Crop => ({ s: 1, cx: 0.5, cy: 0.5, mirror: false, w, h });

export function clampCrop(c: Crop): Crop {
  const s = Math.min(MAX_ZOOM, Math.max(1, c.s));
  const half = 0.5 / s;
  return { ...c, s, cx: Math.min(1 - half, Math.max(half, c.cx)), cy: Math.min(1 - half, Math.max(half, c.cy)) };
}

/* CSS transform for an element that exactly fills its (same-aspect) box, transform-origin centre. */
export function cropTransform(c: Crop): string {
  const tx = (0.5 - c.cx) * c.s * 100, ty = (0.5 - c.cy) * c.s * 100;
  return `translate(${tx.toFixed(3)}%, ${ty.toFixed(3)}%) scale(${c.s.toFixed(4)})`;
}

/* Zoom about a point m (0..1 in box units) so what is under the finger stays put. */
export function zoomAbout(c: Crop, factor: number, mx: number, my: number): Crop {
  const s2 = Math.min(MAX_ZOOM, Math.max(1, c.s * factor));
  const px = c.cx + (mx - 0.5) / c.s, py = c.cy + (my - 0.5) / c.s;
  return clampCrop({ ...c, s: s2, cx: px - (mx - 0.5) / s2, cy: py - (my - 0.5) / s2 });
}

/* Pan by a pixel delta inside a box of boxW x boxH. */
export function panBy(c: Crop, dx: number, dy: number, boxW: number, boxH: number): Crop {
  return clampCrop({ ...c, cx: c.cx - dx / (boxW * c.s), cy: c.cy - dy / (boxH * c.s) });
}

export type CtlMsg = { t: "crop"; crop: Crop } | { t: "hello"; label: string };
