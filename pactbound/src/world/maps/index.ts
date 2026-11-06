import type { MapDef, MapId } from '../types';
import { courtyard } from './courtyard';
import { gloamwood } from './gloamwood';
import { conservatory, dormitory, duelingHall, library } from './interiors';

export const MAPS: Record<MapId, MapDef> = { courtyard, conservatory, dormitory, library, duelingHall, gloamwood };

export function getMap(id: string): MapDef {
  return MAPS[id as MapId] ?? courtyard;
}
