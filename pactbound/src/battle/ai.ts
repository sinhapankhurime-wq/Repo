import { MOVES, type MoveId } from '../data/moves';
import { maxHp } from '../core/familiar';
import type { Rng } from '../core/rng';
import type { Battle, Side } from './engine';

const other = (s: Side): Side => (s === 'player' ? 'foe' : 'player');

/**
 * - random: wild familiars, and nervous first-years.
 * - smart: weighs expected damage, finishing blows and useful status moves,
 *   with a 20% chance to do something unexpected.
 */
export type AiLevel = 'random' | 'smart';

/** Returns a move slot for `side`'s active familiar, or -1 (Flail) when every spell is spent. */
export function chooseMove(b: Battle, side: Side, level: AiLevel, rng: Rng): number {
  const f = b.active(side);
  const usable = f.moves.map((m, i) => ({ id: m.id, uses: m.uses, i })).filter((m) => m.uses > 0);
  if (usable.length === 0) return -1;
  if (level === 'random' || rng.chance(0.2)) return rng.pick(usable).i;

  let best = usable[0] as (typeof usable)[number];
  let bestScore = -Infinity;
  for (const m of usable) {
    const score = scoreMove(b, side, m.id) + rng.next(); // jitter breaks ties
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best.i;
}

export function scoreMove(b: Battle, side: Side, id: MoveId): number {
  const mv = MOVES[id];
  const user = b.active(side);
  const target = b.active(other(side));
  const hitChance = (mv.accuracy ?? 100) / 100;
  if (mv.power > 0) {
    const est = b.estimateDamage(side, id);
    return (est >= target.hp ? 1000 : est) * hitChance;
  }
  let score = 0;
  for (const e of mv.effects ?? []) {
    if (e.kind === 'heal') score += user.hp < maxHp(user) * 0.5 ? 60 : 0;
    else if (e.kind === 'status') score += target.status ? 0 : 22;
    else if (e.kind === 'stat') {
      const who = e.target === 'self' ? side : other(side);
      const stage = b.side(who).stages[e.stat];
      const useful = e.stages > 0 ? stage < 2 : stage > -2;
      score += useful ? 14 : 0;
    }
  }
  return score * hitChance;
}
