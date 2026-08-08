/** Utilitários numéricos. Sem alocação: tudo recebe e devolve primitivos. */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Interpolação independente de framerate. `lerp` cru com um `t` fixo por frame
 * fica mais rápido em 120 Hz do que em 60 Hz; este não.
 */
export const damp = (a: number, b: number, lambda: number, dtMs: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * (dtMs / 1000)));

/** Move `current` na direção de `target` no máximo `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export const sign = (v: number): -1 | 0 | 1 => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Zona morta radial para sticks analógicos, com renormalização. */
export function applyDeadzone(value: number, deadzone: number): number {
  const a = Math.abs(value);
  if (a < deadzone) return 0;
  return sign(value) * ((a - deadzone) / (1 - deadzone));
}

/** RNG determinístico e semeável — replays e testes precisam disso. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
