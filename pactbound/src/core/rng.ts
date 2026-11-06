/**
 * Small seedable PRNG (mulberry32). Battles take an Rng so tests can make
 * every roll (accuracy, crits, damage spread, catches) deterministic.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** True with probability p (0..1). */
  chance(p: number): boolean;
  /** Uniformly random element; the array must not be empty. */
  pick<T>(items: readonly T[]): T;
}

function wrap(next: () => number): Rng {
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

export function createRng(seed: number = (Math.random() * 2 ** 32) >>> 0): Rng {
  let a = seed >>> 0;
  return wrap(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/** An Rng that always returns `value` from next(). Useful for forcing outcomes in tests. */
export function fixedRng(value: number): Rng {
  return wrap(() => value);
}

/** An Rng that replays `values` in order, then repeats the last one. */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return wrap(() => values[Math.min(i++, values.length - 1)] ?? 0);
}
