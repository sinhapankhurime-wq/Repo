# Code guide

Pactbound is TypeScript on [Phaser 4](https://phaser.io/), built with Vite and tested with Vitest. The rules
of the game (battles, familiars, saving) are plain TypeScript with no Phaser dependency, so they can be unit
tested; Phaser only draws and plays them back.

## The big picture

```
            ┌──────────── Phaser scenes (src/scenes) ─────────────┐
 Boot ──▶ Title ──▶ World ◀──────▶ UI (always on top: dialogue, fades, choices)
                     │  ▲
                     │  └── Battle  (launched by World, which sleeps meanwhile)
                     │  └── Menu    (pause menu: familiars, bag, journal, save)
                     │  └── Ending  (chapter card)
                     │
         runs story scripts (src/story) through the ScriptApi
                     │
       reads and writes session.state (src/core) ◀── saved to localStorage
```

- **`session.state`** (`src/core/session.ts`, shape in `src/core/state.ts`) is the single source of truth: map,
  position, party, bag, marks, flags, Devotion/Clarity, bestiary. It is plain JSON, which is exactly what gets
  saved.
- **The battle engine** (`src/battle/engine.ts`) resolves a whole turn and returns a list of `BattleEvent`s
  (`text`, `cast`, `damage`, `faint`, `sigil`, `levelUp`...). `BattleScene` plays them back one at a time with
  animations. The engine never waits or draws, so a test can run a whole battle in a millisecond with a seeded
  RNG.
- **Story scripts** are async functions that receive a `ScriptApi` (`src/story/api.ts`): `say`, `choose`,
  `battle`, `bind`, `give`, `walkPath`, `emote`, `fadeOut`, `vignette` and so on. Branching is just `if`.

## Folder by folder

| Folder | What lives there |
|---|---|
| `src/data` | Content tables: arcana chart, spells, familiars, items, trainers, the cast (looks and name colours). |
| `src/core` | `Familiar` (stats, XP, learning, ascension), `GameState`, save/load with validation, seeded RNG. |
| `src/battle` | `engine.ts` (turn resolution), `formulas.ts` (damage, catch, XP, flee), `ai.ts`. |
| `src/world` | Map definitions (`maps/`), tile behaviour (`tiles.ts`), the `Actor` class (walking people). |
| `src/story` | `chapter1.ts` (every Chapter One script), `flags.ts`, `api.ts`, `common.ts` (trainer duels). |
| `src/scenes` | Phaser scenes. `WorldScene` also implements the ScriptApi. |
| `src/ui` | `DialogueBox`, `ListMenu` (lists and grids with a cursor), `PartyPanel`, drawing helpers. |
| `src/gfx` | Procedural art: `people.ts` + `peopleData.ts`, `familiars.ts`, `tiles.ts`, `textures.ts`. |
| `src/audio` | `sound.ts` (WebAudio synth and sound effects), `tracks.ts` (the music, as text). |
| `src/input` | `controls.ts` (virtual buttons, key mapping, auto-repeat), `touch.ts` (on-screen pad). |
| `tests` | Unit tests for data integrity, formulas, the engine, familiars, maps and saves. |

## How to...

### Add a familiar

1. Add its id to `SpeciesId` and an entry to `SPECIES` in `src/data/species.ts` (arcana, base stats, catch
   rate, learnset, optional `evolves`, bestiary text).
2. Draw it: add an entry to `FAMILIAR_ART` in `src/gfx/familiars.ts`. Art is a list of shapes (`E` ellipse,
   `C` circle, `P` polygon, `L` thick line, `R` rectangle) on a 48×48 canvas, **facing left**, feet near y = 45,
   plus `details` (eyes, dots, hearts) drawn on top. Shading, contact shadows and the outline are automatic.
3. Run `npm run dev` and open `/gallery.html` to see it next to the others.
4. Put it in an encounter table (`encounters` in a map file) or a trainer team.

`npm test` checks that learnsets use real spells, that evolutions point at real species, and that all text is
plain ASCII (the pixel font has no curly quotes).

### Add a spell

Add an entry to `src/data/moves.ts`. Effects are data: `status` (with a chance), `stat` (self or foe, stages,
chance), `heal` (fraction of max HP) and `drain` (fraction of damage dealt). Status spells have power 0.

### Add or change a map

Maps are rows of characters in `src/world/maps/`. The legend and what is solid or walkable is in
`src/world/tiles.ts`; how each tile is drawn is in `src/gfx/tiles.ts`. A map also lists:

- `warps`: stepping on (x, y) moves to another map. Every door tile needs one.
- `npcs`: who stands where, with a `talk` script id or a `trainer` id, and an optional `when(state)`.
- `things`: things to inspect (bookshelves, beds, signs), optionally with a sprite.
- `pickups`: items on the ground (each id is remembered once collected).
- `triggers`: scripts that run when stepping on a tile.
- `encounters`: wild familiar tables and rates.
- `onEnter`: a script id run every time the map is entered.

`tests/maps.test.ts` checks that rows are rectangular, tiles exist, doors have warps, warps land on walkable
tiles and nobody stands inside a wall.

### Add a character

Add a look to `LOOKS` in `src/data/cast.ts` (hairstyle `long`, `swept`, `bob`, `bun` or `short`; outfit
`skirt`, `pants` or `robe`; colours; optional ribbon, scarf, glasses, beard). The 16×24 walking sprite sheet
is generated from the templates in `src/gfx/peopleData.ts`. Add a speaker name and colour to `SPEAKERS` if they
talk.

### Write a scene

Scripts are async functions in `src/story/` registered by id in `src/story/scripts.ts`:

```ts
async function moonlitBalcony(s: ScriptApi): Promise<void> {
  s.music('lucien');
  await s.vignette(true);
  await s.say('lucien', 'You came.');
  const pick = await s.choose(['"I always do."', '"Tamsin is waiting for me."']);
  if (pick === 0) s.devotion(1);
  else s.clarity(1);
  await s.whisper('lucien', 'Of course she is.');
  await s.vignette(false);
  s.set('balconyScene');
}
```

Useful calls: `think` (Wren's inner voice), `whisper` (Lucien leaning close), `narrate` (text on black),
`curtain` (black behind the dialogue box), `spawn`/`despawn`/`actor(id).walkPath([...])`, `emote`, `panTo`,
`shake`, `setTime('day' | 'dusk' | 'night')`, `battle({...})` (returns `'win' | 'lose' | 'fled' | 'caught'`),
`bind(species, level)`, `give(item, qty)`, `heal()`, `objective(text)`, `save()`.

Use `when: (s) => ...` on NPCs and things (helpers `has`, `lacks`, `all` in `src/story/flags.ts`) to make the
world change as the story moves on. `refresh()` re-checks them in the middle of a script.

### Add a chapter

Create `src/story/chapter2.ts` exporting a `Record<string, Script>`, spread it into `SCRIPTS`, add new flags to
`flags.ts`, and gate the new NPCs and things on `chapterOneDone`. Update `EndingScene` for the new card.

### Change the music

Each track in `src/audio/tracks.ts` is a few channels of space-separated notes: `A4`, `C#5`, `Bb3`, `-` to hold,
`.` for silence, `|` as a bar line (ignored); noise channels use `k`, `s` and `h`. Maps choose a track with
`music`; scripts can override it with `s.music('lucien')`.

## Input model

`controls.ts` turns keys and touch into virtual buttons (`up`, `down`, `left`, `right`, `a`, `b`, `menu`). Presses
are collected between frames and published at the start of each frame (Phaser's `PRE_STEP`). Code that wants a
button calls `controls.consume('a')`, which takes the press so that only one consumer reacts. Async UI code
(dialogue, menus) waits frame by frame with `nextFrame(scene)` and polls the same way.

## Saving

`saveGame` writes `session.state` as JSON to `localStorage` under `pactbound.save` (or to memory when storage is
blocked). `parseSave` validates everything on load: unknown familiars, spells and items are dropped, fields
added in later versions are filled from `newGame()`, and saves from a newer version are rejected. Bump
`SAVE_VERSION` in `src/core/state.ts` when the shape changes incompatibly.

## Testing

- `npm test`: 78 unit tests across data, formulas, familiars, the engine, maps and saves.
- `npm run typecheck`: strict TypeScript.
- `/gallery.html` (dev server only): every familiar, character sheet and map, rendered from code.
- `window.pactbound` exposes `{ game, session }` in the browser console for poking at state while playing.

## Known limitations

- Only Chapter One exists; storage (familiars bound while the party is full) has no in-game UI yet; Wren keeps
  them in `state.storage`.
- No nicknames, no held items, no double battles.
- Music and effects are synthesised, so they sound slightly different between browsers.
- The production bundle is about 1.5 MB (420 KB gzipped), almost all of it Phaser.
