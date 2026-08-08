/**
 * Física de movimento do player — o coração do game feel, e 100% testável.
 *
 * DIVISÃO DE RESPONSABILIDADE (importante):
 *   - Este módulo é dono da VELOCIDADE, inclusive da gravidade. O corpo Arcade
 *     roda com `allowGravity = false`.
 *   - O Arcade é dono da POSIÇÃO e da RESOLUÇÃO DE COLISÃO.
 *
 * Poderia ser mais simples deixar a gravidade no Arcade, mas então gravidade
 * assimétrica, corte de pulo e velocidade terminal ficariam presos dentro do
 * motor, impossíveis de testar e difíceis de ajustar. Como esses três são
 * exatamente o que faz um run & gun sentir bem, eles moram aqui.
 */

import { PLAYER } from '../config/tuning';
import { approach, clamp } from '../math';
import { Locomotion, type PlayerState } from './player-state';

export interface MovementInput {
  /** -1..1. Analógico no gamepad/joystick, digital no teclado. */
  axisX: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
}

/** Resultado reutilizável — o chamador é dono do objeto (zero alocação/frame). */
export interface MovementResult {
  jumped: boolean;
  landed: boolean;
  landingSpeed: number;
  turned: boolean;
}

export function createMovementResult(): MovementResult {
  return { jumped: false, landed: false, landingSpeed: 0, turned: false };
}

/**
 * Avança um passo de simulação. Mutação deliberada: roda 60×/s e alocar aqui
 * produziria exatamente o GC durante combate que o plano proíbe.
 *
 * Pré-condição: `s.grounded` e `s.blockedSide` já refletem o mundo atual.
 */
export function stepMovement(
  s: PlayerState,
  input: MovementInput,
  dtMs: number,
  out: MovementResult,
): void {
  out.jumped = false;
  out.landed = false;
  out.landingSpeed = 0;
  out.turned = false;

  const dt = dtMs / 1000;

  /* ── Aterrissagem ── */
  if (s.grounded && !s.wasGrounded) {
    out.landed = true;
    out.landingSpeed = s.vy;
    s.landingMs = PLAYER.landingMs;
    s.jumpCutApplied = false;
  }

  /* ── Temporizadores de perdão ──
     Coyote time e jump buffer são a diferença entre "o jogo não respondeu" e
     "eu errei". Praticamente todo pulo que parece injusto cai em um dos dois. */
  if (s.grounded) {
    s.coyoteMs = PLAYER.coyoteMs;
    s.airborneMs = 0;
  } else {
    s.coyoteMs = Math.max(0, s.coyoteMs - dtMs);
    s.airborneMs += dtMs;
  }

  s.jumpBufferMs = input.jumpPressed ? PLAYER.jumpBufferMs : Math.max(0, s.jumpBufferMs - dtMs);
  s.jumpRearmMs = Math.max(0, s.jumpRearmMs - dtMs);
  s.landingMs = Math.max(0, s.landingMs - dtMs);
  s.hurtMs = Math.max(0, s.hurtMs - dtMs);
  s.invulnMs = Math.max(0, s.invulnMs - dtMs);

  /* ── Morte: só a gravidade continua ── */
  if (s.dead) {
    s.vx = approach(s.vx, 0, PLAYER.groundFriction * dt);
    s.vy = Math.min(s.vy + PLAYER.gravityDown * dt, PLAYER.maxFallSpeed);
    s.locomotion = Locomotion.Dead;
    s.wasGrounded = s.grounded;
    return;
  }

  /* ── Horizontal ── */
  const stunned = s.hurtMs > 0;
  const axis = stunned ? 0 : clamp(input.axisX, -1, 1);
  const target = axis * PLAYER.maxSpeed;
  const wantsMove = Math.abs(axis) > 0.01;

  const accel = s.grounded
    ? wantsMove
      ? PLAYER.groundAccel
      : PLAYER.groundFriction
    : wantsMove
      ? PLAYER.airAccel
      : PLAYER.airFriction;

  s.vx = approach(s.vx, target, accel * dt);

  // Parede: zera a velocidade contra ela para não "colar" acelerando no vazio.
  if (s.blockedSide !== 0 && Math.sign(s.vx) === s.blockedSide) s.vx = 0;

  if (wantsMove && !stunned) {
    const nextFacing = axis > 0 ? 1 : -1;
    if (nextFacing !== s.facing) {
      s.facing = nextFacing;
      out.turned = true;
    }
  }

  /* ── Pulo ── */
  const canJump = (s.grounded || s.coyoteMs > 0) && s.jumpRearmMs <= 0 && !stunned;
  if (s.jumpBufferMs > 0 && canJump) {
    s.vy = -PLAYER.jumpVelocity;
    s.grounded = false;
    s.coyoteMs = 0;
    s.jumpBufferMs = 0;
    s.jumpRearmMs = PLAYER.jumpRearmMs;
    s.jumpCutApplied = false;
    out.jumped = true;
  }

  // Corte do pulo: soltar o botão na subida encurta o salto.
  if (!input.jumpHeld && s.vy < 0 && !s.jumpCutApplied && !s.grounded) {
    s.vy *= PLAYER.jumpCutMultiplier;
    s.jumpCutApplied = true;
  }
  s.jumpHeld = input.jumpHeld;

  /* ── Vertical ──
     Gravidade assimétrica: sobe leve, cai pesado. É o que dá peso arcade sem
     deixar o pulo lento. */
  if (!s.grounded) {
    const gravity = s.vy < 0 ? PLAYER.gravityUp : PLAYER.gravityDown;
    s.vy = Math.min(s.vy + gravity * dt, PLAYER.maxFallSpeed);
  } else if (s.vy >= 0) {
    // Mantém o corpo pressionando o chão — ver PLAYER.groundStickVelocity.
    s.vy = PLAYER.groundStickVelocity;
  }

  s.locomotion = resolveLocomotion(s, wantsMove);
  s.wasGrounded = s.grounded;
}

function resolveLocomotion(s: PlayerState, wantsMove: boolean): Locomotion {
  if (s.dead) return Locomotion.Dead;
  if (s.hurtMs > 0) return Locomotion.Hurt;
  if (!s.grounded) return s.vy < 0 ? Locomotion.JumpRise : Locomotion.Fall;
  if (s.landingMs > 0) return Locomotion.Land;
  if (wantsMove || Math.abs(s.vx) > 8) return Locomotion.Run;
  return Locomotion.Idle;
}
