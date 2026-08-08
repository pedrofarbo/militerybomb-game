/**
 * Resolução de dano em área e encadeamento de explosões.
 *
 * Projéteis usam o broadphase do Arcade (overlap sprite-a-sprite). Explosões
 * não: são poucas por segundo e precisam consultar TODOS os alvos por
 * distância, o que uma query direta resolve melhor que colisores.
 */

import { EXPLOSIONS, type ExplosionId } from '../../core/combat/explosives';
import { explosionDamageAt, type ExplosionDef } from '../../core/combat/overlap';
import type { DamageInfo } from '../../core/combat/health';
import type { EnemyActor } from '../entities/EnemyActor';
import type { Destructible } from '../entities/Destructible';

export interface CombatTargets {
  enemies: readonly EnemyActor[];
  destructibles: readonly Destructible[];
}

export interface CombatCallbacks {
  onEnemyKilled(enemy: EnemyActor): void;
  onShake(trauma: number): void;
  playFx(key: string, x: number, y: number): void;
}

interface PendingExplosion {
  def: ExplosionDef;
  x: number;
  y: number;
  sourceId: number;
}

/**
 * Teto de explosões resolvidas numa mesma cadeia. Um depósito de barris não
 * pode virar um laço infinito nem um pico de frame de 200 ms.
 */
const MAX_CHAIN = 24;

export class CombatSystem {
  private readonly queue: PendingExplosion[] = [];
  private readonly damage: DamageInfo = {
    amount: 0,
    kind: 'explosion',
    sourceId: -1,
    originX: 0,
    originY: 0,
    knockback: 0,
  };

  constructor(
    private readonly targets: CombatTargets,
    private readonly callbacks: CombatCallbacks,
  ) {}

  /**
   * Enfileira uma explosão e resolve a cadeia inteira.
   *
   * As explosões secundárias entram na fila em vez de recursão: um barril que
   * detona outro que detona outro estouraria a pilha, e a ordem de resolução
   * ficaria dependente da ordem de iteração.
   */
  explode(id: ExplosionId, x: number, y: number, sourceId: number, nowMs: number): void {
    this.queue.push({ def: EXPLOSIONS[id], x, y, sourceId });

    let resolved = 0;
    while (this.queue.length > 0 && resolved < MAX_CHAIN) {
      const blast = this.queue.shift()!;
      this.resolve(blast, nowMs);
      resolved++;
    }
    this.queue.length = 0;
  }

  private resolve(blast: PendingExplosion, nowMs: number): void {
    this.callbacks.playFx(blast.def.fx, blast.x, blast.y);
    this.callbacks.onShake(blast.def.shake);

    for (const enemy of this.targets.enemies) {
      if (!enemy.alive) continue;
      const amount = explosionDamageAt(blast.def, blast.x, blast.y, enemy.bounds);
      if (amount <= 0) continue;

      this.fill(amount, blast);
      const result = enemy.takeDamage(this.damage, nowMs);
      if (result.killed) this.callbacks.onEnemyKilled(enemy);
    }

    for (const target of this.targets.destructibles) {
      if (!target.alive) continue;
      const amount = explosionDamageAt(blast.def, blast.x, blast.y, target.bounds);
      if (amount <= 0) continue;

      this.fill(amount, blast);
      target.takeDamage(this.damage, nowMs);
      // O pavio do alvo atingido é quem enfileira a explosão seguinte, via
      // `onDestroyed` da cena — assim a cadeia mantém o ritmo visível.
    }
  }

  private fill(amount: number, blast: PendingExplosion): void {
    this.damage.amount = amount;
    this.damage.kind = 'explosion';
    this.damage.sourceId = blast.sourceId;
    this.damage.originX = blast.x;
    this.damage.originY = blast.y;
    this.damage.knockback = blast.def.knockback;
  }
}
