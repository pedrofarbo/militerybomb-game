/**
 * Perfis de mapeamento e a tradução crua → ações.
 *
 * As funções aqui são puras: recebem um conjunto de códigos pressionados e
 * devolvem ações. É o que permite testar remapeamento sem abrir um browser.
 */

import { Action, type RawInput } from './actions';
import { applyDeadzone } from '../math';

/** Uma ação pode ter várias teclas; várias ações podem compartilhar uma tecla. */
export type BindingProfile = Readonly<Record<Action, readonly string[]>>;

/** `event.code` do KeyboardEvent — layout-independente (funciona em ABNT2). */
export const DEFAULT_KEYBOARD: BindingProfile = {
  [Action.MoveLeft]: ['KeyA', 'ArrowLeft'],
  [Action.MoveRight]: ['KeyD', 'ArrowRight'],
  [Action.AimUp]: ['KeyW', 'ArrowUp'],
  [Action.AimDown]: ['KeyS', 'ArrowDown'],
  [Action.Jump]: ['Space', 'KeyK'],
  [Action.Shoot]: ['KeyJ', 'ControlLeft'],
  [Action.Grenade]: ['KeyL', 'ShiftLeft'],
  [Action.Special]: ['KeyU'],
  [Action.SwitchWeapon]: ['KeyQ', 'Tab'],
  [Action.Pause]: ['Escape', 'KeyP'],
  [Action.Confirm]: ['Enter', 'Space'],
  [Action.Cancel]: ['Escape', 'Backspace'],
};

/** Índices do Gamepad API (layout padrão). */
export const DEFAULT_GAMEPAD: BindingProfile = {
  [Action.MoveLeft]: ['14'], // D-pad esquerda
  [Action.MoveRight]: ['15'],
  [Action.AimUp]: ['12'],
  [Action.AimDown]: ['13'],
  [Action.Jump]: ['0'], // A / cruz
  [Action.Shoot]: ['2', '7'], // X / quadrado, RT
  [Action.Grenade]: ['1', '5'], // B / círculo, RB
  [Action.Special]: ['3'],
  [Action.SwitchWeapon]: ['4'],
  [Action.Pause]: ['9'],
  [Action.Confirm]: ['0'],
  [Action.Cancel]: ['1'],
};

export const GAMEPAD_DEADZONE = 0.25;

/** Traduz o conjunto de códigos ativos em ações, dentro do `raw` fornecido. */
export function mapCodesToActions(
  active: ReadonlySet<string>,
  profile: BindingProfile,
  raw: RawInput,
): RawInput {
  for (const action of Object.keys(profile) as Action[]) {
    const codes = profile[action];
    for (const code of codes) {
      if (active.has(code)) {
        raw.buttons.add(action);
        raw.active = true;
        break;
      }
    }
  }
  return raw;
}

/**
 * Deriva os eixos a partir das ações direcionais.
 * Esquerda e direita pressionadas juntas se cancelam — sem isso o personagem
 * escolhe uma direção arbitrária e parece travado.
 */
export function deriveAxesFromActions(raw: RawInput): RawInput {
  const left = raw.buttons.has(Action.MoveLeft) ? 1 : 0;
  const right = raw.buttons.has(Action.MoveRight) ? 1 : 0;
  const up = raw.buttons.has(Action.AimUp) ? 1 : 0;
  const down = raw.buttons.has(Action.AimDown) ? 1 : 0;
  if (left || right) raw.axisX = right - left;
  if (up || down) raw.axisY = down - up;
  return raw;
}

/** Eixo analógico → eixo + ações direcionais equivalentes. */
export function applyAnalogAxes(x: number, y: number, raw: RawInput): RawInput {
  const ax = applyDeadzone(x, GAMEPAD_DEADZONE);
  const ay = applyDeadzone(y, GAMEPAD_DEADZONE);
  if (ax !== 0) {
    raw.axisX = ax;
    raw.buttons.add(ax > 0 ? Action.MoveRight : Action.MoveLeft);
    raw.active = true;
  }
  if (ay !== 0) {
    raw.axisY = ay;
    raw.buttons.add(ay > 0 ? Action.AimDown : Action.AimUp);
    raw.active = true;
  }
  return raw;
}
