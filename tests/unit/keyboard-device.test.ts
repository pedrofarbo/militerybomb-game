import { describe, expect, it } from 'vitest';
import { Action } from '../../src/core/input/actions';
import { KeyboardDevice } from '../../src/game/input/devices';

/**
 * `KeyboardDevice` vive em `src/game`, mas não importa Phaser nem toca no
 * canvas — só escuta eventos. Isso o torna testável em Node com um alvo de
 * eventos falso, e vale a pena: é a porta de entrada de todo comando do jogo.
 */

type Listener = (event: unknown) => void;

class FakeWindow {
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, fn: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }

  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  keyDown(code: string, repeat = false): void {
    this.emit('keydown', { code, repeat, preventDefault: () => {} });
  }

  keyUp(code: string): void {
    this.emit('keyup', { code, preventDefault: () => {} });
  }

  blur(): void {
    this.emit('blur', {});
  }

  private emit(type: string, event: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

function createDevice(): { win: FakeWindow; device: KeyboardDevice } {
  const win = new FakeWindow();
  const device = new KeyboardDevice(win as unknown as Window);
  return { win, device };
}

describe('teclado — leitura básica', () => {
  it('reporta a ação enquanto a tecla está segurada', () => {
    const { win, device } = createDevice();

    win.keyDown('Space');
    expect(device.poll().buttons.has(Action.Jump)).toBe(true);
    expect(device.poll().buttons.has(Action.Jump)).toBe(true);

    win.keyUp('Space');
    expect(device.poll().buttons.has(Action.Jump)).toBe(false);
  });

  it('derivar o eixo a partir das teclas de direção', () => {
    const { win, device } = createDevice();

    win.keyDown('KeyD');
    expect(device.poll().axisX).toBe(1);

    win.keyDown('KeyA');
    // Esquerda e direita juntas se cancelam.
    expect(device.poll().axisX).toBe(0);
  });

  it('perder o foco solta todas as teclas', () => {
    const { win, device } = createDevice();

    win.keyDown('KeyD');
    win.keyDown('Space');
    win.blur();

    const raw = device.poll();
    expect(raw.buttons.size).toBe(0);
  });
});

describe('teclado — toques curtos', () => {
  /**
   * Regressão: um toque que começa E termina entre dois frames desaparecia por
   * completo. Acontece com quem dá tapas rápidos no botão e em qualquer frame
   * que demore mais que o normal — o comando simplesmente não acontecia.
   */
  it('um toque inteiro entre dois polls não é perdido', () => {
    const { win, device } = createDevice();

    win.keyDown('Space');
    win.keyUp('Space');

    expect(device.poll().buttons.has(Action.Jump)).toBe(true);
  });

  it('o toque curto vale por exatamente um poll', () => {
    const { win, device } = createDevice();

    win.keyDown('Space');
    win.keyUp('Space');

    expect(device.poll().buttons.has(Action.Jump)).toBe(true);
    expect(device.poll().buttons.has(Action.Jump)).toBe(false);
  });

  it('uma tecla ainda segurada continua ativa depois do poll do toque', () => {
    const { win, device } = createDevice();

    win.keyDown('Space');
    expect(device.poll().buttons.has(Action.Jump)).toBe(true);
    expect(device.poll().buttons.has(Action.Jump)).toBe(true);
  });

  it('auto-repeat do sistema não conta como toque novo', () => {
    const { win, device } = createDevice();

    win.keyDown('Space');
    device.poll();
    win.keyDown('Space', true); // repeat do SO
    win.keyUp('Space');

    // Só o keydown real latcha; o repeat não pode ressuscitar a ação.
    expect(device.poll().buttons.has(Action.Jump)).toBe(false);
  });

  it('dois toques em frames diferentes produzem duas leituras', () => {
    const { win, device } = createDevice();

    win.keyDown('KeyJ');
    win.keyUp('KeyJ');
    expect(device.poll().buttons.has(Action.Shoot)).toBe(true);

    win.keyDown('KeyJ');
    win.keyUp('KeyJ');
    expect(device.poll().buttons.has(Action.Shoot)).toBe(true);
  });
});
