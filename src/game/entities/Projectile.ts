/**
 * Projétil vindo de pool.
 *
 * O `ShotRequest` que o alimenta foi decidido em `core/weapons/fire.ts` — este
 * arquivo só materializa o pedido. É o que permite testar cadência, munição e
 * dispersão sem abrir um browser.
 */

import Phaser from 'phaser';
import type { ShotRequest } from '../../core/weapons/weapon-def';
import { SPRITES } from '../../assets/manifest';
import { DEPTH_PROJECTILES } from '../fx/FxService';

export type ProjectilePoolTag = 'player' | 'enemy';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  /**
   * De qual pool este projétil saiu. É PROPRIEDADE DO OBJETO, não do disparo:
   * devolver ao pool pelo `team` do tiro funcionaria hoje e quebraria em
   * silêncio no dia em que um projétil mudar de dono (ricochete, arma
   * capturada), corrompendo os dois pools.
   */
  readonly poolTag: ProjectilePoolTag;

  damage = 0;
  team: ShotRequest['team'] = 'player';
  ownerId = -1;
  weaponId: ShotRequest['weaponId'] = 'pistol';
  private lifeMs = 0;

  constructor(scene: Phaser.Scene, poolTag: ProjectilePoolTag) {
    const sprite = SPRITES['projectile.bullet'];
    super(scene, 0, 0, sprite.atlas, sprite.frame);
    this.poolTag = poolTag;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH_PROJECTILES);
    this.setActive(false).setVisible(false);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setEnable(false);
  }

  fire(shot: ShotRequest, textureFrame: { atlas: string; frame: string }): void {
    this.setTexture(textureFrame.atlas, textureFrame.frame);
    this.setActive(true).setVisible(true);
    this.setPosition(shot.x, shot.y);
    this.setRotation(shot.angleRad);

    this.damage = shot.damage;
    this.team = shot.team;
    this.ownerId = shot.ownerId;
    this.weaponId = shot.weaponId;
    this.lifeMs = shot.lifeMs;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    // Hitbox um pouco menor que o sprite: projétil que "raspa" e acerta é
    // exatamente o tipo de coisa que faz o jogo parecer injusto.
    body.setSize(Math.max(4, this.width - 4), Math.max(3, this.height - 2));
    body.reset(shot.x, shot.y);
    body.setVelocity(Math.cos(shot.angleRad) * shot.speed, Math.sin(shot.angleRad) * shot.speed);
  }

  /** @returns `true` quando expirou e deve voltar ao pool. */
  tick(dtMs: number): boolean {
    if (!this.active) return false;
    this.lifeMs -= dtMs;
    return this.lifeMs <= 0;
  }

  deactivate(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);
    this.setActive(false).setVisible(false);
  }
}
