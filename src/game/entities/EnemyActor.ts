/**
 * Inimigo genérico. UM Actor serve os três tipos do MVP e os futuros.
 *
 * Ele monta o retrato do mundo, entrega ao brain (puro), e aplica a intenção
 * devolvida. Tudo o que é específico de um inimigo mora em `enemies.data.ts` e
 * na estratégia do brain — adicionar um tipo novo não toca neste arquivo.
 */

import Phaser from 'phaser';
import {
  createBrainContext,
  createBrainOutput,
  type BrainContext,
  type BrainOutput,
  type EnemyBrain,
  type EnemyTypeId,
} from '../../core/enemies/brain';
import { ENEMIES, type EnemyDef } from '../../core/enemies/enemies.data';
import { createBrain } from '../../core/enemies/standard-brain';
import {
  applyDamage,
  createDamageResult,
  createHealth,
  tickHealth,
  type DamageInfo,
  type DamageResult,
  type HealthState,
} from '../../core/combat/health';
import type { Aabb } from '../../core/combat/overlap';
import { resolveEnemyAnim } from '../../core/anim/resolver';
import { PLAYER } from '../../core/config/tuning';
import { DEPTH_ACTORS } from '../fx/FxService';

export interface EnemyWorldProbe {
  /** Há linha de visão entre dois pontos de mundo? */
  canSee(fromX: number, fromY: number, toX: number, toY: number): boolean;
  /** Há parede logo à frente, na direção indicada? */
  isBlocked(x: number, y: number, facing: -1 | 1): boolean;
  /** O chão some logo à frente? */
  isEdge(x: number, y: number, facing: -1 | 1): boolean;
}

export interface EnemyCallbacks {
  onFire(enemy: EnemyActor, angleRad: number): void;
  onDied(enemy: EnemyActor): void;
  onDamaged(enemy: EnemyActor, result: DamageResult): void;
}

/** Gravidade dos inimigos: constante e simples, sem as nuances do player. */
const ENEMY_GRAVITY = 1400;
const MAX_FALL = 480;
/** Distância à frente onde as sondas de parede e beirada leem o mundo. */
const PROBE_AHEAD_PX = 12;

export class EnemyActor {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly def: EnemyDef;
  readonly health: HealthState;
  readonly brain: EnemyBrain;

  private readonly ctx: BrainContext = createBrainContext();
  private readonly out: BrainOutput = createBrainOutput();
  private readonly damageResult = createDamageResult();
  private readonly box: Aabb = { x: 0, y: 0, w: 0, h: 0 };

  private vy = 0;
  private facing: -1 | 1 = 1;
  private currentAnim = '';
  private deathTimerMs = 0;
  private knockbackX = 0;

  constructor(
    scene: Phaser.Scene,
    type: EnemyTypeId,
    x: number,
    y: number,
    facing: -1 | 1,
    private readonly patrolLeft: number,
    private readonly patrolRight: number,
    private readonly probe: EnemyWorldProbe,
    private readonly callbacks: EnemyCallbacks,
  ) {
    this.def = ENEMIES[type];
    this.brain = createBrain(type);
    this.brain.reset(0);
    this.health = createHealth(this.def.maxHealth, 0);
    this.facing = facing;

    this.sprite = scene.physics.add.sprite(x, y, 'enemies', `${type}/idle/0`);
    // Origem nos pés: mesma convenção do player e do spawn da fase.
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(DEPTH_ACTORS);
    this.sprite.setData('enemy', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const frameHeight = this.sprite.height;
    body.setSize(this.def.bodyWidth, this.def.bodyHeight);
    body.setOffset((this.sprite.width - this.def.bodyWidth) / 2, frameHeight - this.def.bodyHeight);
    body.setAllowGravity(false);
    body.setImmovable(!this.def.gravity);
  }

  get alive(): boolean {
    return !this.health.dead;
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** Caixa lógica em coordenadas de mundo, para consultas de explosão. */
  get bounds(): Aabb {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.box.x = body.x;
    this.box.y = body.y;
    this.box.w = body.width;
    this.box.h = body.height;
    return this.box;
  }

  /** Ponto de onde saem os tiros e onde os golpes "acertam". */
  get torsoY(): number {
    return this.sprite.y - this.def.torsoOffsetY;
  }

  step(
    playerX: number,
    playerTorsoY: number,
    playerAlive: boolean,
    nowMs: number,
    dtMs: number,
  ): void {
    tickHealth(this.health, dtMs);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.health.dead) {
      this.stepDeath(body, dtMs);
      return;
    }

    /* ── Retrato do mundo para o brain ── */
    const ctx = this.ctx;
    ctx.selfX = this.sprite.x;
    ctx.selfY = this.sprite.y;
    ctx.facing = this.facing;
    ctx.grounded = body.blocked.down || body.touching.down;
    ctx.health = this.health.current;
    ctx.maxHealth = this.health.max;
    ctx.playerX = playerX;
    ctx.playerY = playerTorsoY;
    ctx.playerAlive = playerAlive;
    ctx.distanceToPlayer = Math.hypot(playerX - this.sprite.x, playerTorsoY - this.torsoY);
    ctx.canSeePlayer =
      playerAlive && this.probe.canSee(this.sprite.x, this.torsoY, playerX, playerTorsoY);
    ctx.blockedAhead = this.probe.isBlocked(this.sprite.x, this.sprite.y, this.facing);
    ctx.edgeAhead = this.def.gravity
      ? this.probe.isEdge(this.sprite.x + PROBE_AHEAD_PX * this.facing, this.sprite.y, this.facing)
      : false;
    ctx.patrolLeft = this.patrolLeft;
    ctx.patrolRight = this.patrolRight;
    ctx.nowMs = nowMs;

    this.brain.update(ctx, dtMs, this.out);
    this.facing = this.out.facing;

    /* ── Aplicação da intenção ── */
    let vx = this.out.moveX * this.def.moveSpeed;
    if (this.knockbackX !== 0) {
      vx += this.knockbackX;
      // Decai rápido: o empurrão é um tempero, não um sistema de movimento.
      this.knockbackX *= 0.82;
      if (Math.abs(this.knockbackX) < 4) this.knockbackX = 0;
    }
    body.setVelocityX(vx);

    if (this.def.gravity) {
      this.vy =
        ctx.grounded && this.vy > 0
          ? 40
          : Math.min(this.vy + (ENEMY_GRAVITY * dtMs) / 1000, MAX_FALL);
      body.setVelocityY(this.vy);
    }

    if (this.out.wantFire) {
      const angle = this.out.aimAngleRad ?? (this.facing === 1 ? 0 : Math.PI);
      this.callbacks.onFire(this, angle);
    }

    this.updateVisuals();
  }

  private stepDeath(body: Phaser.Physics.Arcade.Body, dtMs: number): void {
    body.setVelocityX(0);
    if (this.def.gravity) {
      this.vy = Math.min(this.vy + (ENEMY_GRAVITY * dtMs) / 1000, MAX_FALL);
      body.setVelocityY(this.vy);
    }
    this.deathTimerMs -= dtMs;
    if (this.deathTimerMs <= 0 && this.sprite.active) {
      this.callbacks.onDied(this);
      this.destroy();
    }
  }

  takeDamage(info: DamageInfo, nowMs: number): DamageResult {
    const result = this.damageResult;
    applyDamage(this.health, info, this.sprite.x, this.torsoY, nowMs, result);
    if (result.applied <= 0) return result;

    this.brain.onDamaged(result, nowMs);
    // Resistência ao empurrão é o que impede travar o pesado com metralhadora.
    this.knockbackX += result.knockbackX * (1 - this.def.knockbackResistance);

    if (result.killed) {
      this.deathTimerMs = DEATH_LINGER_MS;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      // Corpo deixa de bloquear o jogador assim que morre.
      body.checkCollision.none = true;
    } else {
      /* Flash branco: confirma o acerto mesmo com o inimigo coberto por FX.
         No Phaser 4 o modo de tint é separado do valor (`setTintFill` saiu). */
      this.sprite.setTint(0xf2f5f8).setTintMode(Phaser.TintModes.FILL);
      this.sprite.scene.time.delayedCall(HIT_FLASH_MS, () => {
        if (this.sprite.active) this.sprite.clearTint();
      });
    }

    this.callbacks.onDamaged(this, result);
    this.updateVisuals();
    return result;
  }

  private updateVisuals(): void {
    this.sprite.setFlipX(this.facing === -1);
    const moving = Math.abs(this.out.moveX) > 0;
    const selection = resolveEnemyAnim(this.def.id, this.brain.state, moving);
    if (selection.key !== this.currentAnim) {
      this.currentAnim = selection.key;
      this.sprite.play(selection.key, true);
    }
  }

  /** Dano de encostar no jogador. Zero para a torreta (ela não persegue). */
  get contactDamage(): number {
    return this.def.contactDamage;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/** Tempo em que o cadáver fica na tela antes de sumir. */
const DEATH_LINGER_MS = 420;
const HIT_FLASH_MS = 60;

/** Ponto de mira do jogador, em coordenadas de mundo. */
export function playerTorsoY(playerFeetY: number): number {
  return playerFeetY - PLAYER.bodyHeight * 0.55;
}
