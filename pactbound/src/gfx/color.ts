/** Colour helpers. Colours are 0xRRGGBB numbers throughout the game. */

/** Shadows lean toward deep plum rather than black; highlights toward warm cream. */
export const SHADOW_TARGET = 0x140e1c;
export const LIGHT_TARGET = 0xfff6e6;

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export const darken = (c: number, t = 0.28) => mix(c, SHADOW_TARGET, t);
export const lighten = (c: number, t = 0.3) => mix(c, LIGHT_TARGET, t);

export function css(c: number, alpha = 1): string {
  if (alpha >= 1) return `#${c.toString(16).padStart(6, '0')}`;
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${alpha})`;
}
