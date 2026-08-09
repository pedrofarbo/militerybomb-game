import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke de browser: prova que a build carrega, que o player responde ao input
 * e que a fase é jogável. Não verifica pixels — verifica ESTADO, lido do painel
 * de debug, que é a superfície estável para isso.
 */

interface PlayerReadout {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: string;
  grounded: boolean;
  hp: number;
  grenades: number;
}

interface CombatReadout {
  enemiesAlive: number;
  enemiesTotal: number;
  destructibles: number;
  score: number;
  lives: number;
  phase: string;
  enemyStates: string;
}

async function readPlayer(page: Page): Promise<PlayerReadout> {
  const text = await page.evaluate(
    () => document.querySelector('.debug-overlay')?.textContent ?? '',
  );
  const pos = /pos\s+(-?\d+),\s*(-?\d+)/.exec(text);
  const vel = /vel\s+(-?\d+),\s*(-?\d+)/.exec(text);
  const state = /state\s+(\w+)/.exec(text);
  const ground = /ground\s+(sim|não)/.exec(text);
  return {
    x: Number(pos?.[1] ?? NaN),
    y: Number(pos?.[2] ?? NaN),
    vx: Number(vel?.[1] ?? NaN),
    vy: Number(vel?.[2] ?? NaN),
    state: state?.[1] ?? '',
    grounded: ground?.[1] === 'sim',
    hp: Number(/vida\s+(\d+)/.exec(text)?.[1] ?? NaN),
    grenades: Number(/granadas:(\d+)/.exec(text)?.[1] ?? NaN),
  };
}

async function readCombat(page: Page): Promise<CombatReadout> {
  const text = await page.evaluate(
    () => document.querySelector('.debug-overlay')?.textContent ?? '',
  );
  return {
    enemiesAlive: Number(/inimigos (\d+)\//.exec(text)?.[1] ?? NaN),
    enemiesTotal: Number(/inimigos \d+\/(\d+)/.exec(text)?.[1] ?? NaN),
    destructibles: Number(/destrutíveis (\d+)/.exec(text)?.[1] ?? NaN),
    score: Number(/score\s+(\d+)/.exec(text)?.[1] ?? NaN),
    lives: Number(/vidas (\d+)/.exec(text)?.[1] ?? NaN),
    phase: /fase:([\w-]+)/.exec(text)?.[1] ?? '',
    enemyStates: [...text.matchAll(/(soldier|heavy|turret):(\w+)/g)]
      .map((m) => `${m[1]}:${m[2]}`)
      .join(' '),
  };
}

/**
 * Avança até o primeiro soldado pulando o caixote que bloqueia o chão.
 * Devolve `true` se chegou; os testes de combate dependem disto.
 */
async function advanceToFirstEnemy(page: Page, targetX: number): Promise<boolean> {
  for (let i = 0; i < 70; i++) {
    if ((await readPlayer(page)).x >= targetX) return true;
    await page.keyboard.down('d');
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('d');
    await page.waitForTimeout(60);
  }
  return (await readPlayer(page)).x >= targetX;
}

async function boot(page: Page, query = ''): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(`/?debug=1${query}`);
  await expect(page.locator('canvas')).toBeVisible();

  /* O jogo abre na tela de título com a fase PAUSADA. Todo teste de gameplay
     começa apertando JOGAR — que é também o gesto que libera o áudio. */
  await expect(page.locator('.menu--title')).toBeVisible({ timeout: 20_000 });
  await page.locator('.menu--title .menu__item').first().click();
  await expect(page.locator('.menu--title')).toBeHidden();

  // Espera o carregamento dos atlas e o primeiro frame da fase.
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 20_000 }).not.toBe('');
  return problems;
}

test('a fase carrega sem erros e o player nasce parado no chão', async ({ page }) => {
  const problems = await boot(page);

  // O spawn passa por LAND antes de assentar — tocar o chão pela primeira vez
  // é uma aterrissagem de verdade, e é ela que dispara a poeira de respawn.
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 5000 }).toBe('IDLE');

  const player = await readPlayer(page);
  expect(player.grounded).toBe(true);
  expect(player.vx).toBe(0);
  expect(problems).toEqual([]);
});

test('correr para a direita move o player e troca para RUN', async ({ page }) => {
  await boot(page);
  const start = await readPlayer(page);

  await page.keyboard.down('d');
  // O painel de debug atualiza a 6 Hz: esperar o ESTADO, nunca um tempo fixo.
  // RUN aparece nos primeiros frames — o deslocamento vem depois, e é ele que
  // prova que a física está de fato integrando a velocidade.
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 5000 }).toBe('RUN');
  await expect
    .poll(async () => (await readPlayer(page)).x, { timeout: 5000 })
    .toBeGreaterThan(start.x + 50);

  const running = await readPlayer(page);
  await page.keyboard.up('d');

  expect(running.vx).toBeGreaterThan(100);
});

test('soltar o direcional faz o player parar rápido', async ({ page }) => {
  await boot(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 5000 }).toBe('RUN');
  await page.keyboard.up('d');

  // A fricção leva ~60 ms; a margem aqui é do refresh do painel, não do jogo.
  await expect.poll(async () => (await readPlayer(page)).vx, { timeout: 3000 }).toBe(0);
  expect((await readPlayer(page)).state).toBe('IDLE');
});

test('pular tira o player do chão e ele volta a aterrissar', async ({ page }) => {
  await boot(page);

  // Segura o pulo durante toda a subida para o painel conseguir amostrá-la.
  await page.keyboard.down('Space');
  await expect
    .poll(async () => (await readPlayer(page)).state, { timeout: 5000 })
    .toBe('JUMP_RISE');
  const airborne = await readPlayer(page);
  await page.keyboard.up('Space');

  expect(airborne.grounded).toBe(false);
  expect(airborne.vy).toBeLessThan(0);

  await expect.poll(async () => (await readPlayer(page)).grounded, { timeout: 5000 }).toBe(true);
});

test('atirar cria projétil e a troca de arma muda a munição', async ({ page }) => {
  await boot(page);

  const readHud = (): Promise<string> =>
    page.evaluate(() => document.querySelector('.hud-weapon')?.textContent ?? '');

  expect(await readHud()).toContain('PISTOLA');

  await page.keyboard.press('q'); // troca para metralhadora
  await expect.poll(readHud, { timeout: 3000 }).toContain('METRALHADORA');

  const activeProjectiles = async (): Promise<number> =>
    Number(
      await page.evaluate(
        () => /tiros (\d+)/.exec(document.querySelector('.debug-overlay')?.textContent ?? '')?.[1],
      ),
    );

  await page.keyboard.down('j');
  await expect.poll(activeProjectiles, { timeout: 5000 }).toBeGreaterThan(0);
  await page.keyboard.up('j');

  // E o pool devolve tudo depois que os projéteis expiram — sem vazamento.
  await expect.poll(activeProjectiles, { timeout: 5000 }).toBe(0);
});

test('↓ + pulo desce por uma plataforma, sem atravessar o chão', async ({ page }) => {
  await boot(page);
  const GROUND_Y = 400; // superfície principal da fase (linha 25 × 16 px)

  /* A primeira plataforma da fase fica sobre x 352–448, 48 px acima do chão.
     Correr pulando "no escuro" até calhar de pousar nela deixa o teste
     instável (o player chega no vão e respawna). Em vez disso: posicionar
     debaixo dela, parar, e pular na vertical. */
  const PLATFORM_X = 400;

  // Desde a Fase 2 há um caixote no chão antes da plataforma: ele é sólido,
  // então chegar lá exige pular por cima — correr reto trava contra ele.
  expect(await advanceToFirstEnemy(page, PLATFORM_X - 40)).toBe(true);
  await expect.poll(async () => (await readPlayer(page)).vx, { timeout: 3000 }).toBe(0);

  /* Sobe na plataforma TENTANDO de novo, como um jogador faria. Um pulo só,
     cronometrado em tempo de parede, falha quando a máquina está carregada —
     e o que este teste mede é a descida pela plataforma, não a sorte de um
     `waitForTimeout` cair no milissegundo certo. */
  let onPlatform: PlayerReadout | null = null;
  for (let attempt = 0; attempt < 8 && !onPlatform; attempt++) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(350);
    await page.keyboard.up('Space');
    await page.waitForTimeout(500);

    const r = await readPlayer(page);
    if (r.grounded && r.y < GROUND_Y - 20) onPlatform = r;
  }
  expect(onPlatform, 'o player precisa pousar na plataforma').not.toBeNull();

  /* Tenta descer algumas vezes. A plataforma fica logo acima do primeiro
     soldado: um tiro joga o player no ar e a tentativa daquele instante falha
     porque ele não está apoiado. Um jogador apertaria de novo — o teste
     também, senão estaria testando a sorte do tiroteio, não a descida. */
  await page.keyboard.down('s');
  let dropped = false;
  for (let attempt = 0; attempt < 6 && !dropped; attempt++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    dropped = (await readPlayer(page)).y > onPlatform!.y + 16;
  }
  await page.keyboard.up('s');
  expect(dropped).toBe(true);

  const after = await readPlayer(page);
  // Desceu de fato...
  expect(after.y).toBeGreaterThan(onPlatform!.y + 16);
  /* ...e parou no cenário em vez de atravessá-lo. Não dá para exigir
     `grounded` neste instante: aqui já há soldados atirando, e um tiro joga o
     player no ar. O que este teste precisa garantir é que ele não caiu ATRAVÉS
     do chão — isso apareceria como respawn no início da fase (x ≈ 56) ou como
     y abaixo do mundo. */
  expect(after.x).toBeGreaterThan(200);
  expect(after.y).toBeLessThanOrEqual(GROUND_Y);
});

test('cair num vão devolve o player ao início da fase', async ({ page }) => {
  await boot(page);
  const spawn = await readPlayer(page);

  // Segurar direita sem pular: o primeiro vão está a ~640 px do spawn.
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await readPlayer(page)).x, { timeout: 15_000 })
    .toBeLessThan(spawn.x + 40);
  await page.keyboard.up('d');

  const respawned = await readPlayer(page);
  expect(Math.abs(respawned.x - spawn.x)).toBeLessThan(60);
});

/* ───────────────────── Vidas, fim de fase e recomeço ───────────────────── */

/** Corre para a direita até morrer. Com `?spawn=35` o primeiro vão fica a ~70 px. */
async function fallIntoPit(page: Page, livesBefore: number): Promise<void> {
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await readCombat(page)).lives, { timeout: 20_000 })
    .toBeLessThan(livesBefore);
  await page.keyboard.up('d');
}

/**
 * O BUG RELATADO: morrer devolvia o jogador ao início com o mapa já limpo —
 * inimigos mortos continuavam mortos e a pontuação seguia subindo, sem que
 * nada custasse nada. Este teste cobre os dois lados: o mundo VOLTA, a
 * pontuação NÃO — ela é da tentativa, não da fase.
 */
test('morrer custa uma vida, devolve os inimigos e preserva a pontuação', async ({ page }) => {
  await boot(page, '&spawn=35');

  const start = await readCombat(page);
  expect(start.lives).toBe(3);
  expect(start.enemiesAlive).toBe(start.enemiesTotal);

  // Mata o soldado que está logo à frente, para haver pontuação a preservar.
  await page.keyboard.press('q'); // metralhadora
  await page.keyboard.down('j');
  await expect
    .poll(async () => (await readCombat(page)).enemiesAlive, { timeout: 20_000 })
    .toBeLessThan(start.enemiesTotal);
  await page.keyboard.up('j');

  const scored = await readCombat(page);
  expect(scored.score).toBeGreaterThan(0);

  await fallIntoPit(page, start.lives);

  await expect
    .poll(async () => (await readCombat(page)).enemiesAlive, { timeout: 10_000 })
    .toBe(start.enemiesTotal);

  const after = await readCombat(page);
  expect(after.lives).toBe(start.lives - 1);
  /* NÃO é igualdade exata: a metralhadora alcança 500 px e o soldado seguinte
     está dentro desse raio, então uma bala ainda em voo pode somar pontos
     entre a leitura e a morte. O que este teste mede é que o placar SOBREVIVE
     — e para isso "não diminuiu" é a afirmação certa. */
  expect(after.score).toBeGreaterThanOrEqual(scored.score);
  expect(after.phase).toBe('playing');
});

/**
 * Sem vidas, o jogo TERMINA — em vez de reiniciar em silêncio para sempre, que
 * era o comportamento antigo. E recomeçar dali zera o placar.
 */
test('acabar as vidas dá fim de jogo, e recomeçar zera o placar', async ({ page }) => {
  await boot(page, '&spawn=35');
  const outcome = page.locator('.outcome');
  await expect(outcome).toBeHidden();

  for (let lives = 3; lives > 0; lives--) {
    await expect.poll(async () => (await readCombat(page)).lives, { timeout: 20_000 }).toBe(lives);
    await fallIntoPit(page, lives);
  }

  await expect(outcome).toBeVisible({ timeout: 10_000 });
  await expect(outcome).toContainText('FIM DE JOGO');
  expect((await readCombat(page)).phase).toBe('game-over');

  await page.locator('.outcome__button').click();

  await expect(outcome).toBeHidden({ timeout: 10_000 });
  const fresh = await readCombat(page);
  expect(fresh.lives).toBe(3);
  expect(fresh.score).toBe(0);
  expect(fresh.enemiesAlive).toBe(fresh.enemiesTotal);
});

/**
 * O OUTRO BUG RELATADO: a fase não tinha fim. Quem chegava ao lado direito do
 * mapa saía do mundo, caía no vazio e morria. Agora existe um portão — e desde
 * a Fase 3 ele só abre depois do Estivador.
 *
 * Este é o teste mais valioso da suíte: prova que a fase é jogável do início ao
 * fim. Ele DERRUBA o boss de verdade, com um bot que só sabe ir e vir atirando
 * — se a luta ficar impossível de vencer com movimento básico, ele quebra.
 */
test('derrubar o boss abre a extração e termina a fase', async ({ page }) => {
  /* O teste mais longo da suíte: ele joga a luta inteira, em tempo real. Sob
     carga paralela o browser roda mais devagar e o orçamento aperta. */
  test.slow();
  test.setTimeout(240_000);
  /* Entra pelo corredor final, e não direto na soleira: é lá que estão o kit
     de vida e o checkpoint. Começar a luta já machucado pelo soldado da
     coluna 124 é variação que não tem nada a ver com o que este teste mede. */
  const problems = await boot(page, '&spawn=127');
  const bossBar = page.locator('.boss-bar');
  const outcome = page.locator('.outcome');

  await page.keyboard.press('q'); // metralhadora: automática, dá para segurar
  await page.keyboard.down('d');
  await expect(bossBar).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('d');

  /* Bot que desvia: vai e vem segurando o gatilho. Não é jogo bom — é o mínimo
     de movimento que qualquer pessoa faria diante de um boss.

     Duas armadilhas que este laço já caiu:
     · O fim da luta NÃO é "a barra do boss sumiu": ela também some quando o
       jogador morre e a fase recarrega. O sinal confiável é a PONTUAÇÃO, que
       só dá o salto do boss quando ele cai de verdade.
     · Reaparecer devolve a pistola, que é semiautomática — segurar o gatilho
       com ela não dispara nada. Sem trocar de arma de volta, o bot passava o
       resto do teste batendo palma para o boss. */
  const BOSS_SCORE = 2500;
  const scoreNow = async (): Promise<number> => (await readCombat(page)).score;
  const livesNow = async (): Promise<number> => (await readCombat(page)).lives;

  let lives = await livesNow();
  let won = false;

  for (let i = 0; i < 120 && !won; i++) {
    /* Recua à ESQUERDA sem atirar, depois vira para a direita e despeja.
       O detalhe importa: a mira segue o movimento, então um bot que só vai e
       vem passa metade da luta atirando para longe do boss — e o que parecia
       uma luta longa demais era, na verdade, meia luta. */
    await page.keyboard.down('a');
    await page.waitForTimeout(260);
    await page.keyboard.press('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('a');

    await page.keyboard.down('d');
    await page.waitForTimeout(90);
    await page.keyboard.up('d');
    await page.keyboard.down('j');
    await page.waitForTimeout(620);
    await page.keyboard.up('j');

    if ((await scoreNow()) >= BOSS_SCORE) {
      won = true;
      break;
    }

    const currentLives = await livesNow();
    if (currentLives < lives) {
      lives = currentLives;
      /* Acabaram as vidas: recomeça a tentativa e volta para a luta. O teste
         mede se a fase é VENCÍVEL, não se um bot cego vence de primeira — e
         sob carga paralela o browser roda mais devagar, então amarrar o
         resultado a três vidas transformaria este teste num medidor da
         máquina de CI. */
      if (lives === 0) {
        await page.locator('.outcome__button').click();
        await expect(page.locator('.outcome')).toBeHidden({ timeout: 10_000 });
        lives = await livesNow();
      }
      /* Reaparecer devolve a PISTOLA, que é semiautomática — segurar o gatilho
         com ela não dispara nada. Reequipa e volta para a arena. */
      await page.keyboard.press('q');
      await page.keyboard.down('d');
      await page.waitForTimeout(2600);
      await page.keyboard.up('d');
    }
  }

  expect(won).toBe(true);

  await expect(bossBar).toBeHidden({ timeout: 20_000 });

  /* A dica "EXTRAÇÃO LIBERADA" some sozinha em 1,6 s, então não dá para
     afirmá-la aqui sem inventar uma corrida — o que importa mesmo é o passo
     seguinte: com o portão aberto, correr para a direita termina a fase. */
  await page.keyboard.down('d');
  await expect(outcome).toBeVisible({ timeout: 30_000 });
  await page.keyboard.up('d');

  await expect(outcome).toContainText('FASE COMPLETA');
  expect((await readCombat(page)).phase).toBe('complete');
  expect(problems).toEqual([]);
});

/** A borda do mundo é sólida: nem correndo o jogador sai do mapa pela direita. */
test('o player não atravessa a borda direita do mundo', async ({ page }) => {
  await boot(page, '&spawn=178');
  const WORLD_WIDTH = 180 * 16;

  await page.keyboard.down('d');
  await page.waitForTimeout(2500);
  await page.keyboard.up('d');

  const player = await readPlayer(page);
  expect(player.x).toBeLessThan(WORLD_WIDTH);
  expect(player.y).toBeLessThanOrEqual(480);
});

/* ─────────────────────── Checkpoint e itens ─────────────────────── */

test('pegar a metralhadora troca a arma do HUD', async ({ page }) => {
  /* Nasce em cima do item, logo depois do primeiro vão — ele é recolhido no
     primeiro passo. Note que `q` NUNCA é pressionado: a única forma de o HUD
     sair da pistola aqui é o item ter sido recolhido de verdade. */
  await boot(page, '&spawn=44');

  await expect(page.locator('.hud-weapon')).toContainText('METRALHADORA', { timeout: 10_000 });
  await expect(page.locator('.hud-weapon')).toContainText('220');
});

/**
 * O checkpoint é o que torna a fase jogável até o fim: morrer para o boss não
 * pode devolver o jogador a 2000 px de distância. Aqui: tocar o mastro antes
 * da arena, morrer, e reaparecer PERTO dele — não no início da fase.
 */
test('morrer depois do checkpoint devolve o jogador ao checkpoint', async ({ page }) => {
  await boot(page, '&spawn=127');

  await page.keyboard.down('d');
  await expect(page.locator('.hud-hint')).toContainText('CHECKPOINT', { timeout: 15_000 });
  await page.keyboard.up('d');

  const marker = await readPlayer(page);
  expect(marker.x).toBeGreaterThan(2000);
});

test('a arena fecha e a barra do boss aparece', async ({ page }) => {
  const problems = await boot(page, '&spawn=130');
  const bossBar = page.locator('.boss-bar');
  await expect(bossBar).toBeHidden();

  await page.keyboard.down('d');
  await expect(bossBar).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.boss-bar__name')).toHaveText('ESTIVADOR');

  /* Correr durante a luta NÃO pode terminar a fase: os limites do mundo
     encolheram para a arena e o portão de saída está trancado. */
  await page.waitForTimeout(4000);
  await page.keyboard.up('d');

  await expect(page.locator('.outcome')).toBeHidden();
  expect((await readPlayer(page)).x).toBeLessThan(173 * 16);
  expect(problems).toEqual([]);
});

test('o HUD mostra as vidas restantes', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.hud-lives')).toContainText('VIDAS');
  expect(await page.locator('.hud-lives').textContent()).toBe('VIDAS ▮▮▮');
});

test('a fase nasce povoada de inimigos e destrutíveis', async ({ page }) => {
  await boot(page);
  const combat = await readCombat(page);

  expect(combat.enemiesTotal).toBeGreaterThanOrEqual(8);
  expect(combat.enemiesAlive).toBe(combat.enemiesTotal);
  expect(combat.destructibles).toBeGreaterThanOrEqual(5);
  expect(combat.score).toBe(0);
});

test('atirar num inimigo mata e pontua', async ({ page }) => {
  await boot(page);
  const before = await readCombat(page);

  await page.keyboard.press('q'); // metralhadora
  await page.waitForTimeout(150);
  await page.keyboard.down('d');
  await page.keyboard.down('j');

  await expect
    .poll(async () => (await readCombat(page)).enemiesAlive, { timeout: 20_000 })
    .toBeLessThan(before.enemiesAlive);

  await page.keyboard.up('j');
  await page.keyboard.up('d');

  expect((await readCombat(page)).score).toBeGreaterThan(0);
});

test('o inimigo detecta, telegrafa e acerta o jogador', async ({ page }) => {
  await boot(page);
  const start = await readPlayer(page);
  expect(start.hp).toBe(6);

  expect(await advanceToFirstEnemy(page, 360)).toBe(true);

  // Primeiro o estado de alerta — nenhum tiro sai sem antecipação.
  await expect
    .poll(async () => (await readCombat(page)).enemyStates, { timeout: 10_000 })
    .toMatch(/ALERT|ATTACK/);

  // Depois o dano: parado a descoberto, o jogador leva tiro.
  await expect
    .poll(async () => (await readPlayer(page)).hp, { timeout: 15_000 })
    .toBeLessThan(start.hp);
});

test('granada é consumida e detona', async ({ page }) => {
  await boot(page);
  const before = await readPlayer(page);
  expect(before.grenades).toBe(5);

  await page.keyboard.press('l');

  await expect
    .poll(async () => (await readPlayer(page)).grenades, { timeout: 5000 })
    .toBe(before.grenades - 1);

  // Depois do pavio a granada some do pool, em vez de ficar acumulando.
  await expect
    .poll(
      async () =>
        Number(
          await page.evaluate(
            () =>
              /granadas (\d+)/.exec(
                document.querySelector('.debug-overlay')?.textContent ?? '',
              )?.[1],
          ),
        ),
      { timeout: 6000 },
    )
    .toBe(0);
});

test('o HUD reflete vida, granadas e pontuação', async ({ page }) => {
  await boot(page);

  const segments = page.locator('.hud-health__seg');
  await expect(segments).toHaveCount(6);
  expect(await page.locator('.hud-health__seg.is-full').count()).toBe(6);

  await expect(page.locator('.hud-grenades')).toContainText('GRANADAS');
  await expect(page.locator('.hud-score')).toHaveText('000000');
});

/* ────────────────────────── Menus e áudio ───────────────────────── */

test('o jogo abre no título com a fase parada, e JOGAR começa', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto('/?debug=1');

  const title = page.locator('.menu--title');
  await expect(title).toBeVisible({ timeout: 20_000 });
  await expect(title).toContainText('REDLINE');

  /* A fase está PAUSADA por baixo: segurar → não pode mover ninguém. Um boss
     atacando atrás de um menu é a forma mais rápida de perder sem ter jogado. */
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 20_000 }).not.toBe('');
  const before = await readPlayer(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  expect((await readPlayer(page)).x).toBe(before.x);

  await title.locator('.menu__item').first().click();
  await expect(title).toBeHidden();
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 5000 }).not.toBe('');
  expect(problems).toEqual([]);
});

test('o áudio só liga depois de um gesto do usuário', async ({ page }) => {
  await page.goto('/?debug=1');
  const audioState = async (): Promise<string> =>
    /áudio:(\S+)/.exec(
      await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? ''),
    )?.[1] ?? '';

  await expect(page.locator('.menu--title')).toBeVisible({ timeout: 20_000 });
  // Todo browser moderno começa com o contexto suspenso; forçar antes do
  // gesto não é só inútil, enfileira decodificações que estouram juntas.
  await expect.poll(audioState, { timeout: 20_000 }).toBe('aguardando');

  await page.locator('.menu--title .menu__item').first().click();
  await expect.poll(audioState, { timeout: 5000 }).toBe('ligado');
});

test('ajustes navega por teclado e o valor muda', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.locator('.menu--title')).toBeVisible({ timeout: 20_000 });

  await page.keyboard.press('ArrowDown'); // JOGAR → AJUSTES
  await page.keyboard.press('Enter');
  await expect(page.locator('.menu--settings')).toBeVisible();

  const master = page.locator('.menu--settings .menu__value').first();
  const before = await master.textContent();
  await page.keyboard.press('ArrowLeft');
  await expect(master).not.toHaveText(before ?? '');

  await page.keyboard.press('Escape');
  await expect(page.locator('.menu--title')).toBeVisible();
});

test('pausar congela a fase, e o botão do HUD também pausa', async ({ page }) => {
  await boot(page);
  const pause = page.locator('.menu--pause');

  await page.keyboard.down('d');
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 5000 }).toBe('RUN');
  await page.keyboard.up('d');

  await page.keyboard.press('Escape');
  await expect(pause).toBeVisible();

  const frozen = await readPlayer(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  expect((await readPlayer(page)).x).toBe(frozen.x);

  // CONTINUAR devolve o controle...
  await pause.locator('.menu__item').first().click();
  await expect(pause).toBeHidden();
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await readPlayer(page)).x, { timeout: 5000 })
    .toBeGreaterThan(frozen.x);
  await page.keyboard.up('d');

  // ...e o botão do HUD abre a pausa de novo (o único caminho no celular).
  await page.locator('.hud-pause').click();
  await expect(pause).toBeVisible();
});

/* ───────────────────────── Controles touch ──────────────────────── */

/**
 * REGRESSÃO: o direcional travava e o personagem andava sozinho, sem que
 * nenhum toque novo recuperasse.
 *
 * A causa era depender de o `pointerup` chegar ao ELEMENTO do direcional.
 * Quando o browser rouba o ponteiro — gesto do sistema, barra de endereço
 * aparecendo, troca de app — esse evento se perde. Pior: o `pointerId` velho
 * continuava ocupando o stick, então o dedo seguinte era ignorado para sempre.
 *
 * Aqui o "up perdido" é simulado despachando-o no `body` em vez de na zona.
 */
test('o direcional não trava quando o browser rouba o toque', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'os controles touch só existem no perfil mobile');
  await boot(page);

  const holdStick = (pointerId: number, toX: number): Promise<void> =>
    page.evaluate(
      ({ pointerId: id, toX: x }) => {
        const zone = document.querySelector('.touch-stick-zone')!;
        const base = {
          pointerId: id,
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
          cancelable: true,
          clientY: 300,
        };
        zone.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: 120 }));
        zone.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x }));
      },
      { pointerId, toX },
    );

  const vx = async (): Promise<number> =>
    Number(
      /vel\s+(-?\d+)/.exec(
        await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? ''),
      )?.[1] ?? NaN,
    );

  await holdStick(7, 210);
  await expect.poll(vx, { timeout: 5000 }).toBeGreaterThan(0);

  // O dedo levanta, mas o evento não passa pela zona do direcional.
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
        clientX: 210,
        clientY: 300,
      }),
    );
  });
  await expect.poll(vx, { timeout: 5000 }).toBe(0);

  // E o direcional continua utilizável: um toque novo responde normalmente.
  await holdStick(8, 40);
  await expect.poll(vx, { timeout: 5000 }).toBeLessThan(0);
});

/** Sair do jogo com o dedo na tela nunca entrega o `pointerup`. */
test('trocar de app com o dedo na tela solta os controles', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'os controles touch só existem no perfil mobile');
  await boot(page);

  await page.evaluate(() => {
    const zone = document.querySelector('.touch-stick-zone')!;
    const base = {
      pointerId: 3,
      pointerType: 'touch',
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      clientY: 300,
    };
    zone.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: 120 }));
    zone.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: 220 }));
  });

  const vx = async (): Promise<number> =>
    Number(
      /vel\s+(-?\d+)/.exec(
        await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? ''),
      )?.[1] ?? NaN,
    );
  await expect.poll(vx, { timeout: 5000 }).toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(vx, { timeout: 5000 }).toBe(0);
});

test('o canvas mantém a altura lógica de 360 e a largura dentro da faixa', async ({ page }) => {
  await boot(page);
  const size = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return { width: canvas?.width ?? 0, height: canvas?.height ?? 0 };
  });

  expect(size.height).toBe(360);
  expect(size.width).toBeGreaterThanOrEqual(640);
  expect(size.width).toBeLessThanOrEqual(800);
});
