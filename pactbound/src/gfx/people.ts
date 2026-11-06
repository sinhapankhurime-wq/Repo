import type { Look } from '../data/cast';
import { darken, lighten } from './color';
import { PixBuf, paintRows } from './pixbuf';
import { ACCESSORIES, BODIES, HEADS, type Facing } from './peopleData';

export const PERSON_W = 16;
export const PERSON_H = 24;
/** Frames per sheet: down x3, up x3, left x3, right x3 (stand, step, step). */
export const PERSON_FRAMES = 12;
export const DIR_ROW = { down: 0, up: 1, left: 2, right: 3 } as const;

const OUTLINE = 0x221a2a;

function paletteFor(look: Look): Record<string, number> {
  return {
    o: OUTLINE,
    H: look.hair,
    h: darken(look.hair),
    j: lighten(look.hair, 0.35),
    S: look.skin,
    s: darken(look.skin, 0.18),
    e: 0x2a1e2e,
    E: look.eyes,
    w: 0xfffaf0,
    b: 0xf09aa8,
    T: look.top,
    t: darken(look.top),
    c: look.trim,
    C: look.shirt,
    K: look.bottom,
    k: darken(look.bottom),
    L: look.legs,
    l: darken(look.legs),
    F: look.shoes,
    R: look.ribbon ?? look.hair,
    X: look.scarf ?? look.top,
    G: 0x6a5868,
  };
}

const mirror = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(''));

function framePixels(look: Look, facing: Facing, step: 0 | 1 | 2): PixBuf {
  const pal = paletteFor(look);
  const body = BODIES[look.outfit]!;
  const head = HEADS[look.style]!;
  let bodyRows: readonly string[];
  if (facing === 'left') bodyRows = step === 0 ? body.left : step === 1 ? body.left1 : body.left2;
  else if (facing === 'down') bodyRows = step === 0 ? body.down : step === 1 ? body.down1 : mirror(body.down1);
  else bodyRows = step === 0 ? body.up : step === 1 ? body.up1 : mirror(body.up1);

  // The head bobs down a pixel on step frames.
  const bob = step === 0 ? 0 : 1;
  const buf = new PixBuf(PERSON_W, PERSON_H);
  paintRows(buf, bodyRows, pal, 0, 13);
  paintRows(buf, head[facing], pal, 0, bob);
  const extras: (keyof typeof ACCESSORIES)[] = [];
  if (look.scarf !== undefined) extras.push('scarf');
  if (look.beard) extras.push('beard');
  if (look.glasses) extras.push('glasses');
  if (look.ribbon !== undefined) extras.push('ribbon');
  for (const a of extras) paintRows(buf, ACCESSORIES[a][facing], pal, 0, bob);
  return buf;
}

/** A 192x24 strip: down(3) up(3) left(3) right(3). Right is the mirrored left. */
export function drawPersonSheet(look: Look): HTMLCanvasElement {
  const sheet = new PixBuf(PERSON_W * PERSON_FRAMES, PERSON_H);
  const facings: Facing[] = ['down', 'up', 'left'];
  facings.forEach((facing, row) => {
    for (const step of [0, 1, 2] as const) {
      sheet.blit(framePixels(look, facing, step), (row * 3 + step) * PERSON_W, 0);
    }
  });
  for (const step of [0, 1, 2] as const) {
    sheet.blit(framePixels(look, 'left', step), (9 + step) * PERSON_W, 0, true);
  }
  return sheet.toCanvas();
}

/** Frame index for a facing and walk phase (0 stand, 1 and 2 steps). */
export function personFrame(dir: keyof typeof DIR_ROW, phase: 0 | 1 | 2): number {
  return DIR_ROW[dir] * 3 + phase;
}
