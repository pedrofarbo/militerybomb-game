import { describe, expect, it } from 'vitest';
import {
  addTrauma,
  createCameraState,
  stepCamera,
  type CameraTarget,
} from '../../src/core/camera/director';
import { CAMERA } from '../../src/core/config/tuning';

const VIEWPORT = { width: 640, height: 360 };
const BOUNDS = { left: 0, width: 1920, height: 384 };
const STEP = 1000 / 60;

function target(partial: Partial<CameraTarget> = {}): CameraTarget {
  return { x: 0, y: 0, facing: 1, vx: 0, grounded: true, ...partial };
}

describe('câmera — deadzone e lookahead', () => {
  it('não se move enquanto o alvo está dentro da deadzone', () => {
    const s = createCameraState(500, 200);
    const before = s.x;
    // Deslocamento menor que meia deadzone
    stepCamera(s, target({ x: 500 + CAMERA.deadzoneWidth / 4, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    expect(Math.abs(s.x - before)).toBeLessThan(0.5);
  });

  it('persegue o alvo quando ele sai da deadzone', () => {
    const s = createCameraState(500, 200);
    for (let i = 0; i < 60; i++) {
      stepCamera(s, target({ x: 800, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(s.x).toBeGreaterThan(700);
  });

  it('adianta a câmera na direção da corrida, não da face parada', () => {
    const still = createCameraState(500, 200);
    const running = createCameraState(500, 200);
    for (let i = 0; i < 40; i++) {
      stepCamera(still, target({ x: 500, facing: 1, vx: 0 }), VIEWPORT, BOUNDS, STEP, 1);
      stepCamera(running, target({ x: 500, facing: 1, vx: 170 }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(running.lookahead).toBeGreaterThan(still.lookahead + 20);
  });
});

describe('câmera — âncora vertical', () => {
  /**
   * A regra que mais afeta enjoo em plataformas 2D: pular não pode balançar a
   * tela. A câmera segue a última altura de apoio, não o player no ar.
   */
  it('um pulo normal não move a câmera verticalmente', () => {
    const s = createCameraState(500, 200);
    // Assenta a âncora no chão.
    for (let i = 0; i < 60; i++) {
      stepCamera(s, target({ x: 500, y: 200, grounded: true }), VIEWPORT, BOUNDS, STEP, 1);
    }
    const groundedY = s.y;

    // Sobe 64 px (a altura de pulo configurada) e volta.
    for (let i = 0; i < 20; i++) {
      stepCamera(s, target({ x: 500, y: 136, grounded: false }), VIEWPORT, BOUNDS, STEP, 1);
    }

    expect(Math.abs(s.y - groundedY)).toBeLessThan(1);
  });

  it('mas uma queda longa arrasta a câmera junto', () => {
    const s = createCameraState(500, 100);
    for (let i = 0; i < 60; i++) {
      stepCamera(s, target({ x: 500, y: 100, grounded: true }), VIEWPORT, BOUNDS, STEP, 1);
    }
    const before = s.anchorY;

    // 240 px abaixo — muito além da folga aérea.
    stepCamera(s, target({ x: 500, y: 340, grounded: false }), VIEWPORT, BOUNDS, STEP, 1);

    expect(s.anchorY).toBeGreaterThan(before + 100);
  });

  it('ao pisar num novo patamar a âncora acompanha o chão', () => {
    const s = createCameraState(500, 300);
    for (let i = 0; i < 90; i++) {
      stepCamera(s, target({ x: 500, y: 220, grounded: true }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(s.anchorY).toBeCloseTo(220, 0);
  });
});

describe('câmera — limites', () => {
  it('não mostra além da borda esquerda da fase', () => {
    const s = createCameraState(0, 200);
    for (let i = 0; i < 60; i++) {
      stepCamera(s, target({ x: -500, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(s.x).toBe(VIEWPORT.width / 2);
  });

  it('não mostra além da borda direita da fase', () => {
    const s = createCameraState(BOUNDS.width, 200);
    for (let i = 0; i < 60; i++) {
      stepCamera(s, target({ x: BOUNDS.width + 500, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(s.x).toBe(BOUNDS.width - VIEWPORT.width / 2);
  });

  it('centraliza quando a fase é menor que a viewport', () => {
    const s = createCameraState(0, 0);
    stepCamera(s, target(), VIEWPORT, { left: 0, width: 320, height: 200 }, STEP, 1);
    expect(s.x).toBe(160);
    expect(s.y).toBe(100);
  });
});

describe('câmera — screen shake', () => {
  it('trauma satura: uma rajada de explosões não vira terremoto', () => {
    const s = createCameraState(0, 0);
    for (let i = 0; i < 20; i++) addTrauma(s, 0.5);
    expect(s.trauma).toBe(1);
  });

  it('o shake decai até parar', () => {
    const s = createCameraState(500, 200);
    addTrauma(s, 1);
    for (let i = 0; i < 120; i++) {
      stepCamera(s, target({ x: 500, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    }
    expect(s.trauma).toBe(0);
    expect(s.shakeOffsetX).toBe(0);
    expect(s.shakeOffsetY).toBe(0);
  });

  it('intensidade 0 nas Settings desliga o shake por completo (acessibilidade)', () => {
    const s = createCameraState(500, 200);
    addTrauma(s, 1);
    stepCamera(s, target({ x: 500, y: 200 }), VIEWPORT, BOUNDS, STEP, 0);
    expect(s.shakeOffsetX).toBe(0);
    expect(s.shakeOffsetY).toBe(0);
    expect(s.shakeAngle).toBe(0);
  });

  it('o deslocamento cresce com o quadrado do trauma, não linearmente', () => {
    const strong = createCameraState(500, 200);
    const weak = createCameraState(500, 200);
    addTrauma(strong, 1);
    addTrauma(weak, 0.5);
    stepCamera(strong, target({ x: 500, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    stepCamera(weak, target({ x: 500, y: 200 }), VIEWPORT, BOUNDS, STEP, 1);
    // 4× o deslocamento para 2× o trauma
    expect(Math.abs(strong.shakeOffsetX)).toBeGreaterThan(Math.abs(weak.shakeOffsetX) * 3);
  });
});
