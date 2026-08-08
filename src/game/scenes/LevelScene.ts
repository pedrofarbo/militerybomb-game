/**
 * Orquestração da fase.
 *
 * Esta Scene é deliberadamente fina: ela conecta sistemas e ordena o frame.
 * Nenhuma regra de jogo mora aqui — se você sentir vontade de escrever um
 * `if` sobre dano, munição ou estado do player neste arquivo, o lugar certo
 * é `src/core`.
 */

import Phaser from 'phaser';
import { WORLD } from '../../core/config/tuning';
import { parseLevel } from '../../core/level/parse';
import { LEVEL_01 } from '../../core/level/levels/level-01';
import type { LevelDef } from '../../core/level/schema';
import { createRng } from '../../core/math';
import type { GameEventBus } from '../../core/events/bus';
import type { ShotRequest, WeaponId } from '../../core/weapons/weapon-def';
import { WEAPONS } from '../../core/weapons/weapons.data';
import { SPRITES } from '../../assets/manifest';
import { PlayerActor } from '../entities/PlayerActor';
import { Projectile } from '../entities/Projectile';
import { Pool } from '../systems/Pool';
import { FxService } from '../fx/FxService';
import { CameraDirector } from '../camera/CameraDirector';
import { buildLevel, updateParallax, type BuiltLevel } from '../level/LevelBuilder';
import type { InputManager } from '../input/InputManager';
import type { DebugService } from '../debug/DebugService';
import type { QualityLevel } from '../../core/config/tuning';

export interface LevelSceneDeps {
  input: InputManager;
  bus: GameEventBus;
  debug: DebugService;
}

/** Chave no registry do jogo. Evita singleton global e evita passar deps por
 *  todas as cenas intermediárias. */
export const LEVEL_DEPS_KEY = 'redline.deps';

const FIXED_STEP_MS = 1000 / WORLD.fixedFps;
/** Teto de passos por frame: sem isto, um travamento vira espiral de morte. */
const MAX_STEPS_PER_FRAME = 5;
const PROJECTILE_POOL_SIZE = 64;

export class LevelScene extends Phaser.Scene {
  private deps!: LevelSceneDeps;
  private def!: LevelDef;
  private built!: BuiltLevel;
  private player!: PlayerActor;
  private projectiles!: Pool<Projectile>;
  private projectileGroup!: Phaser.GameObjects.Group;
  private fx!: FxService;
  private director!: CameraDirector;
  private readonly activeProjectiles: Projectile[] = [];
  private accumulatorMs = 0;
  private quality: QualityLevel = 'high';
  private random = createRng(0x5eed);

  constructor() {
    super('level');
  }

  init(): void {
    const deps = this.registry.get(LEVEL_DEPS_KEY) as LevelSceneDeps | undefined;
    if (!deps) throw new Error(`Dependências ausentes no registry ("${LEVEL_DEPS_KEY}")`);
    this.deps = deps;
  }

  create(): void {
    this.def = parseLevel(LEVEL_01);
    this.built = buildLevel(this, this.def);

    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 256);
    this.fx = new FxService(this);

    this.player = new PlayerActor(
      this,
      this.def.spawn.x,
      this.def.spawn.y,
      {
        onShots: (shots, weaponId, mx, my, angle) =>
          this.spawnShots(shots, weaponId, mx, my, angle),
        onJump: (x, y) => {
          this.deps.bus.emit('player:jumped', { x, y });
        },
        onLand: (x, y, fallSpeed) => {
          // Poeira só na aterrissagem que "pesa": senão vira ruído visual.
          if (fallSpeed > 260) this.fx.play('fx.dust.land', x, y - 4);
          this.deps.bus.emit('player:landed', { x, y, fallSpeed });
        },
        onWeaponChanged: (weaponId, ammo) => {
          this.deps.bus.emit('weapon:changed', { weaponId, ammo });
        },
        onShake: (trauma) => this.director.shake(trauma),
      },
      this.random,
    );

    this.physics.add.collider(this.player.sprite, this.built.layer);

    /* UM collider para todos os projéteis, registrado uma vez. Registrar um
       collider por tiro (o caminho ingênuo) vaza um handler a cada disparo e
       degrada o frame progressivamente durante o combate. */
    this.projectileGroup = this.add.group();
    this.projectiles = new Pool<Projectile>(() => {
      const projectile = new Projectile(this);
      this.projectileGroup.add(projectile);
      return projectile;
    }, PROJECTILE_POOL_SIZE);

    this.physics.add.collider(this.projectileGroup, this.built.layer, (obj) => {
      const projectile = obj as Projectile;
      const def = WEAPONS[projectile.weaponId];
      this.fx.play(def.fx.impact, projectile.x, projectile.y);
      this.retire(projectile);
    });

    this.director = new CameraDirector(this.cameras.main, this.def.spawn.x, this.def.spawn.y);
    this.director.setBounds(this.built.widthPx, this.built.heightPx);
    this.director.snapTo(this.def.spawn.x, this.def.spawn.y - 40);
    this.cameras.main.setBackgroundColor(0x0d0b12);

    // Apresentação e câmera rodam DEPOIS da física, senão ficam um frame atrás
    // da posição real e a imagem treme.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    });

    this.registerDebugPanels();
    this.deps.bus.emit('player:spawned', { x: this.def.spawn.x, y: this.def.spawn.y });
    this.deps.bus.emit('weapon:changed', { weaponId: 'pistol', ammo: 'infinite' });
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.fx.setQuality(level);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.deps.input.update(this.time.now, dt);

    /* Passo fixo para a simulação: o mesmo input produz o mesmo resultado em
       60 Hz, 120 Hz ou num celular engasgando — condição para replays. */
    this.accumulatorMs = Math.min(this.accumulatorMs + dt, FIXED_STEP_MS * MAX_STEPS_PER_FRAME);
    let steps = 0;
    while (this.accumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.player.preStep(this.deps.input.snapshot, FIXED_STEP_MS);
      this.accumulatorMs -= FIXED_STEP_MS;
      steps++;
    }
    if (steps === 0) this.player.preStep(this.deps.input.snapshot, dt);

    this.tickProjectiles(dt);
    this.checkOutOfBounds();
  }

  private postUpdate(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.player.postStep(this.deps.input.snapshot, this.time.now, dt);
    this.director.update(
      this.player.x,
      this.player.y - 24,
      this.player.state.vx,
      this.player.state.facing,
      dt,
    );
    updateParallax(this.built.parallax, this.cameras.main, this.quality !== 'low');
    this.deps.debug.update(dt);
  }

  private spawnShots(
    shots: readonly ShotRequest[],
    weaponId: WeaponId,
    muzzleX: number,
    muzzleY: number,
    angleRad: number,
  ): void {
    const def = WEAPONS[weaponId];
    const art = SPRITES[def.fx.projectile as keyof typeof SPRITES];

    for (const shot of shots) {
      const projectile = this.projectiles.acquire();
      if (!projectile) break;
      projectile.fire(shot, art);
      this.activeProjectiles.push(projectile);
    }

    this.fx.muzzle(def.fx.muzzle, muzzleX, muzzleY, angleRad);
    this.deps.bus.emit('player:fired', { x: muzzleX, y: muzzleY, angleRad, weaponId });
  }

  private tickProjectiles(dtMs: number): void {
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i]!;
      if (p.tick(dtMs) || !p.active) this.retire(p, i);
    }
  }

  private retire(projectile: Projectile, index = this.activeProjectiles.indexOf(projectile)): void {
    if (index >= 0) this.activeProjectiles.splice(index, 1);
    projectile.deactivate();
    this.projectiles.release(projectile);
  }

  private checkOutOfBounds(): void {
    if (this.player.y < this.built.heightPx + 96) return;
    this.player.respawn();
    this.director.snapTo(this.def.spawn.x, this.def.spawn.y - 40);
    this.deps.bus.emit('player:died', { atCheckpointId: null });
    this.deps.bus.emit('player:spawned', { x: this.def.spawn.x, y: this.def.spawn.y });
  }

  private registerDebugPanels(): void {
    const { debug } = this.deps;
    debug.register('fps', () => {
      const fps = this.game.loop.actualFps;
      return `${fps.toFixed(0)} fps  ·  ${this.game.loop.delta.toFixed(1)} ms`;
    });
    debug.register('player', () => {
      const s = this.player.state;
      return [
        `pos    ${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)}`,
        `vel    ${s.vx.toFixed(0)}, ${s.vy.toFixed(0)}`,
        `state  ${s.locomotion}  aim:${s.aim}  face:${s.facing}`,
        `ground ${s.grounded ? 'sim' : 'não'}  coyote:${s.coyoteMs.toFixed(0)}  buffer:${s.jumpBufferMs.toFixed(0)}`,
        `arma   ${this.player.weaponState.weaponId}  munição:${this.player.weaponState.ammo}`,
      ].join('\n');
    });
    debug.register('cena', () => {
      const cam = this.director.debugState;
      return [
        `câmera  ${cam.x.toFixed(0)}, ${cam.y.toFixed(0)}  trauma:${cam.trauma.toFixed(2)}`,
        `pools   projéteis ${this.projectiles.activeCount}/${this.projectiles.size}  fx ${this.fx.activeCount}`,
        `viewport ${this.scale.gameSize.width}×${this.scale.gameSize.height}  qualidade:${this.quality}`,
      ].join('\n');
    });
  }
}
