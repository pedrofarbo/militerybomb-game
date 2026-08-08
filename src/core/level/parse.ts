/**
 * ASCII → LevelDef, com auto-tiling.
 *
 * O autor da fase escreve `#` para "chão" e o parser escolhe entre topo, meio,
 * borda esquerda e borda direita. Isso mantém o mapa legível como texto (dá
 * para revisar level design em diff de PR) e impede a classe inteira de bug
 * "esqueci de trocar o tile da quina".
 */

import { LevelParseError, type LevelDef, type LevelEntity, type LevelSource } from './schema';

/** Índices do tileset. Espelham `public/assets/levels/tileset.json`. */
export const TILE = {
  Empty: 0,
  GroundTopL: 1,
  GroundTop: 2,
  GroundTopR: 3,
  GroundMid: 4,
  GroundDeep: 5,
  GroundL: 6,
  GroundR: 7,
  PlatformL: 8,
  PlatformM: 9,
  PlatformR: 10,
  CrateWall: 11,
  PipeH: 12,
  PipeV: 13,
  Grate: 14,
  HazardStripe: 15,
  ContainerTL: 16,
  ContainerT: 17,
  ContainerTR: 18,
  ContainerL: 19,
  ContainerM: 20,
  ContainerR: 21,
  Ladder: 22,
  Rail: 23,
} as const;

/** Tiles atravessáveis. Tudo o mais colide. */
const NON_SOLID = new Set<number>([TILE.Empty, TILE.Ladder, TILE.Rail, TILE.HazardStripe]);

/** Plataformas: colidem só por cima, para poder pular através delas. */
export const ONE_WAY_TILES: ReadonlySet<number> = new Set([
  TILE.PlatformL,
  TILE.PlatformM,
  TILE.PlatformR,
]);

const GROUND = '#';
const PLATFORM = '=';
const CONTAINER = 'C';

const SIMPLE: Readonly<Record<string, number>> = {
  '.': TILE.Empty,
  ' ': TILE.Empty,
  X: TILE.CrateWall,
  '|': TILE.PipeV,
  '-': TILE.PipeH,
  g: TILE.Grate,
  '!': TILE.HazardStripe,
  H: TILE.Ladder,
  r: TILE.Rail,
};

export function parseLevel(src: LevelSource): LevelDef {
  if (src.rows.length === 0) throw new LevelParseError('sem linhas');

  const height = src.rows.length;
  const width = src.rows[0]!.length;
  if (width === 0) throw new LevelParseError('primeira linha vazia');

  src.rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new LevelParseError(
        `linha ${y} tem ${row.length} colunas, esperado ${width} — o mapa precisa ser retangular`,
      );
    }
  });

  const at = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= width || y >= height ? '.' : src.rows[y]![x]!;

  const tiles: number[] = new Array<number>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles[y * width + x] = resolveTile(at, x, y);
    }
  }

  const { x: sx, y: sy } = src.spawnTile;
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
    throw new LevelParseError(`spawn (${sx}, ${sy}) fora do mapa ${width}×${height}`);
  }
  if (!NON_SOLID.has(tiles[sy * width + sx]!)) {
    throw new LevelParseError(`spawn (${sx}, ${sy}) está dentro de um tile sólido`);
  }

  const solidTiles = new Set<number>();
  for (const t of tiles) if (!NON_SOLID.has(t)) solidTiles.add(t);

  return {
    id: src.id,
    tileWidth: src.tileWidth,
    tileHeight: src.tileHeight,
    width,
    height,
    tiles,
    solidTiles,
    // Spawn no centro horizontal do tile, com os pés na base dele.
    spawn: {
      x: sx * src.tileWidth + src.tileWidth / 2,
      y: (sy + 1) * src.tileHeight,
    },
    parallax: src.parallax,
    entities: parseEntities(src, width, height, tiles),
    bounds: { width: width * src.tileWidth, height: height * src.tileHeight },
  };
}

function parseEntities(
  src: LevelSource,
  width: number,
  height: number,
  tiles: readonly number[],
): LevelEntity[] {
  return (src.entities ?? []).map((entity, index) => {
    if (entity.tileX < 0 || entity.tileY < 0 || entity.tileX >= width || entity.tileY >= height) {
      throw new LevelParseError(
        `entidade ${index} (${entity.type}) em (${entity.tileX}, ${entity.tileY}) está fora do mapa`,
      );
    }
    // Posicionar uma entidade dentro de parede é erro de autoria, e sem esta
    // checagem ela aparece presa no cenário só quando alguém joga a fase.
    const tile = tiles[entity.tileY * width + entity.tileX]!;
    if (!NON_SOLID.has(tile)) {
      throw new LevelParseError(
        `entidade ${index} (${entity.type}) em (${entity.tileX}, ${entity.tileY}) está dentro de um tile sólido`,
      );
    }
    const x = entity.tileX * src.tileWidth + src.tileWidth / 2;
    // Pés apoiados na BASE do tile indicado — mesma convenção do spawn.
    const y = (entity.tileY + 1) * src.tileHeight;
    const patrolPx = (entity.patrolTiles ?? 0) * src.tileWidth;
    return {
      type: entity.type,
      x,
      y,
      facing: entity.facing ?? 1,
      patrolLeft: patrolPx > 0 ? x - patrolPx : 0,
      patrolRight: patrolPx > 0 ? x + patrolPx : 0,
    };
  });
}

type Sampler = (x: number, y: number) => string;

function resolveTile(at: Sampler, x: number, y: number): number {
  const c = at(x, y);

  if (c === GROUND) {
    const open = at(x, y - 1) !== GROUND;
    const openL = at(x - 1, y) !== GROUND;
    const openR = at(x + 1, y) !== GROUND;
    if (open) return openL ? TILE.GroundTopL : openR ? TILE.GroundTopR : TILE.GroundTop;
    if (openL) return TILE.GroundL;
    if (openR) return TILE.GroundR;
    // Fundo do maciço fica mais escuro: dá profundidade sem custo nenhum.
    return at(x, y - 2) === GROUND ? TILE.GroundDeep : TILE.GroundMid;
  }

  if (c === PLATFORM) {
    const l = at(x - 1, y) === PLATFORM;
    const r = at(x + 1, y) === PLATFORM;
    if (!l && r) return TILE.PlatformL;
    if (l && !r) return TILE.PlatformR;
    if (!l && !r) return TILE.PlatformM;
    return TILE.PlatformM;
  }

  if (c === CONTAINER) {
    const top = at(x, y - 1) !== CONTAINER;
    const openL = at(x - 1, y) !== CONTAINER;
    const openR = at(x + 1, y) !== CONTAINER;
    if (top) return openL ? TILE.ContainerTL : openR ? TILE.ContainerTR : TILE.ContainerT;
    if (openL) return TILE.ContainerL;
    if (openR) return TILE.ContainerR;
    return TILE.ContainerM;
  }

  const simple = SIMPLE[c];
  if (simple === undefined) {
    throw new LevelParseError(`caractere desconhecido "${c}" em (${x}, ${y})`);
  }
  return simple;
}
