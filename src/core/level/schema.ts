/**
 * Representação de fase.
 *
 * `LevelDef` é 100% serializável e não conhece Phaser — dá para validar uma
 * fase inteira num teste unitário. A Fase 1 usa fonte ASCII (rápida de editar
 * à mão); a Fase 3 troca a fonte por `.tmj` do Tiled produzindo o MESMO
 * `LevelDef`, sem tocar no LevelBuilder.
 */

export interface ParallaxLayerDef {
  /** Chave lógica de imagem (ver `src/assets/manifest`). */
  readonly image: string;
  readonly scrollFactor: number;
  /** Deslocamento vertical, em px lógicos. */
  readonly offsetY: number;
  /** Camadas de primeiro plano são desligadas em qualidade baixa. */
  readonly foreground?: boolean;
}

export interface LevelDef {
  readonly id: string;
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Em tiles. */
  readonly width: number;
  readonly height: number;
  /** Índices do tileset, row-major, comprimento = width × height. */
  readonly tiles: readonly number[];
  /** Índices com colisão. */
  readonly solidTiles: ReadonlySet<number>;
  /** Ponto de entrada, em px de mundo (base dos pés). */
  readonly spawn: { readonly x: number; readonly y: number };
  readonly parallax: readonly ParallaxLayerDef[];
  /** Limites de câmera e de mundo, em px. */
  readonly bounds: { readonly width: number; readonly height: number };
}

/** Fonte de autoria ASCII. Um caractere por tile; ver `LEGEND` em parse.ts. */
export interface LevelSource {
  readonly id: string;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly rows: readonly string[];
  readonly spawnTile: { readonly x: number; readonly y: number };
  readonly parallax: readonly ParallaxLayerDef[];
}

export class LevelParseError extends Error {
  constructor(message: string) {
    super(`Fase inválida: ${message}`);
    this.name = 'LevelParseError';
  }
}
