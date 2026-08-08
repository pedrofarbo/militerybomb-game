import { describe, expect, it } from 'vitest';
import { ONE_WAY_TILES, parseLevel, TILE } from '../../src/core/level/parse';
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
    expect(def.width).toBe(132);
    expect(def.height).toBe(30);
    expect(def.tiles).toHaveLength(132 * 30);
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

    const surfaceRow = 25;
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

  /**
   * Nenhuma plataforma pode ficar isolada. "Alcançável" tem duas formas:
   * subir com um pulo a partir de algo abaixo, ou cair de algo acima — a
   * torre é uma escalada, e a descida do outro lado só é acessível pelo topo.
   *
   * O limite de subida é DERIVADO da física: baixar a altura do pulo em
   * `tuning.ts` torna a rota alta impossível e o CI avisa, em vez de a falha
   * aparecer num playtest três semanas depois.
   */
  it('nenhuma plataforma fica isolada — dá para subir nela ou cair nela', () => {
    const apexPx = (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * PLAYER.gravityUp);
    // 75% do ápice: NO ÁPICE A VELOCIDADE VERTICAL É ZERO, então uma plataforma
    // exatamente nessa altura não é pousável — o corpo precisa passar por cima
    // da borda e estar descendo para o Arcade resolver o contato. Esta linha
    // existe porque a versão sem margem passou no teste e falhou no jogo.
    const maxRiseTiles = Math.floor((apexPx * 0.75) / def.tileHeight);
    // Queda: o alcance é bem maior que o de subida, mas não infinito — cair de
    // muito alto sem nada intermediário significa rota de mão única.
    const maxDropTiles = maxRiseTiles * 3;
    // Janela horizontal: o zigue-zague da torre desloca ~3 colunas por lance.
    const searchColumns = 8;

    const at = (x: number, y: number): number => def.tiles[y * def.width + x] ?? 0;
    const isSolid = (x: number, y: number): boolean =>
      x >= 0 && x < def.width && y >= 0 && y < def.height && def.solidTiles.has(at(x, y));

    const nearestSolid = (x: number, y: number, direction: -1 | 1, limit: number): number => {
      let best = Infinity;
      for (let dx = -searchColumns; dx <= searchColumns; dx++) {
        for (let step = 1; step <= limit; step++) {
          if (isSolid(x + dx, y + step * direction)) {
            best = Math.min(best, step);
            break;
          }
        }
      }
      return best;
    };

    const stranded: string[] = [];
    for (let y = 0; y < def.height; y++) {
      for (let x = 0; x < def.width; x++) {
        if (!ONE_WAY_TILES.has(at(x, y))) continue;

        const fromBelow = nearestSolid(x, y, 1, maxRiseTiles);
        const fromAbove = nearestSolid(x, y, -1, maxDropTiles);
        if (fromBelow > maxRiseTiles && fromAbove > maxDropTiles) {
          stranded.push(`plataforma isolada em (${x}, ${y})`);
        }
      }
    }

    expect(stranded).toEqual([]);
  });

  it('usa a altura do mundo — senão a câmera vertical não serve para nada', () => {
    // Viewport lógica tem 360 px; um mundo mais baixo que isso desperdiça
    // toda a lógica de âncora vertical da câmera.
    expect(def.bounds.height).toBeGreaterThan(360);
  });

  it('declara as camadas de parallax que o cenário espera', () => {
    expect(def.parallax.map((p) => p.image)).toEqual(['bg.bg_far', 'bg.bg_near', 'bg.fg_near']);
    expect(def.parallax.filter((p) => p.foreground)).toHaveLength(1);
  });
});
