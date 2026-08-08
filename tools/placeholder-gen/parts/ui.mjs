/**
 * UI — HUD e controles touch.
 * O HUD é DOM (plano §19), então estes assets existem para serem usados como
 * `background-image` em CSS e como ícones. Ficam num atlas para que o Phaser
 * também possa usá-los quando um elemento precisar viver no mundo.
 * Todos os alvos de toque saem em 128px para permanecerem nítidos em DPR 2.
 */
import { Canvas } from '../canvas.mjs';

function frame(w, h, draw) {
  const c = new Canvas(w, h);
  draw(c);
  return c;
}

export function buildUiFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });

  // Segmento de vida 14x18 — cheio / vazio / crítico
  const seg = (fill, top) =>
    frame(14, 18, (c) => {
      c.chamfer(0, 0, 14, 18, fill, 'ink', 3);
      c.rect(3, 2, 8, 2, top);
    });
  add('hud/health/full', seg('haz', 'fx2'));
  add('hud/health/empty', seg('con1', 'con2'));
  add('hud/health/critical', seg('fx2', 'fx1'));

  // Ícones de arma 28x20
  const wIcon = (draw) => frame(28, 20, draw);
  add(
    'hud/weapon/pistol',
    wIcon((c) => {
      c.block(4, 6, 14, 6, 'met3', { outline: 'ink' });
      c.block(6, 11, 6, 7, 'met2', { outline: 'ink' });
      c.rect(17, 8, 7, 2, 'met4');
    }),
  );
  add(
    'hud/weapon/machinegun',
    wIcon((c) => {
      c.block(2, 6, 20, 6, 'met3', { outline: 'ink' });
      c.block(6, 11, 5, 7, 'met2', { outline: 'ink' });
      c.block(12, 11, 8, 5, 'teal3', { outline: 'ink' });
      c.rect(21, 7, 6, 3, 'met4');
    }),
  );
  add(
    'hud/weapon/shotgun',
    wIcon((c) => {
      c.block(2, 5, 22, 5, 'rust3', { outline: 'ink' });
      c.rect(4, 10, 16, 3, 'met2');
      c.block(5, 12, 6, 6, 'rust2', { outline: 'ink' });
      c.rect(23, 6, 4, 3, 'met4');
    }),
  );
  add(
    'hud/icon/grenade',
    frame(20, 20, (c) => {
      c.disc(10, 12, 6, 'teal2');
      c.ring(10, 12, 6, 1, 'ink');
      c.rect(9, 3, 3, 4, 'met3');
      c.rect(7, 10, 6, 2, 'sig3');
    }),
  );

  // Barra de boss — 3 fatias esticáveis
  add(
    'hud/bossbar/left',
    frame(8, 14, (c) => {
      c.block(0, 0, 8, 14, 'con1', { outline: 'ink' });
      c.rect(2, 2, 4, 10, 'hazDark');
    }),
  );
  add(
    'hud/bossbar/mid',
    frame(8, 14, (c) => {
      c.rect(0, 0, 8, 14, 'con1');
      c.rect(0, 0, 8, 1, 'ink');
      c.rect(0, 13, 8, 1, 'ink');
      c.rect(0, 2, 8, 10, 'hazDark');
    }),
  );
  add(
    'hud/bossbar/right',
    frame(8, 14, (c) => {
      c.block(0, 0, 8, 14, 'con1', { outline: 'ink' });
      c.rect(2, 2, 4, 10, 'hazDark');
    }),
  );
  add(
    'hud/bossbar/fill',
    frame(8, 10, (c) => {
      c.rect(0, 0, 8, 10, 'haz');
      c.rect(0, 0, 8, 2, 'fx3');
    }),
  );

  // Botão de pause 24x24
  add(
    'hud/button/pause',
    frame(24, 24, (c) => {
      c.chamfer(0, 0, 24, 24, 'con1', 'ink', 4);
      c.rect(8, 6, 3, 12, 'met5');
      c.rect(14, 6, 3, 12, 'met5');
    }),
  );

  /* ── Controles touch (128px, escalados por CSS) ── */
  add(
    'touch/stick/base',
    frame(128, 128, (c) => {
      c.ring(64, 64, 62, 4, 'con5', 120);
      c.ring(64, 64, 44, 2, 'con4', 80);
      c.disc(64, 64, 40, 'con2', 45);
    }),
  );
  add(
    'touch/stick/knob',
    frame(72, 72, (c) => {
      c.disc(36, 36, 34, 'con4', 170);
      c.disc(36, 36, 28, 'con5', 200);
      c.ring(36, 36, 34, 3, 'white', 120);
    }),
  );

  const button = (label, tint, pressed) =>
    frame(128, 128, (c) => {
      const a = pressed ? 235 : 165;
      c.disc(64, 64, 60, 'ink', pressed ? 130 : 90);
      c.ring(64, 64, 60, 4, tint, a);
      c.disc(64, 64, 52, tint, pressed ? 110 : 45);
      label(c, pressed);
    });

  add(
    'touch/btn/jump/up',
    button(
      (c) => {
        c.line(64, 40, 46, 66, 'white');
        c.line(64, 40, 82, 66, 'white');
        c.rect(58, 40, 12, 46, 'white');
      },
      'teal5',
      false,
    ),
  );
  add(
    'touch/btn/jump/down',
    button(
      (c) => {
        c.line(64, 40, 46, 66, 'white');
        c.line(64, 40, 82, 66, 'white');
        c.rect(58, 40, 12, 46, 'white');
      },
      'teal5',
      true,
    ),
  );
  add(
    'touch/btn/shoot/up',
    button(
      (c) => {
        c.ring(64, 64, 30, 4, 'white');
        c.rect(62, 26, 4, 16, 'white');
        c.rect(62, 86, 4, 16, 'white');
        c.rect(26, 62, 16, 4, 'white');
        c.rect(86, 62, 16, 4, 'white');
        c.disc(64, 64, 5, 'white');
      },
      'fx3',
      false,
    ),
  );
  add(
    'touch/btn/shoot/down',
    button(
      (c) => {
        c.ring(64, 64, 30, 4, 'white');
        c.disc(64, 64, 10, 'white');
      },
      'fx3',
      true,
    ),
  );
  add(
    'touch/btn/grenade/up',
    button(
      (c) => {
        c.disc(64, 70, 24, 'white');
        c.rect(60, 34, 8, 16, 'white');
      },
      'sig3',
      false,
    ),
  );
  add(
    'touch/btn/grenade/down',
    button(
      (c) => {
        c.disc(64, 70, 24, 'white');
        c.rect(60, 34, 8, 16, 'white');
      },
      'sig3',
      true,
    ),
  );
  add(
    'touch/btn/special/up',
    button(
      (c) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const x = Math.round(64 + Math.cos(a) * 26);
          const y = Math.round(64 + Math.sin(a) * 26);
          c.disc(x, y, 6, 'white');
        }
      },
      'rust5',
      false,
    ),
  );
  add(
    'touch/btn/special/down',
    button(
      (c) => {
        c.disc(64, 64, 26, 'white');
      },
      'rust5',
      true,
    ),
  );

  return out;
}
