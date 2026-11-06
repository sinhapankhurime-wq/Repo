import { ITEMS } from '../data/items';
import { MOVES } from '../data/moves';
import { SPECIES } from '../data/species';
import type { Familiar } from './familiar';
import { newGame, SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'pactbound.save';

/** The subset of the Web Storage API we need; lets tests pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

let fallback: KeyValueStore | null = null;

/** localStorage when it works (it can throw in private windows or sandboxed frames), else memory. */
export function defaultStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      ls.setItem('__pactbound_probe__', '1');
      ls.removeItem('__pactbound_probe__');
      return ls;
    }
  } catch {
    // fall through to memory
  }
  fallback ??= memoryStore();
  return fallback;
}

export function saveGame(state: GameState, store: KeyValueStore = defaultStore()): boolean {
  try {
    state.savedAt = Date.now();
    store.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(store: KeyValueStore = defaultStore()): GameState | null {
  try {
    const raw = store.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

export function hasSave(store: KeyValueStore = defaultStore()): boolean {
  return loadGame(store) !== null;
}

export function deleteSave(store: KeyValueStore = defaultStore()): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

function isValidFamiliar(f: unknown): f is Familiar {
  if (!f || typeof f !== 'object') return false;
  const x = f as Partial<Familiar>;
  return (
    typeof x.uid === 'string' &&
    typeof x.species === 'string' && x.species in SPECIES &&
    typeof x.level === 'number' && typeof x.hp === 'number' && typeof x.xp === 'number' &&
    Array.isArray(x.moves) && x.moves.every((m) => m && typeof m.id === 'string' && m.id in MOVES && typeof m.uses === 'number')
  );
}

/**
 * Parses and sanitises a save. Fields added in later versions are filled from
 * newGame(); unknown species, moves and items are dropped rather than crashing.
 */
export function parseSave(raw: string): GameState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<GameState>;
  if (typeof d.version !== 'number' || d.version > SAVE_VERSION) return null;
  const merged: GameState = { ...newGame(), ...d, version: SAVE_VERSION };
  merged.party = Array.isArray(d.party) ? d.party.filter(isValidFamiliar) : [];
  merged.storage = Array.isArray(d.storage) ? d.storage.filter(isValidFamiliar) : [];
  const bag: GameState['bag'] = {};
  for (const [k, v] of Object.entries(merged.bag ?? {})) {
    if (k in ITEMS && typeof v === 'number' && v > 0) bag[k as keyof typeof ITEMS] = Math.floor(v);
  }
  merged.bag = bag;
  merged.flags = merged.flags && typeof merged.flags === 'object' ? merged.flags : {};
  merged.seen = (merged.seen ?? []).filter((s) => s in SPECIES);
  merged.caught = (merged.caught ?? []).filter((s) => s in SPECIES);
  merged.defeated = Array.isArray(merged.defeated) ? merged.defeated : [];
  return merged;
}
