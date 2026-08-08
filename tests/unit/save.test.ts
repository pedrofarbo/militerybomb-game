import { describe, expect, it } from 'vitest';
import { createDefaultSave, migrate } from '../../src/core/save/schema';
import {
  KeyValueSaveRepository,
  MemoryStore,
  SAVE_KEY,
  BACKUP_KEY,
  type KeyValueStore,
} from '../../src/core/save/repository';

/** Armazenamento que lança, como o Safari em navegação privada. */
class HostileStore implements KeyValueStore {
  getItem(): string | null {
    throw new Error('acesso negado');
  }
  setItem(): void {
    throw new Error('cota excedida');
  }
  removeItem(): void {
    throw new Error('acesso negado');
  }
}

describe('save — migração e sanitização', () => {
  it('aceita um save válido', () => {
    const original = createDefaultSave();
    original.profile.highScore = 1234;
    const { data, recovered } = migrate(structuredClone(original));
    expect(recovered).toBe(false);
    expect(data.profile.highScore).toBe(1234);
  });

  it('cai no default para versão desconhecida', () => {
    const { data, recovered } = migrate({ version: 99 });
    expect(recovered).toBe(true);
    expect(data.version).toBe(1);
  });

  it('limita volumes fora de faixa em vez de propagar lixo', () => {
    const { data } = migrate({
      ...createDefaultSave(),
      settings: { ...createDefaultSave().settings, volumes: { master: 42, music: -3, sfx: 0.5 } },
    });
    expect(data.settings.volumes.master).toBe(1);
    expect(data.settings.volumes.music).toBe(0);
    expect(data.settings.volumes.sfx).toBe(0.5);
  });

  it('não lança com entrada absurda', () => {
    for (const input of [null, undefined, 42, 'texto', [], { profile: 7 }]) {
      expect(() => migrate(input)).not.toThrow();
    }
  });
});

describe('save — repositório', () => {
  it('grava e lê', async () => {
    const repo = new KeyValueSaveRepository(new MemoryStore());
    const data = createDefaultSave();
    data.profile.highScore = 999;

    await repo.save(data);
    expect((await repo.load()).profile.highScore).toBe(999);
  });

  it('devolve o default quando não há save', async () => {
    const repo = new KeyValueSaveRepository(new MemoryStore());
    expect((await repo.load()).profile.currentLevel).toBe('level-01');
  });

  it('guarda backup antes de descartar save corrompido', async () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{isto não é json');
    const repo = new KeyValueSaveRepository(store);

    const data = await repo.load();

    expect(data.version).toBe(1);
    expect(store.getItem(BACKUP_KEY)).toBe('{isto não é json');
  });

  it('não quebra o jogo quando o armazenamento está indisponível', async () => {
    const repo = new KeyValueSaveRepository(new HostileStore());

    await expect(repo.load()).resolves.toBeDefined();
    await expect(repo.save(createDefaultSave())).resolves.toBeUndefined();
    expect(repo.degraded).toBe(true);
  });
});
