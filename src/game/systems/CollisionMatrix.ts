/**
 * TODA interação física do jogo é registrada aqui, e em nenhum outro lugar.
 *
 * Colisores espalhados pelas cenas são a origem de duas classes de bug que
 * custam caro: pares que ninguém lembra de registrar, e handlers duplicados
 * que vazam a cada spawn. Com um único arquivo, a matriz de colisão vira algo
 * que dá para LER de uma vez e conferir.
 *
 *                    tiles   player  inimigo  destrutível
 *   player            ▣        —        ◇         ▣
 *   inimigo           ▣        ◇        —         ▣
 *   tiro do player    ▣        —        ◇         ◇
 *   tiro do inimigo   ▣        ◇        ▣         —
 *   granada           ▣        —        —         —
 *
 *   ▣ colisão física   ◇ sobreposição (só dispara evento)
 */

import type Phaser from 'phaser';

/**
 * O Arcade entrega `Body | StaticBody | Tile | GameObjectWithBody` nos
 * callbacks. Normalizamos na fronteira para que o resto do jogo trabalhe só
 * com GameObject — em vez de espalhar casts por cada handler.
 */
type ArcadeObject =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile;

const asGameObject = (value: ArcadeObject): Phaser.GameObjects.GameObject =>
  value as unknown as Phaser.GameObjects.GameObject;

export interface CollisionParticipants {
  playerSprite: Phaser.Physics.Arcade.Sprite;
  tileLayer: Phaser.Tilemaps.TilemapLayer;
  enemies: Phaser.GameObjects.Group;
  destructibles: Phaser.GameObjects.Group;
  playerShots: Phaser.GameObjects.Group;
  enemyShots: Phaser.GameObjects.Group;
  grenades: Phaser.GameObjects.Group;
}

export interface CollisionHandlers {
  /** `true` mantém a colisão; `false` a ignora neste frame. */
  playerVsTile(tile: Phaser.Tilemaps.Tile): boolean;
  playerShotHitTile(shot: Phaser.GameObjects.GameObject): void;
  playerShotHitEnemy(
    shot: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ): void;
  playerShotHitDestructible(
    shot: Phaser.GameObjects.GameObject,
    target: Phaser.GameObjects.GameObject,
  ): void;
  enemyShotHitTile(shot: Phaser.GameObjects.GameObject): void;
  enemyShotHitPlayer(shot: Phaser.GameObjects.GameObject): void;
  playerTouchedEnemy(enemy: Phaser.GameObjects.GameObject): void;
}

export function registerCollisions(
  physics: Phaser.Physics.Arcade.ArcadePhysics,
  p: CollisionParticipants,
  h: CollisionHandlers,
): void {
  /* ── Cenário ── */
  physics.add.collider(p.playerSprite, p.tileLayer, undefined, (_sprite, tileObject) =>
    h.playerVsTile(tileObject as Phaser.Tilemaps.Tile),
  );
  physics.add.collider(p.enemies, p.tileLayer);
  physics.add.collider(p.grenades, p.tileLayer);

  /* Player e inimigos esbarram em destrutíveis, mas não uns nos outros: dois
     corpos se empurrando produz movimento que nenhum dos dois pediu. */
  physics.add.collider(p.playerSprite, p.destructibles);
  physics.add.collider(p.enemies, p.destructibles);

  /* ── Tiros do player ── */
  physics.add.collider(p.playerShots, p.tileLayer, (shot) =>
    h.playerShotHitTile(asGameObject(shot)),
  );
  physics.add.overlap(p.playerShots, p.enemies, (shot, enemy) =>
    h.playerShotHitEnemy(asGameObject(shot), asGameObject(enemy)),
  );
  physics.add.overlap(p.playerShots, p.destructibles, (shot, target) =>
    h.playerShotHitDestructible(asGameObject(shot), asGameObject(target)),
  );

  /* ── Tiros dos inimigos ──
     Param no cenário e nos destrutíveis (por isso o caixote serve de
     cobertura), mas atravessam outros inimigos: fogo amigo travando um
     corredor de soldados frustra sem acrescentar nada. */
  physics.add.collider(p.enemyShots, p.tileLayer, (shot) => h.enemyShotHitTile(asGameObject(shot)));
  physics.add.collider(p.enemyShots, p.destructibles, (shot) =>
    h.enemyShotHitTile(asGameObject(shot)),
  );
  physics.add.overlap(p.enemyShots, p.playerSprite, (shot) =>
    h.enemyShotHitPlayer(asGameObject(shot)),
  );

  /* ── Contato corpo a corpo ── */
  physics.add.overlap(p.playerSprite, p.enemies, (_player, enemy) =>
    h.playerTouchedEnemy(asGameObject(enemy)),
  );
}
