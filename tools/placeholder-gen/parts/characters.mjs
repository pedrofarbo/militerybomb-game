/**
 * PLAYER — Dara Mott (Brigada Redline).
 * Frame 64x64, pés na linha y=58, centro x=32, virado para a DIREITA.
 * O braço de mira é um sprite separado (32x32, pivô no centro = ombro),
 * exatamente como o plano técnico define em §16 — evita explosão combinatória
 * de "locomoção x direção de mira".
 */
import { Canvas } from '../canvas.mjs';

export const PLAYER_FRAME = 64;
export const PLAYER_ARM_FRAME = 32;
/** Onde o braço de mira se acopla, em coordenadas do frame do corpo. */
export const PLAYER_SHOULDER = { x: 34, y: 30 };
/** Ombro AGACHADO — o braço de mira desce junto com o corpo. */
export const PLAYER_SHOULDER_CROUCH = { x: 34, y: 43 };
/** Caixa de colisão lógica dentro do frame (ver docs/ART_SPEC.md). */
export const PLAYER_BODY_BOX = { x: 22, y: 18, w: 20, h: 40 };
/** Caixa agachada: mesma base (pés em 58), topo 16 px mais baixo. */
export const PLAYER_BODY_BOX_CROUCH = { x: 22, y: 34, w: 20, h: 24 };

const SKIN = 'skin3';
const SUIT = 'rust3';
const SUIT_DARK = 'rust2';
const SUIT_LIGHT = 'rust4';
const GEAR = 'con3';
const GEAR_DARK = 'con2';

/**
 * Dara agachada.
 *
 * NÃO é o `trooper` com `bob` alto: agachar precisa LER como agachar já na
 * silhueta, senão o jogador não percebe que o estado mudou.
 *
 * A figura inteira cabe entre y=34 e y=58 — exatamente a caixa de colisão
 * agachada. É essa coincidência que faz a promessa visual bater com a regra:
 * o que passa por cima do desenho passa por cima da hitbox. A primeira versão
 * deixava o capacete 8 px acima da caixa, e na tela isso vira "o tiro
 * atravessou a minha cabeça".
 */
function trooperCrouch(c, o = {}) {
  const { bob = 0 } = o;
  const y = (v) => v + bob;

  // Perna traseira dobrada, joelho no chão
  c.block(24, y(48), 9, 8, GEAR_DARK, { outline: 'ink' });
  c.block(23, y(54), 11, 4, GEAR, { outline: 'ink' });

  // Mochila, agora baixa e para trás
  c.block(20, y(42), 6, 9, GEAR_DARK, { outline: 'ink', top: GEAR });
  c.rect(21, y(44), 4, 2, 'teal3');

  // Perna dianteira: coxa recolhida e canela à frente
  c.block(31, y(46), 8, 7, GEAR, { outline: 'ink', top: 'con4' });
  c.block(31, y(53), 12, 5, GEAR_DARK, { outline: 'ink' });

  // Quadril
  c.block(25, y(45), 13, 6, SUIT_DARK, { outline: 'ink' });

  // Tronco, inclinado para a frente
  c.block(25, y(42), 15, 9, SUIT, { outline: 'ink', top: SUIT_LIGHT });
  c.line(27, y(49), 36, y(44), 'sig3');
  c.rect(26, y(45), 3, 3, 'teal3');
  c.stroke(26, y(45), 3, 3, 'ink');

  // Braço de trás apoiado sobre o joelho
  c.block(24, y(44), 5, 7, SUIT_DARK, { outline: 'ink' });

  // Cabeça e capacete — o TOPO fica em 34, a borda da caixa agachada
  c.rect(31, y(41), 5, 3, SKIN);
  c.block(28, y(37), 11, 7, SKIN, { outline: 'ink' });
  c.block(27, y(34), 13, 6, GEAR, { outline: 'ink', top: 'con4' });
  c.rect(34, y(38), 6, 3, 'teal4');
  c.stroke(34, y(38), 6, 3, 'ink');
  c.rect(27, y(35), 4, 2, 'sig3');
}

function trooper(c, o = {}) {
  const { bob = 0, lean = 0, legs = [0, 0, 0, 0], armStub = 0, dead = false, hurt = false } = o;

  const suit = hurt ? 'rust5' : SUIT;
  const [flx, fly, blx, bly] = legs;
  const hipY = 44 + bob;

  if (dead) return;

  // Perna traseira
  c.block(26 + blx, hipY + bly, 7, 14 - bly, GEAR_DARK, { outline: 'ink' });
  c.block(25 + blx, hipY + 12 + bly, 9, 4, GEAR, { outline: 'ink' });

  // Mochila / equipamento nas costas
  c.block(21 + lean, 26 + bob, 6, 13, GEAR_DARK, { outline: 'ink', top: GEAR });
  c.rect(22 + lean, 29 + bob, 4, 2, 'teal3');

  // Perna dianteira
  c.block(31 + flx, hipY + fly, 7, 14 - fly, GEAR, { outline: 'ink', top: 'con4' });
  c.block(31 + flx, hipY + 12 + fly, 10, 4, GEAR_DARK, { outline: 'ink' });

  // Quadril
  c.block(26 + lean, 40 + bob, 13, 6, SUIT_DARK, { outline: 'ink' });

  // Torso
  c.block(25 + lean, 25 + bob, 15, 16, suit, { outline: 'ink', top: SUIT_LIGHT });
  // Bandoleira / faixa de identificação
  c.line(27 + lean, 39 + bob, 37 + lean, 27 + bob, 'sig3');
  c.rect(26 + lean, 33 + bob, 3, 4, 'teal3');
  c.stroke(26 + lean, 33 + bob, 3, 4, 'ink');

  // Braço de trás (coto — só sugere volume; o de mira é sprite separado)
  c.block(24 + lean, 28 + bob + armStub, 5, 11, SUIT_DARK, { outline: 'ink' });

  // Pescoço + cabeça
  c.rect(30 + lean, 22 + bob, 5, 4, SKIN);
  c.block(27 + lean, 13 + bob, 11, 10, SKIN, { outline: 'ink' });
  // Capacete
  c.block(26 + lean, 11 + bob, 13, 7, GEAR, { outline: 'ink', top: 'con4' });
  c.rect(33 + lean, 15 + bob, 6, 3, 'teal4'); // visor/óculos
  c.stroke(33 + lean, 15 + bob, 6, 3, 'ink');
  c.rect(26 + lean, 12 + bob, 4, 2, 'sig3'); // marca da brigada
}

// Ciclo de corrida: [pernaFrenteX, pernaFrenteY, pernaTrásX, pernaTrásY]
const RUN_LEGS = [
  [5, 0, -5, 0],
  [6, -2, -4, 1],
  [4, -1, -6, 0],
  [1, 0, -3, 0],
  [-5, 0, 5, 0],
  [-4, 1, 6, -2],
  [-6, 0, 4, -1],
  [-3, 0, 1, 0],
];
const RUN_BOB = [0, -1, -1, 0, 0, -1, -1, 0];
const IDLE_BOB = [0, 0, -1, -1, -1, 0];

function frame(draw) {
  const c = new Canvas(PLAYER_FRAME, PLAYER_FRAME);
  draw(c);
  return c;
}

/** Braço de mira: 32x32, ombro no centro (16,16), cano apontando para `angle`. */
function arm(angleDeg, recoil) {
  const c = new Canvas(PLAYER_ARM_FRAME, PLAYER_ARM_FRAME);
  const a = (angleDeg * Math.PI) / 180;
  const cx = 16;
  const cy = 16;
  const back = recoil ? 2 : 0;

  // Antebraço
  for (let t = 1; t <= 7; t++) {
    const x = Math.round(cx + Math.cos(a) * (t - back));
    const y = Math.round(cy + Math.sin(a) * (t - back));
    c.rect(x - 2, y - 2, 4, 4, SUIT);
  }
  // Arma
  for (let t = 7; t <= 14; t++) {
    const x = Math.round(cx + Math.cos(a) * (t - back));
    const y = Math.round(cy + Math.sin(a) * (t - back));
    c.rect(x - 2, y - 2, 4, 4, recoil ? 'met4' : 'met2');
  }
  // Ponta do cano
  const tx = Math.round(cx + Math.cos(a) * (15 - back));
  const ty = Math.round(cy + Math.sin(a) * (15 - back));
  c.rect(tx - 1, ty - 1, 3, 3, recoil ? 'fx2' : 'met3');
  // Ombro
  c.block(cx - 3, cy - 3, 6, 6, SUIT_LIGHT, { outline: 'ink' });
  return c;
}

export function buildCharacterFrames() {
  const out = [];
  const add = (name, canvas) => out.push({ name, canvas });

  // idle — respiração de 6 frames
  IDLE_BOB.forEach((bob, i) =>
    add(
      `dara/idle/${i}`,
      frame((c) => trooper(c, { bob, legs: [1, 0, -1, 0] })),
    ),
  );

  // run — 8 frames
  RUN_LEGS.forEach((legs, i) =>
    add(
      `dara/run/${i}`,
      frame((c) => trooper(c, { bob: RUN_BOB[i], lean: 1, legs, armStub: 1 })),
    ),
  );

  // crouch — 2 frames (respiração curta, para não parecer travado)
  add(
    `dara/crouch/0`,
    frame((c) => trooperCrouch(c, { bob: 0 })),
  );
  add(
    `dara/crouch/1`,
    frame((c) => trooperCrouch(c, { bob: 1 })),
  );

  // jump (subida) — 2 frames
  add(
    `dara/jump/0`,
    frame((c) => trooper(c, { bob: -2, legs: [3, -4, -2, -2] })),
  );
  add(
    `dara/jump/1`,
    frame((c) => trooper(c, { bob: -1, legs: [4, -5, -3, -3] })),
  );

  // fall — 2 frames
  add(
    `dara/fall/0`,
    frame((c) => trooper(c, { bob: 1, legs: [-2, -2, 3, -1] })),
  );
  add(
    `dara/fall/1`,
    frame((c) => trooper(c, { bob: 1, legs: [-3, -1, 4, -2] })),
  );

  // land — 2 frames (agachamento de impacto)
  add(
    `dara/land/0`,
    frame((c) => trooper(c, { bob: 4, legs: [4, 3, -4, 3] })),
  );
  add(
    `dara/land/1`,
    frame((c) => trooper(c, { bob: 2, legs: [2, 1, -2, 1] })),
  );

  // hurt — 2 frames
  add(
    `dara/hurt/0`,
    frame((c) => trooper(c, { bob: 0, lean: -3, legs: [-2, 0, 2, 0], hurt: true })),
  );
  add(
    `dara/hurt/1`,
    frame((c) => trooper(c, { bob: 1, lean: -2, legs: [-3, 1, 3, 0], hurt: true })),
  );

  // death — 6 frames: cai, gira, some em fumaça
  add(
    `dara/death/0`,
    frame((c) => trooper(c, { bob: 2, lean: -4, legs: [-4, 1, 4, 1] })),
  );
  add(
    `dara/death/1`,
    frame((c) => trooper(c, { bob: 6, lean: -6, legs: [-6, 3, 6, 3] })),
  );
  add(
    `dara/death/2`,
    frame((c) => {
      c.block(20, 48, 24, 8, SUIT_DARK, { outline: 'ink' });
      c.block(40, 46, 10, 10, SKIN, { outline: 'ink' });
      c.rect(24, 44, 4, 4, 'smoke3');
    }),
  );
  add(
    `dara/death/3`,
    frame((c) => {
      c.block(20, 50, 24, 6, SUIT_DARK, { outline: 'ink' });
      c.block(41, 48, 9, 8, SKIN, { outline: 'ink' });
      c.rect(22, 42, 6, 6, 'smoke3');
      c.rect(30, 38, 4, 4, 'smoke2');
    }),
  );
  add(
    `dara/death/4`,
    frame((c) => {
      c.block(22, 52, 20, 4, SUIT_DARK, { outline: 'ink' });
      c.rect(20, 40, 8, 8, 'smoke3');
      c.rect(32, 34, 6, 6, 'smoke2');
    }),
  );
  add(
    `dara/death/5`,
    frame((c) => {
      c.rect(24, 54, 16, 2, 'inkSoft');
      c.rect(22, 36, 8, 8, 'smoke2', 160);
      c.rect(34, 30, 6, 6, 'smoke1', 120);
    }),
  );

  // Braços de mira — 5 direções x 2 frames (repouso / recuo)
  const AIM = { down: 90, down45: 45, fwd: 0, up45: -45, up: -90 };
  for (const [dir, deg] of Object.entries(AIM)) {
    add(`dara/arm/${dir}/0`, arm(deg, false));
    add(`dara/arm/${dir}/1`, arm(deg, true));
  }

  return out;
}
