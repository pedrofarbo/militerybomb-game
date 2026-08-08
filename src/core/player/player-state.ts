/**
 * Estado do player.
 *
 * Locomoção é uma máquina de estados de estados MUTUAMENTE EXCLUSIVOS.
 * Mirar e atirar NÃO são estados — são modificadores ortogonais. É por isso
 * que correr e atirar coexistem sem explodir a quantidade de estados.
 */

import type { AimDirection } from './aim';

export const Locomotion = {
  Idle: 'IDLE',
  Run: 'RUN',
  JumpRise: 'JUMP_RISE',
  Fall: 'FALL',
  Land: 'LAND',
  Hurt: 'HURT',
  Dead: 'DEAD',
} as const;

export type Locomotion = (typeof Locomotion)[keyof typeof Locomotion];

export interface PlayerState {
  /* Cinemática — a fonte de verdade da velocidade é aqui; o corpo Arcade
     apenas a aplica e resolve a colisão. Ver movement.ts. */
  vx: number;
  vy: number;
  facing: -1 | 1;

  /* Contato com o mundo, escrito pela camada de jogo antes de cada passo. */
  grounded: boolean;
  wasGrounded: boolean;
  blockedSide: -1 | 0 | 1;

  /* Temporizadores de perdão e de estado. */
  coyoteMs: number;
  jumpBufferMs: number;
  jumpRearmMs: number;
  airborneMs: number;
  landingMs: number;
  hurtMs: number;
  invulnMs: number;

  /* Flags de pulo. */
  jumpHeld: boolean;
  jumpCutApplied: boolean;

  /* Apresentação e combate. */
  locomotion: Locomotion;
  aim: AimDirection;
  firing: boolean;
  health: number;
  dead: boolean;
}

export function createPlayerState(health: number): PlayerState {
  return {
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    wasGrounded: false,
    blockedSide: 0,
    coyoteMs: 0,
    jumpBufferMs: 0,
    jumpRearmMs: 0,
    airborneMs: 0,
    landingMs: 0,
    hurtMs: 0,
    invulnMs: 0,
    jumpHeld: false,
    jumpCutApplied: false,
    locomotion: Locomotion.Idle,
    aim: 'fwd',
    firing: false,
    health,
    dead: false,
  };
}

export function resetPlayerState(s: PlayerState, health: number): void {
  const fresh = createPlayerState(health);
  Object.assign(s, fresh);
}
