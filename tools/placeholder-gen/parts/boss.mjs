/**
 * MINI-BOSS — "Estivador": guindaste portuário blindado.
 * Multi-parte, como o plano prevê para bosses maiores:
 *   estivador/base  192x160  — corpo, esteiras, cabine, contrapeso
 *   estivador/claw   80x80   — garra no fim do braço (Actor próprio)
 *   estivador/core   32x32   — ponto fraco (hurtbox independente)
 * O boss encara a ESQUERDA (o jogador entra na arena pela esquerda).
 * Chão do frame da base em y=156.
 */
import { Canvas } from '../canvas.mjs';

export const BOSS_FRAMES = { base: [192, 160], claw: [80, 80], core: [32, 32] };
/** Onde a garra se acopla e onde o núcleo aparece, no frame da base. */
export const BOSS_ANCHORS = { armPivot: { x: 62, y: 62 }, core: { x: 84, y: 84 } };

function frame(w, h, draw) {
  const c = new Canvas(w, h);
  draw(c);
  return c;
}

function base(c, o = {}) {
  const { bob = 0, flash = false, coreOpen = false, coreGlow = 0, damage = 0, tilt = 0 } = o;
  const hull = flash ? 'met5' : 'con3';
  const hullDark = flash ? 'met4' : 'con2';
  const y = bob;

  // Esteiras
  c.block(18, 130 + y, 156, 26, 'met1', { outline: 'ink' });
  for (let i = 0; i < 13; i++) c.rect(22 + i * 12, 134 + y, 8, 18, 'met2');
  for (let i = 0; i < 5; i++) c.disc(36 + i * 30, 143 + y, 8, 'met3');
  for (let i = 0; i < 5; i++) c.ring(36 + i * 30, 143 + y, 8, 1, 'ink');
  // Faixa de perigo
  for (let i = 0; i < 20; i++) c.rect(20 + i * 8, 126 + y, 4, 4, i % 2 ? 'sig3' : 'ink');

  // Chassi
  c.chamfer(26, 96 + y, 140, 32, hullDark, 'ink', 4);
  c.rect(32, 100 + y, 128, 3, 'con4');

  // Contrapeso traseiro (direita)
  c.block(132 + tilt, 62 + y, 44, 40, 'met1', { outline: 'ink', top: 'met2' });
  c.rect(138 + tilt, 68 + y, 32, 6, 'sig2');
  c.rect(138 + tilt, 80 + y, 32, 4, 'con2');

  // Torre central
  c.chamfer(78, 52 + y, 56, 52, hull, 'ink', 3);
  c.rect(84, 58 + y, 44, 4, 'con4');
  // Treliça
  for (let i = 0; i < 4; i++) {
    c.line(82, 66 + y + i * 9, 130, 74 + y + i * 9, 'con2');
    c.line(130, 66 + y + i * 9, 82, 74 + y + i * 9, 'con2');
  }

  // Cabine (esquerda, encarando o jogador)
  c.chamfer(34 - tilt, 44 + y, 46, 42, hull, 'ink', 4);
  c.block(38 - tilt, 50 + y, 34, 20, 'teal2', { outline: 'ink' });
  c.rect(40 - tilt, 52 + y, 30, 6, 'teal4');
  c.rect(40 - tilt, 74 + y, 12, 6, flash ? 'fx1' : 'haz'); // luz de estado
  c.stroke(40 - tilt, 74 + y, 12, 6, 'ink');

  // Pivô do braço
  c.disc(62, 62 + y, 10, 'met2');
  c.ring(62, 62 + y, 10, 2, 'ink');
  c.disc(62, 62 + y, 4, 'sig3');

  // Compartimento do núcleo (ponto fraco)
  if (coreOpen) {
    c.block(84, 84 + y, 32, 32, 'ink', { outline: 'met3' });
    const glow = coreGlow > 1 ? 'fx1' : coreGlow > 0 ? 'fx2' : 'teal4';
    c.disc(100, 100 + y, 11, glow);
    c.ring(100, 100 + y, 12, 2, 'met4');
    c.disc(100, 100 + y, 5, 'white');
  } else {
    c.block(84, 84 + y, 32, 32, hullDark, { outline: 'ink', top: 'con4' });
    for (let i = 0; i < 4; i++) c.rect(88, 88 + y + i * 7, 24, 3, 'met2');
  }

  // Dano acumulado
  if (damage > 0) {
    c.rect(96, 60 + y, 10, 10, 'ink');
    c.rect(120, 108 + y, 12, 8, 'ink');
    c.rect(46, 92 + y, 8, 8, 'ink');
  }
  if (damage > 1) {
    c.rect(60, 106 + y, 16, 10, 'ink');
    c.rect(140, 96 + y, 14, 10, 'ink');
    c.rect(30, 60 + y, 8, 12, 'ink');
  }
}

function claw(c, o = {}) {
  const { open = 1, flash = false } = o; // 0 fechada .. 2 escancarada
  const metal = flash ? 'met5' : 'met2';
  // Punho
  c.disc(40, 22, 12, metal);
  c.ring(40, 22, 12, 2, 'ink');
  c.rect(34, 10, 12, 8, 'met1');
  c.rect(36, 12, 8, 4, 'sig2');
  // Dedos
  const spread = Math.round(6 + open * 9);
  for (const s of [-1, 1]) {
    const x = 40 + s * spread;
    c.block(x - 5, 32, 10, 20, metal, { outline: 'ink', top: 'met3' });
    c.block(x - 3 + s * 2, 50, 7, 14, 'met1', { outline: 'ink' });
    c.line(x + s * 2, 62, 40 + s * 4, 72, 'met3');
  }
  c.block(34, 30, 12, 14, 'met1', { outline: 'ink' });
  if (flash) c.rect(36, 34, 8, 6, 'fx2');
}

function core(c, o = {}) {
  const { pulse = 0, exposed = false } = o;
  c.block(0, 0, 32, 32, exposed ? 'ink' : 'con2', { outline: 'met3' });
  if (!exposed) {
    for (let i = 0; i < 4; i++) c.rect(4, 4 + i * 7, 24, 3, 'met2');
    return;
  }
  const r = 8 + pulse;
  c.disc(16, 16, r + 2, 'fx5');
  c.disc(16, 16, r, pulse > 1 ? 'fx2' : 'fx3');
  c.disc(16, 16, Math.max(2, r - 4), 'fx1');
  c.ring(16, 16, 13, 2, 'met4');
}

export function buildBossFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });
  const [BW, BH] = BOSS_FRAMES.base;
  const [CW, CH] = BOSS_FRAMES.claw;
  const [KW, KH] = BOSS_FRAMES.core;

  // base/idle 4 — respiração hidráulica
  [0, -1, 0, 1].forEach((bob, i) =>
    add(
      `estivador/base/idle/${i}`,
      frame(BW, BH, (c) => base(c, { bob })),
    ),
  );
  // base/hurt 2
  add(
    `estivador/base/hurt/0`,
    frame(BW, BH, (c) => base(c, { flash: true, tilt: 2 })),
  );
  add(
    `estivador/base/hurt/1`,
    frame(BW, BH, (c) => base(c, { bob: 1, tilt: 1, damage: 1 })),
  );
  // base/phase 3 — transição: abre o compartimento e expõe o núcleo
  add(
    `estivador/base/phase/0`,
    frame(BW, BH, (c) => base(c, { damage: 1, tilt: -2 })),
  );
  add(
    `estivador/base/phase/1`,
    frame(BW, BH, (c) => base(c, { damage: 1, coreOpen: true, coreGlow: 0, bob: -1 })),
  );
  add(
    `estivador/base/phase/2`,
    frame(BW, BH, (c) => base(c, { damage: 1, coreOpen: true, coreGlow: 2, bob: 1 })),
  );
  // base/idle2 4 — segunda fase, núcleo exposto
  [0, -1, 0, 1].forEach((bob, i) =>
    add(
      `estivador/base/idle2/${i}`,
      frame(BW, BH, (c) => base(c, { bob, damage: 1, coreOpen: true, coreGlow: i % 2 })),
    ),
  );
  // base/death 8
  for (let i = 0; i < 8; i++) {
    add(
      `estivador/base/death/${i}`,
      frame(BW, BH, (c) => {
        base(c, {
          bob: Math.min(6, i),
          damage: i < 3 ? 1 : 2,
          coreOpen: true,
          coreGlow: i % 2 ? 2 : 1,
          flash: i % 2 === 0 && i < 5,
          tilt: -i,
        });
        // Explosões encadeadas subindo pelo chassi
        const blasts = [
          [60, 96],
          [120, 70],
          [40, 60],
          [140, 110],
          [96, 50],
          [70, 120],
          [150, 60],
          [100, 90],
        ];
        for (let k = 0; k <= i; k++) {
          const [bx, by] = blasts[k];
          const r = Math.max(2, 14 - (i - k) * 3);
          if (r <= 2) continue;
          c.disc(bx, by, r, k % 2 ? 'fx3' : 'fx2');
          c.disc(bx, by, Math.max(1, r - 5), 'fx1');
        }
        if (i >= 5) c.rect(0, 0, 192, 160, 'fx1', 30 * (i - 4));
      }),
    );
  }

  // claw/idle 2, claw/swing 5
  add(
    `estivador/claw/idle/0`,
    frame(CW, CH, (c) => claw(c, { open: 1 })),
  );
  add(
    `estivador/claw/idle/1`,
    frame(CW, CH, (c) => claw(c, { open: 1.2 })),
  );
  [2, 1.5, 0.4, 0, 0.8].forEach((open, i) =>
    add(
      `estivador/claw/swing/${i}`,
      frame(CW, CH, (c) => claw(c, { open, flash: i === 3 })),
    ),
  );

  // core/idle 4 (fechado), core/exposed 4 (pulsando)
  for (let i = 0; i < 4; i++)
    add(
      `estivador/core/idle/${i}`,
      frame(KW, KH, (c) => core(c, { exposed: false })),
    );
  [0, 1, 2, 1].forEach((pulse, i) =>
    add(
      `estivador/core/exposed/${i}`,
      frame(KW, KH, (c) => core(c, { exposed: true, pulse })),
    ),
  );

  return out;
}
