/**
 * Controles touch em DOM (não em objetos Phaser).
 *
 * Por quê DOM: multitouch com `setPointerCapture` funciona de verdade,
 * `env(safe-area-inset-*)` só existe em CSS, e o controle continua respondendo
 * mesmo com o canvas pausado. Cada widget rastreia o próprio `pointerId`, então
 * segurar o tiro enquanto se move e pula é o caso normal, não um caso especial.
 */

import { Action } from '../../core/input/actions';
import type { TouchInputSource } from '../../game/input/devices';

const STICK_RADIUS = 56;
const STICK_DEADZONE = 0.18;

/**
 * Captura o ponteiro sem deixar a falha derrubar o handler. A captura é um
 * reforço (garante que o `pointerup` chegue mesmo se o dedo sair do botão),
 * nunca um pré-requisito para a ação acontecer.
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

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly stickZone: HTMLElement;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
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
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (!visible) this.releaseAll();
  }

  private createButton(spec: ButtonSpec): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `touch-btn touch-btn--${spec.className}`;
    el.textContent = spec.label;
    el.setAttribute('aria-label', spec.label);

    const press = (e: PointerEvent): void => {
      e.preventDefault();
      // A AÇÃO PRIMEIRO. `setPointerCapture` pode lançar (ponteiro já
      // liberado, id inválido); se ele viesse antes, uma exceção deixaria o
      // botão visualmente pressionado e sem efeito nenhum no jogo.
      this.source.buttons.add(spec.action);
      el.classList.add('is-pressed');
      capturePointer(el, e.pointerId);
    };
    const release = (e: PointerEvent): void => {
      e.preventDefault();
      el.classList.remove('is-pressed');
      this.source.buttons.delete(spec.action);
    };

    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    // `pointercancel` é o que evita o clássico "tiro travado" quando uma
    // notificação do sistema rouba o toque no meio de uma rajada.
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    return el;
  }

  private bindStick(): void {
    const zone = this.stickZone;

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickPointerId !== null) return;
      this.stickPointerId = e.pointerId;
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

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      this.updateStick(e.clientX, e.clientY);
    });

    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickBase.classList.remove('is-active');
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
      this.source.axisX = 0;
      this.source.axisY = 0;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
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

  private releaseAll(): void {
    this.source.buttons.clear();
    this.source.axisX = 0;
    this.source.axisY = 0;
    this.stickPointerId = null;
  }
}
