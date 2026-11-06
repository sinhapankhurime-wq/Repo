/**
 * Arcana are Pactbound's elemental types. Every familiar has one or two, and
 * every move has exactly one.
 *
 * Design notes (see docs/DESIGN.md for the full table):
 *  - Ember / Tide / Bloom form the classic starter triangle.
 *  - Gale and Stone check each other and the triangle.
 *  - Umbra and Heart are each other's weakness: shadow preys on the heart,
 *    and love is the one thing a shadow cannot survive. Lucien's familiars
 *    are Umbra; the heroine's rare partner is Heart.
 *  - Arcane is neutral against everything.
 */
export const ARCANA = ['arcane', 'ember', 'tide', 'bloom', 'gale', 'stone', 'lumen', 'umbra', 'heart'] as const;
export type Arcana = (typeof ARCANA)[number];

export interface ArcanaInfo {
  name: string;
  /** Hex colour used for labels, move cards and hit particles. */
  color: number;
}

export const ARCANA_INFO: Record<Arcana, ArcanaInfo> = {
  arcane: { name: 'Arcane', color: 0xb3a6c9 },
  ember: { name: 'Ember', color: 0xf0773c },
  tide: { name: 'Tide', color: 0x4a94e0 },
  bloom: { name: 'Bloom', color: 0x6dbb55 },
  gale: { name: 'Gale', color: 0x8ed6cc },
  stone: { name: 'Stone', color: 0xb19a72 },
  lumen: { name: 'Lumen', color: 0xf5d870 },
  umbra: { name: 'Umbra', color: 0x8a62c9 },
  heart: { name: 'Heart', color: 0xf07aa8 },
};

/** attacker -> defender -> multiplier. Pairs not listed are neutral (x1). */
export const ARCANA_CHART: Readonly<Partial<Record<Arcana, Partial<Record<Arcana, number>>>>> = {
  ember: { bloom: 2, umbra: 2, tide: 0.5, stone: 0.5, ember: 0.5 },
  tide: { ember: 2, stone: 2, bloom: 0.5, tide: 0.5 },
  bloom: { tide: 2, stone: 2, ember: 0.5, gale: 0.5, bloom: 0.5 },
  gale: { bloom: 2, tide: 2, stone: 0.5, gale: 0.5 },
  stone: { ember: 2, gale: 2, bloom: 0.5, stone: 0.5 },
  lumen: { umbra: 2, gale: 2, lumen: 0.5, bloom: 0.5 },
  umbra: { heart: 2, lumen: 2, umbra: 0.5, ember: 0.5 },
  heart: { umbra: 2, stone: 2, heart: 0.5 },
};

/** Damage multiplier of an attack of type `attack` against a familiar with `defender` types. */
export function effectiveness(attack: Arcana, defender: readonly Arcana[]): number {
  let m = 1;
  for (const d of defender) m *= ARCANA_CHART[attack]?.[d] ?? 1;
  return m;
}
