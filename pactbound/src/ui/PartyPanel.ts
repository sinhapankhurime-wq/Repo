import type Phaser from 'phaser';
import { sound } from '../audio/sound';
import { UI } from '../config';
import { displayName, isFainted, maxHp, type Familiar } from '../core/familiar';
import { ARCANA_INFO } from '../data/arcana';
import { STATUS_INFO } from '../data/moves';
import { SPECIES } from '../data/species';
import { famKey } from '../gfx/textures';
import { controls } from '../input/controls';
import { addText, drawBar, drawPanel, hpColor, nextFrame } from './kit';

const X = 6;
const Y = 6;
const W = 468;
const ROW_H = 36;

/** A list of familiars with HP, level and status. Used for switching in battle and in the Journal menu. */
export class PartyPanel {
  index = 0;
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly cursor: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly party: Familiar[],
    title: string,
    depth = 700,
    initial = 0,
  ) {
    this.index = Math.max(0, Math.min(initial, party.length - 1));
    this.g = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.g]).setDepth(depth);
    const h = 30 + Math.max(1, party.length) * ROW_H;
    drawPanel(this.g, X, Y, W, h);
    this.container.add(addText(scene, X + 14, Y + 6, title, { color: UI.textGold }));
    party.forEach((f, i) => {
      const y = Y + 28 + i * ROW_H;
      const icon = scene.add.image(X + 32, y + ROW_H - 4, famKey(f.species)).setOrigin(0.5, 1).setScale(0.5);
      if (isFainted(f)) icon.setAlpha(0.45);
      const name = addText(scene, X + 52, y + 2, `${displayName(f)}`, { color: isFainted(f) ? UI.textDim : UI.text });
      const lv = addText(scene, X + 200, y + 2, `Lv ${f.level}`, { color: UI.textDim });
      const types = SPECIES[f.species].types.map((t) => ARCANA_INFO[t].name).join('/');
      const typeText = addText(scene, X + 52, y + 18, types, { color: '#c8b8d8' });
      const status = f.status ? STATUS_INFO[f.status].short : isFainted(f) ? 'OUT' : '';
      const statusText = addText(scene, X + 200, y + 18, status, {
        color: f.status ? `#${STATUS_INFO[f.status].color.toString(16)}` : '#e8584a',
      });
      const hp = addText(scene, X + W - 16, y + 18, `${f.hp}/${maxHp(f)}`, { color: UI.textDim }).setOrigin(1, 0);
      this.container.add([icon, name, lv, typeText, statusText, hp]);
      const frac = f.hp / maxHp(f);
      drawBar(this.g, X + 262, y + 8, W - 278, 7, frac, hpColor(frac));
    });
    if (party.length === 0) this.container.add(addText(scene, X + 52, Y + 34, 'No familiars yet.', { color: UI.textDim }));
    this.cursor = scene.add.image(X + 10, 0, 'icon:cursor').setOrigin(0, 0.5);
    this.container.add(this.cursor);
    this.place();
  }

  private place(): void {
    this.cursor.setY(Y + 28 + this.index * ROW_H + ROW_H / 2 - 2);
    this.cursor.setVisible(this.party.length > 0);
  }

  /** Returns the chosen index, or -1 when cancelled (only if `cancelable`). */
  async pick(cancelable = true): Promise<number> {
    for (;;) {
      await nextFrame(this.scene);
      const n = this.party.length;
      if (n > 0 && controls.consume('up')) {
        this.index = (this.index + n - 1) % n;
        sound.sfx('select');
        this.place();
      }
      if (n > 0 && controls.consume('down')) {
        this.index = (this.index + 1) % n;
        sound.sfx('select');
        this.place();
      }
      if (n > 0 && controls.consume('a')) {
        sound.sfx('confirm');
        return this.index;
      }
      if (cancelable && controls.consume('b')) {
        sound.sfx('cancel');
        return -1;
      }
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  destroy(): void {
    this.container.destroy();
  }
}
