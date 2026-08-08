/**
 * Camada de debug isolada.
 *
 * Nenhum `if (debug)` espalhado pelo gameplay: sistemas registram um painel e
 * seguem a vida. Em produção o bundle inteiro sai por dead-code elimination.
 */

export type DebugPanel = () => string;

export class DebugService {
  private readonly panels = new Map<string, DebugPanel>();
  private readonly element: HTMLElement;
  private visible = false;
  private accumulatorMs = 0;

  constructor(
    root: HTMLElement,
    /** Começa ligado com `?debug=1`. */
    startVisible: boolean,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'debug-overlay';
    this.element.setAttribute('aria-hidden', 'true');
    root.appendChild(this.element);
    this.setVisible(startVisible);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.setVisible(!this.visible);
    });
  }

  register(name: string, panel: DebugPanel): void {
    this.panels.set(name, panel);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.style.display = visible ? 'block' : 'none';
  }

  get enabled(): boolean {
    return this.visible;
  }

  update(dtMs: number): void {
    if (!this.visible) return;
    // 6 Hz: atualizar texto a 60 Hz custa mais que o jogo em celular fraco.
    this.accumulatorMs += dtMs;
    if (this.accumulatorMs < 160) return;
    this.accumulatorMs = 0;

    let out = '';
    for (const [name, panel] of this.panels) out += `[${name}]\n${panel()}\n\n`;
    this.element.textContent = out.trimEnd();
  }
}
