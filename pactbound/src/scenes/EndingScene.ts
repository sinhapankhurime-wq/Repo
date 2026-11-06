import Phaser from 'phaser';
import { sound } from '../audio/sound';
import { GAME_H, GAME_W, TITLE_FONT_CSS, UI } from '../config';
import { session } from '../core/session';
import { controls } from '../input/controls';
import { chapterOneVerdict } from '../story/chapter1';
import { F } from '../story/flags';
import { addText, nextFrame, tweenAsync } from '../ui/kit';

export interface EndingSceneData {
  onDone: () => void;
}

/** The end-of-chapter card: how far Wren has fallen, and how clearly she sees. */
export class EndingScene extends Phaser.Scene {
  private onDone!: () => void;

  constructor() {
    super('Ending');
  }

  init(data: EndingSceneData): void {
    this.onDone = data.onDone;
  }

  create(): void {
    void this.show();
  }

  private async show(): Promise<void> {
    const s = session.state;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x07050c).setOrigin(0);
    const all: Phaser.GameObjects.GameObject[] = [];
    const reveal = async (o: Phaser.GameObjects.Text | Phaser.GameObjects.Image, delay = 200) => {
      o.setAlpha(0);
      all.push(o);
      await tweenAsync(this, { targets: o, alpha: 1, duration: 500, delay });
    };
    sound.music('title');
    await reveal(addText(this, GAME_W / 2, 30, 'Chapter One', { font: TITLE_FONT_CSS, size: 36, color: UI.textGold }).setOrigin(0.5));
    await reveal(addText(this, GAME_W / 2, 62, 'The Welcome', { color: '#d8c8e8' }).setOrigin(0.5));

    await reveal(addText(this, 100, 100, 'Devotion', { color: UI.textRose }));
    for (let i = 0; i < Math.min(8, s.devotion); i++) {
      sound.sfx('heart');
      await reveal(this.add.image(206 + i * 20, 109, 'icon:heart').setScale(2), 60);
    }
    await reveal(addText(this, 100, 126, 'Clarity', { color: '#9fe0f6' }));
    for (let i = 0; i < Math.min(8, s.clarity); i++) {
      sound.sfx('clarity');
      await reveal(this.add.image(206 + i * 20, 135, 'icon:spark').setScale(2), 60);
    }
    const ribbon = s.flags[F.ribbonAccepted] === true ? 'You wear his ribbon.' : 'You refused his ribbon. For now.';
    const duel = s.flags[F.lucienDuel] === 'won' ? 'You beat him in his own hall.' : 'He let you lose gently.';
    await reveal(addText(this, GAME_W / 2, 164, `${duel} ${ribbon}`, { color: UI.textDim, wrap: 420, align: 'center' }).setOrigin(0.5, 0));
    await reveal(addText(this, GAME_W / 2, 196, chapterOneVerdict(s.devotion, s.clarity), { wrap: 420, align: 'center', color: '#e8dcf0' }).setOrigin(0.5, 0));
    await reveal(addText(this, GAME_W / 2, 262, 'Next: Chapter Two, "The Hollow Waltz". Coming soon.', { color: UI.textGold }).setOrigin(0.5, 0));
    await reveal(addText(this, GAME_W / 2, 290, 'Your story was saved. Press A to keep exploring.', { color: UI.textDim }).setOrigin(0.5, 0), 400);
    controls.flush();
    for (;;) {
      await nextFrame(this);
      if (controls.consume('a') || controls.consume('b')) break;
    }
    sound.sfx('confirm');
    this.onDone();
  }
}
