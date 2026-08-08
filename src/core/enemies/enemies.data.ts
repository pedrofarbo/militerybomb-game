/**
 * Estatísticas dos inimigos. Balanceamento vive aqui — e só aqui.
 *
 * Os três existem para ensinar coisas diferentes: o soldado ensina o loop de
 * combate, o pesado força reposicionamento, a torreta ensina cobertura e uso
 * de granada. Se dois inimigos ensinam a mesma coisa, um deles é redundante.
 */

import type { EnemyTypeId } from './brain';

export interface EnemyDef {
  readonly id: EnemyTypeId;
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  /** Altura do tronco acima dos pés — de onde saem os tiros. */
  readonly torsoOffsetY: number;
  /** Alcance de detecção, em px. */
  readonly sightRange: number;
  /** Distância em que prefere recuar em vez de atirar. */
  readonly tooCloseRange: number;
  /**
   * Antecipação obrigatória antes do primeiro tiro. Regra de DESIGN, não de
   * estética: é o que dá ao jogador a chance de reagir, e é a diferença entre
   * "difícil" e "injusto".
   */
  readonly telegraphMs: number;
  readonly shotsPerBurst: number;
  readonly shotIntervalMs: number;
  readonly burstCooldownMs: number;
  readonly projectileSpeed: number;
  readonly projectileDamage: number;
  readonly projectileLifeMs: number;
  /** Dano por encostar no jogador. */
  readonly contactDamage: number;
  /** Atordoamento ao levar dano. */
  readonly hurtMs: number;
  /** 0..1 — quanto do empurrão é absorvido. */
  readonly knockbackResistance: number;
  readonly score: number;
  readonly projectileSprite: string;
  readonly muzzleFx: string;
  readonly deathFx: string;
  readonly canPatrol: boolean;
  readonly gravity: boolean;
}

export const ENEMIES: Readonly<Record<EnemyTypeId, EnemyDef>> = {
  soldier: {
    id: 'soldier',
    maxHealth: 20,
    moveSpeed: 52,
    bodyWidth: 16,
    bodyHeight: 32,
    torsoOffsetY: 20,
    sightRange: 220,
    tooCloseRange: 56,
    telegraphMs: 260,
    shotsPerBurst: 3,
    shotIntervalMs: 130,
    burstCooldownMs: 900,
    projectileSpeed: 240,
    projectileDamage: 1,
    projectileLifeMs: 1600,
    contactDamage: 1,
    hurtMs: 160,
    knockbackResistance: 0,
    score: 100,
    projectileSprite: 'projectile.enemyBullet',
    muzzleFx: 'fx.muzzle.small',
    deathFx: 'fx.explosion.small',
    canPatrol: true,
    gravity: true,
  },

  heavy: {
    id: 'heavy',
    maxHealth: 70,
    // Lento de propósito: a ameaça é o volume de fogo, não a perseguição.
    moveSpeed: 30,
    bodyWidth: 28,
    bodyHeight: 44,
    torsoOffsetY: 28,
    sightRange: 260,
    tooCloseRange: 0,
    telegraphMs: 480,
    shotsPerBurst: 8,
    shotIntervalMs: 110,
    burstCooldownMs: 1400,
    projectileSpeed: 260,
    projectileDamage: 1,
    projectileLifeMs: 1600,
    contactDamage: 1,
    hurtMs: 90,
    // Resiste ao empurrão: não dá para travá-lo com uma metralhadora.
    knockbackResistance: 0.85,
    score: 300,
    projectileSprite: 'projectile.heavyBullet',
    muzzleFx: 'fx.muzzle.large',
    deathFx: 'fx.explosion.medium',
    canPatrol: false,
    gravity: true,
  },

  turret: {
    id: 'turret',
    maxHealth: 40,
    moveSpeed: 0,
    bodyWidth: 24,
    bodyHeight: 22,
    torsoOffsetY: 14,
    sightRange: 240,
    tooCloseRange: 0,
    telegraphMs: 340,
    shotsPerBurst: 2,
    shotIntervalMs: 220,
    burstCooldownMs: 1100,
    projectileSpeed: 210,
    projectileDamage: 1,
    projectileLifeMs: 1800,
    contactDamage: 0,
    hurtMs: 120,
    knockbackResistance: 1,
    score: 150,
    projectileSprite: 'projectile.enemyBullet',
    muzzleFx: 'fx.muzzle.medium',
    deathFx: 'fx.explosion.small',
    canPatrol: false,
    gravity: false,
  },
};
