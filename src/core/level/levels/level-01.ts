/**
 * FASE 1 — "Cais de Quarentena", do desembarque à extração.
 *
 * 180 × 30 tiles de 16 px = 2880 × 480 px de mundo. Um caractere por tile;
 * o mapa precisa ser retangular. O auto-tiling escolhe topo/meio/borda —
 * ver `core/level/parse.ts`.
 *
 *   .  vazio                 #  chão (auto-tiled)
 *   =  plataforma (colide só por cima — ↓ + pulo desce por ela)
 *   C  contêiner (auto)      X  parede de caixas
 *   r  trilho (decorativo)   !  faixa de perigo (decorativa)
 *   -  tubulação de teto (decorativa)
 *
 * Ritmo, seguindo o roteiro do plano técnico §12:
 *   col 0–19    DESEMBARQUE — plano e sem ameaça: correr e pular sem risco
 *   col 22–35   PRIMEIRO CONTATO — plataformas e os dois primeiros soldados
 *   col 40–43   primeiro vão (64 px); faixas amarelas marcam as duas bordas
 *   col 46–57   torreta alta e pilha de contêineres; metralhadora como prêmio
 *   col 60–69   degrau alto e o segundo vão, saltado de cima
 *   col 62      CHECKPOINT — a metade da caminhada, antes da torre
 *   col 71–92   TORRE: quatro plataformas em zigue-zague subindo 11 tiles.
 *               É a rota alta opcional, e é o que faz a câmera trabalhar em Y
 *               — o mundo tem 480 px de altura para 360 px de viewport.
 *   col 96–113  PRESSÃO — descida escalonada, pesado e torreta no mirante
 *   col 110     escopeta, como recompensa por limpar o mirante
 *   col 114–126 corredor final; CHECKPOINT em 122, antes da arena
 *   col 132     SOLEIRA DA ARENA — cruzá-la fecha o portão e acorda o boss
 *   col 133–172 ARENA DO ESTIVADOR — 640 px, exatamente uma viewport, com
 *               duas plataformas a 48 px do chão: é por cima delas que a
 *               investida passa por baixo. São elas o contra-ataque da luta.
 *   col 176     PORTÃO DE EXTRAÇÃO — só alcançável depois do boss
 *
 * O portão de saída fica 4 colunas antes da borda do mundo, e não NA borda:
 * quem corre segurando → precisa de espaço para o gatilho disparar antes de
 * bater no limite. Sem ele o jogador saía do mapa e caía no vazio.
 *
 * A subida entre plataformas é sempre de 3 tiles (48 px). O ápice do pulo é
 * 64 px, mas no ápice a velocidade vertical é ZERO — uma plataforma exatamente
 * nessa altura não é pousável. 3 tiles deixam 16 px de margem para o corpo
 * passar por cima da borda e descer sobre ela.
 *
 * Cair num vão leva o jogador para fora do mundo e custa uma vida.
 */

import type { LevelSource } from '../schema';

export const LEVEL_01: LevelSource = {
  id: 'level-01',
  tileWidth: 16,
  tileHeight: 16,
  spawnTile: { x: 3, y: 24 },
  rows: [
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................--------------......................................................................................................----------------------------------..........',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '......................................................................................=======.......................................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '...............................................................................======...........======..............................................................................',
    '....................................................................................................................................................................................',
    '....................................................................................................................................................................................',
    '........................................................................=====............................======.....................................................................',
    '..............................................................................................................!!!!..................................................................',
    '......................................................................................................############..................................................................',
    '..............................======..........................................=====...................############..................................................................',
    '..................................................................................................################..................................................................',
    '..................................................................................................################..................................................................',
    '......................======..................=====.CCCCCC....!!!!.....=====..................####################.........................=====...............=====................',
    '....................................................CCCCCC..######............................####################..................................................................',
    '.....rrrrrrrr.......................!!!!....!!!!....CCCCCC..######....!!!!................########################...................!!!!................................!!!!.......',
    '########################################....######################....##############################################################################################################',
    '########################################....######################....##############################################################################################################',
    '########################################....######################....##############################################################################################################',
    '########################################....######################....##############################################################################################################',
    '########################################....######################....##############################################################################################################',
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

    /* ── Depois do primeiro vão (col 44–59): dois soldados e uma torreta alta
       A metralhadora fica logo depois do vão: a recompensa por atravessar
       chega junto com o trecho em que ela passa a ser necessária. */
    { type: 'pickup', tileX: 45, tileY: 24, variant: 'weapon_mg' },
    { type: 'crate', tileX: 46, tileY: 24 },
    { type: 'barrel', tileX: 48, tileY: 24 },
    { type: 'soldier', tileX: 50, tileY: 24, facing: -1, patrolTiles: 3 },
    { type: 'turret', tileX: 55, tileY: 21, facing: -1 },

    // ── Degrau alto (col 60–65)
    { type: 'soldier', tileX: 62, tileY: 22, facing: -1, patrolTiles: 2 },
    /* CHECKPOINT no alto do degrau, na metade da caminhada e ANTES da torre.
       Colocado num ponto seguro de propósito: reaparecer já sob tiro é a forma
       mais rápida de transformar uma morte em três. */
    { type: 'checkpoint', tileX: 64, tileY: 22, id: 'cp-degrau' },

    // ── Base da torre (col 70–89): o pesado, com barril para quem entender
    { type: 'crate', tileX: 77, tileY: 24 },
    { type: 'barrel', tileX: 82, tileY: 24 },
    { type: 'heavy', tileX: 87, tileY: 24, facing: -1 },
    { type: 'turret', tileX: 80, tileY: 18, facing: -1 },

    // ── Escadaria (col 90–101)
    { type: 'soldier', tileX: 95, tileY: 21, facing: -1, patrolTiles: 2 },
    { type: 'generator', tileX: 99, tileY: 19 },

    // ── Mirante (col 102–113) — a escopeta é o prêmio por limpar daqui
    { type: 'turret', tileX: 104, tileY: 17, facing: -1 },
    { type: 'barrel', tileX: 107, tileY: 17 },
    { type: 'soldier', tileX: 110, tileY: 17, facing: -1, patrolTiles: 3 },
    { type: 'pickup', tileX: 112, tileY: 17, variant: 'weapon_sg' },

    // ── Corredor final (col 114–131)
    { type: 'crate', tileX: 120, tileY: 24 },
    { type: 'soldier', tileX: 124, tileY: 24, facing: -1, patrolTiles: 4 },
    /* Último fôlego antes do boss: vida, granadas e um checkpoint. Entrar na
       arena com 1 de vida e sem granada não é dificuldade, é perda de tempo —
       a luta já custa 30 s de atenção antes de dar qualquer resposta. */
    { type: 'pickup', tileX: 128, tileY: 24, variant: 'health' },
    { type: 'pickup', tileX: 130, tileY: 24, variant: 'grenade' },
    { type: 'checkpoint', tileX: 129, tileY: 24, id: 'cp-arena' },

    // ── Arena do Estivador (col 133–172)
    { type: 'arena', tileX: 133, tileY: 24, spanTiles: 40 },
    { type: 'boss', tileX: 162, tileY: 24, facing: -1 },
    // Dois barris na arena: cenário como arma, também contra o boss.
    { type: 'barrel', tileX: 145, tileY: 24 },
    { type: 'barrel', tileX: 155, tileY: 24 },
    /* Um kit de vida no fundo da arena. Convenção de arcade, e serve a dois
       propósitos: dá fôlego a quem está apanhando e dá um motivo para
       atravessar a arena, em vez de acampar num canto atirando. */
    { type: 'pickup', tileX: 169, tileY: 24, variant: 'health' },

    // ── Extração (col 173+)
    { type: 'exit', tileX: 176, tileY: 24 },
  ],
  parallax: [
    { image: 'bg.bg_far', scrollFactor: 0.15, offsetY: 0 },
    { image: 'bg.bg_near', scrollFactor: 0.35, offsetY: 24 },
    { image: 'bg.fg_near', scrollFactor: 1.15, offsetY: 24, foreground: true },
  ],
};
