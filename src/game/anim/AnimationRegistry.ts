/**
 * Registro central de animações.
 *
 * Todas as animações nascem aqui, a partir do manifesto. Nenhuma Scene chama
 * `anims.create()` por conta própria — é isso que impede duas cenas
 * registrarem a mesma chave com parâmetros diferentes.
 */

import type Phaser from 'phaser';
import { ANIMS } from '../../assets/manifest';

export function registerAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const def of ANIMS) {
    if (anims.exists(def.key)) continue;
    anims.create({
      key: def.key,
      frames: anims.generateFrameNames(def.atlas, {
        prefix: def.prefix,
        start: 0,
        end: def.frames - 1,
      }),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}

/** Animações que não podem ser interrompidas até terminarem. */
export const LOCKED_ANIMS: ReadonlySet<string> = new Set(
  ANIMS.filter((a) => 'lock' in a && a.lock).map((a) => a.key),
);
