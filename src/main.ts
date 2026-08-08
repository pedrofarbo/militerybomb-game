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
import { UiRoot } from './ui/UiRoot';
import { detectDevice, safeLocalStorage } from './platform/device';

async function bootstrap(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app não encontrado');

  const params = new URLSearchParams(window.location.search);
  const device = detectDevice();
  const bus = createEventBus();
  const touchSource = createTouchInputSource();

  const save = new KeyValueSaveRepository(safeLocalStorage() ?? new MemoryStore());
  const { settings } = await save.load();

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

  // Injeção de dependências pelo registry: a LevelScene lê no `init`, então
  // não precisamos interceptar o start de cena nem criar singletons globais.
  game.registry.set(LEVEL_DEPS_KEY, { input, bus, debug });

  /* ── Escala e ancoragem da UI ── */

  const applyScale = (): void => {
    const size = computeLogicalSize(window.innerWidth, window.innerHeight);
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

    const blocked = device.hasTouch && isPortrait(window.innerWidth, window.innerHeight);
    ui.setPortraitBlocked(blocked);
    const level = game.scene.getScene('level');
    if (!level) return;
    if (blocked && level.scene.isActive()) level.scene.pause();
    else if (!blocked && level.scene.isPaused()) level.scene.resume();
  };

  window.addEventListener('resize', applyScale);
  window.addEventListener('orientationchange', () => window.setTimeout(applyScale, 120));
  game.events.once(Phaser.Core.Events.READY, applyScale);

  /* ── Pausa ao perder o foco (também evita áudio tocando em background) ── */

  document.addEventListener('visibilitychange', () => {
    const level = game.scene.getScene('level');
    bus.emit('game:paused', { paused: document.hidden });
    if (!level) return;
    if (document.hidden && level.scene.isActive()) level.scene.pause();
    else if (!document.hidden) applyScale();
  });

  /* ── Degradação automática de qualidade ──
     Só mexe em partículas e parallax; dano, velocidade e hitbox nunca mudam. */

  if (settings.quality === 'auto') {
    installQualityAutoTune(game, bus);
  } else {
    (game.scene.getScene('level') as LevelScene | null)?.setQuality(settings.quality);
  }

  debug.register(
    'build',
    () => `REDLINE · Phaser ${Phaser.VERSION} · ${device.hasTouch ? 'touch' : 'desktop'}`,
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
