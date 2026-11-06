import type Phaser from 'phaser';
import { LOOKS, type LookId } from '../data/cast';
import { SPECIES_IDS, type SpeciesId } from '../data/species';
import { getMap } from '../world/maps';
import { drawFamiliar } from './familiars';
import { drawPersonSheet, PERSON_FRAMES, PERSON_H, PERSON_W } from './people';
import { PixBuf, paintRows } from './pixbuf';
import { renderMap } from './tiles';

/** Small UI icons as pixel rows. */
const ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  cursor: {
    rows: ['X....', 'XX...', 'XYX..', 'XYYX.', 'XYX..', 'XX...', 'X....'],
    pal: { X: 0x7a5a28, Y: 0xf0d488 },
  },
  more: {
    rows: ['XXXXXXX', '.XYYYX.', '..XYX..', '...X...'],
    pal: { X: 0x7a5a28, Y: 0xf0d488 },
  },
  heart: {
    rows: ['.XX.XX.', 'XYYXYYX', 'XYWYYYX', 'XYYYYYX', '.XYYYX.', '..XYX..', '...X...'],
    pal: { X: 0x5a1a34, Y: 0xf07aa8, W: 0xffd6e6 },
  },
  heartEmpty: {
    rows: ['.XX.XX.', 'X..X..X', 'X.....X', 'X.....X', '.X...X.', '..X.X..', '...X...'],
    pal: { X: 0x6a4a5a },
  },
  spark: {
    rows: ['...X...', '...Y...', '..XYX..', 'XYYWYYX', '..XYX..', '...Y...', '...X...'],
    pal: { X: 0x2a5a7a, Y: 0x8ed6f0, W: 0xffffff },
  },
  sparkEmpty: {
    rows: ['...X...', '...X...', '..X.X..', 'XX...XX', '..X.X..', '...X...', '...X...'],
    pal: { X: 0x4a6a7a },
  },
  shadow: {
    rows: ['...XXXXXX...', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '...XXXXXX...'],
    pal: { X: 0x000000 },
  },
  sign: {
    rows: [
      '................',
      '................',
      '.XXXXXXXXXXXXXX.',
      '.XYYYYYYYYYYYYX.',
      '.XYZZZYYZZZZYYX.',
      '.XYYYYYYYYYYYYX.',
      '.XYZZZZYYZZZYYX.',
      '.XYYYYYYYYYYYYX.',
      '.XXXXXXXXXXXXXX.',
      '......XWWX......',
      '......XWWX......',
      '......XWWX......',
      '......XWWX......',
      '......XWWX......',
      '.....XXXXXX.....',
      '................',
    ],
    pal: { X: 0x3e2817, Y: 0xb08a5a, Z: 0x6e4a2e, W: 0x7a5235 },
  },
  sparkle0: {
    rows: ['....X....', '....W....', '...XWX...', 'XWWWYWWWX', '...XWX...', '....W....', '....X....'],
    pal: { X: 0xc9a24a, W: 0xfff2c4, Y: 0xffffff },
  },
  sparkle1: {
    rows: ['.........', '....X....', '...XWX...', '..XWYWX..', '...XWX...', '....X....', '.........'],
    pal: { X: 0xc9a24a, W: 0xfff2c4, Y: 0xffffff },
  },
  'emote:!': {
    rows: ['.XXXXX.', 'XWWYWWX', 'XWWYWWX', 'XWWYWWX', 'XWWWWWX', 'XWWYWWX', '.XXXXX.', '..XX...', '..X....'],
    pal: { X: 0x221a2a, W: 0xfffaf0, Y: 0xd84a5a },
  },
  'emote:?': {
    rows: ['.XXXXX.', 'XWYYYWX', 'XWWWYWX', 'XWWYWWX', 'XWWWWWX', 'XWWYWWX', '.XXXXX.', '..XX...', '..X....'],
    pal: { X: 0x221a2a, W: 0xfffaf0, Y: 0x4a6ad8 },
  },
  'emote:heart': {
    rows: ['.XXXXX.', 'XWYWYWX', 'XYYYYYX', 'XYYYYYX', 'XWYYYWX', 'XWWYWWX', '.XXXXX.', '..XX...', '..X....'],
    pal: { X: 0x221a2a, W: 0xfffaf0, Y: 0xf07aa8 },
  },
  'emote:...': {
    rows: ['.XXXXX.', 'XWWWWWX', 'XWWWWWX', 'XYWYWYX', 'XWWWWWX', 'XWWWWWX', '.XXXXX.', '..XX...', '..X....'],
    pal: { X: 0x221a2a, W: 0xfffaf0, Y: 0x4a3a5a },
  },
  'emote:note': {
    rows: ['.XXXXX.', 'XWWYYWX', 'XWWYWYX', 'XWWYWWX', 'XWYYWWX', 'XWYYWWX', '.XXXXX.', '..XX...', '..X....'],
    pal: { X: 0x221a2a, W: 0xfffaf0, Y: 0x7a4ab8 },
  },
};

function iconCanvas(name: string, scale = 1): HTMLCanvasElement {
  const icon = ICONS[name] as (typeof ICONS)[string];
  const w = Math.max(...icon.rows.map((r) => r.length));
  const buf = new PixBuf(w * scale, icon.rows.length * scale);
  icon.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = icon.pal[row[x] as string];
      if (c === undefined) continue;
      buf.rect(x * scale, y * scale, scale, scale, c, name === 'shadow' ? 90 : 255);
    }
  });
  return buf.toCanvas();
}

function vignetteCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, 'rgba(10,4,16,0)');
  g.addColorStop(1, 'rgba(10,4,16,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export const famKey = (id: SpeciesId) => `fam:${id}`;
export const personKey = (id: LookId) => `person:${id}`;
export const mapKey = (id: string, frame: 0 | 1) => `map:${id}:${frame}`;

/** Generates every sprite the game needs. Called once from the Boot scene. */
export function registerTextures(scene: Phaser.Scene): void {
  const tm = scene.textures;
  for (const id of SPECIES_IDS) if (!tm.exists(famKey(id))) tm.addCanvas(famKey(id), drawFamiliar(id));
  for (const id of Object.keys(LOOKS) as LookId[]) {
    const key = personKey(id);
    if (tm.exists(key)) continue;
    const tex = tm.addCanvas(key, drawPersonSheet(LOOKS[id]));
    for (let i = 0; i < PERSON_FRAMES; i++) tex?.add(i, 0, i * PERSON_W, 0, PERSON_W, PERSON_H);
  }
  for (const name of Object.keys(ICONS)) if (!tm.exists(`icon:${name}`)) tm.addCanvas(`icon:${name}`, iconCanvas(name));
  if (!tm.exists('icon:heart2')) tm.addCanvas('icon:heart2', iconCanvas('heart', 2));
  if (!tm.exists('vignette')) tm.addCanvas('vignette', vignetteCanvas(480, 320));
  if (!tm.exists('pixel')) {
    const px = new PixBuf(1, 1);
    px.set(0, 0, 0xffffff);
    tm.addCanvas('pixel', px.toCanvas());
  }
}

/** Map images are rendered the first time a map is entered, then cached. */
export function ensureMapTextures(scene: Phaser.Scene, id: string): void {
  const map = getMap(id);
  for (const frame of [0, 1] as const) {
    const key = mapKey(id, frame);
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, renderMap(map.rows, map.ground, frame).toCanvas());
  }
}

/** Draws a tiny familiar icon into a canvas paint routine (used by the gallery and menus). */
export { paintRows };
