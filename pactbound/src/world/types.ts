import type { Dir, GameState } from '../core/state';
import type { LookId } from '../data/cast';
import type { ItemId } from '../data/items';
import type { SpeciesId } from '../data/species';
import type { TrainerId } from '../data/trainers';

export type MapId = 'courtyard' | 'conservatory' | 'dormitory' | 'library' | 'duelingHall' | 'gloamwood';
export type TrackId = 'title' | 'academy' | 'interior' | 'forest' | 'lucien' | 'battle' | 'duel';
export type BattleBg = 'courtyard' | 'hall' | 'forest' | 'library';

export interface Warp {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
  dir: Dir;
}

export interface NpcDef {
  id: string;
  look: LookId;
  x: number;
  y: number;
  dir: Dir;
  /** Script id (see src/story) run when the player talks to them. */
  talk?: string;
  /** Talking starts this optional duel (once), then `after` lines. */
  trainer?: TrainerId;
  /** Present only while this is true. Re-checked whenever a script finishes. */
  when?: (s: GameState) => boolean;
}

/** Something to inspect: a bookshelf, a bed, an item on the ground, a familiar on a pedestal. */
export interface ThingDef {
  x: number;
  y: number;
  /** Script id run on inspect. */
  talk: string;
  /** Optional sprite drawn on the tile. */
  sprite?: 'sign' | 'sparkle' | `familiar:${SpeciesId}`;
  when?: (s: GameState) => boolean;
}

/** A pick-up on the ground: inspecting it adds the item once. */
export interface PickupDef {
  x: number;
  y: number;
  id: string;
  item: ItemId;
  qty: number;
}

export interface EncounterZone {
  /** Tiles x, y, w, h. Omit for the whole map. */
  area?: readonly [number, number, number, number];
  /** Chance per step on encounter grass (0..1). */
  rate: number;
  table: readonly { species: SpeciesId; min: number; max: number; weight: number }[];
}

export interface StepTrigger {
  x: number;
  y: number;
  script: string;
  when?: (s: GameState) => boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  /** Tile drawn under overlay tiles (trees, lamps, furniture). */
  ground: string;
  outdoor: boolean;
  music: TrackId;
  battleBg: BattleBg;
  rows: readonly string[];
  warps: readonly Warp[];
  npcs: readonly NpcDef[];
  things: readonly ThingDef[];
  pickups: readonly PickupDef[];
  triggers: readonly StepTrigger[];
  /** Checked in order; the first zone containing the tile wins. */
  encounters: readonly EncounterZone[];
  /** Script id run every time the map is entered. */
  onEnter?: string;
}
