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
  };
}

async function boot(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto('/?debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  // Espera o carregamento dos atlas e o primeiro frame da fase.
  await expect.poll(async () => (await readPlayer(page)).state, { timeout: 20_000 }).not.toBe('');
  return problems;
}

test('a fase carrega sem erros e o player nasce parado no chão', async ({ page }) => {
  const problems = await boot(page);
  const player = await readPlayer(page);

  expect(player.grounded).toBe(true);
  expect(player.state).toBe('IDLE');
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
        () =>
          /projéteis (\d+)\//.exec(
            document.querySelector('.debug-overlay')?.textContent ?? '',
          )?.[1],
      ),
    );

  await page.keyboard.down('j');
  await expect.poll(activeProjectiles, { timeout: 5000 }).toBeGreaterThan(0);
  await page.keyboard.up('j');

  // E o pool devolve tudo depois que os projéteis expiram — sem vazamento.
  await expect.poll(activeProjectiles, { timeout: 5000 }).toBe(0);
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
