/**
 * FASE 1 — "Cais de Quarentena" (recorte jogável para validar o game feel).
 *
 * 132 × 30 tiles de 16 px = 2112 × 480 px de mundo. Um caractere por tile;
 * o mapa precisa ser retangular. O auto-tiling escolhe topo/meio/borda —
 * ver `core/level/parse.ts`.
 *
 *   .  vazio                 #  chão (auto-tiled)
 *   =  plataforma (colide só por cima — ↓ + pulo desce por ela)
 *   C  contêiner (auto)      X  parede de caixas
 *   r  trilho (decorativo)   !  faixa de perigo (decorativa)
 *   -  tubulação de teto (decorativa)
 *
 * Ritmo desenhado de propósito, sem inimigos ainda:
 *   col 0–19    desembarque plano — correr e pular sem risco
 *   col 22–35   plataformas: ensina verticalidade antes de qualquer ameaça
 *   col 40–43   primeiro vão (64 px); faixas amarelas marcam as duas bordas
 *   col 46–50   plataforma alta opcional depois do vão
 *   col 52–57   pilha de contêineres — atalho pelo alto
 *   col 60–65   degrau alto, seguido do vão em 66–69 (saltado de cima)
 *   col 71–92   TORRE: quatro plataformas em zigue-zague subindo 11 tiles.
 *               É a rota alta opcional, e é o que faz a câmera trabalhar em Y
 *               — o mundo tem 480 px de altura para 360 px de viewport.
 *   col 96–113  descida escalonada até o mirante
 *   col 114+    queda controlada e área final
 *
 * A subida entre plataformas é sempre de 3 tiles (48 px). O ápice do pulo é
 * 64 px, mas no ápice a velocidade vertical é ZERO — uma plataforma exatamente
 * nessa altura não é pousável. 3 tiles deixam 16 px de margem para o corpo
 * passar por cima da borda e descer sobre ela.
 *
 * Cair num vão leva o jogador para fora do mundo e dispara o respawn.
 */

import type { LevelSource } from '../schema';

export const LEVEL_01: LevelSource = {
  id: 'level-01',
  tileWidth: 16,
  tileHeight: 16,
  spawnTile: { x: 3, y: 24 },
  rows: [
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................--------------..................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '......................................................................................=======.......................................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '...............................................................................======...........======..............................',
    '....................................................................................................................................',
    '....................................................................................................................................',
    '........................................................................=====............................======.....................',
    '..............................................................................................................!!!!..................',
    '......................................................................................................############..................',
    '..............................======..........................................=====...................############..................',
    '..................................................................................................################..................',
    '..................................................................................................################..................',
    '......................======..................=====.CCCCCC....!!!!.....=====..................####################..................',
    '....................................................CCCCCC..######............................####################..................',
    '.....rrrrrrrr.......................!!!!....!!!!....CCCCCC..######....!!!!................########################..................',
    '########################################....######################....##############################################################',
    '########################################....######################....##############################################################',
    '########################################....######################....##############################################################',
    '########################################....######################....##############################################################',
    '########################################....######################....##############################################################',
  ],
  /**
   * `tileY` é o tile em cuja BASE os pés se apoiam — mesma convenção do spawn.
   * A dificuldade sobe por região, e cada encontro tem cobertura ou um barril
   * por perto: o jogador sempre tem uma resposta além de correr para frente.
   */
  entities: [
    // ── Primeiro contato (col 20–39): um soldado por vez, com caixa de cobertura
    { type: 'crate', tileX: 18, tileY: 24 },
    { type: 'soldier', tileX: 26, tileY: 24, facing: -1, patrolTiles: 4 },
    { type: 'barrel', tileX: 33, tileY: 24 },
    { type: 'soldier', tileX: 37, tileY: 24, facing: -1, patrolTiles: 2 },

    // ── Depois do primeiro vão (col 44–59): dois soldados e uma torreta alta
    { type: 'crate', tileX: 46, tileY: 24 },
    { type: 'barrel', tileX: 48, tileY: 24 },
    { type: 'soldier', tileX: 50, tileY: 24, facing: -1, patrolTiles: 3 },
    { type: 'turret', tileX: 55, tileY: 21, facing: -1 },

    // ── Degrau alto (col 60–65)
    { type: 'soldier', tileX: 62, tileY: 22, facing: -1, patrolTiles: 2 },

    // ── Base da torre (col 70–89): o pesado, com barril para quem entender
    { type: 'crate', tileX: 77, tileY: 24 },
    { type: 'barrel', tileX: 82, tileY: 24 },
    { type: 'heavy', tileX: 87, tileY: 24, facing: -1 },
    { type: 'turret', tileX: 80, tileY: 18, facing: -1 },

    // ── Escadaria (col 90–101)
    { type: 'soldier', tileX: 95, tileY: 21, facing: -1, patrolTiles: 2 },
    { type: 'generator', tileX: 99, tileY: 19 },

    // ── Mirante (col 102–113)
    { type: 'turret', tileX: 104, tileY: 17, facing: -1 },
    { type: 'barrel', tileX: 107, tileY: 17 },
    { type: 'soldier', tileX: 110, tileY: 17, facing: -1, patrolTiles: 3 },

    // ── Área final (col 114+)
    { type: 'crate', tileX: 120, tileY: 24 },
    { type: 'soldier', tileX: 124, tileY: 24, facing: -1, patrolTiles: 4 },
  ],
  parallax: [
    { image: 'bg.bg_far', scrollFactor: 0.15, offsetY: 0 },
    { image: 'bg.bg_near', scrollFactor: 0.35, offsetY: 24 },
    { image: 'bg.fg_near', scrollFactor: 1.15, offsetY: 24, foreground: true },
  ],
};
