/**
 * Contrato dos inimigos.
 *
 * Um brain é PURO: recebe um retrato do mundo e devolve uma intenção. Ele não
 * conhece sprites, corpos de física nem o tilemap — quem move e desenha é o
 * `EnemyActor`. É isso que permite testar "soldado vê o jogador à direita →
 * ataca em ≤ 250 ms" sem abrir um browser, e adicionar um inimigo novo sem
 * tocar em nenhum arquivo existente.
 */

import type { DamageResult } from '../combat/health';

export const EnemyState = {
  Idle: 'IDLE',
  Patrol: 'PATROL',
  Alert: 'ALERT',
  Attack: 'ATTACK',
  Hurt: 'HURT',
  Dead: 'DEAD',
} as const;

export type EnemyState = (typeof EnemyState)[keyof typeof EnemyState];

export type EnemyTypeId = 'soldier' | 'heavy' | 'turret';

export interface BrainContext {
  /** Estado do próprio inimigo. */
  selfX: number;
  selfY: number;
  facing: -1 | 1;
  grounded: boolean;
  health: number;
  maxHealth: number;

  /**
   * Alvo. `playerY` é o PONTO DE MIRA (tronco do jogador), enquanto `selfY`
   * são os PÉS do inimigo — misturar os dois faz todo tiro passar por baixo.
   * `playerAlive` falso significa "não há a quem reagir".
   */
  playerX: number;
  playerY: number;
  playerAlive: boolean;
  distanceToPlayer: number;
  /** Calculado pela camada de jogo (raycast contra tiles) e INJETADO aqui. */
  canSeePlayer: boolean;

  /** Sondas de navegação, também fornecidas pela camada de jogo. */
  blockedAhead: boolean;
  edgeAhead: boolean;

  /** Limites de patrulha em px; iguais desativam a patrulha. */
  patrolLeft: number;
  patrolRight: number;

  nowMs: number;
}

export interface BrainOutput {
  moveX: -1 | 0 | 1;
  wantJump: boolean;
  wantFire: boolean;
  /** Ângulo de tiro. `null` = mirar na direção da face. */
  aimAngleRad: number | null;
  facing: -1 | 1;
  state: EnemyState;
}

export function createBrainContext(): BrainContext {
  return {
    selfX: 0,
    selfY: 0,
    facing: 1,
    grounded: true,
    health: 1,
    maxHealth: 1,
    playerX: 0,
    playerY: 0,
    playerAlive: false,
    distanceToPlayer: Infinity,
    canSeePlayer: false,
    blockedAhead: false,
    edgeAhead: false,
    patrolLeft: 0,
    patrolRight: 0,
    nowMs: 0,
  };
}

export function createBrainOutput(): BrainOutput {
  return {
    moveX: 0,
    wantJump: false,
    wantFire: false,
    aimAngleRad: null,
    facing: 1,
    state: EnemyState.Idle,
  };
}

export interface EnemyBrain {
  readonly id: EnemyTypeId;
  /** Escreve a intenção em `out`; o chamador é dono do objeto. */
  update(ctx: BrainContext, dtMs: number, out: BrainOutput): void;
  onDamaged(result: DamageResult, nowMs: number): void;
  reset(nowMs: number): void;
  /** Exposto para o painel de debug. */
  readonly state: EnemyState;
}
