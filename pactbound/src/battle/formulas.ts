import type { StatusId } from '../data/moves';
import type { Rng } from '../core/rng';

export const STAGE_LIMIT = 6;
export const CRIT_CHANCE = 1 / 16;
export const CRIT_MULT = 1.5;
/** "Affinity": a familiar casting a move of its own arcana. */
export const AFFINITY_MULT = 1.25;
/** Scorched familiars hit with only this fraction of their Power. */
export const SCORCH_POWER_MULT = 0.75;
/** Wren's gift: wild familiars trust her. Applied to every sigil she traces. */
export const HEARTBLOOM_MULT = 1.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Stage -6..+6 maps to x0.25..x4 via (2+s)/2 above zero and 2/(2-s) below. */
export function stageMultiplier(stage: number): number {
  const s = clamp(Math.trunc(stage), -STAGE_LIMIT, STAGE_LIMIT);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export interface DamageInput {
  level: number;
  power: number;
  attack: number;
  guard: number;
  affinity: boolean;
  effectiveness: number;
  crit: boolean;
  /** Random spread, 0.85..1.0. */
  roll: number;
}

/**
 *   base   = (0.4 * level + 2) * power * (attack / guard) / 25 + 2
 *   damage = floor(base * affinity * effectiveness * crit * roll), at least 1
 */
export function calcDamage(i: DamageInput): number {
  if (i.power <= 0 || i.effectiveness <= 0) return 0;
  const base = ((0.4 * i.level + 2) * i.power * (i.attack / Math.max(1, i.guard))) / 25 + 2;
  const mod = (i.affinity ? AFFINITY_MULT : 1) * i.effectiveness * (i.crit ? CRIT_MULT : 1) * i.roll;
  return Math.max(1, Math.floor(base * mod));
}

export const STATUS_CATCH_BONUS: Record<StatusId, number> = { drowse: 1.6, charm: 1.6, scorch: 1.25, blight: 1.25 };

export interface CatchInput {
  catchRate: number;
  hp: number;
  maxHp: number;
  sigilMult: number;
  status: StatusId | null;
  heartbloom: boolean;
}

/**
 *   p = catchRate/255 * (1 - 2/3 * hp/maxHp) * sigil * status * heartbloom
 * clamped to [0.01, 1]. A familiar at full HP is three times harder to bind
 * than one hanging on at 1 HP.
 */
export function catchChance(i: CatchInput): number {
  const hpFactor = 1 - (2 / 3) * (clamp(i.hp, 0, i.maxHp) / Math.max(1, i.maxHp));
  const p =
    (i.catchRate / 255) *
    hpFactor *
    i.sigilMult *
    (i.status ? STATUS_CATCH_BONUS[i.status] : 1) *
    (i.heartbloom ? HEARTBLOOM_MULT : 1);
  return clamp(p, 0.01, 1);
}

/**
 * The sigil glows up to three times. Each glow holds with probability
 * chance^(1/3), so the overall success rate is exactly `chance` and the number
 * of glows tells the player how close it was.
 */
export function rollCatch(chance: number, rng: Rng): { shakes: number; success: boolean } {
  const perGlow = Math.cbrt(clamp(chance, 0, 1));
  let shakes = 0;
  while (shakes < 3 && rng.next() < perGlow) shakes += 1;
  return { shakes, success: shakes === 3 };
}

export function xpReward(i: { xpYield: number; foeLevel: number; trainer: boolean }): number {
  return Math.max(1, Math.floor(((i.xpYield * i.foeLevel) / 7) * (i.trainer ? 1.5 : 1)));
}

/** Faster familiars always escape; slower ones get better odds with each try. */
export function fleeChance(i: { playerSpd: number; foeSpd: number; attempts: number }): number {
  if (i.playerSpd >= i.foeSpd) return 1;
  return clamp(0.3 + 0.6 * (i.playerSpd / Math.max(1, i.foeSpd)) + 0.15 * Math.max(0, i.attempts - 1), 0, 1);
}
