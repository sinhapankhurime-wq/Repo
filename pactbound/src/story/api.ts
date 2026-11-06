import type { Sfx } from '../audio/sound';
import type { AiLevel } from '../battle/ai';
import type { Outcome } from '../battle/engine';
import type { Familiar } from '../core/familiar';
import type { Dir, FlagValue, GameState } from '../core/state';
import type { LookId, Speaker, SpeakerId } from '../data/cast';
import type { ItemId } from '../data/items';
import type { SpeciesId } from '../data/species';
import type { LineStyle } from '../ui/DialogueBox';
import type { Emote } from '../world/Actor';
import type { BattleBg, MapId, TrackId } from '../world/types';
import type { TimeOfDay } from './flags';

/** A character a script can direct. */
export interface ActorHandle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Dir;
  face(dir: Dir): void;
  /** Moves instantly (use while the screen is dark). */
  place(x: number, y: number, dir?: Dir): void;
  walkPath(dirs: readonly Dir[], seconds?: number): Promise<void>;
  emote(kind: Emote): Promise<void>;
}

export interface BattleRequest {
  kind: 'wild' | 'trainer';
  foe: Familiar[];
  trainerName?: string;
  trainerLook?: LookId;
  ai?: AiLevel;
  /** Story duels: losing does not send Wren back to bed. */
  canLose?: boolean;
  /** Marks paid on a win. */
  reward?: number;
  bg?: BattleBg;
  music?: TrackId;
  /** What the trainer says, in battle, when they lose / when they win. */
  loseLine?: string;
  winLine?: string;
}

/**
 * Everything a story script can do. Scripts are plain async functions, so
 * branching is ordinary TypeScript:
 *
 *   const pick = await s.choose(['Hum softly', 'Hold out your hand']);
 *   if (pick === 0) s.clarity(1);
 */
export interface ScriptApi {
  readonly state: GameState;

  say(who: SpeakerId | Speaker | null, text: string, style?: LineStyle): Promise<void>;
  /** Wren's inner voice. */
  think(text: string): Promise<void>;
  /** A line spoken too close for comfort. */
  whisper(who: SpeakerId, text: string): Promise<void>;
  choose(options: string[], cancelIndex?: number): Promise<number>;
  narrate(paragraphs: string[], opts?: { keepDark?: boolean; title?: boolean }): Promise<void>;
  wait(seconds: number): Promise<void>;
  fadeOut(ms?: number): Promise<void>;
  fadeIn(ms?: number): Promise<void>;
  closeDialogue(): void;

  flag(key: string): FlagValue | undefined;
  has(key: string): boolean;
  set(key: string, value?: FlagValue): void;
  /** Wren falls further for Lucien. Shows a floating heart. */
  devotion(n: number): void;
  /** Wren sees him a little more clearly. Shows a floating spark. */
  clarity(n: number): void;
  objective(text: string): void;

  give(item: ItemId, qty?: number): Promise<void>;
  /** Forms a pact with a familiar outside battle (story gifts, starters). */
  bind(species: SpeciesId, level: number): Promise<Familiar>;
  heal(): Promise<void>;
  battle(req: BattleRequest): Promise<Outcome>;
  /** Every familiar fainted: Wren wakes up in the dormitory, fully healed. */
  blackout(): Promise<void>;
  /** A black backdrop *under* the dialogue box, for scenes told over darkness. */
  curtain(on: boolean, ms?: number): Promise<void>;
  shop(): Promise<void>;

  player: ActorHandle;
  actor(id: string): ActorHandle | null;
  spawn(id: string, look: LookId, x: number, y: number, dir: Dir): ActorHandle;
  despawn(id: string): void;
  /** Re-checks who should be standing where (after flags change). */
  refresh(): void;
  panTo(x: number, y: number, ms?: number): Promise<void>;
  panBack(ms?: number): Promise<void>;
  shake(ms?: number, intensity?: number): void;
  music(track: TrackId | null): void;
  sfx(name: Sfx): void;
  vignette(on: boolean): Promise<void>;
  setTime(t: TimeOfDay): void;
  warp(map: MapId, x: number, y: number, dir: Dir): Promise<void>;
  save(): boolean;
  chapterEnd(): Promise<void>;
}

export type Script = (s: ScriptApi) => Promise<void>;
