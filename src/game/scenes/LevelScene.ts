/**
 * Orquestração da fase.
 *
 * Esta Scene é deliberadamente fina: ela conecta sistemas e ordena o frame.
 * Nenhuma regra de jogo mora aqui — se você sentir vontade de escrever um
 * `if` sobre dano, munição ou estado do player neste arquivo, o lugar certo
 * é `src/core`.
 */

import Phaser from 'phaser';
import { PLAYER, WORLD, type QualityLevel } from '../../core/config/tuning';
import { findBoss, findExit, ONE_WAY_TILES, parseLevel } from '../../core/level/parse';
import { LEVEL_01 } from '../../core/level/levels/level-01';
import {
  DESTRUCTIBLE_ENTITY_TYPES,
  ENEMY_ENTITY_TYPES,
  type LevelDef,
  type LevelEntity,
  type PickupVariant,
} from '../../core/level/schema';
import {
  addScore,
  createScoreResult,
  elapsedMs,
  loseLife,
  resetRun,
  type RunState,
} from '../../core/progression/run-state';
import { captureCheckpoint } from '../../core/progression/checkpoint';
import { BossState } from '../../core/boss/estivador';
import { createRng } from '../../core/math';
import { Action } from '../../core/input/actions';
import type { GameEventBus, Unsubscribe } from '../../core/events/bus';
import type { ShotRequest, WeaponId } from '../../core/weapons/weapon-def';
import { WEAPONS } from '../../core/weapons/weapons.data';
import { hasLineOfSight } from '../../core/combat/overlap';
import type { DamageInfo } from '../../core/combat/health';
import { EXPLOSIONS, type DestructibleTypeId } from '../../core/combat/explosives';
import type { EnemyTypeId } from '../../core/enemies/brain';
import { SPRITES } from '../../assets/manifest';
import { PlayerActor } from '../entities/PlayerActor';
import { EnemyActor, type EnemyWorldProbe } from '../entities/EnemyActor';
import { Destructible } from '../entities/Destructible';
import { BossActor } from '../entities/BossActor';
import { Pickup } from '../entities/Pickup';
import { GrenadeActor } from '../entities/GrenadeActor';
import { Projectile } from '../entities/Projectile';
import { Pool } from '../systems/Pool';
import { CombatSystem } from '../systems/CombatSystem';
import { registerCollisions } from '../systems/CollisionMatrix';
import { DEPTH_ACTORS, FxService } from '../fx/FxService';
import { CameraDirector } from '../camera/CameraDirector';
import { buildLevel, updateParallax, type BuiltLevel } from '../level/LevelBuilder';
import type { InputManager } from '../input/InputManager';
import type { DebugService } from '../debug/DebugService';

export interface LevelSceneDeps {
  input: InputManager;
  bus: GameEventBus;
  debug: DebugService;
  /**
   * A TENTATIVA — vidas e pontos. Vive FORA da cena de propósito: reiniciar a
   * fase destrói e recria tudo o que é da cena, e é justamente isso que não
   * pode acontecer com o placar entre uma vida e outra.
   */
  run: RunState;
  /**
   * Coluna de entrada alternativa, em tiles (`?spawn=120`).
   *
   * Ferramenta de desenvolvimento: ajustar o fim da fase sem rejogar 2000 px
   * de mapa antes de cada tentativa. Só vale em colunas sobre o chão principal
   * — a altura continua sendo a do spawn declarado na fase.
   */
  spawnTileX?: number;
}

/** Chave no registry do jogo. Evita singleton global e evita passar deps por
 *  todas as cenas intermediárias. */
export const LEVEL_DEPS_KEY = 'redline.deps';

const FIXED_STEP_MS = 1000 / WORLD.fixedFps;
/** Teto de passos por frame: sem isto, um travamento vira espiral de morte. */
const MAX_STEPS_PER_FRAME = 5;
/** Delta máximo aceito de um frame (abas em segundo plano devolvem valores enormes). */
const MAX_FRAME_MS = 100;
const PLAYER_SHOT_POOL = 64;
const ENEMY_SHOT_POOL = 64;
const GRENADE_POOL = 8;
/** A câmera mira o tronco do player, não os pés. */
const CAMERA_TARGET_OFFSET_Y = 24;
/** Inimigos além desta distância da câmera não pensam. */
const AI_ACTIVE_MARGIN_PX = 160;
/** Meia-largura e altura da zona de gatilho da saída, em px. */
const EXIT_TRIGGER_HALF_WIDTH = 22;
const EXIT_TRIGGER_HEIGHT = 96;
/** Espera antes de aceitar "recomeçar" — impede reiniciar por um tiro perdido. */
const OUTCOME_INPUT_LOCK_MS = 700;
/** O portão fica atrás dos atores: o jogador entra NELE, não passa na frente. */
const DEPTH_EXIT = DEPTH_ACTORS - 2;
/** Raio para tocar um checkpoint. Generoso: passar reto por ele é frustrante. */
const CHECKPOINT_RADIUS = 26;
const BOSS_SCORE = 2500;
/**
 * O ARADO do boss: a parte que machuca no contato.
 *
 * BAIXO — 40 px é menos que os 48 px das plataformas da arena, e é dessa
 * diferença que nasce o desvio da investida.
 *
 * E ESTREITO — 58 px de meia-largura contra os 66 px da carcaça. A primeira
 * versão usava 76, mais largo que o próprio boss: o jogador levava dano de
 * contato sem nunca encostar nele, o que na tela parece dano do nada.
 */
const BOSS_PLOW = { halfWidth: 58, height: 40 } as const;

/**
 * Em que ponto da fase estamos.
 *
 * Existe porque "morto" e "acabou" não são o mesmo estado, e tratar os dois
 * com um booleano foi como a fase conseguia terminar caindo no vazio: sem um
 * estado de fim, o único fim possível era a morte.
 */
type LevelPhase = 'playing' | 'dying' | 'complete' | 'game-over' | 'restarting';

/** Mastro de checkpoint já instanciado. */
interface CheckpointMarker {
  id: string;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
}

export class LevelScene extends Phaser.Scene {
  private deps!: LevelSceneDeps;
  private def!: LevelDef;
  private built!: BuiltLevel;
  private player!: PlayerActor;
  private combat!: CombatSystem;
  private fx!: FxService;
  private director!: CameraDirector;

  private playerShots!: Pool<Projectile>;
  private enemyShots!: Pool<Projectile>;
  private grenades!: Pool<GrenadeActor>;
  private playerShotGroup!: Phaser.GameObjects.Group;
  private enemyShotGroup!: Phaser.GameObjects.Group;
  private grenadeGroup!: Phaser.GameObjects.Group;
  private enemyGroup!: Phaser.GameObjects.Group;
  private destructibleGroup!: Phaser.GameObjects.Group;
  private bossPartGroup!: Phaser.GameObjects.Group;

  private readonly enemies: EnemyActor[] = [];
  private readonly destructibles: Destructible[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly checkpoints: CheckpointMarker[] = [];
  private readonly activeShots: Projectile[] = [];
  private readonly activeGrenades: GrenadeActor[] = [];
  private readonly subscriptions: Unsubscribe[] = [];
  private readonly scoreResult = createScoreResult();
  private readonly enemyDamage: DamageInfo = {
    amount: 0,
    kind: 'bullet',
    sourceId: -1,
    originX: 0,
    originY: 0,
    knockback: 0,
  };

  private accumulatorMs = 0;
  private simulationPaused = false;
  private quality: QualityLevel = 'high';
  private phase: LevelPhase = 'playing';
  private deathTimerMs = 0;
  private outcomeLockMs = 0;
  private exit!: LevelEntity;
  private spawn!: { x: number; y: number };
  private boss: BossActor | null = null;
  private arena: LevelEntity | null = null;
  private arenaLocked = false;
  private bossDefeated = false;
  private exitGate: Phaser.GameObjects.Sprite | null = null;
  private arenaGate: Phaser.GameObjects.Sprite | null = null;
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
    /* `scene.restart()` roda `init` + `create` NA MESMA INSTÂNCIA — o
       construtor não roda de novo. Tudo o que é campo de instância precisa
       voltar ao valor inicial aqui, à mão; esquecer um deles é como o jogo
       começaria com os inimigos da vida anterior em lista mas destruídos. */
    this.resetSceneState();

    this.def = parseLevel(LEVEL_01);
    this.exit = findExit(this.def);
    this.spawn = this.resolveSpawn();
    this.built = buildLevel(this, this.def);
    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 256);
    /* Paredes invisíveis SÓ nas laterais. Em cima e embaixo o limite continua
       aberto: é a queda para fora do mundo que mata quem erra um vão, e o teto
       fechado prenderia o pulo do alto da torre. */
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setBackgroundColor(0x0d0b12);

    this.fx = new FxService(this);
    this.createPools();
    this.createPlayer();
    this.createLevelEntities();

    this.combat = new CombatSystem(
      { enemies: this.enemies, destructibles: this.destructibles },
      {
        onEnemyKilled: (enemy) => this.rewardKill(enemy),
        onShake: (trauma) => this.director.shake(trauma),
        playFx: (key, x, y) => this.fx.play(key, x, y),
      },
    );

    this.wireCollisions();

    this.director = new CameraDirector(this.cameras.main, this.spawn.x, this.spawn.y);
    this.director.setBounds(this.built.widthPx, this.built.heightPx);
    this.director.snapTo(this.spawn.x, this.spawn.y - 40);

    // Apresentação e câmera rodam DEPOIS da física, senão ficam um frame atrás
    // da posição real e a imagem treme.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
      for (const off of this.subscriptions) off();
      this.subscriptions.length = 0;
    });

    /* A UI pede o recomeço; a fase decide o que isso significa. Desinscrever no
       SHUTDOWN não é zelo: sem isso cada morte deixaria mais um handler vivo, e
       depois de três vidas um clique reiniciaria a cena três vezes. */
    this.subscriptions.push(
      this.deps.bus.on('run:restartRequested', () => this.handleRestartRequest()),
    );

    // O equipamento guardado no checkpoint volta junto com a posição.
    const checkpoint = this.deps.run.checkpoint;
    if (checkpoint && this.deps.spawnTileX === undefined) {
      this.player.applyLoadout(checkpoint.loadout);
    }

    this.registerDebugPanels();
    this.announceInitialState();
  }

  /* ─────────────────────────── Construção ─────────────────────────── */

  private resetSceneState(): void {
    this.enemies.length = 0;
    this.destructibles.length = 0;
    this.pickups.length = 0;
    this.checkpoints.length = 0;
    this.boss = null;
    this.arena = null;
    this.arenaLocked = false;
    this.bossDefeated = false;
    this.exitGate = null;
    this.arenaGate = null;
    this.activeShots.length = 0;
    this.activeGrenades.length = 0;
    this.accumulatorMs = 0;
    this.deathTimerMs = 0;
    this.outcomeLockMs = 0;
    this.phase = 'playing';
    // Semente fixa: a mesma tentativa vista duas vezes se comporta igual.
    this.random = createRng(0x5eed);
  }

  private createPools(): void {
    this.playerShotGroup = this.add.group();
    this.playerShots = new Pool<Projectile>(() => {
      const p = new Projectile(this, 'player');
      this.playerShotGroup.add(p);
      return p;
    }, PLAYER_SHOT_POOL);

    this.enemyShotGroup = this.add.group();
    this.enemyShots = new Pool<Projectile>(() => {
      const p = new Projectile(this, 'enemy');
      this.enemyShotGroup.add(p);
      return p;
    }, ENEMY_SHOT_POOL);

    this.grenadeGroup = this.add.group();
    this.grenades = new Pool<GrenadeActor>(() => {
      const g = new GrenadeActor(this);
      this.grenadeGroup.add(g.sprite);
      return g;
    }, GRENADE_POOL);

    this.enemyGroup = this.add.group();
    this.destructibleGroup = this.add.group();
    this.bossPartGroup = this.add.group();
  }

  /**
   * Onde a fase começa DESTA vez.
   *
   * Prioridade: override de desenvolvimento → checkpoint da tentativa → início
   * da fase. O checkpoint vem antes do início porque é exatamente para isso que
   * ele existe: recarregar a fase inteira e ainda assim não perder a caminhada.
   */
  private resolveSpawn(): { x: number; y: number } {
    const tileX = this.deps.spawnTileX;
    if (tileX !== undefined && tileX >= 0 && tileX < this.def.width) {
      return { x: tileX * this.def.tileWidth + this.def.tileWidth / 2, y: this.def.spawn.y };
    }

    const checkpoint = this.deps.run.checkpoint;
    if (checkpoint) return { x: checkpoint.spawnX, y: checkpoint.spawnY };

    return this.def.spawn;
  }

  private createPlayer(): void {
    this.player = new PlayerActor(
      this,
      this.spawn.x,
      this.spawn.y,
      {
        onShots: (shots, weaponId, mx, my, angle) =>
          this.spawnPlayerShots(shots, weaponId, mx, my, angle),
        onJump: (x, y) => this.deps.bus.emit('player:jumped', { x, y }),
        onLand: (x, y, fallSpeed) => {
          if (fallSpeed > 260) this.fx.play('fx.dust.land', x, y - 4);
          if (fallSpeed > PLAYER.hardLandingSpeed) this.director.shake(PLAYER.hardLandingShake);
          this.deps.bus.emit('player:landed', { x, y, fallSpeed });
        },
        onWeaponChanged: (weaponId, ammo) =>
          this.deps.bus.emit('weapon:changed', { weaponId, ammo }),
        onShake: (trauma) => this.director.shake(trauma),
        onGrenadeThrown: (x, y, angle, facing) => this.throwGrenade(x, y, angle, facing),
        onGrenadesChanged: (count) => this.deps.bus.emit('grenades:changed', { count }),
        onHealthChanged: (hp, max) => this.deps.bus.emit('player:damaged', { hp, max }),
        onDied: () => this.onPlayerDied(),
        isOnOneWayPlatform: (x, y) => this.isOnOneWayPlatform(x, y),
      },
      this.random,
    );
  }

  private createLevelEntities(): void {
    const probe: EnemyWorldProbe = {
      canSee: (fx, fy, tx, ty) =>
        hasLineOfSight(fx, fy, tx, ty, this.def.tileWidth, (tileX, tileY) =>
          this.isSolidTile(tileX, tileY),
        ),
      isBlocked: (x, y, facing) =>
        this.isSolidAtWorld(x + 14 * facing, y - PLAYER.bodyHeight * 0.4),
      // Sonda o chão logo à frente: sem ela o inimigo patrulha para dentro do vão.
      isEdge: (x, y) => !this.isSolidAtWorld(x, y + 6),
    };

    for (const entity of this.def.entities) {
      if (entity.type === 'exit') {
        this.createExitMarker(entity);
        continue;
      }
      if (entity.type === 'checkpoint') {
        this.createCheckpointMarker(entity);
        continue;
      }
      if (entity.type === 'pickup') {
        this.pickups.push(new Pickup(this, entity.variant!, entity.x, entity.y));
        continue;
      }
      if (entity.type === 'arena') {
        this.createArena(entity);
        continue;
      }
      if (entity.type === 'boss') {
        this.createBoss(entity);
        continue;
      }

      if (ENEMY_ENTITY_TYPES.has(entity.type)) {
        const enemy = new EnemyActor(
          this,
          entity.type as EnemyTypeId,
          entity.x,
          entity.y,
          entity.facing,
          entity.patrolLeft,
          entity.patrolRight,
          probe,
          {
            onFire: (source, angle) => this.spawnEnemyShot(source, angle),
            onDied: (source) => this.removeEnemy(source),
            onDamaged: (source, result) => {
              this.fx.play('fx.impact.armor', source.x, source.torsoY);
              if (result.killed) this.rewardKill(source);
            },
          },
        );
        this.enemies.push(enemy);
        this.enemyGroup.add(enemy.sprite);
        continue;
      }

      if (!DESTRUCTIBLE_ENTITY_TYPES.has(entity.type)) {
        throw new Error(`Tipo de entidade sem construtor na cena: "${entity.type}"`);
      }

      const target = new Destructible(this, entity.type as DestructibleTypeId, entity.x, entity.y, {
        onDestroyed: (source) => this.onDestructibleDestroyed(source),
      });
      this.destructibles.push(target);
      this.destructibleGroup.add(target.sprite);
    }
  }

  /**
   * O portão de extração. É só apresentação: o gatilho é uma checagem de caixa
   * em `checkExit`, não um corpo Arcade.
   *
   * Um overlap de física precisaria de um corpo, de um grupo e de uma entrada
   * na matriz de colisão, e ainda assim poderia ser atravessado num frame de
   * queda longa. Uma caixa de 44 px conferida a cada passo fixo não pode.
   */
  private createExitMarker(entity: LevelEntity): void {
    /* Fechado enquanto o boss viver. Não é só regra: o portão fechado é a
       resposta visual para "por que não consigo sair daqui?" — sem ele o
       jogador ficaria batendo num limite invisível sem entender o motivo. */
    const locked = this.boss !== null || findBoss(this.def) !== null;
    const art = SPRITES[locked ? 'prop.gate.closed' : 'prop.gate.open'];
    const gate = this.add.sprite(entity.x, entity.y, art.atlas, art.frame);
    gate.setOrigin(0.5, 1);
    gate.setDepth(DEPTH_EXIT);
    this.exitGate = gate;

    // Baliza piscando no vão do portão: é o que faz o jogador ir até lá.
    const beacon = this.add.sprite(entity.x, entity.y - 24, 'env', 'prop/checkpoint/on/0');
    beacon.setOrigin(0.5, 1);
    beacon.setDepth(DEPTH_EXIT + 1);
    beacon.play('prop.checkpoint.on', true);
  }

  /**
   * Checkpoint: um mastro apagado que acende ao ser tocado.
   *
   * Já nasce ACESO se for o checkpoint em que a tentativa está — senão, ao
   * morrer e reaparecer, o jogador veria apagado justamente o marco que
   * acabou de conquistar.
   */
  private createCheckpointMarker(entity: LevelEntity): void {
    const active = this.deps.run.checkpoint?.id === entity.id;
    const art = SPRITES['prop.checkpoint.off'];
    const sprite = this.add.sprite(entity.x, entity.y, art.atlas, art.frame);
    sprite.setOrigin(0.5, 1);
    sprite.setDepth(DEPTH_EXIT);
    if (active) sprite.play('prop.checkpoint.on', true);

    this.checkpoints.push({ id: entity.id!, x: entity.x, y: entity.y, sprite, active });
  }

  private createArena(entity: LevelEntity): void {
    this.arena = entity;
    // Portão que fecha atrás do jogador. Só aparece quando a luta começa.
    const art = SPRITES['prop.gate.closed'];
    const gate = this.add.sprite(entity.x - this.def.tileWidth, entity.y, art.atlas, art.frame);
    gate.setOrigin(0.5, 1);
    gate.setDepth(DEPTH_EXIT);
    gate.setVisible(false);
    this.arenaGate = gate;
  }

  private createBoss(entity: LevelEntity): void {
    const boss = new BossActor(this, entity.x, entity.y, {
      onFire: (source, angle, speed, damage) => this.spawnBossShot(source, angle, speed, damage),
      onSlam: (x, y, radius, damage) => this.resolveSlam(x, y, radius, damage),
      onShake: (trauma) => this.director.shake(trauma),
      onHealthChanged: (hp, max, phase) =>
        this.deps.bus.emit('boss:health', { fraction: max > 0 ? hp / max : 0, phase }),
      onPhaseChanged: (phase) => this.deps.bus.emit('boss:phase', { phase }),
      onStateChanged: (state, phase) => {
        if (state === BossState.Telegraph) {
          this.deps.bus.emit('boss:telegraph', { pattern: boss.brain.pattern ?? '' });
        } else if (state === BossState.Vent) {
          this.deps.bus.emit('boss:vent', { phase });
        }
      },
      onDied: (source) => this.onBossDefeated(source),
      playFx: (key, x, y) => this.fx.play(key, x, y),
    });
    this.boss = boss;
    boss.setArena(this.arenaLeft(), this.arenaRight());
    this.bossPartGroup.add(boss.sprite);
    this.bossPartGroup.add(boss.core);
  }

  /* A arena em px. Sem arena declarada, o mundo inteiro é a arena — assim o
     boss continua funcionando numa fase de teste sem cenário de luta. */
  private arenaLeft(): number {
    return this.arena ? this.arena.x : 0;
  }

  private arenaRight(): number {
    return this.arena ? this.arena.x + this.arena.spanPx : this.built.widthPx;
  }

  private wireCollisions(): void {
    registerCollisions(
      this.physics,
      {
        playerSprite: this.player.sprite,
        tileLayer: this.built.layer,
        enemies: this.enemyGroup,
        destructibles: this.destructibleGroup,
        playerShots: this.playerShotGroup,
        enemyShots: this.enemyShotGroup,
        grenades: this.grenadeGroup,
        bossParts: this.bossPartGroup,
      },
      {
        playerVsTile: (tile) => !(this.player.isDropping && ONE_WAY_TILES.has(tile.index)),
        playerShotHitTile: (shot) => this.impactShot(shot as Projectile),
        playerShotHitEnemy: (shot, enemyObject) =>
          this.hitEnemy(shot as Projectile, enemyObject as Phaser.GameObjects.Sprite),
        playerShotHitDestructible: (shot, targetObject) =>
          this.hitDestructible(shot as Projectile, targetObject as Phaser.GameObjects.Sprite),
        playerShotHitBoss: (shot, part) =>
          this.hitBoss(shot as Projectile, part as Phaser.GameObjects.Sprite),
        enemyShotHitTile: (shot) => this.impactShot(shot as Projectile),
        enemyShotHitPlayer: (shot) => this.hitPlayerWithShot(shot as Projectile),
        playerTouchedEnemy: (enemyObject) =>
          this.contactDamage(enemyObject as Phaser.GameObjects.Sprite),
      },
    );
  }

  private announceInitialState(): void {
    const bus = this.deps.bus;
    const run = this.deps.run;
    bus.emit('run:started', { levelId: run.levelId, lives: run.lives, score: run.score });
    bus.emit('player:spawned', { x: this.spawn.x, y: this.spawn.y });
    bus.emit('weapon:changed', { weaponId: 'pistol', ammo: 'infinite' });
    bus.emit('player:damaged', { hp: this.player.health.current, max: this.player.health.max });
    bus.emit('grenades:changed', { count: this.player.grenadeCount });
    bus.emit('score:changed', { score: run.score, delta: 0 });
    bus.emit('lives:changed', { lives: run.lives, delta: 0 });
  }

  /* ───────────────────────────── Loop ───────────────────────────── */

  /**
   * Congela a SIMULAÇÃO sem congelar a cena.
   *
   * Um flag nosso, e não `scene.pause()` do Phaser: `pause()` só tem efeito
   * quando a cena já está marcada como RUNNING, e o momento em que mais
   * precisamos dela — o fim do `create`, com a tela de título aberta — é
   * justamente quando ela ainda não está. O resultado era o jogo rodando
   * atrás do menu, com o jogador levando tiro antes de apertar JOGAR.
   */
  setSimulationPaused(paused: boolean): void {
    this.simulationPaused = paused;
    /* O mundo do Arcade também PARA. Só pular o nosso `update` não basta: os
       corpos guardam velocidade e o motor continua integrando por conta
       própria, então o jogador seguia deslizando por baixo do menu de pausa.
       Foi assim que a tela de título "pausada" deixava o personagem andar. */
    if (paused) this.physics.pause();
    else this.physics.resume();

    // Descarta o tempo acumulado: retomar não pode disparar uma rajada de
    // passos para "recuperar" os segundos em que o menu esteve aberto.
    if (!paused) this.accumulatorMs = 0;
  }

  override update(_time: number, delta: number): void {
    if (this.simulationPaused) return;
    const dt = Math.min(delta, MAX_FRAME_MS);

    /* Passo fixo para a simulação: o mesmo input produz o mesmo resultado em
       60 Hz, 120 Hz ou num celular engasgando — condição para replays.
       O acumulador é a ÚNICA fonte de tempo da simulação; um passo extra de
       delta variável quando `steps === 0` (a tentação óbvia) integraria o
       mesmo tempo duas vezes e faria o jogo rodar ~1,5× mais rápido a 120 Hz. */
    this.accumulatorMs += dt;
    let steps = 0;
    while (this.accumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      /* O input é lido DENTRO do passo, nunca uma vez por frame.
         Ler por frame parece equivalente e não é: um frame curto pode não
         completar nenhum passo, e a leitura já teria consumido o latch de
         toque do teclado — o comando desaparecia sem deixar rastro. Para quem
         joga, isso é o jogo ignorando um toque de vez em quando.
         Ler por passo também resolve as bordas: a segunda leitura do mesmo
         frame vê a tecla como segurada, não como recém-pressionada. */
      this.deps.input.update(this.time.now, FIXED_STEP_MS);
      this.simulate(FIXED_STEP_MS);
      this.accumulatorMs -= FIXED_STEP_MS;
      steps++;
      // `scene.restart()` só acontece no começo do próximo frame: continuar
      // simulando aqui rodaria passos numa fase que já foi declarada morta.
      if (this.phase === 'restarting') break;
    }
    // Travamento longo: descarta o resto em vez de tentar recuperar em rajada.
    if (this.accumulatorMs > FIXED_STEP_MS * MAX_STEPS_PER_FRAME) this.accumulatorMs = 0;
  }

  private simulate(dtMs: number): void {
    if (this.phase === 'restarting') return;

    const now = this.time.now;
    this.player.step(this.deps.input.snapshot, now, dtMs);

    /* Inimigos fora da tela não pensam. Além de custar frame à toa, um soldado
       reagindo a tiros a 800 px de distância confunde mais do que ajuda. */
    const camera = this.cameras.main;
    const minX = camera.scrollX - AI_ACTIVE_MARGIN_PX;
    const maxX = camera.scrollX + camera.width + AI_ACTIVE_MARGIN_PX;
    const playerAlive = !this.player.state.dead;

    for (const enemy of this.enemies) {
      if (!enemy.alive || (enemy.x >= minX && enemy.x <= maxX)) {
        enemy.step(this.player.x, this.player.torsoY, playerAlive, now, dtMs);
      }
    }

    for (const target of this.destructibles) target.step(dtMs);
    for (const pickup of this.pickups) pickup.step(dtMs);

    this.boss?.step(this.player.x, this.player.torsoY, playerAlive, now, dtMs);

    this.tickProjectiles(dtMs);
    this.tickGrenades(dtMs);
    this.tickPickups();
    this.tickCheckpoints();
    this.tickArena();
    this.tickBossContact();
    this.tickOutOfWorld();
    this.tickDeath(dtMs);
    this.checkExit();
    this.tickOutcomeInput(dtMs);
  }

  private postUpdate(_time: number, delta: number): void {
    const dt = Math.min(delta, MAX_FRAME_MS);
    this.player.render();
    this.boss?.render();
    this.director.update(
      this.player.x,
      this.player.y - CAMERA_TARGET_OFFSET_Y,
      this.player.state.vx,
      this.player.state.facing,
      this.player.state.grounded,
      dt,
    );
    updateParallax(this.built.parallax, this.cameras.main, this.quality !== 'low');
    this.deps.debug.update(dt);
  }

  setQuality(level: QualityLevel): void {
    this.quality = level;
    this.fx.setQuality(level);
  }

  /** 0..1, vindo das Settings. Acessibilidade: shake é causa de enjoo. */
  setShakeIntensity(intensity: number): void {
    this.director.shakeIntensity = intensity;
  }

  /* ──────────────────────────── Projéteis ───────────────────────── */

  private spawnPlayerShots(
    shots: readonly ShotRequest[],
    weaponId: WeaponId,
    muzzleX: number,
    muzzleY: number,
    angleRad: number,
  ): void {
    const def = WEAPONS[weaponId];
    const art = SPRITES[def.fx.projectile as keyof typeof SPRITES];

    for (const shot of shots) {
      const projectile = this.playerShots.acquire();
      if (!projectile) break;
      projectile.fire(shot, art);
      this.activeShots.push(projectile);
    }

    this.fx.muzzle(def.fx.muzzle, muzzleX, muzzleY, angleRad);
    this.deps.bus.emit('player:fired', { x: muzzleX, y: muzzleY, angleRad, weaponId });
  }

  private spawnEnemyShot(source: EnemyActor, angleRad: number): void {
    const projectile = this.enemyShots.acquire();
    if (!projectile) return;

    const def = source.def;
    const muzzleX = source.x + Math.cos(angleRad) * 14;
    const muzzleY = source.torsoY + Math.sin(angleRad) * 14;
    const art = SPRITES[def.projectileSprite as keyof typeof SPRITES];

    projectile.fire(
      {
        x: muzzleX,
        y: muzzleY,
        angleRad,
        speed: def.projectileSpeed,
        damage: def.projectileDamage,
        lifeMs: def.projectileLifeMs,
        ownerId: -1,
        team: 'enemy',
        weaponId: 'pistol',
      },
      art,
    );
    this.activeShots.push(projectile);
    this.fx.muzzle(def.muzzleFx, muzzleX, muzzleY, angleRad);
  }

  private tickProjectiles(dtMs: number): void {
    for (let i = this.activeShots.length - 1; i >= 0; i--) {
      const shot = this.activeShots[i]!;
      if (shot.tick(dtMs) || !shot.active) this.retireShot(shot, i);
    }
  }

  private impactShot(shot: Projectile): void {
    if (!shot.active) return;
    const key = shot.team === 'player' ? 'fx.impact.concrete' : 'fx.impact.metal';
    this.fx.play(key, shot.x, shot.y);
    this.retireShot(shot);
  }

  private retireShot(shot: Projectile, index = this.activeShots.indexOf(shot)): void {
    if (index >= 0) this.activeShots.splice(index, 1);
    shot.deactivate();
    (shot.poolTag === 'player' ? this.playerShots : this.enemyShots).release(shot);
  }

  /* ────────────────────────────── Dano ──────────────────────────── */

  private hitEnemy(shot: Projectile, enemySprite: Phaser.GameObjects.Sprite): void {
    if (!shot.active || shot.team !== 'player') return;
    const enemy = enemySprite.getData('enemy') as EnemyActor | undefined;
    if (!enemy?.alive) return;

    this.enemyDamage.amount = shot.damage;
    this.enemyDamage.kind = 'bullet';
    this.enemyDamage.sourceId = shot.ownerId;
    this.enemyDamage.originX = shot.x;
    this.enemyDamage.originY = shot.y;
    this.enemyDamage.knockback = KNOCKBACK_PER_SHOT;

    enemy.takeDamage(this.enemyDamage, this.time.now);
    this.retireShot(shot);
  }

  private hitDestructible(shot: Projectile, targetSprite: Phaser.GameObjects.Sprite): void {
    if (!shot.active || shot.team !== 'player') return;
    const target = targetSprite.getData('destructible') as Destructible | undefined;
    if (!target?.alive) return;

    this.enemyDamage.amount = shot.damage;
    this.enemyDamage.kind = 'bullet';
    this.enemyDamage.sourceId = shot.ownerId;
    this.enemyDamage.originX = shot.x;
    this.enemyDamage.originY = shot.y;
    this.enemyDamage.knockback = 0;

    target.takeDamage(this.enemyDamage, this.time.now);
    this.fx.play('fx.impact.metal', shot.x, shot.y);
    this.retireShot(shot);
  }

  private hitPlayerWithShot(shot: Projectile): void {
    if (!shot.active || shot.team !== 'enemy') return;
    this.damagePlayer(shot.damage, shot.x, shot.y, 'bullet');
    this.retireShot(shot);
  }

  private contactDamage(enemySprite: Phaser.GameObjects.Sprite): void {
    const enemy = enemySprite.getData('enemy') as EnemyActor | undefined;
    if (!enemy?.alive || enemy.contactDamage <= 0) return;
    this.damagePlayer(enemy.contactDamage, enemy.x, enemy.torsoY, 'contact');
  }

  private damagePlayer(
    amount: number,
    originX: number,
    originY: number,
    kind: DamageInfo['kind'],
  ): void {
    if (this.phase !== 'playing' || this.player.state.dead) return;

    this.enemyDamage.amount = amount;
    this.enemyDamage.kind = kind;
    this.enemyDamage.sourceId = -1;
    this.enemyDamage.originX = originX;
    this.enemyDamage.originY = originY;
    this.enemyDamage.knockback = PLAYER_HIT_KNOCKBACK;

    const result = this.player.takeDamage(this.enemyDamage, this.time.now);
    if (result.applied <= 0) return;

    this.fx.play('fx.impact.armor', this.player.x, this.player.torsoY);
    this.director.shake(0.2);
  }

  /* ────────────────────────── Explosivos ────────────────────────── */

  private throwGrenade(x: number, y: number, angleRad: number, facing: -1 | 1): void {
    const grenade = this.grenades.acquire();
    if (!grenade) return;
    grenade.throw(x, y, angleRad, facing);
    this.activeGrenades.push(grenade);
  }

  private tickGrenades(dtMs: number): void {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const grenade = this.activeGrenades[i]!;
      if (!grenade.tick(dtMs)) continue;
      const x = grenade.x;
      const y = grenade.y;
      this.activeGrenades.splice(i, 1);
      grenade.deactivate();
      this.grenades.release(grenade);
      this.combat.explode('grenade', x, y, -1, this.time.now);
    }
  }

  private onDestructibleDestroyed(target: Destructible): void {
    const index = this.destructibles.indexOf(target);
    if (index >= 0) this.destructibles.splice(index, 1);

    this.addScore(target.def.score);
    const explosion = target.def.explosion;
    if (explosion) {
      this.combat.explode(explosion, target.x, target.centerY, -1, this.time.now);
    } else {
      this.fx.play('fx.smoke.puff', target.x, target.centerY);
      const broken = target.def.sprites.broken;
      if (broken) {
        const art = SPRITES[broken as keyof typeof SPRITES];
        const debris = this.add.sprite(target.x, target.y, art.atlas, art.frame).setOrigin(0.5, 1);
        debris.setDepth(0);
      }
    }
    void EXPLOSIONS;
  }

  /* ──────────────────────── Morte e pontuação ───────────────────── */

  private rewardKill(enemy: EnemyActor): void {
    this.addScore(enemy.def.score);
    this.fx.play(enemy.def.deathFx, enemy.x, enemy.torsoY);
    this.deps.bus.emit('enemy:killed', { typeId: enemy.def.id, x: enemy.x, y: enemy.y });
  }

  private removeEnemy(enemy: EnemyActor): void {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  /** A pontuação é da TENTATIVA, não da cena: sobrevive a reiniciar a fase. */
  private addScore(amount: number): void {
    const run = this.deps.run;
    addScore(run, amount, this.scoreResult);
    this.deps.bus.emit('score:changed', { score: run.score, delta: amount });
    if (this.scoreResult.extraLives > 0) {
      this.deps.bus.emit('lives:changed', { lives: run.lives, delta: this.scoreResult.extraLives });
      this.fx.play('fx.marker.checkpoint', this.player.x, this.player.torsoY);
    }
  }

  private onPlayerDied(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'dying';
    this.deathTimerMs = PLAYER.respawnDelayMs;
    this.director.shake(0.55);
    this.fx.play('fx.explosion.small', this.player.x, this.player.torsoY);
    this.deps.bus.emit('player:died', {
      atCheckpointId: this.deps.run.checkpoint?.id ?? null,
    });
  }

  /** Cair para fora do mundo mata — sem isto o player some para sempre. */
  private tickOutOfWorld(): void {
    if (this.phase !== 'playing') return;
    if (this.player.y <= this.built.heightPx + 96) return;
    this.damagePlayer(999, this.player.x, this.player.y, 'crush');
  }

  /**
   * Desconta a vida quando a animação de morte termina.
   *
   * Ainda há vida → a FASE INTEIRA reinicia, com os inimigos de volta. É a
   * única leitura coerente enquanto não existem checkpoints (Fase 3): voltar
   * ao início com o mapa já limpo não é "recomeçar", é andar por um cenário
   * vazio. A pontuação NÃO zera aqui — ela é da tentativa.
   */
  private tickDeath(dtMs: number): void {
    if (this.phase !== 'dying') return;

    this.deathTimerMs -= dtMs;
    if (this.deathTimerMs > 0) return;

    const run = this.deps.run;
    const outcome = loseLife(run);
    this.deps.bus.emit('lives:changed', { lives: run.lives, delta: -1 });

    if (outcome === 'respawn') {
      this.restartLevel();
      return;
    }

    this.phase = 'game-over';
    this.outcomeLockMs = OUTCOME_INPUT_LOCK_MS;
    this.player.setFrozen(true);
    this.deps.bus.emit('run:gameOver', {
      levelId: run.levelId,
      score: run.score,
      timeMs: elapsedMs(run, this.time.now),
    });
  }

  /* ─────────────────────── Fim de fase e recomeço ────────────────── */

  /**
   * O gatilho da saída, conferido a cada passo fixo.
   *
   * A caixa é generosa na vertical (96 px) porque nada garante que o jogador
   * chegue andando: com o portão no chão, quem cai de uma plataforma passaria
   * por dentro dele num único passo se a checagem fosse estreita.
   */
  private checkExit(): void {
    if (this.phase !== 'playing' || this.player.state.dead) return;
    // Portão trancado enquanto o Estivador estiver de pé.
    if (this.boss !== null) return;

    const dx = Math.abs(this.player.x - this.exit.x);
    const dy = this.exit.y - this.player.y;
    if (dx > EXIT_TRIGGER_HALF_WIDTH || dy < -8 || dy > EXIT_TRIGGER_HEIGHT) return;

    this.phase = 'complete';
    this.outcomeLockMs = OUTCOME_INPUT_LOCK_MS;
    this.player.setFrozen(true);
    this.fx.play('fx.marker.checkpoint', this.exit.x, this.exit.y - 40);

    const run = this.deps.run;
    this.deps.bus.emit('level:complete', {
      levelId: run.levelId,
      timeMs: elapsedMs(run, this.time.now),
      score: run.score,
    });
  }

  /**
   * Recomeçar também funciona no teclado e no gamepad.
   *
   * O botão em DOM é o caminho principal (é o único que existe no touch), mas
   * exigir um clique de quem estava com as duas mãos no teclado é atrito puro.
   */
  private tickOutcomeInput(dtMs: number): void {
    if (this.phase !== 'complete' && this.phase !== 'game-over') return;
    if (this.outcomeLockMs > 0) {
      this.outcomeLockMs -= dtMs;
      return;
    }
    const input = this.deps.input.snapshot;
    if (input.justPressed(Action.Jump) || input.justPressed(Action.Shoot)) {
      this.handleRestartRequest();
    }
  }

  private handleRestartRequest(): void {
    if (this.phase !== 'complete' && this.phase !== 'game-over') return;
    // Fim de tentativa zera pontos e devolve as vidas; fim de fase só recomeça.
    if (this.phase === 'game-over') resetRun(this.deps.run, this.time.now);
    this.restartLevel();
  }

  private restartLevel(): void {
    this.phase = 'restarting';
    this.scene.restart();
  }

  /* ────────────────────────── Checkpoints ───────────────────────── */

  /**
   * Tocar um mastro grava o ponto de retorno E o equipamento.
   *
   * Sem o loadout, pegar a escopeta e morrer devolvia o jogador com a pistola —
   * o item vira uma punição por avançar, que é o oposto do que ele deveria ser.
   */
  private tickCheckpoints(): void {
    if (this.phase !== 'playing' || this.player.state.dead) return;

    for (const marker of this.checkpoints) {
      if (marker.active) continue;
      if (Math.abs(this.player.x - marker.x) > CHECKPOINT_RADIUS) continue;
      if (Math.abs(this.player.y - marker.y) > CHECKPOINT_RADIUS * 2) continue;

      marker.active = true;
      marker.sprite.play('prop.checkpoint.on', true);
      this.deps.run.checkpoint = captureCheckpoint(
        marker.id,
        marker.x,
        marker.y,
        this.player.loadout,
      );
      this.fx.play('fx.marker.checkpoint', marker.x, marker.y - 40);
      this.deps.bus.emit('checkpoint:reached', { id: marker.id });
    }
  }

  /* ──────────────────────────── Itens ───────────────────────────── */

  private tickPickups(): void {
    if (this.phase !== 'playing' || this.player.state.dead) return;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]!;
      if (!pickup.overlaps(this.player.x, this.player.y)) continue;
      // Um item que não faz nada (vida cheia, munição no talo) NÃO é consumido:
      // ele fica ali para quando o jogador precisar.
      if (!this.applyPickup(pickup.variant)) continue;

      this.fx.play('fx.marker.checkpoint', pickup.x, pickup.y);
      this.deps.bus.emit('pickup:taken', { variant: pickup.variant });
      pickup.take();
      this.pickups.splice(i, 1);
    }
  }

  private applyPickup(variant: PickupVariant): boolean {
    switch (variant) {
      case 'weapon_mg':
        this.player.equipWeapon('machinegun');
        return true;
      case 'weapon_sg':
        this.player.equipWeapon('shotgun');
        return true;
      case 'grenade':
        return this.player.addGrenades(2);
      case 'health':
        return this.player.heal(2);
      case 'ammo':
        return this.player.addAmmo(0.35);
    }
  }

  /* ─────────────────────── Arena e mini-boss ────────────────────── */

  /**
   * Cruzar a soleira fecha o portão, prende a câmera e acorda o Estivador.
   *
   * Os limites do MUNDO encolhem para a arena durante a luta. É a mesma parede
   * invisível que impede sair pela borda do mapa, reaproveitada — e é por isso
   * que o jogador não consegue simplesmente correr para longe do boss.
   */
  private tickArena(): void {
    if (!this.arena || !this.boss || this.arenaLocked || this.bossDefeated) return;
    if (this.phase !== 'playing') return;
    /* DENTRO do vão da arena, não apenas "passou da soleira": com o override
       de spawn dá para nascer depois dela, e travar os limites do mundo num
       trecho que não contém o jogador o empurraria para dentro à força. */
    if (this.player.x < this.arena.x || this.player.x > this.arenaRight()) return;

    this.arenaLocked = true;
    this.physics.world.setBounds(this.arenaLeft(), 0, this.arena.spanPx, this.built.heightPx + 256);
    this.director.setLimits(this.arenaLeft(), this.arenaRight());
    this.arenaGate?.setVisible(true);
    this.boss.wake();
    this.director.shake(0.3);

    this.deps.bus.emit('boss:started', { name: 'Estivador' });
    this.deps.bus.emit('boss:health', { fraction: 1, phase: 1 });
  }

  private onBossDefeated(boss: BossActor): void {
    this.bossDefeated = true;
    this.arenaLocked = false;
    boss.destroy();
    this.boss = null;

    // A arena abre: o mundo volta ao tamanho inteiro e o portão de saída sobe.
    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx + 256);
    this.director.setLimits(0, this.built.widthPx);
    this.arenaGate?.setVisible(false);
    const open = SPRITES['prop.gate.open'];
    this.exitGate?.setTexture(open.atlas, open.frame);

    this.addScore(BOSS_SCORE);
    this.deps.bus.emit('boss:defeated', { score: BOSS_SCORE });
  }

  private spawnBossShot(source: BossActor, angleRad: number, speed: number, damage: number): void {
    const projectile = this.enemyShots.acquire();
    if (!projectile) return;

    const muzzleX = source.x + Math.cos(angleRad) * 40;
    const muzzleY = source.muzzleY + Math.sin(angleRad) * 40;
    projectile.fire(
      {
        x: muzzleX,
        y: muzzleY,
        angleRad,
        speed,
        damage,
        lifeMs: 2600,
        ownerId: -1,
        team: 'enemy',
        weaponId: 'pistol',
      },
      SPRITES['projectile.heavyBullet'],
    );
    this.activeShots.push(projectile);
    this.fx.muzzle('fx.muzzle.large', muzzleX, muzzleY, angleRad);
  }

  /** Golpe da garra: dano em área no chão, mais os destrutíveis por perto. */
  private resolveSlam(x: number, y: number, radius: number, damage: number): void {
    this.fx.play('fx.dust.land', x, y - 4);
    if (Math.abs(this.player.x - x) <= radius && Math.abs(this.player.y - y) <= radius) {
      this.damagePlayer(damage, x, y, 'crush');
    }
    for (const target of this.destructibles) {
      if (!target.alive || Math.abs(target.x - x) > radius) continue;
      this.enemyDamage.amount = 999;
      this.enemyDamage.kind = 'explosion';
      this.enemyDamage.sourceId = -1;
      this.enemyDamage.originX = x;
      this.enemyDamage.originY = y;
      this.enemyDamage.knockback = 0;
      target.takeDamage(this.enemyDamage, this.time.now);
    }
  }

  private hitBoss(shot: Projectile, part: Phaser.GameObjects.Sprite): void {
    if (!shot.active || shot.team !== 'player') return;
    const boss = (part.getData('bossCore') ?? part.getData('boss')) as BossActor | undefined;
    if (!boss?.alive) return;

    /* O núcleo fica DENTRO da hurtbox da carcaça, então um tiro que acerta o
       ponto fraco sobrepõe os dois corpos — e o Arcade entrega primeiro o que
       estiver antes no grupo. Confiar nisso fazia a carcaça ganhar sempre e o
       ponto fraco não existir na prática. Aqui a pergunta é feita direto: o
       tiro está na caixa do núcleo? Se sim, é acerto no núcleo, não importa
       qual corpo disparou o callback. */
    const onCore = boss.coreContains(shot.x, shot.y);
    this.enemyDamage.amount = shot.damage;
    this.enemyDamage.kind = 'bullet';
    this.enemyDamage.sourceId = shot.ownerId;
    this.enemyDamage.originX = shot.x;
    this.enemyDamage.originY = shot.y;
    this.enemyDamage.knockback = 0;

    boss.takeDamage(this.enemyDamage, this.time.now, onCore);
    this.deps.bus.emit('boss:hit', { onCore, x: shot.x, y: shot.y });
    /* Faísca no núcleo, ricochete na blindagem. É o único aviso de que a mira
       está certa ou errada — e sem ele o jogador não tem como descobrir a
       regra da luta sem que alguém conte. */
    this.fx.play(onCore ? 'fx.impact.armor' : 'fx.impact.metal', shot.x, shot.y);
    this.retireShot(shot);
  }

  /**
   * Contato com o boss, resolvido à mão.
   *
   * A hurtbox do Arcade cobre o guindaste inteiro para que os tiros o acertem;
   * o dano de contato usa uma caixa BAIXA, na altura do arado. Um corpo só não
   * consegue ser as duas coisas — e é essa diferença que permite desviar da
   * investida em cima das plataformas, que é o contra-ataque da arena.
   */
  private tickBossContact(): void {
    const boss = this.boss;
    if (!boss?.alive || !boss.awake || this.phase !== 'playing') return;
    if (boss.contactDamage <= 0) return;

    const dx = Math.abs(this.player.x - boss.x);
    const feetAbovePlow = boss.y - this.player.y;
    if (dx > BOSS_PLOW.halfWidth) return;
    if (feetAbovePlow > BOSS_PLOW.height || feetAbovePlow < -8) return;

    this.damagePlayer(boss.contactDamage, boss.x, boss.y - 20, 'contact');
  }

  /* ─────────────────────────── Consultas ────────────────────────── */

  private isSolidTile(tileX: number, tileY: number): boolean {
    const tile = this.built.layer.getTileAt(tileX, tileY, true);
    // Plataformas não bloqueiam a visão: um inimigo em cima de uma delas
    // precisa enxergar quem está embaixo.
    return tile !== null && tile.index > 0 && !ONE_WAY_TILES.has(tile.index);
  }

  private isSolidAtWorld(x: number, y: number): boolean {
    return this.isSolidTile(
      Math.floor(x / this.def.tileWidth),
      Math.floor(y / this.def.tileHeight),
    );
  }

  /**
   * Amostra a LARGURA DO CORPO, não só o centro.
   *
   * Parado na beirada de uma plataforma, o player continua apoiado nela mesmo
   * com o centro sobre o vazio — e uma amostra única no centro recusava a
   * descida exatamente ali, do jeito mais confuso possível para quem joga.
   */
  private isOnOneWayPlatform(x: number, y: number): boolean {
    const half = PLAYER.bodyWidth / 2 - 2;
    for (const offset of [0, -half, half]) {
      const tile = this.built.layer.getTileAtWorldXY(x + offset, y + 2, true);
      if (tile !== null && ONE_WAY_TILES.has(tile.index)) return true;
    }
    return false;
  }

  /* ────────────────────────────── Debug ─────────────────────────── */

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
        `vida   ${this.player.health.current}/${this.player.health.max}  inv:${s.invulnMs.toFixed(0)}`,
        `arma   ${this.player.weaponState.weaponId}  munição:${this.player.weaponState.ammo}  granadas:${this.player.grenadeCount}`,
      ].join('\n');
    });
    debug.register('combate', () => {
      const alive = this.enemies.filter((e) => e.alive).length;
      const states = this.enemies
        .filter((e) => e.alive)
        .slice(0, 4)
        .map((e) => `${e.def.id}:${e.brain.state}`)
        .join(' ');
      const run = this.deps.run;
      return [
        `inimigos ${alive}/${this.enemies.length}  destrutíveis ${this.destructibles.length}`,
        `score    ${run.score}  vidas ${run.lives}  fase:${this.phase}` +
          `${this.simulationPaused ? '  PAUSADO' : ''}`,
        states || '(nenhum ativo)',
      ].join('\n');
    });
    debug.register('cena', () => {
      const cam = this.director.debugState;
      return [
        `câmera  ${cam.x.toFixed(0)}, ${cam.y.toFixed(0)}  trauma:${cam.trauma.toFixed(2)}`,
        `pools   tiros ${this.playerShots.activeCount + this.enemyShots.activeCount}  granadas ${this.grenades.activeCount}  fx ${this.fx.activeCount}`,
        `viewport ${this.scale.gameSize.width}×${this.scale.gameSize.height}  qualidade:${this.quality}`,
      ].join('\n');
    });
  }
}

/** Empurrão de um tiro comum. Pequeno: só confirma o acerto. */
const KNOCKBACK_PER_SHOT = 55;
const PLAYER_HIT_KNOCKBACK = 90;
