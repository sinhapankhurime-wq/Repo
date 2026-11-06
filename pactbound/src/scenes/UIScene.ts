import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { GAME_H, GAME_W, TITLE_FONT_CSS, UI } from '../config';
import { SPEAKERS, type SpeakerId } from '../data/cast';
import { controls } from '../input/controls';
import { DialogueBox, type LineStyle } from '../ui/DialogueBox';
import { addText, drawPanel, nextFrame, tweenAsync, waitSeconds } from '../ui/kit';
import { ListMenu } from '../ui/ListMenu';

/**
 * Always-on-top overlay for the overworld: dialogue, choices, narration on
 * black, the map-name banner, fades, ambient tint and the vignette used in
 * Lucien's scenes. Scripts reach it through the story API.
 */
export class UIScene extends Phaser.Scene {
  dialogue!: DialogueBox;
  private fader!: Phaser.GameObjects.Rectangle;
  private ambient!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Image;
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerG!: Phaser.GameObjects.Graphics;
  private narration!: Phaser.GameObjects.Text;
  private curtainRect!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('UI');
  }

  create(): void {
    this.ambient = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0).setDepth(0).setAlpha(0);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(1).setAlpha(0);
    this.bannerG = this.add.graphics();
    this.bannerText = addText(this, 16, 13, '', { color: UI.textGold });
    this.banner = this.add.container(0, -40, [this.bannerG, this.bannerText]).setDepth(800);
    this.curtainRect = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 1).setOrigin(0).setDepth(850).setAlpha(0);
    this.dialogue = new DialogueBox(this);
    this.fader = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0).setDepth(2000).setAlpha(0);
    this.narration = addText(this, GAME_W / 2, GAME_H / 2, '', { wrap: 380, align: 'center', color: '#e8dcf0', lineSpacing: 8 })
      .setOrigin(0.5)
      .setDepth(2001)
      .setAlpha(0);
  }

  // ── Talking ───────────────────────────────────────────────────────────

  async say(who: SpeakerId | null, text: string, style: LineStyle = {}): Promise<void> {
    await this.dialogue.say(who ? SPEAKERS[who] : null, text, style);
  }

  closeDialogue(): void {
    this.dialogue.close();
  }

  /** Shows options above the dialogue box. B picks `cancelIndex` when given. */
  async choose(options: string[], cancelIndex?: number): Promise<number> {
    const w = Math.min(GAME_W - 24, Math.max(...options.map((o) => o.length)) * 8 + 40);
    const h = options.length * 19 + 12;
    const menu = new ListMenu(this, {
      x: GAME_W - w - 8,
      y: (this.dialogue.isOpen ? 214 : GAME_H - 8) - h,
      w,
      rowH: 19,
      items: options.map((label) => ({ label })),
      depth: 950,
    });
    for (;;) {
      await nextFrame(this);
      const r = menu.poll(cancelIndex !== undefined);
      if (r === null) continue;
      menu.destroy();
      return r === -1 ? (cancelIndex as number) : r;
    }
  }

  // ── Screen effects ────────────────────────────────────────────────────

  async fade(to: number, ms = 350): Promise<void> {
    await tweenAsync(this, { targets: this.fader, alpha: to, duration: ms });
  }

  /** Darkness below the dialogue box, so lines can be spoken over black. */
  async curtain(on: boolean, ms = 600): Promise<void> {
    await tweenAsync(this, { targets: this.curtainRect, alpha: on ? 1 : 0, duration: ms });
  }

  setFade(alpha: number): void {
    this.fader.setAlpha(alpha);
  }

  /** Tints the world (night, dusk). Pass alpha 0 to clear. */
  setAmbient(color: number, alpha: number, ms = 0): void {
    this.ambient.setFillStyle(color, 1);
    if (ms <= 0) this.ambient.setAlpha(alpha);
    else this.tweens.add({ targets: this.ambient, alpha, duration: ms });
  }

  async setVignette(on: boolean, ms = 600): Promise<void> {
    await tweenAsync(this, { targets: this.vignette, alpha: on ? 1 : 0, duration: ms });
  }

  /** The map name slides in at the top left. */
  showBanner(text: string): void {
    this.tweens.killTweensOf(this.banner);
    this.bannerText.setText(text);
    this.bannerG.clear();
    drawPanel(this.bannerG, 6, 6, Math.ceil(this.bannerText.width) + 22, 28);
    this.banner.setY(-40);
    this.tweens.chain({
      targets: this.banner,
      tweens: [
        { y: 0, duration: 260, ease: 'Quad.easeOut' },
        { y: 0, duration: 1800 },
        { y: -40, duration: 260, ease: 'Quad.easeIn' },
      ],
    });
  }

  /** Floating heart (Devotion) or spark (Clarity) when a choice shifts Wren's feelings. */
  bondPing(kind: 'devotion' | 'clarity', amount: number): void {
    sound.sfx(kind === 'devotion' ? 'heart' : 'clarity');
    const icon = this.add.image(GAME_W - 112, 46, kind === 'devotion' ? 'icon:heart' : 'icon:spark').setScale(2).setDepth(960);
    const label = addText(this, GAME_W - 100, 38, `${amount > 0 ? '+' : ''}${amount} ${kind === 'devotion' ? 'Devotion' : 'Clarity'}`, {
      size: 16,
      color: kind === 'devotion' ? UI.textRose : '#9fe0f6',
      stroke: '#120d18',
    }).setDepth(960);
    this.tweens.add({
      targets: [icon, label],
      y: '-=14',
      alpha: { from: 1, to: 0 },
      delay: 900,
      duration: 700,
      onComplete: () => {
        icon.destroy();
        label.destroy();
      },
    });
  }

  /** White text on black, one paragraph at a time. Used for the prologue and chapter breaks. */
  async narrate(paragraphs: string[], opts: { keepDark?: boolean; title?: boolean } = {}): Promise<void> {
    this.dialogue.close();
    await this.fade(1, 500);
    for (const p of paragraphs) {
      this.narration.setText(p);
      this.narration.setFontFamily(opts.title ? TITLE_FONT_CSS : 'DotGothic16');
      this.narration.setFontSize(opts.title ? 32 : 16);
      await tweenAsync(this, { targets: this.narration, alpha: 1, duration: 500 });
      let t = 0;
      for (;;) {
        t += await nextFrame(this);
        if (t > 0.4 && (controls.consume('a') || controls.consume('b'))) break;
      }
      await tweenAsync(this, { targets: this.narration, alpha: 0, duration: 350 });
    }
    if (!opts.keepDark) await this.fade(0, 500);
  }

  async pause(seconds: number): Promise<void> {
    await waitSeconds(this, seconds);
  }
}
