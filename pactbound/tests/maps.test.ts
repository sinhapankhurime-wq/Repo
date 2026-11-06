import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/data/species';
import { TRAINERS } from '../src/data/trainers';
import { MAPS } from '../src/world/maps';
import { tileInfo, TILES } from '../src/world/tiles';
import type { MapDef } from '../src/world/types';

const at = (m: MapDef, x: number, y: number) => m.rows[y]?.[x] ?? ' ';
const walkable = (m: MapDef, x: number, y: number) => !tileInfo(at(m, x, y)).solid;

describe.each(Object.values(MAPS))('map $id', (m) => {
  it('is rectangular and uses only known tiles', () => {
    const w = m.rows[0]!.length;
    m.rows.forEach((r, y) => expect(r.length, `row ${y}`).toBe(w));
    for (const r of m.rows) for (const ch of r) expect(TILES[ch], `tile '${ch}'`).toBeDefined();
    expect(TILES[m.ground]).toBeDefined();
  });

  it('has warps on walkable tiles that land on walkable tiles', () => {
    for (const wp of m.warps) {
      expect(walkable(m, wp.x, wp.y), `warp from ${wp.x},${wp.y}`).toBe(true);
      const dest = MAPS[wp.to];
      expect(dest, wp.to).toBeDefined();
      expect(walkable(dest, wp.tx, wp.ty), `landing ${wp.to} ${wp.tx},${wp.ty}`).toBe(true);
    }
  });

  it('every door tile has a warp', () => {
    m.rows.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (tileInfo(ch).door) expect(m.warps.some((wp) => wp.x === x && wp.y === y), `door at ${x},${y}`).toBe(true);
      }),
    );
  });

  it('places people and pick-ups on walkable tiles', () => {
    for (const n of m.npcs) {
      expect(walkable(m, n.x, n.y), `${n.id} at ${n.x},${n.y} (${at(m, n.x, n.y)})`).toBe(true);
      if (n.trainer) expect(TRAINERS[n.trainer]).toBeDefined();
    }
    for (const p of m.pickups) expect(walkable(m, p.x, p.y), `pickup ${p.id}`).toBe(true);
  });

  it('has valid encounter tables', () => {
    for (const z of m.encounters) {
      expect(z.rate).toBeGreaterThan(0);
      expect(z.rate).toBeLessThan(1);
      for (const e of z.table) {
        expect(SPECIES[e.species]).toBeDefined();
        expect(e.min).toBeLessThanOrEqual(e.max);
      }
    }
  });
});

it('pick-up ids are unique across the game', () => {
  const ids = Object.values(MAPS).flatMap((m) => m.pickups.map((p) => p.id));
  expect(new Set(ids).size).toBe(ids.length);
});
