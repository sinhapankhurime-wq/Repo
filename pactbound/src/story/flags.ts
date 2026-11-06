import { getFlag, hasFlag, type GameState } from '../core/state';

/**
 * Chapter 1 story flags. Values are booleans unless noted.
 * See docs/STORY.md for when each one is set.
 */
export const F = {
  introDone: 'introDone',
  /** Species id of Wren's tutelary familiar. */
  starter: 'starter',
  /** 'won' | 'lost' */
  tamsinDuel: 'tamsinDuel',
  grimletDone: 'grimletDone',
  restedFirstNight: 'restedFirstNight',
  libraryScene: 'libraryScene',
  metSeraphine: 'metSeraphine',
  /** 'won' | 'lost' */
  lucienDuel: 'lucienDuel',
  /** true: let him tie it. false: politely refused. */
  ribbonAccepted: 'ribbonAccepted',
  returnedCharm: 'returnedCharm',
  grimletCalmed: 'grimletCalmed',
  finchWelcome: 'finchWelcome',
  dormChat: 'dormChat',
  promisedTamsin: 'promisedTamsin',
  toldTamsin: 'toldTamsin',
  nightTalked: 'nightTalked',
  chapterOneDone: 'chapterOneDone',
  /** 'dusk' | 'day' | 'night' */
  time: 'time',
} as const;

export type TimeOfDay = 'dusk' | 'day' | 'night';

export function timeOfDay(s: GameState): TimeOfDay {
  const t = getFlag(s, F.time);
  return t === 'day' || t === 'night' ? t : 'dusk';
}

export const has = (key: string) => (s: GameState) => hasFlag(s, key);
export const lacks = (key: string) => (s: GameState) => !hasFlag(s, key);
export const all =
  (...preds: ((s: GameState) => boolean)[]) =>
  (s: GameState) =>
    preds.every((p) => p(s));
