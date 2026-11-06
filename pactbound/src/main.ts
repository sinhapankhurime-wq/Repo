import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/jacquarda-bastarda-9/latin-400.css';
import './style.css';
import Phaser from 'phaser';
import { sound } from './audio/sound';
import { FONT, GAME_H, GAME_W, TITLE_FONT } from './config';
import { session } from './core/session';
import { controls } from './input/controls';
import { installTouchControls } from './input/touch';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { MenuScene } from './scenes/MenuScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

async function start(): Promise<void> {
  // Phaser rasterises text immediately, so wait for the pixel fonts first.
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`16px "${FONT}"`), document.fonts.load(`36px "${TITLE_FONT}"`)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    // Fall back to whatever font the browser has.
  }

  controls.bindKeyboard(window);
  controls.onAnyPress = () => sound.unlock();
  addEventListener('pointerdown', () => sound.unlock(), { once: false });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#120d18',
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Display order: later scenes draw on top.
    scene: [BootScene, TitleScene, WorldScene, UIScene, BattleScene, MenuScene, EndingScene],
  });

  game.events.on(Phaser.Core.Events.PRE_STEP, (_time: number, delta: number) => controls.beginFrame(Math.min(0.1, delta / 1000)));
  installTouchControls(() => game.scale.refresh());

  // Expose for debugging and automated play-testing.
  (window as unknown as { pactbound: unknown }).pactbound = { game, session };
}

void start();
