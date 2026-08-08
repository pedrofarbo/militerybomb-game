# REDLINE

Jogo 2D de ação lateral (run & gun) para browser, celular e tablet.
Phaser 4 + TypeScript + Vite. Single-player.

> **Estado atual:** Fase 0 não iniciada. O repositório contém o plano técnico
> aprovado, os assets placeholder e as especificações de arte.

## Documentos

| Documento | O que é |
|---|---|
| [`docs/TECHNICAL_PLAN.md`](docs/TECHNICAL_PLAN.md) | Plano técnico completo: arquitetura, módulos, interfaces, roadmap, MVP, riscos |
| [`docs/ART_SPEC.md`](docs/ART_SPEC.md) | Especificação normativa de arte: métricas, paleta, pivôs, estilo, aceitação |
| [`docs/AI_ART_BRIEF.md`](docs/AI_ART_BRIEF.md) | Briefing para produzir a arte final com IA: pipeline, prompts, normalização, validação |
| [`docs/ASSET_INVENTORY.md`](docs/ASSET_INVENTORY.md) | Lista de encomenda da arte — **gerada automaticamente**, nunca editar |
| [`docs/placeholder-preview.html`](docs/placeholder-preview.html) | Folha de contato dos placeholders, com as animações rodando |

## Assets placeholder

Toda a arte atual é **temporária**, gerada por código de forma determinística:

```bash
npm run art:placeholders
```

Saída em `public/assets/` (atlases, tileset, parallax) e
`src/assets/sprite-manifest.generated.ts` (contrato tipado entre assets e gameplay).

Os placeholders obedecem à mesma especificação exigida da arte final — mesmos
tamanhos de frame, mesmos pivôs, mesmas contagens de frame, mesma paleta de 48
cores. **Substituir por arte definitiva é trocar arquivos, sem tocar em código
de gameplay.**

Rodar o gerador duas vezes produz bytes idênticos, então regeneração não gera
ruído no histórico do git.

## Requisitos

- Node.js ≥ 22.12

## Originalidade

Personagens, cenários, inimigos, efeitos, sons e história são originais. Nenhum
asset é derivado de obra existente — as restrições e o processo de verificação
estão em [`docs/ART_SPEC.md`](docs/ART_SPEC.md) §9 e
[`docs/AI_ART_BRIEF.md`](docs/AI_ART_BRIEF.md) §7.
