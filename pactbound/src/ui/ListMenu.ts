import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { UI } from '../config';
import { controls } from '../input/controls';
import { addText, drawPanel, nextFrame } from './kit';

export interface MenuItem {
  label: string;
  /** Right-aligned extra text (a count, a price). */
  right?: string;
  disabled?: boolean;
  color?: string;
}

export interface ListMenuOpts {
  x: number;
  y: number;
  w: number;
  items: MenuItem[];
  rowH?: number;
  /** Visible rows; the list scrolls beyond this. */
  rows?: number;
  cols?: number;
  depth?: number;
  panel?: boolean;
  size?: number;
}

/**
 * A cursor menu: vertical lists, scrolling lists and small grids (the battle
 * command box is 2x2). Call poll() every frame, or await pick().
 */
export class ListMenu {
  index = 0;
  private top = 0;
  private items: MenuItem[] = [];
  private readonly rowH: number;
  private readonly rows: number;
  private readonly cols: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly rights: Phaser.GameObjects.Text[] = [];
  private readonly arrows: Phaser.GameObjects.Text;
  /** Called when the highlighted item changes. */
  onMove: ((i: number) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: ListMenuOpts,
  ) {
    this.rowH = o.rowH ?? 18;
    this.cols = o.cols ?? 1;
    this.rows = o.rows ?? Math.ceil(o.items.length / this.cols);
    this.container = scene.add.container(0, 0).setDepth(o.depth ?? 500);
    this.g = scene.add.graphics();
    this.container.add(this.g);
    const colW = (o.w - 20) / this.cols;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const x = o.x + 18 + c * colW;
        const y = o.y + 7 + r * this.rowH;
        const label = addText(scene, x, y, '', { size: o.size ?? 16 });
        const right = addText(scene, x + colW - 8, y, '', { size: o.size ?? 16, color: UI.textDim }).setOrigin(1, 0);
        this.labels.push(label);
        this.rights.push(right);
        this.container.add([label, right]);
      }
    this.cursor = scene.add.image(0, 0, 'icon:cursor').setOrigin(0, 0);
    this.arrows = addText(scene, o.x + o.w - 14, o.y + 2, '', { size: 16, color: UI.textGold });
    this.container.add([this.cursor, this.arrows]);
    this.setItems(o.items);
  }

  get height(): number {
    return this.rows * this.rowH + 12;
  }

  setItems(items: MenuItem[], keepIndex = false): void {
    this.items = items;
    if (!keepIndex) {
      this.index = Math.max(0, items.findIndex((i) => !i.disabled));
      this.top = 0;
    }
    this.index = Math.min(this.index, Math.max(0, items.length - 1));
    this.redraw();
  }

  setVisible(v: boolean): this {
    this.container.setVisible(v);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private redraw(): void {
    const { x, y, w } = this.o;
    this.g.clear();
    if (this.o.panel !== false) drawPanel(this.g, x, y, w, this.height);
    const perPage = this.rows * this.cols;
    if (this.cols === 1) {
      if (this.index < this.top) this.top = this.index;
      if (this.index >= this.top + this.rows) this.top = this.index - this.rows + 1;
    }
    for (let i = 0; i < perPage; i++) {
      const item = this.items[this.top + i];
      const label = this.labels[i] as Phaser.GameObjects.Text;
      const right = this.rights[i] as Phaser.GameObjects.Text;
      label.setText(item?.label ?? '');
      label.setColor(item?.disabled ? UI.textDim : (item?.color ?? UI.text));
      right.setText(item?.right ?? '');
    }
    const slot = this.index - this.top;
    const target = this.labels[slot];
    if (target && this.items.length > 0) {
      this.cursor.setVisible(true).setPosition(target.x - 11, target.y + 4);
    } else this.cursor.setVisible(false);
    const more = this.cols === 1 && this.items.length > this.rows;
    this.arrows.setText(more ? `${this.top > 0 ? '^' : ' '}\n${'\n'.repeat(Math.max(0, this.rows - 2))}${this.top + this.rows < this.items.length ? 'v' : ' '}` : '');
  }

  private move(delta: number): void {
    if (this.items.length === 0) return;
    let i = this.index;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + delta + this.items.length) % this.items.length;
      if (!this.items[i]?.disabled || n === this.items.length - 1) break;
    }
    if (i !== this.index) {
      this.index = i;
      sound.sfx('select');
      this.redraw();
      this.onMove?.(i);
    }
  }

  /** Reads this frame's input. Returns the chosen index, -1 on cancel, or null if nothing happened. */
  poll(cancelable = true): number | null {
    if (this.cols > 1) {
      if (controls.consume('left') && this.index % this.cols > 0) this.move(-1);
      if (controls.consume('right') && this.index % this.cols < this.cols - 1 && this.index + 1 < this.items.length) this.move(1);
      if (controls.consume('up') && this.index - this.cols >= 0) this.move(-this.cols);
      if (controls.consume('down') && this.index + this.cols < this.items.length) this.move(this.cols);
    } else {
      if (controls.consume('up')) this.move(-1);
      if (controls.consume('down')) this.move(1);
    }
    if (controls.consume('a')) {
      const item = this.items[this.index];
      if (item && !item.disabled) {
        sound.sfx('confirm');
        return this.index;
      }
      sound.sfx('bump');
    }
    if (cancelable && controls.consume('b')) {
      sound.sfx('cancel');
      return -1;
    }
    return null;
  }

  async pick(cancelable = true): Promise<number> {
    for (;;) {
      await nextFrame(this.scene);
      const r = this.poll(cancelable);
      if (r !== null) return r;
    }
  }
}
