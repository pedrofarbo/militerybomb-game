# REDLINE — Inventário de Assets

> **GERADO AUTOMATICAMENTE** por `tools/placeholder-gen`. Não editar à mão —
> rode `npm run art:placeholders`. Esta é a lista de encomenda da arte final:
> cada linha existe hoje como placeholder e precisa ser substituída por arte
> definitiva com **exatamente** as mesmas dimensões e contagens de frame.

- **57 animações** · **216 frames de animação** · **14 sprites estáticos** · **24 tiles**
- Resolução lógica do jogo: **640×360** (altura fixa, largura elástica 640–800)
- Grid de tiles: **16×16**
- Paleta: **48 cores** fixas (ver `docs/ART_SPEC.md`)

**Como ler a coluna "Tira":** a entrega da arte final é uma tira horizontal
única por animação, frames da esquerda para a direita, sem espaçamento, fundo
transparente. `Tira` é a dimensão exata do PNG esperado.


## Atlas `characters`

Pivô: origem (0.5, 1) — pés na linha y=58 do frame. Placeholder atual: 512×512, 40 frames, 5.4 KB.

| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |
|---|---|---:|---|---|---:|---|---|
| `player.idle` | `dara/idle/N` | 6 | 64×64 | **384×64** | 8 | loop | — |
| `player.run` | `dara/run/N` | 8 | 64×64 | **512×64** | 14 | loop | — |
| `player.crouch` | `dara/crouch/N` | 2 | 64×64 | **128×64** | 6 | loop | — |
| `player.jump` | `dara/jump/N` | 2 | 64×64 | **128×64** | 10 | uma vez | — |
| `player.fall` | `dara/fall/N` | 2 | 64×64 | **128×64** | 8 | loop | — |
| `player.land` | `dara/land/N` | 2 | 64×64 | **128×64** | 16 | uma vez | — |
| `player.hurt` | `dara/hurt/N` | 2 | 64×64 | **128×64** | 10 | uma vez | sim |
| `player.death` | `dara/death/N` | 6 | 64×64 | **384×64** | 9 | uma vez | sim |
| `player.arm.fwd` | `dara/arm/fwd/N` | 2 | 32×32 | **64×32** | 18 | uma vez | — |
| `player.arm.up45` | `dara/arm/up45/N` | 2 | 32×32 | **64×32** | 18 | uma vez | — |
| `player.arm.up` | `dara/arm/up/N` | 2 | 32×32 | **64×32** | 18 | uma vez | — |
| `player.arm.down45` | `dara/arm/down45/N` | 2 | 32×32 | **64×32** | 18 | uma vez | — |
| `player.arm.down` | `dara/arm/down/N` | 2 | 32×32 | **64×32** | 18 | uma vez | — |

## Atlas `enemies`

Pivô: origem (0.5, 1) — pés na base do frame. Placeholder atual: 512×512, 56 frames, 6.5 KB.

| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |
|---|---|---:|---|---|---:|---|---|
| `soldier.idle` | `soldier/idle/N` | 4 | 48×48 | **192×48** | 6 | loop | — |
| `soldier.walk` | `soldier/walk/N` | 6 | 48×48 | **288×48** | 10 | loop | — |
| `soldier.attack` | `soldier/attack/N` | 4 | 48×48 | **192×48** | 12 | uma vez | — |
| `soldier.hurt` | `soldier/hurt/N` | 2 | 48×48 | **96×48** | 12 | uma vez | sim |
| `soldier.death` | `soldier/death/N` | 5 | 48×48 | **240×48** | 10 | uma vez | sim |
| `heavy.idle` | `heavy/idle/N` | 4 | 64×64 | **256×64** | 5 | loop | — |
| `heavy.walk` | `heavy/walk/N` | 6 | 64×64 | **384×64** | 7 | loop | — |
| `heavy.attack` | `heavy/attack/N` | 5 | 64×64 | **320×64** | 14 | loop | — |
| `heavy.hurt` | `heavy/hurt/N` | 2 | 64×64 | **128×64** | 12 | uma vez | sim |
| `heavy.death` | `heavy/death/N` | 6 | 64×64 | **384×64** | 9 | uma vez | sim |
| `turret.idle` | `turret/idle/N` | 2 | 48×48 | **96×48** | 2 | loop | — |
| `turret.attack` | `turret/attack/N` | 4 | 48×48 | **192×48** | 14 | uma vez | — |
| `turret.hurt` | `turret/hurt/N` | 2 | 48×48 | **96×48** | 12 | uma vez | sim |
| `turret.death` | `turret/death/N` | 4 | 48×48 | **192×48** | 8 | uma vez | sim |

## Atlas `boss`

Pivô: origem (0.5, 1) — base em y=156 (base) / pivô central (claw, core). Placeholder atual: 1024×1024, 36 frames, 28.8 KB.

| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |
|---|---|---:|---|---|---:|---|---|
| `boss.base.idle` | `estivador/base/idle/N` | 4 | 192×160 | **768×160** | 4 | loop | — |
| `boss.base.idle2` | `estivador/base/idle2/N` | 4 | 192×160 | **768×160** | 6 | loop | — |
| `boss.base.hurt` | `estivador/base/hurt/N` | 2 | 192×160 | **384×160** | 12 | uma vez | sim |
| `boss.base.phase` | `estivador/base/phase/N` | 3 | 192×160 | **576×160** | 3 | uma vez | sim |
| `boss.base.death` | `estivador/base/death/N` | 8 | 192×160 | **1536×160** | 6 | uma vez | sim |
| `boss.claw.idle` | `estivador/claw/idle/N` | 2 | 80×80 | **160×80** | 3 | loop | — |
| `boss.claw.swing` | `estivador/claw/swing/N` | 5 | 80×80 | **400×80** | 12 | uma vez | — |
| `boss.core.idle` | `estivador/core/idle/N` | 4 | 32×32 | **128×32** | 4 | loop | — |
| `boss.core.exposed` | `estivador/core/exposed/N` | 4 | 32×32 | **128×32** | 10 | loop | — |

## Atlas `fx`

Pivô: origem (0.5, 0.5), exceto `muzzle/*` que usa (0, 0.5) na boca do cano. Placeholder atual: 1024×512, 84 frames, 17.7 KB.

| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |
|---|---|---:|---|---|---:|---|---|
| `fx.muzzle.small` | `muzzle/small/N` | 3 | 24×24 | **72×24** | 30 | uma vez | — |
| `fx.muzzle.medium` | `muzzle/medium/N` | 3 | 32×32 | **96×32** | 30 | uma vez | — |
| `fx.muzzle.large` | `muzzle/large/N` | 3 | 48×48 | **144×48** | 26 | uma vez | — |
| `fx.impact.metal` | `impact/metal/N` | 4 | 24×24 | **96×24** | 26 | uma vez | — |
| `fx.impact.concrete` | `impact/concrete/N` | 4 | 24×24 | **96×24** | 26 | uma vez | — |
| `fx.impact.armor` | `impact/armor/N` | 4 | 24×24 | **96×24** | 26 | uma vez | — |
| `fx.dust.land` | `dust/land/N` | 5 | 32×32 | **160×32** | 18 | uma vez | — |
| `fx.dust.run` | `dust/run/N` | 4 | 16×16 | **64×16** | 16 | uma vez | — |
| `fx.smoke.puff` | `smoke/puff/N` | 6 | 32×32 | **192×32** | 12 | uma vez | — |
| `fx.explosion.small` | `explosion/small/N` | 7 | 48×48 | **336×48** | 20 | uma vez | — |
| `fx.explosion.medium` | `explosion/medium/N` | 8 | 80×80 | **640×80** | 18 | uma vez | — |
| `fx.explosion.large` | `explosion/large/N` | 9 | 128×128 | **1152×128** | 16 | uma vez | — |
| `fx.marker.checkpoint` | `marker/checkpoint/N` | 4 | 24×24 | **96×24** | 12 | uma vez | — |
| `projectile.grenade` | `grenade/N` | 4 | 14×14 | **56×14** | 16 | loop | — |
| `projectile.rocket` | `rocket/N` | 2 | 20×10 | **40×10** | 20 | loop | — |

## Atlas `env`

Pivô: origem (0.5, 1) — apoiado no chão. Placeholder atual: 256×256, 24 frames, 2.1 KB.

| Chave de animação | Prefixo dos frames | Frames | Frame | Tira | FPS | Repetição | Bloqueia |
|---|---|---:|---|---|---:|---|---|
| `prop.checkpoint.on` | `prop/checkpoint/on/N` | 4 | 32×64 | **128×64** | 8 | loop | — |
| `pickup.weapon_mg` | `pickup/weapon_mg/N` | 2 | 16×16 | **32×16** | 4 | loop | — |
| `pickup.weapon_sg` | `pickup/weapon_sg/N` | 2 | 16×16 | **32×16** | 4 | loop | — |
| `pickup.grenade` | `pickup/grenade/N` | 2 | 16×16 | **32×16** | 4 | loop | — |
| `pickup.health` | `pickup/health/N` | 2 | 16×16 | **32×16** | 4 | loop | — |
| `pickup.ammo` | `pickup/ammo/N` | 2 | 16×16 | **32×16** | 4 | loop | — |

## Sprites estáticos (frame único)

| Chave | Atlas | Frame | Tamanho |
|---|---|---|---|
| `projectile.bullet` | fx | `bullet/player/0` | 12×6 |
| `projectile.pellet` | fx | `bullet/pellet/0` | 8×4 |
| `projectile.enemyBullet` | fx | `bullet/enemy/0` | 10×6 |
| `projectile.heavyBullet` | fx | `bullet/heavy/0` | 14×6 |
| `prop.crate.intact` | env | `prop/crate/0` | 32×32 |
| `prop.crate.damaged` | env | `prop/crate/1` | 32×32 |
| `prop.crate.broken` | env | `prop/crate/2` | 32×32 |
| `prop.barrel.intact` | env | `prop/barrel/0` | 24×32 |
| `prop.barrel.primed` | env | `prop/barrel/1` | 24×32 |
| `prop.generator.intact` | env | `prop/generator/0` | 32×48 |
| `prop.generator.broken` | env | `prop/generator/1` | 32×48 |
| `prop.checkpoint.off` | env | `prop/checkpoint/off/0` | 32×64 |
| `prop.gate.open` | env | `prop/gate/0` | 64×96 |
| `prop.gate.closed` | env | `prop/gate/1` | 64×96 |

## Tileset `levels/tileset.png`

24 tiles de 16×16, grid de 8 colunas. **A ordem dos índices é contrato** — as fases do Tiled referenciam o índice, não o nome.

| Índice | Nome | Colisão |
|---:|---|---|
| 0 | `empty` | não |
| 1 | `ground_top_l` | sim |
| 2 | `ground_top` | sim |
| 3 | `ground_top_r` | sim |
| 4 | `ground_mid` | sim |
| 5 | `ground_deep` | sim |
| 6 | `ground_l` | sim |
| 7 | `ground_r` | sim |
| 8 | `platform_l` | sim |
| 9 | `platform_m` | sim |
| 10 | `platform_r` | sim |
| 11 | `crate_wall` | sim |
| 12 | `pipe_h` | sim |
| 13 | `pipe_v` | sim |
| 14 | `grate` | sim |
| 15 | `hazard_stripe` | não |
| 16 | `container_tl` | sim |
| 17 | `container_t` | sim |
| 18 | `container_tr` | sim |
| 19 | `container_l` | sim |
| 20 | `container_m` | sim |
| 21 | `container_r` | sim |
| 22 | `ladder` | não |
| 23 | `rail` | não |

## Camadas de parallax

| Arquivo | Tamanho | scrollFactor sugerido | Observação |
|---|---|---|---|
| `env/bg_far.png` | 640×360 | 0.15 | céu + horizonte, encaixável na horizontal |
| `env/bg_near.png` | 640×360 | 0.35 | guindastes e contêineres, encaixável |
| `env/fg_near.png` | 640×360 | 1.15 | primeiro plano baixo; **nunca** pode esconder inimigo |
