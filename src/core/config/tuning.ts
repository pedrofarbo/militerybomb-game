/**
 * Todos os números que definem como o jogo SE SENTE moram aqui.
 *
 * Regra do projeto: nenhuma constante de balanceamento pode estar solta em
 * outro arquivo. Se você precisou digitar um número mágico em um sistema, ele
 * pertence a este arquivo — é o que torna o tuning possível (e o que permite
 * o painel de debug editar tudo em runtime sem caçar valores pelo código).
 *
 * Unidades: pixels lógicos (640×360) e milissegundos. Velocidade em px/s,
 * aceleração em px/s².
 */

export const WORLD = {
  /** Resolução lógica: altura fixa, largura elástica (docs/ART_SPEC.md §1). */
  height: 360,
  widthMin: 640,
  widthMax: 800,
  tile: 16,
  /** A simulação roda em passo fixo — determinismo para testes e replays. */
  fixedFps: 60,
} as const;

export const PLAYER = {
  /* ── Locomoção ── */
  maxSpeed: 170,
  /** ~0.09 s do repouso à velocidade máxima. Resposta imediata sem parecer gelo. */
  groundAccel: 1900,
  /** ~0.06 s até parar. Para onde o jogador espera que pare. */
  groundFriction: 2850,
  /** 70% do controle do solo: manobrável no ar, sem virar voo. */
  airAccel: 1330,
  /** Baixo de propósito: o momento no ar é preservado. */
  airFriction: 520,

  /* ── Pulo ──
   * Ápice de ~64 px (4 tiles) em ~0.32 s. Deriva:
   *   v0 = 2h/t = 400 ; gUp = 2h/t² = 1250
   */
  jumpVelocity: 400,
  gravityUp: 1250,
  /** Queda 1.6× mais rápida que a subida: peso arcade, não realismo. */
  gravityDown: 2000,
  maxFallSpeed: 520,
  /**
   * Velocidade descendente mantida enquanto no chão.
   *
   * Sem ela, `vy = 0` faz o corpo parar de pressionar o tile, o Arcade deixa
   * de reportar contato no frame seguinte, e o player "reaterrissa" 60×/s —
   * o que prende a animação em LAND e dispara poeira sem parar. Pequena o
   * bastante para não afetar o movimento, grande o bastante para manter
   * contato mesmo descendo uma rampa de tiles.
   */
  groundStickVelocity: 40,
  /** Ao soltar o botão na subida, corta a velocidade: altura controlável. */
  jumpCutMultiplier: 0.5,
  /** Perdoa pular alguns ms DEPOIS de sair da plataforma. */
  coyoteMs: 100,
  /** Perdoa apertar pulo alguns ms ANTES de tocar o chão. */
  jumpBufferMs: 120,
  /** Trava o pulo repetido enquanto o botão fica segurado. */
  jumpRearmMs: 60,

  /* ── Estado ── */
  landingMs: 90,
  /** Acima disto a aterrissagem "pesa": poeira maior e um tranco de câmera. */
  hardLandingSpeed: 420,
  hardLandingShake: 0.12,
  /**
   * Segurar ↓ e apertar pulo sobre uma plataforma de sentido único faz o
   * player descer por ela. Sem isso, subir numa plataforma vira uma armadilha.
   */
  dropThroughMs: 220,
  hurtMs: 260,
  invulnMs: 900,
  invulnBlinkHz: 12,
  respawnDelayMs: 1200,
  maxHealth: 6,

  /* ── Colisão (dentro do frame de 64×64, ver ART_SPEC §2) ── */
  bodyWidth: 20,
  bodyHeight: 40,
  bodyOffsetX: 22,
  bodyOffsetY: 18,

  /**
   * Ombro, relativo à posição do sprite (que é a LINHA DOS PÉS — a origem do
   * sprite é (0.5, 58/64), ver ART_SPEC §2). O braço de mira é um sprite
   * separado ancorado aqui.
   */
  shoulderX: 2,
  shoulderY: -28,
  /** Distância do ombro até a boca do cano, ao longo do ângulo de mira. */
  muzzleDistance: 15,
} as const;

export const CAMERA = {
  /** Deadzone: micro-ajustes não movem a câmera (menos enjoo). */
  deadzoneWidth: 120,
  deadzoneHeight: 48,
  /**
   * No ar a câmera segue uma ÂNCORA (a última altura em que o player pisou),
   * não o player. Sem isso todo pulo balança a tela verticalmente — o maior
   * causador de enjoo em plataformas 2D.
   */
  airborneSlackY: 76,
  /** Velocidade com que a âncora acompanha o chão sob os pés. */
  anchorLerpGrounded: 0.2,
  /** Mostra o perigo antes dele te acertar — essencial num run & gun. */
  lookaheadX: 64,
  lookaheadLerp: 0.06,
  followLerpX: 0.12,
  followLerpY: 0.09,
  /** Modelo de trauma: offset ∝ trauma², decai, e satura. */
  traumaDecayPerSec: 1.2,
  traumaMaxOffset: 10,
  traumaMaxAngle: 0.012,
  shakeFrequency: 22,
} as const;

export const FX = {
  hitStopMs: 55,
  muzzleLifeMs: 70,
} as const;

/** Limites por nível de qualidade. Nunca alteram gameplay — só apresentação. */
export const QUALITY = {
  high: { maxParticles: 250, foregroundParallax: true, hitFlash: true },
  medium: { maxParticles: 120, foregroundParallax: true, hitFlash: true },
  low: { maxParticles: 60, foregroundParallax: false, hitFlash: false },
  /** Duas janelas de 3 s abaixo disto degradam um nível; acima, sobem. */
  degradeBelowFps: 50,
  upgradeAboveFps: 58,
  sampleWindowMs: 3000,
} as const;

export type QualityLevel = 'high' | 'medium' | 'low';
