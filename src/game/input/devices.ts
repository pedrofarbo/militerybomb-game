/**
 * Devices de entrada. Cada um só sabe ler o próprio hardware e devolver um
 * `RawInput`; nenhum deles conhece o gameplay.
 */

import {
  Action,
  createRawInput,
  resetRawInput,
  type DeviceId,
  type RawInput,
} from '../../core/input/actions';
import {
  applyAnalogAxes,
  DEFAULT_GAMEPAD,
  DEFAULT_KEYBOARD,
  deriveAxesFromActions,
  mapCodesToActions,
  type BindingProfile,
} from '../../core/input/bindings';

export interface InputDevice {
  readonly id: DeviceId;
  poll(nowMs: number): RawInput;
  destroy(): void;
}

/* ─────────────────────────── Teclado ─────────────────────────── */

export class KeyboardDevice implements InputDevice {
  readonly id = 'keyboard' as const;
  private readonly pressed = new Set<string>();
  /**
   * Teclas que foram pressionadas desde o último `poll`, mesmo que já tenham
   * sido soltas. Sem isto, um toque curto que começa e termina entre dois
   * frames desaparece por completo — o jogo simplesmente ignora o comando.
   * Acontece com jogadores que dão tapas rápidos no botão e em qualquer frame
   * que demore mais que o normal.
   */
  private readonly tapped = new Set<string>();
  private readonly raw = createRawInput();
  private profile: BindingProfile;

  constructor(
    private readonly target: Window,
    profile: BindingProfile = DEFAULT_KEYBOARD,
  ) {
    this.profile = profile;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    // Alt-tab com uma tecla segurada deixaria a ação presa para sempre.
    target.addEventListener('blur', this.onBlur);
  }

  setProfile(profile: BindingProfile): void {
    this.profile = profile;
  }

  poll(): RawInput {
    resetRawInput(this.raw);
    // União das teclas seguradas com as tocadas desde o último poll.
    for (const code of this.tapped) this.pressed.add(code);
    mapCodesToActions(this.pressed, this.profile, this.raw);
    deriveAxesFromActions(this.raw);
    // Remove as que já haviam sido soltas: valem por exatamente um frame.
    for (const code of this.tapped) if (!this.held.has(code)) this.pressed.delete(code);
    this.tapped.clear();
    return this.raw;
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  /** Teclas fisicamente seguradas agora. */
  private readonly held = new Set<string>();

  private readonly onDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressed.add(e.code);
    this.tapped.add(e.code);
    // Espaço e setas rolam a página por baixo do jogo se não bloquear.
    if (SWALLOWED.has(e.code)) e.preventDefault();
  };

  private readonly onUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
    // A remoção de `pressed` fica a cargo do `poll`: se a tecla foi tocada
    // neste mesmo intervalo, ela ainda precisa ser lida uma vez.
    if (!this.tapped.has(e.code)) this.pressed.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.pressed.clear();
    this.held.clear();
    this.tapped.clear();
  };
}

const SWALLOWED = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'F5',
]);

/* ─────────────────────────── Gamepad ─────────────────────────── */

export class GamepadDevice implements InputDevice {
  readonly id = 'gamepad' as const;
  private readonly raw = createRawInput();
  private readonly pressed = new Set<string>();

  constructor(private readonly nav: Navigator) {}

  poll(): RawInput {
    resetRawInput(this.raw);
    this.pressed.clear();

    const pads = this.nav.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad?.connected) continue;
      pad.buttons.forEach((btn, index) => {
        if (btn.pressed || btn.value > 0.5) this.pressed.add(String(index));
      });
      mapCodesToActions(this.pressed, DEFAULT_GAMEPAD, this.raw);
      deriveAxesFromActions(this.raw);
      applyAnalogAxes(pad.axes[0] ?? 0, pad.axes[1] ?? 0, this.raw);
      // Um controle por vez: fundir dois pads faria eles brigarem pelo eixo.
      break;
    }
    return this.raw;
  }

  destroy(): void {
    /* nada a limpar: leitura por polling */
  }
}

/* ──────────────────────────── Touch ───────────────────────────── */

/**
 * Estado publicado pelos widgets DOM (`src/ui/touch`). O device só lê — os
 * controles touch vivem no DOM porque é lá que multitouch, `pointercancel` e
 * `env(safe-area-inset-*)` funcionam de verdade.
 */
export interface TouchInputSource {
  axisX: number;
  axisY: number;
  readonly buttons: Set<Action>;
  /**
   * Ações tocadas desde o último `poll`, mesmo que já soltas. Mesmo motivo do
   * teclado: um tapa rápido no botão não pode sumir entre dois frames.
   */
  readonly tapped: Set<Action>;
}

export function createTouchInputSource(): TouchInputSource {
  return { axisX: 0, axisY: 0, buttons: new Set<Action>(), tapped: new Set<Action>() };
}

export class TouchDevice implements InputDevice {
  readonly id = 'touch' as const;
  private readonly raw = createRawInput();

  constructor(private readonly source: TouchInputSource) {}

  poll(): RawInput {
    resetRawInput(this.raw);
    this.raw.axisX = this.source.axisX;
    this.raw.axisY = this.source.axisY;
    for (const a of this.source.buttons) this.raw.buttons.add(a);
    for (const a of this.source.tapped) this.raw.buttons.add(a);
    this.source.tapped.clear();
    this.raw.active = this.raw.buttons.size > 0 || this.raw.axisX !== 0 || this.raw.axisY !== 0;
    // Direcionais derivadas do stick: a mira em 8 direções precisa delas.
    if (this.raw.axisX > 0.35) this.raw.buttons.add(Action.MoveRight);
    if (this.raw.axisX < -0.35) this.raw.buttons.add(Action.MoveLeft);
    if (this.raw.axisY < -0.4) this.raw.buttons.add(Action.AimUp);
    if (this.raw.axisY > 0.4) this.raw.buttons.add(Action.AimDown);
    return this.raw;
  }

  destroy(): void {
    /* o dono dos widgets DOM cuida da limpeza */
  }
}

/* ──────────────────────────── Replay ──────────────────────────── */

export interface ReplayFrame {
  readonly frame: number;
  readonly axisX: number;
  readonly axisY: number;
  readonly buttons: readonly Action[];
}

/**
 * Input scriptado. Com passo fixo e RNG semeado, torna uma partida inteira
 * reprodutível — é o que sustenta os testes E2E e a caça a bugs que só
 * acontecem "às vezes".
 */
export class ReplayDevice implements InputDevice {
  readonly id = 'replay' as const;
  private readonly raw = createRawInput();
  private frameIndex = 0;
  private cursor = 0;

  constructor(private readonly frames: readonly ReplayFrame[]) {}

  poll(): RawInput {
    resetRawInput(this.raw);
    while (
      this.cursor + 1 < this.frames.length &&
      this.frames[this.cursor + 1]!.frame <= this.frameIndex
    ) {
      this.cursor++;
    }
    const f = this.frames[this.cursor];
    if (f && f.frame <= this.frameIndex) {
      this.raw.axisX = f.axisX;
      this.raw.axisY = f.axisY;
      for (const a of f.buttons) this.raw.buttons.add(a);
      this.raw.active = true;
    }
    this.frameIndex++;
    return this.raw;
  }

  get finished(): boolean {
    const last = this.frames[this.frames.length - 1];
    return last === undefined || this.frameIndex > last.frame;
  }

  destroy(): void {
    /* nada */
  }
}
