/**
 * Dev-only art gallery (open /gallery.html under `npm run dev`). Renders every
 * procedurally generated sprite so art changes can be reviewed without
 * playing through the game.
 */
import { LOOKS, type LookId } from './data/cast';
import { SPECIES, SPECIES_IDS } from './data/species';
import { drawFamiliar } from './gfx/familiars';
import { drawPersonSheet } from './gfx/people';
import { renderMap } from './gfx/tiles';
import { MAPS } from './world/maps';

const out = document.getElementById('out') as HTMLElement;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  out.append(h, row);
  return row;
}

function show(row: HTMLElement, src: HTMLCanvasElement, scale: number, label: string, flip = false): void {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(c, cap);
  row.append(fig);
}

const fam = section('Familiars (2x)');
for (const id of SPECIES_IDS) show(fam, drawFamiliar(id), 2, SPECIES[id].name);
const famFlip = section('Familiars, player side (mirrored, 1x)');
for (const id of SPECIES_IDS) show(famFlip, drawFamiliar(id), 1, SPECIES[id].name, true);
const people = section('Cast sprite sheets (3x)');
for (const id of Object.keys(LOOKS) as LookId[]) show(people, drawPersonSheet(LOOKS[id]), 3, id);

const maps = section('Maps (frame 0, 2x)');
for (const m of Object.values(MAPS)) show(maps, renderMap(m.rows, m.ground, 0).toCanvas(), 2, m.name);

(window as unknown as { galleryReady: boolean }).galleryReady = true;
