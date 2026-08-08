/**
 * Ações abstratas. O gameplay NUNCA pergunta "a tecla A está pressionada?" —
 * pergunta "MOVE_LEFT está ativa?". É isso que faz teclado, gamepad e touch
 * compartilharem 100% do código de jogo.
 */

export const Action = {
  MoveLeft: 'MOVE_LEFT',
  MoveRight: 'MOVE_RIGHT',
  AimUp: 'AIM_UP',
  AimDown: 'AIM_DOWN',
  Jump: 'JUMP',
  Shoot: 'SHOOT',
  Grenade: 'GRENADE',
  Special: 'SPECIAL',
  SwitchWeapon: 'SWITCH_WEAPON',
  Pause: 'PAUSE',
  Confirm: 'CONFIRM',
  Cancel: 'CANCEL',
} as const;

export type Action = (typeof Action)[keyof typeof Action];

export const ALL_ACTIONS: readonly Action[] = Object.values(Action);

export type DeviceId = 'keyboard' | 'gamepad' | 'touch' | 'replay';

/** Uma leitura crua de um device num frame. Sem histórico, sem bordas. */
export interface RawInput {
  axisX: number;
  axisY: number;
  /** Ações ativas neste frame. */
  buttons: Set<Action>;
  /** Houve qualquer atividade? Usado para detectar troca de device. */
  active: boolean;
}

export function createRawInput(): RawInput {
  return { axisX: 0, axisY: 0, buttons: new Set(), active: false };
}

export function resetRawInput(raw: RawInput): void {
  raw.axisX = 0;
  raw.axisY = 0;
  raw.buttons.clear();
  raw.active = false;
}
