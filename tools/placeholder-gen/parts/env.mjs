/**
 * CENÁRIO — tileset 16x16, props destrutíveis, pickups e camadas de parallax.
 * O tileset sai como imagem própria (o Tiled referencia um arquivo de tileset,
 * não um atlas); props e pickups vão para o atlas `env`.
 */
import { Canvas } from '../canvas.mjs';
import { mulberry32 } from '../palette.mjs';

export const TILE = 16;
export const TILESET_COLS = 8;

/**
 * Índices do tileset (base 0). Exportados também em
 * public/assets/levels/tileset.json — é essa a lista que o Tiled e o
 * LevelBuilder consomem. Nunca reordenar sem migrar as fases existentes.
 */
export const TILES = [
  'empty',
  'ground_top_l',
  'ground_top',
  'ground_top_r',
  'ground_mid',
  'ground_deep',
  'ground_l',
  'ground_r',
  'platform_l',
  'platform_m',
  'platform_r',
  'crate_wall',
  'pipe_h',
  'pipe_v',
  'grate',
  'hazard_stripe',
  'container_tl',
  'container_t',
  'container_tr',
  'container_l',
  'container_m',
  'container_r',
  'ladder',
  'rail',
];

function drawTile(c, x, y, id) {
  const T = TILE;
  const gx = x;
  const gy = y;
  const speck = mulberry32(id * 97 + 13);
  const grit = (fill, n = 6) => {
    for (let i = 0; i < n; i++) {
      const px = gx + Math.floor(speck() * T);
      const py = gy + Math.floor(speck() * T);
      c.rect(px, py, 1, 1, fill);
    }
  };

  switch (TILES[id]) {
    case 'empty':
      break;
    case 'ground_top':
    case 'ground_top_l':
    case 'ground_top_r': {
      c.rect(gx, gy, T, T, 'con2');
      c.rect(gx, gy, T, 4, 'con4');
      c.rect(gx, gy, T, 1, 'con5');
      grit('con3', 8);
      if (TILES[id] === 'ground_top_l') c.rect(gx, gy, 1, T, 'ink');
      if (TILES[id] === 'ground_top_r') c.rect(gx + T - 1, gy, 1, T, 'ink');
      break;
    }
    case 'ground_mid':
      c.rect(gx, gy, T, T, 'con2');
      grit('con3', 10);
      c.rect(gx, gy + 8, T, 1, 'con1');
      break;
    case 'ground_deep':
      c.rect(gx, gy, T, T, 'con1');
      grit('con2', 8);
      break;
    case 'ground_l':
      c.rect(gx, gy, T, T, 'con2');
      c.rect(gx, gy, 2, T, 'con3');
      c.rect(gx, gy, 1, T, 'ink');
      grit('con3', 6);
      break;
    case 'ground_r':
      c.rect(gx, gy, T, T, 'con2');
      c.rect(gx + T - 2, gy, 2, T, 'con3');
      c.rect(gx + T - 1, gy, 1, T, 'ink');
      grit('con3', 6);
      break;
    case 'platform_l':
    case 'platform_m':
    case 'platform_r': {
      c.rect(gx, gy, T, 7, 'met2');
      c.rect(gx, gy, T, 2, 'met4');
      c.rect(gx, gy + 6, T, 1, 'ink');
      for (let i = 0; i < 4; i++) c.rect(gx + 1 + i * 4, gy + 3, 2, 2, 'met1');
      if (TILES[id] === 'platform_l') c.rect(gx, gy, 2, 7, 'met3');
      if (TILES[id] === 'platform_r') c.rect(gx + T - 2, gy, 2, 7, 'met3');
      break;
    }
    case 'crate_wall':
      c.block(gx, gy, T, T, 'rust2', { outline: 'ink', top: 'rust3' });
      c.line(gx + 1, gy + 1, gx + T - 2, gy + T - 2, 'rust1');
      break;
    case 'pipe_h':
      c.rect(gx, gy + 4, T, 8, 'met2');
      c.rect(gx, gy + 5, T, 2, 'met4');
      c.rect(gx, gy + 11, T, 1, 'ink');
      c.rect(gx + 6, gy + 3, 4, 10, 'met3');
      break;
    case 'pipe_v':
      c.rect(gx + 4, gy, 8, T, 'met2');
      c.rect(gx + 5, gy, 2, T, 'met4');
      c.rect(gx + 3, gy + 6, 10, 4, 'met3');
      break;
    case 'grate':
      c.rect(gx, gy, T, T, 'con1');
      for (let i = 0; i < 4; i++) c.rect(gx + 1, gy + 1 + i * 4, T - 2, 2, 'met1');
      c.stroke(gx, gy, T, T, 'con3');
      break;
    case 'hazard_stripe':
      for (let i = 0; i < T; i++)
        for (let j = 0; j < T; j++) c.rect(gx + i, gy + j, 1, 1, (i + j) % 8 < 4 ? 'sig3' : 'ink');
      break;
    case 'container_tl':
    case 'container_t':
    case 'container_tr':
    case 'container_l':
    case 'container_m':
    case 'container_r': {
      const top = TILES[id].startsWith('container_t');
      c.rect(gx, gy, T, T, 'teal2');
      for (let i = 0; i < 3; i++) c.rect(gx + 2 + i * 5, gy, 3, T, 'teal3');
      if (top) {
        c.rect(gx, gy, T, 3, 'teal4');
        c.rect(gx, gy, T, 1, 'ink');
      }
      if (TILES[id].endsWith('_tl') || TILES[id].endsWith('_l')) c.rect(gx, gy, 1, T, 'ink');
      if (TILES[id].endsWith('_tr') || TILES[id].endsWith('_r'))
        c.rect(gx + T - 1, gy, 1, T, 'ink');
      break;
    }
    case 'ladder':
      c.rect(gx + 3, gy, 2, T, 'met3');
      c.rect(gx + T - 5, gy, 2, T, 'met3');
      c.rect(gx + 3, gy + 3, T - 6, 2, 'met4');
      c.rect(gx + 3, gy + 11, T - 6, 2, 'met4');
      break;
    case 'rail':
      c.rect(gx, gy + 2, T, 3, 'met3');
      c.rect(gx, gy + 12, T, 4, 'con2');
      c.rect(gx + 6, gy + 5, 4, 7, 'met2');
      break;
  }
}

/** Imagem do tileset para o Tiled. */
export function buildTileset() {
  const rows = Math.ceil(TILES.length / TILESET_COLS);
  const c = new Canvas(TILESET_COLS * TILE, rows * TILE);
  TILES.forEach((_, id) =>
    drawTile(c, (id % TILESET_COLS) * TILE, Math.floor(id / TILESET_COLS) * TILE, id),
  );
  return c;
}

/* ───────────────────────── Props e pickups ───────────────────────── */

function frame(w, h, draw) {
  const c = new Canvas(w, h);
  draw(c);
  return c;
}

export function buildEnvFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });

  // Caixote destrutível 32x32: intacto, rachado, destruído
  add(
    `prop/crate/0`,
    frame(32, 32, (c) => {
      c.block(1, 1, 30, 30, 'rust2', { outline: 'ink', top: 'rust3' });
      c.rect(4, 4, 24, 24, 'rust1');
      c.rect(6, 6, 20, 20, 'rust2');
      c.rect(10, 12, 12, 8, 'sig2');
      c.rect(11, 13, 10, 6, 'ink');
      c.rect(12, 15, 8, 2, 'sig3');
    }),
  );
  add(
    `prop/crate/1`,
    frame(32, 32, (c) => {
      c.block(1, 2, 30, 29, 'rust2', { outline: 'ink', top: 'rust3' });
      c.rect(4, 5, 24, 23, 'rust1');
      c.line(6, 6, 18, 26, 'ink');
      c.line(18, 26, 26, 10, 'ink');
      c.rect(10, 13, 12, 7, 'sig1');
    }),
  );
  add(
    `prop/crate/2`,
    frame(32, 32, (c) => {
      c.block(2, 22, 12, 9, 'rust1', { outline: 'ink' });
      c.block(16, 25, 14, 6, 'rust2', { outline: 'ink' });
      c.rect(9, 18, 4, 4, 'rust1');
    }),
  );

  // Barril explosivo 24x32
  add(
    `prop/barrel/0`,
    frame(24, 32, (c) => {
      c.block(3, 2, 18, 29, 'sig2', { outline: 'ink', top: 'sig3' });
      c.rect(3, 9, 18, 3, 'sig1');
      c.rect(3, 21, 18, 3, 'sig1');
      c.rect(8, 13, 8, 7, 'ink');
      c.rect(9, 14, 6, 5, 'haz');
    }),
  );
  add(
    `prop/barrel/1`,
    frame(24, 32, (c) => {
      c.block(3, 2, 18, 29, 'sig3', { outline: 'ink', top: 'sig4' });
      c.rect(3, 9, 18, 3, 'sig2');
      c.rect(8, 13, 8, 7, 'fx1');
    }),
  );

  // Gerador 32x48 (destrutível grande)
  add(
    `prop/generator/0`,
    frame(32, 48, (c) => {
      c.block(2, 8, 28, 39, 'met2', { outline: 'ink', top: 'met3' });
      c.block(6, 12, 20, 16, 'teal2', { outline: 'ink' });
      c.rect(8, 14, 16, 4, 'teal4');
      for (let i = 0; i < 4; i++) c.rect(6, 32 + i * 3, 20, 2, 'met1');
      c.rect(10, 2, 12, 7, 'met1');
      c.rect(12, 0, 8, 3, 'met3');
    }),
  );
  add(
    `prop/generator/1`,
    frame(32, 48, (c) => {
      c.block(2, 8, 28, 39, 'met1', { outline: 'ink' });
      c.block(6, 12, 20, 16, 'ink', { outline: 'met2' });
      c.rect(9, 15, 6, 5, 'fx3');
      c.rect(16, 34, 10, 3, 'ink');
    }),
  );

  // Checkpoint 32x64: inativo (1) + ativo (4 frames de pulso)
  add(
    `prop/checkpoint/off/0`,
    frame(32, 64, (c) => {
      c.block(12, 6, 8, 56, 'met2', { outline: 'ink', top: 'met3' });
      c.block(6, 58, 20, 6, 'con3', { outline: 'ink' });
      c.block(8, 8, 16, 14, 'con2', { outline: 'ink' });
      c.rect(11, 12, 10, 6, 'con1');
    }),
  );
  for (let i = 0; i < 4; i++)
    add(
      `prop/checkpoint/on/${i}`,
      frame(32, 64, (c) => {
        c.block(12, 6, 8, 56, 'met3', { outline: 'ink', top: 'met4' });
        c.block(6, 58, 20, 6, 'con4', { outline: 'ink' });
        c.block(8, 8, 16, 14, 'con2', { outline: 'ink' });
        c.rect(11, 12, 10, 6, i % 2 ? 'sig4' : 'sig3');
        c.rect(4, 26 - i * 3, 24, 2, 'sig3', 200 - i * 45);
      }),
    );

  // Portão da arena do boss 64x96
  add(
    `prop/gate/0`,
    frame(64, 96, (c) => {
      c.block(0, 0, 64, 12, 'met1', { outline: 'ink' });
      c.block(4, 12, 56, 12, 'met2', { outline: 'ink', top: 'met3' });
      for (let i = 0; i < 16; i++) c.rect(2 + i * 4, 4, 2, 4, i % 2 ? 'sig3' : 'ink');
    }),
  );
  add(
    `prop/gate/1`,
    frame(64, 96, (c) => {
      c.block(0, 0, 64, 96, 'met1', { outline: 'ink' });
      for (let i = 0; i < 8; i++) c.rect(4, 6 + i * 12, 56, 8, 'met2');
      for (let i = 0; i < 16; i++) c.rect(2 + i * 4, 88, 2, 6, i % 2 ? 'sig3' : 'ink');
      c.rect(26, 42, 12, 12, 'haz');
    }),
  );

  // Pickups 16x16 — 2 frames (flutuação)
  const pickups = [
    ['weapon_mg', 'teal4', 'teal2'],
    ['weapon_sg', 'rust4', 'rust2'],
    ['grenade', 'sig3', 'sig1'],
    ['health', 'haz', 'hazDark'],
    ['ammo', 'met4', 'met2'],
  ];
  for (const [key, a, b] of pickups)
    for (let i = 0; i < 2; i++)
      add(
        `pickup/${key}/${i}`,
        frame(16, 16, (c) => {
          const y = i;
          c.block(2, 2 + y, 12, 12, b, { outline: 'ink', top: a });
          c.rect(5, 5 + y, 6, 6, a);
          c.rect(0, 14, 16, 2, 'ink', 70);
        }),
      );

  return out;
}

/* ─────────────────────────── Parallax ─────────────────────────── */

/** Camadas de fundo, 640x360, encaixáveis horizontalmente (tileable). */
export function buildParallaxLayers() {
  const W = 640;
  const H = 360;
  const layers = {};

  // Distante: céu tóxico + silhueta de refinaria
  {
    const c = new Canvas(W, H);
    // Céu de fim de tarde tóxico: teal escuro no alto → laranja sujo no horizonte.
    const SKY = ['teal1', 'teal1', 'teal2', 'con1', 'rust1', 'rust2', 'rust3'];
    const bands = [0.0, 0.3, 0.44, 0.54, 0.62, 0.68, 0.72];
    for (let y = 0; y < H; y++) {
      const t = y / H;
      let idx = 0;
      while (idx < bands.length - 1 && t >= bands[idx + 1]) idx++;
      c.rect(0, y, W, 1, t > 0.74 ? 'con1' : SKY[idx]);
    }
    c.disc(W - 150, 200, 30, 'sig2');
    c.disc(W - 150, 200, 24, 'sig3');
    // Silhuetas de refinaria: escuras contra o céu, contraste baixíssimo entre si.
    const rnd = mulberry32(42);
    for (let x = 0; x < W; x += 40) {
      const h = 46 + Math.floor(rnd() * 34);
      const w = 22 + Math.floor(rnd() * 26);
      c.rect(x, H - 96 - h, w, h + 96, 'con1');
      c.rect(x + 3, H - 96 - h, 2, h + 40, 'con2');
      // Chaminé ocasional com luz de sinalização
      if (rnd() > 0.55) {
        const cx = x + (w >> 1);
        c.rect(cx - 3, H - 96 - h - 26, 6, 26, 'con1');
        c.rect(cx - 1, H - 96 - h - 28, 2, 2, 'haz');
      }
    }
    c.rect(0, H - 96, W, 96, 'con1');
    layers['bg_far'] = c;
  }

  // Próximo: guindastes e contêineres
  {
    const c = new Canvas(W, H);
    const rnd = mulberry32(99);
    for (let i = 0; i < 8; i++) {
      const x = i * 84 + Math.floor(rnd() * 20);
      const h = 90 + Math.floor(rnd() * 60);
      c.rect(x, H - h, 10, h, 'con2');
      c.rect(x - 26, H - h, 62, 8, 'con3');
      c.rect(x + 30, H - h, 4, 26, 'con2');
      c.rect(x - 2, H - h - 6, 14, 6, 'con3');
    }
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(rnd() * W);
      const y = H - 40 - Math.floor(rnd() * 30);
      const col = ['teal2', 'rust2', 'con3', 'sig1'][Math.floor(rnd() * 4)];
      c.block(x, y, 34, 18, col, { outline: 'con1' });
    }
    c.rect(0, H - 24, W, 24, 'con2');
    layers['bg_near'] = c;
  }

  // Primeiro plano: vinheta baixa de cais (usada com parcimônia)
  {
    const c = new Canvas(W, H);
    for (let x = 0; x < W; x += 64) {
      c.block(x + 8, H - 26, 12, 26, 'con1', { outline: 'ink' });
      c.rect(x + 6, H - 30, 16, 5, 'con2');
    }
    c.rect(0, H - 6, W, 6, 'ink');
    layers['fg_near'] = c;
  }

  return layers;
}
