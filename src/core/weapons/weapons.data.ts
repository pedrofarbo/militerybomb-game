/** Catálogo de armas. Balanceamento vive aqui — e só aqui. */

import type { WeaponDef, WeaponId } from './weapon-def';

export const WEAPONS: Readonly<Record<WeaponId, WeaponDef>> = {
  pistol: {
    id: 'pistol',
    displayNameKey: 'weapon.pistol',
    delivery: 'projectile',
    fireRateMs: 190,
    damage: 10,
    pelletsPerShot: 1,
    spreadDeg: 0,
    spreadGrowthDeg: 0,
    spreadMaxDeg: 0,
    spreadRecoveryMs: 0,
    projectileSpeed: 520,
    projectileLifeMs: 900,
    // Arma inicial: nunca acaba. O jogador nunca fica sem nada para fazer.
    ammoMax: 'infinite',
    ammoPerShot: 0,
    autoFire: false,
    recoil: 0,
    screenShake: 0.06,
    fx: {
      muzzle: 'fx.muzzle.small',
      impact: 'fx.impact.concrete',
      projectile: 'projectile.bullet',
    },
  },

  machinegun: {
    id: 'machinegun',
    displayNameKey: 'weapon.machinegun',
    delivery: 'projectile',
    fireRateMs: 80,
    damage: 8,
    pelletsPerShot: 1,
    spreadDeg: 2,
    // Precisão cai enquanto segura o gatilho: recompensa rajadas curtas.
    spreadGrowthDeg: 1.1,
    spreadMaxDeg: 9,
    spreadRecoveryMs: 340,
    projectileSpeed: 560,
    projectileLifeMs: 900,
    ammoMax: 220,
    ammoPerShot: 1,
    autoFire: true,
    recoil: 12,
    screenShake: 0.05,
    fx: {
      muzzle: 'fx.muzzle.medium',
      impact: 'fx.impact.concrete',
      projectile: 'projectile.bullet',
    },
  },

  shotgun: {
    id: 'shotgun',
    displayNameKey: 'weapon.shotgun',
    delivery: 'projectile',
    fireRateMs: 520,
    damage: 7,
    pelletsPerShot: 5,
    spreadDeg: 26,
    spreadGrowthDeg: 0,
    spreadMaxDeg: 26,
    spreadRecoveryMs: 0,
    projectileSpeed: 470,
    projectileLifeMs: 340,
    ammoMax: 40,
    ammoPerShot: 1,
    autoFire: false,
    recoil: 90,
    screenShake: 0.22,
    fx: { muzzle: 'fx.muzzle.large', impact: 'fx.impact.metal', projectile: 'projectile.pellet' },
  },
};

export const WEAPON_ORDER: readonly WeaponId[] = ['pistol', 'machinegun', 'shotgun'];
