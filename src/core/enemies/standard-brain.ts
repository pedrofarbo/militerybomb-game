/**
 * Brain padrão: patrulha → detecta → telegrafa → rajada.
 *
 * Os três inimigos do MVP compartilham esta máquina de estados e diferem
 * apenas em DADOS (`enemies.data.ts`) e numa estratégia de movimento de uma
 * função. Um inimigo futuro com comportamento realmente diferente — que salta,
 * que investe, que voa — implementa `EnemyBrain` direto, sem herdar daqui.
 *
 * Regra de design embutida na FSM: NENHUM tiro sai sem antecipação visível.
 * O estado ALERT existe só para isso. É o que separa "difícil" de "injusto".
 */

import type { DamageResult } from '../combat/health';
import {
  EnemyState,
  type BrainContext,
  type BrainOutput,
  type EnemyBrain,
  type EnemyTypeId,
} from './brain';
import { ENEMIES, type EnemyDef } from './enemies.data';

/** Quanto tempo o inimigo continua reagindo depois de perder o jogador de vista. */
const ALERT_MEMORY_MS = 1200;

/**
 * Decide o movimento horizontal quando o inimigo está reagindo ao jogador.
 * Recebe a distância COM SINAL (negativa = jogador à esquerda).
 */
export type AlertMovement = (
  ctx: BrainContext,
  def: EnemyDef,
  signedDistance: number,
) => -1 | 0 | 1;

/** Para e atira; recua se o jogador colar. Usado pelo soldado. */
export const holdGroundAndBackOff: AlertMovement = (_ctx, def, signed) => {
  if (def.tooCloseRange > 0 && Math.abs(signed) < def.tooCloseRange) {
    // Recua na direção OPOSTA ao jogador, sem virar as costas.
    return signed > 0 ? -1 : 1;
  }
  return 0;
};

/** Avança devagar, sem nunca recuar. Usado pelo pesado. */
export const advance: AlertMovement = (_ctx, _def, signed) =>
  signed > 0 ? 1 : signed < 0 ? -1 : 0;

/** Não se move. Usado pela torreta. */
export const stayPut: AlertMovement = () => 0;

export class StandardEnemyBrain implements EnemyBrain {
  readonly id: EnemyTypeId;
  state: EnemyState = EnemyState.Idle;

  private telegraphLeftMs = 0;
  private memoryLeftMs = 0;
  private hurtLeftMs = 0;
  private shotsLeft = 0;
  private nextShotAtMs = 0;
  private cooldownUntilMs = 0;
  private patrolDirection: -1 | 1 = 1;

  constructor(
    private readonly def: EnemyDef,
    private readonly alertMovement: AlertMovement,
  ) {
    this.id = def.id;
  }

  reset(_nowMs: number): void {
    this.state = this.def.canPatrol ? EnemyState.Patrol : EnemyState.Idle;
    // Nasce ARMADO: o primeiro tiro depois de detectar o jogador também
    // precisa de antecipação, senão o inimigo atira no frame em que aparece.
    this.telegraphLeftMs = this.def.telegraphMs;
    this.memoryLeftMs = 0;
    this.hurtLeftMs = 0;
    this.shotsLeft = 0;
    this.nextShotAtMs = 0;
    this.cooldownUntilMs = 0;
    this.patrolDirection = 1;
  }

  onDamaged(result: DamageResult, _nowMs: number): void {
    if (result.applied <= 0) return;
    if (result.killed) {
      this.state = EnemyState.Dead;
      return;
    }
    this.hurtLeftMs = this.def.hurtMs;
    // Levar tiro conta como detectar: atirar nas costas de um inimigo não
    // deveria deixá-lo passeando como se nada tivesse acontecido.
    this.memoryLeftMs = ALERT_MEMORY_MS;
  }

  update(ctx: BrainContext, dtMs: number, out: BrainOutput): void {
    out.moveX = 0;
    out.wantJump = false;
    out.wantFire = false;
    out.aimAngleRad = null;
    out.facing = ctx.facing;

    if (this.state === EnemyState.Dead) {
      out.state = EnemyState.Dead;
      return;
    }

    this.hurtLeftMs = Math.max(0, this.hurtLeftMs - dtMs);
    if (this.hurtLeftMs > 0) {
      // Atordoado: sem mover, sem atirar. Dá ao jogador uma janela real.
      this.state = EnemyState.Hurt;
      out.state = EnemyState.Hurt;
      return;
    }

    const engaged =
      ctx.playerAlive && ctx.canSeePlayer && ctx.distanceToPlayer <= this.def.sightRange;
    if (engaged) this.memoryLeftMs = ALERT_MEMORY_MS;
    else this.memoryLeftMs = Math.max(0, this.memoryLeftMs - dtMs);

    if (this.memoryLeftMs <= 0) {
      this.disengage(ctx, out);
      return;
    }

    this.engage(ctx, dtMs, out, engaged);
  }

  /* ─────────────────────────── Sem alvo ─────────────────────────── */

  private disengage(ctx: BrainContext, out: BrainOutput): void {
    // Re-arma: reencontrar o jogador telegrafa de novo.
    this.telegraphLeftMs = this.def.telegraphMs;
    this.shotsLeft = 0;

    if (!this.def.canPatrol || ctx.patrolLeft >= ctx.patrolRight) {
      this.state = EnemyState.Idle;
      out.state = EnemyState.Idle;
      return;
    }

    // Vira nas bordas da patrulha, em paredes e em beiradas — nunca cai sozinho.
    if (ctx.blockedAhead || ctx.edgeAhead) this.flip();
    if (ctx.selfX <= ctx.patrolLeft) this.patrolDirection = 1;
    else if (ctx.selfX >= ctx.patrolRight) this.patrolDirection = -1;

    this.state = EnemyState.Patrol;
    out.state = EnemyState.Patrol;
    out.moveX = this.patrolDirection;
    out.facing = this.patrolDirection;
  }

  private flip(): void {
    this.patrolDirection = this.patrolDirection === 1 ? -1 : 1;
  }

  /* ─────────────────────────── Com alvo ─────────────────────────── */

  private engage(ctx: BrainContext, dtMs: number, out: BrainOutput, visible: boolean): void {
    const signed = ctx.playerX - ctx.selfX;
    const facing: -1 | 1 = signed >= 0 ? 1 : -1;
    out.facing = facing;
    this.patrolDirection = facing;

    // Do tronco do inimigo até o ponto de mira do jogador. `ctx.playerY` já é
    // o tronco (ver BrainContext); `ctx.selfY` são os pés.
    out.aimAngleRad = Math.atan2(ctx.playerY - (ctx.selfY - this.def.torsoOffsetY), signed);

    // Rajada em andamento tem prioridade: interrompê-la deixaria o inimigo
    // "gaguejando" sempre que o jogador saísse de vista por um instante.
    if (this.shotsLeft > 0) {
      this.state = EnemyState.Attack;
      out.state = EnemyState.Attack;
      out.moveX = this.alertMovement(ctx, this.def, signed);
      if (ctx.nowMs >= this.nextShotAtMs) {
        out.wantFire = true;
        this.shotsLeft--;
        this.nextShotAtMs = ctx.nowMs + this.def.shotIntervalMs;
        if (this.shotsLeft === 0) {
          this.cooldownUntilMs = ctx.nowMs + this.def.burstCooldownMs;
          // Toda rajada é precedida de antecipação, não só a primeira.
          this.telegraphLeftMs = this.def.telegraphMs;
        }
      }
      return;
    }

    out.moveX = this.alertMovement(ctx, this.def, signed);

    // Em recarga ou sem enxergar: espera, mantendo o telegrafo armado.
    if (ctx.nowMs < this.cooldownUntilMs || !visible) {
      this.telegraphLeftMs = this.def.telegraphMs;
      this.state = EnemyState.Alert;
      out.state = EnemyState.Alert;
      return;
    }

    // Antecipação: o inimigo se prepara de forma visível antes do primeiro tiro.
    if (this.telegraphLeftMs > 0) {
      this.telegraphLeftMs = Math.max(0, this.telegraphLeftMs - dtMs);
      this.state = EnemyState.Alert;
      out.state = EnemyState.Alert;
      return;
    }

    this.shotsLeft = this.def.shotsPerBurst;
    this.nextShotAtMs = ctx.nowMs;
    this.state = EnemyState.Attack;
    out.state = EnemyState.Attack;
  }
}

/** Fábricas dos inimigos do MVP. Cada uma é dados + uma estratégia de movimento. */
export const createSoldierBrain = (): StandardEnemyBrain =>
  new StandardEnemyBrain(ENEMIES.soldier, holdGroundAndBackOff);

export const createHeavyBrain = (): StandardEnemyBrain =>
  new StandardEnemyBrain(ENEMIES.heavy, advance);

export const createTurretBrain = (): StandardEnemyBrain =>
  new StandardEnemyBrain(ENEMIES.turret, stayPut);

export function createBrain(type: EnemyTypeId): StandardEnemyBrain {
  switch (type) {
    case 'soldier':
      return createSoldierBrain();
    case 'heavy':
      return createHeavyBrain();
    case 'turret':
      return createTurretBrain();
  }
}
