/**
 * `LevelDef` → objetos Phaser.
 *
 * A Fase 1 alimenta o `LevelDef` a partir de ASCII; a Fase 3 vai alimentá-lo a
 * partir de `.tmj` do Tiled. Este arquivo não muda em nenhum dos dois casos —
 * é essa a razão de existir um `LevelDef` no meio.
 */

import Phaser from 'phaser';
import type { LevelDef } from '../../core/level/schema';
import { ONE_WAY_TILES } from '../../core/level/parse';
import type { IMAGES } from '../../assets/manifest';
import { DEPTH_BG_FAR, DEPTH_BG_NEAR, DEPTH_FG, DEPTH_TILES } from '../fx/FxService';

export interface BuiltLevel {
  layer: Phaser.Tilemaps.TilemapLayer;
  parallax: ParallaxLayer[];
  widthPx: number;
  heightPx: number;
}

export interface ParallaxLayer {
  image: Phaser.GameObjects.TileSprite;
  scrollFactor: number;
  foreground: boolean;
}

export function buildLevel(scene: Phaser.Scene, def: LevelDef): BuiltLevel {
  /* ── Parallax ── */
  const parallax: ParallaxLayer[] = [];
  for (const layerDef of def.parallax) {
    const key = layerDef.image as keyof typeof IMAGES;
    const texture = scene.textures.get(key);
    const source = texture.getSourceImage();
    const image = scene.add.tileSprite(0, layerDef.offsetY, source.width, source.height, key);
    image.setOrigin(0, 0);
    // scrollFactor 0: a posição é controlada manualmente para poder repetir a
    // textura indefinidamente sem precisar de N cópias do mesmo sprite.
    image.setScrollFactor(0);
    image.setDepth(
      layerDef.foreground ? DEPTH_FG : layerDef.scrollFactor < 0.25 ? DEPTH_BG_FAR : DEPTH_BG_NEAR,
    );
    parallax.push({
      image,
      scrollFactor: layerDef.scrollFactor,
      foreground: layerDef.foreground ?? false,
    });
  }

  /* ── Tilemap ── */
  const data: number[][] = [];
  for (let y = 0; y < def.height; y++) {
    const row: number[] = new Array<number>(def.width);
    for (let x = 0; x < def.width; x++) {
      const index = def.tiles[y * def.width + x]!;
      // -1 é "sem tile" para o Phaser: evita criar objeto de tile para o vazio.
      row[x] = index === 0 ? -1 : index;
    }
    data.push(row);
  }

  const map = scene.make.tilemap({
    data,
    tileWidth: def.tileWidth,
    tileHeight: def.tileHeight,
  });
  const tileset = map.addTilesetImage('tiles', 'tileset', def.tileWidth, def.tileHeight, 0, 0);
  if (!tileset) throw new Error('Tileset "tiles" não pôde ser criado');

  /* `gpu: false` explicitamente: a camada GPU do Phaser 4 é mais rápida para
     mapas enormes, mas não expõe colisão por tile — que é justamente o que um
     platformer precisa. Mapas do tamanho dos nossos não justificam a troca. */
  const created = map.createLayer(0, tileset, 0, 0, false);
  if (!(created instanceof Phaser.Tilemaps.TilemapLayer)) {
    throw new Error('Camada de tiles não pôde ser criada como TilemapLayer');
  }
  const layer = created;
  layer.setDepth(DEPTH_TILES);
  layer.setCollision([...def.solidTiles]);

  /* Plataformas de sentido único: colidem só por cima, então dá para pular
     através delas por baixo — parte do vocabulário do gênero. */
  layer.forEachTile((tile) => {
    if (ONE_WAY_TILES.has(tile.index)) tile.setCollision(false, false, true, false, false);
  });

  return {
    layer,
    parallax,
    widthPx: def.bounds.width,
    heightPx: def.bounds.height,
  };
}

/** Reposiciona as camadas de parallax conforme a câmera. */
export function updateParallax(
  layers: readonly ParallaxLayer[],
  camera: Phaser.Cameras.Scene2D.Camera,
  foregroundEnabled: boolean,
): void {
  for (const layer of layers) {
    if (layer.foreground && !foregroundEnabled) {
      layer.image.setVisible(false);
      continue;
    }
    layer.image.setVisible(true);
    layer.image.tilePositionX = camera.scrollX * layer.scrollFactor;
    layer.image.width = camera.width;
    // Camadas altas acompanham um pouco o eixo Y, sem colar nele.
    layer.image.tilePositionY = camera.scrollY * layer.scrollFactor * 0.35;
  }
}
