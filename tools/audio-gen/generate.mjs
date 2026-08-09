#!/usr/bin/env node
/**
 * Gera TODO o áudio placeholder do REDLINE.
 *
 *   node tools/audio-gen/generate.mjs
 *
 * Saída (determinística — rodar duas vezes não produz diff no git):
 *   public/assets/audio/sfx/*.wav
 *   public/assets/audio/music/*.wav
 *   src/assets/audio-manifest.generated.ts
 *
 * Mesmo contrato dos placeholders de arte: o gameplay referencia só chaves
 * lógicas (`'sfx.weapon.shotgun'`), nunca caminhos. Trocar por som final é
 * substituir arquivos — nenhuma linha de gameplay muda.
 *
 * Por que WAV e não OGG: sintetizar OGG exigiria um encoder Vorbis, o que
 * significa uma dependência (ou uns bons milhares de linhas) para produzir
 * algo que é temporário por definição. O som FINAL deve vir em .ogg + .m4a,
 * como manda o plano técnico §18 — e aí o manifesto ganha as duas extensões.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeWav } from './wav.mjs';
import { SAMPLE_RATE, MUSIC_SAMPLE_RATE } from './synth.mjs';
import { SOUNDS, MUSIC } from './sounds.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIO_DIR = resolve(ROOT, 'public/assets/audio');

function write(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return bytes.length;
}

/** `sfx.weapon.pistol` → `weapon_pistol` */
function fileNameFor(key) {
  return key.split('.').slice(1).join('_');
}

let totalBytes = 0;
const entries = [];

for (const sound of SOUNDS) {
  const samples = sound.make();
  const bytes = encodeWav(samples, SAMPLE_RATE);
  const file = `sfx/${fileNameFor(sound.key)}.wav`;
  totalBytes += write(resolve(AUDIO_DIR, file), bytes);
  entries.push({
    key: sound.key,
    file: `assets/audio/${file}`,
    role: sound.role,
    seconds: samples.length / SAMPLE_RATE,
    music: false,
  });
}

for (const track of MUSIC) {
  const samples = track.make();
  const bytes = encodeWav(samples, MUSIC_SAMPLE_RATE);
  const file = `music/${fileNameFor(track.key)}.wav`;
  totalBytes += write(resolve(AUDIO_DIR, file), bytes);
  entries.push({
    key: track.key,
    file: `assets/audio/${file}`,
    role: track.role,
    seconds: samples.length / MUSIC_SAMPLE_RATE,
    music: true,
  });
}

/* ── Manifesto tipado ── */

const lines = entries
  .map(
    (e) =>
      `\t'${e.key}': { file: '${e.file}', seconds: ${e.seconds.toFixed(3)}, music: ${e.music} },` +
      ` // ${e.role}`,
  )
  .join('\n');

const manifest = `/* eslint-disable */
/**
 * GERADO AUTOMATICAMENTE por tools/audio-gen — NÃO EDITAR À MÃO.
 * Rode \`npm run audio:placeholders\` para regenerar.
 *
 * Contrato entre o áudio e o gameplay: o jogo referencia apenas as chaves
 * lógicas abaixo, nunca caminhos de arquivo. Trocar o som placeholder por som
 * final é substituir arquivos e regerar — nenhuma linha de gameplay muda.
 */

export interface AudioAsset {
\treadonly file: string;
\treadonly seconds: number;
\t/** Faixas de música tocam em loop e entram no barramento \`music\`. */
\treadonly music: boolean;
}

export const AUDIO = {
${lines}
} as const satisfies Readonly<Record<string, AudioAsset>>;

export type AudioKey = keyof typeof AUDIO;

export const MUSIC_KEYS = [
${entries
  .filter((e) => e.music)
  .map((e) => `\t'${e.key}',`)
  .join('\n')}
] as const satisfies readonly AudioKey[];
`;

write(resolve(ROOT, 'src/assets/audio-manifest.generated.ts'), Buffer.from(manifest, 'utf8'));

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
console.log(`  ${SOUNDS.length} efeitos + ${MUSIC.length} faixas`);
console.log(`  ${kb(totalBytes)} em public/assets/audio/`);
console.log('  src/assets/audio-manifest.generated.ts');
