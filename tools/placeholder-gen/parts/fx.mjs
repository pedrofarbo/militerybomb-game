/**
 * FX e projéteis.
 * Todos os FX radiais são desenhados centrados no frame — o `FxService`
 * assume origem (0.5, 0.5) para tudo aqui, exceto muzzle (origem 0, 0.5,
 * ancorado na boca do cano) e projéteis (origem 0.5, 0.5, apontando +X).
 */
import { Canvas } from '../canvas.mjs';
import { mulberry32 } from '../palette.mjs';

function frame(w, h, draw) {
  const c = new Canvas(w, h);
  draw(c);
  return c;
}

/** Bola de fogo em 3 camadas — leitura instantânea mesmo em 640x360. */
function blast(c, cx, cy, r, t) {
  if (r <= 0) return;
  const fade = t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.35) : 1;
  c.disc(cx, cy, r, 'fx4', Math.round(200 * fade));
  c.disc(cx, cy, Math.max(1, Math.round(r * 0.72)), 'fx3', Math.round(230 * fade));
  c.disc(cx, cy, Math.max(1, Math.round(r * 0.42)), 'fx2', Math.round(250 * fade));
  if (t < 0.5) c.disc(cx, cy, Math.max(1, Math.round(r * 0.2)), 'fx1');
}

function explosion(size, frames, seed) {
  const out = [];
  const rnd = mulberry32(seed);
  const chunks = Array.from({ length: 9 }, () => ({
    a: rnd() * Math.PI * 2,
    d: 0.35 + rnd() * 0.6,
    s: 2 + Math.floor(rnd() * 3),
  }));
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1);
    out.push(
      frame(size, size, (c) => {
        const cx = size / 2;
        const cy = size / 2;
        const grow = t < 0.35 ? t / 0.35 : 1;
        const r = Math.round((size / 2 - 2) * (0.35 + 0.65 * grow) * (1 - t * 0.25));
        // Fumaça que sobrevive à bola de fogo
        if (t > 0.3)
          c.disc(cx, cy - Math.round(t * size * 0.12), Math.round(r * 1.1), 'smoke2',
            Math.round(120 * (t - 0.3)));
        blast(c, cx, cy, r, t);
        // Estilhaços projetados
        for (const ch of chunks) {
          const dist = t * ch.d * (size / 2);
          const x = Math.round(cx + Math.cos(ch.a) * dist);
          const y = Math.round(cy + Math.sin(ch.a) * dist);
          const alpha = Math.round(255 * Math.max(0, 1 - t));
          if (alpha > 0) c.rect(x, y, ch.s, ch.s, t > 0.5 ? 'smoke3' : 'fx2', alpha);
        }
      }),
    );
  }
  return out;
}

export function buildFxFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });

  /* Muzzle flash — origem (0, 0.5), aponta para +X. 3 tamanhos x 3 frames. */
  const muzzles = [
    ['small', 24, 4],
    ['medium', 32, 6],
    ['large', 48, 9],
  ];
  for (const [key, size, base] of muzzles) {
    for (let i = 0; i < 3; i++) {
      const k = [1, 0.7, 0.35][i];
      add(
        `muzzle/${key}/${i}`,
        frame(size, size, (c) => {
          const cy = size / 2;
          const len = Math.round(size * 0.55 * k);
          const r = Math.round(base * k);
          c.disc(2, cy, r, 'fx3');
          c.disc(2, cy, Math.max(1, r - 2), 'fx2');
          c.disc(2, cy, Math.max(1, r - 4), 'fx1');
          // Língua de fogo
          for (let x = 0; x < len; x++) {
            const hh = Math.max(1, Math.round(r * (1 - x / len)));
            c.rect(2 + x, cy - hh, 1, hh * 2, x < len * 0.4 ? 'fx1' : 'fx2');
          }
          // Fagulhas laterais
          if (i === 0) {
            c.rect(2 + len, cy - r - 2, 3, 2, 'fx2');
            c.rect(2 + len, cy + r, 3, 2, 'fx2');
          }
        }),
      );
    }
  }

  /* Impactos — 24x24, 4 frames cada, centrados. */
  const impacts = [
    ['metal', ['fx1', 'fx2', 'met5', 'met4']],
    ['concrete', ['con5', 'con4', 'smoke3', 'smoke2']],
    ['armor', ['teal5', 'teal4', 'met4', 'met3']],
  ];
  for (const [key, cols] of impacts) {
    for (let i = 0; i < 4; i++) {
      add(
        `impact/${key}/${i}`,
        frame(24, 24, (c) => {
          const spread = 3 + i * 4;
          const alpha = Math.round(255 * (1 - i / 4.5));
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + i * 0.2;
            const x = Math.round(12 + Math.cos(a) * spread);
            const y = Math.round(12 + Math.sin(a) * spread);
            c.rect(x - 1, y - 1, 2, 2, cols[Math.min(3, i)], alpha);
          }
          if (i < 2) c.disc(12, 12, 4 - i * 2, cols[0]);
        }),
      );
    }
  }

  /* Poeira de aterrissagem — 32x32, 5 frames. */
  for (let i = 0; i < 5; i++) {
    add(
      `dust/land/${i}`,
      frame(32, 32, (c) => {
        const alpha = Math.round(200 * (1 - i / 5));
        const spread = 4 + i * 5;
        for (const s of [-1, 1]) {
          const x = 16 + s * spread;
          const y = 26 - i * 2;
          c.disc(x, y, Math.max(1, 5 - i), 'smoke4', alpha);
          c.disc(x, y, Math.max(1, 3 - i), 'con5', alpha);
        }
        if (i < 3) c.rect(12, 27, 8, 2, 'smoke4', alpha);
      }),
    );
  }

  /* Rastro de corrida — 16x16, 4 frames. */
  for (let i = 0; i < 4; i++) {
    add(
      `dust/run/${i}`,
      frame(16, 16, (c) => {
        const alpha = Math.round(170 * (1 - i / 4));
        c.disc(8, 12 - i, Math.max(1, 4 - i), 'smoke4', alpha);
        c.rect(4 + i, 13, 4, 2, 'con5', alpha);
      }),
    );
  }

  /* Fumaça persistente — 32x32, 6 frames. */
  for (let i = 0; i < 6; i++) {
    add(
      `smoke/puff/${i}`,
      frame(32, 32, (c) => {
        const alpha = Math.round(190 * (1 - i / 6));
        const r = 4 + i * 2;
        const y = 22 - i * 3;
        c.disc(16, y, r, 'smoke2', alpha);
        c.disc(13, y - 2, Math.max(1, r - 3), 'smoke3', alpha);
        c.disc(19, y + 1, Math.max(1, r - 4), 'smoke1', alpha);
      }),
    );
  }

  /* Explosões — 3 tamanhos. */
  explosion(48, 7, 1001).forEach((cv, i) => add(`explosion/small/${i}`, cv));
  explosion(80, 8, 2002).forEach((cv, i) => add(`explosion/medium/${i}`, cv));
  explosion(128, 9, 3003).forEach((cv, i) => add(`explosion/large/${i}`, cv));

  /* Faíscas e destroços — partículas soltas. */
  for (let i = 0; i < 4; i++)
    add(
      `spark/${i}`,
      frame(8, 8, (c) => {
        c.rect(3, 3, 2, 2, i < 2 ? 'fx1' : 'fx2');
        if (i < 2) c.rect(2, 3, 1, 2, 'fx3');
      }),
    );
  const rnd = mulberry32(777);
  for (let i = 0; i < 6; i++)
    add(
      `debris/${i}`,
      frame(8, 8, (c) => {
        const w = 2 + Math.floor(rnd() * 3);
        const h = 2 + Math.floor(rnd() * 3);
        const col = ['met2', 'met3', 'con3', 'con2', 'hal3', 'rust2'][i];
        c.block(2, 2, w + 1, h + 1, col, { outline: 'ink' });
      }),
    );

  /* Projéteis — apontam para +X, origem central. */
  add(
    `bullet/player/0`,
    frame(12, 6, (c) => {
      c.rect(6, 2, 5, 2, 'fx2');
      c.rect(2, 2, 5, 2, 'fx1');
      c.rect(0, 3, 3, 1, 'fx3', 160);
    }),
  );
  add(
    `bullet/pellet/0`,
    frame(8, 4, (c) => {
      c.rect(3, 1, 4, 2, 'fx2');
      c.rect(1, 1, 2, 2, 'fx1');
    }),
  );
  add(
    `bullet/enemy/0`,
    frame(10, 6, (c) => {
      c.rect(4, 2, 5, 2, 'haz');
      c.rect(1, 2, 4, 2, 'hazDark');
    }),
  );
  add(
    `bullet/heavy/0`,
    frame(14, 6, (c) => {
      c.rect(6, 1, 7, 4, 'haz');
      c.rect(2, 2, 5, 2, 'sig3');
    }),
  );
  for (let i = 0; i < 2; i++)
    add(
      `rocket/${i}`,
      frame(20, 10, (c) => {
        c.block(8, 3, 11, 5, 'met3', { outline: 'ink' });
        c.rect(16, 4, 3, 3, 'haz');
        c.rect(8, 2, 4, 7, 'met1');
        c.rect(3 - i, 4, 6, 3, i ? 'fx2' : 'fx3');
        c.rect(0, 5, 4, 1, 'fx1', 180);
      }),
    );
  for (let i = 0; i < 4; i++)
    add(
      `grenade/${i}`,
      frame(14, 14, (c) => {
        const r = 4;
        c.disc(7, 7, r + 1, 'ink');
        c.disc(7, 7, r, 'teal2');
        const a = (i / 4) * Math.PI * 2;
        c.rect(Math.round(7 + Math.cos(a) * 3) - 1, Math.round(7 + Math.sin(a) * 3) - 1, 3, 3, 'sig3');
        c.rect(6, 1, 2, 3, 'met3');
      }),
    );

  /* Marcadores de mundo. */
  for (let i = 0; i < 4; i++)
    add(
      `marker/checkpoint/${i}`,
      frame(24, 24, (c) => {
        const r = 6 + i * 3;
        c.ring(12, 12, r, 2, 'sig3', Math.round(220 * (1 - i / 4.5)));
      }),
    );

  return out;
}
