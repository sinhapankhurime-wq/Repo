import { effectiveness } from '../data/arcana';
import { ITEMS, type ItemId } from '../data/items';
import { MOVES, STAT_NAMES, STATUS_INFO, type MoveId, type StatKey, type StatusId } from '../data/moves';
import { SPECIES } from '../data/species';
import { displayName, gainXp, healHp, isFainted, maxHp, stats, type Familiar, type Stats } from '../core/familiar';
import { createRng, type Rng } from '../core/rng';
import { chooseMove, type AiLevel } from './ai';
import {
  calcDamage,
  catchChance,
  CRIT_CHANCE,
  fleeChance,
  rollCatch,
  SCORCH_POWER_MULT,
  STAGE_LIMIT,
  stageMultiplier,
  xpReward,
} from './formulas';

export type Side = 'player' | 'foe';
export type Outcome = 'win' | 'lose' | 'fled' | 'caught';

export type PlayerAction =
  | { kind: 'move'; slot: number }
  | { kind: 'switch'; index: number }
  /** `target` is a party index for healing items; ignored for sigils. */
  | { kind: 'item'; item: ItemId; target?: number }
  | { kind: 'flee' };

/**
 * Everything that happens in a turn, in order. The engine never animates or
 * waits; the BattleScene plays these back one at a time.
 */
export type BattleEvent =
  | { t: 'text'; text: string }
  | { t: 'cast'; side: Side; move: MoveId }
  | { t: 'damage'; side: Side; amount: number; hp: number; effectiveness: number; crit: boolean }
  | { t: 'heal'; side: Side; amount: number; hp: number }
  | { t: 'miss'; side: Side }
  | { t: 'status'; side: Side; status: StatusId | null }
  | { t: 'stat'; side: Side; stat: StatKey; change: number }
  | { t: 'faint'; side: Side }
  | { t: 'sendOut'; side: Side; index: number }
  | { t: 'recall'; side: Side; index: number }
  | { t: 'sigil'; item: ItemId; shakes: number; success: boolean }
  | { t: 'xp'; index: number; amount: number }
  | { t: 'levelUp'; index: number; level: number }
  | { t: 'learned'; index: number; move: MoveId }
  /** All four slots are full: the scene asks which move to forget. */
  | { t: 'learnPrompt'; index: number; move: MoveId }
  | { t: 'end'; outcome: Outcome };

export interface BattleConfig {
  kind: 'wild' | 'trainer';
  /** The player's live party. Damage, XP and spell uses are written straight onto it. */
  player: Familiar[];
  foe: Familiar[];
  /** e.g. "Tamsin". Required for trainer battles. */
  trainerName?: string;
  ai?: AiLevel;
  /** Wren's catch bonus. */
  heartbloom?: boolean;
  /** Who is giving orders on the player's side (used in battle text). */
  playerName?: string;
  rng?: Rng;
}

export interface SideState {
  party: Familiar[];
  active: number;
  stages: Record<StatKey, number>;
}

const freshStages = (): Record<StatKey, number> => ({ pow: 0, grd: 0, spd: 0 });
export const other = (s: Side): Side => (s === 'player' ? 'foe' : 'player');
const text = (t: string): BattleEvent => ({ t: 'text', text: t });

const STATUS_VERB: Record<StatusId, string> = {
  scorch: 'was scorched!',
  blight: 'was blighted!',
  drowse: 'grew drowsy...',
  charm: 'is utterly charmed!',
};

export class Battle {
  readonly kind: 'wild' | 'trainer';
  readonly trainerName: string;
  readonly playerName: string;
  readonly heartbloom: boolean;
  readonly ai: AiLevel;
  readonly rng: Rng;
  readonly player: SideState;
  readonly foe: SideState;

  outcome: Outcome | null = null;
  /** The player's familiar fainted and another must be sent out before the next turn. */
  mustSwitch = false;
  /** Set when a sigil succeeds. The scene adds it to the party. */
  caught: Familiar | null = null;
  turn = 0;

  private fleeAttempts = 0;
  /** Party indices that have faced the current foe; they share its XP. */
  private participants = new Set<number>();
  private announcedFaints = new Set<string>();

  constructor(cfg: BattleConfig) {
    if (cfg.foe.length === 0) throw new Error('Battle needs at least one foe');
    const first = cfg.player.findIndex((f) => !isFainted(f));
    if (first < 0) throw new Error('Battle needs a healthy familiar on the player side');
    this.kind = cfg.kind;
    this.trainerName = cfg.trainerName ?? 'The foe';
    this.playerName = cfg.playerName ?? 'Wren';
    this.heartbloom = cfg.heartbloom ?? false;
    this.ai = cfg.ai ?? (cfg.kind === 'wild' ? 'random' : 'smart');
    this.rng = cfg.rng ?? createRng();
    this.player = { party: cfg.player, active: first, stages: freshStages() };
    this.foe = { party: cfg.foe, active: 0, stages: freshStages() };
    this.participants.add(first);
  }

  side(s: Side): SideState {
    return s === 'player' ? this.player : this.foe;
  }

  active(s: Side): Familiar {
    const st = this.side(s);
    return st.party[st.active] as Familiar;
  }

  get playerActive(): Familiar {
    return this.active('player');
  }

  get foeActive(): Familiar {
    return this.active('foe');
  }

  /** How a familiar is named in battle text. */
  label(s: Side): string {
    const n = displayName(this.active(s));
    if (s === 'player') return n;
    return this.kind === 'wild' ? `Wild ${n}` : `${this.trainerName}'s ${n}`;
  }

  /** Stats after stage multipliers. */
  effectiveStats(s: Side): Stats {
    const base = stats(this.active(s));
    const st = this.side(s).stages;
    return {
      hp: base.hp,
      pow: base.pow * stageMultiplier(st.pow),
      grd: base.grd * stageMultiplier(st.grd),
      spd: base.spd * stageMultiplier(st.spd),
    };
  }

  /** Average-roll, non-crit damage estimate; used by the AI. */
  estimateDamage(s: Side, id: MoveId): number {
    const mv = MOVES[id];
    if (mv.power <= 0) return 0;
    const user = this.active(s);
    const target = this.active(other(s));
    const eff = effectiveness(mv.type, SPECIES[target.species].types);
    const atk = this.effectiveStats(s).pow * (user.status === 'scorch' ? SCORCH_POWER_MULT : 1);
    return calcDamage({
      level: user.level,
      power: mv.power,
      attack: atk,
      guard: this.effectiveStats(other(s)).grd,
      affinity: SPECIES[user.species].types.includes(mv.type),
      effectiveness: eff,
      crit: false,
      roll: 0.925,
    });
  }

  canSwitchTo(index: number): boolean {
    const f = this.player.party[index];
    return !!f && !isFainted(f) && index !== this.player.active;
  }

  /** Opening lines and send-outs. */
  begin(): BattleEvent[] {
    const ev: BattleEvent[] = [];
    ev.push({ t: 'sendOut', side: 'foe', index: this.foe.active });
    if (this.kind === 'wild') {
      ev.push(text(`A wild ${displayName(this.foeActive)} appeared!`));
    } else {
      ev.push(text(`${this.trainerName} challenges you to a duel!`));
      ev.push(text(`${this.trainerName} sends out ${displayName(this.foeActive)}!`));
    }
    ev.push(text(`Go, ${displayName(this.playerActive)}!`));
    ev.push({ t: 'sendOut', side: 'player', index: this.player.active });
    return ev;
  }

  /** Resolves one full turn: the player's action, the foe's reply, then end-of-turn effects. */
  act(action: PlayerAction): BattleEvent[] {
    if (this.outcome || this.mustSwitch) return [];
    const ev: BattleEvent[] = [];
    if (action.kind === 'flee' && this.kind !== 'wild') {
      ev.push(text("There's no running from a duel!"));
      return ev;
    }
    if (action.kind === 'switch' && !this.canSwitchTo(action.index)) return [];
    if (action.kind === 'item' && ITEMS[action.item].kind === 'sigil' && this.kind !== 'wild') {
      ev.push(text("You can't bind another student's familiar!"));
      return ev;
    }

    this.turn += 1;
    const playerUid = this.playerActive.uid;
    const foeUid = this.foeActive.uid;
    const foeSlot = chooseMove(this, 'foe', this.ai, this.rng);

    type Step = { side: Side; priority: number; speed: number; run: () => void };
    const steps: Step[] = [];
    if (action.kind === 'move') {
      steps.push({
        side: 'player',
        priority: MOVES[this.moveIn('player', action.slot)].priority ?? 0,
        speed: this.effectiveStats('player').spd,
        run: () => this.useMove('player', action.slot, playerUid, ev),
      });
    } else {
      // Fleeing, switching and items always happen before any spell is cast.
      steps.push({ side: 'player', priority: 100, speed: Infinity, run: () => this.nonMoveAction(action, ev) });
    }
    steps.push({
      side: 'foe',
      priority: MOVES[this.moveIn('foe', foeSlot)].priority ?? 0,
      speed: this.effectiveStats('foe').spd,
      run: () => this.useMove('foe', foeSlot, foeUid, ev),
    });
    const tiebreak = this.rng.next() < 0.5 ? -1 : 1;
    steps.sort((a, b) => b.priority - a.priority || b.speed - a.speed || tiebreak);

    for (const step of steps) {
      if (this.outcome) break;
      step.run();
      this.resolveFaints(ev);
    }
    if (!this.outcome) this.endOfTurn(ev);
    return ev;
  }

  /** Sends out a replacement after the player's familiar fainted. The foe does not get a free hit. */
  replace(index: number): BattleEvent[] {
    if (!this.mustSwitch || !this.canSwitchTo(index)) return [];
    this.mustSwitch = false;
    this.player.active = index;
    this.player.stages = freshStages();
    this.participants.add(index);
    return [text(`Go, ${displayName(this.playerActive)}!`), { t: 'sendOut', side: 'player', index }];
  }

  // ── internals ───────────────────────────────────────────────────────

  /** The move a slot resolves to; an empty or exhausted slot means Flail. */
  private moveIn(s: Side, slot: number): MoveId {
    const m = this.active(s).moves[slot];
    return m && m.uses > 0 ? m.id : 'flail';
  }

  private nonMoveAction(action: PlayerAction, ev: BattleEvent[]): void {
    if (action.kind === 'flee') {
      this.fleeAttempts += 1;
      const p = fleeChance({
        playerSpd: this.effectiveStats('player').spd,
        foeSpd: this.effectiveStats('foe').spd,
        attempts: this.fleeAttempts,
      });
      if (this.rng.next() < p) {
        ev.push(text(`${this.playerName} slipped away safely!`));
        this.finish('fled', ev);
      } else {
        ev.push(text("Couldn't get away!"));
      }
    } else if (action.kind === 'switch') {
      ev.push(text(`Come back, ${displayName(this.playerActive)}!`));
      ev.push({ t: 'recall', side: 'player', index: this.player.active });
      this.player.active = action.index;
      this.player.stages = freshStages();
      this.participants.add(action.index);
      ev.push(text(`Go, ${displayName(this.playerActive)}!`));
      ev.push({ t: 'sendOut', side: 'player', index: action.index });
    } else if (action.kind === 'item') {
      this.useItem(action.item, action.target ?? this.player.active, ev);
    }
  }

  private useItem(id: ItemId, target: number, ev: BattleEvent[]): void {
    const def = ITEMS[id];
    if (def.kind === 'heal' || def.kind === 'cure') {
      const f = this.player.party[target];
      if (!f) return;
      ev.push(text(`${this.playerName} used a ${def.name}.`));
      if (def.kind === 'heal') {
        const amount = healHp(f, def.heal ?? 0);
        if (target === this.player.active) ev.push({ t: 'heal', side: 'player', amount, hp: f.hp });
        ev.push(text(amount > 0 ? `${displayName(f)} recovered ${amount} HP!` : 'It had no effect...'));
      } else {
        const had = f.status;
        f.status = null;
        f.statusTurns = 0;
        if (target === this.player.active) ev.push({ t: 'status', side: 'player', status: null });
        ev.push(text(had ? `${displayName(f)} feels much better!` : 'It had no effect...'));
      }
      return;
    }
    if (def.kind === 'sigil') {
      const foe = this.foeActive;
      const chance = catchChance({
        catchRate: SPECIES[foe.species].catchRate,
        hp: foe.hp,
        maxHp: maxHp(foe),
        sigilMult: def.catchMult ?? 1,
        status: foe.status,
        heartbloom: this.heartbloom,
      });
      const { shakes, success } = rollCatch(chance, this.rng);
      ev.push(text(`${this.playerName} traced a ${def.name}!`));
      ev.push({ t: 'sigil', item: id, shakes, success });
      if (success) {
        this.caught = foe;
        ev.push(text(`${displayName(foe)} accepted the pact!`));
        this.finish('caught', ev);
      } else {
        ev.push(text(['It shrugged the sigil off!', 'It broke free!', 'Almost! The pact nearly held!'][Math.min(shakes, 2)] as string));
      }
      return;
    }
    ev.push(text("This isn't the time for that."));
  }

  private useMove(s: Side, slot: number, expectedUid: string, ev: BattleEvent[]): void {
    const user = this.active(s);
    const target = this.active(other(s));
    // Fainted, or replaced earlier this turn: no action.
    if (user.uid !== expectedUid || isFainted(user) || isFainted(target)) return;
    const who = this.label(s);

    if (user.status === 'drowse') {
      if (user.statusTurns > 0) {
        user.statusTurns -= 1;
        ev.push(text(`${who} is drowsing...`));
        return;
      }
      user.status = null;
      ev.push({ t: 'status', side: s, status: null });
      ev.push(text(`${who} woke up!`));
    } else if (user.status === 'charm') {
      user.statusTurns -= 1;
      if (user.statusTurns <= 0) {
        user.status = null;
        user.statusTurns = 0;
        ev.push({ t: 'status', side: s, status: null });
        ev.push(text(`${who} snapped out of the charm!`));
      } else if (this.rng.chance(1 / 3)) {
        ev.push(text(`${who} is lost in a daydream...`));
        return;
      }
    }

    const id = this.moveIn(s, slot);
    const mv = MOVES[id];
    if (id === 'flail') {
      ev.push(text(`${who} has no spells left!`));
    } else {
      const slotRef = user.moves[slot];
      if (slotRef) slotRef.uses -= 1;
    }
    ev.push(text(`${who} cast ${mv.name}!`));
    ev.push({ t: 'cast', side: s, move: id });

    if (mv.accuracy !== null && this.rng.next() * 100 >= mv.accuracy) {
      ev.push({ t: 'miss', side: s });
      ev.push(text('But it missed!'));
      return;
    }

    let dealt = 0;
    if (mv.power > 0) {
      const eff = effectiveness(mv.type, SPECIES[target.species].types);
      if (eff === 0) {
        ev.push(text('It had no effect...'));
        return;
      }
      const crit = this.rng.next() < CRIT_CHANCE;
      const roll = 0.85 + this.rng.next() * 0.15;
      const atk = this.effectiveStats(s).pow * (user.status === 'scorch' ? SCORCH_POWER_MULT : 1);
      const dmg = calcDamage({
        level: user.level,
        power: mv.power,
        attack: atk,
        guard: this.effectiveStats(other(s)).grd,
        affinity: SPECIES[user.species].types.includes(mv.type),
        effectiveness: eff,
        crit,
        roll,
      });
      dealt = Math.min(dmg, target.hp);
      target.hp -= dealt;
      ev.push({ t: 'damage', side: other(s), amount: dealt, hp: target.hp, effectiveness: eff, crit });
      if (crit) ev.push(text('A critical hit!'));
      if (eff > 1) ev.push(text("It's devastatingly effective!"));
      else if (eff < 1) ev.push(text('It was resisted...'));
    }

    for (const e of mv.effects ?? []) {
      switch (e.kind) {
        case 'drain': {
          if (dealt <= 0 || isFainted(user)) break;
          const amount = healHp(user, Math.max(1, Math.floor(dealt * e.fraction)));
          if (amount > 0) {
            ev.push({ t: 'heal', side: s, amount, hp: user.hp });
            ev.push(text(`${who} drank in ${amount} HP!`));
          }
          break;
        }
        case 'heal': {
          const amount = healHp(user, Math.floor(maxHp(user) * e.fraction));
          if (amount > 0) {
            ev.push({ t: 'heal', side: s, amount, hp: user.hp });
            ev.push(text(`${who} recovered ${amount} HP!`));
          } else {
            ev.push(text(`${who} is already at full health!`));
          }
          break;
        }
        case 'status': {
          if (isFainted(target)) break;
          if (mv.power > 0 && !this.rng.chance(e.chance / 100)) break;
          this.applyStatus(other(s), e.status, ev, mv.power === 0);
          break;
        }
        case 'stat': {
          const tgt = e.target === 'self' ? s : other(s);
          if (isFainted(this.active(tgt))) break;
          if (e.chance < 100 && !this.rng.chance(e.chance / 100)) break;
          this.changeStage(tgt, e.stat, e.stages, ev);
          break;
        }
      }
    }
  }

  private applyStatus(s: Side, status: StatusId, ev: BattleEvent[], announceFailure: boolean): void {
    const f = this.active(s);
    if (f.status) {
      if (announceFailure) ev.push(text(`${this.label(s)} is already ${STATUS_INFO[f.status].name.toLowerCase()}.`));
      return;
    }
    if (status === 'scorch' && SPECIES[f.species].types.includes('ember')) {
      if (announceFailure) ev.push(text(`${this.label(s)} can't be scorched!`));
      return;
    }
    f.status = status;
    f.statusTurns = status === 'drowse' ? this.rng.int(1, 3) : status === 'charm' ? this.rng.int(2, 4) : 0;
    ev.push({ t: 'status', side: s, status });
    ev.push(text(`${this.label(s)} ${STATUS_VERB[status]}`));
  }

  private changeStage(s: Side, stat: StatKey, delta: number, ev: BattleEvent[]): void {
    const stages = this.side(s).stages;
    const before = stages[stat];
    const after = Math.max(-STAGE_LIMIT, Math.min(STAGE_LIMIT, before + delta));
    const name = `${this.label(s)}'s ${STAT_NAMES[stat]}`;
    if (after === before) {
      ev.push(text(`${name} won't go any ${delta > 0 ? 'higher' : 'lower'}!`));
      return;
    }
    stages[stat] = after;
    const change = after - before;
    ev.push({ t: 'stat', side: s, stat, change });
    const word = change >= 2 ? 'rose sharply!' : change > 0 ? 'rose!' : change <= -2 ? 'fell sharply!' : 'fell!';
    ev.push(text(`${name} ${word}`));
  }

  private endOfTurn(ev: BattleEvent[]): void {
    for (const s of ['player', 'foe'] as const) {
      if (this.outcome) return;
      const f = this.active(s);
      if (isFainted(f) || (f.status !== 'scorch' && f.status !== 'blight')) continue;
      const fraction = f.status === 'scorch' ? 1 / 16 : 1 / 10;
      const amount = Math.min(f.hp, Math.max(1, Math.floor(maxHp(f) * fraction)));
      f.hp -= amount;
      ev.push(text(`${this.label(s)} is hurt by its ${f.status === 'scorch' ? 'burns' : 'blight'}!`));
      ev.push({ t: 'damage', side: s, amount, hp: f.hp, effectiveness: 1, crit: false });
      this.resolveFaints(ev);
    }
  }

  private resolveFaints(ev: BattleEvent[]): void {
    const foe = this.foeActive;
    if (isFainted(foe) && !this.announcedFaints.has(foe.uid)) {
      this.announcedFaints.add(foe.uid);
      ev.push(text(`${this.label('foe')} fainted!`));
      ev.push({ t: 'faint', side: 'foe' });
      this.awardXp(foe, ev);
      const next = this.foe.party.findIndex((f) => !isFainted(f));
      if (next >= 0) {
        this.foe.active = next;
        this.foe.stages = freshStages();
        this.participants = new Set(isFainted(this.playerActive) ? [] : [this.player.active]);
        ev.push(text(`${this.trainerName} sends out ${displayName(this.foeActive)}!`));
        ev.push({ t: 'sendOut', side: 'foe', index: next });
      } else {
        if (this.kind === 'trainer') ev.push(text(`You won the duel against ${this.trainerName}!`));
        this.finish('win', ev);
      }
    }
    const mine = this.playerActive;
    if (isFainted(mine) && !this.announcedFaints.has(mine.uid)) {
      this.announcedFaints.add(mine.uid);
      ev.push(text(`${displayName(mine)} fainted!`));
      ev.push({ t: 'faint', side: 'player' });
      this.participants.delete(this.player.active);
      if (this.outcome) return;
      if (this.player.party.some((f) => !isFainted(f))) {
        this.mustSwitch = true;
      } else {
        ev.push(text(`${this.playerName} has no familiars left who can fight...`));
        this.finish('lose', ev);
      }
    }
  }

  private awardXp(defeated: Familiar, ev: BattleEvent[]): void {
    const total = xpReward({
      xpYield: SPECIES[defeated.species].xpYield,
      foeLevel: defeated.level,
      trainer: this.kind === 'trainer',
    });
    const earners = [...this.participants].filter((i) => {
      const f = this.player.party[i];
      return !!f && !isFainted(f);
    });
    if (earners.length === 0) return;
    const share = Math.max(1, Math.ceil(total / earners.length));
    for (const i of earners) {
      const f = this.player.party[i] as Familiar;
      ev.push(text(`${displayName(f)} gained ${share} XP!`));
      ev.push({ t: 'xp', index: i, amount: share });
      const res = gainXp(f, share);
      for (const level of res.levels) {
        ev.push({ t: 'levelUp', index: i, level });
        ev.push(text(`${displayName(f)} grew to level ${level}!`));
      }
      for (const m of res.learned) {
        ev.push({ t: 'learned', index: i, move: m });
        ev.push(text(`${displayName(f)} learned ${MOVES[m].name}!`));
      }
      for (const m of res.pending) ev.push({ t: 'learnPrompt', index: i, move: m });
    }
  }

  private finish(outcome: Outcome, ev: BattleEvent[]): void {
    this.outcome = outcome;
    ev.push({ t: 'end', outcome });
  }
}
