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

  await page.keyboard.down('Space');
  await page.waitForTimeout(350);
  await page.keyboard.up('Space');

  await expect
    .poll(
      async () => {
        const r = await readPlayer(page);
        return r.grounded && r.y < GROUND_Y - 20;
      },
      { timeout: 5000 },
    )
    .toBe(true);

  const onPlatform = await readPlayer(page);

  /* Tenta descer algumas vezes. A plataforma fica logo acima do primeiro
     soldado: um tiro joga o player no ar e a tentativa daquele instante falha
     porque ele não está apoiado. Um jogador apertaria de novo — o teste
     também, senão estaria testando a sorte do tiroteio, não a descida. */
  await page.keyboard.down('s');
  let dropped = false;
  for (let attempt = 0; attempt < 6 && !dropped; attempt++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    dropped = (await readPlayer(page)).y > onPlatform.y + 16;
  }
  await page.keyboard.up('s');
  expect(dropped).toBe(true);

  const after = await readPlayer(page);
  // Desceu de fato...
  expect(after.y).toBeGreaterThan(onPlatform.y + 16);
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
  expect(after.score).toBe(scored.score);
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
 * mapa saía do mundo, caía no vazio e morria. Agora existe um portão.
 */
test('chegar ao portão termina a fase em vez de cair no vazio', async ({ page }) => {
  const problems = await boot(page, '&spawn=121');
  const outcome = page.locator('.outcome');

  await page.keyboard.down('d');
  await expect(outcome).toBeVisible({ timeout: 25_000 });
  await page.keyboard.up('d');

  await expect(outcome).toContainText('FASE COMPLETA');
  const done = await readCombat(page);
  expect(done.phase).toBe('complete');
  expect(done.lives).toBe(3); // terminou sem morrer no caminho
  expect(problems).toEqual([]);
});

/** A borda do mundo é sólida: nem correndo o jogador sai do mapa pela direita. */
test('o player não atravessa a borda direita do mundo', async ({ page }) => {
  await boot(page, '&spawn=129');
  const WORLD_WIDTH = 132 * 16;

  await page.keyboard.down('d');
  await page.waitForTimeout(2500);
  await page.keyboard.up('d');

  const player = await readPlayer(page);
  expect(player.x).toBeLessThan(WORLD_WIDTH);
  expect(player.y).toBeLessThanOrEqual(480);
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
