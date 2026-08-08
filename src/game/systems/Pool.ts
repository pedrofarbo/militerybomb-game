/**
 * Pool genérico.
 *
 * Regra do projeto: nada que nasce e morre durante o combate pode ser alocado
 * em runtime. Projéteis, partículas, explosões e destroços saem daqui, todos
 * pré-alocados no carregamento da fase.
 */

export interface Poolable {
  setActive(active: boolean): unknown;
  setVisible(visible: boolean): unknown;
}

export class Pool<T extends Poolable> {
  private readonly items: T[] = [];
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    size: number,
    /** Teto de crescimento. Estourar significa que o orçamento está errado. */
    private readonly maxSize = size * 2,
  ) {
    for (let i = 0; i < size; i++) this.free.push(this.build());
  }

  private build(): T {
    const item = this.factory();
    item.setActive(false);
    item.setVisible(false);
    this.items.push(item);
    return item;
  }

  acquire(): T | null {
    const item = this.free.pop();
    if (item) return item;
    if (this.items.length < this.maxSize) {
      const grown = this.build();
      const index = this.free.indexOf(grown);
      if (index >= 0) this.free.splice(index, 1);
      return grown;
    }
    // Melhor perder um projétil do que engasgar o frame alocando.
    return null;
  }

  release(item: T): void {
    item.setActive(false);
    item.setVisible(false);
    if (!this.free.includes(item)) this.free.push(item);
  }

  releaseAll(): void {
    for (const item of this.items) this.release(item);
  }

  get size(): number {
    return this.items.length;
  }

  get activeCount(): number {
    return this.items.length - this.free.length;
  }
}
