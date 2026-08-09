import { describe, expect, it } from 'vitest';
import { PLAYER } from '../../src/core/config/tuning';
import { createPlayerState, Locomotion } from '../../src/core/player/player-state';
import { ART_METRICS } from '../../src/assets/manifest';
import {
  createMovementResult,
  stepMovement,
  type MovementInput,
} from '../../src/core/player/movement';

const STEP = 1000 / 60;

function makeInput(partial: Partial<MovementInput> = {}): MovementInput {
  return {
    axisX: 0,
    jumpHeld: false,
    jumpPressed: false,
    crouchHeld: false,
    canStandUp: true,
    ...partial,
  };
}

/** Simula N passos, mantendo o player no chão a menos que ele pule. */
function run(
  state: ReturnType<typeof createPlayerState>,
  input: MovementInput,
  steps: number,
  keepGrounded = true,
): void {
  const out = createMovementResult();
  for (let i = 0; i < steps; i++) {
    if (keepGrounded && state.vy >= 0) state.grounded = true;
    stepMovement(state, input, STEP, out);
    if (state.vy < 0) state.grounded = false;
  }
}

describe('movimento — horizontal', () => {
  it('atinge a velocidade máxima em ~0,09 s (responsividade acima de realismo)', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    run(s, makeInput({ axisX: 1 }), 6); // 100 ms
    expect(s.vx).toBe(PLAYER.maxSpeed);
  });

  it('para rápido ao soltar o direcional', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    run(s, makeInput({ axisX: 1 }), 10);
    run(s, makeInput(), 5); // ~83 ms
    expect(s.vx).toBe(0);
  });

  it('respeita eixo analógico parcial', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    run(s, makeInput({ axisX: 0.5 }), 20);
    expect(s.vx).toBeCloseTo(PLAYER.maxSpeed * 0.5, 1);
  });

  it('vira a face e sinaliza a virada apenas uma vez', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    const out = createMovementResult();

    stepMovement(s, makeInput({ axisX: -1 }), STEP, out);
    expect(s.facing).toBe(-1);
    expect(out.turned).toBe(true);

    stepMovement(s, makeInput({ axisX: -1 }), STEP, out);
    expect(out.turned).toBe(false);
  });

  it('zera a velocidade contra uma parede em vez de acelerar no vazio', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    s.blockedSide = 1;
    run(s, makeInput({ axisX: 1 }), 10);
    expect(s.vx).toBe(0);
  });
});

describe('movimento — pulo', () => {
  it('pula do chão com a velocidade configurada', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    const out = createMovementResult();
    stepMovement(
      s,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );
    expect(out.jumped).toBe(true);
    expect(s.vy).toBeLessThan(0);
  });

  it('coyote time permite pular logo após sair da plataforma', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    stepMovement(s, makeInput(), STEP, createMovementResult());

    s.grounded = false;
    const out = createMovementResult();
    // 50 ms no ar — dentro da janela de 100 ms
    for (let i = 0; i < 3; i++) stepMovement(s, makeInput(), STEP, out);
    stepMovement(
      s,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );

    expect(out.jumped).toBe(true);
  });

  it('coyote time expira', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    stepMovement(s, makeInput(), STEP, createMovementResult());

    s.grounded = false;
    const out = createMovementResult();
    for (let i = 0; i < 12; i++) stepMovement(s, makeInput(), STEP, out); // 200 ms
    stepMovement(
      s,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );

    expect(out.jumped).toBe(false);
  });

  it('jump buffer aproveita o pulo apertado antes de tocar o chão', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = false;
    const out = createMovementResult();

    // Aperta no ar, 50 ms antes de aterrissar
    stepMovement(
      s,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );
    expect(out.jumped).toBe(false);

    for (let i = 0; i < 2; i++) stepMovement(s, makeInput({ jumpHeld: true }), STEP, out);
    s.grounded = true;
    stepMovement(s, makeInput({ jumpHeld: true }), STEP, out);

    expect(out.jumped).toBe(true);
  });

  it('soltar o botão na subida encurta o pulo (altura variável)', () => {
    const short = createPlayerState(PLAYER.maxHealth);
    const tall = createPlayerState(PLAYER.maxHealth);
    short.grounded = true;
    tall.grounded = true;
    const out = createMovementResult();

    stepMovement(
      short,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );
    stepMovement(
      tall,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );

    short.grounded = false;
    tall.grounded = false;
    stepMovement(short, makeInput({ jumpHeld: false }), STEP, out);
    stepMovement(tall, makeInput({ jumpHeld: true }), STEP, out);

    expect(Math.abs(short.vy)).toBeLessThan(Math.abs(tall.vy));
  });

  it('cai mais rápido do que sobe (gravidade assimétrica)', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = false;
    // Botão segurado: isola a gravidade do corte de pulo, que também altera vy.
    const held = makeInput({ jumpHeld: true });

    s.vy = -100;
    stepMovement(s, held, STEP, createMovementResult());
    const rising = s.vy - -100;

    s.vy = 100;
    stepMovement(s, held, STEP, createMovementResult());
    const falling = s.vy - 100;

    expect(falling).toBeGreaterThan(rising);
  });

  it('respeita a velocidade terminal de queda', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = false;
    run(s, makeInput(), 300, false);
    expect(s.vy).toBe(PLAYER.maxFallSpeed);
  });

  it('não permite pular de novo segurando o botão no ar', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    const out = createMovementResult();
    stepMovement(
      s,
      makeInput({ jumpHeld: true, jumpPressed: true, crouchHeld: false, canStandUp: true }),
      STEP,
      out,
    );
    s.grounded = false;

    let extra = 0;
    for (let i = 0; i < 30; i++) {
      stepMovement(s, makeInput({ jumpHeld: true }), STEP, out);
      if (out.jumped) extra++;
    }
    expect(extra).toBe(0);
  });
});

describe('movimento — estados', () => {
  it('deriva a locomoção do movimento, sem flags externas', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    // Já em pé: sem isto o primeiro passo conta como aterrissagem (e conta
    // mesmo — é o que dispara a poeira de respawn).
    s.wasGrounded = true;

    stepMovement(s, makeInput(), STEP, createMovementResult());
    expect(s.locomotion).toBe(Locomotion.Idle);

    run(s, makeInput({ axisX: 1 }), 5);
    expect(s.locomotion).toBe(Locomotion.Run);

    s.grounded = false;
    s.vy = -200;
    stepMovement(s, makeInput({ axisX: 1 }), STEP, createMovementResult());
    expect(s.locomotion).toBe(Locomotion.JumpRise);

    s.vy = 200;
    stepMovement(s, makeInput({ axisX: 1 }), STEP, createMovementResult());
    expect(s.locomotion).toBe(Locomotion.Fall);
  });

  it('sinaliza a aterrissagem com a velocidade do impacto', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = false;
    s.wasGrounded = false;
    s.vy = 400;

    const out = createMovementResult();
    s.grounded = true;
    stepMovement(s, makeInput(), STEP, out);

    expect(out.landed).toBe(true);
    expect(out.landingSpeed).toBe(400);
    expect(s.locomotion).toBe(Locomotion.Land);
  });

  it('atordoamento por dano remove o controle sem congelar a física', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.grounded = true;
    s.vx = 150;
    s.hurtMs = PLAYER.hurtMs;

    stepMovement(s, makeInput({ axisX: 1 }), STEP, createMovementResult());

    expect(s.locomotion).toBe(Locomotion.Hurt);
    expect(s.vx).toBeLessThan(150);
  });

  it('morto ignora input mas continua caindo', () => {
    const s = createPlayerState(PLAYER.maxHealth);
    s.dead = true;
    s.grounded = false;
    const before = s.vy;

    stepMovement(
      s,
      makeInput({
        axisX: 1,
        jumpHeld: true,
        jumpPressed: true,
        crouchHeld: false,
        canStandUp: true,
      }),
      STEP,
      createMovementResult(),
    );

    expect(s.locomotion).toBe('DEAD');
    expect(s.vy).toBeGreaterThan(before);
    expect(s.vx).toBe(0);
  });
});

describe('agachar', () => {
  it('↓ no chão agacha; soltar levanta', () => {
    const state = createPlayerState(6);
    state.grounded = true;

    run(state, makeInput({ crouchHeld: true }), 4);
    expect(state.crouching).toBe(true);
    expect(state.locomotion).toBe('CROUCH');

    // Passa do tempo mínimo antes de soltar, senão ele segura o agachamento.
    run(state, makeInput({ crouchHeld: true }), 8);
    run(state, makeInput({ crouchHeld: false }), 4);
    expect(state.crouching).toBe(false);
  });

  /**
   * A REGRA que dá sentido a agachar: ele CUSTA mobilidade. Um agachamento que
   * também deixa correr não é escolha, é upgrade — e o jogador passaria a fase
   * inteira abaixado.
   */
  it('agachado não anda, mesmo com o direcional no talo', () => {
    const state = createPlayerState(6);
    state.grounded = true;

    run(state, makeInput({ axisX: 1, crouchHeld: true }), 30);

    expect(state.crouching).toBe(true);
    expect(state.vx).toBe(0);
  });

  it('não agacha no ar', () => {
    const state = createPlayerState(6);
    state.grounded = false;

    run(state, makeInput({ crouchHeld: true }), 10, false);

    expect(state.crouching).toBe(false);
  });

  /**
   * Sem esta regra, levantar debaixo de uma viga cresce a caixa para dentro do
   * tile e o Arcade cospe o player para fora numa direção qualquer — o
   * clássico "atravessei o cenário".
   */
  it('não levanta sem espaço acima, mesmo soltando o botão', () => {
    const state = createPlayerState(6);
    state.grounded = true;

    run(state, makeInput({ crouchHeld: true }), 12);
    expect(state.crouching).toBe(true);

    run(state, makeInput({ crouchHeld: false, canStandUp: false }), 20);
    expect(state.crouching).toBe(true);

    // Saiu de baixo da viga: aí sim levanta.
    run(state, makeInput({ crouchHeld: false, canStandUp: true }), 4);
    expect(state.crouching).toBe(false);
  });

  it('pular sai do agachamento', () => {
    const state = createPlayerState(6);
    state.grounded = true;
    run(state, makeInput({ crouchHeld: true }), 12);
    expect(state.crouching).toBe(true);

    const out = createMovementResult();
    stepMovement(state, makeInput({ crouchHeld: true, jumpPressed: true }), STEP, out);

    expect(out.jumped).toBe(true);
    expect(state.crouching).toBe(false);
  });

  it('sem teto, pular agachado é recusado — nada de subir para dentro do tile', () => {
    const state = createPlayerState(6);
    state.grounded = true;
    run(state, makeInput({ crouchHeld: true }), 12);

    const out = createMovementResult();
    stepMovement(
      state,
      makeInput({ crouchHeld: true, jumpPressed: true, canStandUp: false }),
      STEP,
      out,
    );

    expect(out.jumped).toBe(false);
    expect(state.crouching).toBe(true);
  });

  /**
   * Um toque de raspão no ↓ não pode fazer a caixa encolher e crescer no mesmo
   * instante: além de piscar na tela, o Arcade dá um empurrão ao recolocar o
   * corpo maior.
   */
  it('respeita um tempo mínimo agachado', () => {
    const state = createPlayerState(6);
    state.grounded = true;

    stepMovement(state, makeInput({ crouchHeld: true }), STEP, createMovementResult());
    expect(state.crouching).toBe(true);

    stepMovement(state, makeInput({ crouchHeld: false }), STEP, createMovementResult());
    expect(state.crouching).toBe(true);
  });

  it('tomar dano levanta — a animação de dor é em pé', () => {
    const state = createPlayerState(6);
    state.grounded = true;
    run(state, makeInput({ crouchHeld: true }), 12);

    state.hurtMs = PLAYER.hurtMs;
    run(state, makeInput({ crouchHeld: true }), 2);

    expect(state.crouching).toBe(false);
  });
});

describe('agachar — a caixa menor é o ponto', () => {
  it('a caixa agachada é bem mais baixa e mantém a linha dos pés', () => {
    expect(PLAYER.crouch.bodyHeight).toBeLessThan(PLAYER.bodyHeight * 0.7);
    // Topo desce, base não: offset + altura tem de bater com o de pé.
    expect(PLAYER.crouch.bodyOffsetY + PLAYER.crouch.bodyHeight).toBe(
      PLAYER.bodyOffsetY + PLAYER.bodyHeight,
    );
  });

  /** Gameplay e arte precisam concordar, senão o sprite não cobre a hitbox. */
  it('bate com as métricas da arte', () => {
    expect(PLAYER.crouch.bodyHeight).toBe(ART_METRICS.player.bodyCrouch.h);
    expect(PLAYER.crouch.bodyOffsetY).toBe(ART_METRICS.player.bodyCrouch.y);
    expect(PLAYER.crouch.shoulderY).toBe(
      ART_METRICS.player.shoulderCrouch.y - ART_METRICS.player.feetY,
    );
  });
});
