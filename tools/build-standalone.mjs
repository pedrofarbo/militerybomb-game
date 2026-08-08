#!/usr/bin/env node
/**
 * Empacota o jogo inteiro num ÚNICO arquivo HTML, sem nenhuma requisição.
 *
 *   npm run build:standalone
 *
 * Para quê: publicar o jogo onde não há servidor — um link para testar, um
 * anexo, uma página de artifact com CSP restrita. A build normal (`npm run
 * build`) continua sendo a de produção; esta é para distribuição avulsa.
 *
 * Como: JS e CSS entram inline, PNGs viram data-URI, e os JSON dos atlas vão
 * como OBJETO num global que a PreloadScene consome. Passar o JSON como
 * data-URI pareceria equivalente, mas o loader faria XHR nele — e uma CSP que
 * proíba `connect-src data:` derrubaria o jogo só em produção.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = `${ROOT}/dist`;
const OUT_DIR = `${ROOT}/dist-standalone`;
const OUT_FILE = `${OUT_DIR}/redline.html`;

/* ── 1. Build de produção em arquivo único ── */
console.log('▸ build (arquivo único)…');
execFileSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, REDLINE_STANDALONE: '1' },
});

const assets = readdirSync(`${DIST}/assets`);
const jsName = assets.find((f) => f.endsWith('.js'));
const cssName = assets.find((f) => f.endsWith('.css'));
if (!jsName || !cssName) throw new Error('build não produziu JS/CSS esperados');
if (assets.filter((f) => f.endsWith('.js')).length > 1) {
  throw new Error('build produziu mais de um chunk JS — o inline exige um só');
}

let js = readFileSync(`${DIST}/assets/${jsName}`, 'utf8');
const css = readFileSync(`${DIST}/assets/${cssName}`, 'utf8');

/* ── 2. PNGs viram data-URI dentro do bundle ── */
const dataUri = (path, mime) =>
  `data:${mime};base64,${readFileSync(`${DIST}/${path}`).toString('base64')}`;

const images = [
  'assets/levels/tileset.png',
  'assets/env/bg_far.png',
  'assets/env/bg_near.png',
  'assets/env/fg_near.png',
  'assets/atlas/characters.png',
  'assets/atlas/enemies.png',
  'assets/atlas/boss.png',
  'assets/atlas/fx.png',
  'assets/atlas/env.png',
  'assets/atlas/ui.png',
];

/**
 * O minificador escolhe as aspas: `"…"`, `'…'` ou template literal. Trocar
 * apenas uma forma passaria no build e falharia em runtime com 404 — que numa
 * página autocontida vira tela preta sem explicação.
 */
const QUOTES = ['"', "'", '`'];

let inlinedBytes = 0;
for (const path of images) {
  const uri = dataUri(path, 'image/png');
  inlinedBytes += uri.length;

  let replaced = 0;
  for (const quote of QUOTES) {
    const needle = `${quote}${path}${quote}`;
    const parts = js.split(needle);
    replaced += parts.length - 1;
    js = parts.join(JSON.stringify(uri));
  }
  if (replaced === 0) throw new Error(`caminho não encontrado no bundle: ${path}`);
}

/* ── 3. JSON dos atlas como objeto, num global ── */
const atlasKeys = ['characters', 'enemies', 'boss', 'fx', 'env', 'ui'];

/* Nenhum caminho de asset pode sobreviver, porque cada um que sobrar vira uma
   requisição — e a página não pode fazer nenhuma. A exceção conhecida são os
   JSON dos atlas: eles continuam no bundle como FALLBACK, para o caso de o
   jogo rodar servido normalmente, e ficam inertes porque o global abaixo é
   sempre injetado. Listá-los nominalmente mantém a checagem estrita: qualquer
   caminho novo que apareça no futuro quebra o build em vez de virar 404. */
const allowedLeftovers = new Set(atlasKeys.map((key) => `assets/atlas/${key}.json`));
const leftovers = [
  ...new Set([...js.matchAll(/assets\/[\w./-]+\.(png|json)/g)].map((m) => m[0])),
].filter((path) => !allowedLeftovers.has(path));
if (leftovers.length > 0) {
  throw new Error(`caminhos de asset não embutidos: ${leftovers.join(', ')}`);
}
const atlasData = Object.fromEntries(
  atlasKeys.map((key) => [
    key,
    JSON.parse(readFileSync(`${DIST}/assets/atlas/${key}.json`, 'utf8')),
  ]),
);

/* ────────────────────────────────────────────────────────────── */

function renderBody({ js, atlasData }) {
  return `    <div class="cabinet">
      <header class="bar">
        <div class="ident">
          <span class="ident__mark" aria-hidden="true"></span>
          <span class="ident__name">REDLINE</span>
          <span class="ident__sub">Cais de Quarentena · vertical slice</span>
        </div>
        <button class="help-toggle" type="button" aria-expanded="false" aria-controls="help">
          Controles
        </button>
      </header>

      <div class="hazard" role="presentation"></div>

      <main class="stage">
        <div id="app"></div>
      </main>

      <aside class="help" id="help" hidden>
        <div class="help__grid">
          <dl class="keys">
            <dt>Mover</dt><dd><kbd>A</kbd> <kbd>D</kbd></dd>
            <dt>Mirar</dt><dd><kbd>W</kbd> <kbd>S</kbd></dd>
            <dt>Pular</dt><dd><kbd>Espaço</kbd></dd>
            <dt>Atirar</dt><dd><kbd>J</kbd> <span class="hint">segure</span></dd>
            <dt>Granada</dt><dd><kbd>L</kbd></dd>
            <dt>Trocar arma</dt><dd><kbd>Q</kbd></dd>
            <dt>Descer plataforma</dt><dd><kbd>S</kbd> + <kbd>Espaço</kbd></dd>
            <dt>Painel de debug</dt><dd><kbd>\`</kbd></dd>
          </dl>
          <div class="notes">
            <p>
              No celular os controles aparecem sozinhos: direcional flutuante à
              esquerda, botões à direita. O jogo pede a horizontal.
            </p>
            <p class="notes__list">
              <span>Barris explodem em cadeia e matam quem estiver perto.</span>
              <span>Caixotes param bala — servem de cobertura, e bloqueiam o caminho.</span>
              <span>Todo inimigo se prepara antes de atirar: dá para reagir.</span>
              <span>A torre de plataformas depois do segundo vão é rota alta opcional.</span>
            </p>
            <p class="notes__warn">
              A arte é <strong>placeholder gerado por código</strong>. O que está
              em teste aqui é como o jogo se comporta, não como ele se parece.
            </p>
          </div>
        </div>
      </aside>
    </div>

    <script>window.__REDLINE_ATLAS_DATA__ = ${JSON.stringify(atlasData)};</script>
    <script type="module">
${js}
    </script>
    <script>
      (function () {
        var toggle = document.querySelector('.help-toggle');
        var panel = document.getElementById('help');
        toggle.addEventListener('click', function () {
          var open = panel.hasAttribute('hidden');
          if (open) panel.removeAttribute('hidden');
          else panel.setAttribute('hidden', '');
          toggle.setAttribute('aria-expanded', String(open));
          // O canvas mede o container: reavaliar depois que o layout assentar.
          window.dispatchEvent(new Event('resize'));
        });
      })();
    </script>`;
}

/**
 * Identidade da página. Tema único assumido: o jogo é um mundo escuro e
 * industrial, e uma versão clara em volta brigaria com ele. As cores saem da
 * mesma paleta de 48 do jogo, então moldura e jogo são o mesmo objeto.
 */
const PAGE_CSS = `
:root {
  --ink: #0d0b12;
  --panel: #171622;
  --line: #2a2937;
  --text: #c3cedb;
  --dim: #5e6a79;
  --accent: #e8bb28;
  --rust: #d97434;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--ink);
  color: var(--text);
  font-family: var(--sans);
  overscroll-behavior: none;
}

/* Piso de 320px no palco em vez de 1fr puro: num iframe que se auto-dimensiona
   pelo conteúdo, 1fr colapsa para zero e o jogo acaba medindo um container de
   altura nula. O piso garante que sempre haja onde jogar. */
.cabinet {
  display: grid;
  grid-template-rows: auto auto minmax(320px, 1fr) auto;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ── Barra de identificação ── */

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 14px calc(9px) 14px;
  padding-left: max(14px, env(safe-area-inset-left));
  padding-right: max(14px, env(safe-area-inset-right));
  padding-top: max(9px, env(safe-area-inset-top));
  background: var(--panel);
}

.ident {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.ident__mark {
  width: 9px;
  height: 9px;
  flex: none;
  align-self: center;
  background: var(--rust);
  /* Canto cortado: mesma leitura mecânica dos blocos do cenário. */
  clip-path: polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px);
}

.ident__name {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--text);
}

.ident__sub {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-toggle {
  flex: none;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 6px 12px;
  cursor: pointer;
  transition: border-color 120ms linear, color 120ms linear;
}

.help-toggle:hover { border-color: var(--accent); }
.help-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Único divisor estrutural da página: a faixa de perigo do próprio cenário. */
.hazard {
  height: 4px;
  background: repeating-linear-gradient(
    -45deg,
    var(--accent) 0 6px,
    var(--ink) 6px 12px
  );
  opacity: 0.85;
}

/* ── Palco ── */

.stage {
  position: relative;
  min-height: 0;
  background: var(--ink);
}

/* ── Ajuda ── */

.help {
  border-top: 1px solid var(--line);
  background: var(--panel);
  padding: 14px;
  padding-bottom: max(14px, env(safe-area-inset-bottom));
  max-height: 42vh;
  overflow-y: auto;
}

.help[hidden] { display: none; }

.help__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px 28px;
  max-width: 1000px;
}

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;
}

.keys dt { color: var(--dim); }
.keys dd { margin: 0; color: var(--text); }

kbd {
  display: inline-block;
  font: inherit;
  background: var(--ink);
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 3px;
  padding: 1px 6px;
  color: var(--accent);
}

.hint { color: var(--dim); font-size: 11px; }

.notes {
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text);
  max-width: 62ch;
}

.notes p { margin: 0; }

.notes__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--dim);
  font-size: 12.5px;
}

.notes__list span { padding-left: 14px; position: relative; }

.notes__list span::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 5px;
  height: 5px;
  background: var(--rust);
}

.notes__warn {
  color: var(--dim);
  font-size: 12px;
  border-left: 2px solid var(--accent);
  padding-left: 10px;
}

.notes__warn strong { color: var(--text); font-weight: 600; }

@media (max-width: 560px) {
  .ident__sub { display: none; }
  .help { max-height: 50vh; }
}
`;

/**
 * O jogo assume `#app` ocupando a viewport inteira. Aqui ele vive dentro do
 * palco — a medição por container (ver `main.ts`) é o que torna isso possível.
 */
const PAGE_OVERRIDES = `
/* O CSS do jogo define a face do HUD em html/body. A página retoma a sua aqui:
   os overrides são os últimos a entrar na cascata. */
body {
  font-family: var(--sans);
  color: var(--text);
  background: var(--ink);
}

.keys,
.ident__name,
.ident__sub,
.help-toggle,
kbd {
  font-family: var(--mono);
}

#app {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
`;

/* ── 4. Duas saídas da mesma build ──
   `redline.html` é um documento completo, para abrir localmente ou hospedar.
   `redline.artifact.html` é o MESMO conteúdo sem <html>/<head>/<body>, porque
   o host de artifact injeta o próprio esqueleto de documento. */
const body = renderBody({ js, atlasData });
const styles = `<style>\n${PAGE_CSS}\n${css}\n${PAGE_OVERRIDES}\n</style>`;

const document = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#0d0b12" />
    <title>REDLINE — vertical slice</title>
    ${styles}
  </head>
  <body>
${body}
  </body>
</html>
`;

const fragment = `<title>REDLINE — vertical slice</title>\n${styles}\n${body}\n`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, document);
writeFileSync(`${OUT_DIR}/redline.artifact.html`, fragment);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`\n  ${OUT_FILE}`);
console.log(`  ${OUT_DIR}/redline.artifact.html  (sem invólucro de documento)`);
console.log(`  ${mb(document.length)} · ${mb(js.length)} de JS · ${mb(inlinedBytes)} de imagem`);
console.log('  zero requisições de rede\n');
