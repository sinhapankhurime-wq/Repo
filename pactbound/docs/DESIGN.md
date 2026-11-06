# Game design: rules and numbers

Every number here comes from the code; the file that owns each rule is named so it can be changed in one place.
The familiar and spell tables were generated from `src/data/species.ts` and `src/data/moves.ts`.

## Arcana (types)

Nine arcana, defined in `src/data/arcana.ts`. A familiar has one or two; a spell has one. Against a dual-arcana
familiar the two multipliers are multiplied together (so x4 and x0.25 are possible).

Multiplier when an attack of the **row** arcana hits a familiar of the **column** arcana (blank = x1):

| Attack ↓ / Defender → | Arcane | Ember | Tide | Bloom | Gale | Stone | Lumen | Umbra | Heart |
|---|---|---|---|---|---|---|---|---|---|
| **Arcane** | | | | | | | | | |
| **Ember** | | ½ | ½ | 2 | | ½ | | 2 | |
| **Tide** | | 2 | ½ | ½ | | 2 | | | |
| **Bloom** | | ½ | 2 | ½ | ½ | 2 | | | |
| **Gale** | | | 2 | 2 | ½ | ½ | | | |
| **Stone** | | 2 | | ½ | 2 | ½ | | | |
| **Lumen** | | | | ½ | 2 | | ½ | 2 | |
| **Umbra** | | ½ | | | | | 2 | ½ | 2 |
| **Heart** | | | | | | 2 | | 2 | ½ |

Design intent:

- **Ember → Bloom → Tide → Ember** is the starter triangle.
- **Gale and Stone** check each other and the triangle.
- **Umbra and Heart are each other's weakness.** Lucien's familiars are Umbra; the rare Dearling is Heart.
- **Arcane** is neutral to everything, in both directions.

## Stats

`src/core/familiar.ts`. Four stats: HP, Power, Guard, Speed. Stats grow linearly with level (max level 50):

| Stat | Formula |
|---|---|
| HP | floor(2 × base × level / 50) + level + 10 |
| Power, Guard, Speed | floor(2 × base × level / 50) + 5 |

Example: Kettlepup (base HP 46) at level 5 has floor(2 × 46 × 5 / 50) + 5 + 10 = **24 HP**.

### Experience

Total XP needed to *be* at level *n* = factor × n³:

| Growth | Factor | XP for level 10 | XP for level 16 |
|---|---:|---:|---:|
| Fast | 0.8 | 800 | 3,276 |
| Medium | 1.0 | 1,000 | 4,096 |
| Slow | 1.25 | 1,250 | 5,120 |

XP for defeating a familiar = floor(xpYield × foe level / 7), × 1.5 in a student duel. It is shared equally
among every familiar that faced that foe and is still standing (`src/battle/formulas.ts`, `src/battle/engine.ts`).

New spells are learned at the levels in each learnset. With four spells already known, the player chooses one to
forget, or skips. Starters **ascend** (evolve) at level 16; current HP rises by the max-HP gain.

## Battles

Rules live in `src/battle/engine.ts`; formulas in `src/battle/formulas.ts`.

### Turn order

1. Fleeing, switching and items always go first.
2. Then spells by **priority** (only Snap Spell has +1), then by Speed (after stat stages), ties random.
3. End of turn: Scorch and Blight damage.

### Damage

```
base   = (0.4 × level + 2) × power × (Power ÷ Guard) ÷ 25 + 2
damage = floor(base × affinity × effectiveness × critical × roll), minimum 1
```

| Modifier | Value |
|---|---|
| Affinity (spell matches one of the caster's arcana) | x1.25 |
| Effectiveness | from the arcana table |
| Critical hit (1 in 16) | x1.5 |
| Roll | random 0.85 to 1.00 |
| Scorched attacker | Power x0.75 |

Example: level 5, power 40, equal Power and Guard, neutral, no affinity, top roll: (2 + 2) × 40 ÷ 25 + 2 = 8.4 → **8**.

### Stat stages

Spells raise or lower Power, Guard or Speed by stages from -6 to +6. Multiplier = (2 + s) ÷ 2 for s ≥ 0, and
2 ÷ (2 − s) for s < 0, so +2 doubles a stat and -2 halves it. Stages reset when a familiar is switched out.

### Status ailments

A familiar can have one ailment at a time. They last after battle until cured (rest, Honey Remedy).

| Ailment | Effect | Duration |
|---|---|---|
| Scorched | Loses 1/16 of max HP each turn; Power x0.75. Ember familiars are immune. | Until cured |
| Blighted | Loses 1/10 of max HP each turn | Until cured |
| Drowsy | Cannot act | 1 to 3 turns |
| Charmed | 1 in 3 chance each turn to lose the turn daydreaming | 2 to 4 turns |

### Binding (catching)

Only wild familiars can be bound; students' familiars cannot.

```
chance = catchRate/255 × (1 − 2/3 × HP/maxHP) × sigil × ailment × Heartbloom    (clamped to 1%–100%)
```

| Factor | Value |
|---|---|
| Pact Sigil / Silver Sigil | x1 / x1.6 |
| Drowsy or Charmed / Scorched or Blighted | x1.6 / x1.25 |
| Heartbloom (Wren, always) | x1.25 |

The sigil glows up to three times; each glow holds with probability ∛chance, so three glows means success and
the number of glows shows how close it was. A familiar at 1 HP is three times easier to bind than one at full HP.

### Fleeing

Always succeeds if your familiar is at least as fast. Otherwise the chance is
0.3 + 0.6 × (your Speed ÷ foe Speed) + 0.15 per earlier failed attempt. Duels cannot be fled.

### AI

`src/battle/ai.ts`. **Random** (wild familiars, Tamsin, Bram, Rowan) picks any spell with uses left. **Smart**
(Ivy, Corin, Lucien) scores spells by expected damage, always takes a knockout, values ailments and stat
changes when they would help, and does something unexpected 20% of the time.

### Losing

In ordinary fights, if every familiar faints Wren wakes up in the dormitory, fully healed, with nothing lost.
Story duels (Tamsin, Lucien) continue the story either way.

## Familiars

Base stats from `src/data/species.ts`. Catch rate runs from 1 (nearly impossible) to 255 (easy).

| Familiar | Arcana | HP | Power | Guard | Speed | Total | Catch rate (1–255) | Growth | Ascends into |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Kettlepup | Ember | 46 | 54 | 42 | 50 | 192 | 45 | medium | Samovarf at Lv 16 |
| Samovarf | Ember | 72 | 84 | 70 | 64 | 290 | 45 | medium | — |
| Quillpus | Tide | 50 | 48 | 50 | 44 | 192 | 45 | medium | Scriptopus at Lv 16 |
| Scriptopus | Tide | 82 | 74 | 78 | 56 | 290 | 45 | medium | — |
| Budmouse | Bloom | 44 | 46 | 44 | 58 | 192 | 45 | medium | Briarmaus at Lv 16 |
| Briarmaus | Bloom | 66 | 78 | 62 | 86 | 292 | 45 | medium | — |
| Tomelet | Arcane | 42 | 46 | 52 | 34 | 174 | 190 | medium | — |
| Glimmoth | Lumen / Gale | 38 | 42 | 36 | 62 | 178 | 180 | medium | — |
| Flittermouse | Umbra / Gale | 36 | 46 | 32 | 66 | 180 | 190 | medium | — |
| Grimlet | Stone | 50 | 54 | 64 | 22 | 190 | 150 | medium | — |
| Puffwisp | Gale | 36 | 36 | 32 | 56 | 160 | 210 | fast | — |
| Mycelf | Bloom / Umbra | 48 | 44 | 48 | 34 | 174 | 170 | medium | — |
| Blotling | Tide / Umbra | 54 | 42 | 44 | 36 | 176 | 180 | medium | — |
| Dearling | Heart | 52 | 44 | 50 | 58 | 204 | 30 | slow | — |
| Umbrasp | Umbra | 56 | 72 | 52 | 74 | 254 | 25 | slow | — |

Where they live:

| Place | Familiars (levels) | Chance per step |
|---|---|---|
| Gloamwood mistgrass | Puffwisp 30% (3–5), Mycelf 25% (3–6), Flittermouse 20% (4–6), Blotling 15% (4–6), Tomelet 10% (3–5) | 11% |
| Gloamwood shrine clearing | Glimmoth 50% (5–7), Puffwisp 35% (5–7), **Dearling 15% (5–6)** | 14% |
| Story | Kettlepup, Quillpus or Budmouse (starter, Lv 5); Grimlet (calmed in the courtyard, Lv 5) | |
| Lucien only | Umbrasp | |

Encounters only happen on mistgrass, and never within two steps of the last battle.

## Spells

From `src/data/moves.ts`. "Uses" is how many times a spell can be cast before resting. A familiar with no uses
left on any spell will **Flail** (power 30, never misses).

| Spell | Arcana | Power | Accuracy | Uses | Priority | Effect |
|---|---|---:|---:|---:|---:|---|
| Pounce | Arcane | 40 | 100% | 35 | 0 | A playful leap. Every familiar knows this one. |
| Hiss | Arcane | — | 100% | 30 | 0 | A warning hiss. Lowers the foe's Power. |
| Fluff Up | Arcane | — | never misses | 25 | 0 | Puffs up adorably. Raises Guard. |
| Snap Spell | Arcane | 40 | 100% | 20 | +1 | A hasty cantrip that always strikes first. |
| Arcane Bolt | Arcane | 65 | 95% | 15 | 0 | A crackling bolt from the first page of every spellbook. |
| Flail | Arcane | 30 | never misses | 999 | 0 | Out of spells, it flails wildly. |
| Cinder Flick | Ember | 40 | 100% | 25 | 0 | Flicks a hot cinder. May scorch the foe. |
| Kettle Whistle | Ember | — | 90% | 15 | 0 | A shrill whistle that rattles the foe. Sharply lowers its Guard. |
| Steam Puff | Ember | 55 | 95% | 20 | 0 | A scalding puff of steam. May lower Speed. |
| Hearthfire | Ember | 75 | 90% | 10 | 0 | The roaring warmth of a home fire. May scorch the foe. |
| Ink Spurt | Tide | 40 | 100% | 25 | 0 | Squirts a jet of enchanted ink. |
| Ink Cloud | Tide | — | 90% | 20 | 0 | Sticky ink gums up the foe. Sharply lowers its Speed. |
| Riptide | Tide | 65 | 95% | 15 | 0 | A pulling current that drags the foe under. |
| Tidal Verse | Tide | 80 | 90% | 10 | 0 | Recites a poem so moving the sea answers it. |
| Petal Toss | Bloom | 40 | 100% | 25 | 0 | Tosses a flurry of sharp petals. |
| Nectar Sip | Bloom | 35 | 100% | 15 | 0 | Sips the foe's vigour. Heals half the damage dealt. |
| Thorn Lash | Bloom | 65 | 95% | 15 | 0 | Whips the foe with a thorned vine. |
| Spore Lull | Bloom | — | 75% | 10 | 0 | A puff of sleepy spores. Makes the foe drowsy. |
| Flutter | Gale | 40 | 100% | 30 | 0 | A buffeting flurry of wings. |
| Quickwind | Gale | — | never misses | 15 | 0 | Rides a tail wind. Sharply raises Speed. |
| Gale Slice | Gale | 60 | 95% | 15 | 0 | A blade of compressed wind. |
| Pebble Pelt | Stone | 40 | 95% | 25 | 0 | Pelts the foe with chipped masonry. |
| Bulwark | Stone | — | never misses | 15 | 0 | Turns to stone for a moment. Sharply raises Guard. |
| Rubble Crush | Stone | 75 | 85% | 10 | 0 | Drops a shower of rubble. Hard to aim. |
| Glimmer | Lumen | 40 | 100% | 25 | 0 | A dazzling flash of soft light. |
| Lantern Lull | Lumen | — | 70% | 10 | 0 | A swaying glow that makes the foe drowsy. |
| Moonbeam | Lumen | 65 | 95% | 15 | 0 | A cold shaft of moonlight. May lower Guard. |
| Shade Nip | Umbra | 40 | 100% | 25 | 0 | A quick bite from the dark. |
| Doubt Seed | Umbra | — | 90% | 15 | 0 | Whispers that plant doubt. Sharply lowers the foe's Power. |
| Velvet Venom | Umbra | 55 | 95% | 15 | 0 | A bite that feels like a kiss. May blight the foe. |
| Eclipse Fang | Umbra | 80 | 90% | 10 | 0 | Fangs that swallow the light. |
| Tender Hum | Heart | — | never misses | 10 | 0 | Hums a lullaby. Restores half its max HP. |
| Heartstring | Heart | 45 | 100% | 20 | 0 | Plucks at the foe's heart. May charm it. |
| Starry Eyes | Heart | — | 80% | 10 | 0 | A look so earnest the foe forgets to fight. Charms it. |
| Devotion | Heart | 75 | 95% | 10 | 0 | Everything it has, for the one it loves. |

## Items

`src/data/items.ts`. Prices are in marks; Wren starts with 300.

| Item | Effect | Price |
|---|---|---:|
| Moonmilk Tonic | Restores 25 HP | 60 |
| Starlight Draught | Restores 60 HP | 150 |
| Honey Remedy | Cures any ailment | 80 |
| Pact Sigil | Offers your pact to a wild familiar (x1) | 100 |
| Silver Sigil | Better sigil (x1.6). Found in the Gloamwood. | not sold |
| Raven Latch-Charm | Key item: found by the fountain | |
| Silver Pact-Ribbon | Key item: Lucien's gift | |

## Duels

| Student | Where | Team | Reward (marks) | AI |
|---|---|---|---:|---|
| Tamsin (story) | Conservatory | The starter that counters yours, Lv 5 | 0 | Random |
| Second-year Bram | Gloamwood | Flittermouse 5, Tomelet 6 | 120 | Random |
| Second-year Ivy | Gloamwood | Puffwisp 6, Mycelf 7 | 140 | Smart |
| Bookish Rowan | Library | Tomelet 6, Tomelet 7 | 130 | Random |
| Duelist Corin | Dueling Hall (until the library scene) | Grimlet 7, Glimmoth 8 | 180 | Smart |
| Lucien (story) | Dueling Hall, at night | Flittermouse 7, Umbrasp 9 | 300 | Smart |

## Healing

Wren's bed in the dormitory (also offers to save), Professor Finch in the Conservatory, and the old shrine in the
Gloamwood all fully heal the party.
