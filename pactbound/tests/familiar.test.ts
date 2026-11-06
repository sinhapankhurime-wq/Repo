import { describe, expect, it } from 'vitest';
import {
  createFamiliar,
  evolve,
  gainXp,
  maxHp,
  movesAtLevel,
  pendingEvolution,
  replaceMove,
  restore,
  statsFor,
  xpForLevel,
  xpProgress,
} from '../src/core/familiar';

describe('stats', () => {
  it('follows the documented formula', () => {
    // Kettlepup base hp 46, pow 54 at level 5.
    expect(statsFor('kettlepup', 5)).toEqual({
      hp: Math.floor((46 * 2 * 5) / 50) + 5 + 10,
      pow: Math.floor((54 * 2 * 5) / 50) + 5,
      grd: Math.floor((42 * 2 * 5) / 50) + 5,
      spd: Math.floor((50 * 2 * 5) / 50) + 5,
    });
  });

  it('grows with level', () => {
    const a = statsFor('grimlet', 5);
    const b = statsFor('grimlet', 20);
    expect(b.hp).toBeGreaterThan(a.hp);
    expect(b.grd).toBeGreaterThan(a.grd);
  });
});

describe('createFamiliar', () => {
  it('starts at full HP with the latest four moves', () => {
    const f = createFamiliar('dearling', 16, { uid: 'x' });
    expect(f.hp).toBe(maxHp(f));
    expect(f.moves.map((m) => m.id)).toEqual(movesAtLevel('dearling', 16));
    expect(f.moves.length).toBeLessThanOrEqual(4);
    expect(f.xp).toBe(xpForLevel('slow', 16));
  });

  it('only knows moves learnt by its level', () => {
    const f = createFamiliar('kettlepup', 5, { uid: 'x' });
    expect(f.moves.map((m) => m.id)).toEqual(['pounce', 'hiss']);
  });
});

describe('experience', () => {
  it('levels up and learns new moves into free slots', () => {
    const f = createFamiliar('kettlepup', 6, { uid: 'x' });
    const res = gainXp(f, xpForLevel('medium', 7) - f.xp);
    expect(f.level).toBe(7);
    expect(res.levels).toEqual([7]);
    expect(res.learned).toEqual(['cinderFlick']);
    expect(f.moves.map((m) => m.id)).toContain('cinderFlick');
  });

  it('asks before replacing a move when all four slots are full', () => {
    const f = createFamiliar('kettlepup', 12, { uid: 'x' });
    expect(f.moves.length).toBe(4);
    const res = gainXp(f, xpForLevel('medium', 13) - f.xp);
    expect(res.pending).toEqual(['steamPuff']);
    expect(f.moves.map((m) => m.id)).not.toContain('steamPuff');
    replaceMove(f, 1, 'steamPuff');
    expect(f.moves[1]?.id).toBe('steamPuff');
  });

  it('keeps current HP in step with max HP on level up', () => {
    const f = createFamiliar('quillpus', 8, { uid: 'x' });
    f.hp -= 10;
    const before = maxHp(f);
    gainXp(f, xpForLevel('medium', 9) - f.xp);
    expect(f.hp).toBe(before - 10 + (maxHp(f) - before));
  });

  it('reports progress through the level', () => {
    const f = createFamiliar('tomelet', 5, { uid: 'x' });
    expect(xpProgress(f)).toBe(0);
    f.xp += Math.floor((xpForLevel('medium', 6) - xpForLevel('medium', 5)) / 2);
    expect(xpProgress(f)).toBeGreaterThan(0.4);
    expect(xpProgress(f)).toBeLessThan(0.6);
  });
});

describe('ascension (evolution)', () => {
  it('is offered at the evolution level and keeps damage taken', () => {
    const f = createFamiliar('budmouse', 15, { uid: 'x' });
    expect(pendingEvolution(f)).toBeNull();
    gainXp(f, xpForLevel('medium', 16) - f.xp);
    expect(pendingEvolution(f)).toBe('briarmaus');
    f.hp -= 5;
    evolve(f, 'briarmaus');
    expect(f.species).toBe('briarmaus');
    expect(f.hp).toBe(maxHp(f) - 5);
  });

  it('restore() refills HP, status and uses', () => {
    const f = createFamiliar('glimmoth', 10, { uid: 'x' });
    f.hp = 1;
    f.status = 'blight';
    f.moves[0]!.uses = 0;
    restore(f);
    expect(f.hp).toBe(maxHp(f));
    expect(f.status).toBeNull();
    expect(f.moves[0]!.uses).toBeGreaterThan(0);
  });
});
