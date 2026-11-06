import { createFamiliar } from '../core/familiar';
import { removeItem } from '../core/state';
import { SPECIES, type SpeciesId } from '../data/species';
import type { Script, ScriptApi } from './api';
import { isTouch } from './common';
import { F } from './flags';

/**
 * Chapter One: "The Welcome".
 *
 * Wren Ashby, a farm girl with a rare gift (wild familiars trust her on
 * sight), arrives at Thornveil Academy. Lucien Ravelle, golden heir of the
 * house that owns the academy, decides she is exactly what his family needs.
 *
 * The player only ever controls Wren. Lucien's manipulation is never named by
 * the game; it is shown, and the player may or may not notice it. Choices move
 * two hidden meters: Devotion (how far Wren falls for him) and Clarity (how
 * clearly she sees him). Both are shown in the Journal. See docs/STORY.md.
 */

/** Tamsin always picks the tutelary that is strong against Wren's. */
const RIVAL_OF: Record<string, SpeciesId> = { kettlepup: 'quillpus', quillpus: 'budmouse', budmouse: 'kettlepup' };

async function offerSave(s: ScriptApi): Promise<void> {
  const c = await s.choose(['Save your story', 'Not now'], 1);
  if (c === 0) await s.say(null, s.save() ? 'Your story was saved.' : 'Saving failed. Your browser may be blocking storage.');
}

// ── Arrival ─────────────────────────────────────────────────────────────

async function intro(s: ScriptApi): Promise<void> {
  s.set(F.time, 'dusk');
  await s.narrate(
    [
      'Thornveil Academy has stood above the Gloamwood for three hundred years.',
      'Its students bind wild familiars with a pact of trust: a promise made, and kept.',
      'No wild familiar had ever chosen a girl from the fields.',
      'Then a dandelion wisp followed Wren Ashby home, and refused to leave.',
      'The scholarship letter arrived a week later.',
    ],
    { keepDark: true },
  );
  await s.fadeIn(900);
  await s.wait(0.3);
  await s.think('Okay, Wren. Deep breath. You belong here.');
  await s.think('...Probably. The letter did say "scholarship," not "clerical error."');

  const finch = s.actor('finch');
  await finch?.emote('!');
  await finch?.walkPath(['down', 'down']);
  await s.say('finch', 'Miss Ashby! There you are. I would know that look anywhere: lost, hopeful, and slightly damp from the ferry.');
  await s.say('finch', 'Hollis Finch, Familiar Studies. I shall be your tutor this term, heaven help us both.');
  const c = await s.choose(["It's so nice to meet you!", 'Is it always this... gothic?']);
  if (c === 0) {
    await s.say('wren', "It's so lovely to meet you, Professor! Thank you for, um. For all of this. Really.");
    await s.say('finch', 'Do not thank me. Thank the wild Puffwisp that followed you home for three weeks.');
  } else {
    await s.say('wren', 'Is it always this... gothic?');
    await s.say('finch', 'Only on days ending in "y". You will grow fond of the gargoyles. They are already fond of you.');
    await s.say('finch', 'They can tell, you know. The wild ones. A Puffwisp followed you home for three weeks.');
  }
  await s.say('finch', "Wild familiars don't do that. Not for anyone. Not for a hundred years.");
  await s.say('finch', 'Every first-year binds a tutelary familiar on their first night. The others did theirs at noon. You, my dear, are fashionably late.');
  await s.say('finch', 'The Conservatory: the glass house, south-east of the fountain. I shall go ahead and wake the little ones.');
  await finch?.walkPath(['right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'up'], 0.16);
  s.set(F.introDone);
  s.refresh();
  s.objective('Meet Professor Finch in the Conservatory.');
  await s.say(
    null,
    isTouch()
      ? 'Use the pad to walk. A talks and confirms, B runs and goes back, MENU opens your journal.'
      : 'Arrow keys or WASD walk. Z or Enter talks and confirms. X goes back (hold it to run). Esc opens your journal.',
  );
}

async function courtyardEnter(s: ScriptApi): Promise<void> {
  if (!s.has(F.introDone)) return intro(s);
  if (s.has(F.tamsinDuel) && !s.has(F.grimletCalmed)) return grimletIncident(s);
}

async function gloamwoodBlocked(s: ScriptApi): Promise<void> {
  await s.think('The trees beyond the road are very dark. Professor Finch said to go straight to the Conservatory.');
  await s.player.walkPath(['left']);
}

// ── The Conservatory ────────────────────────────────────────────────────

async function conservatoryEnter(s: ScriptApi): Promise<void> {
  if (s.has(F.starter) || s.has(F.finchWelcome)) return;
  s.set(F.finchWelcome);
  await s.say('finch', 'Ah, you found it. Mind the mandrakes; they bite when they are bored.');
  await s.say('finch', 'Three tutelaries, raised in this very glasshouse. Each one is waiting to see whether you are worth trusting.');
  await s.say('finch', 'A pact is not a leash, Miss Ashby. It is a promise. Go and say hello, and choose the one that feels like home.');
  s.objective('Choose your tutelary familiar from the pedestals.');
}

async function finchConservatory(s: ScriptApi): Promise<void> {
  if (!s.has(F.starter)) {
    await s.say('finch', 'Take your time. They are choosing you as much as you are choosing them.');
    return;
  }
  await s.say('finch', 'Let me look at your familiars. Ah, a few scrapes. There.');
  await s.heal();
  await s.say('finch', 'Come back whenever they need patching up. And do sleep, Miss Ashby. Students who do not sleep start seeing ravens.');
}

function pedestal(id: SpeciesId, blurb: string): Script {
  return async (s) => {
    if (s.has(F.starter)) return;
    await s.say(null, blurb);
    const c = await s.choose([`Choose ${SPECIES[id].name}`, 'Not yet'], 1);
    if (c === 0) await chooseStarter(s, id);
  };
}

async function chooseStarter(s: ScriptApi, id: SpeciesId): Promise<void> {
  s.set(F.starter, id);
  s.refresh();
  await s.say('wren', "Hi there. I'm Wren. I promise I'll take good care of you.");
  await s.bind(id, 5);
  if (id === 'budmouse') await s.say(null, "The bud on Budmouse's head opens. Just a little.");
  if (id === 'kettlepup') await s.say(null, 'Kettlepup whistles so happily that its lid rattles.');
  if (id === 'quillpus') await s.say(null, 'Quillpus writes a small, wobbly heart on the back of your hand.');
  await s.say('finch', 'Remarkable. It bonded on the first try. The others needed an hour and a biscuit.');

  s.sfx('door');
  const tamsin = s.spawn('tamsin', 'tamsin', 6, 8, 'up');
  await tamsin.walkPath(['up', 'up'], 0.14);
  await s.say('tamsin', "Sorry, sorry! Is this the binding thing? Am I late? I'm late. The stairs in this place MOVE, did you know that?");
  await s.say('finch', 'They do not, Miss Reyes. You took the laundry chute again.');
  await s.say('tamsin', '...They moved a little.');
  const rival = RIVAL_OF[id] as SpeciesId;
  await s.say('tamsin', `Ooh, look at this one! A ${SPECIES[rival].name}. It looks like it bites. We'll get along great.`);
  s.sfx('caught');
  await s.say(null, `Tamsin formed a pact with ${SPECIES[rival].name}!`);
  await s.say('tamsin', "I'm Tamsin, by the way. Tamsin Reyes. Your roommate! You're the scholarship girl, right? Everyone's talking about you.");
  await s.say('wren', 'They... are?');
  await s.say('tamsin', 'Mostly nice things! Mostly. Professor, can we try them out? Pleeease? A friendly duel?');
  await s.say('finch', 'A gentle one. Nobody faints in my glasshouse.');

  const outcome = await s.battle({
    kind: 'trainer',
    trainerName: 'Tamsin',
    trainerLook: 'tamsin',
    foe: [createFamiliar(rival, 5)],
    ai: 'random',
    canLose: true,
    loseLine: "Okay, okay, you're good! Annoyingly good.",
    winLine: "Ha! Don't feel bad. I've been practising on my brother's familiar since I was six.",
  });
  s.set(F.tamsinDuel, outcome === 'win' ? 'won' : 'lost');
  if (outcome === 'win') await s.say('tamsin', "You're a natural. That is so unfair. Friends anyway?");
  else await s.say('tamsin', "Don't make that face! You'll get me next time. Friends?");
  const f = await s.choose(['Friends!', 'Best friends?']);
  if (f === 1) await s.say('tamsin', "BEST friends. It's decided. No take-backs.");
  else await s.say('tamsin', "Friends! Great. I'll save you a seat at breakfast. And lunch. And probably dinner.");

  await s.heal();
  await s.say('finch', 'There. Good as new. Every first-year also receives a starter satchel.');
  await s.give('sigil', 5);
  await s.give('tonic', 3);
  await s.say('finch', 'Pact Sigils offer your pact to a wild familiar. Weaken it first, gently, and it will listen. Tonics are for scrapes.');
  await s.say('finch', 'Now, both of you, off to the dormitory before curfew. West side of the courtyard.');
  await s.say('finch', '...And Miss Ashby? Do be careful whom you trust. Thornveil has a great many smiling faces.');
  await tamsin.walkPath(['down', 'down'], 0.14);
  s.despawn('tamsin');
  s.objective('Head to the dormitory on the west side of the courtyard.');
}

// ── The runaway Grimlet ─────────────────────────────────────────────────

async function grimletIncident(s: ScriptApi): Promise<void> {
  s.sfx('thud');
  s.shake(350, 0.01);
  await s.say(null, 'CRASH!');
  await s.say('student', "It got out of the menagerie! Somebody stop it!");
  await s.panTo(15, 13, 700);
  await s.say(null, 'A baby gargoyle is thrashing beside the fountain, snapping at anyone who comes near.');
  await s.panBack(500);
  await s.say('tamsin', "Wren, wait! That's a feral Grimlet. It'll bite your fingers off!");
  await s.think("It isn't angry. It's scared.");
  s.objective('Calm the runaway Grimlet by the fountain.');
}

async function grimletCalm(s: ScriptApi): Promise<void> {
  await s.say(null, 'The Grimlet hisses and flattens its little stone wings.');
  const c = await s.choose(['Hum a lullaby', 'Kneel and hold out your hand']);
  if (c === 0) await s.say(null, "Wren hums the song her grandmother sang during thunderstorms. The Grimlet's ears twitch... and droop.");
  else await s.say(null, 'Wren kneels on the cold flagstones, holds out her hand, palm up, and waits.');
  await s.say(null, 'The Grimlet creeps closer... and presses its cold forehead into her palm.');
  await s.say('wren', "There we go. Nobody's going to hurt you. You were just scared, weren't you?");
  s.set(F.grimletCalmed);
  s.refresh();
  await s.bind('grimlet', 5);

  // Lucien
  await s.fadeOut(250);
  s.player.place(15, 14, 'up');
  await s.fadeIn(250);
  s.music('lucien');
  await s.say(null, 'Slow, deliberate applause echoes across the courtyard.');
  await s.panTo(13, 7, 700);
  const lucien = s.actor('lucienYard');
  await lucien?.walkPath(['down', 'down', 'down', 'down', 'down', 'down', 'right', 'right', 'down', 'down'], 0.24);
  await s.panBack(400);
  await s.say('lucien', 'Well. That was the most interesting thing to happen at Thornveil in a decade.');
  await s.say('lucien', 'Lucien Ravelle. Sixth year. Prefect. And you must be the girl the wild ones follow.');
  const a = await s.choose(["I'm Wren! It was nothing, really.", 'How do you know who I am?']);
  if (a === 0) {
    await s.say('wren', "I'm Wren! It was nothing, really. It was just scared.");
    await s.say('lucien', '"Nothing." She tames a feral gargoyle with her bare hands and calls it nothing.');
    await s.say('lucien', "You're going to be a problem, aren't you? The good kind.");
    s.devotion(1);
  } else {
    await s.say('wren', '...Have we met? How do you know who I am?');
    await s.say('lucien', 'Everyone knows who you are, Wren. The first scholarship student in a century.');
    await s.say('lucien', 'I make it my business to know everyone worth knowing.');
    s.clarity(1);
  }
  await s.whisper('lucien', 'You have dust on your cheek. Hold still.');
  await s.say(null, 'He reaches for her face before she can answer.');
  const b = await s.choose(['(Hold still)', '(Step back)']);
  if (b === 0) {
    await s.say(null, 'He brushes it away with his thumb. His hand is cold. His smile is warm.');
    await s.say('wren', 'Oh! Um. Thank you.');
    await s.say('lucien', 'There. Perfect.');
    s.devotion(1);
  } else {
    await s.say('wren', "I, um. I can do that myself. But thank you!");
    await s.say('lucien', 'Of course you can. Forgive me. Old habits.');
    s.clarity(1);
  }
  await s.say('lucien', 'Allow me to walk you to the dormitories. The courtyard gets... strange, after dark.');

  const tamsin = s.actor('tamsinYard');
  await tamsin?.walkPath(['left', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'up', 'left'], 0.13);
  tamsin?.face('left');
  await s.say('tamsin', "She's fine, Ravelle. I'm her roommate. I'll walk her.");
  await s.say(null, "Lucien's smile does not move at all.");
  await s.say('lucien', 'Of course. Miss Reyes.');
  await s.whisper('lucien', "Another time, then. I'm in the library most evenings, if you ever need a friend who knows how this place really works.");
  await lucien?.walkPath(['up', 'up', 'left', 'left', 'up', 'up', 'up', 'up', 'up', 'up'], 0.22);
  s.despawn('lucienYard');
  s.music(null);

  await s.say('tamsin', 'Wren. Rule one of Thornveil: do NOT let Lucien Ravelle "walk you" anywhere.');
  await s.say('wren', 'He seemed nice?');
  await s.say('tamsin', 'They always seem nice. His family funds half this academy. The other half is scared of them.');
  const d = await s.choose(["Maybe he's just lonely.", 'Scared? Why?']);
  if (d === 0) {
    await s.say('wren', "Maybe he's just lonely.");
    await s.say('tamsin', "...You're going to be a problem, aren't you.");
    s.devotion(1);
  } else {
    await s.say('wren', 'Scared? Why?');
    await s.say('tamsin', 'Ask Seraphine Vale. Oh, wait. You can\'t. She stopped talking to anyone after he "tutored" her.');
    s.clarity(1);
  }
  await s.say(null, 'Something glints between the flagstones where the Grimlet was thrashing.');
  await s.give('ravenCharm');
  await s.think('A latch-charm, snapped clean through. There is a little raven stamped on it.');
  await s.think("Someone must have dropped it. I'll find out who it belongs to.");
  await s.say('tamsin', 'Come on. Dormitory is west. I will show you the good bed. Well. The less bad bed.');
  await s.fadeOut(300);
  s.set(F.grimletDone);
  s.refresh();
  await s.fadeIn(300);
  s.objective('Go to the dormitory (west) and rest.');
}

// ── Dormitory ───────────────────────────────────────────────────────────

async function dormEnter(s: ScriptApi): Promise<void> {
  if (!s.has(F.grimletDone) || s.has(F.restedFirstNight) || s.has(F.dormChat)) return;
  s.set(F.dormChat);
  await s.say('tamsin', 'Home sweet home! The left bed is yours. It only squeaks when you breathe.');
  await s.say('tamsin', 'So. Lucien Ravelle touched your face.');
  await s.say('wren', 'He was just being nice!');
  await s.say('tamsin', "Mm-hm. Lucien Ravelle has never been 'just' anything.");
  await s.say('tamsin', 'Get some sleep. Tomorrow you can explore. Library, Gloamwood, the dining hall. Mostly the dining hall.');
  s.objective('Rest in your bed (the left one).');
}

async function tamsinDorm(s: ScriptApi): Promise<void> {
  await s.say('tamsin', "Bed! Sleep! I'll be up for another hour reading about Grimlets. For you. You're welcome.");
}

async function wrenBed(s: ScriptApi): Promise<void> {
  if (s.has(F.grimletDone) && !s.has(F.restedFirstNight)) return firstNight(s);
  const c = await s.choose(['Rest a while', 'Leave it'], 1);
  if (c !== 0) return;
  await s.fadeOut(400);
  await s.heal();
  await s.fadeIn(400);
  await s.say(null, 'Wren rested. Her familiars are full of energy again.');
  await offerSave(s);
}

async function firstNight(s: ScriptApi): Promise<void> {
  await s.say(null, 'Wren slips under the quilt. It smells of lavender and old stone.');
  await s.fadeOut(800);
  await s.heal();
  s.set(F.restedFirstNight);
  s.setTime('day');
  await s.narrate(['That night, Wren dreamed of a raven circling a lantern.', 'Every time she reached for the light, the raven got there first.'], {
    keepDark: true,
  });
  s.player.place(4, 3, 'right');
  await s.fadeIn(800);
  s.actor('tamsinDorm')?.face('left');
  await s.say('tamsin', 'Morning, sunshine! You talk in your sleep, did you know? Something about birds.');
  await s.say('tamsin', 'I have Herbology all day, so explore without me. The library is east, and the Gloamwood is out past the east road. Wild familiars galore.');
  await s.say('tamsin', 'Mr. Tallow sells supplies by the fountain. And Wren?');
  await s.say('tamsin', 'If a certain prefect invites you anywhere... tell me first. Promise?');
  const c = await s.choose(['I promise.', 'You worry too much!']);
  if (c === 0) {
    await s.say('wren', 'I promise.');
    s.set(F.promisedTamsin);
    s.clarity(1);
  } else {
    await s.say('wren', 'You worry too much!');
    await s.say('tamsin', 'Somebody has to.');
  }
  s.objective('Explore the academy. Visit the library (east) or the Gloamwood.');
  await offerSave(s);
}

async function tamsinNight(s: ScriptApi): Promise<void> {
  if (s.has(F.nightTalked)) {
    await s.say('tamsin', s.has(F.toldTamsin) ? "Go on, then. One hour. Then I'm coming in swinging." : "Night, Wren. Don't stay out too late.");
    return;
  }
  s.set(F.nightTalked);
  await s.say('tamsin', 'There you are! You missed dinner. They had the good pudding.');
  await s.say('tamsin', "...You've got your 'I'm about to do something' face on. Where are you going?");
  const c = await s.choose(['Tell her about Lucien', 'Keep it a secret']);
  if (c === 0) {
    s.set(F.toldTamsin);
    await s.say('wren', 'Lucien asked me to meet him in the Dueling Hall. For a lesson.');
    await s.say('tamsin', '...At night. Alone. A "lesson."');
    await s.say('tamsin', "Okay. I can't stop you. But you told me, and that matters. If you're not back in an hour, I'm coming in swinging.");
    s.clarity(1);
  } else {
    await s.say('wren', 'Just... a walk! I need some air.');
    await s.say('tamsin', 'Uh-huh. At night. In the courtyard full of ghost-moths.');
    await s.say('tamsin', 'Fine. Be careful, okay?');
    await s.think("He said she'd only worry. He was right... wasn't he?");
    s.devotion(1);
  }
}

async function tamsinAfter(s: ScriptApi): Promise<void> {
  if (s.flag(F.ribbonAccepted) === true) {
    await s.say('tamsin', "That ribbon. That's a Ravelle crest, Wren.");
    await s.say('tamsin', "I'm not mad. I'm just... going to be watching. Very closely. Forever.");
  } else {
    await s.say('tamsin', "You came back! In one piece! I made you hot chocolate. It's mostly marshmallow.");
  }
}

// ── The library ─────────────────────────────────────────────────────────

async function lucienLibrary(s: ScriptApi): Promise<void> {
  if (s.has(F.libraryScene)) {
    await s.whisper('lucien', 'Tonight, little wren. The Dueling Hall. Do not keep me waiting.');
    return;
  }
  s.music('lucien');
  await s.vignette(true);
  await s.say('lucien', 'Wren. You came.');
  await s.say('wren', "Oh! I wasn't... I mean, I was looking for a book about Grimlets. And you said evenings, and it's morning, so...");
  await s.say('lucien', 'So you remembered exactly what I said. I am flattered.');
  await s.say('lucien', 'Sit. I was just reading about you.');
  await s.say('wren', 'About me?');
  await s.say('lucien', '"Heartbloom." Someone wild familiars trust on sight. There has not been one at Thornveil in a hundred and twelve years.');
  await s.say('lucien', 'The old texts say a Heartbloom can bind anything. Anything at all.');
  await s.say('lucien', 'Do you know how valuable that makes you?');
  const a = await s.choose(['I just like familiars.', 'Valuable to whom?']);
  if (a === 0) {
    await s.say('wren', "I don't think I'm valuable. I just like familiars. And they like me back.");
    await s.say('lucien', 'Humble, too. You are almost too good to be true.');
    s.devotion(1);
  } else {
    await s.say('wren', 'Valuable... to whom?');
    await s.say(null, 'He pauses. Just for a heartbeat.');
    await s.say('lucien', 'To the academy, of course. To everyone. Clever girl.');
    s.clarity(1);
  }
  await s.say('lucien', 'Your roommate. Reyes.');
  await s.say('lucien', "She's sweet. Loud, but sweet.");
  await s.whisper('lucien', "Just... be careful. People like her latch on to people like you. You're about to matter here, and she knows it.");
  const b = await s.choose(["Tamsin's my friend.", '...You really think so?']);
  if (b === 0) {
    await s.say('wren', "Tamsin's my friend. She's been nothing but kind to me.");
    await s.say(null, "Something cold flickers across Lucien's face, and is gone.");
    await s.say('lucien', 'Of course. Forgive me. I only meant that I would hate to see you used.');
    s.clarity(1);
  } else {
    await s.say('wren', '...You really think so?');
    await s.say('lucien', "I think you are too good for most people here, Wren. That's all.");
    await s.whisper('lucien', "Lucky for you, I'm not most people.");
    s.devotion(1);
  }
  await s.say('lucien', 'Meet me in the Dueling Hall tonight. I will teach you what they do not teach first-years.');
  await s.whisper('lucien', "Just us. Don't tell Reyes. She would only worry, and worrying is so exhausting, isn't it?");
  await s.vignette(false);
  s.set(F.libraryScene);
  await s.fadeOut(600);
  await s.narrate(['The rest of the day slips by in a blur of lectures and borrowed notes.', 'By the time Wren looks up, the windows are dark.'], { keepDark: true });
  s.setTime('night');
  s.music(null);
  await s.fadeIn(600);
  s.objective(
    s.has(F.promisedTamsin)
      ? 'Meet Lucien in the Dueling Hall tonight. (You promised to tell Tamsin first.)'
      : 'Meet Lucien in the Dueling Hall (north of the courtyard) tonight.',
  );
}

async function quire(s: ScriptApi): Promise<void> {
  if (s.has(F.libraryScene)) {
    await s.say('quire', 'The Ravelle boy was waiting for you since dawn, you know. Sat right there. Did not read a single page.');
    return;
  }
  await s.say('quire', 'Shh. ...Oh. The scholarship girl.');
  await s.say('quire', 'Books are for reading, not for dueling, whatever the older students tell you. Mind the Tomelets; they nip.');
}

async function libraryReader(s: ScriptApi): Promise<void> {
  await s.say('student', 'I am memorising the arcana chart. Umbra hurts Heart, and Heart hurts Umbra right back.');
  await s.say('student', 'Like a bad romance novel. Not that I read those. Constantly.');
}

// ── The Dueling Hall at night ───────────────────────────────────────────

async function duelingHallEnter(s: ScriptApi): Promise<void> {
  if (!s.has(F.libraryScene) || s.has(F.lucienDuel)) return;
  s.music('lucien');
  await s.vignette(true);
  await s.say(null, 'The Dueling Hall is dark except for the candles. Their light pools in the rune circle like spilled wine.');
  await s.say('lucien', 'You came. I wondered whether you would.');
  const path: ('up' | 'right')[] = s.player.x === 6 ? ['right', 'up', 'up', 'up', 'up', 'up'] : ['up', 'up', 'up', 'up', 'up'];
  await s.player.walkPath(path, 0.26);
  s.player.face('up');
  await s.say('lucien', 'Did you tell anyone you were coming?');
  if (s.has(F.toldTamsin)) {
    const c = await s.choose(['Tamsin knows.', 'No one.']);
    if (c === 0) {
      await s.say('wren', 'Tamsin knows.');
      await s.say(null, 'For a moment, every candle in the hall seems to gutter.');
      await s.say('lucien', '...Of course she does. Never mind. You are here now.');
      s.clarity(1);
    } else {
      await s.say('wren', 'No one.');
      await s.say('lucien', 'Good girl.');
      s.devotion(1);
    }
  } else {
    await s.say('wren', 'No one.');
    await s.say('lucien', 'Good. This is ours.');
  }
  await s.say('lucien', 'Now. Show me what you can do, little wren. Do not hold back.');
  await s.whisper('lucien', 'I would never forgive you if you held back.');
  await s.vignette(false);

  const outcome = await s.battle({
    kind: 'trainer',
    trainerName: 'Lucien',
    trainerLook: 'lucien',
    foe: [createFamiliar('flittermouse', 7), createFamiliar('umbrasp', 9)],
    ai: 'smart',
    canLose: true,
    reward: 300,
    bg: 'hall',
    music: 'duel',
    loseLine: '...Extraordinary.',
    winLine: "Shh. Don't look like that. You were wonderful.",
  });
  s.set(F.lucienDuel, outcome === 'win' ? 'won' : 'lost');
  s.music('lucien');
  await s.vignette(true);
  if (outcome === 'win') {
    await s.say('lucien', '...Extraordinary. No one has beaten me in this hall since my second year.');
    await s.say(null, 'He laughs softly, and for once it sounds almost real.');
    await s.whisper('lucien', 'Do you know what you are, Wren? You are the most interesting thing that has ever happened to me.');
  } else {
    await s.heal();
    await s.say('lucien', "Shh. Don't look like that. You were wonderful.");
    await s.say(null, 'He tucks a strand of hair behind her ear. His fingers linger.');
    await s.whisper('lucien', 'You just need the right teacher. Only me, though. Promise?');
  }

  await s.say('lucien', 'Here. I want you to have this.');
  await s.say(null, 'A silver ribbon, embroidered with a tiny golden raven. It is warm, as if it has a heartbeat of its own.');
  await s.say('lucien', 'Wear it. So everyone knows you are under my protection.');
  const r = await s.choose(['Let him tie it in your hair', "It's beautiful, but I can't"]);
  if (r === 0) {
    s.set(F.ribbonAccepted, true);
    await s.say(null, 'He steps behind her and ties the ribbon with careful, practised fingers.');
    await s.whisper('lucien', 'Perfect. Now no one will dare touch what is mine.');
    await s.say('wren', '...What is yours?');
    await s.say('lucien', 'Who is mine to protect. A slip of the tongue.');
    await s.give('pactRibbon');
    s.devotion(2);
  } else {
    s.set(F.ribbonAccepted, false);
    await s.say('wren', "It's beautiful. But I can't accept something like this. We only just met.");
    await s.say(null, 'For a heartbeat, his smile does not reach his eyes.');
    await s.say('lucien', 'Then I will keep it for you. Until you are ready.');
    await s.whisper('lucien', 'You will be.');
    s.clarity(2);
  }

  if (s.has(F.metSeraphine)) {
    const c = await s.choose(["Ask about Seraphine's Dearling", 'Say nothing']);
    if (c === 0) {
      await s.say('wren', "Lucien... what happened to Seraphine's Dearling?");
      await s.say(null, 'The Umbrasp at his feet lifts its head and hisses, very softly.');
      await s.say('lucien', 'Seraphine is... unwell. She says things. Sad things.');
      await s.whisper('lucien', 'I would hate for her to fill your head with them. Your head is so lovely the way it is.');
      s.clarity(1);
    }
  }
  if ((s.state.bag.ravenCharm ?? 0) > 0) {
    await s.say('wren', 'Oh! Before I forget. I found this by the fountain. It has a raven on it, like your banners.');
    await s.say(null, 'Lucien takes the broken latch-charm from her palm. Too quickly.');
    await s.say('lucien', 'How careless of someone. Thank you, little wren. I will see that it is returned.');
    removeItem(s.state, 'ravenCharm');
    s.set(F.returnedCharm);
    await s.think('Why did his hand tremble?');
    s.clarity(1);
  }
  await s.say('lucien', 'Goodnight, Wren. Dream of me.');
  await s.vignette(false);

  // Epilogue: the same night, after she has gone.
  await s.curtain(true, 900);
  await s.say(null, 'Later, when the last candle has guttered out...');
  await s.say('lucien', 'She is perfect. A true Heartbloom.');
  await s.say(null, 'The Umbrasp winds around his wrist like a bracelet.');
  await s.say('lucien', 'Father will have his binding at the Eclipse Waltz.');
  if (s.state.devotion > s.state.clarity) await s.whisper('lucien', 'She trusts me already. It was almost too easy.');
  else await s.say('lucien', "She doesn't trust me. Not yet. Good. I was getting bored.");
  await s.say('lucien', '...Shame.');
  await s.whisper('lucien', 'I almost like the way she laughs.');
  s.set(F.chapterOneDone);
  s.save();
  await s.chapterEnd();
  s.player.place(7, 9, 'down');
  await s.curtain(false, 600);
  s.music(null);
  s.objective('Chapter Two is coming. Until then, explore, duel and bind familiars freely.');
}

async function ravelleBanner(s: ScriptApi): Promise<void> {
  await s.say(null, 'A violet banner stitched with a golden raven: the crest of House Ravelle.');
  if ((s.state.bag.ravenCharm ?? 0) > 0) await s.think('The same raven as the broken latch-charm in my satchel...');
}

// ── The Gloamwood ───────────────────────────────────────────────────────

async function gloamwoodEnter(s: ScriptApi): Promise<void> {
  if (s.has('gwVisited')) return;
  s.set('gwVisited');
  await s.think('The air in the Gloamwood tastes like rain and old magic.');
  await s.say(null, 'Wild familiars hide in the violet mistgrass. Weaken one, then trace a Pact Sigil from your satchel to offer it your pact.');
}

async function seraphine(s: ScriptApi): Promise<void> {
  s.set(F.metSeraphine);
  await s.say('seraphine', "You're the new one. The one he's watching.");
  await s.say('wren', 'Watching? Who?');
  await s.say('seraphine', "Lucien. He'll tell you you're special. You are. That's the problem.");
  await s.say('seraphine', 'He told me the same things, last spring. That my friends were jealous of me. That only he understood me.');
  await s.say('seraphine', "By summer I didn't have any friends left to be jealous.");
  const c = await s.choose(['Are you okay?', 'Why are you telling me this?']);
  if (c === 0) {
    await s.say('wren', 'Are you... are you okay?');
    await s.say('seraphine', "...No one has asked me that in a long time.");
  } else {
    await s.say('wren', 'Why are you telling me this?');
    await s.say('seraphine', 'Because no one told me.');
  }
  await s.say('seraphine', 'I had a familiar once. A Dearling. She trusted me completely.');
  await s.say('seraphine', 'Ask him what happened to her. Watch his face when you do.');
  s.clarity(2);
  await s.fadeOut(400);
  s.refresh();
  await s.fadeIn(400);
  await s.say(null, 'Seraphine is gone. The mist has closed behind her like a curtain.');
}

async function shrine(s: ScriptApi): Promise<void> {
  await s.say(null, 'An old shrine, furred with moss. The carving reads:');
  await s.say(null, '"What is bound in trust cannot be taken. What is taken cannot be bound."');
  const c = await s.choose(['Rest here a moment', 'Move on'], 1);
  if (c === 0) {
    await s.heal();
    await s.say(null, 'A warm wind stirs the mist. Your familiars look refreshed.');
  }
}

// ── Ambient lines and objects ───────────────────────────────────────────

const say1 = (who: Parameters<ScriptApi['say']>[0], ...lines: string[]): Script => async (s) => {
  for (const l of lines) await s.say(who, l);
};

async function gossip1(s: ScriptApi): Promise<void> {
  if (s.has(F.chapterOneDone)) return s.say('student', 'The Eclipse Waltz is next month. Everyone is pairing up already. Has anyone asked you yet?');
  if (s.has(F.libraryScene)) return s.say('student', "You're going to the Dueling Hall tonight? ...Never mind. Forget I said anything.");
  if (s.has(F.grimletDone)) return s.say('student', 'Lucien Ravelle walked across the whole courtyard just to talk to YOU. He never walks anywhere. People walk to him.');
  return s.say('student', "First night? The gargoyles on the roof blink when you're not looking. Don't look.");
}

async function gossip2(s: ScriptApi): Promise<void> {
  if (s.has(F.libraryScene)) return s.say('student', 'Seraphine Vale used to sit right here and read every evening. Now she only ever goes to the Gloamwood.');
  return s.say('student', 'The fountain was a gift from House Ravelle. So was the library wing. And the Dueling Hall. Everything nice here was.');
}

async function gateStudent(s: ScriptApi): Promise<void> {
  await s.say('student', "The menagerie latch was snapped clean through. Grimlets can't do that. Somebody let it out.");
}

async function tallow(s: ScriptApi): Promise<void> {
  await s.say('tallow', 'Sigils, tonics, remedies! Fair prices. Mostly fair. Fair-ish.');
  await s.shop();
  await s.say('tallow', 'Mind how you go, love.');
}

async function fountain(s: ScriptApi): Promise<void> {
  await s.say(null, 'A fountain shaped like an open hand. Coins glint at the bottom: three hundred years of wishes.');
  if (s.has('wished') || s.state.marks < 1) return;
  const c = await s.choose(['Toss in a mark', 'Leave it'], 1);
  if (c !== 0) return;
  s.state.marks -= 1;
  s.set('wished');
  const w = await s.choose(['Wish for true love', 'Wish for good friends', 'Wish to be brave']);
  if (w === 0) {
    await s.think('Someone who looks at me like I am the only person in the room.');
    s.devotion(1);
  } else if (w === 1) {
    await s.think('People who will tell me the truth, even when I do not want to hear it.');
    s.clarity(1);
  } else await s.think('Brave enough to say no, if I ever need to.');
}

const SCRIPTS_CH1: Record<string, Script> = {
  courtyardEnter,
  gloamwoodBlocked,
  conservatoryEnter,
  finchConservatory,
  pedestalKettlepup: pedestal('kettlepup', 'A copper-bellied puppy, warm as a hearth. It whistles hopefully at you. (Ember: strong against Bloom and Umbra.)'),
  pedestalQuillpus: pedestal('quillpus', "A little ink octopus with a quill for a crest. It is writing your name on the glass. Badly. (Tide: strong against Ember and Stone.)"),
  pedestalBudmouse: pedestal('budmouse', 'A shy mouse with a closed flower bud on its head. The bud trembles when you smile. (Bloom: strong against Tide and Stone.)'),
  pedestalEmpty: say1(null, 'An empty pedestal under a glass cloche. A few warm sparks still drift inside.'),
  conservatoryPlant: say1(null, "A potted mandrake. It's snoring. Best not to wake it."),
  grimletCalm,
  dormEnter,
  tamsinDorm,
  tamsinNight,
  tamsinAfter,
  wrenBed,
  tamsinBed: say1(null, "Tamsin's bed, buried under books she swears she is going to read."),
  dormDesk: async (s) => {
    await s.say(null, 'A letter from home, in Gran\'s spidery handwriting:');
    await s.say(null, '"Be kind, little bird. But remember: kindness is a gift, not a debt. Nobody is owed it."');
  },
  wardrobe: say1(null, "Wren's new uniform is two sizes too big. Tamsin pinned the hem with a hair clip."),
  dormWindow: say1(null, 'From here you can see the Gloamwood. Something glows between the trees, then goes out.'),
  lucienLibrary,
  quire,
  libraryReader,
  bookHeartbloom: say1(null, '"On Heartblooms": Rare souls whom wild familiars trust on sight. Historically sought after by...', 'The rest of the page has been torn out.'),
  bookRavelle: say1(
    null,
    '"A History of House Ravelle": The Ravelles were the first family to bind familiars without their consent, a practice called Weaving.',
    'Weaving was outlawed in 1702. The Ravelles have funded Thornveil most generously ever since.',
  ),
  bookFamiliars: say1(
    null,
    '"Arcana for Beginners": Ember burns Bloom and banishes Umbra. Tide douses Ember and wears down Stone. Bloom drinks Tide and cracks Stone.',
    'Gale scatters Bloom and Tide. Stone grounds Ember and Gale. Lumen dispels Umbra and parts the Gale.',
    'Umbra and Heart wound each other. Arcane is neutral to all.',
  ),
  bookPacts: say1(null, '"The Nature of Pacts": A familiar bound in trust grows stronger through every hardship.', 'A familiar that is forced will obey. But it will never truly be yours.'),
  bookRestricted: say1(null, 'The Restricted Section is locked with a silver padlock. A tiny raven is engraved on the lock.'),
  duelingHallEnter,
  ravelleBanner,
  gloamwoodEnter,
  seraphine,
  shrine,
  signForest: say1(null, 'THE GLOAMWOOD. Mind the mushroom rings. Do not follow the lights.'),
  signGloamwood: say1(null, 'East road: the Gloamwood. Students may enter only with a bound familiar.'),
  gossipCourtyard1: gossip1,
  gossipCourtyard2: gossip2,
  gateStudent,
  tallow,
  fountain,
  statue: say1(null, 'A gargoyle statue. The plaque reads: "Thornveil Academy. Founded in trust. Funded by House Ravelle."'),
  mainGate: say1(null, 'The gate is locked for the night. Beyond it, the road winds down to the ferry, and home.', 'Not yet.'),
};

export default SCRIPTS_CH1;

/** Used by the Ending scene to describe how Chapter One went. */
export function chapterOneVerdict(devotion: number, clarity: number): string {
  if (devotion >= clarity + 2) return 'Wren is falling, and the fall feels like flying. The raven ribbon is warm against her hair. It feels like a promise. Or a leash.';
  if (clarity >= devotion + 2) return 'Wren has seen the thorns beneath the roses. Lucien will have to try harder. He will.';
  return "Wren's heart is a coin still spinning in the air. Lucien is very patient, and very good at waiting for coins to land.";
}

