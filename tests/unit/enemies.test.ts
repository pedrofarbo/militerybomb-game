import { describe, expect, it } from 'vitest';
import {
  EnemyState,
  createBrainContext,
  createBrainOutput,
  type BrainContext,
} from '../../src/core/enemies/brain';
import { ENEMIES } from '../../src/core/enemies/enemies.data';
import {
  createBrain,
  createHeavyBrain,
  createSoldierBrain,
  createTurretBrain,
} from '../../src/core/enemies/standard-brain';
import { createDamageResult } from '../../src/core/combat/health';

const STEP = 1000 / 60;

function context(partial: Partial<BrainContext> = {}): BrainContext {
  return { ...createBrainContext(), maxHealth: 20, health: 20, ...partial };
}

/** Avança `ms` de simulação, devolvendo tudo o que o brain pediu no caminho. */
function run(
  brain: ReturnType<typeof createBrain>,
  ctx: BrainContext,
  ms: number,
): { shots: number; states: Set<string>; lastMoveX: number; firstShotAtMs: number } {
  const out = createBrainOutput();
  let shots = 0;
  let firstShotAtMs = Infinity;
  const states = new Set<string>();
  let lastMoveX = 0;

  for (let t = 0; t < ms; t += STEP) {
    ctx.nowMs += STEP;
    brain.update(ctx, STEP, out);
    states.add(out.state);
    lastMoveX = out.moveX;
    if (out.wantFire) {
      shots++;
      if (firstShotAtMs === Infinity) firstShotAtMs = t;
    }
  }
  return { shots, states, lastMoveX, firstShotAtMs };
}

describe('soldado — patrulha', () => {
  it('anda entre os limites de patrulha quando não vê ninguém', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({ selfX: 200, patrolLeft: 150, patrolRight: 250, playerAlive: false });

    const result = run(brain, ctx, 200);

    expect(result.states.has(EnemyState.Patrol)).toBe(true);
    expect(Math.abs(result.lastMoveX)).toBe(1);
  });

  it('vira ao chegar no limite da patrulha', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({ selfX: 260, patrolLeft: 150, patrolRight: 250, playerAlive: false });

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);

    expect(out.moveX).toBe(-1);
  });

  it('vira numa beirada em vez de cair', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({
      selfX: 200,
      patrolLeft: 100,
      patrolRight: 300,
      playerAlive: false,
      edgeAhead: true,
    });

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);
    expect(out.moveX).toBe(-1);
  });

  it('sem limites de patrulha, fica parado', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({ selfX: 200, patrolLeft: 0, patrolRight: 0, playerAlive: false });

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);

    expect(out.state).toBe(EnemyState.Idle);
    expect(out.moveX).toBe(0);
  });
});

describe('soldado — detecção e telegrafo', () => {
  const engaged = (): BrainContext =>
    context({
      selfX: 100,
      selfY: 300,
      playerX: 220,
      playerY: 280,
      playerAlive: true,
      canSeePlayer: true,
      distanceToPlayer: 120,
      patrolLeft: 50,
      patrolRight: 150,
    });

  it('vira para o jogador ao detectá-lo', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const out = createBrainOutput();

    brain.update(engaged(), STEP, out);

    expect(out.facing).toBe(1);
    expect(out.state).toBe(EnemyState.Alert);
  });

  /**
   * A regra de design mais importante do combate: nenhum tiro sai sem
   * antecipação visível. Sem isso o jogo vira "difícil" por ser injusto.
   */
  it('NÃO atira no frame em que detecta — telegrafa antes', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const out = createBrainOutput();

    brain.update(engaged(), STEP, out);

    expect(out.wantFire).toBe(false);
  });

  it('o primeiro tiro respeita o tempo de antecipação configurado', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const result = run(brain, engaged(), 1000);

    expect(result.firstShotAtMs).toBeGreaterThanOrEqual(ENEMIES.soldier.telegraphMs - STEP);
    expect(result.shots).toBeGreaterThan(0);
  });

  it('dispara uma rajada do tamanho configurado e então recarrega', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const def = ENEMIES.soldier;
    // Janela suficiente para uma rajada, mas não para a próxima.
    const window = def.telegraphMs + def.shotIntervalMs * def.shotsPerBurst + 50;

    const result = run(brain, engaged(), window);

    expect(result.shots).toBe(def.shotsPerBurst);
  });

  it('telegrafa de novo antes da rajada seguinte', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const def = ENEMIES.soldier;
    const ctx = engaged();

    // Primeira rajada.
    run(brain, ctx, def.telegraphMs + def.shotIntervalMs * def.shotsPerBurst + 20);
    // Durante a recarga, nada de tiro.
    const duringCooldown = run(brain, ctx, def.burstCooldownMs - 100);
    expect(duringCooldown.shots).toBe(0);
    expect(duringCooldown.states.has(EnemyState.Alert)).toBe(true);
  });

  it('não reage a um jogador fora do alcance de visão', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = engaged();
    ctx.distanceToPlayer = ENEMIES.soldier.sightRange + 10;

    const result = run(brain, ctx, 2000);

    expect(result.shots).toBe(0);
  });

  it('não reage através de parede (sem linha de visão)', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = engaged();
    ctx.canSeePlayer = false;

    const result = run(brain, ctx, 2000);

    expect(result.shots).toBe(0);
  });

  it('recua se o jogador colar demais', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = engaged();
    ctx.playerX = ctx.selfX + 20;
    ctx.distanceToPlayer = 20;

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);

    // Jogador à direita → recua para a esquerda, sem virar as costas.
    expect(out.moveX).toBe(-1);
    expect(out.facing).toBe(1);
  });

  it('mira acima dos pés — um tiro reto passaria por baixo do jogador', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = engaged();
    ctx.selfY = 300;
    ctx.playerY = 300 - 22; // tronco do jogador

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);

    expect(out.aimAngleRad).not.toBeNull();
    // Alvo levemente ABAIXO do tronco do inimigo (torso 20 vs 22) → ângulo pequeno.
    expect(Math.abs(out.aimAngleRad ?? 0)).toBeLessThan(0.3);
  });
});

describe('inimigos — reação ao dano', () => {
  it('fica atordoado e não atira durante o atordoamento', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({
      selfX: 100,
      playerX: 200,
      playerAlive: true,
      canSeePlayer: true,
      distanceToPlayer: 100,
    });

    const damage = createDamageResult();
    damage.applied = 5;
    brain.onDamaged(damage, 0);

    const result = run(brain, ctx, ENEMIES.soldier.hurtMs - STEP * 2);

    expect(result.states.has(EnemyState.Hurt)).toBe(true);
    expect(result.shots).toBe(0);
  });

  it('levar tiro pelas costas conta como detectar o jogador', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    // Sem linha de visão: só o dano pode acordá-lo.
    const ctx = context({
      selfX: 100,
      playerX: 200,
      playerAlive: true,
      canSeePlayer: false,
      distanceToPlayer: 100,
      patrolLeft: 50,
      patrolRight: 150,
    });

    const damage = createDamageResult();
    damage.applied = 5;
    brain.onDamaged(damage, 0);

    const result = run(brain, ctx, ENEMIES.soldier.hurtMs + 200);

    // Reage (sai da patrulha), mas sem enxergar não atira às cegas.
    expect(result.states.has(EnemyState.Alert)).toBe(true);
    expect(result.shots).toBe(0);
  });

  it('morrer é terminal: não volta a agir', () => {
    const brain = createSoldierBrain();
    brain.reset(0);
    const ctx = context({
      playerAlive: true,
      canSeePlayer: true,
      distanceToPlayer: 50,
      playerX: 200,
    });

    const damage = createDamageResult();
    damage.applied = 20;
    damage.killed = true;
    brain.onDamaged(damage, 0);

    const result = run(brain, ctx, 3000);

    expect(result.shots).toBe(0);
    expect([...result.states]).toEqual([EnemyState.Dead]);
  });
});

describe('inimigos — silhuetas de comportamento distintas', () => {
  const facingPlayer = (distance: number): BrainContext =>
    context({
      selfX: 100,
      selfY: 300,
      playerX: 100 + distance,
      playerY: 280,
      playerAlive: true,
      canSeePlayer: true,
      distanceToPlayer: distance,
    });

  it('o pesado avança em vez de recuar', () => {
    const brain = createHeavyBrain();
    brain.reset(0);

    const out = createBrainOutput();
    brain.update(facingPlayer(30), STEP, out);

    expect(out.moveX).toBe(1);
  });

  it('o pesado telegrafa por mais tempo que o soldado', () => {
    expect(ENEMIES.heavy.telegraphMs).toBeGreaterThan(ENEMIES.soldier.telegraphMs);
  });

  it('a torreta nunca se move', () => {
    const brain = createTurretBrain();
    brain.reset(0);

    const result = run(brain, facingPlayer(120), 2000);

    expect(result.lastMoveX).toBe(0);
    expect(result.shots).toBeGreaterThan(0);
  });

  it('a torreta ainda mira e atira mesmo imóvel', () => {
    const brain = createTurretBrain();
    brain.reset(0);
    const ctx = facingPlayer(-120);

    const out = createBrainOutput();
    brain.update(ctx, STEP, out);

    expect(out.facing).toBe(-1);
    expect(out.aimAngleRad).not.toBeNull();
  });

  it('a fábrica devolve o brain do tipo pedido', () => {
    expect(createBrain('soldier').id).toBe('soldier');
    expect(createBrain('heavy').id).toBe('heavy');
    expect(createBrain('turret').id).toBe('turret');
  });
});
