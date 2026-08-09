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
  private readonly hudLives: HTMLElement;
  private readonly hudHint: HTMLElement;
  private readonly orientationGate: HTMLElement;
  private readonly outcome: HTMLElement;
  private readonly outcomeTitle: HTMLElement;
  private readonly outcomeDetail: HTMLElement;
  private readonly outcomeButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly bossBar: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly touch: TouchControls;
  private touchEnabled = false;
  private outcomeFrom: 'game-over' | 'level-complete' = 'game-over';
  private hintTimer = 0;

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

    const topRight = document.createElement('div');
    topRight.className = 'hud-block hud-block--right';
    /* Botão de pausa no HUD. No celular NÃO existe tecla Esc — sem ele, um
       jogador de touch simplesmente não consegue pausar, e "não consegue
       parar de jogar" não é elogio. */
    this.pauseButton = document.createElement('button');
    this.pauseButton.type = 'button';
    this.pauseButton.className = 'hud-pause';
    this.pauseButton.textContent = '❚❚';
    this.pauseButton.setAttribute('aria-label', 'Pausar');
    this.pauseButton.addEventListener('click', () => bus.emit('game:pauseRequested', {}));
    this.hudScore = document.createElement('div');
    this.hudScore.className = 'hud-score';
    this.hudLives = document.createElement('div');
    this.hudLives.className = 'hud-lives';
    topRight.append(this.pauseButton, this.hudScore, this.hudLives);

    const topRow = document.createElement('div');
    topRow.className = 'hud-row';
    topRow.append(topLeft, topRight);

    /* Barra do boss no TOPO CENTRAL, e não junto do resto do HUD: durante a
       luta ela é a segunda informação mais importante da tela, e no canto ela
       competiria com a vida do jogador pelo mesmo olhar. */
    this.bossBar = document.createElement('div');
    this.bossBar.className = 'boss-bar';
    this.bossBar.hidden = true;
    this.bossName = document.createElement('div');
    this.bossName.className = 'boss-bar__name';
    const track = document.createElement('div');
    track.className = 'boss-bar__track';
    this.bossFill = document.createElement('i');
    this.bossFill.className = 'boss-bar__fill';
    track.appendChild(this.bossFill);
    this.bossBar.append(this.bossName, track);

    this.hudHint = document.createElement('div');
    this.hudHint.className = 'hud-hint';
    hud.append(topRow, this.bossBar, this.hudHint);
    this.element.appendChild(hud);

    this.orientationGate = document.createElement('div');
    this.orientationGate.className = 'orientation-gate';
    this.orientationGate.innerHTML =
      '<div class="orientation-gate__icon">⟳</div>' +
      '<p class="orientation-gate__text">Gire o dispositivo<br><span>REDLINE é jogado na horizontal</span></p>';
    this.orientationGate.hidden = true;
    this.element.appendChild(this.orientationGate);

    /* Painel de fim (game over / fase completa). Vive fora do canvas de
       propósito: é texto, precisa de foco de teclado e de um alvo de toque
       de verdade — três coisas que o DOM já resolve e o canvas não. */
    this.outcome = document.createElement('div');
    this.outcome.className = 'outcome';
    this.outcome.hidden = true;
    this.outcome.setAttribute('role', 'dialog');
    this.outcome.setAttribute('aria-live', 'assertive');
    this.outcomeTitle = document.createElement('h2');
    this.outcomeTitle.className = 'outcome__title';
    this.outcomeDetail = document.createElement('p');
    this.outcomeDetail.className = 'outcome__detail';
    this.outcomeButton = document.createElement('button');
    this.outcomeButton.className = 'outcome__button';
    this.outcomeButton.type = 'button';
    this.outcomeButton.addEventListener('click', () => {
      bus.emit('run:restartRequested', { from: this.outcomeFrom });
    });
    this.outcome.append(this.outcomeTitle, this.outcomeDetail, this.outcomeButton);
    this.element.appendChild(this.outcome);

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
    bus.on('lives:changed', ({ lives, delta }) => {
      this.renderLives(lives);
      if (delta > 0) {
        this.setHint('VIDA EXTRA');
        this.clearHintLater();
      }
    });
    bus.on('run:started', () => {
      this.outcome.hidden = true;
      this.bossBar.hidden = true;
      this.touch.setVisible(this.touchEnabled);
      this.setHint('');
    });
    bus.on('checkpoint:reached', () => {
      this.setHint('CHECKPOINT');
      this.clearHintLater();
    });
    bus.on('pickup:taken', ({ variant }) => {
      const label = PICKUP_LABEL[variant];
      if (!label) return;
      this.setHint(label);
      this.clearHintLater();
    });
    bus.on('boss:started', ({ name }) => {
      this.bossName.textContent = name.toUpperCase();
      this.bossBar.hidden = false;
      this.bossBar.classList.remove('boss-bar--phase2');
      this.setBossFill(1);
    });
    bus.on('boss:health', ({ fraction }) => this.setBossFill(fraction));
    bus.on('boss:phase', ({ phase }) => {
      this.bossBar.classList.toggle('boss-bar--phase2', phase === 2);
      this.setHint('NÚCLEO INSTÁVEL');
      this.clearHintLater();
    });
    bus.on('boss:defeated', () => {
      this.setBossFill(0);
      this.bossBar.hidden = true;
      this.setHint('EXTRAÇÃO LIBERADA');
      this.clearHintLater();
    });
    bus.on('player:died', ({ atCheckpointId }) => {
      this.setHint(atCheckpointId === null ? 'Reiniciando a fase…' : 'Voltando ao checkpoint…');
      this.clearHintLater();
    });
    bus.on('level:complete', ({ timeMs, score }) => {
      this.showOutcome(
        'level-complete',
        'FASE COMPLETA',
        formatOutcome(score, timeMs),
        'JOGAR DE NOVO',
      );
    });
    bus.on('run:gameOver', ({ score, timeMs }) => {
      this.showOutcome('game-over', 'FIM DE JOGO', formatOutcome(score, timeMs), 'RECOMEÇAR');
    });
  }

  private showOutcome(
    from: 'game-over' | 'level-complete',
    title: string,
    detail: string,
    button: string,
  ): void {
    this.outcomeFrom = from;
    this.outcome.classList.toggle('outcome--win', from === 'level-complete');
    this.outcomeTitle.textContent = title;
    this.outcomeDetail.textContent = detail;
    this.outcomeButton.textContent = button;
    this.outcome.hidden = false;
    this.setHint('');
    // Some com o direcional e os botões: com a fase encerrada eles não fazem
    // nada, e um botão visível que não responde parece o jogo travado.
    this.touch.setVisible(false);
  }

  private setBossFill(fraction: number): void {
    this.bossFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }

  private clearHintLater(): void {
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.setHint(''), 1600);
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

  /**
   * Vidas como ícones, e o número só a partir de 6.
   *
   * Uma fileira de 9 bonecos ocupa mais espaço do que informa; até 5 o jogador
   * lê a quantidade sem contar, que é o ponto.
   */
  private renderLives(lives: number): void {
    if (lives <= 0) this.hudLives.textContent = 'VIDAS —';
    else this.hudLives.textContent = lives > 5 ? `VIDAS ×${lives}` : `VIDAS ${'▮'.repeat(lives)}`;
  }

  /** Estado dos controles touch, para o painel de debug. */
  get touchDebugState(): string {
    return this.touch.debugState;
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

function formatOutcome(score: number, timeMs: number): string {
  const total = Math.floor(timeMs / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `PONTOS ${String(score).padStart(6, '0')}  ·  TEMPO ${mm}:${ss}`;
}

const PICKUP_LABEL: Record<string, string> = {
  weapon_mg: 'METRALHADORA',
  weapon_sg: 'ESCOPETA',
  grenade: '+2 GRANADAS',
  health: '+2 VIDA',
  ammo: '+ MUNIÇÃO',
};

const WEAPON_LABEL: Record<string, string> = {
  pistol: 'PISTOLA',
  machinegun: 'METRALHADORA',
  shotgun: 'ESCOPETA',
};
