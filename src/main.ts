/**
 * Bootstrap: monta a casca DOM, o jogo Phaser e as pontes entre eles.
 *
 * É o único arquivo que conhece TODAS as camadas. Todo o resto conhece apenas
 * a camada imediatamente abaixo — é isso que mantém `core` testável e a
 * apresentação substituível.
 */

import Phaser from 'phaser';
import './ui/styles/ui.css';

import { QUALITY, WORLD, type QualityLevel } from './core/config/tuning';
import { createEventBus } from './core/events/bus';
import { createRunState } from './core/progression/run-state';
import { KeyValueSaveRepository, MemoryStore } from './core/save/repository';
import { computeLogicalSize, isPortrait } from './game/boot/scale';
import { InputManager } from './game/input/InputManager';
import {
  GamepadDevice,
  KeyboardDevice,
  TouchDevice,
  createTouchInputSource,
} from './game/input/devices';
import { PreloadScene } from './game/scenes/PreloadScene';
import { LevelScene, LEVEL_DEPS_KEY } from './game/scenes/LevelScene';
import { DebugService } from './game/debug/DebugService';
import { AudioService } from './game/audio/AudioService';
import { AudioDirector } from './game/audio/AudioDirector';
import { UiRoot } from './ui/UiRoot';
import { MenuLayer } from './ui/menus/MenuLayer';
import { detectDevice, safeLocalStorage } from './platform/device';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app não encontrado');

  const params = new URLSearchParams(window.location.search);
  const device = detectDevice();
  const bus = createEventBus();
  const touchSource = createTouchInputSource();

  const save = new KeyValueSaveRepository(safeLocalStorage() ?? new MemoryStore());
  const saved = await save.load();
  const settings = saved.settings;

  const ui = new UiRoot(app, bus, touchSource);
  ui.setTouchEnabled(device.hasTouch);
  ui.setHint(
    device.hasTouch
      ? 'Direcional à esquerda · botões à direita'
      : 'A/D mover · Espaço pular · J atirar · Q trocar arma · ` debug',
  );

  const debug = new DebugService(app, params.get('debug') === '1');

  const input = new InputManager()
    .add(new KeyboardDevice(window))
    .add(new GamepadDevice(navigator))
    .add(new TouchDevice(touchSource));

  const initial = computeLogicalSize(window.innerWidth, window.innerHeight);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: app,
    width: initial.width,
    height: initial.height,
    backgroundColor: '#0d0b12',
    // Pixel art: NEAREST e sem suavização. Sem isto tudo borra no upscale.
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    powerPreference: 'high-performance',
    scale: {
      // NONE + handler próprio: `FIT` letterboxa demais em 19.5:9 e `RESIZE`
      // sem limites mudaria o balanceamento entre aparelhos.
      mode: Phaser.Scale.NONE,
      zoom: initial.zoom,
    },
    physics: {
      default: 'arcade',
      arcade: {
        // A gravidade do player é resolvida em core/player/movement.ts.
        gravity: { x: 0, y: 0 },
        fixedStep: true,
        fps: WORLD.fixedFps,
        debug: params.get('hitboxes') === '1',
      },
    },
    scene: [PreloadScene, LevelScene],
  });

  /* A tentativa nasce AQUI, não na cena: `scene.restart()` — que é como uma
     vida perdida devolve os inimigos à fase — destrói tudo o que pertence à
     cena, e o placar precisa sobreviver exatamente a isso. */
  const run = createRunState('level-01', performance.now());

  // `?spawn=120` entra direto naquela coluna. Ferramenta de desenvolvimento:
  // ajustar o fim da fase sem rejogar o mapa inteiro antes de cada tentativa.
  const spawnParam = Number(params.get('spawn'));
  const spawnTileX = Number.isFinite(spawnParam) && params.has('spawn') ? spawnParam : undefined;

  // Injeção de dependências pelo registry: a LevelScene lê no `init`, então
  // não precisamos interceptar o start de cena nem criar singletons globais.
  game.registry.set(LEVEL_DEPS_KEY, { input, bus, debug, run, spawnTileX });

  /* ── Escala e ancoragem da UI ── */

  /* Mede o CONTAINER, não a janela. Na página do jogo `#app` ocupa a viewport
     inteira e dá no mesmo; num embed (landing page, artifact) o jogo passa a
     caber no espaço que recebeu, em vez de vazar por cima do resto. */
  const viewport = (): { width: number; height: number } => ({
    width: app.clientWidth || window.innerWidth,
    height: app.clientHeight || window.innerHeight,
  });

  /* ── Quem manda na pausa ──
     TRÊS coisas podem parar o jogo: o celular em pé, a aba em segundo plano e
     um menu aberto. Cada uma já tentou controlar a pausa por conta própria, e
     o resultado foi que qualquer `resize` retomava a fase por baixo do menu de
     pausa — bastava o ResizeObserver disparar. Agora existe UMA função que
     olha as três condições e decide; ninguém mais chama `pause`/`resume`. */
  let portraitBlocked = false;
  let menuOpen = true; // o jogo abre na tela de título

  const syncLevelRunning = (): void => {
    const level = game.scene.getScene('level') as LevelScene | null;
    level?.setSimulationPaused(portraitBlocked || menuOpen || document.hidden);
  };

  const applyScale = (): void => {
    const { width: vw, height: vh } = viewport();
    const size = computeLogicalSize(vw, vh);
    game.scale.setGameSize(size.width, size.height);
    game.scale.setZoom(size.zoom);

    // A UI se ancora ao CANVAS, não à janela: o letterbox residual nunca
    // separa o HUD do jogo.
    const rect = game.canvas.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty('--canvas-left', `${rect.left}px`);
    root.style.setProperty('--canvas-top', `${rect.top}px`);
    root.style.setProperty('--canvas-width', `${rect.width}px`);
    root.style.setProperty('--canvas-height', `${rect.height}px`);

    portraitBlocked = device.hasTouch && isPortrait(vw, vh);
    ui.setPortraitBlocked(portraitBlocked);
    syncLevelRunning();
  };

  window.addEventListener('resize', applyScale);
  window.addEventListener('orientationchange', () => window.setTimeout(applyScale, 120));
  new ResizeObserver(applyScale).observe(app);
  game.events.once(Phaser.Core.Events.READY, applyScale);

  /* ── Pausa ao perder o foco (também evita áudio tocando em background) ── */

  document.addEventListener('visibilitychange', () => {
    bus.emit('game:paused', { paused: document.hidden });
    syncLevelRunning();
  });

  /* ── Degradação automática de qualidade ──
     Só mexe em partículas e parallax; dano, velocidade e hitbox nunca mudam. */

  if (settings.quality === 'auto') {
    installQualityAutoTune(game, bus);
  } else {
    (game.scene.getScene('level') as LevelScene | null)?.setQuality(settings.quality);
  }

  /* ── Áudio ──
     O serviço nasce mudo: em todo browser moderno o contexto começa suspenso e
     só um gesto real do usuário o libera. Ligamos os três gestos possíveis e
     quem chegar primeiro ganha — tentar adivinhar qual deles vem antes é como
     o áudio acaba não tocando em um aparelho específico. */
  const audio = new AudioService(game.sound);
  audio.setVolumes(settings.volumes);
  audio.setMuted(settings.muted);
  const audioDirector = new AudioDirector(audio, bus);
  void audioDirector;

  const unlock = (): void => audio.unlock();
  for (const event of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(event, unlock, { once: false, passive: true });
  }
  game.events.on(Phaser.Core.Events.POST_STEP, () => audio.update(performance.now()));

  /* ── Menus ──
     A cena da fase fica PAUSADA enquanto um menu está aberto. É por isso que o
     jogo abre no título sem estar rodando por baixo: um boss atacando atrás de
     um menu é a forma mais rápida de perder uma vida sem ter jogado. */
  const levelScene = (): Phaser.Scene | null => game.scene.getScene('level');

  const persist = (): void => {
    void save.save({ ...saved, settings });
  };

  const closeMenus = (): void => {
    menus.show('none');
    menuOpen = false;
    syncLevelRunning();
  };

  const menus: MenuLayer = new MenuLayer(app, bus, settings, {
    onStart: () => {
      closeMenus();
      audio.unlock();
      audio.playMusic('music.level01');
    },
    onResume: () => {
      closeMenus();
      bus.emit('game:paused', { paused: false });
    },
    onRestart: () => {
      closeMenus();
      bus.emit('run:restartRequested', { from: 'level-complete' });
    },
    onSettingsChanged: (next) => {
      audio.setVolumes(next.volumes);
      audio.setMuted(next.muted);
      (levelScene() as LevelScene | null)?.setShakeIntensity(next.shakeIntensity);
      if (next.quality !== 'auto') (levelScene() as LevelScene | null)?.setQuality(next.quality);
      persist();
    },
  });
  /* A fase começa DEPOIS deste ponto: quando os menus são montados o Phaser
     ainda nem instanciou as cenas, então `pause()` agora não tem em quê pegar.
     `run:started` é emitido no fim do `create` da fase — é o instante exato em
  /* A fase começa DEPOIS deste ponto: quando os menus são montados o Phaser
     ainda nem instanciou as cenas. `run:started` sai no fim do `create` da
     fase — é o instante exato em que ela passa a existir, e vale também para
     cada `restart()`. Sem isto o jogo rodava atrás da tela de título e o
     jogador levava tiro antes de apertar JOGAR. */
  bus.on('run:started', syncLevelRunning);

  const openPause = (): void => {
    if (menus.isOpen) return;
    menus.show('pause');
    menuOpen = true;
    syncLevelRunning();
    bus.emit('game:paused', { paused: true });
  };

  /* Pausa: `Esc`/`P` no teclado, botão no HUD para o toque. O menu já trata
     `Esc` para fechar a si mesmo, então aqui só interessa o caminho de ABRIR. */
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape' && event.code !== 'KeyP') return;
    if (menus.isOpen) return;
    event.preventDefault();
    openPause();
  });
  bus.on('game:pauseRequested', openPause);

  if (device.hasTouch) debug.register('touch', () => ui.touchDebugState);

  debug.register(
    'build',
    () =>
      `REDLINE · Phaser ${Phaser.VERSION} · ${device.hasTouch ? 'touch' : 'desktop'} · ` +
      `áudio:${audio.isUnlocked ? 'ligado' : 'aguardando gesto'}`,
  );
}

function installQualityAutoTune(game: Phaser.Game, bus: ReturnType<typeof createEventBus>): void {
  let quality: QualityLevel = 'high';
  let sampleStart = performance.now();
  let frames = 0;
  let lowStreak = 0;
  let highStreak = 0;

  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    frames++;
    const elapsed = performance.now() - sampleStart;
    if (elapsed < QUALITY.sampleWindowMs) return;

    const fps = (frames * 1000) / elapsed;
    frames = 0;
    sampleStart = performance.now();

    if (fps < QUALITY.degradeBelowFps) {
      lowStreak++;
      highStreak = 0;
    } else if (fps > QUALITY.upgradeAboveFps) {
      highStreak++;
      lowStreak = 0;
    } else {
      lowStreak = 0;
      highStreak = 0;
    }

    // Duas janelas seguidas: uma queda isolada (carregamento, GC do browser)
    // não deve degradar o visual do jogo inteiro.
    const next = lowStreak >= 2 ? step(quality, -1) : highStreak >= 2 ? step(quality, 1) : quality;
    if (next === quality) return;

    quality = next;
    lowStreak = 0;
    highStreak = 0;
    (game.scene.getScene('level') as LevelScene | null)?.setQuality(quality);
    bus.emit('quality:changed', { level: quality });
  });
}

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];
function step(current: QualityLevel, delta: number): QualityLevel {
  const index = LEVELS.indexOf(current);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index + delta))]!;
}

void bootstrap();
