/**
 * Armas são DADOS, não classes.
 *
 * Adicionar uma arma nova = uma entrada em `weapons.data.ts` + chaves de FX e
 * áudio. Nada no PlayerActor muda. Herança só entraria se uma arma precisasse
 * de um comportamento que dados não expressam — e aí seria `behavior`, não uma
 * subclasse.
 */

export type WeaponId = 'pistol' | 'machinegun' | 'shotgun';
export type Team = 'player' | 'enemy';

export interface ExplosionDef {
  readonly radius: number;
  readonly damageAtCenter: number;
  readonly damageAtEdge: number;
  readonly knockback: number;
  readonly shake: number;
}

export interface WeaponDef {
  readonly id: WeaponId;
  readonly displayNameKey: string;
  /** `hitscan` já é previsto pelo schema; nenhuma arma do MVP usa. */
  readonly delivery: 'projectile' | 'hitscan';
  readonly fireRateMs: number;
  readonly damage: number;
  readonly pelletsPerShot: number;
  /** Abertura total do cone, em graus. */
  readonly spreadDeg: number;
  /** Spread extra acumulado por tiro seguido, em graus (0 = sem recuo de mira). */
  readonly spreadGrowthDeg: number;
  readonly spreadMaxDeg: number;
  /** Tempo sem atirar para o spread voltar ao mínimo. */
  readonly spreadRecoveryMs: number;
  readonly projectileSpeed: number;
  readonly projectileLifeMs: number;
  readonly ammoMax: number | 'infinite';
  readonly ammoPerShot: number;
  readonly autoFire: boolean;
  /** Empurrão aplicado no atirador, em px/s. */
  readonly recoil: number;
  /** Trauma de câmera 0..1. */
  readonly screenShake: number;
  readonly explosion?: ExplosionDef;
  readonly fx: {
    readonly muzzle: string;
    readonly impact: string;
    readonly projectile: string;
  };
}

/** Pedido de projétil. A camada de jogo materializa a partir do pool. */
export interface ShotRequest {
  x: number;
  y: number;
  angleRad: number;
  speed: number;
  damage: number;
  lifeMs: number;
  ownerId: number;
  team: Team;
  weaponId: WeaponId;
}

export interface WeaponState {
  weaponId: WeaponId;
  ammo: number | 'infinite';
  nextReadyMs: number;
  /** Spread atual acumulado, em graus. */
  spreadDeg: number;
  lastFireMs: number;
  /** Impede que segurar o gatilho dispare armas semi-automáticas. */
  triggerConsumed: boolean;
}

export function createWeaponState(def: WeaponDef): WeaponState {
  return {
    weaponId: def.id,
    ammo: def.ammoMax,
    nextReadyMs: 0,
    spreadDeg: 0,
    lastFireMs: -Infinity,
    triggerConsumed: false,
  };
}
