/**
 * Áudio: barramentos, desbloqueio e limite de vozes.
 *
 * Três coisas que parecem detalhe e definem se o áudio de um jogo web funciona:
 *
 * 1. O CONTEXTO NASCE SUSPENSO em todo browser moderno. Só um gesto real do
 *    usuário o libera. Antes disso, chamar `play()` não é apenas inútil — o
 *    Phaser enfileira decodificações que estouram no primeiro clique, todas
 *    juntas. Aqui nada toca antes do desbloqueio, e a música pendente é
 *    lembrada para começar no gesto.
 * 2. LIMITE DE VOZES. Um tiro que toca 12 vezes por segundo, somado a
 *    explosões, satura a saída e vira estalo. Cada chave tem um teto e a
 *    instância mais antiga é roubada.
 * 3. VOLUMES SÃO DO JOGADOR. Ficam no `ProfileState`, não em constantes.
 *
 * Nenhum sistema de gameplay conhece este arquivo — quem liga os dois é o
 * `AudioDirector`, que escuta o event bus.
 */

import Phaser from 'phaser';
import { AUDIO, type AudioKey } from '../../assets/audio-manifest.generated';

export type AudioBus = 'music' | 'sfx' | 'ui';

export interface AudioVolumes {
  master: number;
  music: number;
  sfx: number;
}

/** Teto de instâncias simultâneas por chave. Sem isto, o combate satura. */
const DEFAULT_VOICE_LIMIT = 4;
const VOICE_LIMITS: Partial<Record<AudioKey, number>> = {
  'sfx.weapon.machinegun': 3,
  'sfx.weapon.pistol': 3,
  'sfx.impact.concrete': 3,
  'sfx.impact.metal': 3,
  'sfx.impact.armor': 3,
  'sfx.explosion.small': 3,
};

/** Quanto a música abaixa durante uma explosão grande, e por quanto tempo. */
const DUCK_FACTOR = 0.45;
const DUCK_MS = 420;
const MUSIC_FADE_MS = 600;

interface Voice {
  sound: Phaser.Sound.BaseSound;
  startedAt: number;
}

export class AudioService {
  private unlocked = false;
  private muted = false;
  private volumes: AudioVolumes = { master: 0.8, music: 0.6, sfx: 0.9 };
  private readonly voices = new Map<AudioKey, Voice[]>();
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: AudioKey | null = null;
  private pendingMusic: AudioKey | null = null;
  private duckUntilMs = 0;

  constructor(private readonly sound: Phaser.Sound.BaseSoundManager) {}

  /**
   * Chamado no primeiro gesto real do usuário.
   *
   * Idempotente: os handlers de clique/tecla/toque são todos ligados, e quem
   * chegar primeiro ganha. Tentar adivinhar qual deles vem antes é como o
   * áudio acaba não tocando em um browser específico.
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    const context = (this.sound as { context?: AudioContext }).context;
    void context?.resume?.();

    if (this.pendingMusic) {
      const key = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(key);
    }
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = { ...volumes };
    this.applyMusicVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.sound.mute = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Toca um efeito. Silencioso e barato antes do desbloqueio. */
  play(key: AudioKey, volumeScale = 1, bus: AudioBus = 'sfx'): void {
    if (!this.unlocked || this.muted) return;
    if (!this.sound.game.cache.audio.exists(key)) return;

    const limit = VOICE_LIMITS[key] ?? DEFAULT_VOICE_LIMIT;
    const active = this.reapVoices(key);
    if (active.length >= limit) {
      // Rouba a mais antiga: uma nova ação é sempre mais informativa que o
      // rabo de uma que já aconteceu.
      const oldest = active.shift();
      oldest?.sound.stop();
      oldest?.sound.destroy();
    }

    const sound = this.sound.add(key, { volume: this.busVolume(bus) * volumeScale });
    /* Autodestruição ao terminar. Sem isto, cada tiro deixa um objeto de som
       vivo no gerenciador do Phaser — algumas centenas por minuto de combate,
       que é vazamento suficiente para aparecer numa sessão longa de celular. */
    sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
    active.push({ sound, startedAt: this.sound.game.getTime() });
    this.voices.set(key, active);
    sound.play();
  }

  /**
   * Troca a faixa de música com fade cruzado.
   *
   * Trocar seco no meio da luta é a diferença entre "a música mudou" e "o jogo
   * engasgou" — e a entrada da arena é justamente o momento em que ninguém
   * pode achar que engasgou.
   */
  playMusic(key: AudioKey): void {
    if (!AUDIO[key]?.music) return;
    if (this.currentMusicKey === key) return;

    if (!this.unlocked) {
      this.pendingMusic = key;
      return;
    }
    if (!this.sound.game.cache.audio.exists(key)) return;

    this.stopMusic(MUSIC_FADE_MS);

    const next = this.sound.add(key, { loop: true, volume: 0 });
    this.currentMusic = next;
    this.currentMusicKey = key;
    next.play();
    this.fade(next, this.musicVolume(), MUSIC_FADE_MS);
  }

  stopMusic(fadeMs = MUSIC_FADE_MS): void {
    const previous = this.currentMusic;
    this.currentMusic = null;
    this.currentMusicKey = null;
    if (!previous) return;

    this.fade(previous, 0, fadeMs, () => {
      previous.stop();
      previous.destroy();
    });
  }

  /** Abaixa a música por um instante. Usado em explosões grandes. */
  duck(nowMs: number): void {
    this.duckUntilMs = nowMs + DUCK_MS;
    this.applyMusicVolume();
  }

  /** Roda uma vez por frame: só restaura o volume depois do duck. */
  update(nowMs: number): void {
    if (this.duckUntilMs > 0 && nowMs >= this.duckUntilMs) {
      this.duckUntilMs = 0;
      this.applyMusicVolume();
    }
  }

  /** Pausa tudo quando a aba perde o foco — som em background é intrusivo. */
  setPaused(paused: boolean): void {
    if (paused) this.sound.pauseAll();
    else if (this.unlocked) this.sound.resumeAll();
  }

  private busVolume(bus: AudioBus): number {
    const channel = bus === 'music' ? this.volumes.music : this.volumes.sfx;
    return this.volumes.master * channel;
  }

  private musicVolume(): number {
    const duck = this.duckUntilMs > 0 ? DUCK_FACTOR : 1;
    return this.busVolume('music') * duck;
  }

  private applyMusicVolume(): void {
    const music = this.currentMusic as (Phaser.Sound.BaseSound & { volume?: number }) | null;
    if (music) music.volume = this.musicVolume();
  }

  /** Remove vozes que já terminaram. Sem isto a lista cresce para sempre. */
  private reapVoices(key: AudioKey): Voice[] {
    const active = (this.voices.get(key) ?? []).filter((voice) => voice.sound.isPlaying);
    this.voices.set(key, active);
    return active;
  }

  private fade(
    sound: Phaser.Sound.BaseSound,
    target: number,
    durationMs: number,
    onDone?: () => void,
  ): void {
    const scene = this.sound.game.scene.getScenes(true)[0];
    const target_ = sound as Phaser.Sound.BaseSound & { volume: number };
    if (!scene || durationMs <= 0) {
      target_.volume = target;
      onDone?.();
      return;
    }
    scene.tweens.add({
      targets: target_,
      volume: target,
      duration: durationMs,
      onComplete: onDone,
    });
  }
}
