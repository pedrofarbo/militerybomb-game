import { describe, expect, it } from 'vitest';
import {
  BossState,
  createBossContext,
  createBossOutput,
  ESTIVADOR,
  EstivadorBrain,
  type BossContext,
  type BossOutput,
} from '../../src/core/boss/estivador';

const STEP = 1000 / 60;

function setup(): { brain: EstivadorBrain; ctx: BossContext; out: BossOutput } {
  const brain = new EstivadorBrain();
  const ctx = createBossContext();
  ctx.selfX = 2500;
  ctx.selfY = 400;
  ctx.arenaLeft = 2128;
  ctx.arenaRight = 2768;
  ctx.health = ESTIVADOR.maxHealth;
  ctx.maxHealth = ESTIVADOR.maxHealth;
  ctx.playerX = 2200;
  ctx.playerY = 380;
  ctx.playerAlive = true;
  return { brain, ctx, out: createBossOutput() };
}

/** Roda `ms` de simulação, devolvendo tudo o que o boss produziu no caminho. */
function run(
  brain: EstivadorBrain,
  ctx: BossContext,
  out: BossOutput,
  ms: number,
): {
  states: Set<string>;
  patterns: Set<string>;
  shots: number;
  slams: number[];
  ventMs: number;
} {
  const states = new Set<string>();
  const patterns = new Set<string>();
  const slams: number[] = [];
  let shots = 0;
  let ventMs = 0;

  for (let elapsed = 0; elapsed < ms; elapsed += STEP) {
    ctx.nowMs += STEP;
    brain.update(ctx, STEP, out);
    states.add(out.state);
    if (out.pattern) patterns.add(out.pattern);
    shots += out.shots.length;
    if (out.slamAt !== null) slams.push(out.slamAt);
    if (out.coreExposed) ventMs += STEP;
    // O Actor faria isso; aqui o teste integra o movimento à mão.
    ctx.selfX += (out.moveX * out.moveSpeed * STEP) / 1000;
    ctx.facing = out.facing;
  }
  return { states, patterns, shots, slams, ventMs };
}

describe('Estivador — despertar', () => {
  it('fica dormente até o portão fechar', () => {
    const { brain, ctx, out } = setup();
    const first = run(brain, ctx, out, 3000);

    expect(first.states).toEqual(new Set([BossState.Dormant]));
    expect(first.shots).toBe(0);
    expect(first.slams).toEqual([]);
  });

  it('acorda, faz a introdução e só então ataca', () => {
    const { brain, ctx, out } = setup();
    brain.wake();

    // Durante a introdução ele é invulnerável e não produz nenhum ataque.
    const intro = run(brain, ctx, out, ESTIVADOR.introMs - 100);
    expect(intro.states).toEqual(new Set([BossState.Intro]));
    expect(intro.shots + intro.slams.length).toBe(0);

    const after = run(brain, ctx, out, 4000);
    expect(after.states).toContain(BossState.Telegraph);
  });
});

describe('Estivador — o loop da luta', () => {
  /**
   * A REGRA que faz a luta ser justa: nenhum ataque acontece sem antecipação.
   * Se este teste cair, a luta virou sorteio.
   */
  it('todo ataque é precedido de antecipação', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    run(brain, ctx, out, ESTIVADOR.introMs + 50);

    let sawTelegraphSinceLastAttack = false;
    let attacks = 0;

    for (let i = 0; i < 60 * 30; i++) {
      ctx.nowMs += STEP;
      brain.update(ctx, STEP, out);
      if (out.state === BossState.Telegraph) sawTelegraphSinceLastAttack = true;
      if (out.shots.length > 0 || out.slamAt !== null) {
        expect(sawTelegraphSinceLastAttack).toBe(true);
        attacks++;
      }
      if (out.state === BossState.Vent) sawTelegraphSinceLastAttack = false;
      ctx.selfX += (out.moveX * out.moveSpeed * STEP) / 1000;
    }

    expect(attacks).toBeGreaterThan(3);
  });

  /**
   * O núcleo é o professor da luta: se ele nunca abre, o jogador não tem como
   * causar dano relevante e a briga fica impossível.
   */
  it('abre o núcleo depois de cada padrão', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    const result = run(brain, ctx, out, ESTIVADOR.introMs + 12_000);

    expect(result.states).toContain(BossState.Vent);
    expect(result.ventMs).toBeGreaterThan(2000);
  });

  it('usa os três padrões ao longo de um ciclo', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    const result = run(brain, ctx, out, ESTIVADOR.introMs + 30_000);

    expect(result.patterns).toEqual(new Set(['claw', 'flak', 'charge']));
  });

  it('a garra cai onde o jogador estava, não onde o boss está', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    ctx.playerX = 2250;

    const result = run(brain, ctx, out, ESTIVADOR.introMs + 6000);

    expect(result.slams.length).toBeGreaterThan(0);
    for (const slam of result.slams) expect(Math.abs(slam - 2250)).toBeLessThan(4);
  });

  it('o leque de flak sai centrado no jogador e com abertura', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    // Jogador exatamente à esquerda: o centro do leque aponta para π.
    ctx.playerX = ctx.selfX - 300;
    ctx.playerY = ctx.selfY;

    const angles: number[] = [];
    for (let i = 0; i < 60 * 20 && angles.length < ESTIVADOR.flak.pellets; i++) {
      ctx.nowMs += STEP;
      brain.update(ctx, STEP, out);
      for (const shot of out.shots) angles.push(shot.angleRad);
    }

    expect(angles).toHaveLength(ESTIVADOR.flak.pellets);
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeCloseTo((ESTIVADOR.flak.spreadDeg * Math.PI) / 180, 2);
    const mid = (Math.max(...angles) + Math.min(...angles)) / 2;
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(0.05);
  });

  it('a investida para na borda da arena em vez de sair dela', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    ctx.playerX = ctx.arenaLeft + 20;

    run(brain, ctx, out, ESTIVADOR.introMs + 20_000);

    expect(ctx.selfX).toBeGreaterThanOrEqual(ctx.arenaLeft + ESTIVADOR.edgeMarginPx - 8);
    expect(ctx.selfX).toBeLessThanOrEqual(ctx.arenaRight - ESTIVADOR.edgeMarginPx + 8);
  });
});

describe('Estivador — fases', () => {
  it('entra na fase 2 aos 50% e a transição é invulnerável', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    run(brain, ctx, out, ESTIVADOR.introMs + 2000);
    expect(brain.phase).toBe(1);

    ctx.health = ESTIVADOR.maxHealth * 0.4;
    run(brain, ctx, out, 100);

    expect(brain.phase).toBe(2);
    expect(brain.invulnerable).toBe(true);
    expect(out.state).toBe(BossState.PhaseShift);
  });

  it('a transição de fase não solta ataque nenhum', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    run(brain, ctx, out, ESTIVADOR.introMs + 2000);
    ctx.health = ESTIVADOR.maxHealth * 0.4;

    const shift = run(brain, ctx, out, ESTIVADOR.phaseShiftMs - 100);
    expect(shift.shots + shift.slams.length).toBe(0);
  });

  it('a janela do núcleo encurta na fase 2 — a luta aperta', () => {
    expect(ESTIVADOR.phases[1]!.ventMs).toBeLessThan(ESTIVADOR.phases[0]!.ventMs);
    expect(ESTIVADOR.flak.pelletsPhase2).toBeGreaterThan(ESTIVADOR.flak.pellets);
  });

  it('morrer encerra tudo: sem ataque, sem dano de contato', () => {
    const { brain, ctx, out } = setup();
    brain.wake();
    run(brain, ctx, out, ESTIVADOR.introMs + 2000);

    brain.kill();
    const dead = run(brain, ctx, out, 3000);

    expect(brain.alive).toBe(false);
    expect(dead.states).toEqual(new Set([BossState.Dead]));
    expect(dead.shots + dead.slams.length).toBe(0);
    expect(out.contactDamage).toBe(0);
  });
});

describe('Estivador — a blindagem é o que ensina a luta', () => {
  it('só é vulnerável de verdade com o núcleo aberto', () => {
    const { brain, ctx, out } = setup();
    brain.wake();

    let exposedAndVulnerable = 0;
    let mismatched = 0;
    for (let i = 0; i < 60 * 20; i++) {
      ctx.nowMs += STEP;
      brain.update(ctx, STEP, out);
      if (out.coreExposed !== brain.vulnerable) mismatched++;
      if (out.coreExposed && brain.vulnerable) exposedAndVulnerable++;
      ctx.selfX += (out.moveX * out.moveSpeed * STEP) / 1000;
    }

    // O sprite do núcleo e a regra de dano são a MESMA coisa: se divergirem, o
    // jogador aprende a mira errada.
    expect(mismatched).toBe(0);
    expect(exposedAndVulnerable).toBeGreaterThan(0);
  });

  it('a blindagem reduz o dano sem zerá-lo', () => {
    expect(ESTIVADOR.armorMultiplier).toBeGreaterThan(0);
    expect(ESTIVADOR.armorMultiplier).toBeLessThan(0.5);
  });
});
