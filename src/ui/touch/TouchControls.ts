/**
 * Controles touch em DOM (não em objetos Phaser).
 *
 * Por quê DOM: multitouch com `setPointerCapture` funciona de verdade,
 * `env(safe-area-inset-*)` só existe em CSS, e o controle continua respondendo
 * mesmo com o canvas pausado. Cada widget rastreia o próprio `pointerId`, então
 * segurar o tiro enquanto se move e pula é o caso normal, não um caso especial.
 *
 * A INVARIANTE QUE SUSTENTA TUDO:
 *
 *     nenhum dedo na tela  ⇒  nenhum input de toque segurado
 *
 * Ela existe porque a versão anterior dependia de o `pointerup` chegar ao
 * ELEMENTO certo. Quando o browser rouba o ponteiro — gesto do sistema, troca
 * de app, barra de endereço aparecendo — esse evento se perde, e o resultado
 * era o pior tipo de bug: o direcional ficava preso, o personagem andava
 * sozinho, e NENHUM toque novo recuperava, porque o `pointerId` velho ainda
 * ocupava o stick. Agora o conjunto de ponteiros vivos é rastreado na `window`
 * e, quando ele esvazia, tudo é solto — não importa por onde o evento passou.
 */

import { Action } from '../../core/input/actions';
import type { TouchInputSource } from '../../game/input/devices';

const STICK_RADIUS = 56;
const STICK_DEADZONE = 0.18;

/**
 * Captura o ponteiro sem deixar a falha derrubar o handler. A captura é um
 * reforço (ajuda os eventos a chegarem), nunca um pré-requisito: os handlers
 * de fim vivem na `window` justamente para não depender dela.
 */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    /* o controle continua funcionando sem captura */
  }
}

interface ButtonSpec {
  action: Action;
  label: string;
  className: string;
}

const BUTTONS: readonly ButtonSpec[] = [
  { action: Action.Jump, label: 'PULO', className: 'jump' },
  { action: Action.Shoot, label: 'TIRO', className: 'shoot' },
  { action: Action.Grenade, label: 'GRAN', className: 'grenade' },
  { action: Action.Special, label: 'ESP', className: 'special' },
];

interface TouchButton {
  spec: ButtonSpec;
  element: HTMLElement;
  /** Ponteiro que está segurando este botão, ou `null`. */
  pointerId: number | null;
}

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly stickZone: HTMLElement;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private readonly buttons: TouchButton[] = [];

  /** Ponteiros que o browser diz estarem na tela AGORA. */
  private readonly livePointers = new Set<number>();

  private stickPointerId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;

  constructor(
    parent: HTMLElement,
    private readonly source: TouchInputSource,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    this.root.hidden = true;

    this.stickZone = document.createElement('div');
    this.stickZone.className = 'touch-stick-zone';
    this.stickBase = document.createElement('div');
    this.stickBase.className = 'touch-stick-base';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'touch-stick-knob';
    this.stickBase.appendChild(this.stickKnob);
    this.stickZone.appendChild(this.stickBase);
    this.root.appendChild(this.stickZone);

    const buttonZone = document.createElement('div');
    buttonZone.className = 'touch-button-zone';
    for (const spec of BUTTONS) buttonZone.appendChild(this.createButton(spec));
    this.root.appendChild(buttonZone);

    parent.appendChild(this.root);
    this.bindStick();
    this.bindGlobalPointerTracking();
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) this.releaseAll();
  }

  /* ─────────────────── Rastreio global de ponteiros ──────────────── */

  /**
   * A rede de segurança. Escuta na `window`, na fase de CAPTURA, para ver
   * todo ponteiro que nasce e morre — inclusive os que o jogo nunca tocou.
   *
   * Fim de ponteiro na `window`, e não no elemento: um `pointerup` só chega ao
   * elemento se a captura tiver funcionado, e é exatamente quando ela falha que
   * o controle travava.
   */
  private bindGlobalPointerTracking(): void {
    window.addEventListener('pointerdown', (e) => this.livePointers.add(e.pointerId), {
      capture: true,
    });

    const forget = (e: PointerEvent): void => {
      this.livePointers.delete(e.pointerId);
      this.endStick(e.pointerId);
      this.releaseButtonsOf(e.pointerId);
      // Tela sem nenhum dedo NÃO pode ter comando segurado. É esta linha que
      // torna o travamento irrecuperável impossível.
      if (this.livePointers.size === 0) this.releaseAll();
    };
    window.addEventListener('pointerup', forget, { capture: true });
    window.addEventListener('pointercancel', forget, { capture: true });

    /* Sair do jogo com o dedo na tela (trocar de app, atender uma ligação,
       bloquear o aparelho) nunca entrega o `pointerup`. Voltar com o
       personagem andando sozinho é o mesmo bug por outra porta. */
    const panic = (): void => {
      this.livePointers.clear();
      this.releaseAll();
    };
    window.addEventListener('blur', panic);
    window.addEventListener('pagehide', panic);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) panic();
    });
  }

  /* ──────────────────────────── Botões ──────────────────────────── */

  private createButton(spec: ButtonSpec): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `touch-btn touch-btn--${spec.className}`;
    el.textContent = spec.label;
    el.setAttribute('aria-label', spec.label);

    const entry: TouchButton = { spec, element: el, pointerId: null };
    this.buttons.push(entry);

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // A AÇÃO PRIMEIRO. `setPointerCapture` pode lançar (ponteiro já
      // liberado, id inválido); se ele viesse antes, uma exceção deixaria o
      // botão visualmente pressionado e sem efeito nenhum no jogo.
      entry.pointerId = e.pointerId;
      this.source.buttons.add(spec.action);
      // Marca o toque: garante uma leitura mesmo se o dedo sair antes do
      // próximo frame do jogo.
      this.source.tapped.add(spec.action);
      el.classList.add('is-pressed');
      capturePointer(el, e.pointerId);
    });

    /* O fim é tratado na `window` (`releaseButtonsOf`). O `lostpointercapture`
       continua aqui porque ele avisa de um caso que a window não vê: a captura
       cair com o dedo ainda na tela. */
    el.addEventListener('lostpointercapture', (e) => this.releaseButtonsOf(e.pointerId));
    return el;
  }

  private releaseButtonsOf(pointerId: number): void {
    for (const button of this.buttons) {
      if (button.pointerId !== pointerId) continue;
      button.pointerId = null;
      button.element.classList.remove('is-pressed');
      this.source.buttons.delete(button.spec.action);
    }
  }

  /* ─────────────────────────── Direcional ───────────────────────── */

  private bindStick(): void {
    const zone = this.stickZone;

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      /* Se o stick ainda acha que está com um ponteiro que não existe mais,
         ASSUME o novo. Sem isto, um único `pointerup` perdido trancava o
         direcional para sempre — o dedo novo era ignorado e o personagem
         seguia andando com o valor velho. */
      if (this.stickPointerId !== null && this.livePointers.has(this.stickPointerId)) return;

      this.stickPointerId = e.pointerId;
      this.livePointers.add(e.pointerId);
      capturePointer(zone, e.pointerId);
      // Stick FLUTUANTE: nasce onde o dedo tocou. Um stick fixo obriga o
      // jogador a procurar o controle sem olhar, e ele erra.
      this.stickOriginX = e.clientX;
      this.stickOriginY = e.clientY;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('is-active');
      this.updateStick(e.clientX, e.clientY);
    });

    /* Movimento na WINDOW: arrastar o polegar para fora da metade esquerda é
       normal jogando, e sem isto o direcional congelaria no último valor lido
       assim que o dedo saísse da zona. */
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.updateStick(e.clientX, e.clientY);
    });

    zone.addEventListener('lostpointercapture', (e) => this.endStick(e.pointerId));
  }

  private endStick(pointerId: number): void {
    if (pointerId !== this.stickPointerId) return;
    this.stickPointerId = null;
    this.stickBase.classList.remove('is-active');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
    this.source.axisX = 0;
    this.source.axisY = 0;
  }

  private updateStick(clientX: number, clientY: number): void {
    const dx = clientX - this.stickOriginX;
    const dy = clientY - this.stickOriginY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, STICK_RADIUS);
    const nx = distance === 0 ? 0 : (dx / distance) * (clamped / STICK_RADIUS);
    const ny = distance === 0 ? 0 : (dy / distance) * (clamped / STICK_RADIUS);

    this.source.axisX = Math.abs(nx) < STICK_DEADZONE ? 0 : nx;
    this.source.axisY = Math.abs(ny) < STICK_DEADZONE ? 0 : ny;

    const knobX = (dx / Math.max(distance, 1)) * clamped;
    const knobY = (dy / Math.max(distance, 1)) * clamped;
    this.stickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  }

  /**
   * Estado zerado: nenhum botão, nenhum eixo, nenhum ponteiro reservado.
   *
   * `source.tapped` NÃO é limpo aqui, de propósito. Ele é o latch que garante
   * que um toque curto seja visto por pelo menos um frame do jogo, e soltar o
   * dedo é justamente quando ele acabou de ser marcado — limpá-lo aqui comeria
   * todo toque rápido no botão de pulo. Quem o consome (e limpa) é o
   * `TouchDevice.poll`.
   */
  private releaseAll(): void {
    this.source.buttons.clear();
    this.source.axisX = 0;
    this.source.axisY = 0;

    this.stickPointerId = null;
    this.stickBase.classList.remove('is-active');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';

    for (const button of this.buttons) {
      button.pointerId = null;
      button.element.classList.remove('is-pressed');
    }
  }
}
