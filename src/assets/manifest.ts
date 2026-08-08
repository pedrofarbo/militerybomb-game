/**
 * Ponte entre chaves lógicas e arquivos.
 *
 * O gameplay referencia `'player.run'`; nunca um caminho. A tabela concreta é
 * gerada junto com os assets (`npm run art:placeholders`), então renomear um
 * arquivo não pode quebrar o jogo em silêncio — quebra a compilação.
 */

export {
  ATLASES,
  IMAGES,
  ANIMS,
  SPRITES,
  ART_METRICS,
  PALETTE,
  type AtlasKey,
  type ImageKey,
  type AnimDef,
  type AnimKey,
  type SpriteKey,
} from './sprite-manifest.generated';
