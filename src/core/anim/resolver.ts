/**
 * Estado → chave de animação.
 *
 * Existe exatamente UM lugar no jogo que decide qual animação toca. Sem isto,
 * flags de animação se espalham por colisão, dano, input e IA, e nasce a
 * classe de bug mais chata de um jogo 2D: o sprite que fica preso num estado
 * porque dois sistemas discordam sobre quem manda.
 */

import { EnemyState, type EnemyTypeId } from '../enemies/brain';
import { Locomotion, type PlayerState } from '../player/player-state';

export interface AnimSelection {
  readonly key: string;
  /** `true` = não pode ser interrompida até `animationcomplete`. */
  readonly lock: boolean;
}

const PLAYER_ANIMS: Record<Locomotion, AnimSelection> = {
  [Locomotion.Idle]: { key: 'player.idle', lock: false },
  [Locomotion.Run]: { key: 'player.run', lock: false },
  [Locomotion.JumpRise]: { key: 'player.jump', lock: false },
  [Locomotion.Fall]: { key: 'player.fall', lock: false },
  [Locomotion.Land]: { key: 'player.land', lock: false },
  [Locomotion.Hurt]: { key: 'player.hurt', lock: true },
  [Locomotion.Dead]: { key: 'player.death', lock: true },
};

export function resolvePlayerAnim(s: PlayerState): AnimSelection {
  return PLAYER_ANIMS[s.locomotion];
}

/**
 * Velocidade da animação de corrida acompanha a velocidade real, então o
 * personagem nunca "patina" — os pés batem no ritmo do deslocamento.
 */
export function runAnimTimeScale(vx: number, maxSpeed: number): number {
  const t = Math.min(1, Math.abs(vx) / maxSpeed);
  return 0.55 + t * 0.65;
}

/* ─────────────────────────── Inimigos ─────────────────────────── */

/**
 * Mesma regra do player: a animação é DERIVADA do estado, num lugar só.
 * `moving` desempata ALERT — parado encarando ou andando de lado.
 */
export function resolveEnemyAnim(
  type: EnemyTypeId,
  state: EnemyState,
  moving: boolean,
): AnimSelection {
  switch (state) {
    case EnemyState.Dead:
      return { key: `${type}.death`, lock: true };
    case EnemyState.Hurt:
      return { key: `${type}.hurt`, lock: true };
    case EnemyState.Attack:
      return { key: `${type}.attack`, lock: false };
    case EnemyState.Alert:
      return { key: moving ? `${type}.walk` : `${type}.idle`, lock: false };
    case EnemyState.Patrol:
      return { key: `${type}.walk`, lock: false };
    case EnemyState.Idle:
      return { key: `${type}.idle`, lock: false };
  }
}
