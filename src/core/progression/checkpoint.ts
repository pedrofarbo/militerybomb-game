/**
 * Checkpoint: o ponto para onde a morte devolve o jogador.
 *
 * O snapshot é deliberadamente PEQUENO e 100% serializável — nada de objeto
 * Phaser, nada de referência a entidade viva. Só isso permite guardá-lo no
 * `RunState`, compará-lo num teste e, mais adiante, gravá-lo em disco.
 *
 * O que NÃO está aqui, de propósito: a lista de inimigos já mortos. Morrer
 * recarrega a fase e reposiciona o jogador no checkpoint; os inimigos antes
 * dele voltam, mas ficam para trás. Rastrear cada entidade consumida custaria
 * um sistema de identidade estável em toda a fase para resolver um problema
 * que o jogador nunca encontra — ele está indo para a frente.
 */

import type { WeaponId } from '../weapons/weapon-def';

/** Com o que o jogador reaparece. Sem isto, pegar a escopeta e morrer punia. */
export interface Loadout {
  weaponId: WeaponId;
  ammo: number | 'infinite';
  grenades: number;
}

export interface CheckpointSnapshot {
  readonly id: string;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly loadout: Loadout;
}

export function createLoadout(): Loadout {
  return { weaponId: 'pistol', ammo: 'infinite', grenades: 5 };
}

export function captureCheckpoint(
  id: string,
  spawnX: number,
  spawnY: number,
  loadout: Readonly<Loadout>,
): CheckpointSnapshot {
  // Cópia: o loadout do jogador continua mudando depois desta chamada, e um
  // snapshot que muda sozinho não é snapshot.
  return {
    id,
    spawnX,
    spawnY,
    loadout: { weaponId: loadout.weaponId, ammo: loadout.ammo, grenades: loadout.grenades },
  };
}
