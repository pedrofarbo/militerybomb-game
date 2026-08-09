import { describe, expect, it } from 'vitest';
import { PLAYER, WORLD } from '../../src/core/config/tuning';
import { createPlayerState } from '../../src/core/player/player-state';
import {
  createMovementResult,
  stepMovement,
  type MovementInput,
} from '../../src/core/player/movement';

/**
 * O acumulador de passo fixo é o que garante que o jogo se comporte igual em
 * 60 Hz, 120 Hz e num celular engasgando. Este arquivo replica a mesma lógica
 * que `LevelScene.update` usa e prova a propriedade que importa: o resultado
 * depende do TEMPO DECORRIDO, não do ritmo de frames.
 *
 * Regressão que motivou estes testes: um passo extra de delta variável quando
 * o acumulador ainda não tinha completado um tick integrava o mesmo tempo duas
 * vezes, e o player andava ~1,5× mais rápido a 120 Hz.
 */

const FIXED_STEP_MS = 1000 / WORLD.fixedFps;
const MAX_STEPS_PER_FRAME = 5;

interface SimResult {
  distance: number;
  steps: number;
}

/** Simula `durationMs` de jogo entregues em frames de `frameMs`. */
function simulate(frameMs: number, durationMs: number, input: MovementInput): SimResult {
  const state = createPlayerState(PLAYER.maxHealth);
  const out = createMovementResult();
  state.grounded = true;
  state.wasGrounded = true;

  let accumulator = 0;
  let distance = 0;
  let steps = 0;

  for (let elapsed = 0; elapsed < durationMs; elapsed += frameMs) {
    accumulator += frameMs;
    let frameSteps = 0;
    while (accumulator >= FIXED_STEP_MS && frameSteps < MAX_STEPS_PER_FRAME) {
      stepMovement(state, input, FIXED_STEP_MS, out);
      // A integração da posição é do Arcade no jogo; aqui basta reproduzi-la.
      distance += (state.vx * FIXED_STEP_MS) / 1000;
      accumulator -= FIXED_STEP_MS;
      frameSteps++;
      steps++;
    }
  }

  return { distance, steps };
}

const RUN: MovementInput = {
  axisX: 1,
  jumpHeld: false,
  jumpPressed: false,
  crouchHeld: false,
  canStandUp: true,
};

/**
 * Tolerância: o resíduo legítimo é a sobra do acumulador no último frame,
 * limitada a um passo fixo. A 2 s de corrida isso vale ~0,8% da distância;
 * 3% cobre também o arredondamento do laço de frames do próprio teste.
 * O bug que estes testes existem para pegar produzia ~50% — folga de sobra
 * para distinguir os dois casos.
 */
const TOLERANCE = 0.03;

describe('passo fixo — independência de framerate', () => {
  it('percorre a mesma distância a 60 Hz e a 120 Hz', () => {
    const at60 = simulate(1000 / 60, 2000, RUN);
    const at120 = simulate(1000 / 120, 2000, RUN);

    expect(Math.abs(at120.distance - at60.distance) / at60.distance).toBeLessThan(TOLERANCE);
  });

  it('NÃO acelera a 120 Hz — a regressão específica que motivou o passo fixo', () => {
    const at60 = simulate(1000 / 60, 2000, RUN);
    const at120 = simulate(1000 / 120, 2000, RUN);

    // O bug antigo dava ~1,5×. Qualquer coisa acima de 1,1× é o mesmo defeito.
    expect(at120.distance / at60.distance).toBeLessThan(1.1);
  });

  it('percorre a mesma distância a 30 Hz (frames pesados)', () => {
    const at60 = simulate(1000 / 60, 2000, RUN);
    const at30 = simulate(1000 / 30, 2000, RUN);

    expect(Math.abs(at30.distance - at60.distance) / at60.distance).toBeLessThan(TOLERANCE);
  });

  it('executa praticamente o mesmo número de passos em qualquer ritmo de frames', () => {
    const at60 = simulate(1000 / 60, 1000, RUN);
    const at144 = simulate(1000 / 144, 1000, RUN);

    // Diferença aceitável: a sobra do acumulador, nunca mais que dois passos.
    expect(Math.abs(at144.steps - at60.steps)).toBeLessThanOrEqual(2);
  });

  it('um frame catastrófico não devolve mais passos que o teto', () => {
    const state = createPlayerState(PLAYER.maxHealth);
    const out = createMovementResult();
    state.grounded = true;

    let accumulator = 2000; // 2 s de atraso acumulado
    let steps = 0;
    while (accumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      stepMovement(state, RUN, FIXED_STEP_MS, out);
      accumulator -= FIXED_STEP_MS;
      steps++;
    }

    expect(steps).toBe(MAX_STEPS_PER_FRAME);
  });
});

describe('passo fixo — bordas de input', () => {
  /**
   * Um frame pode conter vários passos fixos. Se a borda de "pulou agora" não
   * for consumida, o mesmo toque é lido em cada passo.
   */
  it('um toque de pulo produz exatamente um pulo, mesmo com vários passos no frame', () => {
    const state = createPlayerState(PLAYER.maxHealth);
    const out = createMovementResult();
    state.grounded = true;
    state.wasGrounded = true;

    let jumps = 0;
    // Três passos no mesmo frame; só o primeiro enxerga a borda.
    for (let i = 0; i < 3; i++) {
      const input: MovementInput = {
        axisX: 0,
        jumpHeld: true,
        jumpPressed: i === 0,
        crouchHeld: false,
        canStandUp: true,
      };
      stepMovement(state, input, FIXED_STEP_MS, out);
      if (out.jumped) jumps++;
    }

    expect(jumps).toBe(1);
  });

  it('sem consumir a borda, o rearme ainda impede o pulo duplo no mesmo frame', () => {
    const state = createPlayerState(PLAYER.maxHealth);
    const out = createMovementResult();
    state.grounded = true;
    state.wasGrounded = true;

    let jumps = 0;
    for (let i = 0; i < 3; i++) {
      // Pior caso: a borda vaza para todos os passos.
      const input: MovementInput = {
        axisX: 0,
        jumpHeld: true,
        jumpPressed: true,
        crouchHeld: false,
        canStandUp: true,
      };
      stepMovement(state, input, FIXED_STEP_MS, out);
      if (out.jumped) jumps++;
      if (out.jumped) state.grounded = false;
    }

    expect(jumps).toBe(1);
  });
});
