/**
 * Objeto destrutível: caixote, barril e gerador.
 *
 * O barril e o gerador explodem, e a explosão danifica outros destrutíveis —
 * o encadeamento é o que faz o cenário virar arma. O pavio existe para o
 * encadeamento LER: sem ele, uma fileira de barris some no mesmo frame.
 */

import Phaser from 'phaser';
import {
  DESTRUCTIBLES,
  type DestructibleDef,
  type DestructibleTypeId,
} from '../../core/combat/explosives';
import {
  applyDamage,
  createDamageResult,
  createHealth,
  type DamageInfo,
  type DamageResult,
  type HealthState,
} from '../../core/combat/health';
import type { Aabb } from '../../core/combat/overlap';
import { SPRITES, type SpriteKey } from '../../assets/manifest';
import { DEPTH_ACTORS } from '../fx/FxService';

export interface DestructibleCallbacks {
  /** Chamado quando o pavio termina. A cena resolve a explosão em área. */
  onDestroyed(target: Destructible): void;
}

export class Destructible {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly def: DestructibleDef;
  readonly health: HealthState;

  private readonly damageResult = createDamageResult();
  private readonly box: Aabb = { x: 0, y: 0, w: 0, h: 0 };
  private fuseLeftMs = 0;
  private fuseLit = false;

  constructor(
    scene: Phaser.Scene,
    type: DestructibleTypeId,
    x: number,
    y: number,
    private readonly callbacks: DestructibleCallbacks,
  ) {
    this.def = DESTRUCTIBLES[type];
    this.health = createHealth(this.def.maxHealth, 0);

    const art = SPRITES[this.def.sprites.intact as SpriteKey];
    this.sprite = scene.physics.add.sprite(x, y, art.atlas, art.frame);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(DEPTH_ACTORS - 1);
    this.sprite.setData('destructible', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.def.bodyWidth, this.def.bodyHeight);
    body.setOffset(
      (this.sprite.width - this.def.bodyWidth) / 2,
      this.sprite.height - this.def.bodyHeight,
    );
    body.setAllowGravity(false);
    // Imóvel: o player e os inimigos esbarram nele, ele não é empurrado.
    body.setImmovable(true);
  }

  get alive(): boolean {
    return this.sprite.active && !this.fuseLit;
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get centerY(): number {
    return this.sprite.y - this.def.bodyHeight / 2;
  }

  get bounds(): Aabb {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.box.x = body.x;
    this.box.y = body.y;
    this.box.w = body.width;
    this.box.h = body.height;
    return this.box;
  }

  takeDamage(info: DamageInfo, nowMs: number): DamageResult {
    const result = this.damageResult;
    if (this.fuseLit) {
      result.applied = 0;
      result.killed = false;
      result.rejected = 'already-dead';
      return result;
    }

    applyDamage(this.health, info, this.sprite.x, this.centerY, nowMs, result);
    if (result.applied <= 0) return result;

    if (result.killed) {
      this.lightFuse();
    } else if (this.health.current <= this.health.max * 0.5) {
      // Estado intermediário: avisa que está prestes a ir, o que é o que
      // torna o barril uma ferramenta em vez de uma surpresa.
      const art = SPRITES[this.def.sprites.damaged as SpriteKey];
      this.sprite.setTexture(art.atlas, art.frame);
    }
    return result;
  }

  private lightFuse(): void {
    this.fuseLit = true;
    this.fuseLeftMs = this.def.fuseMs;
    const art = SPRITES[this.def.sprites.damaged as SpriteKey];
    this.sprite.setTexture(art.atlas, art.frame);
    if (this.def.explosion) {
      this.sprite.setTint(0xfff3c4).setTintMode(Phaser.TintModes.FILL);
    }
    // Deixa de bloquear imediatamente: esperar o pavio para liberar passagem
    // faz o jogador achar que travou.
    (this.sprite.body as Phaser.Physics.Arcade.Body).checkCollision.none = true;
    if (this.fuseLeftMs <= 0) this.detonate();
  }

  step(dtMs: number): void {
    if (!this.fuseLit || !this.sprite.active) return;
    this.fuseLeftMs -= dtMs;
    if (this.fuseLeftMs <= 0) this.detonate();
  }

  private detonate(): void {
    if (!this.sprite.active) return;
    this.callbacks.onDestroyed(this);
    this.destroy();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
