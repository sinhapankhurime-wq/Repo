import type { TrackId } from '../world/types';
import { TRACKS, type Channel, type Track, type Wave } from './tracks';

/**
 * A tiny WebAudio synth: square/pulse/triangle/sine voices and a noise
 * channel for music, plus one-shot sound effects. Nothing is loaded from disk.
 * Audio starts on the first key press or tap (browsers require a gesture).
 */
export type Sfx =
  | 'blip' | 'select' | 'confirm' | 'cancel' | 'bump' | 'door' | 'encounter'
  | 'hit' | 'hitStrong' | 'hitWeak' | 'miss' | 'heal' | 'faint' | 'statUp' | 'statDown'
  | 'sigil' | 'caught' | 'broke' | 'levelUp' | 'heart' | 'clarity' | 'save' | 'item' | 'ascend' | 'thud';

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFreq(note: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) return null;
  let semi = NOTE_INDEX[m[1] as string] as number;
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  const midi = 12 * (Number(m[3]) + 1) + semi;
  return 440 * 2 ** ((midi - 69) / 12);
}

interface ParsedChannel {
  ch: Channel;
  steps: string[];
}

function parse(track: Track): ParsedChannel[] {
  return track.channels.map((ch) => ({ ch, steps: ch.notes.split(/\s+/).filter((t) => t && t !== '|') }));
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private pulseWave!: PeriodicWave;
  private current: TrackId | null = null;
  private wanted: TrackId | null = null;
  private parsed: ParsedChannel[] = [];
  private step = 0;
  private nextTime = 0;
  private stepDur = 0.25;
  private timer: number | null = null;
  musicOn = true;
  sfxOn = true;

  /** Creates or resumes the audio context. Safe to call on every input event. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0;
        this.sfxBus.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        // 25% duty pulse for that handheld sound.
        const n = 32;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let k = 1; k < n; k++) {
          real[k] = Math.sin(2 * Math.PI * k * 0.25) / (Math.PI * k);
          imag[k] = (1 - Math.cos(2 * Math.PI * k * 0.25)) / (Math.PI * k);
        }
        this.pulseWave = this.ctx.createPeriodicWave(real, imag);
        if (this.wanted) this.music(this.wanted);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  /** Switches the background loop (no-op if it is already playing). null stops music. */
  music(id: TrackId | null): void {
    this.wanted = id;
    if (!this.ctx || id === this.current) return;
    this.current = id;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!id) return;
    const track = TRACKS[id];
    this.parsed = parse(track);
    this.step = 0;
    this.stepDur = 60 / track.bpm / track.div;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.15) {
      for (const p of this.parsed) {
        const tok = p.steps[this.step % p.steps.length] as string;
        if (tok === '.' || tok === '-') continue;
        if (p.ch.wave === 'noise') {
          this.drum(tok, this.nextTime, p.ch.vol);
          continue;
        }
        let hold = 1;
        while (p.steps[(this.step + hold) % p.steps.length] === '-' && hold < p.steps.length) hold += 1;
        const f = noteFreq(tok);
        if (f) this.voice(p.ch.wave, f, this.nextTime, hold * this.stepDur, p.ch.vol, this.musicBus);
      }
      this.nextTime += this.stepDur;
      this.step += 1;
    }
  }

  private osc(wave: Wave, freq: number, at: number): OscillatorNode {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    if (wave === 'pulse') o.setPeriodicWave(this.pulseWave);
    else o.type = wave === 'noise' ? 'square' : wave;
    o.frequency.setValueAtTime(freq, at);
    return o;
  }

  private voice(wave: Wave, freq: number, at: number, dur: number, vol: number, bus: GainNode): void {
    const ctx = this.ctx as AudioContext;
    const o = this.osc(wave, freq, at);
    const g = ctx.createGain();
    const end = at + Math.max(0.05, dur * 0.95);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.setValueAtTime(vol * 0.8, Math.max(at + 0.02, end - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(end + 0.02);
  }

  private noiseBurst(at: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, bus: GainNode): void {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  private drum(tok: string, at: number, vol: number): void {
    const ctx = this.ctx as AudioContext;
    if (tok === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      g.gain.setValueAtTime(vol * 2.2, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      o.connect(g).connect(this.musicBus);
      o.start(at);
      o.stop(at + 0.16);
    } else if (tok === 's') this.noiseBurst(at, 0.12, vol * 1.2, 'bandpass', 1800, this.musicBus);
    else if (tok === 'h') this.noiseBurst(at, 0.04, vol * 0.6, 'highpass', 6000, this.musicBus);
  }

  private seq(wave: Wave, notes: [string, number][], vol: number, gap = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    let t = ctx.currentTime + 0.005;
    for (const [n, d] of notes) {
      const f = noteFreq(n);
      if (f) this.voice(wave, f, t, d, vol, this.sfxBus);
      t += d + gap;
    }
  }

  private sweep(wave: Wave, from: number, to: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const at = ctx.currentTime + 0.005;
    const o = this.osc(wave, from, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  sfx(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn) return;
    const now = ctx.currentTime + 0.005;
    switch (name) {
      case 'blip':
        return this.seq('pulse', [['A6', 0.018]], 0.05);
      case 'select':
        return this.seq('pulse', [['E6', 0.03]], 0.08);
      case 'confirm':
        return this.seq('pulse', [['E6', 0.04], ['B6', 0.06]], 0.09);
      case 'cancel':
        return this.seq('pulse', [['B5', 0.04], ['E5', 0.06]], 0.08);
      case 'bump':
        return this.sweep('triangle', 160, 70, 0.08, 0.22);
      case 'thud':
        return this.sweep('triangle', 110, 40, 0.25, 0.35);
      case 'door':
        this.noiseBurst(now, 0.25, 0.18, 'lowpass', 900, this.sfxBus);
        return this.sweep('triangle', 220, 110, 0.2, 0.15);
      case 'encounter':
        return this.seq('pulse', [['E5', 0.05], ['G5', 0.05], ['B5', 0.05], ['E6', 0.05], ['G6', 0.05], ['B6', 0.12]], 0.1);
      case 'hit':
        this.noiseBurst(now, 0.12, 0.3, 'lowpass', 2400, this.sfxBus);
        return this.sweep('square', 300, 90, 0.1, 0.12);
      case 'hitStrong':
        this.noiseBurst(now, 0.2, 0.42, 'lowpass', 3200, this.sfxBus);
        return this.sweep('square', 420, 60, 0.18, 0.16);
      case 'hitWeak':
        return this.noiseBurst(now, 0.07, 0.18, 'lowpass', 1400, this.sfxBus);
      case 'miss':
        return this.noiseBurst(now, 0.16, 0.12, 'highpass', 3000, this.sfxBus);
      case 'heal':
        return this.seq('sine', [['C5', 0.06], ['E5', 0.06], ['G5', 0.06], ['C6', 0.14]], 0.14);
      case 'faint':
        return this.sweep('square', 520, 60, 0.6, 0.12);
      case 'statUp':
        return this.seq('pulse', [['C5', 0.04], ['E5', 0.04], ['G5', 0.04], ['C6', 0.06]], 0.08);
      case 'statDown':
        return this.seq('pulse', [['C6', 0.04], ['G5', 0.04], ['E5', 0.04], ['C5', 0.06]], 0.08);
      case 'sigil':
        return this.seq('sine', [['E6', 0.08], ['B6', 0.18]], 0.12);
      case 'caught':
        return this.seq('pulse', [['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.08], ['G5', 0.08], ['C6', 0.3]], 0.12);
      case 'broke':
        return this.sweep('pulse', 880, 220, 0.25, 0.12);
      case 'levelUp':
        return this.seq('pulse', [['G5', 0.08], ['G5', 0.08], ['G5', 0.08], ['C6', 0.32]], 0.12, 0.02);
      case 'item':
        return this.seq('pulse', [['C6', 0.07], ['E6', 0.07], ['G6', 0.07], ['C7', 0.2]], 0.09);
      case 'heart':
        return this.seq('sine', [['B5', 0.12], ['E6', 0.3]], 0.12);
      case 'clarity':
        return this.seq('triangle', [['E6', 0.06], ['B6', 0.06], ['E7', 0.24]], 0.1);
      case 'save':
        return this.seq('sine', [['G5', 0.08], ['D6', 0.08], ['G6', 0.25]], 0.12);
      case 'ascend':
        return this.seq('pulse', [['C5', 0.1], ['E5', 0.1], ['G5', 0.1], ['C6', 0.1], ['E6', 0.1], ['G6', 0.1], ['C7', 0.5]], 0.12);
    }
  }
}

export const sound = new SoundSystem();
