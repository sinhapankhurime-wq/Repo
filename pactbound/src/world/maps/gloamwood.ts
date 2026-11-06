import { all, F, has, lacks } from '../../story/flags';
import type { MapDef } from '../types';

/** The misty wood beyond the east wall. Wild familiars, two duels, and an old shrine. */
export const gloamwood: MapDef = {
  id: 'gloamwood',
  name: 'The Gloamwood',
  ground: '.',
  outdoor: true,
  music: 'forest',
  battleBg: 'forest',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTT...s...TTTTTTTTTT',
    'TTTTTTTT."""o""".TTTTTTTTT',
    'TTTTTTTT.""""""".TTTTTTTTT',
    'TTTTTTTTT.....:.TT.wwww.TT',
    'TTT"""""".....:....wwww.TT',
    'TTT"""""".r...:....wwww.TT',
    'TTT"""""".....:.........TT',
    'TTTT""""......:........TTT',
    'T.............:.........TT',
    ':::::::::::::::........TTT',
    'T......,......:..........T',
    'TT..r.........:"""""""..TT',
    'TTT..........::"""""""".TT',
    'TTT...""""...:."""""""".TT',
    'TTT...""""...:..""""""..TT',
    'TTTT.........:.......oTTTT',
    'TTTTT.......::::::....TTTT',
    'TTTTTTTTTTT.......TTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [{ x: 0, y: 10, to: 'courtyard', tx: 26, ty: 11, dir: 'left' }],
  npcs: [
    { id: 'bram', look: 'studentA', x: 6, y: 11, dir: 'right', trainer: 'bram' },
    { id: 'ivy', look: 'studentE', x: 18, y: 9, dir: 'left', trainer: 'ivy' },
    { id: 'seraphine', look: 'seraphine', x: 12, y: 2, dir: 'down', talk: 'seraphine', when: all(has(F.libraryScene), lacks(F.metSeraphine), lacks(F.lucienDuel)) },
  ],
  things: [
    { x: 12, y: 1, talk: 'shrine' },
    { x: 1, y: 9, talk: 'signForest', sprite: 'sign' },
  ],
  pickups: [
    { x: 3, y: 9, id: 'gw_sigils', item: 'sigil', qty: 2 },
    { x: 23, y: 7, id: 'gw_tonics', item: 'tonic', qty: 2 },
    { x: 21, y: 16, id: 'gw_silver', item: 'silverSigil', qty: 1 },
    { x: 9, y: 6, id: 'gw_remedy', item: 'remedy', qty: 1 },
  ],
  triggers: [],
  encounters: [
    {
      area: [8, 1, 9, 3],
      rate: 0.14,
      table: [
        { species: 'glimmoth', min: 5, max: 7, weight: 50 },
        { species: 'puffwisp', min: 5, max: 7, weight: 35 },
        { species: 'dearling', min: 5, max: 6, weight: 15 },
      ],
    },
    {
      rate: 0.11,
      table: [
        { species: 'puffwisp', min: 3, max: 5, weight: 30 },
        { species: 'mycelf', min: 3, max: 6, weight: 25 },
        { species: 'flittermouse', min: 4, max: 6, weight: 20 },
        { species: 'blotling', min: 4, max: 6, weight: 15 },
        { species: 'tomelet', min: 3, max: 5, weight: 10 },
      ],
    },
  ],
  onEnter: 'gloamwoodEnter',
};
