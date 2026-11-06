import { createFamiliar } from '../core/familiar';
import type { Speaker } from '../data/cast';
import { TRAINERS, type TrainerId } from '../data/trainers';
import type { ScriptApi } from './api';

/** Optional duels with students around the academy. */
export async function trainerEncounter(s: ScriptApi, id: TrainerId, npcId: string): Promise<void> {
  const t = TRAINERS[id];
  const who: Speaker = { name: t.name, color: 0xb8a8c8 };
  if (s.state.defeated.includes(id)) {
    await s.say(who, t.after);
    return;
  }
  await s.actor(npcId)?.emote('!');
  await s.say(who, t.intro);
  const outcome = await s.battle({
    kind: 'trainer',
    trainerName: t.name,
    trainerLook: t.look,
    foe: t.team.map((m) => createFamiliar(m.species, m.level)),
    ai: t.ai,
    reward: t.reward,
    loseLine: t.defeat,
  });
  if (outcome === 'win') {
    s.state.defeated.push(id);
    await s.say(who, t.after);
  } else if (outcome === 'lose') {
    await s.blackout();
  }
}

export const isTouch = () => typeof document !== 'undefined' && document.body.classList.contains('touch');
