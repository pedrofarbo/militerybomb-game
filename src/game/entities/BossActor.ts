/**
 * O Estivador em Phaser: três sprites, um cérebro.
 *
 * Base (192×160), garra (80×80) e núcleo (32×32) são objetos separados porque
 * a garra gira e o núcleo pisca independentes do corpo — e porque o núcleo
 * precisa da PRÓPRIA hurtbox. É essa segunda hurtbox que dá sentido à luta:
 * acertar a carcaça quase não faz nada, acertar o núcleo aberto faz tudo.
 *
 * Como todo Actor deste projeto, aqui não se decide nada. O que atacar, quando
 * abrir o núcleo e quanto tempo dura cada fase moram em `core/boss/estivador.ts`.
 */

import Phaser from 'phaser';
import {
  BossState,
  createBossContext,
  createBossOutput,
  ESTIVADOR,
  EstivadorBrain,
  type BossContext,
  type BossOutput,
} from '../../core/boss/estivador';
import {
  applyDamage,
  createDamageResult,
  createHealth,
  type DamageInfo,
  type DamageResult,
  type HealthState,
} from '../../core/combat/health';
import type { Aabb } from '../../core/combat/overlap';
import { ART_METRICS } from '../../assets/manifest';
import { DEPTH_ACTORS } from '../fx/FxService';

export interface BossCallbacks {
  onFire(boss: BossActor, angleRad: number, speed: number, damage: number): void;
  /** Golpe da garra no chão: dano em área, resolvido pela cena. */
  onSlam(x: number, y: number, radius: number, damage: number): void;
  onShake(trauma: number): void;
  onHealthChanged(current: number, max: number, phase: 1 | 2): void;
  onPhaseChanged(phase: 1 | 2): void;
  onDied(boss: BossActor): void;
  playFx(key: string, x: number, y: number): void;
}

const M = ART_METRICS.boss;
/** Hurtbox da carcaça, dentro do frame de 192×160. */
const BODY = { w: 132, h: 116 };
/** Hurtbox do núcleo. Pequena de propósito: acertar é uma decisão, não sorte. */
const CORE_BODY = 22;
/** Meia-altura/largura para o teste de acerto no núcleo. Ver `coreContains`. */
const CORE_HIT_RADIUS = 16;
const HIT_FLASH_MS = 60;
/**
 * Onde as explosões da morte estouram, em fração do corpo (x: -1..1 da
 * meia-largura, y: 0..-1 da altura). Espalhadas de propósito para o corpo
 * inteiro ir embora aos poucos, e não o mesmo canto oito vezes.
 */
const DEATH_FX_SPOTS: readonly (readonly [number, number])[] = [
  [0.1, -0.55],
  [-0.6, -0.2],
  [0.62, -0.72],
  [-0.24, -0.86],
  [0.44, -0.12],
  [-0.72, -0.62],
  [0.24, -0.34],
  [-0.05, -0.7],
  [0.7, -0.44],
  [-0.45, -0.05],
];

export class BossActor {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly core: Phaser.Physics.Arcade.Sprite;
  readonly claw: Phaser.GameObjects.Sprite;
  readonly health: HealthState;
  readonly brain = new EstivadorBrain();

  private readonly ctx: BossContext = createBossContext();
  private readonly out: BossOutput = createBossOutput();
  private readonly damageResult = createDamageResult();
  private readonly box: Aabb = { x: 0, y: 0, w: 0, h: 0 };

  private arenaLeft = 0;
  private arenaRight = 0;
  private currentAnim = '';
  private currentCoreAnim = '';
  private lastPhase: 1 | 2 = 1;
  private deathTimerMs = 0;
  private deathFxTimerMs = 0;
  private deathFxIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly callbacks: BossCallbacks,
  ) {
    this.health = createHealth(ESTIVADOR.maxHealth, 0);
    this.brain.reset();

    this.sprite = scene.physics.add.sprite(x, y, 'boss', 'estivador/base/idle/0');
    // Origem na LINHA DO CHÃO do frame (156/160), igual à convenção dos pés.
    this.sprite.setOrigin(0.5, M.groundY / M.base.h);
    this.sprite.setDepth(DEPTH_ACTORS - 1);
    this.sprite.setData('boss', this);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(BODY.w, BODY.h);
    body.setOffset((M.base.w - BODY.w) / 2, M.groundY - BODY.h);
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.claw = scene.add.sprite(x, y, 'boss', 'estivador/claw/idle/0');
    this.claw.setOrigin(M.armPivot.x / M.claw.w, M.armPivot.y / M.claw.h);
    this.claw.setDepth(DEPTH_ACTORS);

    this.core = scene.physics.add.sprite(x, y, 'boss', 'estivador/core/idle/0');
    this.core.setOrigin(0.5, 0.5);
    this.core.setDepth(DEPTH_ACTORS + 1);
    this.core.setData('bossCore', this);
    const coreBody = this.core.body as Phaser.Physics.Arcade.Body;
    coreBody.setSize(CORE_BODY, CORE_BODY);
    coreBody.setOffset((M.core.w - CORE_BODY) / 2, (M.core.h - CORE_BODY) / 2);
    coreBody.setAllowGravity(false);
    coreBody.setImmovable(true);

    this.sprite.play('boss.base.idle', true);
    this.claw.play('boss.claw.idle', true);
    this.core.play('boss.core.idle', true);
    this.layout();
  }

  setArena(left: number, right: number): void {
    this.arenaLeft = left;
    this.arenaRight = right;
  }

  wake(): void {
    this.brain.wake();
  }

  get awake(): boolean {
    return this.brain.state !== BossState.Dormant;
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

  /** Ponto de onde saem os tiros — a cabine, não a base. */
  get muzzleY(): number {
    return this.sprite.y - 96;
  }

  get contactDamage(): number {
    return this.out.contactDamage;
  }

  get phase(): 1 | 2 {
    return this.brain.phase;
  }

  get healthFraction(): number {
    return this.health.max > 0 ? this.health.current / this.health.max : 0;
  }

  /**
   * O ponto está dentro do núcleo?
   *
   * A cena pergunta isto em vez de confiar em qual corpo o Arcade entregou:
   * o núcleo mora dentro da hurtbox da carcaça, e a ordem do grupo decidiria
   * qual dos dois "ganha" o acerto. Uma margem generosa porque o núcleo tem
   * 22 px e o projétil, um pixel — mirar já é a decisão difícil.
   */
  coreContains(x: number, y: number): boolean {
    if (!this.brain.vulnerable) return false;
    return (
      Math.abs(x - this.core.x) <= CORE_HIT_RADIUS && Math.abs(y - this.core.y) <= CORE_HIT_RADIUS
    );
  }

  get bounds(): Aabb {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.box.x = body.x;
    this.box.y = body.y;
    this.box.w = body.width;
    this.box.h = body.height;
    return this.box;
  }

  /** Passo de simulação. Ver `LevelScene.simulate`. */
  step(
    playerX: number,
    playerTorsoY: number,
    playerAlive: boolean,
    nowMs: number,
    dtMs: number,
  ): void {
    if (this.health.dead) {
      this.stepDeath(dtMs);
      return;
    }

    const ctx = this.ctx;
    ctx.selfX = this.sprite.x;
    ctx.selfY = this.sprite.y;
    ctx.facing = this.out.facing;
    ctx.health = this.health.current;
    ctx.maxHealth = this.health.max;
    ctx.playerX = playerX;
    ctx.playerY = playerTorsoY;
    ctx.playerAlive = playerAlive;
    ctx.arenaLeft = this.arenaLeft;
    ctx.arenaRight = this.arenaRight;
    ctx.nowMs = nowMs;

    this.brain.update(ctx, dtMs, this.out);
    const out = this.out;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(out.moveX * out.moveSpeed);

    for (const shot of out.shots) {
      this.callbacks.onFire(this, shot.angleRad, shot.speed, shot.damage);
    }
    if (out.slamAt !== null) {
      this.callbacks.onSlam(
        out.slamAt,
        this.sprite.y,
        ESTIVADOR.claw.radiusPx,
        ESTIVADOR.claw.damage,
      );
      this.callbacks.playFx('fx.explosion.medium', out.slamAt, this.sprite.y - 16);
    }
    if (out.shake > 0) this.callbacks.onShake(out.shake);

    if (out.phase !== this.lastPhase) {
      this.lastPhase = out.phase;
      this.callbacks.onPhaseChanged(out.phase);
      this.callbacks.playFx('fx.explosion.medium', this.sprite.x, this.sprite.y - 90);
    }

    this.updateVisuals(out);
  }

  private stepDeath(dtMs: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.deathTimerMs -= dtMs;

    /* Morte espetacular: explosões em cascata pelo corpo enquanto a animação
       roda. Um boss que apenas some não fecha a luta — a recompensa por 30 s
       de atenção é justamente esta demora. */
    this.deathFxTimerMs -= dtMs;
    if (this.deathFxTimerMs <= 0 && this.deathTimerMs > 0) {
      this.deathFxTimerMs = 130;
      /* Posições de uma tabela fixa, não de `Math.random`: a simulação inteira
         deste projeto é determinística, e uma morte de boss que sai diferente
         a cada execução é a única coisa impossível de conferir num teste. */
      const spot = DEATH_FX_SPOTS[this.deathFxIndex++ % DEATH_FX_SPOTS.length]!;
      this.callbacks.playFx(
        'fx.explosion.small',
        this.sprite.x + spot[0] * (M.base.w / 2),
        this.sprite.y + spot[1] * 120,
      );
      this.callbacks.onShake(0.14);
    }

    if (this.deathTimerMs <= 0 && this.sprite.active) {
      this.callbacks.playFx('fx.explosion.large', this.sprite.x, this.sprite.y - 60);
      this.callbacks.onShake(0.8);
      this.callbacks.onDied(this);
    }
    this.layout();
  }

  /**
   * Dano. `onCore` é a diferença entre coçar a blindagem e derrubar o boss.
   *
   * A redução acontece AQUI e não em `applyDamage` porque é uma regra deste
   * inimigo, não do sistema de vida — e porque o número precisa ficar ao lado
   * da explicação de por que ele existe.
   */
  takeDamage(info: DamageInfo, nowMs: number, onCore: boolean): DamageResult {
    const result = this.damageResult;
    if (this.health.dead || this.brain.invulnerable) {
      result.applied = 0;
      result.killed = false;
      result.rejected = this.health.dead ? 'already-dead' : 'invulnerable';
      return result;
    }

    /* A JANELA é o ponto fraco, não um pixel.
       Com o respiro aberto o dano entra inteiro em qualquer parte do corpo, e
       acertar o núcleo dobra. A versão anterior exigia acertar o núcleo para
       causar dano de verdade, e como o núcleo fica a 72 px do chão só dava
       para acertá-lo de cima de uma plataforma específica — quem não
       descobrisse isso simplesmente não conseguia vencer. */
    const effective = !this.brain.vulnerable
      ? ESTIVADOR.armorMultiplier
      : onCore
        ? ESTIVADOR.coreMultiplier
        : 1;
    /* Mínimo de 1: a blindagem tem de DAR RETORNO, mesmo que pouco. Arredondar
       para zero faria o jogador achar que o tiro não registrou — e "não
       registrou" é a leitura errada de "este não é o ponto fraco". */
    const original = info.amount;
    info.amount = Math.max(1, Math.round(original * effective));
    applyDamage(this.health, info, this.sprite.x, this.sprite.y - 80, nowMs, result);
    info.amount = original;

    if (result.applied <= 0) return result;

    if (result.killed) {
      this.brain.kill();
      this.deathTimerMs = ESTIVADOR.deathMs;
      this.deathFxTimerMs = 0;
      this.deathFxIndex = 0;
      (this.sprite.body as Phaser.Physics.Arcade.Body).checkCollision.none = true;
      (this.core.body as Phaser.Physics.Arcade.Body).checkCollision.none = true;
      this.core.setVisible(false);
      this.claw.setVisible(false);
      this.playBase('boss.base.death');
    } else if (onCore && this.brain.vulnerable) {
      this.core.setTint(0xfff3c4).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(HIT_FLASH_MS, () => {
        if (this.core.active) this.core.clearTint();
      });
    }

    this.callbacks.onHealthChanged(this.health.current, this.health.max, this.brain.phase);
    return result;
  }

  /** Roda uma vez por frame, depois da física. */
  render(): void {
    this.layout();
  }

  private updateVisuals(out: BossOutput): void {
    this.sprite.setFlipX(out.facing === 1);

    if (out.state === BossState.PhaseShift) this.playBase('boss.base.phase');
    else if (out.phase === 2) this.playBase('boss.base.idle2');
    else this.playBase('boss.base.idle');

    if (out.clawSwing) this.claw.play('boss.claw.swing', true);
    else if (!this.claw.anims.isPlaying) this.claw.play('boss.claw.idle', true);

    const coreAnim = out.coreExposed ? 'boss.core.exposed' : 'boss.core.idle';
    if (coreAnim !== this.currentCoreAnim) {
      this.currentCoreAnim = coreAnim;
      this.core.play(coreAnim, true);
    }
    // O núcleo fechado não é alvo: sem isto o jogador acertaria a abertura
    // fechada e não entenderia por que às vezes funciona.
    (this.core.body as Phaser.Physics.Arcade.Body).checkCollision.none = !out.coreExposed;
  }

  private playBase(key: string): void {
    if (key === this.currentAnim) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  /** Garra e núcleo acompanham a base. Só posição — nenhuma decisão. */
  private layout(): void {
    const flip = this.sprite.flipX ? -1 : 1;
    const originY = M.groundY;

    this.claw.setPosition(
      this.sprite.x + (M.armPivot.x - M.base.w / 2) * flip,
      this.sprite.y - (originY - M.armPivot.y),
    );
    this.claw.setFlipX(this.sprite.flipX);

    this.core.setPosition(
      this.sprite.x + (M.coreOffset.x - M.base.w / 2) * flip,
      this.sprite.y - (originY - M.coreOffset.y),
    );
  }

  destroy(): void {
    this.sprite.destroy();
    this.core.destroy();
    this.claw.destroy();
  }
}
