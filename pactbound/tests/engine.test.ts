import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/battle/ai';
import { Battle, type BattleEvent } from '../src/battle/engine';
import { createFamiliar, maxHp, xpForLevel } from '../src/core/familiar';
import { fixedRng } from '../src/core/rng';

const texts = (ev: BattleEvent[]) => ev.filter((e) => e.t === 'text').map((e) => (e as { text: string }).text);
const of = <T extends BattleEvent['t']>(ev: BattleEvent[], t: T) =>
  ev.filter((e): e is Extract<BattleEvent, { t: T }> => e.t === t);

describe('Battle', () => {
  it('opens with send-outs and an introduction', () => {
    const b = new Battle({ kind: 'wild', player: [createFamiliar('kettlepup', 5)], foe: [createFamiliar('tomelet', 3)], rng: fixedRng(0.5) });
    const ev = b.begin();
    expect(texts(ev)[0]).toBe('A wild Tomelet appeared!');
    expect(of(ev, 'sendOut').map((e) => e.side)).toEqual(['foe', 'player']);
  });

  it('resolves a super-effective knockout and awards XP', () => {
    const pup = createFamiliar('kettlepup', 10);
    const b = new Battle({ kind: 'wild', player: [pup], foe: [createFamiliar('budmouse', 3)], rng: fixedRng(0.5) });
    const flick = pup.moves.findIndex((m) => m.id === 'cinderFlick');
    const usesBefore = pup.moves[flick]!.uses;
    const ev = b.act({ kind: 'move', slot: flick });
    const hit = of(ev, 'damage')[0]!;
    expect(hit.side).toBe('foe');
    expect(hit.effectiveness).toBe(2);
    expect(of(ev, 'faint')[0]?.side).toBe('foe');
    expect(of(ev, 'xp')[0]?.amount).toBeGreaterThan(0);
    expect(b.outcome).toBe('win');
    expect(pup.moves[flick]!.uses).toBe(usesBefore - 1);
  });

  it('lets priority moves go first and otherwise orders by speed', () => {
    const tome = createFamiliar('tomelet', 6); // knows Snap Spell (priority +1)
    const fast = createFamiliar('flittermouse', 20);
    const b1 = new Battle({ kind: 'wild', player: [tome], foe: [fast], rng: fixedRng(0.5) });
    const snap = tome.moves.findIndex((m) => m.id === 'snapSpell');
    expect(of(b1.act({ kind: 'move', slot: snap }), 'cast')[0]?.side).toBe('player');

    const b2 = new Battle({ kind: 'wild', player: [createFamiliar('tomelet', 6)], foe: [createFamiliar('flittermouse', 20)], rng: fixedRng(0.5) });
    expect(of(b2.act({ kind: 'move', slot: 0 }), 'cast')[0]?.side).toBe('foe');
  });

  it('binds a wild familiar with a sigil', () => {
    const foe = createFamiliar('tomelet', 3);
    const b = new Battle({ kind: 'wild', player: [createFamiliar('kettlepup', 5)], foe: [foe], heartbloom: true, rng: fixedRng(0) });
    const ev = b.act({ kind: 'item', item: 'sigil' });
    expect(of(ev, 'sigil')[0]).toMatchObject({ shakes: 3, success: true });
    expect(b.outcome).toBe('caught');
    expect(b.caught).toBe(foe);
    expect(of(ev, 'cast')).toHaveLength(0); // the foe never got to act
  });

  it('refuses to flee or bind during a duel without using up the turn', () => {
    const b = new Battle({ kind: 'trainer', trainerName: 'Tamsin', player: [createFamiliar('kettlepup', 5)], foe: [createFamiliar('quillpus', 5)], rng: fixedRng(0.5) });
    expect(texts(b.act({ kind: 'flee' }))).toEqual(["There's no running from a duel!"]);
    expect(texts(b.act({ kind: 'item', item: 'sigil' }))).toEqual(["You can't bind another student's familiar!"]);
    expect(b.turn).toBe(0);
    expect(b.outcome).toBeNull();
  });

  it('requires a replacement after a faint, and loses when nobody is left', () => {
    const weak = createFamiliar('tomelet', 2);
    weak.hp = 1;
    const backup = createFamiliar('grimlet', 10);
    const b = new Battle({ kind: 'wild', player: [weak, backup], foe: [createFamiliar('umbrasp', 30)], rng: fixedRng(0.5) });
    b.act({ kind: 'move', slot: 0 });
    expect(b.mustSwitch).toBe(true);
    expect(b.act({ kind: 'move', slot: 0 })).toEqual([]);
    expect(b.canSwitchTo(0)).toBe(false);
    const ev = b.replace(1);
    expect(of(ev, 'sendOut')[0]).toMatchObject({ side: 'player', index: 1 });
    expect(b.mustSwitch).toBe(false);
    backup.hp = 1;
    b.act({ kind: 'move', slot: 0 });
    expect(b.outcome).toBe('lose');
  });

  it('sends out the trainer’s next familiar, then ends the duel', () => {
    const first = createFamiliar('tomelet', 2);
    first.hp = 1;
    const second = createFamiliar('tomelet', 2);
    second.hp = 1;
    const b = new Battle({ kind: 'trainer', trainerName: 'Rowan', player: [createFamiliar('kettlepup', 10)], foe: [first, second], rng: fixedRng(0.5) });
    const ev1 = b.act({ kind: 'move', slot: 0 });
    expect(of(ev1, 'sendOut')[0]).toMatchObject({ side: 'foe', index: 1 });
    expect(texts(ev1)).toContain('Rowan sends out Tomelet!');
    expect(b.outcome).toBeNull();
    const ev2 = b.act({ kind: 'move', slot: 0 });
    expect(texts(ev2)).toContain('You won the duel against Rowan!');
    expect(b.outcome).toBe('win');
  });

  it('makes drowsy familiars skip turns, then wake', () => {
    const foe = createFamiliar('mycelf', 10);
    foe.status = 'drowse';
    foe.statusTurns = 1;
    const b = new Battle({ kind: 'wild', player: [createFamiliar('grimlet', 10)], foe: [foe], rng: fixedRng(0.5) });
    const bulwark = b.playerActive.moves.findIndex((m) => m.id === 'bulwark');
    expect(texts(b.act({ kind: 'move', slot: bulwark }))).toContain('Wild Mycelf is drowsing...');
    const ev = b.act({ kind: 'move', slot: bulwark });
    expect(texts(ev)).toContain('Wild Mycelf woke up!');
    expect(of(ev, 'cast').some((e) => e.side === 'foe')).toBe(true);
  });

  it('burns scorched familiars at the end of the turn', () => {
    const pup = createFamiliar('grimlet', 10);
    pup.status = 'scorch';
    const b = new Battle({ kind: 'wild', player: [pup], foe: [createFamiliar('puffwisp', 2)], rng: fixedRng(0.5) });
    const bulwark = pup.moves.findIndex((m) => m.id === 'bulwark');
    const ev = b.act({ kind: 'move', slot: bulwark });
    const burn = of(ev, 'damage').filter((e) => e.side === 'player').at(-1)!;
    expect(burn.amount).toBe(Math.floor(maxHp(pup) / 16));
  });

  it('clamps stat stages', () => {
    const b = new Battle({ kind: 'wild', player: [createFamiliar('kettlepup', 5)], foe: [createFamiliar('grimlet', 5)], rng: fixedRng(0.5) });
    b.foe.stages.pow = -6;
    const hiss = b.playerActive.moves.findIndex((m) => m.id === 'hiss');
    expect(texts(b.act({ kind: 'move', slot: hiss }))).toContain("Wild Grimlet's Power won't go any lower!");
  });

  it('levels up mid-battle and learns new moves', () => {
    const pup = createFamiliar('kettlepup', 6);
    pup.xp = xpForLevel('medium', 7) - 1;
    const foe = createFamiliar('puffwisp', 2);
    foe.hp = 1;
    const b = new Battle({ kind: 'wild', player: [pup], foe: [foe], rng: fixedRng(0.5) });
    const ev = b.act({ kind: 'move', slot: 0 });
    expect(of(ev, 'levelUp')[0]).toMatchObject({ index: 0, level: 7 });
    expect(of(ev, 'learned')[0]).toMatchObject({ move: 'cinderFlick' });
  });
});

describe('smart AI', () => {
  it('prefers the move that hits a weakness', () => {
    const foe = createFamiliar('kettlepup', 10, { moves: ['pounce', 'cinderFlick'] });
    const b = new Battle({ kind: 'trainer', trainerName: 'Corin', player: [createFamiliar('budmouse', 10)], foe: [foe], ai: 'smart', rng: fixedRng(0.9) });
    expect(chooseMove(b, 'foe', 'smart', fixedRng(0.9))).toBe(1);
  });

  it('goes for a finishing blow', () => {
    const target = createFamiliar('grimlet', 10);
    target.hp = 1;
    const foe = createFamiliar('umbrasp', 10, { moves: ['doubtSeed', 'shadeNip'] });
    const b = new Battle({ kind: 'trainer', trainerName: 'Lucien', player: [target], foe: [foe], ai: 'smart', rng: fixedRng(0.9) });
    expect(chooseMove(b, 'foe', 'smart', fixedRng(0.9))).toBe(1);
  });
});
