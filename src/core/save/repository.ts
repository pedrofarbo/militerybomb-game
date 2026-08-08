/**
 * Persistência atrás de uma interface.
 *
 * A implementação inicial é localStorage. Trocar por backend/cloud save depois
 * é escrever outra implementação — nada em `core/progression` muda.
 */

import { createDefaultSave, migrate, type SaveData } from './schema';

export interface SaveRepository {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
  clear(): Promise<void>;
}

/** Armazenamento mínimo — a interface do localStorage que realmente usamos. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'redline.save';
export const BACKUP_KEY = 'redline.save.backup';

export class KeyValueSaveRepository implements SaveRepository {
  /** Fica `true` se o armazenamento falhar; a UI avisa uma vez só. */
  degraded = false;

  constructor(private readonly store: KeyValueStore) {}

  async load(): Promise<SaveData> {
    let raw: string | null;
    try {
      raw = this.store.getItem(SAVE_KEY);
    } catch {
      this.degraded = true;
      return createDefaultSave();
    }
    if (raw === null) return createDefaultSave();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.backup(raw);
      return createDefaultSave();
    }

    const { data, recovered } = migrate(parsed);
    // Save irrecuperável nunca é descartado em silêncio: guarda o original.
    if (recovered) this.backup(raw);
    return data;
  }

  async save(data: SaveData): Promise<void> {
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Safari em navegação privada lança em setItem. O jogo continua; só
      // não persiste. Perder progresso é ruim; travar a partida é pior.
      this.degraded = true;
    }
  }

  async clear(): Promise<void> {
    try {
      this.store.removeItem(SAVE_KEY);
    } catch {
      this.degraded = true;
    }
  }

  private backup(raw: string): void {
    try {
      this.store.setItem(BACKUP_KEY, raw);
    } catch {
      this.degraded = true;
    }
  }
}

/** Fallback quando não há armazenamento algum (iframe restrito, modo privado). */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}
