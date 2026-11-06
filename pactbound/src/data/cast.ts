/**
 * Who's who at Thornveil: speaker names, name-plate colours and how each
 * character is drawn in the overworld (see src/gfx/people.ts).
 */
export type HairStyle = 'long' | 'swept' | 'bob' | 'bun' | 'short';
export type Outfit = 'skirt' | 'pants' | 'robe';

export interface Look {
  style: HairStyle;
  outfit: Outfit;
  hair: number;
  skin: number;
  eyes: number;
  /** Blazer / robe colour. */
  top: number;
  /** Cuff and lapel trim. */
  trim: number;
  /** Shirt collar showing under the blazer. */
  shirt: number;
  /** Skirt, trousers or robe hem. */
  bottom: number;
  /** Stockings or trouser legs. */
  legs: number;
  shoes: number;
  ribbon?: number;
  scarf?: number;
  glasses?: boolean;
  beard?: boolean;
}

// The Thornveil uniform: plum blazer with gold trim, cream shirt, burgundy plaid.
const UNIFORM = { top: 0x4a3b63, trim: 0xe3c46f, shirt: 0xf3ead8, bottom: 0x8a3a4a, shoes: 0x3a2a2a } as const;

const LOOK_TABLE = {
  wren: { ...UNIFORM, style: 'long', outfit: 'skirt', hair: 0xe9b872, skin: 0xf6d5c0, eyes: 0x4f8a5b, legs: 0xf3ead8, ribbon: 0xf2a7bf },
  lucien: {
    style: 'swept', outfit: 'pants', hair: 0x2b2536, skin: 0xf0d2c4, eyes: 0xa36be0,
    top: 0x1e1a26, trim: 0xd9b25c, shirt: 0xe8e2ef, bottom: 0x1e1a26, legs: 0x1e1a26, shoes: 0x0f0d12,
  },
  tamsin: { ...UNIFORM, style: 'bob', outfit: 'skirt', hair: 0xd0602e, skin: 0xf3c9a8, eyes: 0x6b4a2b, legs: 0x2b2333, scarf: 0xe8833a },
  finch: {
    style: 'short', outfit: 'robe', hair: 0xd9d4cc, skin: 0xeec4a6, eyes: 0x3b3b5a,
    top: 0x3f6a4f, trim: 0xc9a24a, shirt: 0xe8e0cc, bottom: 0x3f6a4f, legs: 0x3f6a4f, shoes: 0x4a3326, glasses: true, beard: true,
  },
  seraphine: {
    style: 'long', outfit: 'skirt', hair: 0xd8cfe8, skin: 0xf2dcd6, eyes: 0x8aa0c8,
    top: 0x4b4856, trim: 0x8f8a9c, shirt: 0xe6e1ea, bottom: 0x3d3a48, legs: 0x22202a, shoes: 0x1b1a20,
  },
  quire: {
    style: 'bun', outfit: 'robe', hair: 0x8b8b9a, skin: 0xeccab0, eyes: 0x4a3a2a,
    top: 0x5a3b4a, trim: 0xb08a5a, shirt: 0xe8dccc, bottom: 0x4a3040, legs: 0x4a3040, shoes: 0x2a2020, glasses: true,
  },
  tallow: {
    style: 'short', outfit: 'pants', hair: 0x5b3a26, skin: 0xe2b08c, eyes: 0x3a2a1a,
    top: 0x7a5a3a, trim: 0xd8c8a0, shirt: 0xe8dcc0, bottom: 0x4a3a2e, legs: 0x4a3a2e, shoes: 0x2a2018, beard: true,
  },
  studentA: { ...UNIFORM, style: 'short', outfit: 'pants', hair: 0x2a2220, skin: 0xd9a27e, eyes: 0x3a2a1a, legs: 0x8a3a4a },
  studentB: { ...UNIFORM, style: 'bob', outfit: 'skirt', hair: 0x6b4430, skin: 0xf3cfb3, eyes: 0x4a6a8a, legs: 0x2b2333 },
  studentC: { ...UNIFORM, style: 'short', outfit: 'pants', hair: 0xe8d088, skin: 0xf6d8c4, eyes: 0x5a7ab0, legs: 0x8a3a4a },
  studentD: { ...UNIFORM, style: 'long', outfit: 'skirt', hair: 0x1e1a22, skin: 0xc68a64, eyes: 0x3a2418, legs: 0x2b2333 },
  studentE: { ...UNIFORM, style: 'bun', outfit: 'skirt', hair: 0x9a5a8a, skin: 0xf0c8b0, eyes: 0x5a3a6a, legs: 0xf3ead8 },
} satisfies Record<string, Look>;

export type LookId = keyof typeof LOOK_TABLE;
export const LOOKS: Record<LookId, Look> = LOOK_TABLE;

export interface Speaker {
  name: string;
  /** Name-plate colour in dialogue. */
  color: number;
}

const SPEAKER_TABLE = {
  wren: { name: 'Wren', color: 0xf2a7bf },
  lucien: { name: 'Lucien', color: 0xa36be0 },
  tamsin: { name: 'Tamsin', color: 0xe8833a },
  finch: { name: 'Prof. Finch', color: 0x7fbf8a },
  seraphine: { name: 'Seraphine', color: 0xb8c8e8 },
  quire: { name: 'Madam Quire', color: 0xc9a0b0 },
  tallow: { name: 'Mr. Tallow', color: 0xd8b070 },
  student: { name: 'Student', color: 0xa8a0b8 },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKER_TABLE;
export const SPEAKERS: Record<SpeakerId, Speaker> = SPEAKER_TABLE;
