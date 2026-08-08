/** Empacotador de atlas (shelf packer) + escrita no formato JSON Array do Phaser. */
import { Canvas } from './canvas.mjs';
import { encodePng } from './png.mjs';
import { writeFileSync } from 'node:fs';

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * @param {{name:string, canvas:Canvas}[]} frames
 * @returns {{png: Buffer, json: object, width:number, height:number}}
 */
export function packAtlas(frames, atlasName, { padding = 1 } = {}) {
  // Ordena por altura desc, depois por nome, para um layout estável.
  const sorted = [...frames].sort(
    (a, b) => b.canvas.h - a.canvas.h || a.name.localeCompare(b.name),
  );

  const totalArea = sorted.reduce(
    (s, f) => s + (f.canvas.w + padding) * (f.canvas.h + padding),
    0,
  );
  let width = nextPow2(Math.ceil(Math.sqrt(totalArea) * 1.15));
  width = Math.max(width, sorted[0].canvas.w + padding * 2);

  let placed;
  let height;
  for (;;) {
    placed = [];
    let x = padding;
    let y = padding;
    let shelfH = 0;
    let ok = true;
    for (const f of sorted) {
      if (x + f.canvas.w + padding > width) {
        x = padding;
        y += shelfH + padding;
        shelfH = 0;
      }
      placed.push({ ...f, x, y });
      x += f.canvas.w + padding;
      shelfH = Math.max(shelfH, f.canvas.h);
    }
    height = nextPow2(y + shelfH + padding);
    if (ok && height <= width * 2) break;
    width <<= 1;
  }

  const sheet = new Canvas(width, height);
  for (const p of placed) sheet.blit(p.canvas, p.x, p.y);

  // Frames no JSON saem em ordem alfabética — indispensável para animações
  // geradas por prefixo (`dara/run/0..7`).
  const jsonFrames = [...placed]
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    .map((p) => ({
      filename: p.name,
      frame: { x: p.x, y: p.y, w: p.canvas.w, h: p.canvas.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.canvas.w, h: p.canvas.h },
      sourceSize: { w: p.canvas.w, h: p.canvas.h },
    }));

  return {
    png: encodePng(width, height, sheet.data),
    json: {
      frames: jsonFrames,
      meta: {
        app: 'redline/placeholder-gen',
        version: '1.0',
        image: `${atlasName}.png`,
        format: 'RGBA8888',
        size: { w: width, h: height },
        scale: '1',
        note: 'PLACEHOLDER ART — gerado por tools/placeholder-gen. Não editar à mão.',
      },
    },
    width,
    height,
  };
}

export function writeAtlas(dir, name, frames) {
  const { png, json, width, height } = packAtlas(frames, name);
  writeFileSync(`${dir}/${name}.png`, png);
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(json, null, '\t') + '\n');
  return { name, width, height, count: frames.length, bytes: png.length };
}
