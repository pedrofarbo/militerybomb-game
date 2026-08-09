/**
 * ESTIVADOR — mini-boss da Fase 1. Cérebro puro, sem Phaser.
 *
 * Um guindaste portuário blindado às pressas. O desenho da luta é um LOOP DE
 * ENSINO, não uma sequência de ataques aleatórios:
 *
 *     padrão (você desvia)  →  respiro (o núcleo abre)  →  você acerta
 *
 * Fechado, a blindagem come 75% do dano. Aberto, tudo entra — e acertar o
 * núcleo exposto dobra. O ponto fraco é uma JANELA DE TEMPO, não um pixel:
 * quem só metralha ainda ganha, devagar; quem espera a abertura ganha rápido;
 * quem também mira no núcleo ganha mais rápido ainda. Três níveis de leitura
 * para a mesma luta, e nenhum deles exige que alguém explique a regra.
 *
 * Duas fases. Aos 50% ele abre as ventoinhas: os padrões ficam mais rápidos, a
 * janela encurta e um padrão novo entra na rotação. A transição é invulnerável
 * de propósito — é a deixa visual de que as regras mudaram.
 *
 * Todo ataque tem antecipação obrigatória (`telegraphMs`). Mesma regra dos
 * inimigos comuns, e pelo mesmo motivo: sem ela a luta vira sorteio.
 */

export const BossState = {
  /** Antes do portão fechar: parado, sem reagir. */
  Dormant: 'DORMANT',
  /** Acordou; a câmera está travando e o jogador ainda não pode ser atingido. */
  Intro: 'INTRO',
  /** Escolhendo o próximo padrão. Dura um passo. */
  Choose: 'CHOOSE',
  /** Antecipação visível do ataque escolhido. */
  Telegraph: 'TELEGRAPH',
  /** Executando o padrão. */
  Attack: 'ATTACK',
  /** Ventoinhas abertas: o núcleo está exposto e o dano entra inteiro. */
  Vent: 'VENT',
  /** Transição de fase, invulnerável. */
  PhaseShift: 'PHASE_SHIFT',
  Dead: 'DEAD',
} as const;

export type BossState = (typeof BossState)[keyof typeof BossState];

export type BossPatternId = 'claw' | 'flak' | 'charge';

export interface BossContext {
  selfX: number;
  /** Linha do chão sob o boss (pés). */
  selfY: number;
  facing: -1 | 1;
  health: number;
  maxHealth: number;
  playerX: number;
  /** Ponto de mira: o tronco do jogador. */
  playerY: number;
  playerAlive: boolean;
  /** Limites da arena, em px de mundo. */
  arenaLeft: number;
  arenaRight: number;
  nowMs: number;
}

export interface BossShot {
  angleRad: number;
  speed: number;
  damage: number;
}

export interface BossOutput {
  /** -1..1. O Actor multiplica pela velocidade do padrão em curso. */
  moveX: number;
  moveSpeed: number;
  facing: -1 | 1;
  state: BossState;
  phase: 1 | 2;
  pattern: BossPatternId | null;
  /** Núcleo aberto: o dano entra inteiro e o sprite troca. */
  coreExposed: boolean;
  /** Tiros a materializar NESTE passo. O chamador não deve guardar o array. */
  shots: BossShot[];
  /** Golpe de garra resolvido neste passo, em x de mundo. */
  slamAt: number | null;
  /** A garra deve tocar a animação de golpe. */
  clawSwing: boolean;
  /** Trauma de câmera pedido neste passo. */
  shake: number;
  /** Encostar no boss dói isto. Sobe durante a investida. */
  contactDamage: number;
}

export function createBossContext(): BossContext {
  return {
    selfX: 0,
    selfY: 0,
    facing: -1,
    health: 1,
    maxHealth: 1,
    playerX: 0,
    playerY: 0,
    playerAlive: false,
    arenaLeft: 0,
    arenaRight: 0,
    nowMs: 0,
  };
}

export function createBossOutput(): BossOutput {
  return {
    moveX: 0,
    moveSpeed: 0,
    facing: -1,
    state: BossState.Dormant,
    phase: 1,
    pattern: null,
    coreExposed: false,
    shots: [],
    slamAt: null,
    clawSwing: false,
    shake: 0,
    contactDamage: 0,
  };
}

/** Balanceamento da luta. Como todo o resto do projeto: dados, não código. */
export const ESTIVADOR = {
  maxHealth: 420,
  /**
   * Fração do dano que a carcaça aceita ENQUANTO FECHADO.
   *
   * É o número mais importante da luta: é ele que transforma "segure o
   * gatilho" em "espere a abertura". A primeira versão usava 0,15 e a luta
   * ficava impossível — 35 s de fogo contínuo para derrubá-lo, mais munição do
   * que a metralhadora tem. Em 0,25 insistir na blindagem AINDA é o caminho
   * ruim, mas é um caminho: o jogador vê a barra andar e entende que existe
   * algo melhor, em vez de achar que o jogo está quebrado.
   */
  armorMultiplier: 0.25,
  /**
   * Multiplicador de acertar o NÚCLEO durante o respiro.
   *
   * A janela aberta já aceita dano inteiro — a precisão é um bônus, não um
   * requisito. Exigir o núcleo transformava a luta numa charada de altura de
   * pixel: quem não descobrisse a posição exata não conseguia vencer, e nada
   * na tela explicava por quê.
   */
  coreMultiplier: 2,
  /** Abaixo desta fração de vida, entra a fase 2. */
  phase2At: 0.5,

  introMs: 1300,
  phaseShiftMs: 1500,
  deathMs: 1400,

  /** Deslocamento de reposicionamento entre padrões. */
  walkSpeed: 46,
  chargeSpeed: 260,

  contactDamage: 1,
  chargeContactDamage: 2,

  /** Distância mínima das bordas da arena — o boss não encosta na parede. */
  edgeMarginPx: 96,

  phases: [
    {
      ventMs: 1500,
      /** Pausa entre o fim do respiro e o próximo padrão. */
      recoverMs: 420,
      rotation: ['claw', 'flak', 'claw', 'charge'] as readonly BossPatternId[],
    },
    {
      ventMs: 1000,
      recoverMs: 260,
      rotation: ['flak', 'charge', 'claw', 'flak', 'charge'] as readonly BossPatternId[],
    },
  ],

  claw: {
    telegraphMs: 520,
    /** Tempo até a garra tocar o chão. */
    impactMs: 260,
    /** Recolhimento depois do golpe. */
    recoverMs: 340,
    /* 1, não 2: a garra PERSEGUE o jogador durante a antecipação, então é o
       ataque mais difícil de evitar. Tirar um terço da vida com o golpe mais
       difícil de ler é o que fazia a luta parecer injusta. */
    damage: 1,
    /** Raio do golpe no chão. */
    radiusPx: 46,
    shake: 0.5,
    /** Na fase 2 ele bate duas vezes. */
    hitsPhase2: 2,
  },

  flak: {
    telegraphMs: 620,
    /** Intervalo entre os projéteis do leque. */
    shotIntervalMs: 90,
    pellets: 4,
    pelletsPhase2: 6,
    /** Abertura total do leque, em graus. */
    spreadDeg: 66,
    spreadDegPhase2: 88,
    speed: 220,
    damage: 1,
    shake: 0.1,
  },

  charge: {
    telegraphMs: 700,
    /** Teto de duração — normalmente termina antes, ao chegar na borda. */
    maxMs: 1100,
    /** Freada no fim da investida. */
    recoverMs: 420,
    shake: 0.34,
  },
} as const;

const DEG = Math.PI / 180;

export class EstivadorBrain {
  state: BossState = BossState.Dormant;
  phase: 1 | 2 = 1;
  pattern: BossPatternId | null = null;

  private timerMs = 0;
  private rotationIndex = 0;
  private phaseShifted = false;
  /** Passos restantes do padrão em curso (golpes de garra, pellets do leque). */
  private repeatsLeft = 0;
  private subTimerMs = 0;
  private slamTargetX = 0;
  private chargeDirection: -1 | 1 = -1;

  reset(): void {
    this.state = BossState.Dormant;
    this.phase = 1;
    this.pattern = null;
    this.timerMs = 0;
    this.rotationIndex = 0;
    this.phaseShifted = false;
    this.repeatsLeft = 0;
    this.subTimerMs = 0;
    this.slamTargetX = 0;
    this.chargeDirection = -1;
  }

  /** Chamado quando o jogador entra na arena e o portão fecha. */
  wake(): void {
    if (this.state !== BossState.Dormant) return;
    this.state = BossState.Intro;
    this.timerMs = ESTIVADOR.introMs;
  }

  kill(): void {
    this.state = BossState.Dead;
    this.timerMs = ESTIVADOR.deathMs;
  }

  get alive(): boolean {
    return this.state !== BossState.Dead;
  }

  /** O dano entra inteiro só no núcleo aberto. Ver `armorMultiplier`. */
  get vulnerable(): boolean {
    return this.state === BossState.Vent;
  }

  /** Nem a carcaça aceita dano durante a transição de fase. */
  get invulnerable(): boolean {
    return this.state === BossState.PhaseShift || this.state === BossState.Intro;
  }

  update(ctx: BossContext, dtMs: number, out: BossOutput): void {
    out.moveX = 0;
    out.moveSpeed = ESTIVADOR.walkSpeed;
    out.facing = ctx.facing;
    out.pattern = this.pattern;
    out.coreExposed = false;
    out.shots.length = 0;
    out.slamAt = null;
    out.clawSwing = false;
    out.shake = 0;
    out.contactDamage = ESTIVADOR.contactDamage;

    if (this.state === BossState.Dead) {
      out.state = BossState.Dead;
      out.phase = this.phase;
      out.contactDamage = 0;
      this.timerMs = Math.max(0, this.timerMs - dtMs);
      return;
    }

    // Encara o jogador sempre que não está no meio de uma investida.
    if (this.state !== BossState.Attack || this.pattern !== 'charge') {
      out.facing = ctx.playerX < ctx.selfX ? -1 : 1;
    }

    // A troca de fase interrompe qualquer padrão: é a deixa de que as regras
    // mudaram, e escondê-la atrás do fim de um ataque desperdiça o momento.
    if (
      !this.phaseShifted &&
      this.state !== BossState.Intro &&
      this.state !== BossState.Dormant &&
      ctx.health <= ctx.maxHealth * ESTIVADOR.phase2At
    ) {
      this.phaseShifted = true;
      this.phase = 2;
      this.rotationIndex = 0;
      this.state = BossState.PhaseShift;
      this.timerMs = ESTIVADOR.phaseShiftMs;
      out.shake = 0.6;
    }

    this.timerMs -= dtMs;

    switch (this.state) {
      case BossState.Dormant:
        this.timerMs = 0;
        break;

      case BossState.Intro:
        if (this.timerMs <= 0) this.state = BossState.Choose;
        break;

      case BossState.PhaseShift:
        if (this.timerMs <= 0) this.state = BossState.Choose;
        break;

      case BossState.Choose:
        this.beginNextPattern(ctx);
        break;

      case BossState.Telegraph:
        this.stepTelegraph(ctx, out);
        break;

      case BossState.Attack:
        this.stepAttack(ctx, dtMs, out);
        break;

      case BossState.Vent:
        if (this.timerMs <= 0) this.state = BossState.Choose;
        break;
    }

    /* O sprite do núcleo aberto e a regra de dano são DERIVADOS do mesmo
       estado, não escritos em dois lugares. Escritos separadamente eles
       divergiam por um passo no fim de cada respiro — o jogador via a abertura
       e o tiro batia na blindagem, que é a pior lição possível. */
    out.coreExposed = this.vulnerable;
    out.state = this.state;
    out.phase = this.phase;
    out.pattern = this.pattern;
  }

  /* ─────────────────────────── Padrões ──────────────────────────── */

  private beginNextPattern(ctx: BossContext): void {
    const config = ESTIVADOR.phases[this.phase - 1]!;
    const rotation = config.rotation;
    this.pattern = rotation[this.rotationIndex % rotation.length]!;
    this.rotationIndex++;

    /* Rotação fixa, não sorteio. Um boss previsível é um boss que se APRENDE,
       e aprender é o que torna a segunda tentativa diferente da primeira.
       Aleatório aqui só produziria mortes que o jogador não entende. */
    this.state = BossState.Telegraph;
    this.subTimerMs = 0;

    switch (this.pattern) {
      case 'claw':
        this.timerMs = ESTIVADOR.claw.telegraphMs;
        this.repeatsLeft = this.phase === 2 ? ESTIVADOR.claw.hitsPhase2 : 1;
        this.slamTargetX = ctx.playerX;
        break;
      case 'flak':
        this.timerMs = ESTIVADOR.flak.telegraphMs;
        this.repeatsLeft = this.phase === 2 ? ESTIVADOR.flak.pelletsPhase2 : ESTIVADOR.flak.pellets;
        break;
      case 'charge':
        this.timerMs = ESTIVADOR.charge.telegraphMs;
        this.repeatsLeft = 1;
        this.chargeDirection = ctx.playerX < ctx.selfX ? -1 : 1;
        break;
    }
  }

  private stepTelegraph(ctx: BossContext, out: BossOutput): void {
    // A garra ACOMPANHA o jogador durante a antecipação, e trava no fim. Isso
    // dá ao golpe uma leitura clara: dá para ver onde ele vai cair e sair de lá.
    if (this.pattern === 'claw') this.slamTargetX = ctx.playerX;
    if (this.timerMs > 0) return;

    this.state = BossState.Attack;
    this.subTimerMs = 0;

    switch (this.pattern) {
      case 'claw':
        this.timerMs = ESTIVADOR.claw.impactMs;
        out.clawSwing = true;
        break;
      case 'flak':
        this.timerMs = ESTIVADOR.flak.shotIntervalMs * this.repeatsLeft;
        break;
      case 'charge':
        this.timerMs = ESTIVADOR.charge.maxMs;
        break;
    }
  }

  private stepAttack(ctx: BossContext, dtMs: number, out: BossOutput): void {
    switch (this.pattern) {
      case 'claw':
        this.stepClaw(out);
        break;
      case 'flak':
        this.stepFlak(ctx, dtMs, out);
        break;
      case 'charge':
        this.stepCharge(ctx, out);
        break;
    }
  }

  private stepClaw(out: BossOutput): void {
    if (this.timerMs > 0) return;

    out.slamAt = this.slamTargetX;
    out.shake = ESTIVADOR.claw.shake;
    this.repeatsLeft--;

    if (this.repeatsLeft > 0) {
      // Segundo golpe da fase 2: volta para a antecipação, encurtada.
      this.state = BossState.Telegraph;
      this.timerMs = ESTIVADOR.claw.telegraphMs * 0.6;
      return;
    }
    this.openVent(ESTIVADOR.claw.recoverMs);
  }

  private stepFlak(ctx: BossContext, dtMs: number, out: BossOutput): void {
    this.subTimerMs -= dtMs;
    if (this.repeatsLeft > 0 && this.subTimerMs <= 0) {
      this.subTimerMs = ESTIVADOR.flak.shotIntervalMs;

      const total = this.phase === 2 ? ESTIVADOR.flak.pelletsPhase2 : ESTIVADOR.flak.pellets;
      const spread =
        (this.phase === 2 ? ESTIVADOR.flak.spreadDegPhase2 : ESTIVADOR.flak.spreadDeg) * DEG;
      const index = total - this.repeatsLeft;
      // Leque centrado na direção do jogador: cobre a área, deixa brechas.
      const base = Math.atan2(ctx.playerY - ctx.selfY, ctx.playerX - ctx.selfX);
      const step = total > 1 ? spread / (total - 1) : 0;

      out.shots.push({
        angleRad: base - spread / 2 + step * index,
        speed: ESTIVADOR.flak.speed,
        damage: ESTIVADOR.flak.damage,
      });
      out.shake = ESTIVADOR.flak.shake;
      this.repeatsLeft--;
    }

    if (this.repeatsLeft <= 0 && this.timerMs <= 0) this.openVent(0);
  }

  private stepCharge(ctx: BossContext, out: BossOutput): void {
    out.moveX = this.chargeDirection;
    out.moveSpeed = ESTIVADOR.chargeSpeed;
    out.facing = this.chargeDirection;
    out.contactDamage = ESTIVADOR.chargeContactDamage;

    const limit =
      this.chargeDirection === -1
        ? ctx.arenaLeft + ESTIVADOR.edgeMarginPx
        : ctx.arenaRight - ESTIVADOR.edgeMarginPx;
    const reachedEdge = this.chargeDirection === -1 ? ctx.selfX <= limit : ctx.selfX >= limit;

    if (reachedEdge || this.timerMs <= 0) {
      out.shake = ESTIVADOR.charge.shake;
      this.openVent(ESTIVADOR.charge.recoverMs);
    }
  }

  /**
   * Fim do padrão: as ventoinhas abrem e o núcleo fica exposto.
   *
   * `recoverMs` entra somado à janela porque o recolhimento faz parte do
   * respiro para quem está olhando — separar os dois só produziria um instante
   * em que o boss parece aberto mas não aceita dano, que é o pior dos mundos.
   */
  private openVent(recoverMs: number): void {
    const config = ESTIVADOR.phases[this.phase - 1]!;
    this.state = BossState.Vent;
    this.timerMs = config.ventMs + recoverMs + config.recoverMs;
    this.pattern = null;
    this.repeatsLeft = 0;
  }
}
