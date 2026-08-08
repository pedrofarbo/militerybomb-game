# REDLINE — Especificação de Arte

Documento normativo. Qualquer arte que entre no projeto — feita por humano, por
IA ou pelo gerador de placeholders — precisa obedecer a tudo aqui.
A lista concreta do que precisa ser produzido está em
[`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md) (gerado automaticamente).
Para produzir com IA, use [`AI_ART_BRIEF.md`](./AI_ART_BRIEF.md).

---

## 1. Métricas fundamentais

| Parâmetro               | Valor                                           | Por quê                                                             |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Resolução lógica        | **640 × 360**                                   | divisor exato de 1280×720 (×2) e 1920×1080 (×3)                     |
| Altura lógica           | **fixa em 360 px**                              | garante que o balanceamento vertical não mude entre aparelhos       |
| Largura lógica          | **elástica, 640–800 px**                        | elimina letterbox em telas 19.5:9 sem redesenhar nada               |
| PPU                     | **1 px de arte = 1 unidade de mundo**           | escala 1:1, sem conversão mental em lugar nenhum                    |
| Grid de tiles           | **16 × 16 px**                                  | granularidade suficiente para plataformas sem inflar o level design |
| Escala de render        | inteira (×2, ×3, ×4) no upscale final do canvas | nitidez; a interpolação acontece uma vez só, no fim                 |
| Filtro de textura       | **NEAREST** (`pixelArt: true`)                  | pixel art borrada é o erro nº 1 em jogos 2D web                     |
| `roundPixels`           | **true**                                        | impede sprites em coordenada fracionária tremerem                   |
| `antialias`             | **false**                                       |                                                                     |
| Rotação livre de sprite | **proibida**, exceto projéteis                  | rotacionar pixel art destrói o grid                                 |

### Consequência prática do enquadramento

Com 360 px de altura e o player a ~44 px, o jogador ocupa ~1/8 da tela. Isso dá
campo de visão suficiente para reagir a projéteis vindos da direita num run & gun,
que é o requisito de legibilidade que manda no enquadramento.

---

## 2. Tamanhos de frame (contrato)

Estes números estão codificados em `src/assets/sprite-manifest.generated.ts`
(`ART_METRICS`) e no gerador. Mudá-los exige mudar código.

| Entidade               | Frame          | Área visível | Colisão lógica          | Linha de apoio                                               |
| ---------------------- | -------------- | ------------ | ----------------------- | ------------------------------------------------------------ |
| Player (corpo)         | **64 × 64**    | ~24 × 44     | 20 × 40 em (22, 18)     | pés em **y = 58**                                            |
| Player (braço de mira) | **32 × 32**    | ~30 × 12     | —                       | pivô = centro (16,16) = ombro, acoplado em (34, 30) do corpo |
| Soldado                | **48 × 48**    | ~22 × 36     | 16 × 32                 | pés na base                                                  |
| Soldado Pesado         | **64 × 64**    | ~46 × 52     | 28 × 44                 | pés na base                                                  |
| Torreta                | **48 × 48**    | ~36 × 34     | 24 × 20 (base)          | base em y = 46                                               |
| Boss — base            | **192 × 160**  | ~172 × 116   | multi-hurtbox           | chão em **y = 156**                                          |
| Boss — garra           | **80 × 80**    | ~60 × 70     | 40 × 50                 | pivô central                                                 |
| Boss — núcleo          | **32 × 32**    | 32 × 32      | 24 × 24                 | pivô central                                                 |
| Tile                   | **16 × 16**    | 16 × 16      | conforme `tileset.json` | —                                                            |
| Props                  | ver inventário | —            | conforme prop           | apoiado no chão                                              |

**Regra de sobra de frame:** o frame é maior que a silhueta de propósito — a sobra
absorve recuo, agachamento de aterrissagem, cano de arma e fumaça sem exigir um
frame de tamanho diferente no meio de uma animação. **Todos os frames de uma mesma
animação têm o mesmo tamanho.** Sem exceção.

### Pivôs (origem do sprite no Phaser)

| Grupo                                          | Origem       | Observação                                                                                 |
| ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Personagens, inimigos, props                   | `(0.5, 1)`   | apoiados no chão; a linha de apoio precisa ser **idêntica em todos os frames** da entidade |
| Boss base                                      | `(0.5, 1)`   | chão em y=156 dentro do frame de 160                                                       |
| Boss garra / núcleo                            | `(0.5, 0.5)` | acoplados por offset, não pelo chão                                                        |
| FX radiais (explosão, impacto, poeira, fumaça) | `(0.5, 0.5)` | centralizados                                                                              |
| Muzzle flash                                   | `(0, 0.5)`   | ancorado na boca do cano, aponta para +X                                                   |
| Projéteis                                      | `(0.5, 0.5)` | apontam para +X; a rotação é aplicada em runtime                                           |
| UI                                             | `(0, 0)`     | posicionada por CSS                                                                        |

---

## 3. Direção de face

**Tudo é desenhado virado para a DIREITA**, exceto o mini-boss, que encara a
**ESQUERDA** (o jogador entra na arena pela esquerda). O espelhamento é feito em
runtime com `flipX` — **não** entregue variantes espelhadas.

Consequência: **nada pode depender de assimetria que fique errada ao espelhar**
(texto, numeração, insígnia que só faz sentido em um lado). Se o personagem tem
um detalhe assimétrico, ele precisa funcionar espelhado.

---

## 4. Paleta — 48 cores, fixas

Restrição dura: **nenhum pixel pode usar uma cor fora desta lista.** Isso garante
coesão visual entre assets produzidos em momentos e por fontes diferentes, e é o
que faz placeholder e arte final conviverem sem parecerem dois jogos.

A paleta é exportada em código (`PALETTE` em `src/assets/sprite-manifest.generated.ts`)
e em `tools/placeholder-gen/palette.mjs`.

| Grupo              | Chaves                     | Hex                                               | Uso                              |
| ------------------ | -------------------------- | ------------------------------------------------- | -------------------------------- |
| Tinta              | `ink` `inkSoft`            | `#0d0b12` `#1c1a26`                               | contornos, sombra dura           |
| Concreto           | `con1`–`con5`              | `#23272e` `#333a44` `#47505d` `#5e6a79` `#7d8a9a` | cenário, chão, estrutura         |
| Metal              | `met1`–`met5`              | `#3a4149` `#545e69` `#717e8c` `#94a2b1` `#c3cedb` | armas, plataformas, maquinário   |
| Ferrugem (jogador) | `rust1`–`rust5`            | `#3d1a12` `#6e2e1c` `#a94c26` `#d97434` `#f2a24e` | **exclusivo da Brigada Redline** |
| Teal industrial    | `teal1`–`teal5`            | `#0e2b30` `#16484f` `#1f6b74` `#2f959c` `#57c2c4` | energia, visores, contêineres    |
| Sinalização        | `sig1`–`sig4`              | `#7a5a10` `#b88a17` `#e8bb28` `#f7dc6a`           | perigo, interativo, HUD          |
| Pele               | `skin1`–`skin4`            | `#6b3f2a` `#96603f` `#c08a5e` `#e0b189`           |                                  |
| Halcyon (inimigo)  | `hal1`–`hal4`              | `#14161f` `#232735` `#343a4d` `#4a5268`           | **exclusivo do Consórcio**       |
| Alerta             | `haz` `hazDark`            | `#d43b2f` `#8a2119`                               | dano, luzes de inimigo, vida     |
| FX quente          | `fx1`–`fx5`                | `#fff3c4` `#ffd447` `#ff9420` `#e04b1c` `#7a2a12` | fogo, muzzle, faísca             |
| Fumaça             | `smoke1`–`smoke4`          | `#2a2a30` `#45464f` `#63656f` `#8a8c96`           | poeira, fumaça, destroços        |
| Extremos + UI      | `white` `black` `uiAccent` | `#f2f5f8` `#05050a` `#e8bb28`                     |                                  |

### Regras de leitura de cor (não negociáveis)

1. **Laranja-ferrugem é do jogador. Azul-petróleo (Halcyon) é do inimigo.** Nunca
   troque. Num tiroteio o jogador precisa distinguir aliado de ameaça pelo brilho
   periférico da cor, sem olhar diretamente.
2. **Vermelho (`haz`) significa "isto vai te machucar"** — projétil inimigo, núcleo
   de torreta, barril armado, sua barra de vida. Não use vermelho decorativo.
3. **Amarelo (`sig3`) significa "isto é interativo ou é aviso"** — checkpoint,
   pickup, faixa de perigo. Não use amarelo decorativo.
4. O cenário fica em `con*` e `met*` **dessaturados**. Personagens e ameaças são
   os únicos elementos saturados da tela. Cenário competindo com inimigo por
   atenção é bug de arte, não questão de gosto.

---

## 5. Estilo

- **Contorno:** contorno de 1 px em `ink` na silhueta externa de personagens,
  inimigos, props e projéteis. Contorno interno apenas onde separa dois volumes
  que se confundiriam.
- **Luz:** direcional, vindo de **cima e ligeiramente da frente**. Um realce de
  1 px no topo de cada volume; sombra na base. Sem múltiplas fontes de luz.
- **Dithering:** permitido apenas em gradientes grandes de cenário e fumaça.
  **Proibido** em personagens e inimigos (vira ruído em 640×360).
- **Rampa de cor:** máximo de **4 tons por material** dentro de um sprite.
- **Anti-aliasing:** **proibido.** Alpha é binário — 0 ou 255 — exceto em FX
  (fumaça, brilho, flashes), onde alpha parcial é permitido e desejável.
- **Silhueta:** cada entidade precisa ser identificável **preenchida de preto**.
  Este é o teste de aceitação nº 1 (§8).
- **Detalhe:** menos do que a vontade pede. A 640×360, detalhe interno vira sujeira.
  Invista em silhueta e contraste, não em textura.

---

## 6. Animação

- **Sem interpolação.** Cada frame é um desenho. Sem tweening, sem motion blur.
- **Poses-chave primeiro.** Um ciclo de corrida de 8 frames é: contato, passagem
  baixa, empurrão, extensão — ×2, alternando pernas.
- **Loops fecham.** O último frame de uma animação em loop tem que emendar no
  primeiro sem tranco.
- **Linha de apoio travada.** Em toda animação com o personagem no chão, a linha
  dos pés fica **exatamente** na mesma altura em todos os frames. Um pixel de
  variação produz tremor visível.
- **Telegrafo.** Toda animação de ataque de inimigo tem uma pose de antecipação
  clara ocupando ao menos 250 ms. Isso é regra de **game design**, não de estética:
  é o que faz o combate ser justo.
- **Impacto lê-se em 2 frames.** Dor e morte precisam ser legíveis mesmo se o
  jogador só vir dois frames.

Frame rates e contagens exatas: [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md).

---

## 7. Formato de entrega

```
art-src/
├── characters/
│   ├── dara.idle.png          # tira horizontal: 384×64 (6 frames de 64×64)
│   ├── dara.run.png           # 512×64
│   ├── dara.arm.fwd.png       # 64×32
│   └── ...
├── enemies/
├── boss/
├── fx/
├── env/
│   ├── tileset.png            # grid de 8 colunas, 16×16
│   └── parallax/*.png         # 640×360, encaixáveis na horizontal
└── ui/
```

**Regras de arquivo:**

1. **PNG-32 com alpha.** Sem JPG, sem WebP, sem camadas achatadas com fundo.
2. **Tira horizontal**, frames da esquerda para a direita, **sem espaçamento e
   sem margem**. Frame _N_ começa exatamente em `x = N × larguraDoFrame`.
3. **Fundo 100% transparente** (alpha 0), não branco, não magenta, não xadrez.
4. **Nome do arquivo = chave de animação** com `.` no lugar de `/`:
   `player.run` → `dara.run.png`. O caminho está no inventário.
5. **Sem escala.** Entregue em 1×. Não entregue arte 4× "para ter qualidade" —
   o downscale destrói o grid de pixels.
6. **Sem metadados de editor** (camadas do Aseprite ficam em `art-src/`, versionadas
   à parte; o que entra no pipeline é o PNG achatado).

O empacotamento em atlas é feito pelo build, não pelo artista. Nunca entregue
um atlas pronto.

---

## 8. Aceitação

Um asset só entra no projeto se passar em **todos** estes testes:

- [ ] **Teste da silhueta.** Preenchido de preto, ainda é identificável e não se
      confunde com nenhuma outra entidade do jogo.
- [ ] **Teste da paleta.** Zero pixels fora das 48 cores. (Verificável por script.)
- [ ] **Teste do tamanho.** Dimensões exatas do inventário; todos os frames iguais.
- [ ] **Teste da linha de apoio.** Pés/base na mesma altura em todos os frames.
- [ ] **Teste do espelho.** Espelhado horizontalmente, continua correto.
- [ ] **Teste do alpha.** Sem franja semitransparente na borda (exceto FX).
- [ ] **Teste do loop.** Animações em loop emendam sem tranco.
- [ ] **Teste de contraste.** Legível sobre o tile `ground_top` **e** sobre
      `bg_near`. Um inimigo que some no fundo é um bug.
- [ ] **Teste de originalidade.** Não é derivado, traçado ou reconhecivelmente
      inspirado em nenhuma obra existente (§9).

---

## 9. Originalidade — restrição inegociável

Este projeto é inspirado no **gênero** run & gun, não em nenhuma obra específica.

**Proibido:**

- copiar, traçar, redesenhar ou "variar" personagens, veículos, inimigos, chefes,
  cenários, HUD, fontes, logos, sons ou músicas de qualquer jogo existente;
- usar assets de terceiros sem licença compatível e registrada;
- usar como referência direta um único jogo a ponto de o resultado ser reconhecível
  como derivado dele;
- alimentar geradores de IA com imagens de jogos comerciais como referência
  (img2img, ControlNet, LoRA treinado em franquia).

**O que fazer no lugar:** partir da bíblia visual do REDLINE (§10) e de referências
do mundo real — portos industriais, equipamento de demolição, uniformes de trabalho
pesado, sinalização de segurança.

Referências reais são bem-vindas e devem ser registradas em `art-src/REFERENCES.md`
com origem e licença.

---

## 10. Bíblia visual — REDLINE

> Um arquipélago tropical industrializado colapsou depois de um acidente numa
> refinaria de terras raras. O **Consórcio Halcyon**, uma empresa militar privada,
> isolou a região para explorar o material sozinho. A **Brigada Redline** — uma
> equipe de demolição, não um exército — entra pela zona de quarentena para
> destruir a operação por dentro.

**Tom:** industrial sujo, quente, funcional. Nada futurista brilhante, nada
militar heroico. Equipamento é pesado, remendado e usado por gente que trabalha.

|          | Brigada Redline (jogador)                | Consórcio Halcyon (inimigo)           |
| -------- | ---------------------------------------- | ------------------------------------- |
| Cor      | laranja-ferrugem `rust*`                 | azul-petróleo `hal*`                  |
| Acento   | amarelo de sinalização `sig3`            | vermelho de alerta `haz`              |
| Silhueta | humana, irregular, equipamento pendurado | uniforme, angular, simétrica          |
| Rosto    | visível (visor teal, rosto humano)       | **nunca** visível — capacete integral |
| Leitura  | improvisado, trabalhador                 | corporativo, produzido em série       |

**Dara Mott** (jogável no MVP): demolicionista, compacta e prática. Capacete de
trabalho com visor teal, macacão laranja-ferrugem, colete de carga, mochila com
detonadores. Nada de capa, ombreira exagerada ou cinto de munição cruzado no peito.

**Estivador** (mini-boss da fase 1): um guindaste portuário blindado às pressas —
chapa soldada por cima de maquinário civil, faixas de perigo descascando, cabine
com visor teal, contrapeso traseiro, garra hidráulica no braço. Precisa parecer
uma **máquina de trabalho convertida em arma**, não um robô de guerra.

**Cais de Quarentena** (fase 1): concreto molhado, contêineres empilhados,
guindastes ao fundo, tubulação, grades, tambores. Céu de fim de tarde tóxico —
teal escuro no alto virando laranja sujo no horizonte.

---

## 11. Placeholders

Os placeholders atuais são gerados por `tools/placeholder-gen` (`npm run art:placeholders`)
e obedecem a **toda** esta especificação: mesmos tamanhos, pivôs, contagens de
frame e paleta. Isso significa que substituir por arte final é trocar arquivos —
sem tocar em código de gameplay.

Ver todos em [`placeholder-preview.html`](./placeholder-preview.html).

**Eles não são arte final** e não devem ser polidos. Se um placeholder está
"quase bom", isso é sinal de que a arte final está sendo adiada.
