import { MOVES, type MoveId, type StatusId } from '../data/moves';
import { SPECIES, type Growth, type SpeciesId } from '../data/species';

export interface MoveSlot {
  id: MoveId;
  uses: number;
}

/** One bound familiar: stored in the party, in storage, or on a trainer's team. */
export interface Familiar {
  uid: string;
  species: SpeciesId;
  nickname?: string;
  level: number;
  /** Total experience (not experience into the current level). */
  xp: number;
  hp: number;
  moves: MoveSlot[];
  status: StatusId | null;
  /** Turns left for timed statuses (drowse, charm). */
  statusTurns: number;
}

export interface Stats {
  hp: number;
  pow: number;
  grd: number;
  spd: number;
}

export const MAX_LEVEL = 50;
export const MAX_MOVES = 4;

const GROWTH_FACTOR: Record<Growth, number> = { fast: 0.8, medium: 1, slow: 1.25 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Total XP required to *be* at `level`. */
export function xpForLevel(growth: Growth, level: number): number {
  if (level <= 1) return 0;
  return Math.floor(GROWTH_FACTOR[growth] * level ** 3);
}

/**
 * Stats scale linearly with level:
 *   HP    = floor(2 * base * level / 50) + level + 10
 *   other = floor(2 * base * level / 50) + 5
 */
export function statsFor(id: SpeciesId, level: number): Stats {
  const b = SPECIES[id].base;
  const scaled = (base: number) => Math.floor((base * 2 * level) / 50);
  return {
    hp: scaled(b.hp) + level + 10,
    pow: scaled(b.pow) + 5,
    grd: scaled(b.grd) + 5,
    spd: scaled(b.spd) + 5,
  };
}

export function stats(f: Familiar): Stats {
  return statsFor(f.species, f.level);
}

export function maxHp(f: Familiar): number {
  return statsFor(f.species, f.level).hp;
}

let uidCounter = 0;
export function newUid(): string {
  uidCounter += 1;
  return `f${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

/** The (up to four) most recent moves a species knows at `level`. */
export function movesAtLevel(id: SpeciesId, level: number): MoveId[] {
  const known: MoveId[] = [];
  for (const [lv, m] of SPECIES[id].learnset) {
    if (lv > level) break;
    if (!known.includes(m)) known.push(m);
  }
  return known.slice(-MAX_MOVES);
}

export function createFamiliar(id: SpeciesId, level: number, opts: { uid?: string; moves?: MoveId[] } = {}): Familiar {
  const lv = clamp(Math.floor(level), 1, MAX_LEVEL);
  const moves = (opts.moves ?? movesAtLevel(id, lv)).slice(0, MAX_MOVES).map((m) => ({ id: m, uses: MOVES[m].uses }));
  return {
    uid: opts.uid ?? newUid(),
    species: id,
    level: lv,
    xp: xpForLevel(SPECIES[id].growth, lv),
    hp: statsFor(id, lv).hp,
    moves,
    status: null,
    statusTurns: 0,
  };
}

export function displayName(f: Familiar): string {
  return f.nickname ?? SPECIES[f.species].name;
}

export function isFainted(f: Familiar): boolean {
  return f.hp <= 0;
}

/** Full rest: HP, status and spell uses. */
export function restore(f: Familiar): void {
  f.hp = maxHp(f);
  f.status = null;
  f.statusTurns = 0;
  for (const slot of f.moves) slot.uses = MOVES[slot.id].uses;
}

/** Heals up to `amount` HP; returns how much was actually restored. */
export function healHp(f: Familiar, amount: number): number {
  const before = f.hp;
  f.hp = Math.min(maxHp(f), f.hp + Math.max(0, amount));
  return f.hp - before;
}

/** Fraction of the way from the current level to the next (0..1). */
export function xpProgress(f: Familiar): number {
  if (f.level >= MAX_LEVEL) return 1;
  const g = SPECIES[f.species].growth;
  const lo = xpForLevel(g, f.level);
  const hi = xpForLevel(g, f.level + 1);
  return clamp((f.xp - lo) / (hi - lo), 0, 1);
}

export interface LevelUpResult {
  /** Every level reached, in order. */
  levels: number[];
  /** Moves learned automatically into a free slot. */
  learned: MoveId[];
  /** Moves offered while all four slots are full: the player picks one to forget, or skips. */
  pending: MoveId[];
}

export function gainXp(f: Familiar, amount: number): LevelUpResult {
  const result: LevelUpResult = { levels: [], learned: [], pending: [] };
  const growth = SPECIES[f.species].growth;
  if (f.level >= MAX_LEVEL || amount <= 0) return result;
  f.xp += Math.floor(amount);
  while (f.level < MAX_LEVEL && f.xp >= xpForLevel(growth, f.level + 1)) {
    const before = maxHp(f);
    f.level += 1;
    if (f.hp > 0) f.hp += maxHp(f) - before;
    result.levels.push(f.level);
    for (const [lv, m] of SPECIES[f.species].learnset) {
      if (lv !== f.level || f.moves.some((s) => s.id === m)) continue;
      if (f.moves.length < MAX_MOVES) {
        f.moves.push({ id: m, uses: MOVES[m].uses });
        result.learned.push(m);
      } else {
        result.pending.push(m);
      }
    }
  }
  if (f.level >= MAX_LEVEL) f.xp = xpForLevel(growth, MAX_LEVEL);
  return result;
}

/** Overwrites move slot `slot` with `id` at full uses. */
export function replaceMove(f: Familiar, slot: number, id: MoveId): void {
  if (slot < 0 || slot >= MAX_MOVES) return;
  f.moves[slot] = { id, uses: MOVES[id].uses };
}

/** The species this familiar is ready to ascend into, if any. */
export function pendingEvolution(f: Familiar): SpeciesId | null {
  const evo = SPECIES[f.species].evolves;
  return evo && f.level >= evo.level ? evo.to : null;
}

export function evolve(f: Familiar, to: SpeciesId): void {
  const before = maxHp(f);
  f.species = to;
  if (f.hp > 0) f.hp = Math.min(maxHp(f), f.hp + (maxHp(f) - before));
}
