import { describe, expect, it } from 'vitest';
import { parseLevel, TILE } from '../../src/core/level/parse';
import { LevelParseError, type LevelSource } from '../../src/core/level/schema';
import { LEVEL_01 } from '../../src/core/level/levels/level-01';
import { PLAYER } from '../../src/core/config/tuning';

function source(rows: string[], partial: Partial<LevelSource> = {}): LevelSource {
  return {
    id: 'test',
    tileWidth: 16,
    tileHeight: 16,
    rows,
    spawnTile: { x: 0, y: 0 },
    parallax: [],
    ...partial,
  };
}

describe('parse de fase — auto-tiling', () => {
  it('escolhe topo, meio e profundidade do chão', () => {
    const def = parseLevel(source(['....', '####', '####', '####'], { spawnTile: { x: 0, y: 0 } }));
    const at = (x: number, y: number): number => def.tiles[y * def.width + x]!;

    expect(at(1, 1)).toBe(TILE.GroundTop);
    expect(at(1, 2)).toBe(TILE.GroundMid);
    expect(at(1, 3)).toBe(TILE.GroundDeep);
  });

  it('escolhe as quinas do chão', () => {
    const def = parseLevel(source(['.....', '.###.', '.###.'], { spawnTile: { x: 0, y: 0 } }));
    const at = (x: number, y: number): number => def.tiles[y * def.width + x]!;

    expect(at(1, 1)).toBe(TILE.GroundTopL);
    expect(at(3, 1)).toBe(TILE.GroundTopR);
    expect(at(1, 2)).toBe(TILE.GroundL);
    expect(at(3, 2)).toBe(TILE.GroundR);
  });

  it('escolhe as pontas de plataforma', () => {
    const def = parseLevel(source(['.===.', '.....'], { spawnTile: { x: 0, y: 1 } }));
    const at = (x: number, y: number): number => def.tiles[y * def.width + x]!;

    expect(at(1, 0)).toBe(TILE.PlatformL);
    expect(at(2, 0)).toBe(TILE.PlatformM);
    expect(at(3, 0)).toBe(TILE.PlatformR);
  });
});

describe('parse de fase — validação', () => {
  it('rejeita mapa não retangular', () => {
    expect(() => parseLevel(source(['....', '###']))).toThrow(LevelParseError);
  });

  it('rejeita caractere desconhecido', () => {
    expect(() => parseLevel(source(['..?.', '####']))).toThrow(/desconhecido/);
  });

  it('rejeita spawn fora do mapa', () => {
    expect(() => parseLevel(source(['....'], { spawnTile: { x: 99, y: 0 } }))).toThrow(
      /fora do mapa/,
    );
  });

  it('rejeita spawn dentro de tile sólido', () => {
    expect(() => parseLevel(source(['####'], { spawnTile: { x: 1, y: 0 } }))).toThrow(/sólido/);
  });
});

describe('fase 1 — invariantes de level design', () => {
  const def = parseLevel(LEVEL_01);

  it('é retangular e tem o tamanho esperado', () => {
    expect(def.width).toBe(120);
    expect(def.height).toBe(24);
    expect(def.tiles).toHaveLength(120 * 24);
  });

  it('o spawn fica sobre chão sólido, não no vazio', () => {
    const spawnTileX = Math.floor(def.spawn.x / def.tileWidth);
    const spawnTileY = Math.floor(def.spawn.y / def.tileHeight) - 1;
    const below = def.tiles[(spawnTileY + 1) * def.width + spawnTileX]!;
    expect(def.solidTiles.has(below)).toBe(true);
  });

  /**
   * O alcance é DERIVADO das constantes de física, não chutado. Assim, ajustar
   * o pulo em `tuning.ts` quebra este teste se algum vão ficar intransponível —
   * que é exatamente o tipo de regressão que só apareceria num playtest.
   */
  it('nenhum vão excede o alcance de um pulo em corrida', () => {
    const timeUp = PLAYER.jumpVelocity / PLAYER.gravityUp;
    const apex = (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * PLAYER.gravityUp);
    const timeDown = Math.sqrt((2 * apex) / PLAYER.gravityDown);
    const reachPx = PLAYER.maxSpeed * (timeUp + timeDown);
    // 70% do alcance teórico: o resto é margem para timing humano. Um vão que
    // só passa com o frame exato não ensina nada, só pune.
    const maxGapTiles = Math.floor((reachPx * 0.7) / def.tileWidth);

    const surfaceRow = 19;
    let longestGap = 0;
    let gap = 0;
    for (let x = 0; x < def.width; x++) {
      const solid = def.solidTiles.has(def.tiles[surfaceRow * def.width + x]!);
      gap = solid ? 0 : gap + 1;
      longestGap = Math.max(longestGap, gap);
    }

    expect(longestGap).toBeGreaterThan(0); // a fase precisa ter algum vão
    expect(longestGap).toBeLessThanOrEqual(maxGapTiles);
  });

  it('declara as camadas de parallax que o cenário espera', () => {
    expect(def.parallax.map((p) => p.image)).toEqual(['bg.bg_far', 'bg.bg_near', 'bg.fg_near']);
    expect(def.parallax.filter((p) => p.foreground)).toHaveLength(1);
  });
});
