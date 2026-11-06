import type Phaser from 'phaser';
import { TILE, WALK_TIME } from '../config';
import type { Dir } from '../core/state';
import type { LookId } from '../data/cast';
import { personFrame } from '../gfx/people';
import { personKey } from '../gfx/textures';
import { tweenAsync, waitSeconds } from '../ui/kit';

export const DIR_VEC: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const opposite = (d: Dir): Dir => (d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left');

export type Emote = '!' | '?' | 'heart' | '...' | 'note';

/** Anyone walking around the overworld: Wren, NPCs, and actors spawned by cutscenes. */
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  tx = 0;
  ty = 0;
  facing: Dir;
  /** Spawned by a script: kept until the script despawns it or the map changes. */
  scripted = false;
  private phase: 1 | 2 = 1;

  constructor(
    readonly scene: Phaser.Scene,
    readonly id: string,
    look: LookId,
    tx: number,
    ty: number,
    facing: Dir,
  ) {
    this.facing = facing;
    this.shadow = scene.add.image(0, 0, 'icon:shadow').setDepth(-5);
    this.sprite = scene.add.sprite(0, 0, personKey(look), personFrame(facing, 0)).setOrigin(0.5, 1);
    this.place(tx, ty);
  }

  static px(tx: number): number {
    return tx * TILE + TILE / 2;
  }

  static py(ty: number): number {
    return ty * TILE + TILE - 1;
  }

  get x(): number {
    return this.tx;
  }

  get y(): number {
    return this.ty;
  }

  place(tx: number, ty: number): void {
    this.tx = tx;
    this.ty = ty;
    this.setPixel(Actor.px(tx), Actor.py(ty));
  }

  setPixel(x: number, y: number): void {
    this.sprite.setPosition(Math.round(x), Math.round(y));
    this.shadow.setPosition(Math.round(x), Math.round(y) - 1);
    this.sprite.setDepth(y);
  }

  face(dir: Dir): void {
    this.facing = dir;
    this.sprite.setFrame(personFrame(dir, 0));
  }

  showFrame(phase: 0 | 1 | 2): void {
    this.sprite.setFrame(personFrame(this.facing, phase));
  }

  /** Alternates which foot leads, tile by tile. */
  nextPhase(): 1 | 2 {
    this.phase = this.phase === 1 ? 2 : 1;
    return this.phase;
  }

  /** Walks one tile (no collision checks: cutscenes decide where people go). */
  async walk(dir: Dir, seconds = WALK_TIME): Promise<void> {
    this.face(dir);
    const [dx, dy] = DIR_VEC[dir];
    const from = { x: Actor.px(this.tx), y: Actor.py(this.ty) };
    this.tx += dx;
    this.ty += dy;
    const phase = this.nextPhase();
    this.showFrame(phase);
    const proxy = { ...from };
    await tweenAsync(this.scene, {
      targets: proxy,
      x: Actor.px(this.tx),
      y: Actor.py(this.ty),
      duration: seconds * 1000,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        this.setPixel(proxy.x, proxy.y);
        if (tween.progress > 0.5) this.showFrame(0);
      },
    });
    this.place(this.tx, this.ty);
    this.showFrame(0);
  }

  async walkPath(dirs: readonly Dir[], seconds = WALK_TIME): Promise<void> {
    for (const d of dirs) await this.walk(d, seconds);
  }

  async emote(kind: Emote): Promise<void> {
    const icon = this.scene.add
      .image(this.sprite.x, this.sprite.y - 25, `icon:emote:${kind}`)
      .setOrigin(0.5, 1)
      .setDepth(100000)
      .setScale(0.2);
    await tweenAsync(this.scene, { targets: icon, scale: 1, duration: 140, ease: 'Back.easeOut' });
    await waitSeconds(this.scene, 0.75);
    icon.destroy();
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
