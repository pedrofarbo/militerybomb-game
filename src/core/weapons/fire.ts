/**
 * Resolução de tiro — pura. Decide SE atira e QUAIS projéteis nascem;
 * quem os materializa (a partir do pool) é a camada de jogo.
 */

import type { ShotRequest, WeaponDef, WeaponState, Team } from './weapon-def';
import { clamp } from '../math';

export interface FireContext {
  /** Posição da boca do cano, em coordenadas de mundo. */
  x: number;
  y: number;
  angleRad: number;
  ownerId: number;
  team: Team;
  triggerHeld: boolean;
  triggerPressed: boolean;
  /** RNG injetado: replays e testes precisam de dispersão reprodutível. */
  random: () => number;
}

export type FireRejection = 'cooldown' | 'no-ammo' | 'semi-auto' | 'trigger-up';

export interface FireOutcome {
  fired: boolean;
  reason: FireRejection | null;
  /** Buffer reutilizado — copie se precisar guardar. */
  shots: ShotRequest[];
  recoil: number;
  shake: number;
}

export function createFireOutcome(): FireOutcome {
  return { fired: false, reason: null, shots: [], recoil: 0, shake: 0 };
}

export function tryFire(
  s: WeaponState,
  def: WeaponDef,
  ctx: FireContext,
  nowMs: number,
  out: FireOutcome,
): void {
  out.fired = false;
  out.reason = null;
  out.shots.length = 0;
  out.recoil = 0;
  out.shake = 0;

  // Recuperação de precisão acontece mesmo quando não se atira.
  if (def.spreadRecoveryMs > 0 && s.spreadDeg > def.spreadDeg) {
    const idleMs = nowMs - s.lastFireMs;
    if (idleMs > 0) {
      const recovered = (idleMs / def.spreadRecoveryMs) * (def.spreadMaxDeg - def.spreadDeg);
      s.spreadDeg = Math.max(def.spreadDeg, s.spreadDeg - recovered);
    }
  }

  if (!ctx.triggerHeld) {
    s.triggerConsumed = false;
    out.reason = 'trigger-up';
    return;
  }
  if (!def.autoFire && s.triggerConsumed && !ctx.triggerPressed) {
    out.reason = 'semi-auto';
    return;
  }
  if (nowMs < s.nextReadyMs) {
    out.reason = 'cooldown';
    return;
  }
  if (s.ammo !== 'infinite' && s.ammo < def.ammoPerShot) {
    out.reason = 'no-ammo';
    return;
  }

  const spread = clamp(s.spreadDeg || def.spreadDeg, 0, def.spreadMaxDeg || def.spreadDeg);
  const spreadRad = (spread * Math.PI) / 180;

  for (let i = 0; i < def.pelletsPerShot; i++) {
    // Um único pellet sai reto; vários se distribuem pelo cone com jitter.
    const t = def.pelletsPerShot === 1 ? 0 : i / (def.pelletsPerShot - 1) - 0.5;
    const jitter = (ctx.random() - 0.5) * (spreadRad / Math.max(1, def.pelletsPerShot));
    out.shots.push({
      x: ctx.x,
      y: ctx.y,
      angleRad: ctx.angleRad + t * spreadRad + jitter,
      speed: def.projectileSpeed,
      damage: def.damage,
      lifeMs: def.projectileLifeMs,
      ownerId: ctx.ownerId,
      team: ctx.team,
      weaponId: def.id,
    });
  }

  if (s.ammo !== 'infinite') s.ammo -= def.ammoPerShot;
  s.nextReadyMs = nowMs + def.fireRateMs;
  s.lastFireMs = nowMs;
  s.triggerConsumed = true;
  if (def.spreadGrowthDeg > 0) {
    s.spreadDeg = Math.min(def.spreadMaxDeg, (s.spreadDeg || def.spreadDeg) + def.spreadGrowthDeg);
  }

  out.fired = true;
  out.recoil = def.recoil;
  out.shake = def.screenShake;
}
