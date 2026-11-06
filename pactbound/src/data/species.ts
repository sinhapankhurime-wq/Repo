import type { Arcana } from './arcana';
import type { MoveId } from './moves';

export type SpeciesId =
  | 'kettlepup' | 'samovarf'
  | 'quillpus' | 'scriptopus'
  | 'budmouse' | 'briarmaus'
  | 'tomelet' | 'glimmoth' | 'flittermouse' | 'grimlet'
  | 'puffwisp' | 'mycelf' | 'blotling' | 'dearling'
  | 'umbrasp';

export interface BaseStats {
  hp: number;
  pow: number;
  grd: number;
  spd: number;
}

/** Experience curve: total XP needed for level n is n^3 scaled by this factor. */
export type Growth = 'fast' | 'medium' | 'slow';

export interface SpeciesDef {
  name: string;
  types: readonly Arcana[];
  base: BaseStats;
  /** 1 (nearly impossible to bind) .. 255 (binds easily). */
  catchRate: number;
  /** Base XP awarded for defeating one. */
  xpYield: number;
  growth: Growth;
  /** [level, move] pairs, in level order. */
  learnset: readonly (readonly [number, MoveId])[];
  /** "Ascension": the familiar becomes `to` on reaching `level`. */
  evolves?: { to: SpeciesId; level: number };
  /** Bestiary entry. */
  dex: string;
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  // ── Tutelary familiars (the three starters) ──────────────────────────
  kettlepup: {
    name: 'Kettlepup', types: ['ember'],
    base: { hp: 46, pow: 54, grd: 42, spd: 50 }, catchRate: 45, xpYield: 62, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'hiss'], [7, 'cinderFlick'], [10, 'kettleWhistle'], [13, 'steamPuff'], [19, 'hearthfire']],
    evolves: { to: 'samovarf', level: 16 },
    dex: 'A puppy whose belly is a warm copper kettle. It whistles when it is happy, which is nearly always.',
  },
  samovarf: {
    name: 'Samovarf', types: ['ember'],
    base: { hp: 72, pow: 84, grd: 70, spd: 64 }, catchRate: 45, xpYield: 150, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'hiss'], [7, 'cinderFlick'], [10, 'kettleWhistle'], [13, 'steamPuff'], [19, 'hearthfire'], [24, 'bulwark']],
    dex: 'Proud and patient. It keeps tea hot for its pactbinder through the longest winter nights.',
  },
  quillpus: {
    name: 'Quillpus', types: ['tide'],
    base: { hp: 50, pow: 48, grd: 50, spd: 44 }, catchRate: 45, xpYield: 62, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'hiss'], [7, 'inkSpurt'], [10, 'inkCloud'], [13, 'riptide'], [19, 'tidalVerse']],
    evolves: { to: 'scriptopus', level: 16 },
    dex: 'A little octopus with a quill for a crest. It writes on any surface it can reach, mostly love letters to teacups.',
  },
  scriptopus: {
    name: 'Scriptopus', types: ['tide'],
    base: { hp: 82, pow: 74, grd: 78, spd: 56 }, catchRate: 45, xpYield: 150, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'hiss'], [7, 'inkSpurt'], [10, 'inkCloud'], [13, 'riptide'], [19, 'tidalVerse'], [24, 'arcaneBolt']],
    dex: "It has memorised every book in the Thornveil library and corrects its pactbinder's spelling. Constantly.",
  },
  budmouse: {
    name: 'Budmouse', types: ['bloom'],
    base: { hp: 44, pow: 46, grd: 44, spd: 58 }, catchRate: 45, xpYield: 62, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'fluffUp'], [7, 'petalToss'], [10, 'nectarSip'], [13, 'thornLash'], [19, 'sporeLull']],
    evolves: { to: 'briarmaus', level: 16 },
    dex: 'The bud on its head opens only for someone it truly trusts. Most pactbinders never see it bloom.',
  },
  briarmaus: {
    name: 'Briarmaus', types: ['bloom'],
    base: { hp: 66, pow: 78, grd: 62, spd: 86 }, catchRate: 45, xpYield: 150, growth: 'medium',
    learnset: [[1, 'pounce'], [1, 'fluffUp'], [7, 'petalToss'], [10, 'nectarSip'], [13, 'thornLash'], [19, 'sporeLull'], [24, 'quickwind']],
    dex: 'A tiny knight sworn to its pactbinder. It duels with a rose thorn and never, ever retreats.',
  },

  // ── Wild familiars of Thornveil ──────────────────────────────────────
  tomelet: {
    name: 'Tomelet', types: ['arcane'],
    base: { hp: 42, pow: 46, grd: 52, spd: 34 }, catchRate: 190, xpYield: 48, growth: 'medium',
    learnset: [[1, 'pounce'], [3, 'hiss'], [6, 'snapSpell'], [11, 'arcaneBolt']],
    dex: 'A living spellbook that escaped the restricted section. It bites readers who dog-ear its pages.',
  },
  glimmoth: {
    name: 'Glimmoth', types: ['lumen', 'gale'],
    base: { hp: 38, pow: 42, grd: 36, spd: 62 }, catchRate: 180, xpYield: 52, growth: 'medium',
    learnset: [[1, 'flutter'], [4, 'glimmer'], [8, 'lanternLull'], [13, 'moonbeam']],
    dex: 'Drawn to candlelight and lonely students. It glows brighter near anyone who is homesick.',
  },
  flittermouse: {
    name: 'Flittermouse', types: ['umbra', 'gale'],
    base: { hp: 36, pow: 46, grd: 32, spd: 66 }, catchRate: 190, xpYield: 50, growth: 'medium',
    learnset: [[1, 'flutter'], [3, 'shadeNip'], [7, 'doubtSeed'], [11, 'quickwind']],
    dex: 'It roosts in the bell tower and repeats the secrets it overhears, but only in the dark.',
  },
  grimlet: {
    name: 'Grimlet', types: ['stone'],
    base: { hp: 50, pow: 54, grd: 64, spd: 22 }, catchRate: 150, xpYield: 60, growth: 'medium',
    learnset: [[1, 'pounce'], [3, 'bulwark'], [6, 'pebblePelt'], [12, 'rubbleCrush']],
    dex: 'A baby gargoyle. It sits so still on the rooftops that students forget it is there. It never forgets them.',
  },
  puffwisp: {
    name: 'Puffwisp', types: ['gale'],
    base: { hp: 36, pow: 36, grd: 32, spd: 56 }, catchRate: 210, xpYield: 40, growth: 'fast',
    learnset: [[1, 'flutter'], [4, 'quickwind'], [7, 'hiss'], [10, 'galeSlice']],
    dex: 'A dandelion seed that found a soul. It follows kind people home and refuses to leave.',
  },
  mycelf: {
    name: 'Mycelf', types: ['bloom', 'umbra'],
    base: { hp: 48, pow: 44, grd: 48, spd: 34 }, catchRate: 170, xpYield: 56, growth: 'medium',
    learnset: [[1, 'pounce'], [3, 'nectarSip'], [6, 'sporeLull'], [10, 'shadeNip']],
    dex: 'It grows in rings beneath the Gloamwood oaks. Step inside a ring and it will try to keep you.',
  },
  blotling: {
    name: 'Blotling', types: ['tide', 'umbra'],
    base: { hp: 54, pow: 42, grd: 44, spd: 36 }, catchRate: 180, xpYield: 54, growth: 'medium',
    learnset: [[1, 'inkSpurt'], [4, 'inkCloud'], [8, 'shadeNip'], [12, 'riptide']],
    dex: 'An inkblot that crawled off an unfinished love letter. It is still waiting for someone to sign it.',
  },
  dearling: {
    name: 'Dearling', types: ['heart'],
    base: { hp: 52, pow: 44, grd: 50, spd: 58 }, catchRate: 30, xpYield: 90, growth: 'slow',
    learnset: [[1, 'pounce'], [1, 'tenderHum'], [5, 'heartstring'], [10, 'starryEyes'], [16, 'devotion']],
    dex: 'A shy fawn with heart-shaped dapples. It bonds once in its life, and never forgives betrayal.',
  },

  // ── House Ravelle ────────────────────────────────────────────────────
  umbrasp: {
    name: 'Umbrasp', types: ['umbra'],
    base: { hp: 56, pow: 72, grd: 52, spd: 74 }, catchRate: 25, xpYield: 120, growth: 'slow',
    learnset: [[1, 'shadeNip'], [1, 'doubtSeed'], [6, 'velvetVenom'], [18, 'eclipseFang']],
    dex: 'A velvet-black asp bred by House Ravelle. Its gaze is soothing. That is how it gets close.',
  },
};

export function species(id: SpeciesId): SpeciesDef {
  return SPECIES[id];
}

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
