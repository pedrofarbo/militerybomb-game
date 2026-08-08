/**
 * Gera docs/ASSET_INVENTORY.md a partir das MESMAS definições que produzem os
 * placeholders. A lista de encomenda da arte final não pode divergir do que o
 * jogo carrega, então ela é derivada, nunca escrita à mão.
 */
import { ANIMS, STATIC_SPRITES } from './anims.mjs';

const PIVOT_NOTES = {
  characters: 'origem (0.5, 1) — pés na linha y=58 do frame',
  enemies: 'origem (0.5, 1) — pés na base do frame',
  boss: 'origem (0.5, 1) — base em y=156 (base) / pivô central (claw, core)',
  fx: 'origem (0.5, 0.5), exceto `muzzle/*` que usa (0, 0.5) na boca do cano',
  env: 'origem (0.5, 1) — apoiado no chão',
  ui: 'origem (0, 0) — ancorado por CSS/HUD',
};

export function buildInventory(atlasSources, report, tilesetInfo) {
  const size = (atlas, frame) => {
    const f = atlasSources[atlas].find((x) => x.name === frame);
    return f ? `${f.canvas.w}×${f.canvas.h}` : '?';
  };

  const rows = ANIMS.map((a) => {
    const dims = size(a.atlas, `${a.prefix}0`);
    const [w, h] = dims.split('×').map(Number);
    return {
      key: a.key,
      atlas: a.atlas,
      prefix: a.prefix,
      frames: a.frames,
      dims,
      strip: `${w * a.frames}×${h}`,
      fps: a.frameRate,
      loop: a.repeat === -1 ? 'loop' : 'uma vez',
      lock: a.lock ? 'sim' : '—',
    };
  });

  const byAtlas = {};
  for (const r of rows) (byAtlas[r.atlas] ??= []).push(r);

  const totalFrames = ANIMS.reduce((s, a) => s + a.frames, 0);

  let md = `# REDLINE — Inventário de Assets

> **GERADO AUTOMATICAMENTE** por \`tools/placeholder-gen\`. Não editar à mão —
> rode \`npm run art:placeholders\`. Esta é a lista de encomenda da arte final:
> cada linha existe hoje como placeholder e precisa ser substituída por arte
> definitiva com **exatamente** as mesmas dimensões e contagens de frame.

- **${ANIMS.length} animações** · **${totalFrames} frames de animação** · **${STATIC_SPRITES.length} sprites estáticos** · **${tilesetInfo.TILES.length} tiles**
- Resolução lógica do jogo: **640×360** (altura fixa, largura elástica 640–800)
- Grid de tiles: **${tilesetInfo.TILE}×${tilesetInfo.TILE}**
- Paleta: **48 cores** fixas (ver \`docs/ART_SPEC.md\`)

**Como ler a coluna "Tira":** a entrega da arte final é uma tira horizontal
única por animação, frames da esquerda para a direita, sem espaçamento, fundo
transparente. \`Tira\` é a dimensão exata do PNG esperado.

`;

  for (const [atlas, list] of Object.entries(byAtlas)) {
    const r = report.find((x) => x.name === atlas);
    md += `\n## Atlas \`${atlas}\`\n\n`;
    md += `Pivô: ${PIVOT_NOTES[atlas] ?? '—'}. `;
    md += `Placeholder atual: ${r.width}×${r.height}, ${r.count} frames, ${(r.bytes / 1024).toFixed(1)} KB.\n\n`;
    md += `| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |\n`;
    md += `|---|---|---:|---|---|---:|---|---|\n`;
    for (const x of list) {
      md += `| \`${x.key}\` | \`${x.prefix}N\` | ${x.frames} | ${x.dims} | **${x.strip}** | ${x.fps} | ${x.loop} | ${x.lock} |\n`;
    }
  }

  md += `\n## Sprites estáticos (frame único)\n\n`;
  md += `| Chave | Atlas | Frame | Tamanho |\n|---|---|---|---|\n`;
  for (const s of STATIC_SPRITES) {
    md += `| \`${s.key}\` | ${s.atlas} | \`${s.frame}\` | ${size(s.atlas, s.frame)} |\n`;
  }

  md += `\n## Tileset \`levels/tileset.png\`\n\n`;
  md += `${tilesetInfo.TILES.length} tiles de ${tilesetInfo.TILE}×${tilesetInfo.TILE}, `;
  md += `grid de ${tilesetInfo.TILESET_COLS} colunas. **A ordem dos índices é contrato** — `;
  md += `as fases do Tiled referenciam o índice, não o nome.\n\n`;
  md += `| Índice | Nome | Colisão |\n|---:|---|---|\n`;
  const SOLID_EXCEPT = ['empty', 'ladder', 'rail', 'hazard_stripe'];
  tilesetInfo.TILES.forEach((id, i) => {
    md += `| ${i} | \`${id}\` | ${SOLID_EXCEPT.includes(id) ? 'não' : 'sim'} |\n`;
  });

  md += `\n## Camadas de parallax\n\n`;
  md += `| Arquivo | Tamanho | scrollFactor sugerido | Observação |\n|---|---|---|---|\n`;
  md += `| \`env/bg_far.png\` | 640×360 | 0.15 | céu + horizonte, encaixável na horizontal |\n`;
  md += `| \`env/bg_near.png\` | 640×360 | 0.35 | guindastes e contêineres, encaixável |\n`;
  md += `| \`env/fg_near.png\` | 640×360 | 1.15 | primeiro plano baixo; **nunca** pode esconder inimigo |\n`;

  return md;
}
