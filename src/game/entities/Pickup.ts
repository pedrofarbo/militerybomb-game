/**
 * Item no chão: arma, granadas, vida ou munição.
 *
 * Fica flutuando com um leve balanço vertical — não é enfeite: um item parado
 * sobre o tileset some no ruído visual do cenário. O movimento é o que faz o
 * olho encontrá-lo enquanto o jogador corre.
 *
 * O EFEITO de pegar não mora aqui. Este arquivo sabe onde o item está e como
 * ele desaparece; quem aplica é a cena, com a regra em `core`.
 */

import type Phaser from 'phaser';
import type { PickupVariant } from '../../core/level/schema';
import { DEPTH_ACTORS } from '../fx/FxService';

/** Raio de coleta, em px. Generoso: nada pior que passar por cima e não pegar. */
export const PICKUP_RADIUS = 20;

const BOB_AMPLITUDE = 3;
const BOB_SPEED = 0.004;
/** Altura do centro do item acima do chão. */
const HOVER = 12;

export class Pickup {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly variant: PickupVariant;
  private readonly baseY: number;
  private phaseMs: number;
  private taken = false;

  constructor(scene: Phaser.Scene, variant: PickupVariant, x: number, y: number) {
    this.variant = variant;
    this.baseY = y - HOVER;
    // Defasagem pela posição: dois itens lado a lado não balançam em uníssono,
    // o que pareceria uma animação em vez de dois objetos.
    this.phaseMs = (x * 7) % 1000;

    this.sprite = scene.add.sprite(x, this.baseY, 'env', `pickup/${variant}/0`);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(DEPTH_ACTORS - 1);
    this.sprite.play(`pickup.${variant}`, true);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.baseY;
  }

  get available(): boolean {
    return !this.taken && this.sprite.active;
  }

  step(dtMs: number): void {
    if (!this.available) return;
    this.phaseMs += dtMs;
    this.sprite.y = this.baseY + Math.sin(this.phaseMs * BOB_SPEED) * BOB_AMPLITUDE;
  }

  /** Está ao alcance do jogador? Checagem direta: são poucos itens na fase. */
  overlaps(x: number, feetY: number): boolean {
    if (!this.available) return false;
    const dx = Math.abs(x - this.sprite.x);
    const dy = Math.abs(feetY - 20 - this.baseY);
    return dx <= PICKUP_RADIUS && dy <= PICKUP_RADIUS + 8;
  }

  take(): void {
    this.taken = true;
    this.sprite.destroy();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
