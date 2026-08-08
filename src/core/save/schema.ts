/**
 * Dados persistidos.
 *
 * Só o que é serializável. Nunca um objeto Phaser, nunca uma referência a
 * entidade. Versionado desde a v1 porque migrar save é barato de projetar
 * agora e caro de retroagir depois.
 */

import type { QualityLevel } from '../config/tuning';

export const SAVE_VERSION = 1;

export interface SaveSettings {
  volumes: { master: number; music: number; sfx: number };
  muted: boolean;
  /** 0..1 — multiplicador global do screen shake (acessibilidade). */
  shakeIntensity: number;
  quality: 'auto' | QualityLevel;
  language: 'pt-BR' | 'en';
}

export interface SaveProfile {
  unlockedLevels: string[];
  currentLevel: string;
  highScore: number;
  stats: { runs: number; deaths: number; kills: number };
}

export interface SaveDataV1 {
  version: 1;
  profile: SaveProfile;
  settings: SaveSettings;
}

export type SaveData = SaveDataV1;

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    profile: {
      unlockedLevels: ['level-01'],
      currentLevel: 'level-01',
      highScore: 0,
      stats: { runs: 0, deaths: 0, kills: 0 },
    },
    settings: {
      volumes: { master: 0.8, music: 0.6, sfx: 0.9 },
      muted: false,
      shakeIntensity: 1,
      quality: 'auto',
      language: 'pt-BR',
    },
  };
}

/**
 * Migra e sanitiza. Nunca lança: um save corrompido não pode impedir alguém de
 * jogar. Devolve o default (e o chamador guarda um backup do original).
 */
export function migrate(raw: unknown): { data: SaveData; recovered: boolean } {
  const fallback = createDefaultSave();
  if (typeof raw !== 'object' || raw === null) return { data: fallback, recovered: true };

  const candidate = raw as Partial<SaveDataV1>;
  if (candidate.version !== SAVE_VERSION) return { data: fallback, recovered: true };

  const profile = candidate.profile;
  const settings = candidate.settings;
  let recovered = false;

  const merged: SaveData = {
    version: SAVE_VERSION,
    profile: {
      unlockedLevels: Array.isArray(profile?.unlockedLevels)
        ? profile.unlockedLevels.filter((v): v is string => typeof v === 'string')
        : ((recovered = true), fallback.profile.unlockedLevels),
      currentLevel:
        typeof profile?.currentLevel === 'string'
          ? profile.currentLevel
          : ((recovered = true), fallback.profile.currentLevel),
      highScore: num(profile?.highScore, 0, Number.MAX_SAFE_INTEGER, fallback.profile.highScore),
      stats: {
        runs: num(profile?.stats?.runs, 0, Number.MAX_SAFE_INTEGER, 0),
        deaths: num(profile?.stats?.deaths, 0, Number.MAX_SAFE_INTEGER, 0),
        kills: num(profile?.stats?.kills, 0, Number.MAX_SAFE_INTEGER, 0),
      },
    },
    settings: {
      volumes: {
        master: num(settings?.volumes?.master, 0, 1, fallback.settings.volumes.master),
        music: num(settings?.volumes?.music, 0, 1, fallback.settings.volumes.music),
        sfx: num(settings?.volumes?.sfx, 0, 1, fallback.settings.volumes.sfx),
      },
      muted: typeof settings?.muted === 'boolean' ? settings.muted : false,
      shakeIntensity: num(settings?.shakeIntensity, 0, 1, 1),
      quality: isQuality(settings?.quality) ? settings.quality : 'auto',
      language: settings?.language === 'en' ? 'en' : 'pt-BR',
    },
  };

  if (merged.profile.unlockedLevels.length === 0) {
    merged.profile.unlockedLevels = fallback.profile.unlockedLevels;
    recovered = true;
  }

  return { data: merged, recovered };
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isQuality(value: unknown): value is SaveSettings['quality'] {
  return value === 'auto' || value === 'high' || value === 'medium' || value === 'low';
}
