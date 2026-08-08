/**
 * Funde todos os devices num único snapshot de ações por frame.
 * É o único ponto do jogo que sabe que existe hardware.
 */

import { InputState, type InputSnapshot } from '../../core/input/snapshot';
import type { DeviceId, RawInput } from '../../core/input/actions';
import type { InputDevice } from './devices';

export class InputManager {
  private readonly devices: InputDevice[] = [];
  private readonly state = new InputState();
  private readonly buffer: { id: DeviceId; raw: RawInput }[] = [];

  add(device: InputDevice): this {
    this.devices.push(device);
    this.buffer.push({ id: device.id, raw: device.poll(0) });
    return this;
  }

  get snapshot(): InputSnapshot {
    return this.state;
  }

  update(nowMs: number, dtMs: number): void {
    for (let i = 0; i < this.devices.length; i++) {
      const device = this.devices[i]!;
      this.buffer[i] = { id: device.id, raw: device.poll(nowMs) };
    }
    this.state.update(this.buffer, dtMs);
  }

  destroy(): void {
    for (const d of this.devices) d.destroy();
    this.devices.length = 0;
    this.buffer.length = 0;
  }
}
