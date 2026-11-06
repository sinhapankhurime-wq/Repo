import { describe, expect, it } from 'vitest';
import { createFamiliar } from '../src/core/familiar';
import { loadGame, memoryStore, parseSave, saveGame, SAVE_KEY } from '../src/core/save';
import { addFamiliar, addItem, MAX_PARTY, newGame, removeItem, setFlag } from '../src/core/state';

describe('save / load', () => {
  it('round-trips a game', () => {
    const store = memoryStore();
    const s = newGame();
    s.party.push(createFamiliar('quillpus', 7));
    addItem(s, 'sigil', 3);
    setFlag(s, 'metLucien');
    s.devotion = 2;
    expect(saveGame(s, store)).toBe(true);
    const back = loadGame(store);
    expect(back?.party[0]?.species).toBe('quillpus');
    expect(back?.bag.sigil).toBe(3);
    expect(back?.flags.metLucien).toBe(true);
    expect(back?.devotion).toBe(2);
  });

  it('rejects corrupt or future saves', () => {
    expect(parseSave('not json')).toBeNull();
    expect(parseSave('42')).toBeNull();
    expect(parseSave(JSON.stringify({ ...newGame(), version: 999 }))).toBeNull();
  });

  it('drops unknown familiars and items instead of crashing', () => {
    const s = newGame() as unknown as Record<string, unknown>;
    s.party = [createFamiliar('tomelet', 3), { uid: 'x', species: 'missingno', level: 1, hp: 1, xp: 0, moves: [] }];
    s.bag = { tonic: 2, mysteryBox: 5 };
    const back = parseSave(JSON.stringify(s));
    expect(back?.party).toHaveLength(1);
    expect(back?.bag).toEqual({ tonic: 2 });
  });

  it('fills fields missing from older saves', () => {
    const store = memoryStore();
    const old = newGame() as unknown as Record<string, unknown>;
    delete old.clarity;
    store.setItem(SAVE_KEY, JSON.stringify(old));
    expect(loadGame(store)?.clarity).toBe(0);
  });
});

describe('inventory and party', () => {
  it('adds and removes items', () => {
    const s = newGame();
    addItem(s, 'tonic', 2);
    expect(removeItem(s, 'tonic')).toBe(true);
    expect(removeItem(s, 'tonic', 5)).toBe(false);
    expect(removeItem(s, 'tonic')).toBe(true);
    expect(s.bag.tonic).toBeUndefined();
  });

  it('sends familiars to storage when the party is full', () => {
    const s = newGame();
    for (let i = 0; i < MAX_PARTY; i++) expect(addFamiliar(s, createFamiliar('puffwisp', 3))).toBe('party');
    expect(addFamiliar(s, createFamiliar('dearling', 3))).toBe('storage');
    expect(s.caught).toContain('dearling');
  });
});
