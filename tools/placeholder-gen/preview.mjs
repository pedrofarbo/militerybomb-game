/**
 * Folha de contato dos placeholders: paleta, animações rodando, atlases,
 * tileset indexado e camadas de parallax — tudo embutido num único HTML,
 * para revisar sem servidor e para servir de referência visual a quem for
 * produzir a arte final.
 */
import { Canvas } from './canvas.mjs';
import { encodePng } from './png.mjs';
import { PALETTE } from './palette.mjs';
import { STATIC_SPRITES } from './anims.mjs';

const dataUri = (c) => `data:image/png;base64,${encodePng(c.w, c.h, c.data).toString('base64')}`;

function strip(frames) {
  const w = Math.max(...frames.map((f) => f.w));
  const h = Math.max(...frames.map((f) => f.h));
  const c = new Canvas(w * frames.length, h);
  frames.forEach((f, i) => c.blit(f, i * w + ((w - f.w) >> 1), h - f.h));
  return { canvas: c, w, h };
}

export function buildPreview(report, anims, atlasSources, layers, tilesetInfo) {
  const byAtlas = Object.fromEntries(
    Object.entries(atlasSources).map(([k, frames]) => [
      k,
      Object.fromEntries(frames.map((f) => [f.name, f.canvas])),
    ]),
  );

  const animCards = anims
    .map((a) => {
      const frames = [];
      for (let i = 0; i < a.frames; i++) {
        const cv = byAtlas[a.atlas][`${a.prefix}${i}`];
        if (cv) frames.push(cv);
      }
      if (!frames.length) return '';
      const s = strip(frames);
      const dur = (a.frames / a.frameRate).toFixed(3);
      const zoom = s.h > 96 ? 1 : s.h > 56 ? 2 : 3;
      return `<figure class="anim">
  <div class="stage" style="--w:${s.w}px;--h:${s.h}px;--n:${a.frames};--dur:${dur}s;--zoom:${zoom};background-image:url('${dataUri(s.canvas)}')"></div>
  <figcaption><b>${a.key}</b><span>${a.frames}f · ${a.frameRate}fps · ${a.repeat === -1 ? 'loop' : 'once'}${a.lock ? ' · lock' : ''}</span></figcaption>
</figure>`;
    })
    .join('\n');

  const staticCards = STATIC_SPRITES.map((s) => {
    const cv = byAtlas[s.atlas][s.frame];
    if (!cv) return '';
    const zoom = cv.h > 60 ? 1 : cv.h > 24 ? 2 : 4;
    return `<figure class="anim"><div class="still" style="--zoom:${zoom}"><img src="${dataUri(cv)}" width="${cv.w}" height="${cv.h}" alt=""></div>
<figcaption><b>${s.key}</b><span>${cv.w}×${cv.h}</span></figcaption></figure>`;
  }).join('\n');

  const sheets = report
    .map((r) => {
      const frames = atlasSources[r.name];
      const sheet = new Canvas(r.width, r.height);
      // Reconstrói a folha exatamente como o packer a montou seria caro;
      // aqui basta uma tira de conferência com todos os frames.
      let x = 1;
      let y = 1;
      let shelf = 0;
      for (const f of [...frames].sort((a, b) => b.canvas.h - a.canvas.h || a.name.localeCompare(b.name))) {
        if (x + f.canvas.w + 1 > r.width) {
          x = 1;
          y += shelf + 1;
          shelf = 0;
        }
        sheet.blit(f.canvas, x, y);
        x += f.canvas.w + 1;
        shelf = Math.max(shelf, f.canvas.h);
      }
      return `<section class="sheet"><h3>${r.name}.png <small>${r.width}×${r.height} · ${r.count} frames · ${(r.bytes / 1024).toFixed(1)} KB</small></h3>
<img src="${dataUri(sheet)}" alt="${r.name}"></section>`;
    })
    .join('\n');

  const { tileset, TILES, TILE, TILESET_COLS } = tilesetInfo;
  const tileCells = TILES.map((id, i) => {
    const c = new Canvas(TILE, TILE);
    const sx = (i % TILESET_COLS) * TILE;
    const sy = Math.floor(i / TILESET_COLS) * TILE;
    for (let yy = 0; yy < TILE; yy++)
      for (let xx = 0; xx < TILE; xx++) {
        const si = ((sy + yy) * tileset.w + sx + xx) * 4;
        const di = (yy * TILE + xx) * 4;
        c.data.set(tileset.data.subarray(si, si + 4), di);
      }
    return `<figure class="tile"><img src="${dataUri(c)}" width="48" height="48" alt=""><figcaption><b>${i}</b> ${id}</figcaption></figure>`;
  }).join('\n');

  const parallax = Object.entries(layers)
    .map(
      ([n, c]) =>
        `<section class="sheet"><h3>${n}.png <small>${c.w}×${c.h}</small></h3><img class="wide" src="${dataUri(c)}" alt="${n}"></section>`,
    )
    .join('\n');

  const swatches = Object.entries(PALETTE)
    .map(
      ([k, v]) =>
        `<figure class="sw"><i style="background:${v}"></i><figcaption><b>${k}</b><span>${v}</span></figcaption></figure>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>REDLINE — Placeholder Art Preview</title>
<style>
  :root{--bg:#0d0b12;--panel:#171622;--line:#2a2937;--fg:#e6e8ef;--dim:#8b8fa3;--accent:#e8bb28}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
       font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:32px}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:15px;margin:40px 0 12px;color:var(--accent);
     border-bottom:1px solid var(--line);padding-bottom:8px;letter-spacing:.08em;text-transform:uppercase}
  h3{font-size:13px;margin:0 0 8px;font-weight:600}
  small{color:var(--dim);font-weight:400}
  .lead{color:var(--dim);margin:0 0 8px;max-width:70ch}
  img{image-rendering:pixelated}
  .grid{display:flex;flex-wrap:wrap;gap:12px}
  .anim{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;
        padding:10px;min-width:120px;display:flex;flex-direction:column;align-items:center;gap:8px}
  .stage{width:calc(var(--w) * var(--zoom));height:calc(var(--h) * var(--zoom));
         background-repeat:no-repeat;image-rendering:pixelated;
         background-size:calc(var(--w) * var(--n) * var(--zoom)) calc(var(--h) * var(--zoom));
         animation:play calc(var(--dur)) steps(var(--n)) infinite}
  @keyframes play{from{background-position:0 0}
                  to{background-position:calc(var(--w) * var(--n) * var(--zoom) * -1) 0}}
  .still img{transform:scale(var(--zoom));transform-origin:center;image-rendering:pixelated}
  .still{display:flex;align-items:center;justify-content:center;min-height:64px}
  figcaption{text-align:center;font-size:11px;display:flex;flex-direction:column;gap:2px}
  figcaption span{color:var(--dim);font-size:10px}
  .sheet{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px;margin:0 0 12px;overflow:auto}
  .sheet img{max-width:100%;background:
     repeating-conic-gradient(#1e1d29 0 25%,#15141d 0 50%) 0 0/16px 16px}
  .sheet img.wide{width:100%;image-rendering:pixelated}
  .tile{margin:0;text-align:center;background:var(--panel);border:1px solid var(--line);
        border-radius:4px;padding:6px;width:78px}
  .tile figcaption{font-size:9px;word-break:break-all}
  .sw{margin:0;width:96px}
  .sw i{display:block;height:44px;border-radius:4px;border:1px solid var(--line)}
  .sw figcaption{align-items:flex-start;text-align:left;padding-top:4px}
  .note{background:#2a2112;border:1px solid #5c4715;color:#f0d68a;
        padding:10px 12px;border-radius:6px;margin:16px 0;max-width:80ch}
</style></head><body>
<h1>REDLINE — Placeholder Art</h1>
<p class="lead">Arte temporária gerada por <code>tools/placeholder-gen</code>. Tamanhos de frame, pivôs,
contagens de frame e paleta são <b>idênticos</b> aos exigidos da arte final em
<code>docs/ART_SPEC.md</code> — substituir os PNG/JSON não exige mudança de código.</p>
<div class="note"><b>Não é arte final.</b> Serve para destravar gameplay, animação, colisão e
tuning enquanto a arte definitiva é produzida. Use este documento como referência de
enquadramento, silhueta e leitura de cor ao gerar a arte real.</div>

<h2>Paleta (48 cores)</h2>
<div class="grid">${swatches}</div>

<h2>Animações (${anims.length})</h2>
<div class="grid">${animCards}</div>

<h2>Sprites estáticos</h2>
<div class="grid">${staticCards}</div>

<h2>Tileset — 16×16 (${TILES.length} tiles)</h2>
<div class="grid">${tileCells}</div>

<h2>Parallax</h2>
${parallax}

<h2>Atlases</h2>
${sheets}
</body></html>
`;
}
