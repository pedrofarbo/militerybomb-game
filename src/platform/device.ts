/** Detecção de plataforma. Um único lugar responde "é touch?" e afins. */

export interface DeviceInfo {
  readonly hasTouch: boolean;
  readonly hasFinePointer: boolean;
  readonly devicePixelRatio: number;
}

export function detectDevice(win: Window = window): DeviceInfo {
  const hasTouch = 'ontouchstart' in win || (win.navigator.maxTouchPoints ?? 0) > 0;
  const hasFinePointer = win.matchMedia?.('(pointer: fine)').matches ?? true;
  return {
    hasTouch,
    hasFinePointer,
    // Limitado a 2: acima disso o custo de pixels cresce sem ganho visível
    // em pixel art.
    devicePixelRatio: Math.min(win.devicePixelRatio || 1, 2),
  };
}

/** Armazenamento pode lançar (Safari privado, iframe restrito). */
export function safeLocalStorage(win: Window = window): Storage | null {
  try {
    const probe = '__redline_probe__';
    win.localStorage.setItem(probe, '1');
    win.localStorage.removeItem(probe);
    return win.localStorage;
  } catch {
    return null;
  }
}
