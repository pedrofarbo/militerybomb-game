/**
 * INIMIGOS — Consórcio Halcyon.
 *  - Soldado      48x48, pés em y=44
 *  - Soldado Pesado 64x64, pés em y=60
 *  - Torreta      48x48, base em y=46
 * Silhuetas deliberadamente distintas: o jogador precisa identificar a ameaça
 * em ~100 ms, então cada tipo tem uma proporção e um acento de cor próprios.
 */
import { Canvas } from '../canvas.mjs';

export const ENEMY_FRAMES = { soldier: 48, heavy: 64, turret: 48 };

const HULL = 'hal3';
const HULL_DARK = 'hal2';
const HULL_LIGHT = 'hal4';

function frame(size, draw) {
  const c = new Canvas(size, size);
  draw(c);
  return c;
}

/* ─────────────────────────── Soldado ─────────────────────────── */

function soldier(c, o = {}) {
  const { bob = 0, legs = [0, 0, 0, 0], armFwd = 0, flash = false, lean = 0 } = o;
  const hull = flash ? 'met5' : HULL;
  const [flx, fly, blx, bly] = legs;
  const hipY = 32 + bob;

  c.block(19 + blx, hipY + bly, 6, 12 - bly, HULL_DARK, { outline: 'ink' });
  c.block(23 + flx, hipY + fly, 6, 12 - fly, hull, { outline: 'ink', top: HULL_LIGHT });
  c.block(19 + lean, 29 + bob, 11, 5, HULL_DARK, { outline: 'ink' });
  c.block(18 + lean, 17 + bob, 13, 13, hull, { outline: 'ink', top: HULL_LIGHT });
  c.rect(20 + lean, 21 + bob, 3, 3, 'haz'); // núcleo/indicador
  c.block(20 + lean, 8 + bob, 10, 10, hull, { outline: 'ink', top: HULL_LIGHT });
  c.rect(26 + lean, 12 + bob, 4, 3, 'haz'); // visor
  // Arma
  c.block(28 + lean + armFwd, 20 + bob, 12, 4, 'met2', { outline: 'ink' });
  if (flash) c.rect(40 + lean + armFwd, 20 + bob, 3, 4, 'fx2');
}

/* ─────────────────────── Soldado Pesado ──────────────────────── */

function heavy(c, o = {}) {
  const { bob = 0, legs = [0, 0], flash = false, spin = 0, lean = 0 } = o;
  const hull = flash ? 'met5' : HULL;
  const hipY = 42 + bob;

  c.block(20 + legs[0], hipY, 10, 18, HULL_DARK, { outline: 'ink' });
  c.block(32 + legs[1], hipY, 10, 18, hull, { outline: 'ink', top: HULL_LIGHT });
  c.block(18 + lean, 36 + bob, 26, 8, HULL_DARK, { outline: 'ink' });
  // Torso largo com placa
  c.block(16 + lean, 16 + bob, 30, 22, hull, { outline: 'ink', top: HULL_LIGHT });
  c.block(20 + lean, 22 + bob, 10, 10, HULL_DARK, { outline: 'ink' });
  c.rect(22 + lean, 24 + bob, 6, 6, 'haz');
  // Cabeça baixa entre os ombros
  c.block(26 + lean, 8 + bob, 12, 9, HULL_DARK, { outline: 'ink' });
  c.rect(33 + lean, 11 + bob, 5, 3, 'haz');
  // Metralhadora pesada de canos rotativos
  c.block(42 + lean, 20 + bob, 18, 10, 'met1', { outline: 'ink' });
  for (let i = 0; i < 3; i++) {
    const y = 21 + bob + ((i * 3 + spin) % 8);
    c.rect(56 + lean, y, 6, 2, 'met3');
  }
  if (flash) {
    c.rect(60 + lean, 23 + bob, 4, 5, 'fx2');
    c.rect(58 + lean, 24 + bob, 3, 3, 'fx1');
  }
}

/* ───────────────────────────  Torreta  ───────────────────────── */

function turret(c, o = {}) {
  const { barrelDeg = 0, flash = false, broken = false, coreOn = true } = o;
  // Base fixa (ponto fraco = a base)
  c.block(14, 34, 20, 12, broken ? 'con2' : 'con3', { outline: 'ink', top: 'con4' });
  c.rect(16, 36, 16, 2, 'sig2');
  c.block(18, 28, 12, 8, HULL_DARK, { outline: 'ink' });
  if (!broken) {
    // Cúpula
    c.disc(24, 26, 9, HULL);
    c.ring(24, 26, 9, 1, 'ink');
    if (coreOn) c.disc(24, 26, 3, flash ? 'fx1' : 'haz');
    // Cano
    const a = (barrelDeg * Math.PI) / 180;
    for (let t = 6; t <= 18; t++) {
      const x = Math.round(24 + Math.cos(a) * t);
      const y = Math.round(26 + Math.sin(a) * t);
      c.rect(x - 2, y - 2, 4, 4, 'met2');
    }
    if (flash) {
      const x = Math.round(24 + Math.cos(a) * 20);
      const y = Math.round(26 + Math.sin(a) * 20);
      c.disc(x, y, 4, 'fx2');
      c.disc(x, y, 2, 'fx1');
    }
  } else {
    c.block(17, 22, 14, 8, 'smoke2', { outline: 'ink' });
    c.rect(20, 18, 4, 4, 'smoke3');
  }
}

export function buildEnemyFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });
  const S = ENEMY_FRAMES.soldier;
  const H = ENEMY_FRAMES.heavy;
  const T = ENEMY_FRAMES.turret;

  /* Soldado: idle 4, walk 6, attack 4, hurt 2, death 5 */
  [0, 0, -1, -1].forEach((bob, i) =>
    add(`soldier/idle/${i}`, frame(S, (c) => soldier(c, { bob, legs: [1, 0, -1, 0] }))),
  );
  const WALK = [
    [4, 0, -4, 0],
    [5, -1, -3, 1],
    [2, 0, -5, 0],
    [-4, 0, 4, 0],
    [-3, 1, 5, -1],
    [-5, 0, 2, 0],
  ];
  WALK.forEach((legs, i) =>
    add(
      `soldier/walk/${i}`,
      frame(S, (c) => soldier(c, { bob: i % 3 === 1 ? -1 : 0, legs, lean: 1 })),
    ),
  );
  [
    { armFwd: 0 },
    { armFwd: -2, flash: true },
    { armFwd: -1, flash: true },
    { armFwd: 0 },
  ].forEach((o, i) =>
    add(`soldier/attack/${i}`, frame(S, (c) => soldier(c, { ...o, legs: [2, 0, -2, 0] }))),
  );
  add(`soldier/hurt/0`, frame(S, (c) => soldier(c, { lean: -3, flash: true, legs: [-2, 0, 2, 0] })));
  add(`soldier/hurt/1`, frame(S, (c) => soldier(c, { lean: -2, bob: 1, legs: [-3, 1, 3, 0] })));
  add(`soldier/death/0`, frame(S, (c) => soldier(c, { lean: -4, bob: 2, legs: [-4, 1, 4, 1] })));
  add(`soldier/death/1`, frame(S, (c) => soldier(c, { lean: -6, bob: 6, legs: [-6, 4, 6, 4] })));
  add(
    `soldier/death/2`,
    frame(S, (c) => {
      c.block(12, 36, 22, 8, HULL_DARK, { outline: 'ink' });
      c.block(30, 34, 9, 9, HULL, { outline: 'ink' });
      c.rect(16, 32, 5, 5, 'smoke3');
    }),
  );
  add(
    `soldier/death/3`,
    frame(S, (c) => {
      c.block(13, 39, 20, 5, HULL_DARK, { outline: 'ink' });
      c.rect(14, 30, 7, 7, 'smoke3');
      c.rect(24, 26, 5, 5, 'smoke2');
    }),
  );
  add(
    `soldier/death/4`,
    frame(S, (c) => {
      c.rect(16, 41, 16, 3, 'inkSoft');
      c.rect(15, 28, 7, 7, 'smoke2', 150);
      c.rect(26, 22, 5, 5, 'smoke1', 110);
    }),
  );

  /* Pesado: idle 4, walk 6, attack 5, hurt 2, death 6 */
  [0, -1, 0, 1].forEach((bob, i) =>
    add(`heavy/idle/${i}`, frame(H, (c) => heavy(c, { bob, legs: [0, 0], spin: 0 }))),
  );
  [
    [0, 2],
    [1, 3],
    [2, 1],
    [2, 0],
    [1, -1],
    [0, 1],
  ].forEach((legs, i) =>
    add(`heavy/walk/${i}`, frame(H, (c) => heavy(c, { bob: i % 2, legs, spin: i }))),
  );
  for (let i = 0; i < 5; i++)
    add(
      `heavy/attack/${i}`,
      frame(H, (c) => heavy(c, { bob: i % 2, spin: i * 2, flash: i > 0, lean: i > 0 ? -1 : 0 })),
    );
  add(`heavy/hurt/0`, frame(H, (c) => heavy(c, { flash: true, lean: -3 })));
  add(`heavy/hurt/1`, frame(H, (c) => heavy(c, { bob: 1, lean: -2 })));
  for (let i = 0; i < 3; i++)
    add(`heavy/death/${i}`, frame(H, (c) => heavy(c, { bob: 2 + i * 3, lean: -3 - i * 2 })));
  add(
    `heavy/death/3`,
    frame(H, (c) => {
      c.block(12, 44, 34, 14, HULL_DARK, { outline: 'ink' });
      c.rect(20, 38, 8, 8, 'smoke3');
      c.rect(34, 34, 6, 6, 'fx3');
    }),
  );
  add(
    `heavy/death/4`,
    frame(H, (c) => {
      c.block(14, 48, 32, 10, HULL_DARK, { outline: 'ink' });
      c.rect(18, 34, 10, 10, 'smoke3', 200);
      c.rect(34, 30, 8, 8, 'smoke2', 180);
    }),
  );
  add(
    `heavy/death/5`,
    frame(H, (c) => {
      c.rect(16, 54, 30, 4, 'inkSoft');
      c.rect(20, 30, 10, 10, 'smoke2', 140);
      c.rect(36, 26, 8, 8, 'smoke1', 100);
    }),
  );

  /* Torreta: idle 2, attack 4, hurt 2, death 4 */
  add(`turret/idle/0`, frame(T, (c) => turret(c, { barrelDeg: -10 })));
  add(`turret/idle/1`, frame(T, (c) => turret(c, { barrelDeg: -10, coreOn: false })));
  [-20, -10, 0, -10].forEach((barrelDeg, i) =>
    add(`turret/attack/${i}`, frame(T, (c) => turret(c, { barrelDeg, flash: i === 1 || i === 2 }))),
  );
  add(`turret/hurt/0`, frame(T, (c) => turret(c, { barrelDeg: -10, flash: true })));
  add(`turret/hurt/1`, frame(T, (c) => turret(c, { barrelDeg: -6, coreOn: false })));
  add(`turret/death/0`, frame(T, (c) => turret(c, { barrelDeg: 10, flash: true })));
  add(`turret/death/1`, frame(T, (c) => turret(c, { barrelDeg: 25, coreOn: false })));
  add(`turret/death/2`, frame(T, (c) => turret(c, { broken: true })));
  add(
    `turret/death/3`,
    frame(T, (c) => {
      turret(c, { broken: true });
      c.rect(16, 14, 8, 8, 'smoke2', 170);
      c.rect(26, 10, 6, 6, 'smoke1', 120);
    }),
  );

  return out;
}
