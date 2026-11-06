# Story bible

## Premise

Thornveil Academy has stood above the Gloamwood for three hundred years. Its students bind wild familiars with a
*pact*: a promise of trust, made and kept. House Ravelle funds almost everything at Thornveil. Three centuries
ago the Ravelles practised **Weaving**, binding familiars without their consent. Weaving was outlawed in 1702.
The Ravelles have been very generous to the academy ever since.

Wren Ashby is a farm girl with a gift nobody has had in 112 years: she is a **Heartbloom**. Wild familiars trust
her on sight. A Puffwisp followed her home for three weeks, and a scholarship letter arrived soon after.

Lucien Ravelle needs a Heartbloom. His father means to perform a binding at the **Eclipse Waltz**.

## Tone guide

- **Dark romance.** Lucien stays scheming and possessive; the tension between his manipulation and Wren's
  sweetness is the point. He is genuinely drawn to her, and that makes him more dangerous, not less.
- **Show, never narrate.** The game never labels his behaviour. Narration describes what happens ("his smile
  does not move at all"); the player draws the conclusion.
- **Sweet is not stupid.** Wren is kind, earnest and brave. Her sweetness is literally her power. Choices let
  the player decide how much she trusts him, never whether she is clever.
- **Teen rating.** Emotional manipulation, possessiveness, menace, implied cruelty to familiars. No explicit
  content and no graphic violence.
- **Visual language.** Lucien's scenes switch to his theme (a slow C-minor sigh), darken the screen edges, and
  his closest lines are "whispers" (rose-violet text, typed slower). His name plate is violet.

## Cast

| Character | Role | Notes |
|---|---|---|
| **Wren Ashby** | The heroine (player) | Scholarship first-year. Honey-blonde, pink ribbon. Heartbloom. Raised by her Gran, whose letter on the dorm desk reads: *"Kindness is a gift, not a debt."* |
| **Lucien Ravelle** | The male lead | Sixth-year prefect, heir of House Ravelle. Black hair, violet eyes, black-and-gold uniform. Familiar: Umbrasp (a velvet-black asp). Calls her "little wren". |
| **Tamsin Reyes** | Roommate and best friend | Loud, loyal, funny. Always picks the tutelary that counters Wren's. Sees through Lucien from the first minute. |
| **Prof. Hollis Finch** | Familiar Studies tutor | Kind, dry, bearded. Heals your familiars in the Conservatory. Warns Wren about "smiling faces". |
| **Seraphine Vale** | Lucien's previous "project" | Silver-haired, withdrawn. Lost her Dearling after Lucien "tutored" her. Haunts the Gloamwood. |
| **Madam Quire** | Librarian | Notices everything. |
| **Mr. Tallow** | Merchant | Sells sigils and tonics by the fountain. |

## How Lucien operates (Chapter One)

Each tactic appears in a specific beat, so later chapters can escalate them deliberately.

| Tactic | Where it appears |
|---|---|
| Staging a crisis, then arriving as the hero | He lets the Grimlet out of the menagerie (the snapped raven latch-charm), then applauds her. |
| Flattery and "you're special" | "The most interesting thing to happen at Thornveil in a decade." "You are almost too good to be true." |
| Testing physical boundaries | Brushing "dust" from her cheek before she can answer. |
| Isolating her from friends | "People like her latch on to people like you." "Don't tell Reyes. She would only worry." |
| Secrecy as intimacy | "Just us." "This is ours." "Good girl" when she says no one knows. |
| Possessive gifts | The silver pact-ribbon: "so everyone knows you are under my protection." "No one will dare touch what is mine." |
| Discrediting witnesses | Seraphine "is unwell. She says things. Sad things." |
| Never accepting no | Refuse the ribbon: "Then I will keep it for you. Until you are ready. You will be." |

## Devotion and Clarity

Two meters, raised by choices. Both are visible in the Journal (hearts and sparks) and on the end-of-chapter
card. Neither is "good" or "bad"; they decide which version of the dark romance the player is in.

- **Devotion**: how far Wren is falling for Lucien.
- **Clarity**: how clearly she sees what he is doing.

Chapter One verdict (`chapterOneVerdict` in `src/story/chapter1.ts`):

| Condition | Verdict |
|---|---|
| Devotion ≥ Clarity + 2 | "Wren is falling, and the fall feels like flying..." |
| Clarity ≥ Devotion + 2 | "Wren has seen the thorns beneath the roses. Lucien will have to try harder. He will." |
| Otherwise | "Wren's heart is a coin still spinning in the air..." |

Lucien's epilogue line also changes: "She trusts me already" when Devotion > Clarity, otherwise "She doesn't
trust me. Not yet. Good. I was getting bored."

### Chapter One choices

| Scene | Choice | Effect |
|---|---|---|
| Meeting Lucien | "I'm Wren! It was nothing, really." / "How do you know who I am?" | +1 Devotion / +1 Clarity |
| Meeting Lucien | (Hold still) / (Step back) | +1 Devotion / +1 Clarity |
| Tamsin's warning | "Maybe he's just lonely." / "Scared? Why?" | +1 Devotion / +1 Clarity |
| The first morning | "I promise." (to tell Tamsin) / "You worry too much!" | +1 Clarity / none |
| The library | "I just like familiars." / "Valuable to whom?" | +1 Devotion / +1 Clarity |
| The library | "Tamsin's my friend." / "...You really think so?" | +1 Clarity / +1 Devotion |
| The fountain (optional) | Wish for true love / good friends / to be brave | +1 Devotion / +1 Clarity / none |
| Night, the dorm | Tell Tamsin about Lucien / Keep it a secret | +1 Clarity / +1 Devotion |
| The Dueling Hall (if you told Tamsin) | "Tamsin knows." / "No one." | +1 Clarity / +1 Devotion |
| The ribbon | Let him tie it / "It's beautiful, but I can't" | +2 Devotion / +2 Clarity |
| After the duel (if you met Seraphine) | Ask about Seraphine's Dearling | +1 Clarity |
| After the duel | Wren hands back the raven latch-charm (automatic) | +1 Clarity (watch his hand) |
| Seraphine (Gloamwood) | Listening to her | +2 Clarity |

## Chapter One beat sheet

Story flags live in `src/story/flags.ts`.

| # | Beat | Map | Flag set |
|---|---|---|---|
| 1 | Prologue narration; Professor Finch meets Wren at the gate. | Courtyard | `introDone` |
| 2 | Choose a tutelary familiar: Kettlepup (Ember), Quillpus (Tide) or Budmouse (Bloom). | Conservatory | `starter` (species id) |
| 3 | Tamsin bursts in, takes the counter-pick, and challenges Wren. Win or lose, the story continues. | Conservatory | `tamsinDuel` (`won` or `lost`) |
| 4 | A feral Grimlet thrashes by the fountain. Wren calms it with no battle and binds it. | Courtyard | `grimletCalmed` |
| 5 | Lucien applauds from the steps. First meeting. Tamsin cuts in. Wren finds a snapped raven latch-charm. | Courtyard | `grimletDone` |
| 6 | Dorm chat; Wren sleeps; the raven dream. Morning: Tamsin asks her to promise to tell her first. | Dormitory | `restedFirstNight`, time = day |
| 7 | Free exploration: shop, library, the Gloamwood, optional duels, wild familiars. | Anywhere | |
| 8 | Lucien in the library: the Heartbloom, undermining Tamsin, the invitation. Night falls. | Library | `libraryScene`, time = night |
| 9 | (Optional) Seraphine in the Gloamwood clearing. | Gloamwood | `metSeraphine` |
| 10 | (Optional) Tell Tamsin, or don't. | Dormitory | `nightTalked`, `toldTamsin` |
| 11 | The moonlit duel. Win or lose, he wins something. | Dueling Hall | `lucienDuel` (`won` or `lost`) |
| 12 | The ribbon. The charm. "Dream of me." | Dueling Hall | `ribbonAccepted`, `returnedCharm` |
| 13 | Epilogue on black: "Father will have his binding at the Eclipse Waltz." | Dueling Hall | `chapterOneDone` |

## Threads planted for later chapters

- **The Eclipse Waltz**: next month. What binding does Lord Ravelle intend, and why does it need a Heartbloom?
- **The raven latch-charm**: proof Lucien let the Grimlet out. Wren innocently hands it back to him after the
  duel, and his hand trembles.
- **The silver pact-ribbon**: "warm, as if it has a heartbeat of its own." What does it actually do?
- **Seraphine's Dearling**: "Ask him what happened to her. Watch his face." Dearlings bond once and never
  forgive betrayal. A wild Dearling lives in the Gloamwood clearing.
- **The Restricted Section**: locked with a raven padlock. The page on Heartblooms has been torn out.
- **The torn history**: Weaving was outlawed in 1702. Was it ever stopped?
- **Tamsin**: the friend Lucien most needs out of the way.

## Proposed arc (not decided yet)

These are suggestions to discuss before writing Chapter Two.

1. **Chapter Two, "The Hollow Waltz"**: preparations for the ball. Lucien escalates (jealousy of Tamsin,
   dance lessons, a familiar "gift"). The Restricted Section. Seraphine's story.
2. **Chapter Three, "Eclipse"**: the Waltz and the binding. Endings shaped by Devotion and Clarity, for
   example: *Woven* (high Devotion: she becomes his, and his family's); *Unbound* (high Clarity: she breaks the
   pact and walks away); *Thornheart* (both high: she stays, knowing exactly who he is, and makes him play by
   her rules).
