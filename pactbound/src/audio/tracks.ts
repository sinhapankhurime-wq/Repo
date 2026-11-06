import type { TrackId } from '../world/types';

/**
 * Original chiptune loops. Each channel is a list of steps separated by
 * spaces: a note (A4, C#5, Bb3), '-' to hold the previous note, or '.' for
 * silence. '|' marks bar lines and is ignored. Noise channels use
 * k (kick), s (snare) and h (hat).
 */
export type Wave = 'pulse' | 'square' | 'triangle' | 'sine' | 'noise';

export interface Channel {
  wave: Wave;
  vol: number;
  notes: string;
}

export interface Track {
  bpm: number;
  /** Steps per beat: 2 means each step is an eighth note. */
  div: number;
  channels: Channel[];
}

export const TRACKS: Record<TrackId, Track> = {
  // "The Thornveil Waltz" — A minor, 3/4.
  title: {
    bpm: 96,
    div: 2,
    channels: [
      {
        wave: 'pulse',
        vol: 0.15,
        notes: `E5 - - - A4 B4 | C5 - - - B4 A4 | G4 - - - E4 G4 | B4 - - - G#4 - |
                A4 - C5 - E5 - | F5 - E5 - D5 - | E5 - D5 C5 B4 G#4 | A4 - - - - .`,
      },
      {
        wave: 'triangle',
        vol: 0.22,
        notes: `A2 - . . . . | F2 - . . . . | C3 - . . . . | E2 - . . . . |
                A2 - . . . . | D3 - . . . . | E2 - . . . . | A2 - . . . .`,
      },
      {
        wave: 'sine',
        vol: 0.1,
        notes: `. . C4 . C4 . | . . A3 . A3 . | . . E4 . E4 . | . . G#3 . G#3 . |
                . . C4 . C4 . | . . F4 . F4 . | . . G#3 . G#3 . | . . C4 . C4 .`,
      },
      {
        wave: 'sine',
        vol: 0.08,
        notes: `. . E4 . E4 . | . . C4 . C4 . | . . G4 . G4 . | . . B3 . B3 . |
                . . E4 . E4 . | . . A4 . A4 . | . . B3 . B3 . | . . E4 . E4 .`,
      },
    ],
  },
  // Courtyard: wistful D minor.
  academy: {
    bpm: 100,
    div: 2,
    channels: [
      {
        wave: 'pulse',
        vol: 0.12,
        notes: `D5 - F5 - A5 - G5 F5 | F5 - D5 - Bb4 - C5 D5 | C5 - A4 - F4 - A4 C5 | E5 - - - D5 - C5 - |
                D5 - F5 - A5 - C6 A5 | Bb5 - A5 G5 F5 - G5 - | E5 - C#5 - A4 - B4 C#5 | D5 - - - - - . .`,
      },
      {
        wave: 'triangle',
        vol: 0.2,
        notes: `D3 . A3 . D3 . A3 . | Bb2 . F3 . Bb2 . F3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . |
                D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | D3 . A3 . D3 . . .`,
      },
      {
        wave: 'sine',
        vol: 0.07,
        notes: `F4 - - - - - - - | D4 - - - - - - - | A3 - - - - - - - | E4 - - - - - - - |
                F4 - - - - - - - | Bb3 - - - - - - - | C#4 - - - - - - - | F4 - - - - - - -`,
      },
    ],
  },
  // Indoors: a little music box in C.
  interior: {
    bpm: 80,
    div: 2,
    channels: [
      {
        wave: 'triangle',
        vol: 0.15,
        notes: `E5 - G5 - C6 - | B5 - A5 - E5 - | F5 - A5 - C6 - | B5 - - - G5 - |
                E5 - G5 - C6 - | C6 - B5 - A5 - | F5 - E5 - D5 - | C5 - - - . .`,
      },
      {
        wave: 'sine',
        vol: 0.14,
        notes: `C3 - . . . . | A2 - . . . . | F2 - . . . . | G2 - . . . . |
                C3 - . . . . | A2 - . . . . | D3 - . . . . | C3 - . . . .`,
      },
      {
        wave: 'sine',
        vol: 0.06,
        notes: `. . E4 . E4 . | . . C4 . C4 . | . . A3 . A3 . | . . B3 . B3 . |
                . . E4 . E4 . | . . C4 . C4 . | . . F4 . F4 . | . . E4 . E4 .`,
      },
    ],
  },
  // The Gloamwood: sparse E minor with a shimmering arpeggio.
  forest: {
    bpm: 80,
    div: 2,
    channels: [
      {
        wave: 'sine',
        vol: 0.14,
        notes: `E5 - - - G5 - - - | F#5 - E5 - D5 - - - | E5 - - - B4 - - - | D5 - - - A4 - - - |
                E5 - G5 - A5 - B5 - | A5 - G5 - E5 - - - | C5 - - - E5 - D5 - | B4 - - - D#5 - - -`,
      },
      {
        wave: 'triangle',
        vol: 0.18,
        notes: `E2 - - - - - - - | E2 - - - - - - - | C2 - - - - - - - | D2 - - - - - - - |
                E2 - - - - - - - | E2 - - - - - - - | A2 - - - - - - - | B2 - - - - - - -`,
      },
      {
        wave: 'pulse',
        vol: 0.035,
        notes: `. G5 . B5 . G5 . B5 | . G5 . B5 . G5 . B5 | . G5 . C6 . G5 . C6 | . F#5 . A5 . F#5 . A5 |
                . G5 . B5 . G5 . B5 | . G5 . B5 . G5 . B5 | . E5 . A5 . E5 . A5 | . F#5 . B5 . D#5 . B5`,
      },
    ],
  },
  // Lucien's theme: slow C minor, a sigh that falls a semitone at a time.
  lucien: {
    bpm: 66,
    div: 2,
    channels: [
      {
        wave: 'sine',
        vol: 0.16,
        notes: `G5 - - - Eb5 - D5 Eb5 | C5 - - - - - . . | Ab5 - G5 - F5 - Eb5 - | D5 - - - B4 - - - |
                G5 - - - Eb5 - D5 Eb5 | F5 - Eb5 - C5 - . . | Db5 - C5 - Bb4 - Ab4 - | G4 - - - B4 - D5 -`,
      },
      {
        wave: 'triangle',
        vol: 0.2,
        notes: `C2 - - - G2 - - - | Ab1 - - - Eb2 - - - | F2 - - - C3 - - - | G1 - - - D2 - - - |
                C2 - - - G2 - - - | Ab1 - - - Eb2 - - - | Db2 - - - Ab2 - - - | G1 - - - B1 - D2 -`,
      },
      {
        wave: 'pulse',
        vol: 0.045,
        notes: `Eb4 - - - - - - - | C4 - - - - - - - | Ab3 - - - - - - - | B3 - - - - - - - |
                Eb4 - - - - - - - | C4 - - - - - - - | F4 - - - - - - - | B3 - - - - - - -`,
      },
    ],
  },
  battle: {
    bpm: 152,
    div: 2,
    channels: [
      {
        wave: 'pulse',
        vol: 0.12,
        notes: `A4 . A4 C5 . A4 E5 . | D5 . C5 . B4 . C5 . | A4 . A4 C5 . A4 F5 . | E5 . D5 . B4 . G4 . |
                A5 . G5 E5 . C5 D5 . | E5 . D5 C5 . B4 A4 . | F5 . E5 D5 . C5 D5 . | E5 - - . G#4 . B4 .`,
      },
      {
        wave: 'triangle',
        vol: 0.24,
        notes: `A2 A2 A3 A2 A2 A2 A3 A2 | A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 |
                A2 A2 A3 A2 A2 A2 A3 A2 | A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 E3 E2`,
      },
      { wave: 'noise', vol: 0.1, notes: 'k . h . s . h . | k . h k s . h .' },
    ],
  },
  // Dueling Lucien: the battle theme dragged into his key.
  duel: {
    bpm: 140,
    div: 2,
    channels: [
      {
        wave: 'pulse',
        vol: 0.12,
        notes: `C5 . Eb5 . G5 . Gb5 F5 | Eb5 . D5 . C5 . B4 . | C5 . Eb5 . G5 . Ab5 . | G5 . F5 . Eb5 . D5 . |
                Ab4 . C5 . Eb5 . F5 G5 | Ab5 . G5 . F5 . Eb5 . | D5 . F5 . Ab5 . G5 F5 | G5 - - . B4 . D5 .`,
      },
      {
        wave: 'triangle',
        vol: 0.24,
        notes: `C2 C2 C3 C2 C2 C2 C3 C2 | C2 C2 C3 C2 C2 C2 C3 C2 | C2 C2 C3 C2 C2 C2 C3 C2 | G1 G1 G2 G1 G1 G1 G2 G1 |
                Ab1 Ab1 Ab2 Ab1 Ab1 Ab1 Ab2 Ab1 | Ab1 Ab1 Ab2 Ab1 Ab1 Ab1 Ab2 Ab1 | F2 F2 F3 F2 F2 F2 F3 F2 | G1 G1 G2 G1 G1 G1 G2 G1`,
      },
      { wave: 'noise', vol: 0.1, notes: 'k . h k s . h . | k . h . s . h h' },
    ],
  },
};
