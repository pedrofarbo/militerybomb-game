/**
 * Estado de uma TENTATIVA (uma "vida em jogo", do start ao game over).
 *
 * O plano técnico separa três escopos com tempos de vida distintos, e
 * confundi-los é uma fonte clássica de bug — foi exatamente o que aconteceu
 * aqui: sem `RunState`, morrer não zerava nada e a fase nunca terminava.
 *
 *   ProfileState  → para sempre, persistido (high score, settings)
 *   RunState      → uma tentativa: vidas, pontos, fase atual   ← este arquivo
 *   LevelRuntime  → uma carga de fase: entidades vivas, triggers
 *
 * Convenção de arcade, deliberada: os pontos SOBREVIVEM à perda de uma vida e
 * só zeram no game over. É isso que dá sentido a ter vidas — três tentativas
 * de fazer a maior pontuação, não três pontuações separadas.
 */

import type { CheckpointSnapshot } from './checkpoint';

export interface RunState {
  levelId: string;
  lives: number;
  score: number;
  startedAtMs: number;
  /** Fica `true` no game over; nenhuma vida é descontada duas vezes. */
  over: boolean;
  /** Último checkpoint tocado. `null` = a fase recomeça do início. */
  checkpoint: CheckpointSnapshot | null;
}

/** O que fazer depois de perder uma vida. */
export type DeathOutcome = 'respawn' | 'game-over';

export const RUN = {
  startingLives: 3,
  /** Vida extra a cada N pontos. Recompensa jogar bem, não só sobreviver. */
  extraLifeEvery: 5000,
  maxLives: 9,
} as const;

export function createRunState(levelId: string, nowMs: number): RunState {
  return {
    levelId,
    lives: RUN.startingLives,
    score: 0,
    startedAtMs: nowMs,
    over: false,
    checkpoint: null,
  };
}

export function resetRun(run: RunState, nowMs: number): void {
  run.lives = RUN.startingLives;
  run.score = 0;
  run.startedAtMs = nowMs;
  run.over = false;
  // O checkpoint é da tentativa: recomeçar depois do game over é recomeçar a
  // fase do zero, senão o fim de jogo não custaria progresso nenhum.
  run.checkpoint = null;
}

export interface ScoreResult {
  /** Quantas vidas extras o marco de pontuação concedeu neste ganho. */
  extraLives: number;
}

/** Resultado reutilizável: pontuar acontece em rajada, e não vale alocar. */
export function createScoreResult(): ScoreResult {
  return { extraLives: 0 };
}

export function addScore(run: RunState, amount: number, out: ScoreResult): void {
  out.extraLives = 0;
  if (amount <= 0 || run.over) return;

  const before = Math.floor(run.score / RUN.extraLifeEvery);
  run.score += amount;
  const after = Math.floor(run.score / RUN.extraLifeEvery);

  const earned = Math.max(0, after - before);
  for (let i = 0; i < earned; i++) {
    if (run.lives >= RUN.maxLives) break;
    run.lives++;
    out.extraLives++;
  }
}

/**
 * Desconta uma vida.
 *
 * @returns `'respawn'` se ainda há vida, `'game-over'` se acabaram.
 */
export function loseLife(run: RunState): DeathOutcome {
  if (run.over) return 'game-over';

  run.lives--;
  if (run.lives > 0) return 'respawn';

  run.lives = 0;
  run.over = true;
  return 'game-over';
}

export function elapsedMs(run: RunState, nowMs: number): number {
  return Math.max(0, nowMs - run.startedAtMs);
}
