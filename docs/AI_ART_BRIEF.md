# REDLINE — Briefing de Arte para Produção com IA

Este documento é o que você entrega a **outra IA** (ou a um artista usando IA) para
produzir a arte definitiva do jogo.

Ele é normativo em cima de duas fontes que **não** devem ser reescritas aqui:

- **O quê produzir, em que tamanho e com quantos frames:** [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md) — gerado automaticamente, sempre atualizado.
- **Regras de estilo, paleta, pivô, aceitação e originalidade:** [`ART_SPEC.md`](./ART_SPEC.md).
- **Referência visual de enquadramento e silhueta:** [`placeholder-preview.html`](./placeholder-preview.html).

---

## 0. Leia isto antes de gerar qualquer imagem

**Modelos de imagem generativos não produzem spritesheets de pixel art utilizáveis.**
Isso não é pessimismo, é a restrição técnica com que este briefing foi desenhado:

| Problema | Por que acontece | Consequência |
|---|---|---|
| "Pixel art" sai como imagem de alta resolução *imitando* pixels | o modelo gera em 1024², não num grid de 64² | pixels de tamanho irregular, grid quebrado |
| Anti-aliasing e franjas | a saída é contínua, não indexada | viola a regra de alpha binário |
| Centenas de cores | não há restrição de paleta na geração | viola a paleta de 48 cores |
| Inconsistência entre frames | cada geração é independente | o personagem "ferve" durante a animação |
| Linha de apoio flutuante | nada ancora os pés | tremor vertical na corrida |

**Conclusão operacional:** a IA entra como **geradora de pose e de identidade
visual**, e um passo de **normalização determinístico** produz o asset final.
Gerar direto para produção não funciona e vai custar mais retrabalho do que
economizou.

---

## 1. Pipeline recomendado

### Rota A — a recomendada: placeholder como esqueleto (img2img / ControlNet)

Os placeholders deste repositório já têm **a pose certa, o tamanho certo, o pivô
certo e a linha de apoio travada**. Use-os como condicionamento estrutural.

```
1. Exporte a tira do placeholder            (docs/placeholder-preview.html / public/assets/atlas/)
2. Para cada frame: img2img com denoise 0.45–0.65, ou ControlNet (scribble/lineart)
   usando o frame do placeholder como controle
3. Normalize (§4) — obrigatório, sem exceção
4. Valide (§5)
5. Remonte a tira e entregue (ART_SPEC §7)
```

Vantagens: consistência entre frames (a estrutura vem do placeholder, não do
modelo), pivô e linha de apoio preservados por construção, e **zero risco de
derivar de obra de terceiros** — a referência é nossa.

### Rota B — identidade primeiro, frames depois

Para definir a cara do jogo antes de animar:

```
1. Gere um "character sheet" em alta resolução: 1 pose neutra, vista lateral,
   fundo liso, sem corte
2. Aprove a identidade visual com o time
3. Reduza para o tamanho-alvo e redesenhe as poses restantes usando o
   placeholder como referência de timing e enquadramento
```

Use esta rota **uma vez por entidade**, para fixar a identidade. As animações
saem da Rota A.

### Rota C — cenário e parallax

Camadas de fundo (`bg_far`, `bg_near`) toleram bem geração direta, porque não
precisam de grid perfeito nem de consistência entre frames. Ainda assim exigem
quantização para a paleta e **encaixe horizontal** (a borda direita precisa emendar
na esquerda).

### O que NÃO fazer

- Pedir "spritesheet de 8 frames de corrida" a um modelo de imagem. Sai lixo.
- Gerar em 1024² e reduzir para 64² sem passo de normalização.
- Usar upscaler "anime/pixel" — reintroduz anti-aliasing.
- Alimentar o modelo com screenshots ou sprites de jogos comerciais (ver §7).

---

## 2. Bloco de estilo — cole em todo prompt

```
STYLE: original 2D pixel art for a side-scrolling run-and-gun game.
Industrial, grimy, warm-tinted. Chunky readable shapes, strong silhouette,
1px dark outline (#0d0b12) on the outer contour. Single light source from
above-front: 1px highlight on top of each volume, shadow at the base.
Maximum 4 tones per material. No dithering on characters. No anti-aliasing,
no gradients, no glow, no bloom, no texture noise. Flat colors only.
Fully transparent background. Side view, orthographic, character facing RIGHT.
Restricted palette (use only these colors):
#0d0b12 #1c1a26 #23272e #333a44 #47505d #5e6a79 #7d8a9a #3a4149 #545e69
#717e8c #94a2b1 #c3cedb #3d1a12 #6e2e1c #a94c26 #d97434 #f2a24e #0e2b30
#16484f #1f6b74 #2f959c #57c2c4 #7a5a10 #b88a17 #e8bb28 #f7dc6a #6b3f2a
#96603f #c08a5e #e0b189 #14161f #232735 #343a4d #4a5268 #d43b2f #8a2119
#fff3c4 #ffd447 #ff9420 #e04b1c #7a2a12 #2a2a30 #45464f #63656f #8a8c96
#f2f5f8 #05050a #e8bb28

WORLD: "REDLINE". A tropical industrial archipelago abandoned after a rare-earth
refinery accident. A private military contractor, the Halcyon Consortium, has
sealed the quarantine zone. The player is a demolition crew, not an army —
gear is heavy, patched and worn by people who work for a living.
No sci-fi chrome. No heroic military fantasy. No anime styling.

FACTION COLOR IS LAW:
  player  = rust orange (#a94c26 / #d97434), yellow safety accent (#e8bb28)
  enemy   = petrol navy (#343a4d / #4a5268), red alert accent (#d43b2f)
  scenery = desaturated concrete and metal only
```

### Negative prompt (base)

```
anti-aliasing, smooth gradients, blur, glow, bloom, lens flare, drop shadow,
3d render, vector art, cel shading, anime, chibi, cute, watercolor, painterly,
photorealistic, text, watermark, signature, UI overlay, checkerboard background,
white background, outline glow, rim light, chromatic aberration, film grain,
high detail texture, hundreds of colors, isometric, perspective, front view,
three-quarter view, existing video game characters, franchise likeness
```

---

## 3. Prompts por asset

Em todos: **anexe o bloco de estilo (§2)** e o **frame do placeholder** correspondente.
As dimensões e contagens de frame vêm de [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md) —
não as invente.

### 3.1 Player — Dara Mott (`characters`, corpo 64×64)

```
SUBJECT: "Dara Mott", demolition specialist of the Redline Brigade.
Compact, practical, wiry build. Reads clearly as a working person, not a soldier.
- Work helmet with a teal visor (#2f959c), chin strap, brigade mark on the side
- Rust-orange coverall (#a94c26 base, #d97434 lit, #6e2e1c shadow)
- Load-bearing vest with pouches, a yellow safety strap across the chest
- Back rig with detonator packs, one small teal indicator light
- Heavy boots, gloves, knee pads
- Visible human face under the visor line, skin #c08a5e
NEVER: cape, shoulder pauldrons, bandolier across the chest, exposed midriff,
long flowing hair, glowing eyes, oversized weapon.
Sprite is 64x64. Visible figure ~24x44 px. FEET MUST SIT EXACTLY AT y=58.
Facing right. Aiming arm is NOT drawn — it is a separate sprite.
```

Frame a frame, some ao prompt a pose:

| Animação | Pose |
|---|---|
| `player.idle` | peso nos dois pés, respiração sutil, arma baixa, ombros descendo 1px |
| `player.run` | ciclo de 8: contato → passagem baixa → empurrão → extensão, ×2 alternando pernas; tronco inclinado 1px à frente |
| `player.jump` | impulso: joelho da frente subindo, tronco erguido, braço traseiro para trás |
| `player.fall` | pernas separadas, joelhos relaxados, tronco levemente para trás |
| `player.land` | agachamento de absorção, joelhos dobrados, cabeça 4px mais baixa |
| `player.hurt` | tronco jogado 3px para trás, cabeça virada, sem cair |
| `player.death` | 6 frames: cambaleia → cai de costas → corpo no chão → dissipa em fumaça |

### 3.2 Braço de mira (`characters`, 32×32, 5 direções × 2 frames)

```
SUBJECT: right arm of Dara holding a compact weapon, seen from the side.
Sprite is 32x32. SHOULDER JOINT IS EXACTLY AT THE CENTER (16,16) — this is a
pivot point, it must not move between the 5 directions.
Arm + weapon extend outward ~15px. Rust-orange sleeve, glove, metal weapon
(#545e69 body, #717e8c highlight).
Directions required: down (90°), down-diagonal (45°), forward (0°),
up-diagonal (-45°), up (-90°).
Frame 0 = at rest. Frame 1 = recoil: whole arm pushed back 2px along its own
axis, muzzle tip flashes to #ffd447.
```

### 3.3 Soldado Halcyon (`enemies`, 48×48)

```
SUBJECT: Halcyon Consortium rifleman. Mass-produced, anonymous, corporate.
- FULL-FACE helmet, no skin visible anywhere — this is the faction rule
- Petrol-navy hardsuit (#343a4d base, #4a5268 lit, #232735 shadow)
- Single red sensor slit on the visor (#d43b2f) — the only saturated element
- Small red core light on the chest plate
- Angular, symmetrical, clean panel lines: manufactured, not improvised
- Compact rifle held forward
Sprite 48x48, figure ~22x36 px, feet at the bottom edge. Facing right.
Silhouette MUST be distinguishable from the Heavy at a glance: this one is
narrow and upright.
```

### 3.4 Soldado Pesado (`enemies`, 64×64)

```
SUBJECT: Halcyon heavy gunner. Same faction language as the rifleman, scaled up
and widened. Bulk reads as WIDE, not tall.
- Broad armored torso with a large red-lit chest core (#d43b2f)
- Head sunk low between the shoulders, full-face, no neck visible
- Short thick legs, heavy stance
- Multi-barrel rotary gun on the right arm, barrels visibly rotating between frames
Sprite 64x64, figure ~46x52 px, feet at the bottom edge. Facing right.
Silhouette test: filled black, must not be confusable with the rifleman.
```

### 3.5 Torreta (`enemies`, 48×48)

```
SUBJECT: fixed Halcyon defense turret bolted to the ground.
- Wide bolted base plate with a yellow hazard stripe — THE BASE IS THE WEAK POINT
  and must read as more fragile / more detailed than the dome
- Armored dome housing with a red optical core (#d43b2f) at its center
- Single barrel that rotates to aim; barrel is the only moving part in idle
Sprite 48x48, base sitting at y=46. No legs, no walking. Facing right.
```

### 3.6 Mini-boss "Estivador" (`boss`, base 192×160 + garra 80×80 + núcleo 32×32)

```
SUBJECT: "Estivador" — a civilian port gantry crane hastily converted into a
weapon by the Halcyon Consortium. It must read as WORK MACHINE TURNED WEAPON,
never as a war robot.
- Tracked chassis with a peeling yellow/black hazard stripe along the top edge
- Central lattice tower, visible cross-bracing
- Operator cabin on the LEFT side with a teal window (#2f959c) and a red status
  light — THIS BOSS FACES LEFT (the player enters from the left)
- Rear counterweight block on the right
- Armor plate welded over the chassis, bolts and weld seams visible, rust streaks
- A shuttered compartment at center-front that OPENS in phase 2 to expose a
  glowing core — this is the weak point
Base sprite 192x160, ground line at y=156. Arm pivot at (62,62).
Core compartment occupies (84,84)-(116,116).
Separate sprites: hydraulic grabber claw 80x80 (center pivot), core 32x32.
```

Fases e frames: ver inventário (`boss.base.idle`, `idle2`, `hurt`, `phase`, `death`,
`boss.claw.*`, `boss.core.*`).

### 3.7 Tileset (`levels/tileset.png`, 16×16)

```
SUBJECT: quarantined industrial port tileset, 16x16 pixel tiles.
Wet concrete, welded steel walkways, shipping containers, pipes, floor grates,
hazard striping, ladders, rails.
Desaturated: concrete (#23272e→#7d8a9a) and metal (#3a4149→#c3cedb) only.
Containers may use teal (#16484f) or rust (#6e2e1c) as accent.
TILES MUST TILE SEAMLESSLY on all edges that meet the same tile type.
Top-facing surfaces get a 1px lighter cap so the player instantly reads
"this is standable". Scenery must stay visually QUIETER than characters.
```

Ordem e nomes dos índices: `public/assets/levels/tileset.json`. **A ordem é contrato.**

### 3.8 Props e pickups (`env`)

```
SUBJECT: destructible props and pickups for an industrial port.
- Crate 32x32: 3 states — intact / cracked / destroyed debris. Rust-orange crate
  with a yellow stenciled panel.
- Explosive barrel 24x32: yellow (#b88a17) with a red hazard symbol; frame 1 is
  the "primed" state, brighter, about to blow.
- Generator 32x48: metal cabinet with a teal-lit panel; broken state is dark and
  smoking.
- Checkpoint 32x64: a signal mast. OFF is grey and dead. ON pulses yellow (#e8bb28)
  — it must be visible from across the screen; this is the player's safety net.
- Pickups 16x16: floating crates with a colored core — teal = machine gun,
  rust = shotgun, yellow = grenade, red = health, grey = ammo.
Pickups need a 2-frame bob (1px vertical) and a soft ground shadow.
```

### 3.9 FX (`fx`)

```
SUBJECT: 2D game effects, radial, centered in frame, transparent background.
Hot palette only: #fff3c4 core, #ffd447, #ff9420, #e04b1c, #7a2a12 outer.
Smoke uses #2a2a30 → #8a8c96.
Partial alpha IS allowed here (and only here).
- Explosions: 3-layer fireball (white-hot core, orange body, dark rim), expanding
  then collapsing into rising smoke; ejected debris chunks
- Muzzle flash: anchored at (0, y-center), pointing +X, a short flame tongue
  with side sparks — this one is NOT centered
- Impacts: 4-frame radial spark burst, colored by surface (metal / concrete / armor)
- Dust: low, wide, short-lived, desaturated
FX must never be so bright that it hides the enemy behind it.
```

### 3.10 Parallax (`env`, 640×360 cada)

```
SUBJECT: background layers of a quarantined tropical industrial port at dusk.
LAYER bg_far  — toxic dusk sky: dark teal (#0e2b30) at the top fading to dirty
  orange near the horizon; a low hazy sun; distant refinery silhouettes.
  Lowest contrast of everything on screen.
LAYER bg_near — gantry cranes and stacked shipping containers in silhouette,
  slightly more contrast, still desaturated.
LAYER fg_near — low foreground: bollards, chains, cable. Dark, near-black.
  MUST NOT be able to hide an enemy — keep it under 30px tall.
All layers 640x360 and SEAMLESSLY TILEABLE horizontally (right edge must join
the left edge). No characters, no focal point, no text.
```

### 3.11 UI (`ui`)

```
SUBJECT: HUD and touch-control assets for a pixel-art action game.
Flat, high-contrast, no skeuomorphism, no glass, no gloss.
- Health segments 14x18: chamfered blocks, red (#d43b2f) full / dark empty /
  yellow critical
- Weapon icons 28x20: pistol, machine gun, shotgun — readable at actual size,
  silhouette-first
- Boss bar: 3 stretchable slices (left cap / middle / right cap) + fill
- Touch buttons 128x128: ring + glyph, one "up" and one "pressed" state each
  (jump / shoot / grenade / special). The pressed state must be obvious in
  peripheral vision — the player is looking at the action, not at the button.
- Virtual stick: 128x128 base ring + 72x72 knob, translucent, never opaque.
```

---

## 4. Normalização — passo obrigatório

Nenhuma saída de IA entra no repositório sem passar por isto, **nesta ordem**:

1. **Recorte** para a área útil e reposicione no frame do tamanho exato do inventário.
2. **Downscale para 1×** com **NEAREST** (nunca bilinear/bicúbico/Lanczos).
3. **Quantize para as 48 cores** da paleta (mapeamento por menor distância em
   espaço perceptual; sem dithering em personagens).
4. **Limiarize o alpha**: `alpha < 128 → 0`, `alpha >= 128 → 255`. Exceção: assets
   de FX, onde alpha parcial é permitido.
5. **Reaplique o contorno** de 1px em `#0d0b12` na silhueta externa, se o passo 3
   tiver comido a borda.
6. **Alinhe a linha de apoio**: em animações de chão, desloque cada frame
   verticalmente para que os pés fiquem exatamente na linha especificada.
7. **Remonte a tira** horizontal, frame 0 à esquerda.

Os passos 2–7 são determinísticos e devem virar um script (`tools/art-import/`)
assim que o primeiro lote de arte final chegar — não faça isso à mão para 214 frames.

---

## 5. Validação automática

O importador precisa **rejeitar** o asset (e não apenas avisar) quando:

| Verificação | Critério |
|---|---|
| Dimensão da tira | exatamente `frameW × nFrames` por `frameH` do inventário |
| Paleta | 0 pixels fora das 48 cores |
| Alpha binário | 0 pixels com `0 < alpha < 255` (exceto atlas `fx`) |
| Linha de apoio | pixel opaco mais baixo na mesma linha em todos os frames (±0 px) |
| Frame vazio | nenhum frame 100% transparente |
| Sangramento | nenhum pixel opaco encostando na borda do frame (exceto tiles e parallax) |
| Encaixe (parallax/tiles) | coluna 0 compatível com a coluna `w-1` |

Falha na validação = asset devolvido, com o motivo. Isso não é burocracia: é o que
impede um sprite 1px fora do lugar de virar um tremor que ninguém consegue
diagnosticar três semanas depois.

---

## 6. Ordem de produção

Produza nesta ordem — ela segue o risco, não o conforto:

1. **Player: `idle`, `run`, `jump`, `fall`** — define a identidade do jogo inteiro
   e é o que trava a validação de game feel.
2. **Tileset + `bg_near`** — sem chão e fundo não dá para julgar contraste de nada.
3. **Braços de mira** — desbloqueia todo o combate.
4. **Soldado completo** — desbloqueia a primeira arena.
5. **FX: muzzle, impacto, explosão pequena** — o combate só "sente" com eles.
6. **Player: `land`, `hurt`, `death`** + props destrutíveis.
7. **Pesado, Torreta**, FX restantes, pickups, checkpoint.
8. **Boss** — o maior volume de arte; só depois que o resto estiver validado.
9. **UI e controles touch.**
10. **`bg_far`, `fg_near`** e polimento.

Um lote pode ser aprovado independentemente dos outros: o jogo roda com placeholder
e arte final misturados, por construção.

---

## 7. Restrições legais e de originalidade (vale para IA também)

- **Proibido** usar imagens de jogos comerciais como referência de img2img,
  ControlNet, ou para treinar LoRA/embedding.
- **Proibido** nomear franquias, personagens, estúdios ou artistas vivos no prompt
  para induzir estilo.
- **Permitido e recomendado:** usar os **placeholders deste repositório** como
  condicionamento — são nossos.
- **Permitido:** referências do mundo real (portos, equipamento de demolição,
  uniformes industriais, sinalização), registradas em `art-src/REFERENCES.md`
  com origem e licença.
- Registre, por lote: **modelo usado, versão, prompt, seed e parâmetros**, em
  `art-src/GENERATION_LOG.md`. Isso é o que permite reproduzir um asset perdido e
  responder a uma pergunta de procedência mais tarde.
- Confirme que os termos de uso do modelo escolhido permitem **uso comercial** do
  material gerado antes de produzir o primeiro lote. Esta verificação é
  responsabilidade de quem contrata a geração, não do modelo.

---

## 8. Checklist de entrega por lote

- [ ] Tiras horizontais PNG-32, dimensões exatas do inventário
- [ ] Nome do arquivo = chave de animação (`player.run` → `dara.run.png`)
- [ ] Passou pela normalização (§4) e pela validação (§5)
- [ ] Passou nos 9 testes de aceitação de [`ART_SPEC.md`](./ART_SPEC.md) §8
- [ ] Testado sobre `ground_top` **e** sobre `bg_near` (contraste)
- [ ] Testado espelhado
- [ ] `GENERATION_LOG.md` e `REFERENCES.md` atualizados
- [ ] Nenhum asset novo fora do inventário (assets extras não entram — o inventário
      é derivado do que o jogo carrega)
