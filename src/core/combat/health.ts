/**
 * Vida, dano e invulnerabilidade.
 *
 * Puro e sem alocação: `applyDamage` escreve num resultado que o chamador é
 * dono. Rodam 60×/s durante combate pesado, e alocar aqui produz exatamente o
 * GC no meio do tiroteio que o plano proíbe.
 */

export type DamageKind = 'bullet' | 'explosion' | 'contact' | 'crush';

export interface HealthState {
  current: number;
  max: number;
  /** Tempo restante de invulnerabilidade. */
  invulnMs: number;
  /**
   * Invulnerabilidade concedida a cada dano recebido.
   *
   * Zero para inimigos, DE PROPÓSITO: com i-frames, só um dos 5 pellets da
   * escopeta contaria, e a arma perderia a razão de existir.
   */
  invulnAfterHitMs: number;
  lastHitMs: number;
  dead: boolean;
}

export interface DamageInfo {
  amount: number;
  kind: DamageKind;
  sourceId: number;
  /** Origem do golpe, em coordenadas de mundo — define a direção do empurrão. */
  originX: number;
  originY: number;
  knockback: number;
}

export type DamageRejection = 'invulnerable' | 'already-dead' | 'no-damage';

export interface DamageResult {
  applied: number;
  killed: boolean;
  rejected: DamageRejection | null;
  knockbackX: number;
  knockbackY: number;
}

export function createHealth(max: number, invulnAfterHitMs = 0): HealthState {
  return {
    current: max,
    max,
    invulnMs: 0,
    invulnAfterHitMs,
    lastHitMs: -Infinity,
    dead: false,
  };
}

export function createDamageResult(): DamageResult {
  return { applied: 0, killed: false, rejected: null, knockbackX: 0, knockbackY: 0 };
}

export function tickHealth(h: HealthState, dtMs: number): void {
  if (h.invulnMs > 0) h.invulnMs = Math.max(0, h.invulnMs - dtMs);
}

/**
 * @param targetX,targetY centro do alvo — usado para direcionar o empurrão.
 */
export function applyDamage(
  h: HealthState,
  d: DamageInfo,
  targetX: number,
  targetY: number,
  nowMs: number,
  out: DamageResult,
): void {
  out.applied = 0;
  out.killed = false;
  out.rejected = null;
  out.knockbackX = 0;
  out.knockbackY = 0;

  if (h.dead) {
    out.rejected = 'already-dead';
    return;
  }
  if (h.invulnMs > 0) {
    out.rejected = 'invulnerable';
    return;
  }
  if (d.amount <= 0) {
    out.rejected = 'no-damage';
    return;
  }

  const applied = Math.min(d.amount, h.current);
  h.current -= applied;
  h.lastHitMs = nowMs;
  h.invulnMs = h.invulnAfterHitMs;
  h.dead = h.current <= 0;

  out.applied = applied;
  out.killed = h.dead;

  if (d.knockback > 0) {
    const dx = targetX - d.originX;
    const dy = targetY - d.originY;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) {
      // Golpe exatamente no centro: empurra para cima em vez de dividir por zero.
      out.knockbackY = -d.knockback;
    } else {
      out.knockbackX = (dx / length) * d.knockback;
      // Componente vertical reduzida: empurrar para o alto atrapalha a leitura
      // e joga inimigos por cima do cenário.
      out.knockbackY = (dy / length) * d.knockback * 0.45;
    }
  }
}

export function healTo(h: HealthState, amount: number): number {
  const healed = Math.min(amount, h.max - h.current);
  h.current += healed;
  if (h.current > 0) h.dead = false;
  return healed;
}
