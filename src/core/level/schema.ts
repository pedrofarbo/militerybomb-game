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

/** Tipos que uma fase pode posicionar, agrupados por como a cena os constrói. */
export type EnemyEntityType = 'soldier' | 'heavy' | 'turret';
export type DestructibleEntityType = 'crate' | 'barrel' | 'generator';
/** Marcadores: não têm vida nem colisão sólida, só disparam algo ao encostar. */
export type MarkerEntityType = 'exit' | 'checkpoint' | 'pickup' | 'boss' | 'arena';
export type LevelEntityType = EnemyEntityType | DestructibleEntityType | MarkerEntityType;

/* Conjuntos em runtime para a cena decidir o que instanciar. Ficam aqui, ao
   lado dos tipos, porque esquecer de atualizar um dos dois é como um tipo novo
   vira "destrutível" por engano — foi assim que `exit` quase virou um caixote. */
export const ENEMY_ENTITY_TYPES: ReadonlySet<LevelEntityType> = new Set<LevelEntityType>([
  'soldier',
  'heavy',
  'turret',
]);
export const DESTRUCTIBLE_ENTITY_TYPES: ReadonlySet<LevelEntityType> = new Set<LevelEntityType>([
  'crate',
  'barrel',
  'generator',
]);
export const MARKER_ENTITY_TYPES: ReadonlySet<LevelEntityType> = new Set<LevelEntityType>([
  'exit',
  'checkpoint',
  'pickup',
  'boss',
  'arena',
]);

/** O que um `pickup` entrega. Chave lógica, não sprite — o sprite é derivado. */
export type PickupVariant = 'weapon_mg' | 'weapon_sg' | 'grenade' | 'health' | 'ammo';

export const PICKUP_VARIANTS: ReadonlySet<string> = new Set<PickupVariant>([
  'weapon_mg',
  'weapon_sg',
  'grenade',
  'health',
  'ammo',
]);

/** Posicionamento na fonte da fase: coordenadas em TILES, legíveis à mão. */
export interface LevelEntitySource {
  readonly type: LevelEntityType;
  readonly tileX: number;
  /** Tile onde os PÉS ficam apoiados (a base do tile). */
  readonly tileY: number;
  readonly facing?: -1 | 1;
  /** Meia-largura da patrulha, em tiles. Ausente = não patrulha. */
  readonly patrolTiles?: number;
  /** Só para `pickup`: o que ele entrega. */
  readonly variant?: PickupVariant;
  /** Identificador estável. Obrigatório em `checkpoint` — é a chave do save. */
  readonly id?: string;
  /**
   * Só para `arena`: largura da área travada, em tiles, a partir de `tileX`.
   * A câmera prende aqui durante a luta e o portão fecha na entrada.
   */
  readonly spanTiles?: number;
}

/** Posicionamento já resolvido em pixels de mundo. */
export interface LevelEntity {
  readonly type: LevelEntityType;
  readonly x: number;
  readonly y: number;
  readonly facing: -1 | 1;
  readonly patrolLeft: number;
  readonly patrolRight: number;
  readonly variant?: PickupVariant;
  readonly id?: string;
  /** Largura da arena em px (0 quando não é `arena`). */
  readonly spanPx: number;
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
  readonly entities: readonly LevelEntity[];
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
  readonly entities?: readonly LevelEntitySource[];
}

export class LevelParseError extends Error {
  constructor(message: string) {
    super(`Fase inválida: ${message}`);
    this.name = 'LevelParseError';
  }
}
