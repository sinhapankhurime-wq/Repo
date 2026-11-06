import type { Script } from './api';
import chapterOne from './chapter1';

/** Every script a map, NPC or object can refer to by id. Add new chapters here. */
export const SCRIPTS: Record<string, Script> = {
  ...chapterOne,
};
