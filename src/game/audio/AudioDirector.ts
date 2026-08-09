/**
 * A ponte entre o que ACONTECE no jogo e o que se OUVE.
 *
 * Existe para que nenhum sistema de gameplay chame `play('sfx.…')`. O combate
 * emite "inimigo morreu"; o que isso soa é decisão daqui. Trocar o desenho
 * sonoro inteiro é editar este arquivo, e só ele.
 *
 * É também onde mora a hierarquia do que se ouve. Num run & gun tocam dez
 * coisas por segundo, e o que separa "intenso" de "papa" é decidir o que NÃO
 * toca: passos, tiro de inimigo fora da tela, cada estilhaço.
 */

import type { GameEventBus, Unsubscribe } from '../../core/events/bus';
import { PLAYER } from '../../core/config/tuning';
import type { AudioKey } from '../../assets/audio-manifest.generated';
import type { AudioService } from './AudioService';

const WEAPON_SOUND: Record<string, AudioKey> = {
  pistol: 'sfx.weapon.pistol',
  machinegun: 'sfx.weapon.machinegun',
  shotgun: 'sfx.weapon.shotgun',
};

/**
 * Tiro do jogador é o som mais repetido do jogo — a metralhadora dispara 12
 * vezes por segundo. Baixo o bastante para não cansar, alto o bastante para
 * confirmar cada disparo.
 */
const SHOT_VOLUME = 0.55;

export class AudioDirector {
  private readonly subscriptions: Unsubscribe[] = [];

  constructor(
    private readonly audio: AudioService,
    bus: GameEventBus,
  ) {
    /* `bus.on` direto, sem um helper genérico no meio: um wrapper "esperto"
       aqui apaga a inferência do payload e todo handler volta a receber a
       união inteira dos eventos. Duas linhas a mais valem a tipagem. */
    const subs = this.subscriptions;

    /* ── Combate ── */
    subs.push(
      bus.on('player:fired', ({ weaponId }) => {
        this.audio.play(WEAPON_SOUND[weaponId] ?? 'sfx.weapon.pistol', SHOT_VOLUME);
      }),
    );
    subs.push(bus.on('enemy:killed', () => this.audio.play('sfx.enemy.death', 0.7)));
    subs.push(
      bus.on('boss:hit', ({ onCore }) => {
        // A diferença entre acertar a blindagem e o núcleo é a lição inteira da
        // luta do boss. Se o SOM não separar os dois, a lição fica só no visual.
        this.audio.play(onCore ? 'sfx.impact.core' : 'sfx.impact.armor', onCore ? 0.9 : 0.5);
      }),
    );

    /* ── Jogador ── */
    subs.push(bus.on('player:jumped', () => this.audio.play('sfx.player.jump', 0.45)));
    subs.push(
      bus.on('player:landed', ({ fallSpeed }) => {
        // Só a aterrissagem PESADA soa. Um som a cada pulinho vira ruído.
        if (fallSpeed > PLAYER.hardLandingSpeed) this.audio.play('sfx.player.land', 0.6);
      }),
    );
    subs.push(
      bus.on('player:damaged', ({ hp }) => {
        if (hp > 0) this.audio.play('sfx.player.hurt', 0.8);
      }),
    );
    subs.push(bus.on('player:died', () => this.audio.play('sfx.player.death', 1)));

    /* ── Progressão ── */
    subs.push(bus.on('pickup:taken', () => this.audio.play('sfx.pickup.item', 0.7)));
    subs.push(bus.on('checkpoint:reached', () => this.audio.play('sfx.progress.checkpoint', 0.85)));
    subs.push(
      bus.on('lives:changed', ({ delta }) => {
        if (delta > 0) this.audio.play('sfx.progress.extraLife', 0.9);
      }),
    );

    /* ── Boss: a música muda com a luta ── */
    subs.push(
      bus.on('boss:started', () => {
        this.audio.play('sfx.boss.gate', 1);
        this.audio.playMusic('music.boss');
      }),
    );
    subs.push(bus.on('boss:vent', () => this.audio.play('sfx.boss.vent', 0.6)));
    subs.push(bus.on('boss:telegraph', () => this.audio.play('sfx.boss.telegraph', 0.55)));
    subs.push(
      bus.on('boss:defeated', () => {
        this.audio.play('sfx.explosion.large', 1);
        this.audio.playMusic('music.level01');
      }),
    );

    /* ── Fim de tentativa e de fase ── */
    subs.push(bus.on('run:started', () => this.audio.playMusic('music.level01')));
    subs.push(bus.on('run:gameOver', () => this.audio.stopMusic(900)));
    subs.push(bus.on('level:complete', () => this.audio.stopMusic(900)));
    subs.push(bus.on('game:paused', ({ paused }) => this.audio.setPaused(paused)));
  }

  /** Explosões grandes abaixam a música por um instante. */
  duckFor(nowMs: number): void {
    this.audio.duck(nowMs);
  }

  destroy(): void {
    for (const off of this.subscriptions) off();
    this.subscriptions.length = 0;
  }
}
