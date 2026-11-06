/**
 * Map legend. Maps are written as rows of these characters (see src/world/maps).
 * This file says how each tile *behaves*; src/gfx/tiles.ts says how it looks.
 */
export interface TileInfo {
  name: string;
  solid: boolean;
  /** Wild familiars may appear when walking here. */
  encounter?: boolean;
  /** Stepping on it triggers the map warp registered at that position. */
  door?: boolean;
  /** You can talk to someone standing on the far side of it (shop and library desks). */
  counter?: boolean;
  /** Drawn over the map's ground tile (it has transparent parts). */
  overlay?: boolean;
}

const t = (name: string, solid: boolean, extra: Partial<TileInfo> = {}): TileInfo => ({ name, solid, ...extra });

export const TILES: Record<string, TileInfo> = {
  // Outdoors
  '.': t('grass', false),
  ',': t('flowers', false),
  '"': t('mistgrass', false, { encounter: true }),
  ':': t('cobblestones', false),
  '=': t('flagstones', false),
  T: t('tree', true, { overlay: true }),
  w: t('pond', true),
  W: t('fountain', true),
  '#': t('stone wall', true),
  '~': t('window', true),
  R: t('slate roof', true),
  D: t('door', false, { door: true }),
  g: t('iron fence', true, { overlay: true }),
  G: t('iron gate', true, { overlay: true }),
  L: t('lamp post', true, { overlay: true }),
  b: t('bench', true, { overlay: true }),
  h: t('hedge', true),
  r: t('boulder', true, { overlay: true }),
  Y: t('glass roof', true),
  y: t('glass wall', true),
  S: t('gargoyle statue', true, { overlay: true }),
  o: t('mushroom ring', false, { overlay: true }),
  s: t('old shrine', true, { overlay: true }),
  '*': t('flower bed', true),
  '0': t('darkness', true),
  // Indoors
  _: t('wood floor', false),
  '-': t('carpet', false),
  '+': t('stone floor', false),
  '|': t('wall', true),
  '^': t('tall window', true),
  B: t('bookshelf', true),
  k: t('bed', true, { overlay: true }),
  j: t('bed', true, { overlay: true }),
  K: t('table', true, { overlay: true }),
  c: t('chair', true, { overlay: true }),
  P: t('pedestal', true, { overlay: true }),
  p: t('potted plant', true, { overlay: true }),
  q: t('candelabra', true, { overlay: true }),
  x: t('dueling rune', false),
  E: t('doormat', false, { door: true, overlay: true }),
  n: t('banner', true),
  m: t('desk', true, { overlay: true, counter: true }),
  f: t('fireplace', true),
  u: t('wardrobe', true, { overlay: true }),
  z: t('rug', false),
};

const UNKNOWN: TileInfo = { name: 'unknown', solid: true };

export function tileInfo(ch: string): TileInfo {
  return TILES[ch] ?? UNKNOWN;
}
