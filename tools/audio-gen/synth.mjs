/**
 * Síntese: os tijolos com que os sons placeholder são montados.
 *
 * Tudo é DETERMINÍSTICO. O ruído vem de um LCG semeado, não de `Math.random`,
 * pelo mesmo motivo que a arte é determinística: rodar o gerador duas vezes
 * precisa produzir bytes idênticos, senão cada build suja o diff do git e o
 * CI não consegue verificar que os assets estão em dia com o gerador.
 */

export const SAMPLE_RATE = 22050;
/** Música em taxa menor: são os arquivos maiores, e ela não tem transientes. */
export const MUSIC_SAMPLE_RATE = 11025;

const TAU = Math.PI * 2;

/** LCG de 32 bits. Pequeno, reprodutível, suficiente para ruído branco. */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buffer(durationSec, sampleRate = SAMPLE_RATE) {
  return new Float32Array(Math.max(1, Math.round(durationSec * sampleRate)));
}

/* ─────────────────────────── Envelopes ──────────────────────────── */

/**
 * Decaimento exponencial. `curve` maior = queda mais abrupta.
 *
 * Exponencial e não linear porque é assim que o ouvido percebe volume: uma
 * rampa linear soa como se o som "segurasse" e depois sumisse de repente.
 */
export function decay(t, duration, curve = 5) {
  return Math.exp((-curve * t) / duration);
}

/** Ataque curto + decaimento. O ataque evita o estalo do início abrupto. */
export function pluck(t, duration, attackSec = 0.004, curve = 5) {
  const attack = t < attackSec ? t / attackSec : 1;
  return attack * decay(t, duration, curve);
}

/* ──────────────────────────── Osciladores ───────────────────────── */

export const sine = (phase) => Math.sin(phase * TAU);
export const square = (phase) => (phase % 1 < 0.5 ? 1 : -1);
export const saw = (phase) => 2 * (phase % 1) - 1;
export const triangle = (phase) => {
  const x = phase % 1;
  return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
};

/**
 * Soma um oscilador ao buffer, com frequência variável no tempo.
 *
 * @param {Float32Array} out
 * @param {(t: number) => number} freqAt     frequência em Hz no instante t
 * @param {(t: number) => number} ampAt      amplitude 0..1 no instante t
 */
export function tone(out, freqAt, ampAt, wave = sine, sampleRate = SAMPLE_RATE) {
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    phase += freqAt(t) / sampleRate;
    out[i] += wave(phase) * ampAt(t);
  }
  return out;
}

/** Ruído branco filtrado por um passa-baixa de um polo — a base de impactos. */
export function noise(out, ampAt, rng, cutoff = 1, sampleRate = SAMPLE_RATE) {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    last += (white - last) * cutoff;
    out[i] += last * ampAt(t);
  }
  return out;
}

/* ──────────────────────────── Utilidades ────────────────────────── */

/** Normaliza para um pico alvo. Mantém a mixagem previsível entre os sons. */
export function normalize(out, peak = 0.85) {
  let max = 0;
  for (const sample of out) max = Math.max(max, Math.abs(sample));
  if (max === 0) return out;
  const gain = peak / max;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

/**
 * Rampa de saída curtíssima.
 *
 * Um buffer que termina com a onda longe do zero produz um clique audível na
 * emenda — e num som que toca dez vezes por segundo o clique vira o som.
 */
export function fadeOut(out, seconds = 0.006, sampleRate = SAMPLE_RATE) {
  const samples = Math.min(out.length, Math.round(seconds * sampleRate));
  for (let i = 0; i < samples; i++) {
    out[out.length - 1 - i] *= i / samples;
  }
  return out;
}

/** Mesma ideia na entrada, para loops de música emendarem sem estalo. */
export function fadeIn(out, seconds = 0.006, sampleRate = SAMPLE_RATE) {
  const samples = Math.min(out.length, Math.round(seconds * sampleRate));
  for (let i = 0; i < samples; i++) out[i] *= i / samples;
  return out;
}

/** Semitons acima de um Lá 440 — para escrever melodia em notas, não em Hz. */
export function note(semitonesFromA4) {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}
