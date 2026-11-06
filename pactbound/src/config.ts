/** Logical resolution. Everything is pixel art at this size, scaled up to fit the screen. */
export const GAME_W = 480;
export const GAME_H = 320;
export const TILE = 16;
/** The overworld camera shows 15 x 10 tiles. */
export const WORLD_ZOOM = 2;

export const FONT = 'DotGothic16';
export const TITLE_FONT = 'Jacquarda Bastarda 9';
/** The family name contains a digit, so CSS font strings need it quoted. */
export const TITLE_FONT_CSS = `"${TITLE_FONT}"`;

/** Seconds per tile. */
export const WALK_TIME = 0.2;
export const RUN_TIME = 0.11;

/** The UI palette: ink, parchment and old gold. */
export const UI = {
  ink: 0x120d18,
  panel: 0x1d1527,
  panelLight: 0x2a1f38,
  border: 0x0a070d,
  gold: 0xd9b25c,
  goldDark: 0x8a6a32,
  text: '#f3eadb',
  textDim: '#a898b8',
  textGold: '#e9c97a',
  textRose: '#f2a7bf',
  hpGood: 0x6dcf7a,
  hpMid: 0xf0c050,
  hpLow: 0xe8584a,
  xp: 0x6aa8f0,
  devotion: 0xf07aa8,
  clarity: 0x8ed6f0,
} as const;
