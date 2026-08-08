/**
 * O player: a ponte entre as regras (core) e a apresentação (Phaser).
 *
 * O que este arquivo FAZ: montar a entrada, aplicar o resultado ao corpo
 * Arcade, escolher sprite e animação, posicionar o braço de mira.
 * O que este arquivo NÃO FAZ: decidir. Aceleração, gravidade, pulo, cadência
 * de tiro e dispersão são resolvidos em `core/` e só aplicados aqui.
 */

import type Phaser from 'phaser';
import { Action } from '../../core/input/actions';
import type { InputSnapshot } from '../../core/input/snapshot';
import { PLAYER } from '../../core/config/tuning';
import {
  createPlayerState,
  resetPlayerState,
  type PlayerState,
} from '../../core/player/player-state';
import {
  createMovementResult,
  stepMovement,
  type MovementInput,
  type MovementResult,
} from '../../core/player/movement';
import { armAnimKey, resolveAim } from '../../core/player/aim';
import { resolvePlayerAnim, runAnimTimeScale } from '../../core/anim/resolver';
import { createFireOutcome, tryFire, type FireContext } from '../../core/weapons/fire';
import {
  createWeaponState,
  type ShotRequest,
  type WeaponId,
  type WeaponState,
} from '../../core/weapons/weapon-def';
import { WEAPONS, WEAPON_ORDER } from '../../core/weapons/weapons.data';
import { ART_METRICS } from '../../assets/manifest';
import { LOCKED_ANIMS } from '../anim/AnimationRegistry';
import { DEPTH_PLAYER } from '../fx/FxService';

export interface PlayerCallbacks {
  onShots(
    shots: readonly ShotRequest[],
    weaponId: WeaponId,
    muzzleX: number,
    muzzleY: number,
    angleRad: number,
  ): void;
  onJump(x: number, y: number): void;
  onLand(x: number, y: number, fallSpeed: number): void;
  onWeaponChanged(weaponId: WeaponId, ammo: number | 'infinite'): void;
  onShake(trauma: number): void;
}

const FRAME = ART_METRICS.player.frame;
const ORIGIN_Y = ART_METRICS.player.feetY / FRAME;

export class PlayerActor {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly arm: Phaser.GameObjects.Sprite;
  readonly state: PlayerState;

  private readonly movementInput: MovementInput = { axisX: 0, jumpHeld: false, jumpPressed: false };
  private readonly movementResult: MovementResult = createMovementResult();
  private readonly fireOutcome = createFireOutcome();
  private readonly fireContext: FireContext;
  private weapon: WeaponState;
  private currentAnim = '';
  private animLocked = false;
  private spawnX = 0;
  private spawnY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly callbacks: PlayerCallbacks,
    random: () => number,
  ) {
    this.state = createPlayerState(PLAYER.maxHealth);
    this.weapon = createWeaponState(WEAPONS.pistol);

    this.sprite = scene.physics.add.sprite(x, y, 'characters', 'dara/idle/0');
    // Origem na LINHA DOS PÉS (58/64): a posição do sprite é onde ele pisa,
    // que é a mesma semântica do spawn da fase e do chão do tilemap.
    this.sprite.setOrigin(0.5, ORIGIN_Y);
    this.sprite.setDepth(DEPTH_PLAYER);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER.bodyWidth, PLAYER.bodyHeight);
    body.setOffset(PLAYER.bodyOffsetX, PLAYER.bodyOffsetY);
    // A gravidade é do core (ver movement.ts). O Arcade só move e resolve.
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);

    this.arm = scene.add.sprite(x, y, 'characters', 'dara/arm/fwd/0');
    this.arm.setOrigin(0.5, 0.5);
    this.arm.setDepth(DEPTH_PLAYER + 1);

    this.fireContext = {
      x: 0,
      y: 0,
      angleRad: 0,
      ownerId: 0,
      team: 'player',
      triggerHeld: false,
      triggerPressed: false,
      random,
    };

    this.setSpawn(x, y);
  }

  setSpawn(x: number, y: number): void {
    this.spawnX = x;
    this.spawnY = y;
  }

  respawn(): void {
    resetPlayerState(this.state, PLAYER.maxHealth);
    this.state.invulnMs = PLAYER.invulnMs;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.reset(this.spawnX, this.spawnY);
    this.sprite.setAlpha(1);
    this.sprite.setActive(true).setVisible(true);
    this.arm.setVisible(true);
    this.currentAnim = '';
    this.animLocked = false;
  }

  /** Roda antes da física: decide as velocidades deste passo. */
  preStep(input: InputSnapshot, dtMs: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const s = this.state;

    // O mundo informa o contato; o core decide o que fazer com ele.
    s.grounded = body.blocked.down || body.touching.down;
    s.blockedSide = body.blocked.left ? -1 : body.blocked.right ? 1 : 0;
    if (body.blocked.up && s.vy < 0) s.vy = 0;

    this.movementInput.axisX = input.axisX;
    this.movementInput.jumpHeld = input.held(Action.Jump);
    this.movementInput.jumpPressed = input.justPressed(Action.Jump);

    stepMovement(s, this.movementInput, dtMs, this.movementResult);

    if (this.movementResult.jumped) this.callbacks.onJump(this.sprite.x, this.sprite.y);
    if (this.movementResult.landed) {
      this.callbacks.onLand(this.sprite.x, this.sprite.y, this.movementResult.landingSpeed);
    }

    body.setVelocity(s.vx, s.vy);
  }

  /** Roda depois da física: mira, tiro e apresentação. */
  postStep(input: InputSnapshot, nowMs: number, dtMs: number): void {
    const s = this.state;

    const aim = resolveAim(input.axisX, input.axisY, s.facing, s.grounded);
    s.aim = aim.direction;

    if (input.justPressed(Action.SwitchWeapon)) this.cycleWeapon();

    this.updateFiring(input, aim.angleRad, nowMs);
    this.updateVisuals(dtMs);
  }

  private updateFiring(input: InputSnapshot, angleRad: number, nowMs: number): void {
    const s = this.state;
    const def = WEAPONS[this.weapon.weaponId];

    const shoulderX = this.sprite.x + PLAYER.shoulderX * s.facing;
    const shoulderY = this.sprite.y + PLAYER.shoulderY;
    const muzzleX = shoulderX + Math.cos(angleRad) * PLAYER.muzzleDistance;
    const muzzleY = shoulderY + Math.sin(angleRad) * PLAYER.muzzleDistance;

    const ctx = this.fireContext;
    ctx.x = muzzleX;
    ctx.y = muzzleY;
    ctx.angleRad = angleRad;
    ctx.triggerHeld = input.held(Action.Shoot) && !s.dead && s.hurtMs <= 0;
    ctx.triggerPressed = input.justPressed(Action.Shoot);

    tryFire(this.weapon, def, ctx, nowMs, this.fireOutcome);
    s.firing = this.fireOutcome.fired;

    if (!this.fireOutcome.fired) return;

    this.callbacks.onShots(this.fireOutcome.shots, def.id, muzzleX, muzzleY, angleRad);
    if (this.fireOutcome.shake > 0) this.callbacks.onShake(this.fireOutcome.shake);
    if (this.fireOutcome.recoil > 0) {
      s.vx -= Math.cos(angleRad) * this.fireOutcome.recoil;
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(s.vx);
    }
    this.callbacks.onWeaponChanged(def.id, this.weapon.ammo);
  }

  private updateVisuals(dtMs: number): void {
    const s = this.state;
    this.sprite.setFlipX(s.facing === -1);

    const selection = resolvePlayerAnim(s);
    const anim = this.sprite.anims;
    if (this.animLocked && anim.isPlaying) {
      // Deixa a animação travada terminar antes de qualquer outra coisa.
    } else if (selection.key !== this.currentAnim || !anim.isPlaying) {
      this.currentAnim = selection.key;
      this.animLocked = selection.lock && LOCKED_ANIMS.has(selection.key);
      this.sprite.play(selection.key, true);
    }
    if (this.animLocked && !anim.isPlaying) this.animLocked = false;

    // Pés no ritmo do deslocamento: sem isso o personagem patina.
    anim.timeScale =
      this.currentAnim === 'player.run' ? runAnimTimeScale(s.vx, PLAYER.maxSpeed) : 1;

    /* Braço de mira: sprite separado ancorado no ombro (ART_SPEC §2). */
    this.arm.setPosition(
      this.sprite.x + PLAYER.shoulderX * s.facing,
      this.sprite.y + PLAYER.shoulderY,
    );
    this.arm.setFlipX(s.facing === -1);
    const armKey = armAnimKey(s.aim);
    if (s.firing) {
      this.arm.play(armKey, true);
    } else if (this.arm.anims.currentAnim?.key !== armKey || !this.arm.anims.isPlaying) {
      this.arm.play(armKey, true);
      this.arm.anims.pause(this.arm.anims.currentAnim?.frames[0]);
    }
    this.arm.setVisible(!s.dead);

    /* Piscada de invulnerabilidade — ritmo fixo, legível. */
    if (s.invulnMs > 0) {
      const phase = Math.floor((s.invulnMs / 1000) * PLAYER.invulnBlinkHz) % 2;
      this.sprite.setAlpha(phase === 0 ? 1 : 0.35);
      this.arm.setAlpha(this.sprite.alpha);
    } else if (this.sprite.alpha !== 1) {
      this.sprite.setAlpha(1);
      this.arm.setAlpha(1);
    }

    void dtMs;
  }

  private cycleWeapon(): void {
    const index = WEAPON_ORDER.indexOf(this.weapon.weaponId);
    const next = WEAPON_ORDER[(index + 1) % WEAPON_ORDER.length]!;
    this.weapon = createWeaponState(WEAPONS[next]);
    this.callbacks.onWeaponChanged(next, this.weapon.ammo);
  }

  get weaponState(): Readonly<WeaponState> {
    return this.weapon;
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  destroy(): void {
    this.sprite.destroy();
    this.arm.destroy();
    void this.scene;
  }
}
