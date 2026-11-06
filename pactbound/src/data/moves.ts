import type { Arcana } from './arcana';

export type StatKey = 'pow' | 'grd' | 'spd';
export type StatusId = 'scorch' | 'blight' | 'drowse' | 'charm';

export type MoveEffect =
  /** Inflict a status on the target. `chance` is a percentage. */
  | { kind: 'status'; status: StatusId; chance: number }
  /** Raise or lower a battle stat stage. `chance` is a percentage. */
  | { kind: 'stat'; target: 'self' | 'foe'; stat: StatKey; stages: number; chance: number }
  /** The user recovers this fraction of its max HP. */
  | { kind: 'heal'; fraction: number }
  /** The user recovers this fraction of the damage it dealt. */
  | { kind: 'drain'; fraction: number };

export interface MoveDef {
  name: string;
  type: Arcana;
  /** Base power. 0 means a status move that deals no damage. */
  power: number;
  /** Hit chance as a percentage; null means the move never misses. */
  accuracy: number | null;
  /** How many times it can be cast before resting. */
  uses: number;
  /** Higher priority acts first regardless of speed. Default 0. */
  priority?: number;
  effects?: readonly MoveEffect[];
  desc: string;
}

const MOVE_TABLE = {
  // ── Arcane ────────────────────────────────────────────────────────────
  pounce: { name: 'Pounce', type: 'arcane', power: 40, accuracy: 100, uses: 35, desc: 'A playful leap. Every familiar knows this one.' },
  hiss: {
    name: 'Hiss', type: 'arcane', power: 0, accuracy: 100, uses: 30,
    effects: [{ kind: 'stat', target: 'foe', stat: 'pow', stages: -1, chance: 100 }],
    desc: "A warning hiss. Lowers the foe's Power.",
  },
  fluffUp: {
    name: 'Fluff Up', type: 'arcane', power: 0, accuracy: null, uses: 25,
    effects: [{ kind: 'stat', target: 'self', stat: 'grd', stages: 1, chance: 100 }],
    desc: 'Puffs up adorably. Raises Guard.',
  },
  snapSpell: { name: 'Snap Spell', type: 'arcane', power: 40, accuracy: 100, uses: 20, priority: 1, desc: 'A hasty cantrip that always strikes first.' },
  arcaneBolt: { name: 'Arcane Bolt', type: 'arcane', power: 65, accuracy: 95, uses: 15, desc: 'A crackling bolt from the first page of every spellbook.' },
  flail: { name: 'Flail', type: 'arcane', power: 30, accuracy: null, uses: 999, desc: 'Out of spells, it flails wildly.' },

  // ── Ember ─────────────────────────────────────────────────────────────
  cinderFlick: {
    name: 'Cinder Flick', type: 'ember', power: 40, accuracy: 100, uses: 25,
    effects: [{ kind: 'status', status: 'scorch', chance: 10 }],
    desc: 'Flicks a hot cinder. May scorch the foe.',
  },
  kettleWhistle: {
    name: 'Kettle Whistle', type: 'ember', power: 0, accuracy: 90, uses: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'grd', stages: -2, chance: 100 }],
    desc: "A shrill whistle that rattles the foe. Sharply lowers its Guard.",
  },
  steamPuff: {
    name: 'Steam Puff', type: 'ember', power: 55, accuracy: 95, uses: 20,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 20 }],
    desc: 'A scalding puff of steam. May lower Speed.',
  },
  hearthfire: {
    name: 'Hearthfire', type: 'ember', power: 75, accuracy: 90, uses: 10,
    effects: [{ kind: 'status', status: 'scorch', chance: 10 }],
    desc: 'The roaring warmth of a home fire. May scorch the foe.',
  },

  // ── Tide ──────────────────────────────────────────────────────────────
  inkSpurt: { name: 'Ink Spurt', type: 'tide', power: 40, accuracy: 100, uses: 25, desc: 'Squirts a jet of enchanted ink.' },
  inkCloud: {
    name: 'Ink Cloud', type: 'tide', power: 0, accuracy: 90, uses: 20,
    effects: [{ kind: 'stat', target: 'foe', stat: 'spd', stages: -2, chance: 100 }],
    desc: 'Sticky ink gums up the foe. Sharply lowers its Speed.',
  },
  riptide: { name: 'Riptide', type: 'tide', power: 65, accuracy: 95, uses: 15, desc: 'A pulling current that drags the foe under.' },
  tidalVerse: { name: 'Tidal Verse', type: 'tide', power: 80, accuracy: 90, uses: 10, desc: 'Recites a poem so moving the sea answers it.' },

  // ── Bloom ─────────────────────────────────────────────────────────────
  petalToss: { name: 'Petal Toss', type: 'bloom', power: 40, accuracy: 100, uses: 25, desc: 'Tosses a flurry of sharp petals.' },
  nectarSip: {
    name: 'Nectar Sip', type: 'bloom', power: 35, accuracy: 100, uses: 15,
    effects: [{ kind: 'drain', fraction: 0.5 }],
    desc: "Sips the foe's vigour. Heals half the damage dealt.",
  },
  thornLash: { name: 'Thorn Lash', type: 'bloom', power: 65, accuracy: 95, uses: 15, desc: 'Whips the foe with a thorned vine.' },
  sporeLull: {
    name: 'Spore Lull', type: 'bloom', power: 0, accuracy: 75, uses: 10,
    effects: [{ kind: 'status', status: 'drowse', chance: 100 }],
    desc: 'A puff of sleepy spores. Makes the foe drowsy.',
  },

  // ── Gale ──────────────────────────────────────────────────────────────
  flutter: { name: 'Flutter', type: 'gale', power: 40, accuracy: 100, uses: 30, desc: 'A buffeting flurry of wings.' },
  quickwind: {
    name: 'Quickwind', type: 'gale', power: 0, accuracy: null, uses: 15,
    effects: [{ kind: 'stat', target: 'self', stat: 'spd', stages: 2, chance: 100 }],
    desc: 'Rides a tail wind. Sharply raises Speed.',
  },
  galeSlice: { name: 'Gale Slice', type: 'gale', power: 60, accuracy: 95, uses: 15, desc: 'A blade of compressed wind.' },

  // ── Stone ─────────────────────────────────────────────────────────────
  pebblePelt: { name: 'Pebble Pelt', type: 'stone', power: 40, accuracy: 95, uses: 25, desc: 'Pelts the foe with chipped masonry.' },
  bulwark: {
    name: 'Bulwark', type: 'stone', power: 0, accuracy: null, uses: 15,
    effects: [{ kind: 'stat', target: 'self', stat: 'grd', stages: 2, chance: 100 }],
    desc: 'Turns to stone for a moment. Sharply raises Guard.',
  },
  rubbleCrush: { name: 'Rubble Crush', type: 'stone', power: 75, accuracy: 85, uses: 10, desc: 'Drops a shower of rubble. Hard to aim.' },

  // ── Lumen ─────────────────────────────────────────────────────────────
  glimmer: { name: 'Glimmer', type: 'lumen', power: 40, accuracy: 100, uses: 25, desc: 'A dazzling flash of soft light.' },
  lanternLull: {
    name: 'Lantern Lull', type: 'lumen', power: 0, accuracy: 70, uses: 10,
    effects: [{ kind: 'status', status: 'drowse', chance: 100 }],
    desc: 'A swaying glow that makes the foe drowsy.',
  },
  moonbeam: {
    name: 'Moonbeam', type: 'lumen', power: 65, accuracy: 95, uses: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'grd', stages: -1, chance: 10 }],
    desc: 'A cold shaft of moonlight. May lower Guard.',
  },

  // ── Umbra ─────────────────────────────────────────────────────────────
  shadeNip: { name: 'Shade Nip', type: 'umbra', power: 40, accuracy: 100, uses: 25, desc: 'A quick bite from the dark.' },
  doubtSeed: {
    name: 'Doubt Seed', type: 'umbra', power: 0, accuracy: 90, uses: 15,
    effects: [{ kind: 'stat', target: 'foe', stat: 'pow', stages: -2, chance: 100 }],
    desc: "Whispers that plant doubt. Sharply lowers the foe's Power.",
  },
  velvetVenom: {
    name: 'Velvet Venom', type: 'umbra', power: 55, accuracy: 95, uses: 15,
    effects: [{ kind: 'status', status: 'blight', chance: 30 }],
    desc: 'A bite that feels like a kiss. May blight the foe.',
  },
  eclipseFang: { name: 'Eclipse Fang', type: 'umbra', power: 80, accuracy: 90, uses: 10, desc: 'Fangs that swallow the light.' },

  // ── Heart ─────────────────────────────────────────────────────────────
  tenderHum: {
    name: 'Tender Hum', type: 'heart', power: 0, accuracy: null, uses: 10,
    effects: [{ kind: 'heal', fraction: 0.5 }],
    desc: 'Hums a lullaby. Restores half its max HP.',
  },
  heartstring: {
    name: 'Heartstring', type: 'heart', power: 45, accuracy: 100, uses: 20,
    effects: [{ kind: 'status', status: 'charm', chance: 20 }],
    desc: "Plucks at the foe's heart. May charm it.",
  },
  starryEyes: {
    name: 'Starry Eyes', type: 'heart', power: 0, accuracy: 80, uses: 10,
    effects: [{ kind: 'status', status: 'charm', chance: 100 }],
    desc: 'A look so earnest the foe forgets to fight. Charms it.',
  },
  devotion: { name: 'Devotion', type: 'heart', power: 75, accuracy: 95, uses: 10, desc: 'Everything it has, for the one it loves.' },
} satisfies Record<string, MoveDef>;

export type MoveId = keyof typeof MOVE_TABLE;
export const MOVES: Record<MoveId, MoveDef> = MOVE_TABLE;
export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

export function move(id: MoveId): MoveDef {
  return MOVES[id];
}

export const STATUS_INFO: Record<StatusId, { name: string; short: string; color: number }> = {
  scorch: { name: 'Scorched', short: 'SCR', color: 0xf0773c },
  blight: { name: 'Blighted', short: 'BLT', color: 0x8a62c9 },
  drowse: { name: 'Drowsy', short: 'DRW', color: 0x8fa3c9 },
  charm: { name: 'Charmed', short: 'CHM', color: 0xf07aa8 },
};

export const STAT_NAMES: Record<StatKey, string> = { pow: 'Power', grd: 'Guard', spd: 'Speed' };
