import { describe, expect, it } from 'vitest';
import { Action, createRawInput, resetRawInput } from '../../src/core/input/actions';
import {
  DEFAULT_KEYBOARD,
  applyAnalogAxes,
  deriveAxesFromActions,
  mapCodesToActions,
} from '../../src/core/input/bindings';
import { InputState } from '../../src/core/input/snapshot';
import { resolveAim } from '../../src/core/player/aim';

describe('mapeamento de input', () => {
  it('traduz códigos de tecla para ações', () => {
    const raw = mapCodesToActions(new Set(['KeyA', 'Space']), DEFAULT_KEYBOARD, createRawInput());
    expect(raw.buttons.has(Action.MoveLeft)).toBe(true);
    expect(raw.buttons.has(Action.Jump)).toBe(true);
    expect(raw.buttons.has(Action.Shoot)).toBe(false);
  });

  it('aceita teclas alternativas para a mesma ação', () => {
    const raw = mapCodesToActions(new Set(['ArrowRight']), DEFAULT_KEYBOARD, createRawInput());
    expect(raw.buttons.has(Action.MoveRight)).toBe(true);
  });

  it('esquerda + direita se cancelam em vez de escolher um lado', () => {
    const raw = createRawInput();
    raw.buttons.add(Action.MoveLeft);
    raw.buttons.add(Action.MoveRight);
    deriveAxesFromActions(raw);
    expect(raw.axisX).toBe(0);
  });

  it('aplica zona morta e renormaliza o eixo analógico', () => {
    const small = applyAnalogAxes(0.2, 0, createRawInput());
    expect(small.axisX).toBe(0);

    const big = applyAnalogAxes(1, 0, createRawInput());
    expect(big.axisX).toBeCloseTo(1, 5);
    expect(big.buttons.has(Action.MoveRight)).toBe(true);
  });
});

describe('snapshot de input', () => {
  it('detecta bordas de subida e de descida', () => {
    const state = new InputState();
    const raw = createRawInput();
    const frame = [{ id: 'keyboard' as const, raw }];

    raw.buttons.add(Action.Shoot);
    state.update(frame, 16);
    expect(state.justPressed(Action.Shoot)).toBe(true);
    expect(state.held(Action.Shoot)).toBe(true);

    state.update(frame, 16);
    expect(state.justPressed(Action.Shoot)).toBe(false);
    expect(state.held(Action.Shoot)).toBe(true);

    resetRawInput(raw);
    state.update(frame, 16);
    expect(state.justReleased(Action.Shoot)).toBe(true);
  });

  it('acumula o tempo de ação segurada (pulo variável depende disso)', () => {
    const state = new InputState();
    const raw = createRawInput();
    raw.buttons.add(Action.Jump);
    const frame = [{ id: 'keyboard' as const, raw }];

    state.update(frame, 16);
    state.update(frame, 16);
    expect(state.heldMs(Action.Jump)).toBe(32);

    resetRawInput(raw);
    state.update(frame, 16);
    expect(state.heldMs(Action.Jump)).toBe(0);
  });

  it('funde devices por OR — teclado e gamepad ao mesmo tempo', () => {
    const state = new InputState();
    const keyboard = createRawInput();
    const gamepad = createRawInput();
    keyboard.buttons.add(Action.MoveRight);
    gamepad.buttons.add(Action.Shoot);
    gamepad.axisX = 0.8;
    gamepad.active = true;

    state.update(
      [
        { id: 'keyboard', raw: keyboard },
        { id: 'gamepad', raw: gamepad },
      ],
      16,
    );

    expect(state.held(Action.MoveRight)).toBe(true);
    expect(state.held(Action.Shoot)).toBe(true);
    expect(state.axisX).toBeCloseTo(0.8);
    expect(state.lastDevice).toBe('gamepad');
  });
});

describe('mira em 8 direções', () => {
  it('mira reto por padrão, na direção da face', () => {
    expect(resolveAim(0, 0, 1, true).direction).toBe('fwd');
    expect(resolveAim(0, 0, 1, true).angleRad).toBe(0);
    expect(resolveAim(0, 0, -1, true).angleRad).toBeCloseTo(Math.PI);
  });

  it('mira para cima e na diagonal', () => {
    expect(resolveAim(0, -1, 1, true).direction).toBe('up');
    expect(resolveAim(0.8, -0.6, 1, true).direction).toBe('up45');
  });

  it('não deixa mirar para baixo no chão (input desperdiçado)', () => {
    expect(resolveAim(0, 1, 1, true).direction).toBe('fwd');
    expect(resolveAim(0, 1, 1, false).direction).toBe('down');
  });

  it('espelha a diagonal ao virar para a esquerda', () => {
    const right = resolveAim(0.8, -0.6, 1, true).angleRad;
    const left = resolveAim(-0.8, -0.6, -1, true).angleRad;
    expect(Math.cos(right)).toBeGreaterThan(0);
    expect(Math.cos(left)).toBeLessThan(0);
  });
});
