import type { LookId } from './cast';
import type { SpeciesId } from './species';

export interface TrainerDef {
  /** Display name in battle, e.g. "Second-year Bram". */
  name: string;
  look: LookId;
  team: readonly { species: SpeciesId; level: number }[];
  /** Marks paid out on defeat. */
  reward: number;
  ai: 'random' | 'smart';
  /** Spoken before the duel. */
  intro: string;
  /** Spoken in battle when beaten. */
  defeat: string;
  /** Spoken when talked to after being beaten. */
  after: string;
}

/** Optional duels around the academy. Story duels (Tamsin, Lucien) are built in src/story. */
const TRAINER_TABLE = {
  bram: {
    name: 'Second-year Bram', look: 'studentA', reward: 120, ai: 'random',
    team: [{ species: 'flittermouse', level: 5 }, { species: 'tomelet', level: 6 }],
    intro: "You're the scholarship girl? Everyone says the wild ones just... follow you. Prove it!",
    defeat: "Okay, okay! You're the real thing.",
    after: "Watch out for the mushroom rings out here. The Mycelfs bite. Affectionately. Mostly.",
  },
  ivy: {
    name: 'Second-year Ivy', look: 'studentE', reward: 140, ai: 'smart',
    team: [{ species: 'puffwisp', level: 6 }, { species: 'mycelf', level: 7 }],
    intro: "So you're the one Lucien Ravelle keeps staring at. Let's see what he sees in you.",
    defeat: "Huh. Maybe it isn't just your pretty face.",
    after: "Careful, sweetheart. The last girl Lucien took an interest in... well. Ask Seraphine how that went.",
  },
  rowan: {
    name: 'Bookish Rowan', look: 'studentC', reward: 130, ai: 'random',
    team: [{ species: 'tomelet', level: 6 }, { species: 'tomelet', level: 7 }],
    intro: "Shh! This is a library. ...Fine. A very quiet duel.",
    defeat: "That was extremely loud.",
    after: "The restricted section's been locked all term. Lucien has a key, naturally. Ravelles have keys to everything.",
  },
  corin: {
    name: 'Duelist Corin', look: 'studentA', reward: 180, ai: 'smart',
    team: [{ species: 'grimlet', level: 7 }, { species: 'glimmoth', level: 8 }],
    intro: "After dark this hall belongs to Lucien's circle. In daylight, it's mine. En garde!",
    defeat: "Ugh! Lucien said you were special. I hate it when he's right.",
    after: "Nobody beats Lucien in this hall. Nobody. Not since his second year.",
  },
} satisfies Record<string, TrainerDef>;

export type TrainerId = keyof typeof TRAINER_TABLE;
export const TRAINERS: Record<TrainerId, TrainerDef> = TRAINER_TABLE;
