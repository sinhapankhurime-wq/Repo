import Phaser from 'phaser';
import { registerTextures } from '../gfx/textures';

/** Generates every sprite, tile icon and UI texture in code, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerTextures(this);
    this.scene.start('Title');
  }
}
