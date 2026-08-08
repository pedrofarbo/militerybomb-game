# REDLINE

Jogo 2D de ação lateral (run & gun) para browser, celular e tablet.
Phaser 4 + TypeScript + Vite. Single-player.

> **Estado:** Fases 0 (arquitetura), 1 (player) e 2 (combate) concluídas.
> A fase tem 11 inimigos de 3 tipos, 9 objetos destrutíveis com explosão em
> cadeia, granadas, dano nos dois sentidos e pontuação.
> Falta a Fase 3: checkpoint, mini-boss, menus e áudio.

## Começando

```bash
npm install
npm run dev          # http://localhost:5173
```

Requer Node.js ≥ 22.12.

### Controles

| Ação              | Teclado         | Gamepad       | Touch                      |
| ----------------- | --------------- | ------------- | -------------------------- |
| Mover             | `A` `D` / setas | stick / D-pad | direcional flutuante       |
| Mirar             | `W` `S` / setas | stick         | direcional                 |
| Pular             | `Espaço` / `K`  | A             | botão **PULO**             |
| Atirar            | `J` / `Ctrl`    | X / RT        | botão **TIRO** (segurável) |
| Descer plataforma | `S`/`↓` + pulo  | ↓ + A         | direcional ↓ + **PULO**    |
| Trocar arma       | `Q` / `Tab`     | LB            | —                          |
| Debug             | `` ` ``         | —             | —                          |

`?debug=1` abre o painel de debug direto; `?hitboxes=1` desenha os corpos de colisão.

## Scripts

| Comando                    | O que faz                                                |
| -------------------------- | -------------------------------------------------------- |
| `npm run dev`              | servidor de desenvolvimento com HMR                      |
| `npm run build`            | typecheck + build estática em `dist/`                    |
| `npm test`                 | testes unitários da camada `core` (Vitest)               |
| `npm run test:e2e`         | smoke de browser contra a build de produção (Playwright) |
| `npm run lint`             | ESLint, incluindo a fronteira `core` ↛ Phaser            |
| `npm run ci`               | tudo acima, na ordem do CI                               |
| `npm run art:placeholders` | regenera todos os assets placeholder                     |
| `npm run build:standalone` | empacota o jogo num HTML único, sem requisições          |

## Arquitetura em uma tela

```
src/
├── core/      TypeScript PURO — zero Phaser, zero DOM. Todas as regras.
│              movimento, mira, armas, câmera, fases, save, input, animação
├── game/      Phaser: scenes, sprites, corpos Arcade, pools, FX, devices
├── ui/        DOM: HUD, controles touch, aviso de orientação
├── platform/  adaptadores (armazenamento, detecção de dispositivo)
└── assets/    manifesto tipado (chaves lógicas → arquivos)
```

A fronteira `core` ↛ `game` é **aplicada por lint**, não por convenção: um
import de Phaser dentro de `src/core` quebra o CI. É isso que mantém a
simulação testável em Node — os 132 testes unitários rodam em ~1 s, sem
canvas, sem WebGL. A IA dos inimigos inteira é testada assim: "soldado vê o
jogador → telegrafa antes de atirar" é um teste unitário, não um playtest.

Divisão de responsabilidade com a física: **`core` é dono da velocidade**
(inclusive gravidade, corte de pulo, coyote time), **o Arcade é dono da posição
e da resolução de colisão**. Sem isso, o que define o game feel ficaria preso
dentro do motor, impossível de testar e chato de ajustar.

A simulação roda em **passo fixo de 60 Hz** com acumulador: o resultado depende
do tempo decorrido, não do ritmo de frames. Apresentação e câmera rodam uma vez
por frame, depois da física.

Detalhes e justificativas: [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md).

## Documentos

| Documento                                                        | O que é                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md)               | plano técnico: arquitetura, módulos, interfaces, roadmap, MVP, riscos    |
| [`docs/ART_SPEC.md`](docs/ART_SPEC.md)                           | spec normativa de arte: métricas, paleta, pivôs, estilo, aceitação       |
| [`docs/AI_ART_BRIEF.md`](docs/AI_ART_BRIEF.md)                   | briefing para produzir a arte final com IA: pipeline, prompts, validação |
| [`docs/ASSET_INVENTORY.md`](docs/ASSET_INVENTORY.md)             | lista de encomenda da arte — **gerada automaticamente**, nunca editar    |
| [`docs/placeholder-preview.html`](docs/placeholder-preview.html) | folha de contato dos placeholders, com as animações rodando              |

## Assets placeholder

Toda a arte atual é **temporária**, gerada por código de forma determinística
(`npm run art:placeholders`, sem dependências). Ela obedece à mesma
especificação exigida da arte final — mesmos tamanhos de frame, pivôs,
contagens de frame e a paleta de 48 cores. **Substituir por arte definitiva é
trocar arquivos, sem tocar em código de gameplay.**

Rodar o gerador duas vezes produz bytes idênticos, e o CI falha se o commit
sair de sincronia com o gerador.

## Build autocontida

`npm run build:standalone` gera `dist-standalone/redline.html`: o jogo inteiro
num arquivo de ~1,5 MB, com JS e CSS inline e todas as imagens como data-URI.
**Zero requisições de rede** — abre por `file://`, serve para anexar, hospedar
em qualquer lugar ou publicar sob CSP restrita.

Os JSON dos atlas vão como objeto num global em vez de data-URI: como data-URI
o loader do Phaser faria XHR neles, e uma CSP que proíba `connect-src data:`
derrubaria o jogo só em produção. O build ainda falha se sobrar qualquer
caminho de asset no bundle.

A mesma build sai em duas formas: um documento completo e um fragmento sem
`<html>`/`<head>`/`<body>`, para hosts que injetam o próprio esqueleto.

## Alvos de performance

Resolução lógica **640×360** com altura fixa e largura elástica (640–800),
renderizada 1:1 e ampliada por CSS. Um aparelho 1080p desenha ~288 mil pixels
por frame em vez de 2 milhões.

Build atual: **~383 KB gzip** no total (Phaser 358 KB + jogo 23 KB + CSS 1,6 KB).

Testes: **132 unitários** (~1 s, sem browser) e **26 de browser** (desktop e
mobile landscape, contra a build de produção).

## Originalidade

Personagens, cenários, inimigos, efeitos, sons e história são originais.
Nenhum asset é derivado de obra existente — as restrições e o processo de
verificação estão em [`docs/ART_SPEC.md`](docs/ART_SPEC.md) §9 e
[`docs/AI_ART_BRIEF.md`](docs/AI_ART_BRIEF.md) §7.
