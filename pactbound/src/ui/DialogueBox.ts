import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { GAME_W, UI } from '../config';
import type { Speaker } from '../data/cast';
import { controls } from '../input/controls';
import { addText, drawPanel, nextFrame } from './kit';

export interface LineStyle {
  /** Wren's inner voice: dim lilac text. */
  thought?: boolean;
  /** Lucien leaning close: rose-violet text, slower typing. */
  whisper?: boolean;
}

const BOX_X = 6;
const BOX_Y = 236;
const BOX_W = GAME_W - 12;
const BOX_H = 78;
const LINES_PER_PAGE = 3;
const CHARS_PER_SEC = 58;

/** The talk window at the bottom of the screen: name plate, typewriter text, and a blinking "more" arrow. */
export class DialogueBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly nameG: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly more: Phaser.GameObjects.Image;
  private blink = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    drawPanel(this.g, BOX_X, BOX_Y, BOX_W, BOX_H);
    this.nameG = scene.add.graphics();
    this.name = addText(scene, BOX_X + 16, BOX_Y - 15, '', { size: 16 });
    this.body = addText(scene, BOX_X + 14, BOX_Y + 9, '', { wrap: BOX_W - 30, lineSpacing: 5 });
    this.more = scene.add.image(BOX_X + BOX_W - 18, BOX_Y + BOX_H - 12, 'icon:more').setVisible(false);
    this.container = scene.add.container(0, 0, [this.g, this.nameG, this.name, this.body, this.more]).setDepth(900).setVisible(false);
  }

  get isOpen(): boolean {
    return this.container.visible;
  }

  open(speaker: Speaker | null): void {
    this.container.setVisible(true);
    this.nameG.clear();
    if (speaker) {
      this.name.setText(speaker.name).setColor(`#${speaker.color.toString(16).padStart(6, '0')}`);
      const w = Math.ceil(this.name.width) + 20;
      drawPanel(this.nameG, BOX_X + 6, BOX_Y - 19, w, 21);
      this.nameG.fillStyle(speaker.color, 1).fillRect(BOX_X + 9, BOX_Y - 15, 2, 13);
      this.name.setVisible(true);
    } else {
      this.name.setVisible(false);
    }
  }

  close(): void {
    this.container.setVisible(false);
    this.body.setText('');
    this.more.setVisible(false);
  }

  /** Splits text into pages of three wrapped lines. */
  private paginate(text: string): string[] {
    this.body.setText('');
    const lines = this.body.getWrappedText(text);
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE).join('\n'));
    return pages.length ? pages : [''];
  }

  /** Types the text out page by page; resolves once the player has read the last page. */
  async say(speaker: Speaker | null, text: string, style: LineStyle = {}): Promise<void> {
    this.open(speaker);
    this.body.setColor(style.thought ? '#c9b8e6' : style.whisper ? '#f0c6ec' : UI.text);
    const cps = style.whisper ? CHARS_PER_SEC * 0.6 : CHARS_PER_SEC;
    for (const page of this.paginate(text)) {
      let shown = 0;
      let acc = 0;
      this.more.setVisible(false);
      while (shown < page.length) {
        const dt = await nextFrame(this.scene);
        if (controls.consume('a') || controls.consume('b')) {
          shown = page.length;
          break;
        }
        acc += dt * cps;
        const n = Math.floor(acc);
        if (n > 0) {
          acc -= n;
          const before = shown;
          shown = Math.min(page.length, shown + n);
          if (Math.floor(shown / 3) !== Math.floor(before / 3) && page[shown - 1] !== ' ') sound.sfx('blip');
        }
        this.body.setText(page.slice(0, shown));
      }
      this.body.setText(page);
      this.blink = 0;
      for (;;) {
        const dt = await nextFrame(this.scene);
        this.blink += dt;
        this.more.setVisible(this.blink % 0.8 < 0.5);
        if (controls.consume('a') || controls.consume('b')) break;
      }
      this.more.setVisible(false);
    }
  }
}
