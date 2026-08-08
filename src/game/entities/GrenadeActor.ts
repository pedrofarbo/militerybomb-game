/**
 * Granada: arco previsível, quica no cenário, explode no fim do pavio.
 *
 * A física do arco e do quique é resolvida em `core/combat/explosives.ts`;
 * aqui só aplicamos o resultado ao corpo Arcade e detectamos o contato.
 */

import type Phaser from 'phaser';
import {
  GRENADE,
  createGrenadeState,
  stepGrenade,
  throwGrenade,
  type GrenadeState,
} from '../../core/combat/explosives';
import { SPRITES } from '../../assets/manifest';
import { DEPTH_PROJECTILES } from '../fx/FxService';

export class GrenadeActor {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly state: GrenadeState = createGrenadeState();
  private readonly stepResult = { exploded: false };

  constructor(scene: Phaser.Scene) {
    const art = SPRITES['projectile.grenade' as keyof typeof SPRITES] ?? {
      atlas: 'fx',
      frame: 'grenade/0',
    };
    this.sprite = scene.physics.add.sprite(0, 0, art.atlas, art.frame);
    this.sprite.setDepth(DEPTH_PROJECTILES);
    this.sprite.setActive(false).setVisible(false);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(GRENADE.radiusPx * 2, GRENADE.radiusPx * 2);
    // Quique é resolvido pelo core; o Arcade só reporta o contato.
    body.setBounce(0, 0);
    body.setEnable(false);
  }

  throw(x: number, y: number, angleRad: number, facing: -1 | 1): void {
    this.sprite.setActive(true).setVisible(true);
    this.sprite.play('projectile.grenade', true);
    throwGrenade(this.state, angleRad, facing);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true);
    body.reset(x, y);
    body.setVelocity(this.state.vx, this.state.vy);
  }

  /** @returns `true` quando o pavio termina e a cena deve explodir a granada. */
  tick(dtMs: number): boolean {
    if (!this.sprite.active) return false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    this.state.vx = body.velocity.x;
    this.state.vy = body.velocity.y;

    stepGrenade(
      this.state,
      dtMs,
      {
        down: body.blocked.down || body.touching.down,
        side: body.blocked.left || body.blocked.right,
      },
      this.stepResult,
    );

    body.setVelocity(this.state.vx, this.state.vy);
    return this.stepResult.exploded;
  }

  deactivate(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);
    this.sprite.setActive(false).setVisible(false);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  setActive(active: boolean): this {
    this.sprite.setActive(active);
    return this;
  }

  setVisible(visible: boolean): this {
    this.sprite.setVisible(visible);
    return this;
  }
}
