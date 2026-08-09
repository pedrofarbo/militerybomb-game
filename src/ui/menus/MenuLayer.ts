/**
 * Menus em DOM: título, pausa e ajustes.
 *
 * Em DOM e não no canvas pelo mesmo motivo do HUD: são texto, precisam de foco
 * de teclado, de alvo de toque de verdade e de leitor de tela. Reimplementar
 * isso dentro do canvas é reescrever o que o browser já faz melhor.
 *
 * Navegação por TECLADO E GAMEPAD é requisito, não enfeite (plano §19): um run
 * & gun se joga com as duas mãos no controle, e obrigar a soltar tudo para
 * clicar num botão é o tipo de atrito que ninguém reporta como bug e todo
 * mundo sente.
 *
 * A tela de título tem uma segunda função, silenciosa: o clique em JOGAR é o
 * gesto que libera o contexto de áudio. Todo browser moderno exige um, e uma
 * tela de título é o lugar natural para colhê-lo.
 */

import type { GameEventBus } from '../../core/events/bus';
import type { SaveSettings } from '../../core/save/schema';

export type MenuScreen = 'title' | 'none' | 'pause' | 'settings';

export interface MenuCallbacks {
  onStart(): void;
  onResume(): void;
  onRestart(): void;
  onSettingsChanged(settings: SaveSettings): void;
}

interface Option {
  element: HTMLElement;
  onActivate?: () => void;
  onAdjust?: (direction: -1 | 1) => void;
}

const QUALITY_ORDER: SaveSettings['quality'][] = ['auto', 'high', 'medium', 'low'];
const QUALITY_LABEL: Record<SaveSettings['quality'], string> = {
  auto: 'AUTOMÁTICA',
  high: 'ALTA',
  medium: 'MÉDIA',
  low: 'BAIXA',
};

export class MenuLayer {
  readonly element: HTMLElement;
  private readonly panels: Record<Exclude<MenuScreen, 'none'>, HTMLElement>;
  private readonly settingsRows: (() => void)[] = [];
  private screen: MenuScreen = 'title';
  private options: Option[] = [];
  private focused = 0;
  /** Para onde AJUSTES volta: do título ou da pausa. */
  private settingsReturn: MenuScreen = 'title';

  constructor(
    parent: HTMLElement,
    private readonly bus: GameEventBus,
    private settings: SaveSettings,
    private readonly callbacks: MenuCallbacks,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'menu-layer';
    parent.appendChild(this.element);

    this.panels = {
      title: this.buildTitle(),
      pause: this.buildPause(),
      settings: this.buildSettings(),
    };
    for (const panel of Object.values(this.panels)) this.element.appendChild(panel);

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.show('title');
  }

  /* ──────────────────────────── Painéis ─────────────────────────── */

  private buildTitle(): HTMLElement {
    const panel = this.panel('menu--title');
    panel.innerHTML =
      '<h1 class="menu__logo">REDLINE</h1>' + '<p class="menu__tagline">Cais de Quarentena</p>';

    const list = document.createElement('div');
    list.className = 'menu__list';
    list.append(
      this.button('JOGAR', () => this.callbacks.onStart()),
      this.button('AJUSTES', () => this.openSettings('title')),
    );
    panel.appendChild(list);

    const hint = document.createElement('p');
    hint.className = 'menu__hint';
    hint.textContent = 'setas ou WASD navegam · Enter / Espaço confirma';
    panel.appendChild(hint);
    return panel;
  }

  private buildPause(): HTMLElement {
    const panel = this.panel('menu--pause');
    panel.innerHTML = '<h2 class="menu__title">PAUSA</h2>';

    const list = document.createElement('div');
    list.className = 'menu__list';
    list.append(
      this.button('CONTINUAR', () => this.callbacks.onResume()),
      this.button('AJUSTES', () => this.openSettings('pause')),
      this.button('RECOMEÇAR A FASE', () => this.callbacks.onRestart()),
    );
    panel.appendChild(list);
    return panel;
  }

  private buildSettings(): HTMLElement {
    const panel = this.panel('menu--settings');
    panel.innerHTML = '<h2 class="menu__title">AJUSTES</h2>';

    const list = document.createElement('div');
    list.className = 'menu__list';

    list.append(
      this.slider(
        'VOLUME GERAL',
        () => this.settings.volumes.master,
        (v) => {
          this.settings.volumes.master = v;
        },
      ),
      this.slider(
        'MÚSICA',
        () => this.settings.volumes.music,
        (v) => {
          this.settings.volumes.music = v;
        },
      ),
      this.slider(
        'EFEITOS',
        () => this.settings.volumes.sfx,
        (v) => {
          this.settings.volumes.sfx = v;
        },
      ),
      /* Intensidade do tremor é ACESSIBILIDADE, não preferência estética:
         screen shake é uma causa conhecida de enjoo, e zerá-lo precisa ser
         possível sem tirar nada do gameplay. */
      this.slider(
        'TREMOR DE CÂMERA',
        () => this.settings.shakeIntensity,
        (v) => {
          this.settings.shakeIntensity = v;
        },
      ),
      this.choice(
        'QUALIDADE',
        () => QUALITY_LABEL[this.settings.quality],
        (direction) => {
          const index = QUALITY_ORDER.indexOf(this.settings.quality);
          const next = (index + direction + QUALITY_ORDER.length) % QUALITY_ORDER.length;
          this.settings.quality = QUALITY_ORDER[next]!;
        },
      ),
      this.choice(
        'SOM',
        () => (this.settings.muted ? 'MUDO' : 'LIGADO'),
        () => {
          this.settings.muted = !this.settings.muted;
        },
      ),
      this.button('VOLTAR', () => this.show(this.settingsReturn)),
    );
    panel.appendChild(list);

    const hint = document.createElement('p');
    hint.className = 'menu__hint';
    hint.textContent = '← → ajustam o valor selecionado';
    panel.appendChild(hint);
    return panel;
  }

  /* ─────────────────────────── Construtores ─────────────────────── */

  private panel(modifier: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = `menu ${modifier}`;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    return panel;
  }

  private button(label: string, onActivate: () => void): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu__item';
    button.textContent = label;
    button.addEventListener('click', () => {
      this.focusElement(button);
      onActivate();
    });
    button.addEventListener('mouseenter', () => this.focusElement(button));
    return button;
  }

  /**
   * Linha de valor ajustável (0..1), em passos de 10%.
   *
   * Um `<input type=range>` seria menos código e é a coisa errada aqui: ele
   * captura as setas do teclado para si, e as setas são a navegação do menu.
   */
  private slider(label: string, get: () => number, set: (value: number) => void): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'menu__item menu__item--value';

    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'menu__value';
    row.append(name, value);

    const render = (): void => {
      const percent = Math.round(get() * 100);
      const filled = Math.round(get() * 10);
      value.textContent = `${'▮'.repeat(filled)}${'▯'.repeat(10 - filled)} ${percent}%`;
    };
    render();
    this.settingsRows.push(render);

    const adjust = (direction: -1 | 1): void => {
      set(Math.min(1, Math.max(0, Math.round((get() + direction * 0.1) * 10) / 10)));
      render();
      this.commitSettings();
    };
    row.dataset.adjustable = 'true';
    row.addEventListener('click', () => {
      this.focusElement(row);
      adjust(1);
    });
    row.addEventListener('mouseenter', () => this.focusElement(row));
    (row as HTMLElement & { __adjust?: (d: -1 | 1) => void }).__adjust = adjust;
    return row;
  }

  /** Linha de opção cíclica (qualidade, mudo). */
  private choice(
    label: string,
    get: () => string,
    cycle: (direction: -1 | 1) => void,
  ): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'menu__item menu__item--value';

    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'menu__value';
    row.append(name, value);

    const render = (): void => {
      value.textContent = get();
    };
    render();
    this.settingsRows.push(render);

    const adjust = (direction: -1 | 1): void => {
      cycle(direction);
      render();
      this.commitSettings();
    };
    row.dataset.adjustable = 'true';
    row.addEventListener('click', () => {
      this.focusElement(row);
      adjust(1);
    });
    row.addEventListener('mouseenter', () => this.focusElement(row));
    (row as HTMLElement & { __adjust?: (d: -1 | 1) => void }).__adjust = adjust;
    return row;
  }

  /* ──────────────────────────── Navegação ───────────────────────── */

  show(screen: MenuScreen): void {
    this.screen = screen;
    for (const [key, panel] of Object.entries(this.panels)) {
      panel.hidden = key !== screen;
    }
    this.element.classList.toggle('is-open', screen !== 'none');

    if (screen === 'none') {
      this.options = [];
      return;
    }
    if (screen === 'settings') for (const render of this.settingsRows) render();

    const panel = this.panels[screen];
    this.options = [...panel.querySelectorAll<HTMLElement>('.menu__item')].map((element) => ({
      element,
      onAdjust: (element as HTMLElement & { __adjust?: (d: -1 | 1) => void }).__adjust,
    }));
    this.focused = 0;
    this.applyFocus();
  }

  get current(): MenuScreen {
    return this.screen;
  }

  get isOpen(): boolean {
    return this.screen !== 'none';
  }

  updateSettings(settings: SaveSettings): void {
    this.settings = settings;
    for (const render of this.settingsRows) render();
  }

  private openSettings(from: MenuScreen): void {
    this.settingsReturn = from;
    this.show('settings');
  }

  private commitSettings(): void {
    this.callbacks.onSettingsChanged(this.settings);
    this.bus.emit('quality:changed', {
      level: this.settings.quality === 'auto' ? 'high' : this.settings.quality,
    });
  }

  private focusElement(element: HTMLElement): void {
    const index = this.options.findIndex((option) => option.element === element);
    if (index < 0) return;
    this.focused = index;
    this.applyFocus();
  }

  private applyFocus(): void {
    this.options.forEach((option, index) => {
      option.element.classList.toggle('is-focused', index === this.focused);
    });
    this.options[this.focused]?.element.focus({ preventScroll: true });
  }

  private move(delta: number): void {
    if (this.options.length === 0) return;
    this.focused = (this.focused + delta + this.options.length) % this.options.length;
    this.applyFocus();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.move(-1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.move(1);
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.options[this.focused]?.onAdjust?.(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.options[this.focused]?.onAdjust?.(1);
        break;
      case 'Enter':
      case 'Space':
      case 'KeyK':
        this.options[this.focused]?.element.click();
        break;
      case 'Escape':
        if (this.screen === 'settings') this.show(this.settingsReturn);
        else if (this.screen === 'pause') this.callbacks.onResume();
        else return;
        break;
      default:
        return;
    }
    /* Enquanto um menu está aberto, as teclas são DELE. Sem isto, navegar no
       menu de pausa também faz o personagem andar e atirar por baixo. */
    event.preventDefault();
    event.stopPropagation();
  }
}
