import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { GAME_H, GAME_W, TITLE_FONT_CSS, UI } from '../config';
import { hasSave, loadGame } from '../core/save';
import { session } from '../core/session';
import { newGame } from '../core/state';
import { controls } from '../input/controls';
import { addText, nextFrame, tweenAsync } from '../ui/kit';
import { ListMenu } from '../ui/ListMenu';

/** Night sky, the academy's towers, falling petals, and the title in pixel blackletter. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const g = this.add.graphics();
    const sky = [0x07060f, 0x0c0a1a, 0x120e24, 0x18122e, 0x221838, 0x2c1e40];
    sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 36, GAME_W, 37));
    g.fillStyle(0x2c1e40, 1).fillRect(0, 216, GAME_W, GAME_H - 216);
    // Moon
    g.fillStyle(0xf6ecd0, 0.08).fillCircle(386, 70, 44);
    g.fillStyle(0xf6ecd0, 1).fillCircle(386, 70, 22);
    g.fillStyle(0x0c0a1a, 1).fillCircle(394, 64, 19);
    // Stars
    const stars: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 60; i++) {
      const s = this.add.rectangle((i * 97) % GAME_W, (i * 53) % 180, 1, 1, 0xfff6e0, 0.3 + ((i * 7) % 10) / 14).setOrigin(0);
      stars.push(s);
      this.tweens.add({ targets: s, alpha: 0.1, duration: 900 + ((i * 131) % 1400), yoyo: true, repeat: -1, delay: (i * 77) % 1200 });
    }
    // The academy
    const towers: [number, number, number][] = [[20, 46, 110], [70, 30, 150], [104, 70, 92], [176, 40, 132], [220, 60, 118], [282, 34, 170], [318, 64, 100], [384, 38, 140], [424, 56, 96]];
    for (const [x, w, h] of towers) {
      g.fillStyle(0x0e0a16, 1).fillRect(x, GAME_H - 60 - h, w, h + 60);
      g.fillTriangle(x - 5, GAME_H - 60 - h, x + w / 2, GAME_H - 60 - h - 34, x + w + 5, GAME_H - 60 - h);
      for (let wy = GAME_H - 50 - h; wy < GAME_H - 70; wy += 22) {
        if ((x + wy) % 3 !== 0) g.fillStyle(0xf6d98a, 0.9).fillRect(x + w / 2 - 2, wy, 5, 9);
      }
    }
    g.fillStyle(0x0a0710, 1).fillRect(0, GAME_H - 40, GAME_W, 40);

    // Falling petals
    for (let i = 0; i < 18; i++) {
      const p = this.add.rectangle(Phaser.Math.Between(0, GAME_W), -10, 2, 2, i % 3 ? 0xf2a7bf : 0xc03a5a).setOrigin(0);
      const fall = () => {
        p.setPosition(Phaser.Math.Between(-20, GAME_W), -10);
        this.tweens.add({
          targets: p,
          y: GAME_H + 10,
          x: p.x + Phaser.Math.Between(20, 90),
          duration: Phaser.Math.Between(5000, 9000),
          onComplete: fall,
        });
      };
      this.time.delayedCall(i * 450, fall);
    }

    const title = addText(this, GAME_W / 2, 64, 'Pactbound', { font: TITLE_FONT_CSS, size: 72, color: UI.textGold, stroke: '#2a1030' }).setOrigin(0.5);
    title.setShadow(0, 3, '#7a2a4a', 0, false, true);
    addText(this, GAME_W / 2, 112, 'A Thornveil Academy Story', { color: '#d8c8e8' }).setOrigin(0.5);
    const prompt = addText(this, GAME_W / 2, 196, document.body.classList.contains('touch') ? 'Tap A to begin' : 'Press Z or Enter to begin', {
      color: UI.textRose,
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    addText(this, GAME_W / 2, GAME_H - 18, 'v0.1  Chapter One', { color: UI.textDim }).setOrigin(0.5);

    controls.flush();
    void this.flow(prompt);
  }

  private async flow(prompt: Phaser.GameObjects.Text): Promise<void> {
    for (;;) {
      await nextFrame(this);
      if (controls.consume('a') || controls.consume('menu')) break;
    }
    sound.unlock();
    sound.music('title');
    sound.sfx('confirm');
    prompt.destroy();
    const saved = hasSave();
    const items = saved ? [{ label: 'Continue' }, { label: 'New Game' }] : [{ label: 'New Game' }];
    for (;;) {
      const menu = new ListMenu(this, { x: GAME_W / 2 - 70, y: 168, w: 140, items, depth: 10 });
      const i = await menu.pick(false);
      menu.destroy();
      const choice = items[i]?.label;
      if (choice === 'Continue') {
        const loaded = loadGame();
        if (loaded) {
          session.state = loaded;
          return this.start();
        }
      } else {
        if (saved) {
          const warn = addText(this, GAME_W / 2, 150, 'Start over? Your old save is kept until you save again.', { color: UI.textDim, wrap: 400, align: 'center' }).setOrigin(0.5);
          const confirm = new ListMenu(this, { x: GAME_W / 2 - 70, y: 168, w: 140, items: [{ label: 'Start over' }, { label: 'Back' }], depth: 10 });
          const c = await confirm.pick(true);
          confirm.destroy();
          warn.destroy();
          if (c !== 0) continue;
        }
        session.state = newGame();
        return this.start();
      }
    }
  }

  private async start(): Promise<void> {
    sound.sfx('confirm');
    const fade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0).setDepth(100).setAlpha(0);
    await tweenAsync(this, { targets: fade, alpha: 1, duration: 600 });
    this.scene.launch('UI');
    this.scene.start('World');
  }
}
