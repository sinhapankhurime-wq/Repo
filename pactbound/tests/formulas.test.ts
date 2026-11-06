import { describe, expect, it } from 'vitest';
import { calcDamage, catchChance, fleeChance, rollCatch, stageMultiplier, xpReward } from '../src/battle/formulas';
import { fixedRng } from '../src/core/rng';

describe('stage multipliers', () => {
  it('map -6..6 to 1/4..4 and clamp beyond', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBe(1.5);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(stageMultiplier(6)).toBe(4);
    expect(stageMultiplier(-6)).toBe(0.25);
    expect(stageMultiplier(9)).toBe(4);
  });
});

describe('damage', () => {
  const base = { level: 5, power: 40, attack: 15, guard: 15, affinity: false, effectiveness: 1, crit: false, roll: 1 };

  it('matches the documented formula', () => {
    // (0.4*5 + 2) * 40 * 1 / 25 + 2 = 8.4
    expect(calcDamage(base)).toBe(8);
    expect(calcDamage({ ...base, affinity: true })).toBe(Math.floor(8.4 * 1.25));
    expect(calcDamage({ ...base, effectiveness: 2 })).toBe(16);
    expect(calcDamage({ ...base, crit: true })).toBe(Math.floor(8.4 * 1.5));
  });

  it('never deals less than 1 unless the move deals none', () => {
    expect(calcDamage({ ...base, power: 1, attack: 1, guard: 999, roll: 0.85, effectiveness: 0.25 })).toBe(1);
    expect(calcDamage({ ...base, power: 0 })).toBe(0);
    expect(calcDamage({ ...base, effectiveness: 0 })).toBe(0);
  });
});

describe('catching', () => {
  const full = { catchRate: 255, hp: 30, maxHp: 30, sigilMult: 1, status: null, heartbloom: false } as const;

  it('is easier at low HP, with status, with better sigils and with Heartbloom', () => {
    const atFull = catchChance({ ...full, catchRate: 90 });
    const atOne = catchChance({ ...full, catchRate: 90, hp: 1 });
    expect(atOne).toBeGreaterThan(atFull * 2.5);
    expect(catchChance({ ...full, catchRate: 90, status: 'drowse' })).toBeGreaterThan(atFull);
    expect(catchChance({ ...full, catchRate: 90, sigilMult: 1.6 })).toBeGreaterThan(atFull);
    expect(catchChance({ ...full, catchRate: 90, heartbloom: true })).toBeCloseTo(atFull * 1.25);
  });

  it('stays within [0.01, 1]', () => {
    expect(catchChance({ ...full, hp: 1, sigilMult: 10 })).toBe(1);
    expect(catchChance({ ...full, catchRate: 1 })).toBe(0.01);
  });

  it('rolls three glows for a sure thing and none for a miss', () => {
    expect(rollCatch(1, fixedRng(0.999))).toEqual({ shakes: 3, success: true });
    expect(rollCatch(0.01, fixedRng(0.5))).toEqual({ shakes: 0, success: false });
  });
});

describe('rewards and fleeing', () => {
  it('gives trainers a 1.5x XP bonus', () => {
    const wild = xpReward({ xpYield: 70, foeLevel: 7, trainer: false });
    expect(wild).toBe(70);
    expect(xpReward({ xpYield: 70, foeLevel: 7, trainer: true })).toBe(105);
  });

  it('always lets a faster familiar flee and improves the odds on retries', () => {
    expect(fleeChance({ playerSpd: 20, foeSpd: 10, attempts: 1 })).toBe(1);
    const first = fleeChance({ playerSpd: 10, foeSpd: 20, attempts: 1 });
    const third = fleeChance({ playerSpd: 10, foeSpd: 20, attempts: 3 });
    expect(first).toBeCloseTo(0.6);
    expect(third).toBeGreaterThan(first);
  });
});
