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
  private readonly hudHealth: HTMLElement;
  private readonly hudGrenades: HTMLElement;
  private readonly hudScore: HTMLElement;
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

    const topLeft = document.createElement('div');
    topLeft.className = 'hud-block';
    this.hudHealth = document.createElement('div');
    this.hudHealth.className = 'hud-health';
    this.hudWeapon = document.createElement('div');
    this.hudWeapon.className = 'hud-weapon';
    this.hudGrenades = document.createElement('div');
    this.hudGrenades.className = 'hud-grenades';
    topLeft.append(this.hudHealth, this.hudWeapon, this.hudGrenades);

    this.hudScore = document.createElement('div');
    this.hudScore.className = 'hud-score';

    const topRow = document.createElement('div');
    topRow.className = 'hud-row';
    topRow.append(topLeft, this.hudScore);

    this.hudHint = document.createElement('div');
    this.hudHint.className = 'hud-hint';
    hud.append(topRow, this.hudHint);
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
    bus.on('player:damaged', ({ hp, max }) => this.renderHealth(hp, max));
    bus.on('grenades:changed', ({ count }) => {
      this.hudGrenades.textContent = `GRANADAS ${'◆'.repeat(count)}${'◇'.repeat(Math.max(0, 5 - count))}`;
    });
    bus.on('score:changed', ({ score }) => {
      this.hudScore.textContent = String(score).padStart(6, '0');
    });
    bus.on('player:died', () => {
      this.setHint('Você caiu — voltando ao checkpoint');
      window.setTimeout(() => this.setHint(''), 1600);
    });
  }

  setHint(text: string): void {
    this.hudHint.textContent = text;
  }

  /**
   * Vida em segmentos, não em número: num run & gun o jogador precisa saber
   * quanto aguenta com um olhar periférico, sem ler.
   */
  private renderHealth(current: number, max: number): void {
    this.hudHealth.textContent = '';
    const critical = current <= Math.max(1, Math.floor(max * 0.34));
    for (let i = 0; i < max; i++) {
      const segment = document.createElement('i');
      segment.className = 'hud-health__seg';
      if (i < current) segment.classList.add(critical ? 'is-critical' : 'is-full');
      this.hudHealth.appendChild(segment);
    }
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
