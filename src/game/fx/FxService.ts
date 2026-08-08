/**
 * FX reutilizáveis, todos vindos de pool.
 *
 * A causa nº 1 de engasgo em jogos Phaser é criar/destruir sprites e emissores
 * durante o combate. Aqui nada é criado depois do boot: cada efeito é um
 * sprite reciclado que toca uma animação e volta para a fila.
 */

import Phaser from 'phaser';
import { Pool } from '../systems/Pool';
import type { QualityLevel } from '../../core/config/tuning';

type FxSprite = Phaser.GameObjects.Sprite;

export class FxService {
  private readonly pool: Pool<FxSprite>;
  private quality: QualityLevel = 'high';
  private budget = 0;

  constructor(scene: Phaser.Scene, size = 48) {
    this.pool = new Pool<FxSprite>(() => {
      const sprite = scene.add.sprite(0, 0, '__MISSING');
      sprite.setDepth(DEPTH_FX);
      // Volta ao pool sozinho quando a animação termina.
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.pool.release(sprite));
      return sprite;
    }, size);
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
  }

  /** Efeito radial genérico (impacto, poeira, explosão). */
  play(animKey: string, x: number, y: number, opts: FxOptions = {}): void {
    if (!this.canSpawn(opts.essential ?? false)) return;
    const sprite = this.pool.acquire();
    if (!sprite) return;

    sprite.setActive(true).setVisible(true);
    sprite.setPosition(x, y);
    sprite.setOrigin(opts.originX ?? 0.5, opts.originY ?? 0.5);
    sprite.setRotation(opts.rotation ?? 0);
    sprite.setScale(opts.scale ?? 1);
    sprite.setFlipX(opts.flipX ?? false);
    sprite.setAlpha(opts.alpha ?? 1);
    sprite.setDepth(opts.depth ?? DEPTH_FX);
    sprite.play(animKey, true);
  }

  /** Muzzle flash: ancorado na boca do cano, apontando ao longo do tiro. */
  muzzle(animKey: string, x: number, y: number, angleRad: number): void {
    this.play(animKey, x, y, { rotation: angleRad, originX: 0, originY: 0.5, essential: true });
  }

  releaseAll(): void {
    this.pool.releaseAll();
  }

  get activeCount(): number {
    return this.pool.activeCount;
  }

  /**
   * Em qualidade baixa, efeitos decorativos são descartados; os que comunicam
   * gameplay (muzzle, impacto) nunca são. Degradar visual é aceitável;
   * degradar informação não é.
   */
  private canSpawn(essential: boolean): boolean {
    if (essential) return true;
    if (this.quality === 'high') return true;
    this.budget = (this.budget + 1) % (this.quality === 'medium' ? 2 : 3);
    return this.budget === 0;
  }
}

export interface FxOptions {
  rotation?: number;
  scale?: number;
  flipX?: boolean;
  alpha?: number;
  depth?: number;
  originX?: number;
  originY?: number;
  /** Efeitos essenciais ignoram o corte de qualidade. */
  essential?: boolean;
}

export const DEPTH_BG_FAR = -100;
export const DEPTH_BG_NEAR = -90;
export const DEPTH_TILES = 0;
export const DEPTH_ACTORS = 10;
export const DEPTH_PLAYER = 20;
export const DEPTH_PROJECTILES = 30;
export const DEPTH_FX = 40;
export const DEPTH_FG = 60;
