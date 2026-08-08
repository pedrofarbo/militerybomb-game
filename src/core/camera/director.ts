/**
 * Lógica de câmera — pura, e por isso testável sem renderizar nada.
 *
 * Três decisões definem se a câmera ajuda ou atrapalha num run & gun:
 *   1. deadzone: micro-ajustes do jogador não movem a câmera (menos enjoo);
 *   2. lookahead: mostra o perigo ANTES dele chegar;
 *   3. trauma saturado: dez explosões juntas não somam dez screen shakes.
 */

import { CAMERA } from '../config/tuning';
import { clamp, damp } from '../math';

export interface CameraTarget {
  x: number;
  y: number;
  facing: -1 | 1;
  vx: number;
}

export interface CameraViewport {
  width: number;
  height: number;
}

export interface CameraBounds {
  width: number;
  height: number;
}

export interface CameraState {
  /** Centro da câmera, em px de mundo. */
  x: number;
  y: number;
  lookahead: number;
  /** 0..1. O deslocamento é ∝ trauma², então valores baixos quase não mexem. */
  trauma: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  shakeAngle: number;
  timeMs: number;
}

export function createCameraState(x: number, y: number): CameraState {
  return {
    x,
    y,
    lookahead: 0,
    trauma: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    shakeAngle: 0,
    timeMs: 0,
  };
}

/** Acumula trauma. Satura em 1: rajada de explosões não vira terremoto. */
export function addTrauma(s: CameraState, amount: number): void {
  s.trauma = clamp(s.trauma + amount, 0, 1);
}

export function stepCamera(
  s: CameraState,
  target: CameraTarget,
  viewport: CameraViewport,
  bounds: CameraBounds,
  dtMs: number,
  shakeIntensity: number,
): void {
  s.timeMs += dtMs;

  /* Lookahead: acompanha a direção da corrida, não só a face. Virar parado
     não deve arrastar a câmera. */
  const speedRatio = clamp(Math.abs(target.vx) / 170, 0, 1);
  const desiredLookahead = target.facing * CAMERA.lookaheadX * speedRatio;
  s.lookahead = damp(s.lookahead, desiredLookahead, CAMERA.lookaheadLerp * 60, dtMs);

  const focusX = target.x + s.lookahead;
  const focusY = target.y;

  /* Deadzone: a câmera só persegue quando o alvo sai da caixa central. */
  const halfDeadX = CAMERA.deadzoneWidth / 2;
  const halfDeadY = CAMERA.deadzoneHeight / 2;
  const dx = focusX - s.x;
  const dy = focusY - s.y;

  let desiredX = s.x;
  let desiredY = s.y;
  if (dx > halfDeadX) desiredX = focusX - halfDeadX;
  else if (dx < -halfDeadX) desiredX = focusX + halfDeadX;
  if (dy > halfDeadY) desiredY = focusY - halfDeadY;
  else if (dy < -halfDeadY) desiredY = focusY + halfDeadY;

  s.x = damp(s.x, desiredX, CAMERA.followLerpX * 60, dtMs);
  s.y = damp(s.y, desiredY, CAMERA.followLerpY * 60, dtMs);

  /* Limites de mundo. Se a fase for menor que a viewport, centraliza. */
  const halfW = viewport.width / 2;
  const halfH = viewport.height / 2;
  s.x = bounds.width <= viewport.width ? bounds.width / 2 : clamp(s.x, halfW, bounds.width - halfW);
  s.y =
    bounds.height <= viewport.height ? bounds.height / 2 : clamp(s.y, halfH, bounds.height - halfH);

  /* Shake. Ruído senoidal defasado em vez de aleatório: reprodutível em
     replays e sem o "chiado" de alta frequência que embrulha o estômago. */
  s.trauma = Math.max(0, s.trauma - (CAMERA.traumaDecayPerSec * dtMs) / 1000);
  const shake = s.trauma * s.trauma * clamp(shakeIntensity, 0, 1);
  if (shake > 0) {
    const t = (s.timeMs / 1000) * CAMERA.shakeFrequency;
    s.shakeOffsetX = Math.sin(t * 2.17) * CAMERA.traumaMaxOffset * shake;
    s.shakeOffsetY = Math.sin(t * 3.11 + 1.7) * CAMERA.traumaMaxOffset * shake;
    s.shakeAngle = Math.sin(t * 1.63 + 0.9) * CAMERA.traumaMaxAngle * shake;
  } else {
    s.shakeOffsetX = 0;
    s.shakeOffsetY = 0;
    s.shakeAngle = 0;
  }
}
