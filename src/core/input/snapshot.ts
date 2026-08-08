/**
 * Fusão de devices → snapshot de ações do frame.
 *
 * Puro e sem alocação no caminho quente: o snapshot é um objeto reutilizado,
 * e a detecção de bordas compara com o frame anterior por índice.
 */

import { ALL_ACTIONS, type Action, type DeviceId, type RawInput } from './actions';
import { clamp } from '../math';

export interface InputSnapshot {
  readonly axisX: number;
  readonly axisY: number;
  readonly lastDevice: DeviceId | null;
  held(a: Action): boolean;
  justPressed(a: Action): boolean;
  justReleased(a: Action): boolean;
  /** Há quanto tempo a ação está segurada (0 se solta). Pulo variável usa isto. */
  heldMs(a: Action): number;
}

export class InputState implements InputSnapshot {
  axisX = 0;
  axisY = 0;
  lastDevice: DeviceId | null = null;

  private readonly current = new Map<Action, boolean>();
  private readonly previous = new Map<Action, boolean>();
  private readonly duration = new Map<Action, number>();

  constructor() {
    for (const a of ALL_ACTIONS) {
      this.current.set(a, false);
      this.previous.set(a, false);
      this.duration.set(a, 0);
    }
  }

  /**
   * Funde as leituras cruas do frame. OR entre devices: teclado e gamepad
   * simultâneos funcionam, que é o comportamento que as pessoas esperam.
   */
  update(raws: readonly { id: DeviceId; raw: RawInput }[], dtMs: number): void {
    for (const a of ALL_ACTIONS) {
      this.previous.set(a, this.current.get(a) ?? false);
      this.current.set(a, false);
    }

    let axisX = 0;
    let axisY = 0;
    for (const { id, raw } of raws) {
      if (Math.abs(raw.axisX) > Math.abs(axisX)) axisX = raw.axisX;
      if (Math.abs(raw.axisY) > Math.abs(axisY)) axisY = raw.axisY;
      for (const a of raw.buttons) this.current.set(a, true);
      if (raw.active) this.lastDevice = id;
    }

    this.axisX = clamp(axisX, -1, 1);
    this.axisY = clamp(axisY, -1, 1);

    for (const a of ALL_ACTIONS) {
      if (this.current.get(a)) this.duration.set(a, (this.duration.get(a) ?? 0) + dtMs);
      else this.duration.set(a, 0);
    }
  }

  /**
   * Consome as bordas do frame.
   *
   * Um frame pode conter mais de um passo fixo de simulação. Sem isto,
   * `justPressed` continuaria verdadeiro no segundo passo e um único toque
   * seria contado duas vezes — o tipo de bug que só aparece quando o
   * framerate cai e a reprodução fica impossível.
   */
  consumeEdges(): void {
    for (const a of ALL_ACTIONS) this.previous.set(a, this.current.get(a) ?? false);
  }

  held(a: Action): boolean {
    return this.current.get(a) === true;
  }

  justPressed(a: Action): boolean {
    return this.current.get(a) === true && this.previous.get(a) !== true;
  }

  justReleased(a: Action): boolean {
    return this.current.get(a) !== true && this.previous.get(a) === true;
  }

  heldMs(a: Action): number {
    return this.duration.get(a) ?? 0;
  }
}
