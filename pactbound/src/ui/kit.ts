import Phaser from 'phaser';
import { FONT, UI } from '../config';

export interface TextOpts {
  size?: number;
  color?: string;
  /** Word-wrap width in pixels. */
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number;
  font?: string;
  stroke?: string;
}

export function addText(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: o.font ?? FONT,
    fontSize: `${o.size ?? 16}px`,
    color: o.color ?? UI.text,
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? 4,
    wordWrap: o.wrap ? { width: o.wrap } : undefined,
    stroke: o.stroke,
    strokeThickness: o.stroke ? 3 : 0,
  });
}

export interface PanelOpts {
  fill?: number;
  alpha?: number;
  /** Gold inner hairline and corner studs. Default true. */
  gold?: boolean;
}

/** The game's standard window: ink border, deep plum fill, a thin gold inner line. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  g.fillStyle(UI.border, 1).fillRect(x, y, w, h);
  g.fillStyle(o.fill ?? UI.panel, o.alpha ?? 0.97).fillRect(x + 1, y + 1, w - 2, h - 2);
  if (o.gold === false) return;
  g.fillStyle(UI.goldDark, 1);
  g.fillRect(x + 3, y + 2, w - 6, 1);
  g.fillRect(x + 3, y + h - 3, w - 6, 1);
  g.fillRect(x + 2, y + 3, 1, h - 6);
  g.fillRect(x + w - 3, y + 3, 1, h - 6);
  g.fillStyle(UI.gold, 1);
  for (const [cx, cy] of [
    [x + 2, y + 2],
    [x + w - 3, y + 2],
    [x + 2, y + h - 3],
    [x + w - 3, y + h - 3],
  ] as const)
    g.fillRect(cx, cy, 1, 1);
}

export function hpColor(frac: number): number {
  return frac > 0.5 ? UI.hpGood : frac > 0.2 ? UI.hpMid : UI.hpLow;
}

/** A framed bar (HP, XP). */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number): void {
  g.fillStyle(UI.border, 1).fillRect(x, y, w, h);
  g.fillStyle(0x3a2c44, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
  if (fw > 0) {
    g.fillStyle(color, 1).fillRect(x + 1, y + 1, fw, h - 2);
    g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + 1, fw, 1);
  }
}

/** Resolves on the scene's next update with the frame time in seconds. Pauses while the scene is paused or asleep. */
export function nextFrame(scene: Phaser.Scene): Promise<number> {
  return new Promise((resolve) => scene.events.once(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => resolve(dt / 1000)));
}

export async function waitSeconds(scene: Phaser.Scene, s: number): Promise<void> {
  let t = 0;
  while (t < s) t += await nextFrame(scene);
}

/** Promise wrapper around a tween. */
export function tweenAsync(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ ...cfg, onComplete: () => resolve() });
  });
}
