import type { SpeciesId } from '../data/species';
import { darken, lighten } from './color';
import { PixBuf } from './pixbuf';

/**
 * Familiars are described as layered shapes and rasterised into crisp pixel
 * art at boot: no image files, no anti-aliasing. Each shape is lit from the
 * top-left, shapes cast a one-pixel contact shadow on whatever is behind them,
 * and the silhouette gets a selective (colour-tinted) outline.
 *
 * Every familiar faces LEFT on a 48x48 canvas, feet near y = 45. The battle
 * scene mirrors the player's side.
 */
export const FAMILIAR_SIZE = 48;

type Pt = readonly [number, number];

interface ShapeBase {
  /** Palette key. */
  c: string;
  /** Skip lighting (eyes, glows, markings). */
  flat?: boolean;
}

type Shape =
  | (ShapeBase & { t: 'ell'; x: number; y: number; rx: number; ry: number; rot: number })
  | (ShapeBase & { t: 'poly'; pts: readonly Pt[] })
  | (ShapeBase & { t: 'line'; pts: readonly Pt[]; w: number })
  | (ShapeBase & { t: 'rect'; x: number; y: number; w: number; h: number });

/** Drawn after the outline pass, on top of everything. */
type Detail =
  | { t: 'eye'; x: number; y: number; size: 1 | 2 | 3; iris?: string }
  | { t: 'dots'; c: string; pts: readonly Pt[] }
  | { t: 'heart'; x: number; y: number; c: string };

interface FamiliarArt {
  palette: Record<string, number>;
  shapes: Shape[];
  details: Detail[];
}

// ── Little constructors so the art below stays readable ─────────────────
type Opt = { flat?: boolean; rot?: number };
const E = (x: number, y: number, rx: number, ry: number, c: string, o: Opt = {}): Shape => ({
  t: 'ell', x, y, rx, ry, c, rot: o.rot ?? 0, flat: o.flat,
});
const C = (x: number, y: number, r: number, c: string, o: Opt = {}) => E(x, y, r, r, c, o);
const P = (pts: readonly Pt[], c: string, o: Opt = {}): Shape => ({ t: 'poly', pts, c, flat: o.flat });
const L = (pts: readonly Pt[], w: number, c: string, o: Opt = {}): Shape => ({ t: 'line', pts, w, c, flat: o.flat });
const R = (x: number, y: number, w: number, h: number, c: string, o: Opt = {}): Shape => ({ t: 'rect', x, y, w, h, c, flat: o.flat });
const EYE = (x: number, y: number, size: 1 | 2 | 3 = 2, iris?: string): Detail => ({ t: 'eye', x, y, size, iris });
const DOTS = (c: string, ...pts: Pt[]): Detail => ({ t: 'dots', c, pts });
const HEART = (x: number, y: number, c: string): Detail => ({ t: 'heart', x, y, c });

const INK = 0x1c1424;
const CHEEK = 0xf09aa8;
const WHITE = 0xfffaf0;

export const FAMILIAR_ART: Record<SpeciesId, FamiliarArt> = {
  kettlepup: {
    palette: { copper: 0xc8763a, lid: 0xa35a2c, gold: 0xe9c46a, fur: 0xeac9a0, cream: 0xf8e8cc, ear: 0x8a5a3a, steam: 0xf4f0ea, nose: 0x2a1e24, cheek: CHEEK },
    shapes: [
      L([[34, 31], [39, 27], [42, 22]], 3, 'copper'),
      C(43, 18, 2, 'steam', { flat: true }),
      C(45, 14, 1.5, 'steam', { flat: true }),
      E(32, 41, 3, 3, 'ear'),
      E(27, 32, 11, 9, 'copper'),
      E(27, 32, 11, 1.5, 'gold', { flat: true }),
      E(28, 23, 6, 2, 'lid'),
      C(28, 21, 1.5, 'gold'),
      E(19, 42, 3, 2.5, 'ear'),
      E(25, 42, 3, 2.5, 'ear'),
      C(15, 26, 8, 'fur'),
      E(20, 20, 3, 4.5, 'ear', { rot: 0.5 }),
      E(9, 25, 3, 5.5, 'ear', { rot: -0.35 }),
      E(10, 30, 4, 3, 'cream'),
    ],
    details: [EYE(12, 24), EYE(17, 24), DOTS('nose', [6, 29], [7, 29], [6, 30]), DOTS('cheek', [10, 27], [19, 27])],
  },
  samovarf: {
    palette: { brass: 0xcfa64e, copper: 0xb5652f, fur: 0xdcb58a, cream: 0xf6e4c6, ear: 0x7a4a2e, steam: 0xf4f0ea, ruby: 0xc8304a, nose: 0x2a1e24, cheek: CHEEK },
    shapes: [
      C(43, 9, 2.5, 'steam', { flat: true }),
      C(40, 5, 2, 'steam', { flat: true }),
      R(30, 7, 5, 9, 'copper'),
      R(29, 6, 7, 2, 'brass'),
      E(36, 43, 4, 3, 'ear'),
      E(29, 30, 14, 12, 'brass'),
      E(29, 30, 14, 1.5, 'copper', { flat: true }),
      E(29, 37, 11, 1.5, 'copper', { flat: true }),
      C(34, 30, 2, 'ruby'),
      E(21, 43, 4, 3, 'ear'),
      E(29, 44, 4, 2.5, 'ear'),
      E(19, 31, 7, 5, 'cream'),
      C(15, 22, 9, 'fur'),
      E(21, 13, 3, 5, 'ear', { rot: 0.5 }),
      E(8, 19, 3.5, 6.5, 'ear', { rot: -0.3 }),
      E(8, 26, 5, 3.5, 'cream'),
    ],
    details: [EYE(11, 20), EYE(17, 20), DOTS('nose', [4, 25], [5, 25], [4, 26]), DOTS('cheek', [9, 23], [20, 23])],
  },
  quillpus: {
    palette: { blue: 0x5a8fd0, belly: 0x9cc8ee, quill: 0xf2e8d4, ink: 0x2a2a52, cheek: CHEEK },
    shapes: [
      L([[17, 30], [12, 36], [14, 42]], 4, 'blue'),
      L([[34, 30], [38, 36], [37, 42]], 4, 'blue'),
      L([[22, 32], [20, 39], [23, 44]], 4, 'blue'),
      L([[29, 32], [31, 39], [28, 44]], 4, 'blue'),
      P([[27, 13], [33, 3], [38, 0], [35, 7], [31, 14]], 'quill'),
      E(25, 22, 12, 11, 'blue'),
      E(23, 28, 7, 3.5, 'belly'),
    ],
    details: [EYE(19, 20, 3), EYE(27, 20, 3), DOTS('cheek', [16, 25], [17, 25], [31, 25], [32, 25]), DOTS('ink', [37, 1], [38, 0], [36, 2], [33, 9])],
  },
  scriptopus: {
    palette: { blue: 0x4a74c0, belly: 0x8eb8e8, cap: 0x2a2438, tassel: 0xe9c46a, quill: 0xf2e8d4, ink: 0x2a2a52, cheek: CHEEK },
    shapes: [
      L([[13, 31], [7, 37], [9, 44]], 5, 'blue'),
      L([[20, 33], [18, 40], [21, 45]], 5, 'blue'),
      L([[28, 33], [30, 40], [27, 45]], 5, 'blue'),
      L([[35, 31], [40, 37], [38, 44]], 5, 'blue'),
      L([[37, 25], [42, 19], [44, 13]], 4, 'blue'),
      P([[42, 13], [45, 3], [47, 1], [46, 6], [44, 14]], 'quill'),
      E(24, 23, 14, 12, 'blue'),
      E(22, 30, 8, 4, 'belly'),
      P([[10, 11], [24, 6], [38, 11], [24, 15]], 'cap'),
      R(17, 11, 14, 4, 'cap'),
      L([[34, 11], [37, 15], [37, 19]], 1.5, 'tassel', { flat: true }),
    ],
    details: [
      EYE(17, 22, 3), EYE(26, 22, 3),
      DOTS('tassel', [16, 21], [16, 22], [16, 23], [19, 20], [20, 20], [21, 20], [24, 21], [25, 20], [26, 20], [27, 20], [28, 21], [29, 22], [29, 23], [22, 21], [23, 21]),
      DOTS('cheek', [14, 27], [31, 27]),
      DOTS('ink', [47, 1], [46, 2]),
    ],
  },
  budmouse: {
    palette: { fur: 0xb89c86, cream: 0xf2e3cd, pink: 0xf2a7bf, bud: 0xe0607a, stem: 0x5a9a4a, nose: 0xe07a8a, cheek: CHEEK },
    shapes: [
      L([[36, 38], [42, 34], [44, 27], [41, 23]], 1.5, 'pink'),
      P([[29, 27], [38, 24], [35, 31]], 'stem'),
      E(27, 35, 11, 8, 'fur'),
      E(22, 37, 6, 5, 'cream'),
      E(19, 43, 3, 2, 'fur'),
      E(31, 43, 3, 2, 'fur'),
      C(11, 18, 5, 'fur'),
      C(11, 18, 3, 'pink', { flat: true }),
      C(22, 18, 5, 'fur'),
      C(22, 18, 3, 'pink', { flat: true }),
      C(16, 27, 8, 'fur'),
      E(10, 30, 4, 3, 'cream'),
      L([[17, 19], [18, 13]], 1.5, 'stem'),
      E(18, 10, 3, 4, 'bud'),
      P([[15, 12], [18, 15], [21, 12], [18, 13]], 'stem'),
    ],
    details: [EYE(13, 26), EYE(18, 26), DOTS('nose', [6, 29], [7, 29]), DOTS('cheek', [11, 28], [20, 28])],
  },
  briarmaus: {
    palette: { fur: 0xb89c86, cream: 0xf2e3cd, pink: 0xf2a7bf, cape: 0x3f7a45, rose: 0xc8304a, thorn: 0x6a8a3a, nose: 0xe07a8a, cheek: CHEEK },
    shapes: [
      P([[27, 22], [38, 24], [42, 44], [30, 41]], 'cape'),
      L([[34, 36], [40, 40], [44, 36]], 1.5, 'pink'),
      R(21, 39, 4, 6, 'fur'),
      R(28, 39, 4, 6, 'fur'),
      E(26, 31, 8, 10, 'fur'),
      E(24, 33, 5, 7, 'cream'),
      C(18, 9, 5, 'fur'),
      C(18, 9, 3, 'pink', { flat: true }),
      C(30, 9, 5, 'fur'),
      C(30, 9, 3, 'pink', { flat: true }),
      C(24, 18, 8, 'fur'),
      E(17, 21, 4, 3, 'cream'),
      C(24, 7, 3, 'rose'),
      L([[17, 30], [3, 21]], 1.5, 'thorn'),
      R(16, 29, 3, 3, 'rose'),
      E(19, 30, 3, 2, 'fur'),
    ],
    details: [EYE(20, 17), EYE(26, 17), DOTS('nose', [13, 20], [14, 20]), DOTS('cheek', [18, 20], [28, 20]), DOTS('thorn', [7, 22], [11, 25], [5, 20]), DOTS('pink', [23, 6], [25, 8])],
  },
  tomelet: {
    palette: { leather: 0x6e3a5e, spine: 0x4e2842, page: 0xf3ead8, line: 0xc9bca6, gold: 0xe9c46a, ribbon: 0xc8304a, tooth: WHITE },
    shapes: [
      E(14, 45, 3, 1.5, 'spine'),
      E(32, 45, 3, 1.5, 'spine'),
      P([[7, 35], [39, 37], [40, 44], [9, 43]], 'leather'),
      P([[8, 27], [38, 22], [38, 38], [8, 36]], 'page'),
      L([[10, 31], [7, 37], [10, 41]], 2, 'ribbon'),
      P([[4, 14], [38, 7], [40, 22], [6, 28]], 'leather'),
      R(37, 7, 4, 37, 'spine'),
      E(17, 18.5, 3, 2.6, 'tooth', { flat: true }),
      E(26, 16.5, 3, 2.6, 'tooth', { flat: true }),
    ],
    details: [
      EYE(16, 17), EYE(25, 15),
      DOTS(INK.toString(), [15, 15], [16, 14], [24, 13], [25, 12]),
      DOTS('tooth', [9, 28], [13, 27], [17, 26], [21, 25], [25, 24], [29, 23]),
      DOTS('line', [12, 31], [13, 31], [14, 31], [18, 30], [19, 30], [20, 30], [26, 29], [27, 29], [28, 29], [14, 34], [15, 34], [22, 33], [23, 33], [30, 32], [31, 32]),
      DOTS('gold', [5, 15], [6, 15], [5, 16], [38, 9], [38, 10], [8, 41], [9, 42], [38, 41], [38, 40]),
    ],
  },
  glimmoth: {
    palette: { wing: 0xece2d0, wing2: 0xbcaee0, spot: 0x8a62c9, fuzz: 0xdccab0, glow: 0xffe39a, antenna: 0x8a7a6a, cheek: CHEEK },
    shapes: [
      E(31, 17, 10, 7, 'wing2', { rot: -0.7 }),
      E(31, 33, 6, 7, 'glow', { flat: true }),
      E(23, 27, 6, 6, 'fuzz'),
      E(29, 21, 12, 8, 'wing', { rot: -0.5 }),
      C(31, 20, 2.5, 'spot', { flat: true }),
      C(16, 26, 5, 'fuzz'),
      L([[14, 21], [11, 14], [7, 11]], 1, 'antenna', { flat: true }),
      L([[18, 21], [18, 13], [22, 9]], 1, 'antenna', { flat: true }),
    ],
    details: [
      EYE(13, 25, 2), EYE(17, 25, 2),
      DOTS('glow', [31, 20], [6, 10], [7, 10], [22, 8], [23, 8], [41, 41], [44, 37], [38, 44]),
      DOTS('cheek', [12, 28], [19, 28]),
      DOTS('wing', [30, 31], [32, 29]),
    ],
  },
  flittermouse: {
    palette: { fur: 0x54436e, light: 0x8a74a8, wing: 0x2e2440, inner: 0xd88ab0, fang: WHITE },
    shapes: [
      P([[18, 24], [4, 15], [1, 24], [5, 28], [7, 33], [12, 30], [17, 33]], 'wing'),
      P([[30, 24], [44, 13], [47, 22], [43, 26], [42, 31], [37, 29], [32, 33]], 'wing'),
      P([[17, 22], [15, 11], [22, 19]], 'fur'),
      P([[26, 19], [32, 10], [31, 22]], 'fur'),
      C(24, 27, 8, 'fur'),
      E(24, 31, 4.5, 4, 'light'),
    ],
    details: [EYE(20, 25, 3), EYE(27, 25, 3), DOTS('inner', [17, 15], [17, 16], [18, 17], [30, 14], [30, 15], [29, 16]), DOTS('fang', [23, 31], [26, 31]), DOTS('fur', [21, 36], [27, 36])],
  },
  grimlet: {
    palette: { stone: 0x948e9c, wing: 0x75707e, horn: 0x5e5866, moss: 0x6a8a4a, amber: 0xf0b040, crack: 0x5a5560 },
    shapes: [
      P([[29, 21], [40, 9], [45, 17], [41, 21], [43, 28], [35, 27]], 'wing'),
      L([[34, 39], [40, 41], [44, 36]], 2, 'stone'),
      P([[43, 33], [47, 35], [43, 38]], 'horn'),
      E(35, 41, 4, 4, 'stone'),
      E(27, 34, 10, 9, 'stone'),
      E(18, 42, 4, 2.5, 'stone'),
      E(25, 43, 4, 2.5, 'stone'),
      P([[13, 20], [10, 11], [17, 17]], 'horn'),
      P([[21, 17], [25, 9], [26, 19]], 'horn'),
      C(18, 25, 8, 'stone'),
      E(12, 29, 4, 3, 'stone'),
    ],
    details: [
      ...[[14, 24], [21, 24]].map(([x, y]) => DOTS('amber', [x!, y!], [x! + 1, y!], [x!, y! + 1], [x! + 1, y! + 1])),
      DOTS(INK.toString(), [15, 25], [22, 25]),
      DOTS('moss', [20, 18], [21, 18], [22, 19], [30, 27], [31, 27], [32, 28], [26, 29]),
      DOTS('crack', [29, 36], [30, 37], [30, 38], [16, 21]),
      DOTS(INK.toString(), [10, 30], [11, 31]),
    ],
  },
  puffwisp: {
    palette: { fluff: 0xf6f2ea, core: 0xf2dc96, stem: 0x8aa86a, cheek: CHEEK, seed: 0xd8d0e4 },
    shapes: [
      L([[24, 31], [26, 38], [22, 44]], 1.5, 'stem'),
      C(14, 18, 3, 'fluff'), C(16, 12, 3, 'fluff'), C(23, 9, 3, 'fluff'), C(31, 12, 3, 'fluff'),
      C(34, 19, 3, 'fluff'), C(33, 26, 3, 'fluff'), C(27, 31, 3, 'fluff'), C(19, 31, 3, 'fluff'), C(13, 25, 3, 'fluff'),
      C(24, 21, 10, 'fluff'),
    ],
    details: [
      EYE(21, 21, 2), EYE(27, 21, 2),
      DOTS('cheek', [19, 24], [30, 24]),
      DOTS('core', [24, 25], [25, 25]),
      DOTS('seed', [6, 8], [6, 9], [40, 6], [40, 7], [42, 30], [42, 31], [7, 36], [7, 37]),
      DOTS('stem', [6, 10], [40, 8], [42, 32], [7, 38]),
    ],
  },
  mycelf: {
    palette: { cap: 0xa8406a, spot: 0x9ef0e0, stem: 0xf0e2c8, gill: 0xd8c0a8, cheek: CHEEK },
    shapes: [
      E(19, 44, 3, 2, 'stem'),
      E(29, 44, 3, 2, 'stem'),
      L([[17, 35], [12, 38]], 2, 'stem'),
      L([[31, 35], [36, 38]], 2, 'stem'),
      E(24, 36, 8, 8, 'stem'),
      E(24, 25, 14, 3, 'gill'),
      P([[8, 25], [10, 16], [16, 10], [24, 8], [32, 10], [38, 16], [40, 25]], 'cap'),
      C(16, 17, 2, 'spot', { flat: true }),
      C(26, 12, 2.5, 'spot', { flat: true }),
      C(34, 19, 2, 'spot', { flat: true }),
      C(22, 20, 1.5, 'spot', { flat: true }),
    ],
    details: [EYE(21, 34, 2), EYE(27, 34, 2), DOTS('cheek', [19, 37], [30, 37]), DOTS('spot', [5, 30], [42, 27], [40, 40])],
  },
  blotling: {
    palette: { ink: 0x2c2c56, shine: 0x6a78c0, white: 0xf4f0ea, seal: 0xc8304a },
    shapes: [
      L([[14, 40], [14, 46]], 2, 'ink'),
      L([[33, 41], [33, 46]], 2, 'ink'),
      E(24, 35, 14, 9, 'ink'),
      E(20, 27, 9, 9, 'ink'),
      E(30, 29, 8, 7, 'ink'),
      C(9, 39, 3, 'ink'),
      C(40, 38, 3, 'ink'),
      E(19, 28, 3, 4, 'white', { flat: true }),
      E(28, 28, 3, 4, 'white', { flat: true }),
      C(35, 37, 2.5, 'seal'),
    ],
    details: [
      DOTS(INK.toString(), [18, 28], [19, 28], [18, 29], [19, 29], [27, 28], [28, 28], [27, 29], [28, 29]),
      DOTS('white', [18, 28], [27, 28]),
      DOTS('shine', [16, 21], [17, 20], [18, 20], [12, 33], [13, 32]),
      HEART(33, 36, 'white'),
    ],
  },
  dearling: {
    palette: { fur: 0xd99a6a, belly: 0xf6e2cc, hoof: 0x5a3a2a, nose: 0xe07a8a, pink: 0xf2a7bf, dapple: 0xfff4f4, cheek: CHEEK },
    shapes: [
      R(22, 34, 3, 10, 'fur'),
      R(35, 33, 3, 11, 'fur'),
      E(39, 25, 2.5, 3, 'belly'),
      E(29, 29, 11, 7, 'fur'),
      E(28, 32, 7, 3, 'belly'),
      R(18, 35, 3, 10, 'fur'),
      R(31, 35, 3, 10, 'fur'),
      R(18, 44, 3, 2, 'hoof'), R(31, 44, 3, 2, 'hoof'), R(22, 43, 3, 2, 'hoof'), R(35, 43, 3, 2, 'hoof'),
      P([[14, 28], [17, 17], [24, 19], [23, 30]], 'fur'),
      E(10, 7, 2.5, 5, 'fur', { rot: -0.6 }),
      E(10, 7, 1.2, 3, 'pink', { rot: -0.6, flat: true }),
      E(21, 8, 2.5, 5, 'fur', { rot: 0.6 }),
      E(21, 8, 1.2, 3, 'pink', { rot: 0.6, flat: true }),
      C(15, 15, 6.5, 'fur'),
      E(10, 18, 3.5, 2.5, 'belly'),
    ],
    details: [
      EYE(12, 14, 2), EYE(17, 14, 2),
      DOTS(INK.toString(), [11, 13], [18, 13]),
      DOTS('nose', [7, 17], [8, 17]),
      DOTS('cheek', [11, 17], [19, 17]),
      HEART(26, 24, 'dapple'), HEART(32, 27, 'dapple'), HEART(21, 26, 'dapple'),
    ],
  },
  umbrasp: {
    palette: { scale: 0x382c4e, belly: 0xb8a6d8, hood: 0x5a4286, inner: 0x8a68c0, gold: 0xe6bd62, eye: 0xd8a4ff, tongue: 0xe05a7a, sheen: 0x7a68a8 },
    shapes: [
      E(26, 40, 15, 5, 'scale'),
      E(29, 34, 11, 4.5, 'scale'),
      E(27, 29, 8, 4, 'scale'),
      L([[25, 28], [21, 20], [18, 13]], 5, 'scale'),
      L([[23, 29], [19, 21], [16, 15]], 1.5, 'belly'),
      P([[8, 11], [16, 1], [27, 8], [26, 20], [18, 24], [10, 21]], 'hood'),
      P([[13, 12], [17, 5], [23, 9], [22, 18], [17, 20], [14, 18]], 'inner', { flat: true }),
      E(10, 13, 6.5, 4, 'scale', { rot: -0.15 }),
    ],
    details: [
      DOTS('eye', [7, 12], [8, 12], [7, 13], [8, 13], [12, 12], [13, 12], [12, 13], [13, 13]),
      DOTS(WHITE.toString(), [7, 12], [12, 12]),
      DOTS('tongue', [3, 16], [2, 16], [1, 15], [1, 17]),
      DOTS('gold', [17, 6], [16, 8], [18, 8], [17, 9], [15, 13], [19, 13], [17, 16], [20, 11], [14, 10],
        [14, 39], [18, 40], [22, 40], [26, 41], [30, 40], [34, 40], [38, 39], [24, 34], [28, 35], [32, 34], [26, 29], [29, 30]),
      DOTS('sheen', [21, 37], [22, 37], [29, 31], [30, 31], [8, 11], [9, 11], [24, 26]),
    ],
  },
};

// ── Rasteriser ───────────────────────────────────────────────────────────

function insideShape(s: Shape, px: number, py: number): boolean {
  switch (s.t) {
    case 'ell': {
      const dx = px - s.x;
      const dy = py - s.y;
      const cos = Math.cos(-s.rot);
      const sin = Math.sin(-s.rot);
      const u = (dx * cos - dy * sin) / s.rx;
      const v = (dx * sin + dy * cos) / s.ry;
      return u * u + v * v <= 1;
    }
    case 'rect':
      return px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h;
    case 'poly': {
      let inside = false;
      const pts = s.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    case 'line': {
      const r = s.w / 2;
      for (let i = 0; i < s.pts.length - 1; i++) {
        const [ax, ay] = s.pts[i]!;
        const [bx, by] = s.pts[i + 1]!;
        const vx = bx - ax;
        const vy = by - ay;
        const len2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
        const cx = ax + t * vx - px;
        const cy = ay + t * vy - py;
        if (cx * cx + cy * cy <= r * r) return true;
      }
      return false;
    }
  }
}

/** -1 shadow, 0 base, +1 highlight; ellipses are lit like little spheres. */
function ellipseTone(s: Extract<Shape, { t: 'ell' }>, px: number, py: number): number {
  const u = (px - s.x) / s.rx;
  const v = (py - s.y) / s.ry;
  const light = -0.55 * u - 0.8 * v;
  if (light > 0.55 && u * u + v * v > 0.15) return 1;
  if (light < -0.5) return -1;
  return 0;
}

export function rasterFamiliar(id: SpeciesId): PixBuf {
  const art = FAMILIAR_ART[id];
  const S = FAMILIAR_SIZE;
  const owner = new Int16Array(S * S).fill(-1);
  const tone = new Int8Array(S * S);

  art.shapes.forEach((s, i) => {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!insideShape(s, x + 0.5, y + 0.5)) continue;
        owner[y * S + x] = i;
        tone[y * S + x] = s.t === 'ell' && !s.flat ? ellipseTone(s, x + 0.5, y + 0.5) : 0;
      }
    }
  });

  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= S || y >= S ? -1 : owner[y * S + x]!);
  const colorOf = (i: number) => art.palette[art.shapes[i]!.c] ?? 0xff00ff;

  const buf = new PixBuf(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = at(x, y);
      if (i < 0) continue;
      const s = art.shapes[i]!;
      let t = tone[y * S + x]!;
      if (!s.flat && s.t !== 'ell') {
        // Edge lighting for flat-sided shapes.
        const below = at(x, y + 1) !== i || at(x + 1, y) !== i;
        const above = at(x, y - 1) !== i || at(x - 1, y) !== i;
        t = below && !above ? -1 : above && !below ? 1 : 0;
      }
      // Contact shadow where a shape in front overlaps this one.
      const occluded = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n > i);
      if (occluded && !s.flat) t = Math.min(t, 0) - 1;
      const base = colorOf(i);
      const c = t >= 1 ? lighten(base, 0.24) : t === -1 ? darken(base, 0.24) : t <= -2 ? darken(base, 0.42) : base;
      buf.set(x, y, c);
    }
  }

  // Selective outline: transparent pixels touching the sprite take a deep tint of their neighbour.
  const filled = (x: number, y: number) => at(x, y) >= 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (filled(x, y)) continue;
      const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].find(([nx, ny]) => filled(nx!, ny!));
      if (!n) continue;
      buf.set(x, y, darken(colorOf(at(n[0]!, n[1]!)), 0.72));
    }
  }

  const resolve = (key: string) => art.palette[key] ?? (Number.isNaN(Number(key)) ? 0xff00ff : Number(key));
  for (const d of art.details) {
    if (d.t === 'dots') for (const [x, y] of d.pts) buf.set(x, y, resolve(d.c));
    else if (d.t === 'heart') {
      const c = resolve(d.c);
      for (const [dx, dy] of [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]] as const) buf.set(d.x + dx, d.y + dy, c);
    } else {
      const iris = d.iris ? resolve(d.iris) : INK;
      const w = d.size === 3 ? 3 : d.size === 2 ? 2 : 1;
      const h = d.size === 3 ? 4 : d.size === 2 ? 3 : 2;
      buf.rect(d.x, d.y, w, h, iris);
      if (d.size >= 2) buf.set(d.x, d.y, WHITE);
      if (d.size === 3) buf.set(d.x + 1, d.y + 1, WHITE);
    }
  }
  return buf;
}

export function drawFamiliar(id: SpeciesId): HTMLCanvasElement {
  return rasterFamiliar(id).toCanvas();
}
