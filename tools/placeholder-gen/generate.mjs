#!/usr/bin/env node
/**
 * Gera TODOS os assets placeholder do REDLINE.
 *
 *   node tools/placeholder-gen/generate.mjs
 *
 * Saída (determinística — rodar duas vezes não produz diff no git):
 *   public/assets/atlas/{characters,enemies,boss,fx,env,ui}.{png,json}
 *   public/assets/levels/tileset.png
 *   public/assets/env/{bg_far,bg_near,fg_near}.png
 *   src/assets/sprite-manifest.generated.ts
 *   docs/placeholder-preview.html
 *
 * Os placeholders respeitam a mesma especificação exigida da arte final
 * (docs/ART_SPEC.md): mesmos tamanhos de frame, mesmos pivôs, mesma contagem
 * de frames, mesma paleta. Trocar por arte definitiva é substituir os PNG/JSON.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePng } from './png.mjs';
import { writeAtlas } from './atlas.mjs';
import { PALETTE, PALETTE_SIZE } from './palette.mjs';
import { ANIMS, STATIC_SPRITES } from './anims.mjs';
import {
  buildCharacterFrames,
  PLAYER_FRAME,
  PLAYER_ARM_FRAME,
  PLAYER_SHOULDER,
  PLAYER_SHOULDER_CROUCH,
  PLAYER_BODY_BOX,
  PLAYER_BODY_BOX_CROUCH,
} from './parts/characters.mjs';
import { buildEnemyFrames, ENEMY_FRAMES } from './parts/enemies.mjs';
import { buildBossFrames, BOSS_FRAMES, BOSS_ANCHORS } from './parts/boss.mjs';
import { buildFxFrames } from './parts/fx.mjs';
import {
  buildEnvFrames,
  buildTileset,
  buildParallaxLayers,
  TILE,
  TILES,
  TILESET_COLS,
} from './parts/env.mjs';
import { buildUiFrames } from './parts/ui.mjs';
import { buildPreview } from './preview.mjs';
import { buildInventory } from './inventory.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS_DIR = `${ROOT}/public/assets/atlas`;
const LEVEL_DIR = `${ROOT}/public/assets/levels`;
const ENV_DIR = `${ROOT}/public/assets/env`;

for (const d of [ATLAS_DIR, LEVEL_DIR, ENV_DIR, `${ROOT}/src/assets`, `${ROOT}/docs`]) {
  mkdirSync(d, { recursive: true });
}

const atlasSources = {
  characters: buildCharacterFrames(),
  enemies: buildEnemyFrames(),
  boss: buildBossFrames(),
  fx: buildFxFrames(),
  env: buildEnvFrames(),
  ui: buildUiFrames(),
};

/* ── Validação: toda animação declarada precisa existir de fato ── */
const errors = [];
const frameIndex = new Map(
  Object.entries(atlasSources).map(([name, frames]) => [name, new Set(frames.map((f) => f.name))]),
);
for (const a of ANIMS) {
  const set = frameIndex.get(a.atlas);
  if (!set) {
    errors.push(`anim "${a.key}": atlas desconhecido "${a.atlas}"`);
    continue;
  }
  for (let i = 0; i < a.frames; i++) {
    if (!set.has(`${a.prefix}${i}`))
      errors.push(`anim "${a.key}": frame ausente "${a.prefix}${i}"`);
  }
}
for (const s of STATIC_SPRITES) {
  const set = frameIndex.get(s.atlas);
  if (!set?.has(s.frame)) errors.push(`sprite "${s.key}": frame ausente "${s.frame}"`);
}
const dupes = ANIMS.map((a) => a.key).filter((k, i, arr) => arr.indexOf(k) !== i);
if (dupes.length) errors.push(`chaves de animação duplicadas: ${dupes.join(', ')}`);
if (PALETTE_SIZE !== 48) errors.push(`paleta tem ${PALETTE_SIZE} cores, deveria ter 48`);

if (errors.length) {
  console.error('\n✖ Geração abortada:\n' + errors.map((e) => `  - ${e}`).join('\n') + '\n');
  process.exit(1);
}

/* ── Atlases ── */
const report = [];
for (const [name, frames] of Object.entries(atlasSources)) {
  report.push(writeAtlas(ATLAS_DIR, name, frames));
}

/* ── Tileset ── */
const tileset = buildTileset();
writeFileSync(`${LEVEL_DIR}/tileset.png`, encodePng(tileset.w, tileset.h, tileset.data));
writeFileSync(
  `${LEVEL_DIR}/tileset.json`,
  JSON.stringify(
    {
      name: 'redline-industrial',
      tileWidth: TILE,
      tileHeight: TILE,
      columns: TILESET_COLS,
      count: TILES.length,
      image: 'tileset.png',
      /** Índice → nome. `solid` marca os tiles com colisão. */
      tiles: TILES.map((id, i) => ({
        index: i,
        id,
        solid: !['empty', 'ladder', 'rail', 'hazard_stripe'].includes(id),
      })),
      note: 'PLACEHOLDER — gerado por tools/placeholder-gen.',
    },
    null,
    '\t',
  ) + '\n',
);

/* ── Parallax ── */
const layers = buildParallaxLayers();
for (const [name, c] of Object.entries(layers)) {
  writeFileSync(`${ENV_DIR}/${name}.png`, encodePng(c.w, c.h, c.data));
}

/* ── Manifesto TypeScript ── */
const ts = `/* eslint-disable */
/**
 * GERADO AUTOMATICAMENTE por tools/placeholder-gen — NÃO EDITAR À MÃO.
 * Rode \`npm run art:placeholders\` para regenerar.
 *
 * Este é o contrato entre os assets e o gameplay: o código de jogo referencia
 * apenas as chaves lógicas abaixo, nunca caminhos de arquivo.
 */

export const ATLASES = {
${report
  .map(
    (r) =>
      `\t${r.name}: { texture: 'assets/atlas/${r.name}.png', data: 'assets/atlas/${r.name}.json' },`,
  )
  .join('\n')}
} as const;
export type AtlasKey = keyof typeof ATLASES;

export const IMAGES = {
\ttileset: 'assets/levels/tileset.png',
${Object.keys(layers)
  .map((n) => `\t'bg.${n}': 'assets/env/${n}.png',`)
  .join('\n')}
} as const;
export type ImageKey = keyof typeof IMAGES;

export interface AnimDef {
\treadonly key: string;
\treadonly atlas: AtlasKey;
\treadonly prefix: string;
\treadonly frames: number;
\treadonly frameRate: number;
\treadonly repeat: number;
\treadonly lock?: boolean;
}

export const ANIMS = [
${ANIMS.map(
  (a) =>
    `\t{ key: '${a.key}', atlas: '${a.atlas}', prefix: '${a.prefix}', frames: ${a.frames}, frameRate: ${a.frameRate}, repeat: ${a.repeat}${a.lock ? ', lock: true' : ''} },`,
).join('\n')}
] as const satisfies readonly AnimDef[];
export type AnimKey = (typeof ANIMS)[number]['key'];

export const SPRITES = {
${STATIC_SPRITES.map((s) => `\t'${s.key}': { atlas: '${s.atlas}', frame: '${s.frame}' },`).join('\n')}
} as const;
export type SpriteKey = keyof typeof SPRITES;

/** Métricas fixadas em docs/ART_SPEC.md. Gameplay lê daqui, não de números soltos. */
export const ART_METRICS = {
\t/** Altura lógica é fixa; a largura estica entre min e max conforme a tela. */
\tlogicalHeight: 360,
\tlogicalWidthMin: 640,
\tlogicalWidthMax: 800,
\ttile: ${TILE},
\tplayer: {
\t\tframe: ${PLAYER_FRAME},
\t\tarmFrame: ${PLAYER_ARM_FRAME},
\t\tshoulder: { x: ${PLAYER_SHOULDER.x}, y: ${PLAYER_SHOULDER.y} },
\t\tshoulderCrouch: { x: ${PLAYER_SHOULDER_CROUCH.x}, y: ${PLAYER_SHOULDER_CROUCH.y} },
\t\tbody: { x: ${PLAYER_BODY_BOX.x}, y: ${PLAYER_BODY_BOX.y}, w: ${PLAYER_BODY_BOX.w}, h: ${PLAYER_BODY_BOX.h} },
\t\tbodyCrouch: { x: ${PLAYER_BODY_BOX_CROUCH.x}, y: ${PLAYER_BODY_BOX_CROUCH.y}, w: ${PLAYER_BODY_BOX_CROUCH.w}, h: ${PLAYER_BODY_BOX_CROUCH.h} },
\t\tfeetY: 58,
\t},
\tenemy: { soldier: ${ENEMY_FRAMES.soldier}, heavy: ${ENEMY_FRAMES.heavy}, turret: ${ENEMY_FRAMES.turret} },
\tboss: {
\t\tbase: { w: ${BOSS_FRAMES.base[0]}, h: ${BOSS_FRAMES.base[1]} },
\t\tclaw: { w: ${BOSS_FRAMES.claw[0]}, h: ${BOSS_FRAMES.claw[1]} },
\t\tcore: { w: ${BOSS_FRAMES.core[0]}, h: ${BOSS_FRAMES.core[1]} },
\t\tarmPivot: { x: ${BOSS_ANCHORS.armPivot.x}, y: ${BOSS_ANCHORS.armPivot.y} },
\t\tcoreOffset: { x: ${BOSS_ANCHORS.core.x}, y: ${BOSS_ANCHORS.core.y} },
\t\tgroundY: 156,
\t},
} as const;

/** Paleta de 48 cores — a arte final precisa se restringir a estas. */
export const PALETTE = {
${Object.entries(PALETTE)
  .map(([k, v]) => `\t${k}: '${v}',`)
  .join('\n')}
} as const;
`;
writeFileSync(`${ROOT}/src/assets/sprite-manifest.generated.ts`, ts);

/* ── Preview visual + inventário para encomenda da arte final ── */
const tilesetInfo = { tileset, TILES, TILE, TILESET_COLS };
writeFileSync(
  `${ROOT}/docs/placeholder-preview.html`,
  buildPreview(report, ANIMS, atlasSources, layers, tilesetInfo),
);
writeFileSync(`${ROOT}/docs/ASSET_INVENTORY.md`, buildInventory(atlasSources, report, tilesetInfo));

/* ── Relatório ── */
const totalFrames = report.reduce((s, r) => s + r.count, 0);
const totalBytes = report.reduce((s, r) => s + r.bytes, 0);
console.log('\nREDLINE — placeholders gerados\n');
for (const r of report) {
  console.log(
    `  ${r.name.padEnd(12)} ${String(r.count).padStart(3)} frames  ` +
      `${r.width}x${r.height}  ${(r.bytes / 1024).toFixed(1)} KB`,
  );
}
console.log(
  `  ${'tileset'.padEnd(12)} ${String(TILES.length).padStart(3)} tiles   ${tileset.w}x${tileset.h}`,
);
console.log(`  ${'parallax'.padEnd(12)} ${String(Object.keys(layers).length).padStart(3)} camadas`);
console.log(
  `\n  ${totalFrames} frames · ${ANIMS.length} animações · ${STATIC_SPRITES.length} sprites estáticos · ${(totalBytes / 1024).toFixed(1)} KB de atlas`,
);
console.log('\n  preview: docs/placeholder-preview.html\n');
