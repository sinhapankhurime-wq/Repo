import { describe, expect, it } from 'vitest';
import { ARCANA, effectiveness } from '../src/data/arcana';
import { LOOKS, SPEAKERS } from '../src/data/cast';
import { ITEMS } from '../src/data/items';
import { MOVES, MOVE_IDS } from '../src/data/moves';
import { SPECIES, SPECIES_IDS } from '../src/data/species';
import { TRAINERS } from '../src/data/trainers';

describe('arcana chart', () => {
  it('has the starter triangle', () => {
    expect(effectiveness('ember', ['bloom'])).toBe(2);
    expect(effectiveness('bloom', ['tide'])).toBe(2);
    expect(effectiveness('tide', ['ember'])).toBe(2);
    expect(effectiveness('ember', ['tide'])).toBe(0.5);
  });

  it('makes Umbra and Heart each other’s weakness', () => {
    expect(effectiveness('umbra', ['heart'])).toBe(2);
    expect(effectiveness('heart', ['umbra'])).toBe(2);
  });

  it('multiplies dual types and keeps Arcane neutral', () => {
    expect(effectiveness('ember', ['bloom', 'umbra'])).toBe(4);
    expect(effectiveness('lumen', ['umbra', 'gale'])).toBe(4);
    expect(effectiveness('tide', ['bloom', 'tide'])).toBe(0.25);
    for (const t of ARCANA) expect(effectiveness('arcane', [t])).toBe(1);
  });
});

describe('data integrity', () => {
  it('every learnset move exists and levels ascend', () => {
    for (const id of SPECIES_IDS) {
      const ls = SPECIES[id].learnset;
      let last = 0;
      for (const [lv, m] of ls) {
        expect(MOVES[m], `${id} -> ${m}`).toBeDefined();
        expect(lv).toBeGreaterThanOrEqual(last);
        last = lv;
      }
      expect(ls.length).toBeGreaterThan(0);
    }
  });

  it('every evolution points at a real species with the same growth curve', () => {
    for (const id of SPECIES_IDS) {
      const evo = SPECIES[id].evolves;
      if (!evo) continue;
      expect(SPECIES[evo.to]).toBeDefined();
      expect(SPECIES[evo.to].growth).toBe(SPECIES[id].growth);
      expect(evo.level).toBeGreaterThan(1);
    }
  });

  it('species and move names are unique', () => {
    const names = SPECIES_IDS.map((id) => SPECIES[id].name);
    expect(new Set(names).size).toBe(names.length);
    const moveNames = MOVE_IDS.map((id) => MOVES[id].name);
    expect(new Set(moveNames).size).toBe(moveNames.length);
  });

  it('moves have sane numbers', () => {
    for (const id of MOVE_IDS) {
      const m = MOVES[id];
      expect(m.power).toBeGreaterThanOrEqual(0);
      expect(m.uses).toBeGreaterThan(0);
      if (m.accuracy !== null) expect(m.accuracy).toBeLessThanOrEqual(100);
      if (m.power === 0) expect(m.effects?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('sigils have a catch multiplier and heal items an amount', () => {
    for (const def of Object.values(ITEMS)) {
      if (def.kind === 'sigil') expect(def.catchMult).toBeGreaterThan(0);
      if (def.kind === 'heal') expect(def.heal).toBeGreaterThan(0);
    }
  });

  it('trainer teams use real species and looks', () => {
    for (const t of Object.values(TRAINERS)) {
      expect(LOOKS[t.look]).toBeDefined();
      expect(t.team.length).toBeGreaterThan(0);
      for (const m of t.team) expect(SPECIES[m.species]).toBeDefined();
    }
  });

  it('game text is plain ASCII so the pixel font can render it', () => {
    const strings: string[] = [];
    for (const id of SPECIES_IDS) strings.push(SPECIES[id].name, SPECIES[id].dex);
    for (const id of MOVE_IDS) strings.push(MOVES[id].name, MOVES[id].desc);
    for (const def of Object.values(ITEMS)) strings.push(def.name, def.desc);
    for (const t of Object.values(TRAINERS)) strings.push(t.name, t.intro, t.defeat, t.after);
    for (const s of Object.values(SPEAKERS)) strings.push(s.name);
    for (const s of strings) expect(s, s).toMatch(/^[\x20-\x7e]*$/);
  });
});
