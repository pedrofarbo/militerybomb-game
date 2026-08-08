import { describe, expect, it } from 'vitest';
import {
  addScore,
  createRunState,
  createScoreResult,
  elapsedMs,
  loseLife,
  resetRun,
  RUN,
} from '../../src/core/progression/run-state';

describe('tentativa — vidas', () => {
  it('começa com as vidas iniciais e sem pontos', () => {
    const run = createRunState('level-01', 1000);
    expect(run.lives).toBe(RUN.startingLives);
    expect(run.score).toBe(0);
    expect(run.over).toBe(false);
  });

  it('perder uma vida devolve "respawn" enquanto sobrar alguma', () => {
    const run = createRunState('level-01', 0);
    expect(loseLife(run)).toBe('respawn');
    expect(run.lives).toBe(RUN.startingLives - 1);
    expect(run.over).toBe(false);
  });

  it('a última vida devolve "game-over" e encerra a tentativa', () => {
    const run = createRunState('level-01', 0);
    for (let i = 0; i < RUN.startingLives - 1; i++) expect(loseLife(run)).toBe('respawn');

    expect(loseLife(run)).toBe('game-over');
    expect(run.lives).toBe(0);
    expect(run.over).toBe(true);
  });

  /**
   * Sem esta guarda, um segundo evento de morte no mesmo fim de jogo levaria as
   * vidas para -1 e o HUD mostraria "VIDAS " vazio. É barato e fecha a porta.
   */
  it('não desconta vida depois do game over', () => {
    const run = createRunState('level-01', 0);
    while (!run.over) loseLife(run);

    expect(loseLife(run)).toBe('game-over');
    expect(run.lives).toBe(0);
  });
});

describe('tentativa — pontuação', () => {
  it('acumula pontos', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    addScore(run, 120, out);
    addScore(run, 80, out);
    expect(run.score).toBe(200);
  });

  /**
   * A CONVENÇÃO DE ARCADE: os pontos sobrevivem à perda de uma vida.
   *
   * É isso que dá sentido a ter três vidas — três tentativas de fazer UMA
   * pontuação, não três pontuações separadas. Zerar aqui transformaria cada
   * morte num recomeço total e tiraria a razão de existir do placar.
   */
  it('os pontos sobrevivem à perda de uma vida', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    addScore(run, 500, out);

    expect(loseLife(run)).toBe('respawn');
    expect(run.score).toBe(500);
  });

  it('recomeçar depois do game over zera pontos e devolve as vidas', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    addScore(run, 900, out);
    while (!run.over) loseLife(run);

    resetRun(run, 5000);

    expect(run.score).toBe(0);
    expect(run.lives).toBe(RUN.startingLives);
    expect(run.over).toBe(false);
    expect(elapsedMs(run, 8000)).toBe(3000);
  });

  it('concede vida extra ao cruzar o marco de pontuação', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();

    addScore(run, RUN.extraLifeEvery - 1, out);
    expect(out.extraLives).toBe(0);
    expect(run.lives).toBe(RUN.startingLives);

    addScore(run, 1, out);
    expect(out.extraLives).toBe(1);
    expect(run.lives).toBe(RUN.startingLives + 1);
  });

  it('um ganho que cruza vários marcos concede várias vidas', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    addScore(run, RUN.extraLifeEvery * 3, out);
    expect(out.extraLives).toBe(3);
    expect(run.lives).toBe(RUN.startingLives + 3);
  });

  it('respeita o teto de vidas', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    addScore(run, RUN.extraLifeEvery * (RUN.maxLives + 5), out);
    expect(run.lives).toBe(RUN.maxLives);
  });

  it('não pontua depois do game over', () => {
    const run = createRunState('level-01', 0);
    const out = createScoreResult();
    while (!run.over) loseLife(run);

    addScore(run, 1000, out);
    expect(run.score).toBe(0);
    expect(out.extraLives).toBe(0);
  });
});
