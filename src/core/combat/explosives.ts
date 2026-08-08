/**
 * Granadas e objetos destrutíveis — a parte que é regra, não apresentação.
 */

import type { ExplosionDef } from './overlap';

export const GRENADE = {
  /** Velocidade inicial do arremesso, em px/s. */
  throwSpeed: 250,
  /** Componente vertical: define o arco. */
  throwLift: 210,
  gravity: 900,
  fuseMs: 1150,
  /** Quanto da velocidade sobra a cada quique. */
  bounceDamping: 0.42,
  maxCount: 5,
  cooldownMs: 520,
  radiusPx: 6,
} as const;

export const EXPLOSIONS = {
  grenade: {
    radius: 60,
    damageAtCenter: 45,
    damageAtEdge: 14,
    knockback: 190,
    shake: 0.42,
    fx: 'fx.explosion.medium',
  },
  barrel: {
    radius: 68,
    damageAtCenter: 55,
    damageAtEdge: 16,
    knockback: 210,
    shake: 0.48,
    fx: 'fx.explosion.medium',
  },
  generator: {
    radius: 92,
    damageAtCenter: 70,
    damageAtEdge: 20,
    knockback: 260,
    shake: 0.7,
    fx: 'fx.explosion.large',
  },
} as const satisfies Record<string, ExplosionDef>;

export type ExplosionId = keyof typeof EXPLOSIONS;

export type DestructibleTypeId = 'crate' | 'barrel' | 'generator';

export interface DestructibleDef {
  readonly id: DestructibleTypeId;
  readonly maxHealth: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  /** `null` = quebra sem explodir. */
  readonly explosion: ExplosionId | null;
  /**
   * Atraso entre receber o golpe fatal e explodir.
   *
   * Existe para o encadeamento LER: sem ele, uma fileira de barris some no
   * mesmo frame e o jogador não entende o que aconteceu.
   */
  readonly fuseMs: number;
  readonly score: number;
  readonly sprites: {
    readonly intact: string;
    readonly damaged: string;
    readonly broken: string | null;
  };
}

export const DESTRUCTIBLES: Readonly<Record<DestructibleTypeId, DestructibleDef>> = {
  crate: {
    id: 'crate',
    maxHealth: 18,
    bodyWidth: 28,
    bodyHeight: 28,
    explosion: null,
    fuseMs: 0,
    score: 20,
    sprites: {
      intact: 'prop.crate.intact',
      damaged: 'prop.crate.damaged',
      broken: 'prop.crate.broken',
    },
  },
  barrel: {
    id: 'barrel',
    maxHealth: 10,
    bodyWidth: 18,
    bodyHeight: 30,
    explosion: 'barrel',
    fuseMs: 110,
    score: 30,
    sprites: {
      intact: 'prop.barrel.intact',
      damaged: 'prop.barrel.primed',
      broken: null,
    },
  },
  generator: {
    id: 'generator',
    maxHealth: 40,
    bodyWidth: 28,
    bodyHeight: 46,
    explosion: 'generator',
    fuseMs: 180,
    score: 80,
    sprites: {
      intact: 'prop.generator.intact',
      damaged: 'prop.generator.intact',
      broken: 'prop.generator.broken',
    },
  },
};

/**
 * Passo de uma granada em voo. Puro: o chamador informa se houve contato com o
 * cenário e em qual eixo, e recebe a nova velocidade.
 */
export interface GrenadeState {
  vx: number;
  vy: number;
  fuseLeftMs: number;
  bounces: number;
}

export function createGrenadeState(): GrenadeState {
  return { vx: 0, vy: 0, fuseLeftMs: 0, bounces: 0 };
}

export function throwGrenade(s: GrenadeState, angleRad: number, facing: -1 | 1): void {
  // O arremesso combina a direção da mira com um empuxo vertical fixo: um arco
  // previsível é mais útil num run & gun do que um lançamento realista.
  s.vx = Math.cos(angleRad) * GRENADE.throwSpeed;
  s.vy = Math.sin(angleRad) * GRENADE.throwSpeed - GRENADE.throwLift;
  if (Math.abs(s.vx) < 40) s.vx = facing * 40;
  s.fuseLeftMs = GRENADE.fuseMs;
  s.bounces = 0;
}

export interface GrenadeStep {
  exploded: boolean;
}

export function stepGrenade(
  s: GrenadeState,
  dtMs: number,
  contact: { down: boolean; side: boolean },
  out: GrenadeStep,
): void {
  out.exploded = false;

  const dt = dtMs / 1000;
  s.vy += GRENADE.gravity * dt;

  if (contact.down && s.vy > 0) {
    s.vy = -s.vy * GRENADE.bounceDamping;
    s.vx *= 0.7;
    s.bounces++;
    // Abaixo deste limiar a granada fica tremendo no chão em vez de assentar.
    if (Math.abs(s.vy) < 40) s.vy = 0;
  }
  if (contact.side) {
    s.vx = -s.vx * GRENADE.bounceDamping;
    s.bounces++;
  }

  s.fuseLeftMs -= dtMs;
  if (s.fuseLeftMs <= 0) out.exploded = true;
}
