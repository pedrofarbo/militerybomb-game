/**
 * Mira em 8 direções (5 sprites de braço + espelhamento).
 *
 * Regra de design: mirar para BAIXO à frente só existe no ar. No chão,
 * apontar para baixo mira reto para frente — apontar para o próprio pé não
 * serve para nada e rouba um input que o jogador quer usar para agachar depois.
 */

export type AimDirection = 'fwd' | 'up45' | 'up' | 'down45' | 'down';

export interface AimResult {
  readonly direction: AimDirection;
  /** Ângulo em radianos, JÁ considerando a direção de face. 0 = para +X. */
  readonly angleRad: number;
}

const ANGLE: Record<AimDirection, number> = {
  fwd: 0,
  up45: -Math.PI / 4,
  up: -Math.PI / 2,
  down45: Math.PI / 4,
  down: Math.PI / 2,
};

const RESULTS = new Map<string, AimResult>();

function result(direction: AimDirection, facing: -1 | 1): AimResult {
  const cacheKey = `${direction}:${facing}`;
  let r = RESULTS.get(cacheKey);
  if (!r) {
    // `up` e `down` são verticais: espelhar inverteria o sinal errado.
    const base = ANGLE[direction];
    const angleRad =
      direction === 'up' || direction === 'down' ? base : facing === 1 ? base : Math.PI - base;
    r = { direction, angleRad };
    RESULTS.set(cacheKey, r);
  }
  return r;
}

const VERTICAL_THRESHOLD = 0.55;
const DIAGONAL_THRESHOLD = 0.4;

export function resolveAim(
  axisX: number,
  axisY: number,
  facing: -1 | 1,
  grounded: boolean,
): AimResult {
  const horizontal = Math.abs(axisX);

  if (axisY <= -VERTICAL_THRESHOLD && horizontal < DIAGONAL_THRESHOLD) return result('up', facing);
  if (axisY <= -DIAGONAL_THRESHOLD) return result('up45', facing);

  if (!grounded) {
    if (axisY >= VERTICAL_THRESHOLD && horizontal < DIAGONAL_THRESHOLD)
      return result('down', facing);
    if (axisY >= DIAGONAL_THRESHOLD) return result('down45', facing);
  }

  return result('fwd', facing);
}

/** Chave de animação do braço para a direção resolvida. */
export function armAnimKey(direction: AimDirection): string {
  return `player.arm.${direction}`;
}
