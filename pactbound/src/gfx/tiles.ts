import { tileInfo } from '../world/tiles';
import { darken, lighten, mix } from './color';
import { PixBuf } from './pixbuf';

/**
 * Procedural 16x16 tiles. Every tile is drawn pixel by pixel from a seeded
 * hash of its map position, so the same map always looks the same while
 * neighbouring tiles still vary. Tiles that connect (trees, hedges, water,
 * carpets, roofs) look at their four neighbours.
 *
 * Animated tiles (water, mist, lamps, windows, candles, fire, runes) are drawn
 * twice: frame 0 and frame 1. The world scene swaps between the two.
 */
export const TILE = 16;

export interface TileCtx {
  buf: PixBuf;
  /** Pixel origin of this tile in `buf`. */
  ox: number;
  oy: number;
  /** Tile coordinates in the map (seed for variation). */
  tx: number;
  ty: number;
  frame: 0 | 1;
  n: string;
  e: string;
  s: string;
  w: string;
  /** The map's ground tile, drawn under overlay tiles. */
  ground: string;
}

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

class Brush {
  constructor(readonly t: TileCtx) {}
  px(x: number, y: number, c: number, a = 255): void {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    this.t.buf.set(this.t.ox + x, this.t.oy + y, c, a);
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 255): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c, a);
  }
  hline(x: number, y: number, w: number, c: number): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: number): void {
    this.rect(x, y, 1, h, c);
  }
  fill(c: number): void {
    this.rect(0, 0, 16, 16, c);
  }
  /** Deterministic 0..1 per tile. */
  rnd(salt: number): number {
    return hash(this.t.tx, this.t.ty, salt);
  }
  int(salt: number, n: number): number {
    return Math.floor(this.rnd(salt) * n);
  }
  /** Deterministic 0..1 per pixel. */
  noise(x: number, y: number, salt: number): number {
    return hash(this.t.tx * 16 + x, this.t.ty * 16 + y, salt);
  }
  speckle(c: number, density: number, salt: number, x0 = 0, y0 = 0, w = 16, h = 16): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.noise(x, y, salt) < density) this.px(x, y, c);
  }
  disc(cx: number, cy: number, r: number, c: number, a = 255): void {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.px(x, y, c, a);
  }
  /** Soft round glow (alpha falls off with distance). */
  glow(cx: number, cy: number, r: number, c: number, strength: number): void {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d < 1) this.px(x, y, c, Math.round(255 * strength * (1 - d) * (1 - d)));
      }
  }
  /** Rounded block lit from the top-left. */
  block(x: number, y: number, w: number, h: number, c: number): void {
    this.rect(x + 1, y, w - 2, h, c);
    this.rect(x, y + 1, w, h - 2, c);
    this.hline(x + 1, y, w - 2, lighten(c, 0.18));
    this.vline(x, y + 1, h - 2, lighten(c, 0.1));
    this.hline(x + 1, y + h - 1, w - 2, darken(c, 0.2));
    this.vline(x + w - 1, y + 1, h - 2, darken(c, 0.14));
  }
}

const INK = 0x1a1420;
const GR = { base: 0x4b7d50, dark: 0x3e6b45, light: 0x5e9258, tip: 0x78ab67 };
const PATH = { mortar: 0x5f5852, stone: 0x8f857c };
const FLAG = { grout: 0x6c655f, stone: 0x9a928a };
const WALL = { mortar: 0x8a8279, brick: 0xbab2a7, plinth: 0x8f877e };
const ROOF = { base: 0x4d4966, light: 0x67638a, dark: 0x302d46, ridge: 0x8a86aa };
const WOOD = { base: 0x7a5235, light: 0x936645, dark: 0x5c3d26, deep: 0x3e2817 };
const WATER = { base: 0x3a6e9e, light: 0x5a8fc0, foam: 0xb8dcf4, deep: 0x2b5480 };
const MIST = { base: 0x3a3358, blade: 0x645a92, light: 0x9188c0, tip: 0xc8bef2 };
const TREE = { base: 0x2f5a3c, light: 0x417050, top: 0x5a8a5c, dark: 0x1d3826, trunk: 0x4f3626 };
const IRON = { base: 0x2e2a35, light: 0x5e5868, gold: 0xd9b25c };
const GLOW = { warm: 0xf6d98a, hot: 0xfff2c4 };
const GLASS = { pane: 0x9cccdc, light: 0xd8f0f8, frame: 0xe4eee6, dark: 0x6e98a4 };
const PLUM = { paper: 0x4a3448, stripe: 0x553c52, wains: 0x5a3b2a, trim: 0xc9a24a, crown: 0x6e4e6a };
const CARPET = { base: 0x7a2e3c, light: 0x8e3c4a, dark: 0x5e2230, gold: 0xd9b25c };
const STONEF = { base: 0x6c6772, grout: 0x4a4650 };
const FLOOR = { base: 0x8a5f3f, seam: 0x5e3e27 };
const BOOKS = [0x8a3a4a, 0x3d5a8a, 0x4a7a4a, 0xc9a24a, 0x6a4a8a, 0xd8c8a8, 0x2f6a6a, 0xa85a3a];

const isWallish = (ch: string) => ch === '#' || ch === '~' || ch === 'D' || ch === 'R';
const isIndoorWall = (ch: string) => ch === '|' || ch === '^' || ch === 'n' || ch === 'f';

/** Pixel mask for shapes that merge with same-type neighbours (canopies, hedges). */
function blobInside(b: Brush, same: (ch: string) => boolean, inset: number, bottomInset: number, radius: number) {
  const { n, e, s, w } = b.t;
  const left = same(w) ? -99 : inset;
  const right = same(e) ? 99 : 15 - inset;
  const top = same(n) ? -99 : inset;
  const bottom = same(s) ? 99 : 15 - bottomInset;
  return (x: number, y: number) => {
    if (x < left || x > right || y < top || y > bottom) return false;
    const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
    const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius + 0.5;
  };
}

// ── Outdoor ─────────────────────────────────────────────────────────────

function grass(b: Brush): void {
  b.fill(GR.base);
  b.speckle(GR.dark, 0.16, 1);
  b.speckle(GR.light, 0.06, 2);
  for (let i = 0; i < 3; i++) {
    const x = 1 + b.int(10 + i, 13);
    const y = 3 + b.int(20 + i, 11);
    b.px(x, y, GR.tip);
    b.px(x, y - 1, GR.light);
    b.px(x - 1, y, GR.light);
  }
}

function flowers(b: Brush): void {
  grass(b);
  const cols = [0xf2a7bf, 0xfff4e0, 0xf5d870, 0xb8a0f0];
  for (let i = 0; i < 3; i++) {
    const x = 2 + b.int(30 + i, 12);
    const y = 2 + b.int(40 + i, 12);
    const c = cols[b.int(50 + i, cols.length)] as number;
    b.px(x, y - 1, c);
    b.px(x - 1, y, c);
    b.px(x + 1, y, c);
    b.px(x, y + 1, c);
    b.px(x, y, 0xf5d870);
  }
}

function mistgrass(b: Brush): void {
  b.fill(MIST.base);
  b.speckle(darken(MIST.base, 0.25), 0.2, 3);
  for (let i = 0; i < 8; i++) {
    const x = 1 + b.int(60 + i, 14);
    const foot = 15 - b.int(70 + i, 3);
    const h = 5 + b.int(80 + i, 6);
    const sway = b.t.frame === 1 && i % 2 === 0 ? 1 : 0;
    for (let k = 0; k < h; k++) {
      const c = k >= h - 1 ? MIST.tip : k > h / 2 ? MIST.light : MIST.blade;
      b.px(x + (k >= h - 2 ? sway : 0), foot - k, c);
    }
    b.px(x - 1, foot, MIST.blade);
    b.px(x + 1, foot - 1, MIST.blade);
  }
  if (b.rnd(90) < 0.3) b.px(1 + b.int(91, 14), 1 + b.int(92, 7), b.t.frame ? 0xf0eaff : MIST.light);
}

function cobble(b: Brush): void {
  b.fill(PATH.mortar);
  for (let row = 0; row < 3; row++) {
    const y = row * 5 + (row === 2 ? 1 : 0);
    const h = row === 2 ? 5 : 4;
    const off = (row + b.t.ty) % 2 === 0 ? 0 : 3;
    for (let x = -off; x < 16; x += 6) {
      const c = mix(PATH.stone, 0x6f665e, b.noise(x + 20, y, 7) * 0.45);
      b.block(x, y, 5, h, c);
    }
  }
}

function flagstone(b: Brush): void {
  b.fill(FLAG.grout);
  for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
    const c = mix(FLAG.stone, 0x7e7770, b.noise(sx, sy, 9) * 0.5);
    b.block(sx + 1, sy + 1, 7, 7, c);
  }
  if (b.rnd(5) < 0.2) {
    const x = 2 + b.int(6, 10);
    b.px(x, 4, darken(FLAG.stone, 0.35));
    b.px(x + 1, 5, darken(FLAG.stone, 0.35));
  }
}

function tree(b: Brush): void {
  const same = (ch: string) => ch === 'T';
  const inside = blobInside(b, same, 1, 4, 4);
  if (!same(b.t.s)) {
    b.rect(6, 11, 4, 5, TREE.trunk);
    b.vline(9, 11, 5, darken(TREE.trunk, 0.3));
    b.rect(5, 15, 6, 1, darken(GR.base, 0.35));
  }
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue;
      let c = TREE.base;
      const bump = ((x + 4) % 8) ** 2 + ((y + 4) % 8) ** 2;
      if (bump < 9) c = TREE.light;
      if (bump < 3) c = TREE.top;
      if (((x + 1) % 8) ** 2 + ((y + 1) % 8) ** 2 < 4) c = TREE.dark;
      if (b.noise(x, y, 33) < 0.1) c = darken(c, 0.2);
      b.px(x, y, c);
    }
  // Outline the open edges.
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (inside(x, y)) continue;
      if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) b.px(x, y, TREE.dark);
    }
}

function hedge(b: Brush): void {
  const same = (ch: string) => ch === 'h';
  const inside = blobInside(b, same, 0, 2, 3);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue;
      let c = TREE.light;
      if (b.noise(x, y, 41) < 0.25) c = TREE.base;
      if (b.noise(x, y, 42) < 0.08) c = TREE.top;
      if (!inside(x, y + 1) || !inside(x, y + 2)) c = TREE.dark;
      b.px(x, y, c);
    }
  if (!same(b.t.s)) b.rect(1, 14, 14, 2, darken(GR.base, 0.35));
}

function water(b: Brush, rim: boolean): void {
  const same = (ch: string) => (rim ? ch === 'W' : ch === 'w');
  b.fill(WATER.base);
  b.speckle(WATER.deep, 0.08, 5);
  const shift = b.t.frame * 2;
  for (let i = 0; i < 3; i++) {
    const x = (b.int(110 + i, 12) + shift) % 14;
    const y = 2 + b.int(120 + i, 12);
    b.hline(x, y, 3, WATER.light);
    b.px(x + 1, y, WATER.foam);
  }
  const edge = rim ? WALL.brick : GR.dark;
  const edgeDark = rim ? darken(WALL.brick, 0.3) : darken(GR.base, 0.35);
  const w = rim ? 3 : 2;
  if (!same(b.t.n)) {
    b.rect(0, 0, 16, w, edge);
    b.hline(0, w, 16, edgeDark);
  }
  if (!same(b.t.s)) {
    b.rect(0, 16 - w, 16, w, edge);
    b.hline(0, 16 - w - 1, 16, WATER.foam);
  }
  if (!same(b.t.w)) {
    b.rect(0, 0, w, 16, edge);
    b.vline(w, 0, 16, edgeDark);
  }
  if (!same(b.t.e)) {
    b.rect(16 - w, 0, w, 16, edge);
    b.vline(15 - w, 0, 16, edgeDark);
  }
  if (rim) {
    // Each of the four fountain tiles draws a quarter of the central pedestal.
    const cx = same(b.t.e) ? 16 : 0;
    const cy = same(b.t.s) ? 16 : 0;
    if (same(b.t.e) !== same(b.t.w) && same(b.t.s) !== same(b.t.n)) {
      b.disc(cx, cy, 5, darken(WALL.brick, 0.15));
      b.disc(cx, cy, 4, WALL.brick);
      b.disc(cx, cy, 2, b.t.frame ? WATER.foam : 0xffffff);
    }
  }
}

function brickWall(b: Brush): void {
  b.fill(WALL.mortar);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 === 0 ? 0 : 4;
    for (let x = -off; x < 16; x += 8) {
      const c = mix(WALL.brick, 0x9c9489, b.noise(x + 8, y, 12) * 0.5);
      b.rect(x, y, 7, 3, c);
      b.hline(x, y, 7, lighten(c, 0.14));
    }
  }
  if (!isWallish(b.t.s)) {
    b.rect(0, 13, 16, 3, WALL.plinth);
    b.hline(0, 13, 16, lighten(WALL.plinth, 0.15));
    b.hline(0, 15, 16, darken(WALL.plinth, 0.3));
  }
}

function windowTile(b: Brush): void {
  brickWall(b);
  const glass = b.t.frame ? GLOW.hot : GLOW.warm;
  b.rect(4, 4, 8, 10, INK);
  b.rect(5, 3, 6, 1, INK);
  b.rect(6, 2, 4, 1, INK);
  b.rect(5, 5, 6, 8, glass);
  b.rect(6, 4, 4, 1, glass);
  b.rect(6, 3, 4, 1, glass);
  b.vline(8, 3, 10, 0x4a3a52);
  b.hline(5, 8, 6, 0x4a3a52);
  b.px(6, 5, 0xfffbe8);
  b.rect(3, 13, 10, 2, lighten(WALL.brick, 0.1));
  b.hline(3, 14, 10, darken(WALL.brick, 0.25));
}

function roof(b: Brush): void {
  b.fill(ROOF.dark);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const off = row % 2 === 0 ? 0 : 2;
    for (let x = -off; x < 16; x += 4) {
      const c = mix(ROOF.base, 0x3c3954, b.noise(x + 4, y, 14) * 0.5);
      b.rect(x, y, 3, 3, c);
      b.hline(x, y, 3, lighten(c, 0.15));
    }
  }
  if (b.t.n !== 'R') {
    b.rect(0, 0, 16, 2, ROOF.ridge);
    b.hline(0, 2, 16, ROOF.dark);
  }
  if (b.t.s !== 'R') {
    b.rect(0, 13, 16, 3, INK);
    b.hline(0, 12, 16, ROOF.light);
  }
}

function door(b: Brush): void {
  brickWall(b);
  b.rect(3, 4, 10, 12, WOOD.deep);
  b.rect(4, 3, 8, 1, WOOD.deep);
  b.rect(5, 2, 6, 1, WOOD.deep);
  b.rect(4, 5, 8, 11, WOOD.base);
  b.rect(5, 4, 6, 1, WOOD.base);
  b.rect(6, 3, 4, 1, WOOD.base);
  b.vline(6, 4, 12, WOOD.dark);
  b.vline(9, 4, 12, WOOD.dark);
  b.hline(4, 7, 8, IRON.base);
  b.hline(4, 12, 8, IRON.base);
  b.px(5, 7, IRON.light);
  b.px(10, 7, IRON.light);
  b.px(5, 12, IRON.light);
  b.px(10, 12, IRON.light);
  b.rect(10, 9, 1, 2, IRON.gold);
  b.hline(3, 15, 10, lighten(WALL.brick, 0.1));
}

function fence(b: Brush, gate: boolean): void {
  b.hline(0, 6, 16, IRON.base);
  b.hline(0, 12, 16, IRON.base);
  b.hline(0, 5, 16, IRON.light);
  for (let x = 1; x < 16; x += 3) {
    b.vline(x, 3, 12, IRON.base);
    b.px(x, 2, gate ? IRON.gold : IRON.light);
    b.px(x, 1, gate ? IRON.gold : IRON.base);
  }
  b.hline(0, 15, 16, darken(GR.base, 0.3));
  if (gate) {
    b.disc(8, 9, 3, IRON.gold);
    b.disc(8, 9, 2, IRON.base);
    b.px(8, 9, IRON.gold);
  }
}

function lamp(b: Brush): void {
  b.glow(8, 4, 8, GLOW.warm, b.t.frame ? 0.42 : 0.32);
  b.vline(7, 6, 9, IRON.base);
  b.vline(8, 6, 9, IRON.light);
  b.rect(6, 14, 4, 2, IRON.base);
  b.rect(5, 1, 6, 1, IRON.base);
  b.vline(5, 2, 4, IRON.base);
  b.vline(10, 2, 4, IRON.base);
  b.rect(6, 2, 4, 4, b.t.frame ? GLOW.hot : GLOW.warm);
  b.px(6, 2, 0xffffff);
  b.rect(5, 6, 6, 1, IRON.base);
  b.px(8, 0, IRON.base);
}

function bench(b: Brush): void {
  b.rect(1, 5, 14, 3, WOOD.dark);
  b.hline(1, 5, 14, WOOD.base);
  b.rect(1, 9, 14, 3, WOOD.base);
  b.hline(1, 9, 14, WOOD.light);
  b.hline(1, 11, 14, WOOD.dark);
  for (const x of [2, 13]) {
    b.vline(x, 5, 10, IRON.base);
  }
  b.rect(1, 14, 14, 1, darken(GR.base, 0.3));
}

function boulder(b: Brush): void {
  b.disc(8, 10, 6.5, 0x5a5560);
  b.disc(8, 9.5, 6, 0x8a8494);
  b.disc(6.5, 8, 3, 0xa29cac);
  b.px(5, 7, 0xbab4c4);
  b.speckle(0x6a8a4a, 0.08, 61, 4, 12, 9, 3);
}

function glassRoof(b: Brush): void {
  b.fill(GLASS.pane);
  for (let i = 0; i < 16; i++) if ((i + b.t.tx * 3) % 11 < 2) b.px(i, (i * 2 + b.t.ty) % 16, GLASS.light);
  b.hline(0, 0, 16, GLASS.dark);
  b.vline(0, 0, 16, GLASS.dark);
  b.hline(0, 8, 16, GLASS.frame);
  b.vline(8, 0, 16, GLASS.frame);
  if (b.t.s !== 'Y') {
    b.rect(0, 14, 16, 2, 0x5e8a96);
    b.hline(0, 13, 16, GLASS.frame);
  }
}

function glassWall(b: Brush): void {
  b.fill(GLASS.pane);
  b.disc(4, 13, 5, 0x5a9a5a);
  b.disc(12, 14, 4, 0x4a8a4a);
  b.disc(3, 11, 2, 0x7aba6a);
  for (let x = 0; x < 16; x += 4) b.vline(x, 0, 16, GLASS.frame);
  b.hline(0, 0, 16, GLASS.frame);
  b.hline(0, 15, 16, darken(GLASS.dark, 0.2));
  b.px(2, 2, GLASS.light);
  b.px(6, 3, GLASS.light);
}

function statue(b: Brush): void {
  b.rect(3, 11, 10, 5, 0x7e7888);
  b.hline(3, 11, 10, 0x9c96a6);
  b.rect(5, 6, 6, 5, 0x8f8a9a);
  b.disc(8, 5, 3, 0x8f8a9a);
  b.rect(2, 3, 3, 5, 0x6e6878);
  b.rect(11, 3, 3, 5, 0x6e6878);
  b.px(6, 2, 0x6e6878);
  b.px(10, 2, 0x6e6878);
  b.px(7, 5, 0xf0b040);
  b.px(9, 5, 0xf0b040);
}

function mushroomRing(b: Brush): void {
  const spots: [number, number][] = [[3, 5], [8, 3], [13, 6], [4, 11], [12, 12]];
  spots.forEach(([x, y], i) => {
    if (b.rnd(200 + i) < 0.25) return;
    b.glow(x, y, 4, 0x9ef0e0, b.t.frame ? 0.35 : 0.2);
    b.vline(x, y, 2, 0xf0e2c8);
    b.hline(x - 1, y - 1, 3, 0xa8406a);
    b.px(x, y - 2, 0xa8406a);
    b.px(x, y - 1, 0xf6f0ff);
  });
}

function shrine(b: Brush): void {
  b.rect(3, 13, 10, 3, 0x6e6878);
  b.rect(5, 2, 6, 11, 0x8a8494);
  b.vline(10, 2, 11, 0x6e6878);
  b.hline(5, 2, 6, 0xa29cac);
  b.px(7, 1, 0x8a8494);
  b.px(8, 1, 0x8a8494);
  const rune = b.t.frame ? 0xd8b8ff : 0xa880e8;
  b.vline(7, 5, 5, rune);
  b.hline(6, 7, 3, rune);
  b.px(8, 5, rune);
  b.glow(7.5, 7, 6, 0xb48cf0, b.t.frame ? 0.3 : 0.18);
  b.speckle(0x6a8a4a, 0.15, 71, 5, 9, 6, 4);
}

function flowerBed(b: Brush): void {
  b.fill(0x5a3e2e);
  b.speckle(0x4a3224, 0.2, 81);
  const cols = [0xf2a7bf, 0xe0607a, 0xfff4e0, 0xb8a0f0];
  for (let y = 3; y < 15; y += 4)
    for (let x = 2 + ((y >> 2) % 2) * 2; x < 15; x += 4) {
      b.px(x, y, 0x4a7a4a);
      b.px(x, y - 1, cols[b.int(x * 7 + y, cols.length)] as number);
      b.px(x - 1, y - 1, 0x4a7a4a);
    }
  b.hline(0, 0, 16, 0x8f877e);
  b.hline(0, 15, 16, 0x6e6660);
}

// ── Indoor ──────────────────────────────────────────────────────────────

function woodFloor(b: Brush): void {
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const c = mix(FLOOR.base, 0x7a5236, b.noise(0, y, 91) * 0.6);
    b.rect(0, y, 16, 4, c);
    b.hline(0, y + 3, 16, FLOOR.seam);
    b.hline(0, y, 16, lighten(c, 0.08));
    const seam = (b.int(row + 95, 10) + row * 5) % 16;
    b.vline(seam, y, 3, FLOOR.seam);
  }
}

function carpet(b: Brush, colors = CARPET): void {
  const same = (ch: string) => ch === (colors === CARPET ? '-' : 'z');
  b.fill(colors.base);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) b.px(x, y, colors.light);
  if (!same(b.t.n)) {
    b.hline(0, 0, 16, colors.dark);
    b.hline(0, 2, 16, colors.gold);
  }
  if (!same(b.t.s)) {
    b.hline(0, 15, 16, colors.dark);
    b.hline(0, 13, 16, colors.gold);
  }
  if (!same(b.t.w)) {
    b.vline(0, 0, 16, colors.dark);
    b.vline(2, 0, 16, colors.gold);
  }
  if (!same(b.t.e)) {
    b.vline(15, 0, 16, colors.dark);
    b.vline(13, 0, 16, colors.gold);
  }
}
const RUG = { base: 0x8a4a72, light: 0xa05a86, dark: 0x6a3456, gold: 0xf2c4d8 };

function stoneFloor(b: Brush): void {
  b.fill(STONEF.grout);
  for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
    const c = mix(STONEF.base, 0x5a5660, b.noise(sx, sy, 101) * 0.6);
    b.rect(sx, sy, 7, 7, c);
    b.hline(sx, sy, 7, lighten(c, 0.1));
  }
}

function indoorWall(b: Brush): void {
  b.fill(PLUM.paper);
  for (let x = 1; x < 16; x += 4) b.vline(x, 0, 16, PLUM.stripe);
  for (let y = 3; y < 16; y += 6) b.px(3 + ((y / 3) % 2) * 8, y, PLUM.crown);
  if (!isIndoorWall(b.t.n)) {
    b.rect(0, 0, 16, 2, PLUM.crown);
    b.hline(0, 2, 16, darken(PLUM.paper, 0.3));
  }
  if (!isIndoorWall(b.t.s)) {
    b.rect(0, 9, 16, 7, PLUM.wains);
    b.hline(0, 9, 16, PLUM.trim);
    b.hline(0, 15, 16, darken(PLUM.wains, 0.35));
    b.rect(2, 11, 5, 3, darken(PLUM.wains, 0.15));
    b.rect(9, 11, 5, 3, darken(PLUM.wains, 0.15));
  }
}

function tallWindow(b: Brush): void {
  indoorWall(b);
  b.rect(3, 1, 10, 14, INK);
  b.rect(4, 2, 8, 12, 0x1c2448);
  b.px(5, 4, 0xfff6d8);
  b.px(9, 3, 0xd8e0ff);
  b.px(10, 8, 0xfff6d8);
  b.disc(7, 7, 2, b.t.frame ? 0xfff2c4 : 0xf0e2b0);
  b.vline(8, 2, 12, 0x3a3048);
  b.hline(4, 8, 8, 0x3a3048);
  b.rect(2, 1, 2, 14, 0x7a2e3c);
  b.rect(12, 1, 2, 14, 0x7a2e3c);
  b.vline(3, 1, 14, 0x5e2230);
  b.vline(12, 1, 14, 0x8e3c4a);
}

function bookshelf(b: Brush): void {
  b.fill(WOOD.deep);
  b.rect(1, 1, 14, 14, WOOD.dark);
  for (const y of [5, 10]) b.hline(1, y, 14, WOOD.base);
  for (const [y0, y1] of [[1, 4], [6, 9], [11, 14]] as const) {
    let x = 2;
    let i = 0;
    while (x < 14) {
      const w = 1 + b.int(y0 * 13 + i, 2);
      const h = y1 - y0 + 1 - b.int(y0 * 17 + i, 2);
      const c = BOOKS[b.int(y0 * 19 + i * 3, BOOKS.length)] as number;
      b.rect(x, y1 - h + 1, w, h, c);
      b.px(x, y1 - h + 1, lighten(c, 0.25));
      x += w + (b.rnd(y0 * 23 + i) < 0.15 ? 1 : 0);
      i += 1;
    }
  }
}

function bed(b: Brush, top: boolean): void {
  const blanket = 0x8a4a72;
  b.rect(1, 0, 14, 16, WOOD.dark);
  if (top) {
    b.rect(1, 0, 14, 3, WOOD.base);
    b.hline(1, 0, 14, WOOD.light);
    b.rect(3, 4, 10, 4, 0xf6f0e8);
    b.hline(3, 7, 10, 0xd8d0c8);
    b.rect(2, 9, 12, 7, blanket);
    b.hline(2, 9, 12, lighten(blanket, 0.25));
  } else {
    b.rect(2, 0, 12, 12, blanket);
    b.vline(2, 0, 12, darken(blanket, 0.2));
    b.rect(1, 12, 14, 4, WOOD.base);
    b.hline(1, 12, 14, WOOD.light);
    b.hline(1, 15, 14, WOOD.deep);
  }
}

function table(b: Brush): void {
  b.rect(1, 3, 14, 9, WOOD.base);
  b.hline(1, 3, 14, WOOD.light);
  b.hline(1, 11, 14, WOOD.dark);
  b.rect(2, 12, 2, 3, WOOD.dark);
  b.rect(12, 12, 2, 3, WOOD.dark);
  b.rect(3, 5, 5, 4, 0xf3ead8);
  b.hline(4, 6, 3, 0xb8ac98);
  b.hline(4, 7, 2, 0xb8ac98);
  b.rect(11, 5, 2, 4, 0xf6f0e8);
  b.px(11, 4, b.t.frame ? 0xfff2c4 : 0xf6c860);
  b.glow(11.5, 4, 5, GLOW.warm, b.t.frame ? 0.35 : 0.25);
}

function chair(b: Brush): void {
  b.rect(4, 2, 8, 4, WOOD.dark);
  b.hline(4, 2, 8, WOOD.base);
  b.rect(4, 7, 8, 5, WOOD.base);
  b.hline(4, 7, 8, WOOD.light);
  b.vline(4, 12, 3, WOOD.deep);
  b.vline(11, 12, 3, WOOD.deep);
}

function pedestal(b: Brush): void {
  b.rect(4, 9, 8, 6, 0xd8d0e0);
  b.vline(11, 9, 6, 0xb0a8bc);
  b.rect(3, 14, 10, 2, 0xb0a8bc);
  b.rect(2, 7, 12, 3, 0xece6f2);
  b.hline(2, 9, 12, 0xb0a8bc);
  b.vline(6, 9, 5, 0xc2bacc);
}

function pottedPlant(b: Brush): void {
  b.rect(5, 10, 6, 5, 0xb5652f);
  b.hline(4, 10, 8, 0xc8763a);
  b.vline(10, 11, 4, 0x8a4a22);
  b.disc(8, 6, 4.5, 0x3f7a45);
  b.disc(6, 5, 2.5, 0x5a9a5a);
  b.disc(10, 4, 2, 0x5a9a5a);
}

function candelabra(b: Brush): void {
  b.glow(8, 3, 9, GLOW.warm, b.t.frame ? 0.45 : 0.32);
  b.rect(6, 14, 4, 2, IRON.gold);
  b.vline(8, 6, 8, IRON.gold);
  b.hline(4, 6, 9, IRON.gold);
  for (const x of [4, 8, 12]) {
    b.rect(x, 3, 1, 3, 0xf6f0e8);
    b.px(x, 2, b.t.frame ? 0xfff2c4 : 0xf6c860);
    b.px(x, 1, b.t.frame ? 0xf6c860 : 0xffe0a0);
  }
}

function rune(b: Brush): void {
  stoneFloor(b);
  const c = b.t.frame ? 0xc8a0ff : 0x9a72e0;
  const glyph = b.int(301, 4);
  if (glyph === 0) {
    b.vline(8, 4, 8, c);
    b.hline(5, 8, 7, c);
  } else if (glyph === 1) {
    for (let i = 0; i < 7; i++) b.px(5 + i, 4 + i, c);
    b.hline(5, 11, 4, c);
  } else if (glyph === 2) {
    b.disc(8, 8, 3.5, c);
    b.disc(8, 8, 2.5, STONEF.base);
    b.px(8, 8, c);
  } else {
    b.vline(6, 4, 8, c);
    b.vline(10, 4, 8, c);
    b.hline(6, 8, 5, c);
  }
  b.glow(8, 8, 8, 0xb48cf0, b.t.frame ? 0.2 : 0.12);
}

function doormat(b: Brush): void {
  b.rect(1, 4, 14, 9, 0x7a4a3a);
  b.rect(2, 5, 12, 7, 0x8e5a44);
  b.hline(3, 8, 10, 0xc9a24a);
  for (let x = 1; x < 15; x += 2) {
    b.px(x, 3, 0x7a4a3a);
    b.px(x, 13, 0x7a4a3a);
  }
}

function banner(b: Brush): void {
  indoorWall(b);
  b.rect(4, 0, 8, 13, 0x4a2c6a);
  b.vline(4, 0, 13, 0xd9b25c);
  b.vline(11, 0, 13, 0xd9b25c);
  b.px(5, 13, 0x4a2c6a);
  b.px(7, 13, 0x4a2c6a);
  b.px(8, 13, 0x4a2c6a);
  b.px(10, 13, 0x4a2c6a);
  b.px(6, 14, 0x4a2c6a);
  b.px(9, 14, 0x4a2c6a);
  // the Ravelle raven
  b.rect(6, 4, 4, 3, 0xd9b25c);
  b.px(5, 5, 0xd9b25c);
  b.px(10, 4, 0xd9b25c);
  b.px(7, 7, 0xd9b25c);
  b.px(8, 8, 0xd9b25c);
  b.px(6, 5, 0x4a2c6a);
}

function desk(b: Brush): void {
  b.rect(0, 4, 16, 10, WOOD.base);
  b.hline(0, 4, 16, WOOD.light);
  b.rect(0, 11, 16, 4, WOOD.dark);
  b.hline(0, 14, 16, WOOD.deep);
  const stack = b.int(400, 3);
  if (stack === 0) {
    b.rect(3, 2, 6, 2, 0x8a3a4a);
    b.rect(4, 0, 5, 2, 0x3d5a8a);
  } else if (stack === 1) {
    b.rect(9, 3, 3, 4, 0xf6f0e8);
    b.px(10, 2, b.t.frame ? 0xfff2c4 : 0xf6c860);
    b.glow(10.5, 3, 6, GLOW.warm, 0.3);
  } else {
    b.rect(4, 5, 6, 4, 0xf3ead8);
  }
}

function fireplace(b: Brush): void {
  b.fill(0x6e6878);
  b.hline(0, 0, 16, 0x8a8494);
  b.rect(0, 0, 16, 2, 0x8a8494);
  b.rect(3, 4, 10, 12, 0x1a1218);
  b.rect(2, 3, 12, 1, 0x5a5462);
  const f = b.t.frame;
  b.rect(5, 11, 6, 4, 0xe0602a);
  b.rect(6, 9 - f, 4, 3, 0xf0a040);
  b.rect(7, 7 + f, 2, 3, 0xffe080);
  b.hline(4, 15, 8, 0x4a3226);
  b.glow(8, 12, 8, 0xf0a040, 0.25);
}

function wardrobe(b: Brush): void {
  b.rect(1, 0, 14, 16, WOOD.dark);
  b.rect(2, 1, 6, 14, WOOD.base);
  b.rect(8, 1, 6, 14, WOOD.base);
  b.vline(8, 1, 14, WOOD.deep);
  b.hline(2, 1, 12, WOOD.light);
  b.px(7, 8, IRON.gold);
  b.px(9, 8, IRON.gold);
}

type Draw = (b: Brush) => void;

const ART: Record<string, Draw> = {
  '.': grass,
  ',': flowers,
  '"': mistgrass,
  ':': cobble,
  '=': flagstone,
  T: tree,
  w: (b) => water(b, false),
  W: (b) => water(b, true),
  '#': brickWall,
  '~': windowTile,
  R: roof,
  D: door,
  g: (b) => fence(b, false),
  G: (b) => fence(b, true),
  L: lamp,
  b: bench,
  h: hedge,
  r: boulder,
  Y: glassRoof,
  y: glassWall,
  S: statue,
  o: mushroomRing,
  s: shrine,
  '*': flowerBed,
  '0': (b) => b.fill(0x0c0810),
  _: woodFloor,
  '-': (b) => carpet(b),
  z: (b) => carpet(b, RUG),
  '+': stoneFloor,
  '|': indoorWall,
  '^': tallWindow,
  B: bookshelf,
  k: (b) => bed(b, true),
  j: (b) => bed(b, false),
  K: table,
  c: chair,
  P: pedestal,
  p: pottedPlant,
  q: candelabra,
  x: rune,
  E: doormat,
  n: banner,
  m: desk,
  f: fireplace,
  u: wardrobe,
};

/** Tiles that change between frame 0 and frame 1. */
export const ANIMATED_TILES = new Set(['"', 'w', 'W', '~', 'L', 'o', 's', '^', 'K', 'q', 'x', 'm', 'f']);

export function drawTile(ctx: TileCtx, ch: string): void {
  const b = new Brush(ctx);
  if (tileInfo(ch).overlay && ch !== ctx.ground) {
    const under = ART[ctx.ground];
    if (under) under(new Brush({ ...ctx, n: ctx.ground, e: ctx.ground, s: ctx.ground, w: ctx.ground }));
  }
  (ART[ch] ?? ((br: Brush) => br.fill(0xff00ff)))(b);
}

/** Renders a whole map (rows of legend characters) into one image for the given animation frame. */
export function renderMap(rows: readonly string[], ground: string, frame: 0 | 1): PixBuf {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const buf = new PixBuf(w * TILE, h * TILE);
  const at = (x: number, y: number) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : (rows[y]![x] ?? ' '));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      drawTile(
        { buf, ox: x * TILE, oy: y * TILE, tx: x, ty: y, frame, n: at(x, y - 1), e: at(x + 1, y), s: at(x, y + 1), w: at(x - 1, y), ground },
        at(x, y),
      );
    }
  return buf;
}
