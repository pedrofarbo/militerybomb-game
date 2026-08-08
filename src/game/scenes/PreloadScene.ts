/**
 * Carga de assets + registro de animações.
 *
 * Uma onda só por enquanto: o conjunto inteiro tem ~70 KB. Quando houver mais
 * fases, isto vira "core" + "level-N" e a segunda onda passa a ser disparada
 * pela transição de fase (plano §15).
 */

import Phaser from 'phaser';
import { ATLASES, IMAGES } from '../../assets/manifest';
import { registerAnimations } from '../anim/AnimationRegistry';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    for (const [key, def] of Object.entries(ATLASES)) {
      this.load.atlas(key, def.texture, def.data);
    }
    for (const [key, path] of Object.entries(IMAGES)) {
      this.load.image(key, path);
    }

    const bar = this.add.rectangle(0, 0, 1, 4, 0xe8bb28).setOrigin(0, 0.5);
    const { width, height } = this.scale.gameSize;
    bar.setPosition(width * 0.2, height * 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = width * 0.6 * value;
    });
  }

  create(): void {
    registerAnimations(this.anims);
    this.scene.start('level');
  }
}
