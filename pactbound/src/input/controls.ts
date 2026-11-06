import type { Dir } from '../core/state';

/** The game's virtual buttons. Keyboard and the touch pad both feed into these. */
export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu';

const DIRS: readonly Button[] = ['up', 'down', 'left', 'right'];

const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'a',
  Enter: 'a',
  Space: 'a',
  KeyX: 'b',
  Backspace: 'b',
  ShiftLeft: 'b',
  ShiftRight: 'b',
  Escape: 'menu',
  KeyC: 'menu',
  Tab: 'menu',
};

const REPEAT_DELAY = 0.32;
const REPEAT_EVERY = 0.11;

/**
 * Presses that arrive between frames are collected in `incoming`. At the start
 * of each frame they become `current`, where they stay readable for the whole
 * frame, including async UI code that resumes after the scene update (promise
 * continuations run after Phaser's step, before the next frame). consume('a')
 * takes a press so only one consumer reacts to it. Held directions auto-repeat.
 */
class Controls {
  private held = new Set<Button>();
  private heldOrder: Button[] = [];
  private incoming: Button[] = [];
  private current: Button[] = [];
  private holdTime = new Map<Button, number>();
  private repeatAt = new Map<Button, number>();
  /** Called on every press (used to unlock audio on the first gesture). */
  onAnyPress: (() => void) | null = null;

  press(b: Button): void {
    if (this.held.has(b)) return;
    this.held.add(b);
    this.heldOrder.push(b);
    this.incoming.push(b);
    this.holdTime.set(b, 0);
    this.repeatAt.set(b, REPEAT_DELAY);
    this.onAnyPress?.();
  }

  release(b: Button): void {
    this.held.delete(b);
    this.heldOrder = this.heldOrder.filter((x) => x !== b);
  }

  releaseAll(): void {
    this.held.clear();
    this.heldOrder = [];
  }

  isDown(b: Button): boolean {
    return this.held.has(b);
  }

  /** The most recently pressed direction that is still held. */
  heldDir(): Dir | null {
    for (let i = this.heldOrder.length - 1; i >= 0; i--) {
      const b = this.heldOrder[i] as Button;
      if (DIRS.includes(b)) return b as Dir;
    }
    return null;
  }

  /** True once per press (or auto-repeat) of `b` this frame. */
  consume(b: Button): boolean {
    const i = this.current.indexOf(b);
    if (i < 0) return false;
    this.current.splice(i, 1);
    return true;
  }

  /** Forgets every unread press (used when switching between screens). */
  flush(): void {
    this.current.length = 0;
    this.incoming.length = 0;
  }

  /** Starts a frame: publishes new presses and auto-repeats. Call before scenes update. */
  beginFrame(dt: number): void {
    this.current = this.incoming;
    this.incoming = [];
    for (const b of this.held) {
      if (!DIRS.includes(b)) continue;
      const t = (this.holdTime.get(b) ?? 0) + dt;
      this.holdTime.set(b, t);
      const next = this.repeatAt.get(b) ?? REPEAT_DELAY;
      if (t >= next) {
        this.current.push(b);
        this.repeatAt.set(b, next + REPEAT_EVERY);
      }
    }
  }

  bindKeyboard(target: Window): void {
    target.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) this.press(b);
    });
    target.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) this.release(b);
    });
    target.addEventListener('blur', () => this.releaseAll());
  }
}

export const controls = new Controls();
