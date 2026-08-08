/**
 * Casca de UI em DOM sobre o canvas: HUD, aviso de orientação e controles touch.
 *
 * Tudo aqui reage a eventos do bus — nenhum widget faz polling do estado do
 * jogo, e nenhum sistema de gameplay sabe que a UI existe.
 */

import type { GameEventBus } from '../core/events/bus';
import type { TouchInputSource } from '../game/input/devices';
import { TouchControls } from './touch/TouchControls';

export class UiRoot {
  readonly element: HTMLElement;
  private readonly hudWeapon: HTMLElement;
  private readonly hudHint: HTMLElement;
  private readonly orientationGate: HTMLElement;
  private readonly touch: TouchControls;
  private touchEnabled = false;

  constructor(parent: HTMLElement, bus: GameEventBus, touchSource: TouchInputSource) {
    this.element = document.createElement('div');
    this.element.className = 'ui-root';
    parent.appendChild(this.element);

    const hud = document.createElement('div');
    hud.className = 'hud';
    this.hudWeapon = document.createElement('div');
    this.hudWeapon.className = 'hud-weapon';
    this.hudHint = document.createElement('div');
    this.hudHint.className = 'hud-hint';
    hud.append(this.hudWeapon, this.hudHint);
    this.element.appendChild(hud);

    this.orientationGate = document.createElement('div');
    this.orientationGate.className = 'orientation-gate';
    this.orientationGate.innerHTML =
      '<div class="orientation-gate__icon">⟳</div>' +
      '<p class="orientation-gate__text">Gire o dispositivo<br><span>REDLINE é jogado na horizontal</span></p>';
    this.orientationGate.hidden = true;
    this.element.appendChild(this.orientationGate);

    this.touch = new TouchControls(this.element, touchSource);

    bus.on('weapon:changed', ({ weaponId, ammo }) => {
      this.hudWeapon.textContent = `${WEAPON_LABEL[weaponId] ?? weaponId}  ${
        ammo === 'infinite' ? '∞' : ammo
      }`;
    });
    bus.on('player:died', () => {
      this.setHint('Você caiu — voltando ao início');
      window.setTimeout(() => this.setHint(''), 1600);
    });
  }

  setHint(text: string): void {
    this.hudHint.textContent = text;
  }

  setTouchEnabled(enabled: boolean): void {
    this.touchEnabled = enabled;
    this.touch.setVisible(enabled);
  }

  /**
   * O jogo é landscape-first. Em portrait a simulação pausa e o aviso cobre a
   * tela — no iOS não existe API de travar orientação, então este gate é o
   * mecanismo real, não um plano B.
   */
  setPortraitBlocked(blocked: boolean): void {
    this.orientationGate.hidden = !blocked;
    if (blocked) this.touch.setVisible(false);
    else this.touch.setVisible(this.touchEnabled);
  }
}

const WEAPON_LABEL: Record<string, string> = {
  pistol: 'PISTOLA',
  machinegun: 'METRALHADORA',
  shotgun: 'ESCOPETA',
};
