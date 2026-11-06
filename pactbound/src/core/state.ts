import type { ItemId } from '../data/items';
import type { SpeciesId } from '../data/species';
import { isFainted, restore, type Familiar } from './familiar';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type FlagValue = boolean | number | string;

export const SAVE_VERSION = 1;
export const MAX_PARTY = 6;

/** Everything that is saved. Plain JSON: no class instances, no functions. */
export interface GameState {
  version: number;
  map: string;
  x: number;
  y: number;
  facing: Dir;
  party: Familiar[];
  /** Familiars bound while the party was full. They wait in the Conservatory. */
  storage: Familiar[];
  bag: Partial<Record<ItemId, number>>;
  /** Academy currency. */
  marks: number;
  /** Story progress. See docs/STORY.md for the flags Chapter 1 uses. */
  flags: Record<string, FlagValue>;
  /** How deeply Wren has fallen under Lucien's spell. Raised by trusting choices. */
  devotion: number;
  /** How clearly Wren sees what he is doing. Raised by wary choices. */
  clarity: number;
  seen: SpeciesId[];
  caught: SpeciesId[];
  /** Trainer ids already beaten. */
  defeated: string[];
  /** Shown in the Journal. */
  objective: string;
  playSeconds: number;
  chapter: number;
  savedAt?: number;
}

export function newGame(): GameState {
  return {
    version: SAVE_VERSION,
    map: 'courtyard',
    x: 13,
    y: 19,
    facing: 'up',
    party: [],
    storage: [],
    bag: {},
    marks: 300,
    flags: {},
    devotion: 0,
    clarity: 0,
    seen: [],
    caught: [],
    defeated: [],
    objective: 'Find your way into Thornveil Academy.',
    playSeconds: 0,
    chapter: 1,
  };
}

export function itemCount(s: GameState, id: ItemId): number {
  return s.bag[id] ?? 0;
}

export function addItem(s: GameState, id: ItemId, n = 1): void {
  s.bag[id] = itemCount(s, id) + n;
}

export function removeItem(s: GameState, id: ItemId, n = 1): boolean {
  const have = itemCount(s, id);
  if (have < n) return false;
  if (have === n) delete s.bag[id];
  else s.bag[id] = have - n;
  return true;
}

export function getFlag(s: GameState, key: string): FlagValue | undefined {
  return s.flags[key];
}

export function hasFlag(s: GameState, key: string): boolean {
  return Boolean(s.flags[key]);
}

export function setFlag(s: GameState, key: string, value: FlagValue = true): void {
  s.flags[key] = value;
}

export function markSeen(s: GameState, sp: SpeciesId): void {
  if (!s.seen.includes(sp)) s.seen.push(sp);
}

export function markCaught(s: GameState, sp: SpeciesId): void {
  markSeen(s, sp);
  if (!s.caught.includes(sp)) s.caught.push(sp);
}

/** Adds a newly bound familiar to the party, or to storage when the party is full. */
export function addFamiliar(s: GameState, f: Familiar): 'party' | 'storage' {
  markCaught(s, f.species);
  if (s.party.length < MAX_PARTY) {
    s.party.push(f);
    return 'party';
  }
  s.storage.push(f);
  return 'storage';
}

export function healParty(s: GameState): void {
  for (const f of s.party) restore(f);
}

/** Index of the first familiar able to fight, or -1. */
export function firstHealthy(s: GameState): number {
  return s.party.findIndex((f) => !isFainted(f));
}
