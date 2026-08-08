# PLANO TÉCNICO — Jogo 2D Run & Gun (Browser + Mobile)

**Codinome do projeto:** `REDLINE` (nome comercial a definir)
**Status:** proposta de arquitetura — aguardando aprovação antes da implementação
**Data:** 2026-08-08
**Autor:** arquitetura / direção técnica

---

## 1. Executive Summary

Proposta: um jogo 2D side-scrolling run & gun, single-player, rodando em um único runtime
web (Phaser + TypeScript + Vite) que atende desktop, celular e tablet com **um único código
de gameplay**, sem branches por plataforma.

O eixo central da arquitetura é uma separação em duas camadas com uma fronteira **fisicamente
verificável** (regra de lint, não convenção):

- **`src/core/` — camada de regras.** TypeScript puro, **zero imports de Phaser**. Contém
  regras de dano, armas, cooldowns, máquinas de estado do player e dos inimigos, script de
  boss, progressão, checkpoints, save/load, mapeamento de input e resolução de animação.
  100% testável em Node, sem canvas, sem WebGL, sem DOM.
- **`src/game/` — camada de apresentação e integração.** Scenes, sprites, corpos de física
  Arcade, atlas, partículas, câmera, áudio. Consulta `core/` para decidir; nunca decide.

Ponto de honestidade arquitetural: com Phaser Arcade Physics, **transform e colisão vivem
no GameObject** — não dá para ter uma simulação 100% headless sem escrever física própria,
o que seria um custo enorme e desnecessário. Portanto a fronteira que adotamos é:
*transform e broadphase são do Phaser; todo o resto das regras é puro*. Isso entrega ~90%
do benefício de testabilidade e desacoplamento com ~10% do custo de um ECS/simulação headless.

O MVP é um **vertical slice**: uma fase curta e polida (2–3 minutos), com 3 tipos de inimigo,
3 armas, granadas, objetos destrutíveis, 1 checkpoint, 1 mini-boss de 2 fases, HUD, áudio,
FX e controles de teclado/gamepad/touch.

Duas decisões precisam da sua confirmação antes de escrever a primeira linha (detalhes em §2.1):
**(a)** Phaser 4.2.1 em vez de Phaser 3.90 e **(b)** resolução lógica 640×360 com largura
flexível em vez de 1280×720 fixo.

---

## 2. Architecture Decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Engine | **Phaser 4.2.1** (recomendado) — Phaser 3.90.0 como fallback | Phaser 3.90 (mai/2025) é o último 3.x; Phaser 4 tem renderer node-based novo, ESM real com tree-shaking e types no pacote. Iniciar num ramo terminal força migração em 6 meses. Ver §2.1. |
| 2 | Linguagem | TypeScript 6.0.3, `strict: true` | TS 7.0.2 é GA e ~10x mais rápido, mas `typescript-eslint` declara peer `<6.1.0` e recusou suporte a TS7; ESLint core está bloqueado atrás disso. Revisitar no TS 7.1 (~out/2026). |
| 3 | Bundler | Vite 8.2.1 (Rolldown) | Padrão de mercado, HMR, build estática com fingerprint, code-splitting por fase. |
| 4 | Física | Phaser Arcade Physics, **fixed step 60Hz** | AABB, previsível, barato em mobile. `fps: 60, fixedStep: true` para determinismo e testes reprodutíveis. Matter só se surgirem veículos com física real (pós-MVP). |
| 5 | Fronteira sim/render | Pasta `core/` sem Phaser + regra ESLint `no-restricted-imports` | Fronteira verificada pelo CI, não por disciplina. |
| 6 | Padrão de entidade | Classes de entidade (Sprite + `state`) delegando decisões a módulos puros | ECS completo é overkill para ~60 entidades ativas; classes com "brains" puros dão testabilidade sem o custo cognitivo. |
| 7 | Comunicação entre sistemas | Event bus tipado (`GameEventBus`), hand-rolled (~40 linhas) | HUD/áudio/FX reagem a eventos sem que o gameplay conheça a apresentação. Sem Redux/Zustand — não há estado de UI compartilhado complexo. |
| 8 | Gerência de estado | Objetos planos + `RunState`/`ProfileState`; sem lib de estado | Estado de jogo muda 60x/s; libs de estado imutável são contraindicadas por GC. |
| 9 | Resolução | Lógica **640×360**, altura fixa, largura elástica 640–800 | 640×360 é divisor exato de 1280×720 e 1920×1080. Largura elástica elimina letterbox pesado em 19.5:9 sem redesenhar HUD. Ver §2.1(b). |
| 10 | Scale Manager | `Scale.NONE` + resize handler próprio (altura lógica fixa, `zoom` calculado) | `FIT` letterboxa; `RESIZE` sem clamp quebra balanceamento. O handler próprio garante altura constante e largura previsível. |
| 11 | Pixel art | `pixelArt: true` (NEAREST), `roundPixels: true`, `antialias: false` | Nitidez consistente; escala não-inteira tratada só no upscale final do canvas. |
| 12 | HUD e menus | **DOM/HTML/CSS** sobre o canvas, sem framework | `env(safe-area-inset-*)`, acessibilidade, texto nítido em qualquer DPI, zero custo de draw call. Framework não se justifica para ~10 elementos. |
| 13 | Controles touch | **DOM** (Pointer Events), não objetos Phaser | Multitouch nativo, safe areas via CSS, funciona mesmo com o canvas travado, e sobrevive a pause. |
| 14 | Áudio | Phaser WebAudioSoundManager + camada `AudioService` | Sem Howler: dependência a mais para resolver problema que o Phaser já resolve. Unlock por gesto tratado no `AudioService`. |
| 15 | Level data | **Tiled** (`.tmj`) para tiles + object layers para spawns/triggers, parseado para `LevelDef` validado | Ferramenta gratuita, iteração rápida do level design, fonte única de verdade. |
| 16 | Assets | Atlas empacotado no build, manifesto de chaves lógicas (`player.run`) | Gameplay nunca referencia caminho de arquivo. |
| 17 | Save | `SaveRepository` (interface) + `LocalStorageSaveRepository`, dados versionados + migrations | Troca por backend/cloud depois sem tocar no gameplay. |
| 18 | Testes | Vitest 4 (unit em `core/`) + Playwright 1.62 (smoke/replay determinístico) | `core/` roda em Node; o jogo inteiro roda em browser real via input scriptado. |
| 19 | PWA | `vite-plugin-pwa` 1.3.0, ligado só na Fase 6 | Não deixar service worker atrapalhar o dev loop nem o cache de assets durante a produção de arte. |
| 20 | Backend | **Nenhum** no MVP | Sem ranking online, sem contas. §30 (segurança) só prepara o terreno. |

### 2.1 Conflitos identificados e decisões pendentes (precisam da sua aprovação)

**(a) Phaser 3 vs Phaser 4 — CONFLITO com o requisito §2 do briefing.**
Você especificou Phaser 3. Estado real hoje (verificado no registry npm em 2026-08-08):

| | Phaser 3.90.0 | Phaser 4.2.1 |
|---|---|---|
| Publicado | 2025-05-23 (último 3.x) | 2026-07-09 |
| Renderer | pipelines v3 | node-based, batching melhor |
| ESM / tree-shaking | parcial | ESM nativo (`dist/phaser.esm.js`) |
| Arcade Physics | sim | sim, praticamente inalterada |
| Canvas fallback | sim | presente mas **deprecado** (WebGL é baseline) |
| Corpus de tutoriais | enorme | pequeno (4 meses) |
| Plugins da comunidade | todos | parte ainda não portada |

Recomendo **Phaser 4.2.1**: o projeto é greenfield com horizonte de 6+ meses e começar em
um ramo terminal significa migração forçada depois. Os breaking changes que nos afetam são
poucos (FX/Masks unificados em Filters, `Geom.Point` → `Vector2`, `setTintFill` → `setTintMode`)
e todos ficam encapsulados em `game/fx/`. **Não é troca de engine** — continua Phaser, então
a sua regra "não substitua Phaser" permanece respeitada.
Se preferir 3.90, o custo é contido: `core/` é livre de Phaser, e apenas `game/` muda.

**(b) 1280×720 vs 640×360.** Você citou 1280×720 como resolução lógica. Para pixel art isso
significa ou sprites minúsculos ou arte em altíssima resolução (caro de produzir). Proponho
**640×360 como resolução lógica de simulação e arte**, apresentada em 1280×720 (×2) ou
1920×1080 (×3). O alvo de apresentação que você pediu é mantido; muda a unidade da arte.

**(c) Veículos.** Aparecem em §1 do briefing (objetivo) mas não em §6 (MVP). Trato como
**fora do MVP**, com a arquitetura preparada (`VehicleMount` component, §28).

**(d) "Hitscan quando apropriado".** No MVP nenhuma arma usa hitscan — projéteis visíveis são
parte da leitura de um run & gun. A API (`WeaponDef.delivery: 'projectile' | 'hitscan'`) fica
pronta; o sniper/laser pós-MVP usa.

**(e) Sangue.** Proponho **não usar sangue**: partículas de faísca/óleo/estilhaço. Evita
classificação etária restritiva em lojas e é coerente com inimigos parcialmente mecanizados.

**(f) Origem da arte.** É o maior risco de cronograma e não é uma decisão técnica. Preciso
saber se haverá artista dedicado, contratação, ou se devo entregar tudo com um kit de
placeholder programático (formas sólidas + atlas gerado) e substituir depois.

**(g) Idioma.** Estruturo i18n desde o começo (arquivos `pt-BR`/`en`), sem seletor no MVP.

### 2.2 Identidade original (direção de conteúdo)

Para garantir que nada seja derivado de obras existentes, o conteúdo parte de uma premissa própria:

> **REDLINE** — Um arquipélago tropical industrializado colapsou após um acidente numa
> refinaria de terras raras. O **Consórcio Halcyon**, uma empresa militar privada, isolou a
> região para explorar o material. Você comanda a **Brigada Redline**, uma equipe de demolição
> que entra pela zona de quarentena para destruir a operação por dentro.

- Paleta: laranja-ferrugem, teal industrial, amarelo de sinalização, concreto sujo.
- Protagonistas: **Dara Mott** (demolição) e **Kes Odilon** (suporte pesado) — só Dara no MVP.
- Inimigos: soldados do Consórcio com exoesqueleto leve — visual anônimo, capacete integral.
- Mini-boss da Fase 1: **"Estivador"**, um guindaste portuário blindado reaproveitado.
- Nenhum asset, sprite, som, logo, nome ou cenário é derivado de obra existente.

---

## 3. Technology Stack

Versões verificadas no registry npm em **2026-08-08**. Nada abaixo é estimado.

| Camada | Pacote | Versão | Observação |
|---|---|---|---|
| Runtime Node | Node.js | **22.12+ LTS** | Exigido por Vite 8 (`^20.19.0 \|\| >=22.12.0`) |
| Engine | `phaser` | **4.2.1** | Alternativa: `3.90.0` (ver §2.1a) |
| Linguagem | `typescript` | **6.0.3** | TS 7.0.2 é GA mas incompatível com typescript-eslint |
| Build | `vite` | **8.2.1** | Baseado em Rolldown |
| Testes unit | `vitest` | **4.1.10** | Node `^20 \|\| ^22 \|\| >=24` |
| Testes browser | `@playwright/test` | **1.62.1** | Chromium já disponível no ambiente |
| Lint | `eslint` | **10.8.1** | Node `^20.19 \|\| ^22.13 \|\| >=24` |
| Lint TS | `typescript-eslint` | **8.66.0** | peer: `typescript >=4.8.4 <6.1.0` |
| Format | `prettier` | **3.9.6** | |
| PWA (Fase 6) | `vite-plugin-pwa` | **1.3.0** | usa Workbox 7.4.x |

**Dependências de runtime em produção: apenas `phaser`.** Tudo o mais é devDependency.

Ferramentas fora do npm (versão fixada na instalação, não estimada aqui):
- **Aseprite** — produção de sprites e exportação de spritesheet + JSON.
- **Tiled** — edição de fases, exportação `.tmj`.
- Empacotador de atlas por CLI no build (a escolher entre `free-tex-packer-cli` e TexturePacker
  CLI; avaliar licença e determinismo de saída antes de fixar).

**Explicitamente NÃO usados:** React/Next no gameplay, Redux, Zustand, Howler, biblioteca de
ECS, backend, banco de dados, lib de state management, lib de animação externa.

---

## 4. Game Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        DOM LAYER (HTML/CSS/TS)                   │
│   HUD · Menus · Pause · Settings · Touch Controls · Orientation   │
└───────────────▲──────────────────────────────────┬───────────────┘
                │ eventos (read-only)              │ Actions
┌───────────────┴──────────────────────────────────▼───────────────┐
│                      GAME LAYER (src/game/) — Phaser             │
│  Scenes · Entities(Sprite+Body) · Pools · FX · Camera · Audio    │
│  Traduz estado→pixels e input→Actions. NÃO contém regras.        │
└───────────────▲──────────────────────────────────┬───────────────┘
                │ resultados                       │ consultas
┌───────────────┴──────────────────────────────────▼───────────────┐
│                    CORE LAYER (src/core/) — TS puro              │
│  Damage · Weapons · Brains · StateMachines · BossScript ·        │
│  Progression · Checkpoints · Save · InputMapping · AnimResolver  │
│                    ZERO imports de Phaser                        │
└──────────────────────────────────────────────────────────────────┘
```

**Simulation.** Vive em `core/`. É um conjunto de funções e máquinas de estado puras que
recebem um snapshot (`BrainContext`, `HealthState`, `WeaponState`) e retornam uma decisão
(`BrainOutput`, `DamageResult`, `ShotRequest[]`). Não guarda referência a nada do Phaser.
Todo teste unitário do jogo mora aqui.

**Renderer.** Vive em `game/`. Um `Actor` é um `Phaser.Physics.Arcade.Sprite` que carrega um
objeto `state` plano. A cada frame o Actor monta o contexto, chama o core, e **aplica** o
resultado (seta velocidade, dispara animação, pede FX). O renderer nunca é fonte de verdade:
se um sprite for destruído, o estado lógico já foi resolvido antes.

**Input.** Três devices (`KeyboardDevice`, `GamepadDevice`, `TouchDevice`) produzem um
`RawInput`. O `InputManager` funde tudo num `InputSnapshot` de ações abstratas. O gameplay
só vê `snapshot.held(Action.Shoot)`.

**UI.** DOM puro sobre o canvas, sincronizado por eventos. Nada de UI dentro de Scene do Phaser,
exceto elementos ancorados ao mundo (números de dano, marcador de boss fora da tela).

**Assets.** Manifesto de chaves lógicas → atlas empacotado. Carregamento em duas ondas:
boot (mínimo para a tela de carregamento) e level (assets da fase).

**Audio.** `AudioService` com barramentos por categoria (music/sfx/ambience/ui), unlock por
gesto, ducking em explosões, volumes persistidos via Save.

**Save.** `SaveRepository` com implementação localStorage; dados versionados e serializáveis.

**Debug.** `DebugService` com painéis registráveis; ativado por `?debug=1` ou tecla `` ` ``.
Nenhum `if (DEBUG)` espalhado pelo código de gameplay.

---

## 5. Project Structure

```
militerybomb-game/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
├── .prettierrc
├── playwright.config.ts
├── vitest.config.ts
│
├── docs/
│   ├── TECHNICAL_PLAN.md
│   ├── ART_SPEC.md              # tamanhos, paleta, PPU, política pixel-perfect
│   └── LEVEL_AUTHORING.md       # convenções do Tiled
│
├── tools/
│   ├── pack-atlas.mjs           # spritesheets → atlas
│   └── validate-levels.mjs      # valida .tmj contra o schema em build time
│
├── public/
│   └── assets/                  # servido tal e qual, fingerprint no build
│       ├── atlas/               # characters.png/json, enemies, fx, env, ui
│       ├── levels/              # level-01.tmj, tileset.png
│       ├── audio/               # music/*.ogg|m4a, sfx/sfx-sprite.*
│       └── fonts/
│
├── src/
│   ├── main.ts                  # bootstrap: DOM shell + Phaser.Game
│   │
│   ├── core/                    # ─── TS PURO. Proibido importar phaser ───
│   │   ├── math/                # vec2, clamp, lerp, rng determinístico
│   │   ├── fsm/                 # StateMachine<TId, TCtx> genérico
│   │   ├── events/              # GameEventBus tipado + EventMap
│   │   ├── input/
│   │   │   ├── actions.ts       # enum Action
│   │   │   ├── bindings.ts      # perfis default keyboard/gamepad
│   │   │   ├── snapshot.ts      # InputSnapshot + ButtonState
│   │   │   └── mapping.ts       # funções puras de mapeamento
│   │   ├── combat/
│   │   │   ├── health.ts        # HealthState, applyDamage, iframes
│   │   │   ├── damage.ts        # DamageInfo, resistências, knockback
│   │   │   ├── overlap.ts       # AABB / círculo, queries de explosão
│   │   │   └── hitbox.ts        # Hitbox/Hurtbox lógicos
│   │   ├── weapons/
│   │   │   ├── weapon-def.ts    # WeaponDef (dados)
│   │   │   ├── weapon-state.ts  # cooldown, munição, spread, recarga
│   │   │   └── fire.ts          # tryFire → ShotRequest[]
│   │   ├── player/
│   │   │   ├── player-state.ts  # PlayerState, locomotion FSM
│   │   │   ├── movement.ts      # aceleração, coyote time, jump buffer
│   │   │   └── aim.ts           # 8-way aim a partir do input
│   │   ├── enemies/
│   │   │   ├── brain.ts         # interface EnemyBrain, BrainContext/Output
│   │   │   ├── soldier.ts       # brains puros
│   │   │   ├── heavy.ts
│   │   │   └── turret.ts
│   │   ├── boss/
│   │   │   ├── script.ts        # timeline runner puro
│   │   │   └── estivador.ts     # fases e padrões do mini-boss
│   │   ├── anim/
│   │   │   └── resolver.ts      # estado → chave de animação
│   │   ├── level/
│   │   │   ├── schema.ts        # LevelDef, tipos de entidade/trigger
│   │   │   └── parse.ts         # .tmj → LevelDef (validado)
│   │   ├── progression/
│   │   │   ├── run-state.ts     # tentativa atual: vidas, score, checkpoint
│   │   │   └── checkpoint.ts
│   │   ├── save/
│   │   │   ├── schema.ts        # SaveDataV1 + migrations
│   │   │   └── repository.ts    # interface SaveRepository
│   │   └── config/
│   │       └── tuning.ts        # TODAS as constantes de balanceamento
│   │
│   ├── game/                    # ─── Phaser ───
│   │   ├── boot/
│   │   │   ├── game-config.ts
│   │   │   └── scale.ts         # resize handler próprio
│   │   ├── scenes/
│   │   │   ├── BootScene.ts
│   │   │   ├── PreloadScene.ts
│   │   │   ├── LevelScene.ts    # orquestra a fase (fina!)
│   │   │   └── WorldUiScene.ts  # UI ancorada ao mundo
│   │   ├── entities/
│   │   │   ├── Actor.ts         # base: Sprite + state + core bridge
│   │   │   ├── PlayerActor.ts
│   │   │   ├── EnemyActor.ts    # genérico, plugado com um EnemyBrain
│   │   │   ├── BossActor.ts
│   │   │   ├── Projectile.ts
│   │   │   ├── Grenade.ts
│   │   │   └── Destructible.ts
│   │   ├── systems/
│   │   │   ├── CollisionMatrix.ts   # ÚNICO lugar que registra colliders
│   │   │   ├── CombatSystem.ts      # resolve hits, explosões, knockback
│   │   │   ├── SpawnSystem.ts       # spawn por trigger/distância
│   │   │   ├── PoolRegistry.ts
│   │   │   └── QualitySystem.ts     # degradação automática por FPS
│   │   ├── fx/
│   │   │   ├── FxService.ts
│   │   │   └── fx-defs.ts
│   │   ├── camera/
│   │   │   ├── CameraDirector.ts
│   │   │   ├── Shake.ts             # modelo de trauma
│   │   │   └── Parallax.ts
│   │   ├── audio/
│   │   │   └── AudioService.ts
│   │   ├── input/
│   │   │   ├── InputManager.ts
│   │   │   ├── KeyboardDevice.ts
│   │   │   ├── GamepadDevice.ts
│   │   │   ├── TouchDevice.ts       # lê o DOM, emite RawInput
│   │   │   └── ReplayDevice.ts      # input scriptado (E2E e debug)
│   │   ├── level/
│   │   │   └── LevelBuilder.ts      # LevelDef → objetos Phaser
│   │   ├── anim/
│   │   │   └── AnimationRegistry.ts
│   │   └── debug/
│   │       ├── DebugService.ts
│   │       └── panels/
│   │
│   ├── ui/                      # ─── DOM ───
│   │   ├── UiRoot.ts
│   │   ├── hud/                 # HealthBar, AmmoWidget, Score, BossBar
│   │   ├── menus/               # MainMenu, Pause, Settings, GameOver, LevelComplete
│   │   ├── touch/               # Joystick.ts, ActionButtons.ts
│   │   ├── OrientationGate.ts
│   │   ├── i18n/                # pt-BR.json, en.json
│   │   └── styles/              # *.css (safe areas, temas)
│   │
│   ├── platform/                # adaptadores de plataforma
│   │   ├── storage.ts           # localStorage com fallback in-memory
│   │   ├── device.ts            # touch?, DPI, tier de performance
│   │   └── fullscreen.ts
│   │
│   └── assets/
│       └── manifest.ts          # chaves lógicas → arquivos
│
└── tests/
    ├── unit/                    # espelha src/core/
    └── e2e/                     # Playwright + replays
```

---

## 6. Core Interfaces

Assinaturas centrais (esboço, não implementação final).

```ts
// core/input/actions.ts
export const Action = {
  MoveLeft: 'MOVE_LEFT', MoveRight: 'MOVE_RIGHT', AimUp: 'AIM_UP', AimDown: 'AIM_DOWN',
  Jump: 'JUMP', Shoot: 'SHOOT', Grenade: 'GRENADE', Special: 'SPECIAL',
  SwitchWeapon: 'SWITCH_WEAPON', Pause: 'PAUSE', Confirm: 'CONFIRM', Cancel: 'CANCEL',
} as const;
export type Action = (typeof Action)[keyof typeof Action];

// core/input/snapshot.ts
export interface InputSnapshot {
  readonly axisX: number;              // -1..1, analógico no gamepad/joystick
  readonly axisY: number;
  held(a: Action): boolean;
  justPressed(a: Action): boolean;     // borda de subida neste frame
  justReleased(a: Action): boolean;
  heldMs(a: Action): number;           // para pulo variável e carga
}

export interface InputDevice {
  readonly id: 'keyboard' | 'gamepad' | 'touch' | 'replay';
  poll(nowMs: number): RawInput;       // sem side effects no gameplay
  readonly connected: boolean;
}

// core/combat/health.ts
export interface HealthState {
  current: number; max: number;
  invulnUntilMs: number; lastHitMs: number;
}
export interface DamageInfo {
  amount: number; sourceId: EntityId; kind: DamageKind;
  originX: number; originY: number; knockback: number;
}
export interface DamageResult {
  applied: number; killed: boolean; ignoredByInvuln: boolean;
  knockbackX: number; knockbackY: number;
}
export function applyDamage(h: HealthState, d: DamageInfo, nowMs: number): DamageResult;

// core/weapons/weapon-def.ts
export interface WeaponDef {
  readonly id: WeaponId;
  readonly displayNameKey: string;
  readonly delivery: 'projectile' | 'hitscan';
  readonly fireRateMs: number;
  readonly damage: number;
  readonly pelletsPerShot: number;
  readonly spreadDeg: number;
  readonly projectileSpeed: number;
  readonly projectileLifeMs: number;
  readonly ammoMax: number | 'infinite';
  readonly ammoPerShot: number;
  readonly autoFire: boolean;
  readonly recoil: number;
  readonly screenShake: number;         // trauma 0..1
  readonly explosion?: ExplosionDef;
  readonly fx: { muzzle: FxKey; impact: FxKey; sfx: AudioKey };
  readonly anim: { shootOverride?: AnimKey };
}

// core/weapons/fire.ts
export interface ShotRequest {
  x: number; y: number; angleRad: number; speed: number;
  damage: number; ownerId: EntityId; team: Team; defId: WeaponId;
}
export function tryFire(
  s: WeaponState, def: WeaponDef, ctx: FireContext, nowMs: number
): { shots: ShotRequest[]; nextState: WeaponState; reason?: 'cooldown' | 'no-ammo' };

// core/enemies/brain.ts
export interface BrainContext {
  readonly self: { x: number; y: number; hp: number; facing: -1 | 1; grounded: boolean };
  readonly player: { x: number; y: number; alive: boolean } | null;
  readonly canSeePlayer: boolean;      // fornecido pela camada game (raycast)
  readonly distanceToPlayer: number;
  readonly blockedAhead: boolean;
  readonly edgeAhead: boolean;
  readonly nowMs: number;
}
export interface BrainOutput {
  readonly moveX: -1 | 0 | 1;
  readonly wantJump: boolean;
  readonly wantFire: boolean;
  readonly aimAngleRad: number | null;
  readonly facing: -1 | 1;
  readonly state: EnemyStateId;        // IDLE|PATROL|ALERT|ATTACK|HURT|DEAD
}
export interface EnemyBrain {
  readonly id: EnemyTypeId;
  update(ctx: BrainContext, dtMs: number): BrainOutput;
  onDamaged(d: DamageResult, nowMs: number): void;
  reset(nowMs: number): void;
}

// core/anim/resolver.ts
export function resolveAnim(v: ActorVisualState): { key: AnimKey; lock: boolean };

// core/save/repository.ts
export interface SaveRepository {
  load(): Promise<SaveData | null>;
  save(d: SaveData): Promise<void>;
  clear(): Promise<void>;
}

// core/events/bus.ts
export interface GameEventMap {
  'player:damaged':   { hp: number; max: number };
  'player:died':      { atCheckpointId: string };
  'weapon:changed':   { weaponId: WeaponId; ammo: number | 'infinite' };
  'ammo:changed':     { ammo: number | 'infinite' };
  'grenades:changed': { count: number };
  'score:changed':    { score: number; delta: number };
  'enemy:killed':     { typeId: EnemyTypeId; x: number; y: number };
  'boss:spawned':     { id: string; maxHp: number };
  'boss:hp':          { hp: number; max: number; phase: number };
  'checkpoint:reached': { id: string };
  'level:complete':   { levelId: string; timeMs: number; score: number };
  'quality:changed':  { level: QualityLevel };
}
export interface GameEventBus {
  on<K extends keyof GameEventMap>(k: K, fn: (p: GameEventMap[K]) => void): () => void;
  emit<K extends keyof GameEventMap>(k: K, p: GameEventMap[K]): void;
}
```

---

## 7. Game State

Três escopos com tempos de vida distintos — a confusão entre eles é uma fonte clássica de bugs:

| Escopo | Vive enquanto | Persistido? | Conteúdo |
|---|---|---|---|
| `ProfileState` | para sempre | **sim** (localStorage) | fases desbloqueadas, high score, settings, estatísticas |
| `RunState` | uma tentativa (do start ao game over) | não | vidas, score da run, checkpoint atual, arma/munição atual, tempo |
| `LevelRuntime` | uma carga de fase | não | entidades vivas, triggers disparados, spawns consumidos, estado do boss |

```ts
interface RunState {
  levelId: string;
  lives: number;
  score: number;
  startedAtMs: number;
  checkpoint: CheckpointSnapshot | null;
  loadout: { weaponId: WeaponId; ammo: number | 'infinite'; grenades: number };
}

interface CheckpointSnapshot {          // serializável, sem objetos Phaser
  id: string;
  spawnX: number; spawnY: number;
  score: number;
  loadout: RunState['loadout'];
  consumedTriggerIds: string[];
}
```

Regra: **morrer** restaura `RunState` a partir de `CheckpointSnapshot` e recarrega o
`LevelRuntime` da região. Nada além de `ProfileState` toca o disco.

O estado de cada entidade é um objeto plano dentro do Actor (`actor.state`), nunca disperso em
propriedades do Sprite. Isso permite serializar uma entidade para debug/replay.

---

## 8. Input Architecture

```
KeyboardDevice ─┐
GamepadDevice ──┼──► InputManager.update(dt) ──► InputSnapshot ──► gameplay
TouchDevice ────┤        (merge + edge detection)
ReplayDevice ───┘
```

- Cada device implementa `poll()` e devolve `RawInput` = `{ axisX, axisY, buttons: Set<Action> }`.
- O `InputManager` funde os devices por OR (teclado + gamepad simultâneos funcionam), calcula
  `justPressed`/`justReleased`/`heldMs` comparando com o frame anterior, e expõe o snapshot
  **imutável do frame**.
- O merge e a detecção de bordas são funções puras em `core/input/mapping.ts` → testáveis.
- **Keyboard:** bindings default (`A/D` ou setas, `Space` pulo, `J`/`Ctrl` tiro, `K` granada,
  `L` special, `Esc` pause) num `BindingProfile` remapeável e persistido.
- **Gamepad:** Gamepad API padrão; stick esquerdo → `axisX/axisY` analógico com deadzone 0.25,
  D-pad → digital; suporte a hot-plug via `gamepadconnected`.
- **Touch:** `TouchDevice` **não lê o canvas** — lê o estado publicado pelos widgets DOM
  (`ui/touch/`), que usam Pointer Events com `setPointerCapture`. Multitouch sai de graça
  porque cada widget rastreia seu próprio `pointerId`.
- **Replay:** consome uma lista de `(frameIndex, actions)`. Combinado com `fixedStep: true` e
  RNG semeado, torna o gameplay reprodutível — base dos testes E2E e da caça a bugs.

Regra dura: nenhum arquivo fora de `game/input/` e `ui/touch/` pode importar
`Phaser.Input.Keyboard` ou tocar em eventos de DOM de input.

---

## 9. Player Architecture

**Locomotion FSM** (estados mutuamente exclusivos):
`SPAWN → IDLE ⇄ RUN ⇄ JUMP_RISE → FALL → LAND`, mais `HURT` e `DEAD` (com prioridade).

**Modificadores ortogonais** (não são estados — por isso correr e atirar coexistem):
`AimDirection` (8 direções), `Firing`, `Invulnerable`, `Crouching` (pós-MVP).

Sentir bem é o requisito nº 1 do briefing ("responsividade > realismo"). Concretamente:

| Técnica | Valor inicial | Efeito |
|---|---|---|
| Aceleração no solo | ~0.09 s até velocidade máxima | resposta imediata sem parecer gelo |
| Fricção ao soltar | ~0.06 s até parar | para onde o jogador espera |
| Coyote time | 100 ms | pulo perdoa sair da plataforma |
| Jump buffer | 120 ms | pulo perdoa apertar cedo demais |
| Pulo variável | cortar velocidade em 50% ao soltar | altura controlável |
| Gravidade assimétrica | subida 1.0× / queda 1.6× | queda "com peso", arcade |
| Air control | 70% do controle do solo | manobrável no ar |
| I-frames pós-dano | 900 ms com pisca a 12 Hz | leitura clara |
| Knockback | horizontal curto, sem perder controle | não frustra |

Todos esses números vivem em `core/config/tuning.ts` — zero constantes mágicas espalhadas.
A física do movimento é uma função pura `stepMovement(state, input, dt) → intent` e o Actor
apenas aplica `body.setVelocity(intent.vx, intent.vy)`.

**Combate do player:** mira 8-way; segurar tiro dispara automaticamente em armas `autoFire`.
Granadas em arco fixo com preview opcional no debug. Morte: explode em partículas, respawn
no checkpoint após ~1.2 s com invulnerabilidade de entrada.

---

## 10. Enemy Architecture

Um único `EnemyActor` (Phaser) plugado com um `EnemyBrain` (core). Adicionar um inimigo novo =
escrever um brain puro + uma entrada de dados + animações. **Não se toca no Actor.**

```
EnemyActor (Phaser)                    EnemyBrain (core, puro)
  monta BrainContext        ────────►  update(ctx, dt)
  aplica BrainOutput        ◄────────  { moveX, wantJump, wantFire, aim, state }
  (velocidade, anim, tiro)
```

FSM compartilhada em `core/fsm/` com os estados exigidos:
`IDLE → PATROL → ALERT → ATTACK → HURT → DEAD`, com tempos de reação configuráveis
(um telegrafo mínimo de ~250 ms antes de atirar — legibilidade arcade).

MVP:

| Inimigo | HP | Comportamento | Papel |
|---|---|---|---|
| **Soldado** | 20 | patrulha, detecta em cone de 220px, atira em rajadas de 3, recua se colado | densidade, ensina o loop de combate |
| **Soldado Pesado** | 70 | lento, metralhadora com telegrafo longo, resiste a knockback | força reposicionamento |
| **Torreta** | 40 | imóvel, gira, tiro previsível em arco, ponto fraco na base | ensina uso de cobertura e granada |

Percepção (`canSeePlayer`) é calculada na camada `game` (raycast contra tiles) e **injetada**
no contexto — assim o brain continua puro e testável com valores sintéticos.

Todos os inimigos comuns são **pooled** e reciclados via `reset(nowMs)`.

---

## 11. Weapon Architecture

Armas são **dados**, não classes. `WeaponDef` (§6) descreve tudo; `tryFire()` é uma função pura
que devolve `ShotRequest[]`; o `CombatSystem` materializa os projéteis a partir do pool.

Adicionar uma arma nova:
1. entrada em `core/config/weapons.data.ts`;
2. chaves de FX/áudio no manifesto;
3. (opcional) animação de tiro específica.

Nenhuma mudança no `PlayerActor`. Casos que fogem de dados puros (ex.: lança-rojões com
detonação por proximidade) entram como `behavior?: WeaponBehaviorId` resolvido por um pequeno
mapa de estratégias — sem herança profunda.

MVP: **Pistola** (infinita, precisa), **Metralhadora** (auto, munição, spread crescente),
**Escopeta** (5 pellets, alto knockback). `RocketLauncher` e `Rifle` já cabem no schema
(`explosion`, `hitscan`) e entram no pós-MVP.

Explosões: `ExplosionDef { radius, damageAtCenter, damageAtEdge, falloff, knockback, shake, fx }`,
resolvidas por `core/combat/overlap.ts` (query de círculo contra hurtboxes) — testável sem render.

---

## 12. Level Architecture

**Autoria:** Tiled. Um `.tmj` por fase contendo:
- `layer:bg_far`, `bg_near` — parallax (imagens, não tiles)
- `layer:solid` — colisão (tiles 16×16)
- `layer:deco` — decoração sem colisão
- `objects:entities` — spawns de inimigos (com `type`, `patrolLeft/Right`, `facing`)
- `objects:triggers` — `spawn_wave`, `checkpoint`, `boss_gate`, `level_end`, `camera_zone`
- `objects:destructibles` — barris, caixas, geradores

**Carga:** `.tmj` → `parseLevel()` (core, validado, erros explícitos) → `LevelDef` →
`LevelBuilder` (game) instancia tilemap, corpos, pools e triggers.

`LevelDef` é 100% serializável e testável: dá para asserir "a fase 1 tem exatamente 1 checkpoint,
1 boss gate e nenhum inimigo fora dos bounds" num teste unitário — validação também roda no
build (`tools/validate-levels.mjs`), então uma fase quebrada não chega em produção.

**Fase 1 — "Cais de Quarentena"** (~2–3 min):
1. **Desembarque** (0–15 s) — sem inimigos, ensina mover/pular.
2. **Primeiro contato** (15–45 s) — 3 soldados, cobertura, barris explosivos.
3. **Plataformas** (45–80 s) — verticalidade, 1 torreta, pickup de metralhadora.
4. **Checkpoint** (80 s) — visual claro + som + autosave do `RunState`.
5. **Pressão** (80–140 s) — waves mistas, 1 pesado, escopeta como recompensa.
6. **Arena do boss** (140 s+) — portão fecha, **Estivador**.
7. **Extração** — tela de Level Complete.

Fases futuras carregam por code-splitting dinâmico (`import()` do módulo de scripting da fase +
`load` do atlas específico).

---

## 13. Camera Architecture

`CameraDirector` implementa:
- **Follow com deadzone**: caixa central de ~120×80 px lógicos; o player se move dentro dela
  sem mover a câmera → menos enjoo em micro-ajustes.
- **Lookahead**: deslocamento de até 64 px na direção de corrida/mira, com lerp de ~0.12.
  Mostra o perigo antes de ele acertar você — essencial num run & gun.
- **Bounds** vindos do `LevelDef`; travamento em arenas (`camera_zone`) para lutas de boss.
- **Shake por trauma**: acumula `trauma` (0..1), aplica offset ∝ `trauma²` com ruído, decai
  ~1.2/s, e **satura** — 10 explosões simultâneas não somam 10 shakes. Multiplicador global de
  intensidade nas Settings (0–100%, com opção "reduzir" para acessibilidade).
- **Parallax**: camadas com `scrollFactor` (0.15 / 0.35 / 0.6) em `TileSprite`, mais uma camada
  de primeiro plano em 1.15 usada com parcimônia (não pode esconder inimigos).
- Zoom fixo em 1.0 no MVP; a resolução lógica já define o enquadramento.

---

## 14. Mobile Architecture

Mobile é plataforma de primeira classe: mesmo gameplay, apresentação adaptada.

**Controles (DOM, Pointer Events):**
- Metade esquerda: joystick virtual flutuante — nasce onde o dedo toca (não em posição fixa),
  raio 56 px CSS, deadzone 18%, saída analógica. Zona morta inferior respeita a home bar.
- Metade direita: 4 botões (`Jump`, `Shoot`, `Grenade`, `Special`), diâmetro mínimo **56 px CSS**
  (acima do mínimo de 44 px das guidelines de toque), espaçamento ≥ 12 px.
- `Shoot` é segurável; `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`.
- Cada botão captura seu `pointerId` → multitouch confiável; `pointercancel` libera a ação
  (evita "tiro travado" quando uma notificação rouba o toque).
- Feedback: mudança de opacidade/escala em ≤ 60 ms + vibração curta opcional onde suportada.

**Orientação:** o jogo é landscape-first. Em portrait com touch, `OrientationGate` cobre a tela
com uma arte de "gire o dispositivo" e **pausa a simulação**. Tenta `screen.orientation.lock('landscape')`
em fullscreen quando disponível (Android); no iOS não é suportado, então o gate é o mecanismo real.

**Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` em todos os elementos de UI.
HUD e controles nunca entram na área do notch/home bar.

**Performance mobile:** ver §21. Destaques: `powerPreference: 'high-performance'`,
DPR limitado a 2, atlas único por cena, pooling agressivo, e `QualitySystem` degradando
partículas/parallax automaticamente se o FPS médio cair.

**Ciclo de vida:** `visibilitychange` e `blur` → pause automático e mute; retomada exige gesto
(também resolve o unlock de áudio).

---

## 15. Asset Pipeline

**Especificação de arte (fixada antes de produzir qualquer sprite — vai para `docs/ART_SPEC.md`):**

| Parâmetro | Valor |
|---|---|
| Resolução lógica | 640 × 360 (altura fixa; largura 640–800) |
| Grid de tiles | 16 × 16 px |
| Frame do player | 64 × 64 (altura visível ~44 px), colisão 20 × 40 |
| Frame de inimigo comum | 48 × 48 |
| Frame do mini-boss | 192 × 160 (montado em partes) |
| PPU | 1 unidade de mundo = 1 pixel de arte (escala 1:1) |
| Pixel perfect | NEAREST, `roundPixels: true`, sem rotação livre de sprites (rotação só em projéteis) |
| Paleta | 48 cores fixas, documentada em `ART_SPEC.md` |
| Formato | PNG-8 quando possível, empacotado em atlas |

**Fluxo:** Aseprite (`.aseprite` versionado em `art-src/`, fora do bundle) → export
spritesheet + JSON → `tools/pack-atlas.mjs` empacota por domínio → `public/assets/atlas/`.

**Manifesto** (`src/assets/manifest.ts`) — única ponte entre chave lógica e arquivo:

```ts
export const ATLASES = {
  characters: { texture: 'atlas/characters.png', data: 'atlas/characters.json' },
  enemies:    { texture: 'atlas/enemies.png',    data: 'atlas/enemies.json' },
  fx:         { texture: 'atlas/fx.png',         data: 'atlas/fx.json' },
  env:        { texture: 'atlas/env.png',        data: 'atlas/env.json' },
  ui:         { texture: 'atlas/ui.png',         data: 'atlas/ui.json' },
} as const;

export const SPRITES = {
  'player.idle': { atlas: 'characters', prefix: 'dara/idle/', frames: 6 },
  'player.run':  { atlas: 'characters', prefix: 'dara/run/',  frames: 8 },
  // ...
} as const;
```

O gameplay só conhece `'player.run'`. Renomear arquivo não quebra nada. Chave inexistente é
erro de tipo em tempo de compilação (`keyof typeof SPRITES`).

**Versionamento:** Vite gera hash no nome dos assets no build → cache imutável seguro.
Ondas de carga: **boot** (logo + barra) → **core** (player, UI, FX, SFX comuns) →
**level-N** (tileset, inimigos da fase, música).

---

## 16. Animation System

A animação é **derivada** do estado, nunca comandada de forma imperativa espalhada pelo código.

```ts
// core/anim/resolver.ts — puro, testável
resolveAnim({ locomotion:'RUN', grounded:true, firing:true, hurt:false, dead:false, aim:'UP' })
  → { key: 'player.run.aimUp', lock: false }
```

- Um único ponto no `Actor.update()` chama `resolveAnim()` e, se a chave mudou, chama
  `sprite.play(key, true)`.
- `lock: true` (hurt, morte, transição de fase do boss) impede sobrescrita até o `animationcomplete`.
- Combinações "locomoção × direção de mira" resolvidas por composição de chave, não por
  explosão combinatória de sprites: o **torso** superior é um sprite separado do corpo nos
  ângulos de mira (reduz o número de frames a produzir em ~4×).
- Registro das animações centralizado em `game/anim/AnimationRegistry.ts`, alimentado pelo
  manifesto; nenhum `anims.create()` solto em Scene.
- Eventos de frame (ex.: frame 3 de `attack` → hitbox ativa) declarados nos dados da animação,
  não em `setTimeout`.

Coberto no MVP: player (idle, run, jump, fall, land, shoot×5 direções, hurt, death),
inimigos (idle, walk, attack, hurt, death), boss (idle, attack1, attack2, hurt,
phase-transition, death).

---

## 17. FX System

`FxService` centraliza tudo: `fx.play('explosion.large', x, y, opts)`.

- Definições em dados (`fx-defs.ts`): partículas, quantidade, lifespan, escala, blend, som
  associado, trauma de câmera, tempo de hit-stop.
- **Pooling obrigatório** para: projéteis, partículas, explosões, inimigos comuns, números de
  dano, destroços. `PoolRegistry` cria pools tipados com tamanho pré-alocado no load da fase
  (nada de alocação durante combate).
- Emissores de partícula são criados uma vez por tipo e reusados via `emitParticleAt` —
  criar/destruir emissor por explosão é a principal causa de GC spike em Phaser.
- **Hit flash**: tint branco por 60 ms (via filter/tint mode, sem material novo).
- **Hit stop**: congelar a simulação por 40–70 ms em impactos fortes — a técnica que mais
  aumenta a sensação de peso, e é praticamente de graça.
- Catálogo MVP: muzzle flash (por arma), impacto em superfície, impacto em carne/metal, poeira
  de aterrissagem, rastro de corrida, fumaça, explosão P/M/G, faíscas, destroços, hit flash,
  screen shake, flash de tela para a explosão do boss.
- Todo FX passa pelo `QualitySystem`: em `low`, contagens caem ~60% e o parallax de primeiro
  plano some — **sem nenhuma alteração de gameplay**.

---

## 18. Audio System

`AudioService` sobre o Web Audio do Phaser.

- **Barramentos:** `music`, `sfx`, `ambience`, `ui` — cada um com ganho próprio, todos sob um
  ganho `master`. Volumes e mute persistidos no `ProfileState`.
- **Unlock:** o contexto começa suspenso em todos os browsers modernos. O primeiro gesto real
  do usuário (botão "JOGAR") chama `resume()`. Antes disso, nenhuma chamada de áudio é feita —
  o serviço enfileira e descarta. O `OrientationGate` e a tela de título são as superfícies de
  gesto naturais.
- **Formatos:** `.ogg` + `.m4a` (AAC) como fallback; o Phaser escolhe por `canPlayType`.
- **SFX curtos** num audio sprite único (menos requisições, menos decode).
- **Limite de vozes:** máximo de instâncias simultâneas por chave (ex.: 4 para tiro) com
  roubo da mais antiga — evita clipping em combate pesado.
- **Ducking:** música cai ~6 dB por 400 ms em explosões grandes.
- **Mobile:** música em streaming (não decodificada inteira), pausa em `visibilitychange`.

---

## 19. UI/HUD

DOM sobre o canvas, sem framework. Cada widget é uma classe pequena que se inscreve no event bus
e escreve no DOM — nunca faz polling do estado do jogo.

**HUD (in-game):** vida (barra segmentada, canto superior esquerdo), arma atual + munição
(inferior direito no desktop, superior direito no mobile para não colidir com os botões),
granadas, score, barra de boss (superior central, só quando ativo), botão de pause.
Área ocupada ≤ 15% da tela; nada de HUD na faixa central onde o combate acontece.

**Menus (DOM):** Main Menu, Pause, Settings (volumes, intensidade de shake, remapeamento de
teclas, qualidade gráfica auto/alta/média/baixa, idioma), Game Over, Level Complete.
Navegáveis por teclado e gamepad (foco gerenciado, não só mouse/touch).

**Sincronização:** o HUD é `position: fixed` sobre o canvas; como a resolução lógica tem altura
fixa e o canvas é centralizado, o HUD se ancora nas bordas do **elemento canvas** (medido via
`ResizeObserver`), não da janela — assim o letterbox residual nunca separa HUD de jogo.

**Elementos ancorados ao mundo** (números de dano, seta indicando boss fora da tela) ficam na
`WorldUiScene` do Phaser, porque precisam de coordenadas de mundo e do mesmo shake da câmera.

---

## 20. Save System

```ts
interface SaveDataV1 {
  version: 1;
  profile: {
    unlockedLevels: string[];
    currentLevel: string;
    highScore: number;
    stats: { runs: number; deaths: number; kills: number; bestTimeMs: Record<string, number> };
  };
  settings: {
    volumes: { master: number; music: number; sfx: number };
    muted: boolean;
    shakeIntensity: number;
    quality: 'auto' | 'high' | 'medium' | 'low';
    language: 'pt-BR' | 'en';
    bindings: { keyboard: BindingProfile; gamepad: BindingProfile };
  };
}
```

- Apenas dados serializáveis. **Nunca** um objeto Phaser, nunca uma referência a entidade.
- `SaveRepository` é uma interface; a implementação inicial é localStorage com fallback
  in-memory (Safari em modo privado pode lançar em `setItem`) — o jogo nunca quebra por falha
  de save, só perde persistência e avisa uma vez.
- Escritas são **debounced** (~500 ms) e nunca acontecem durante combate.
- `migrate(raw)` roda no load e converte versões antigas; dado corrompido ou irrecuperável →
  reset com backup do original em `redline.save.backup`.
- Troca futura por cloud save = nova implementação da interface + resolução de conflito por
  timestamp. Nada em `core/progression/` muda.

---

## 21. Performance Strategy

**Metas:**

| Dispositivo | Meta | Piso aceitável |
|---|---|---|
| Desktop moderno | 60 fps estável | 60 |
| Android médio (~2022, gama média) | 60 fps | 45 fps sem quedas em combate |
| iPhone SE / tablets antigos | 60 fps | 45 fps |
| Carregamento inicial (4G) | < 5 s até o menu | < 8 s |
| Bundle JS (gzip) | < 700 KB | < 1 MB |
| Memória de textura | < 96 MB | < 128 MB |
| Draw calls típicos | < 25/frame | < 40 |
| Alocação durante combate | ~0 (nenhum GC visível) | sem stutter perceptível |

**Técnicas:**
- **Pooling** de tudo que nasce e morre (projéteis, partículas, inimigos, destroços, textos).
  Pools pré-alocados no load da fase.
- **Atlas por domínio** → batching. Ordem de render agrupada por textura.
- **Zero alocação no loop quente**: sem `new` no `update()`, vetores temporários reusados,
  sem closures por frame, sem `array.map/filter` em caminho quente.
- **Caps de partículas** por nível de qualidade (alta 250 / média 120 / baixa 60 ativas).
- **Culling** de entidades fora da câmera + margem; inimigos distantes rodam brain em 15 Hz
  em vez de 60 Hz (o brain é puro, então mudar a taxa é trivial e seguro).
- **`QualitySystem`**: amostra FPS em janelas de 3 s; duas janelas abaixo de 50 fps → degrada
  um nível (partículas, parallax de foreground, hit flash); duas acima de 58 → volta a subir.
  Nunca altera dano, velocidade ou hitbox.
- **DPR limitado a 2**; `antialias: false`; sem shaders custosos no MVP.
- **Áudio:** limite de vozes, audio sprite, música em streaming.
- **Descarregamento:** atlas de fase liberados na transição (`textures.remove`).
- **Orçamento medido, não estimado:** um cenário de stress (60 inimigos + 200 projéteis +
  3 explosões grandes) roda no CI de performance a cada release e falha se o frame médio
  passar de 16 ms no perfil desktop de referência.

---

## 22. Testing Strategy

**Unit (Vitest) — alvo: ~80% de cobertura em `src/core/`, o único lugar onde cobertura importa.**
- dano, i-frames, resistências, knockback
- cooldown de arma, munição, spread, `tryFire` em todos os estados
- FSM de player (coyote time, jump buffer, transições)
- brains de inimigo com contextos sintéticos ("player à direita e visível → ATTACK em ≤ 250 ms")
- script do boss (transições de fase nos thresholds corretos)
- `resolveAnim` (tabela de estados → chaves)
- parse e validação de `LevelDef`
- save/load, migrations, dados corrompidos
- mapeamento de input e detecção de bordas
- checkpoints e progressão

**Integration (Vitest, ainda sem browser).** Roda a simulação em passos fixos com um input
scriptado e sem render: "150 frames de MOVE_RIGHT + SHOOT matam o soldado e o score sobe 100".
Possível justamente porque `core/` não depende de Phaser.

**Browser / E2E (Playwright + Chromium já instalado).**
- Smoke: o jogo carrega, o menu aparece, "JOGAR" inicia a fase, nenhum erro de console.
- Replay determinístico: `?e2e=1&replay=level01-clear` roda um replay gravado até o fim da fase;
  falha se divergir. É o teste de regressão mais valioso do projeto.
- Mobile: emulação de viewport + `hasTouch`, verifica que os controles aparecem, que o gate de
  portrait aparece e some, e que os touch targets têm ≥ 44 px.
- Orçamento de performance: mede frames longos durante o replay.

**Não testamos:** aparência de pixels, timing exato de partículas, áudio. Custo alto, valor baixo.

**CI:** lint → typecheck → unit → build → E2E. Bloqueia merge.

---

## 23. Debug Strategy

`DebugService` isolado em `game/debug/`. Ativação: `?debug=1` ou tecla `` ` ``. **Removido do
bundle de produção** por dead-code elimination (`import.meta.env.DEV` / flag de build) — o
código de gameplay não contém nenhum `if (debug)`.

Painéis registráveis (cada sistema registra o seu, sem o service conhecer os sistemas):
- FPS, frame time, draw calls, contagem de entidades por pool, ocupação dos pools
- Hitboxes/hurtboxes/corpos Arcade, vetores de velocidade
- Estado do player (FSM, coyote, buffer, i-frames, arma, munição)
- Estado de cada inimigo (FSM, alvo, visão, cooldown) desenhado sobre o sprite
- Deadzone, bounds e trauma da câmera
- Log do event bus (últimos N eventos, filtrável)
- Cheats de desenvolvimento: invencibilidade, munição infinita, pular para checkpoint,
  spawnar inimigo, ir direto ao boss, slow-motion, avanço frame a frame
- Gravar/reproduzir replay de input (alimenta os testes E2E)

---

## 24. Deployment

- **Build:** `vite build` → `dist/` estático, assets com fingerprint, code-splitting por fase.
- **Cache:** `index.html` `no-cache`; `/assets/*` com hash → `max-age=31536000, immutable`.
- **Compressão:** Brotli + gzip pré-gerados no build.
- **Hospedagem:** qualquer host estático (Cloudflare Pages, Netlify, Vercel static, GitHub Pages).
  Sem servidor, sem runtime Node em produção.
- **Headers:** `Cross-Origin-Opener-Policy`/`Embedder-Policy` não são necessários (sem SharedArrayBuffer).
- **PWA (Fase 6):** `vite-plugin-pwa` com manifest (`display: fullscreen`,
  `orientation: landscape`, ícones 192/512/maskable), service worker cacheando o shell + assets
  do core; assets de fase em runtime caching. Estratégia de update: prompt "nova versão
  disponível" fora do gameplay, nunca durante uma partida.
- **Preview por PR** no host escolhido, para testar em dispositivo real cedo e sempre.

---

## 25. Roadmap

Cada fase termina com um critério verificável. Fases dependem estritamente da anterior, exceto
onde indicado.

| Fase | Entrega | Depende de | Critério de saída |
|---|---|---|---|
| **0 — Architecture** | repo, Vite/TS/ESLint/Prettier/Vitest/Playwright, `core/` vazio com regra de lint, event bus, tuning, save, manifesto, scale handler, debug shell, CI | — | `npm run ci` verde; canvas 640×360 escalando corretamente em desktop e celular |
| **1 — Prototype** | player completo (mover, pulo, mira, tiro), câmera, tilemap de teste, input teclado+gamepad, pool de projéteis | 0 | O movimento **sente-se bom** — validação subjetiva com 3+ pessoas antes de seguir |
| **2 — Combat** | dano, i-frames, knockback, 3 inimigos com brains, 3 armas, granadas, explosões, destrutíveis, matriz de colisão | 1 | Combate legível e justo; unit tests de `core/combat` e `core/enemies` passando |
| **3 — Vertical Slice** | Fase 1 completa no Tiled, checkpoint, mini-boss, HUD DOM, menus, áudio, FX, progressão | 2 | Fase jogável do início ao fim, com morte e retorno ao checkpoint funcionando |
| **4 — Mobile** | controles touch, multitouch, gate de orientação, safe areas, perf mobile, `QualitySystem` | 3 (pode começar em paralelo após 2) | 45+ fps em Android de gama média real; jogável só com os dedos |
| **5 — Polish** | arte final, animações, partículas, hit stop, screen shake, mix de áudio, feel pass, tutorial silencioso | 3, 4 | Playtest externo: pessoas terminam a fase sem instruções |
| **6 — Production** | otimização, testes E2E de replay, PWA, deploy, telemetria básica opcional | 5 | Build publicada, CI verde, orçamento de performance respeitado |

Atividade contínua e **paralela desde a Fase 1**: produção de arte e áudio. É o caminho crítico
real do projeto (§27) — placeholders programáticos permitem que a engenharia nunca fique bloqueada.

---

## 26. MVP Definition

O MVP está concluído quando **todos** os itens abaixo são verdadeiros:

**Gameplay**
- [ ] Player: correr, acelerar/desacelerar, pular (variável, coyote, buffer), cair, mirar em
      8 direções, atirar, lançar granada, tomar dano, i-frames, morrer, respawnar
- [ ] 3 armas funcionais (pistola, metralhadora, escopeta) com munição e troca por pickup
- [ ] 3 inimigos (soldado, pesado, torreta) com FSM completa e comportamentos distintos
- [ ] Objetos destrutíveis com explosão em cadeia
- [ ] Mini-boss com 2 fases, 3 padrões de ataque, telegrafos, ponto fraco, barra de vida e
      morte espetacular
- [ ] Fase 1 completa: início → combate → plataformas → checkpoint → pressão → boss → fim
- [ ] Checkpoint funcional: morrer volta ao checkpoint com loadout restaurado
- [ ] Score, vidas e Game Over

**Plataformas**
- [ ] Chrome, Edge, Firefox e Safari desktop
- [ ] Android Chrome e iOS Safari, jogável apenas com touch
- [ ] Gamepad no desktop
- [ ] Gate de portrait; landscape correto em celular e tablet
- [ ] Safe areas respeitadas

**Apresentação**
- [ ] HUD: vida, arma, munição, granadas, score, boss bar, pause
- [ ] Menus: Main, Pause, Settings, Game Over, Level Complete
- [ ] Música da fase + música do boss + no mínimo 15 SFX
- [ ] FX: muzzle, impacto, poeira, fumaça, explosões, faíscas, destroços, hit flash, shake
- [ ] Todos os assets originais

**Qualidade**
- [ ] 60 fps no desktop de referência; ≥ 45 fps no Android de referência
- [ ] Settings persistidos entre sessões
- [ ] Zero erros de console em uma partida completa
- [ ] CI verde (lint, types, unit, build, E2E)
- [ ] Nenhum `any` em `src/`

**Fora do MVP, explicitamente:** veículos, segunda fase, mais armas, multiplayer, ranking
online, contas, cloud save, achievements, seleção de personagem, dificuldades.

---

## 27. Risks

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | **Produção de arte é o caminho crítico.** Um run & gun bonito precisa de centenas de frames originais. Engenharia termina e o jogo fica sem cara. | Alta | Alto | Definir `ART_SPEC.md` **antes** de produzir; kit de placeholder programático desde a Fase 0; escopo de arte da Fase 1 fechado e listado por frame; decidir §2.1(f) já |
| R2 | Phaser 4 é novo (4 meses): menos material, plugins não portados, bugs de renderer | Média | Médio | Usar só API mainstream; isolar tudo em `game/`; `core/` livre de Phaser permite trocar para 3.90 em dias |
| R3 | Performance em Android de gama média com muitas partículas | Média | Alto | Orçamento medido no CI desde a Fase 2; pooling; `QualitySystem`; testar em device real desde a Fase 1, não na 6 |
| R4 | Áudio no iOS (unlock, latência, interrupções por chamada) | Média | Médio | Unlock explícito por gesto; audio sprite; recuperar contexto em `visibilitychange`; testar em iPhone real cedo |
| R5 | "Game feel" insatisfatório — o risco de produto mais grave e o mais fácil de ignorar | Média | **Crítico** | Fase 1 tem gate subjetivo obrigatório; todas as constantes ajustáveis em runtime no debug; playtest externo antes da Fase 5 |
| R6 | Escopo do boss inflar | Média | Médio | 2 fases e 3 padrões travados no MVP; qualquer ideia nova vai para o backlog pós-MVP |
| R7 | Controles touch imprecisos comparados ao teclado | Média | Alto | Joystick flutuante, botões grandes, auto-aim assistido leve no mobile (não no desktop), sessão de tuning dedicada na Fase 4 |
| R8 | Ecossistema TypeScript em transição (TS 6/7) | Baixa | Baixo | Fixar TS 6.0.3; reavaliar no 7.1 (~out/2026), quando `typescript-eslint` deve suportar |
| R9 | Semelhança acidental com obras existentes | Baixa | Alto | Bíblia visual própria (§2.2); revisão de originalidade a cada lote de arte; nenhum asset de referência entra no repo |
| R10 | Vazamento de regras para dentro das Scenes com o tempo | Média | Médio | Regra ESLint bloqueando `phaser` em `core/`; revisão de PR checa se lógica nova nasceu em `core/` |

---

## 28. Future Evolution

A arquitetura já acomoda, sem refatoração estrutural:

- **Mais fases** — `LevelDef` + `.tmj`; carregamento dinâmico por `import()`; scripting da fase
  como módulo isolado. Custo: autoria, não engenharia.
- **Mais armas** — entrada de dados. Zero mudança em `PlayerActor`.
- **Mais inimigos** — novo `EnemyBrain` puro + dados + animações.
- **Bosses maiores** — o `ScriptRunner` já suporta N fases; bosses multi-parte usam vários
  Actors com hurtboxes independentes sob um controlador. O padrão do Estivador é o protótipo disso.
- **Veículos** — componente `VehicleMount`: o player entra num estado `MOUNTED`, o input é
  roteado para o brain do veículo e a mesma FSM continua valendo. Só então avaliar Matter.
- **Ranking online** — `ScoreSubmitter` como interface; **assumir que o cliente é hostil**:
  o servidor valida com o replay de input (que já existe para testes) reproduzido no servidor,
  não com o score enviado.
- **Achievements** — consumidor puro do event bus; nenhum sistema existente muda.
- **Contas e cloud save** — nova implementação de `SaveRepository` + merge por timestamp.
- **i18n** — arquivos por idioma já estruturados; só falta o seletor.
- **Multiplayer** — o caminho realista é **co-op local** primeiro: `InputManager` já suporta
  múltiplos devices, então dois `PlayerActor` com snapshots distintos é uma extensão natural.
  Netcode online exigiria simulação determinística completa (física própria, sem Arcade) —
  seria efetivamente outro projeto, e a arquitetura atual **não** deve tentar antecipá-lo.

---

## FINAL RECOMMENDATION

**Essa arquitetura é adequada para browser?**
Sim. Build 100% estática, sem servidor, WebGL com fallback, um único bundle com code-splitting
por fase, ~700 KB de JS. É a configuração padrão de jogos web comerciais que funcionam bem.

**É adequada para mobile?**
Sim, e mobile foi tratado como restrição de projeto, não como porte. As decisões que importam
foram tomadas em favor do celular: resolução lógica baixa com largura elástica (elimina
letterbox em telas 19.5:9), controles touch em DOM (multitouch e safe areas corretos),
pooling agressivo, degradação automática de qualidade, e teste em device real desde a Fase 1.
O risco residual é performance em aparelhos de entrada — mitigado por medição contínua, não
por otimização especulativa.

**Phaser é realmente a melhor escolha?**
Sim, para este projeto. Alternativas: PixiJS (só render — teríamos que escrever física,
tilemap, animação, input, áudio e áudio espacial: semanas de trabalho sem valor de gameplay);
Excalibur (bom, comunidade bem menor); Godot com export web (excelente engine, mas bundles de
vários MB, WASM pesado e desempenho irregular em Safari mobile — ruim para "abre e joga no
navegador"); Unity WebGL (inadequado para mobile web). Phaser entrega tilemap + Arcade Physics +
animação + áudio + escala + input com TypeScript de primeira classe, que é exatamente o
conjunto que este jogo precisa. **A única ressalva é de versão, não de engine: recomendo
Phaser 4.2.1 em vez de 3.90** (§2.1a).

**Quais são os maiores riscos?**
Em ordem: **(1)** produção de arte original — é o caminho crítico e não é resolvível com
engenharia; **(2)** game feel — um run & gun com movimento ruim é um projeto morto, e não dá
para descobrir isso na Fase 5; **(3)** performance mobile com combate intenso; **(4)** a
juventude do Phaser 4. Os quatro têm mitigação explícita em §27 e nenhum é bloqueante hoje.

**O que deve ser construído primeiro?**
Fase 0 enxuta (repo, build, CI, fronteira `core/`, input, scale, event bus) e imediatamente
**Fase 1: o player**. Antes de qualquer inimigo, arma ou fase, quero uma tela com um retângulo
que corre, pula e atira, e que **sinta-se ótimo** com teclado, gamepad e touch. Esse é o gate
que decide se o projeto vale a pena continuar. Tudo depois é conteúdo.

**O que NÃO devemos construir ainda?**
Backend, ranking, contas, cloud save, achievements, veículos, segunda fase, multiplayer,
seleção de personagem, níveis de dificuldade, ECS, física própria, sistema de diálogo, loja,
telemetria, e PWA antes da Fase 6. Nenhum deles melhora o MVP e todos aumentam a superfície
de manutenção. A arquitetura acima já deixa espaço para cada um — espaço é barato,
implementação prematura não é.

---

*Aguardando aprovação. Nenhum código de gameplay será escrito antes disso.*
