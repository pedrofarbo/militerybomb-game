# REDLINE

Jogo 2D de ação lateral (run & gun) para browser, celular e tablet.
Phaser 4 + TypeScript + Vite. Single-player.

> **Estado:** Fase 0 (arquitetura) e Fase 1 (protótipo do player) concluídas.
> O player corre, pula, mira em 8 direções e atira, com teclado, gamepad e
> touch, numa fase de teste com câmera, parallax e respawn.
> Sem inimigos ainda — isso é a Fase 2.

## Começando

```bash
npm install
npm run dev          # http://localhost:5173
```

Requer Node.js ≥ 22.12.

### Controles

| Ação        | Teclado         | Gamepad       | Touch                      |
| ----------- | --------------- | ------------- | -------------------------- |
| Mover       | `A` `D` / setas | stick / D-pad | direcional flutuante       |
| Mirar       | `W` `S` / setas | stick         | direcional                 |
| Pular       | `Espaço` / `K`  | A             | botão **PULO**             |
| Atirar      | `J` / `Ctrl`    | X / RT        | botão **TIRO** (segurável) |
| Trocar arma | `Q` / `Tab`     | LB            | —                          |
| Debug       | `` ` ``         | —             | —                          |

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
simulação testável em Node — os 67 testes unitários rodam em ~0,5 s, sem
canvas, sem WebGL.

Divisão de responsabilidade com a física: **`core` é dono da velocidade**
(inclusive gravidade, corte de pulo, coyote time), **o Arcade é dono da posição
e da resolução de colisão**. Sem isso, o que define o game feel ficaria preso
dentro do motor, impossível de testar e chato de ajustar.

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

## Alvos de performance

Resolução lógica **640×360** com altura fixa e largura elástica (640–800),
renderizada 1:1 e ampliada por CSS. Um aparelho 1080p desenha ~288 mil pixels
por frame em vez de 2 milhões.

Build atual: **~375 KB gzip** no total (Phaser 358 KB + jogo 16 KB + CSS 1,4 KB).

## Originalidade

Personagens, cenários, inimigos, efeitos, sons e história são originais.
Nenhum asset é derivado de obra existente — as restrições e o processo de
verificação estão em [`docs/ART_SPEC.md`](docs/ART_SPEC.md) §9 e
[`docs/AI_ART_BRIEF.md`](docs/AI_ART_BRIEF.md) §7.
