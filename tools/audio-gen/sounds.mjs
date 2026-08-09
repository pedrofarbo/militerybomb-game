/**
 * O banco de sons placeholder do REDLINE.
 *
 * Cada som é uma função pura de síntese. Eles NÃO são som final e não devem
 * ser polidos — existem para que o jogo tenha a resposta sonora certa no
 * momento certo, e para que trocar por gravações de verdade seja substituir
 * arquivos, sem tocar em código.
 *
 * A regra de desenho, herdada do resto do projeto: som é INFORMAÇÃO. Cada um
 * tem uma função de leitura no combate, anotada junto. Se dois sons ensinam a
 * mesma coisa, um dos dois é ruído.
 */

import {
  buffer,
  createRng,
  decay,
  fadeOut,
  noise,
  normalize,
  note,
  pluck,
  saw,
  sine,
  square,
  tone,
  triangle,
  MUSIC_SAMPLE_RATE,
} from './synth.mjs';

/* ────────────────────────────── Armas ───────────────────────────── */

/** Pistola: estalo curto e seco. Precisa sumir antes do próximo tiro. */
function pistol() {
  const out = buffer(0.14);
  const rng = createRng(0x51a7);
  tone(
    out,
    (t) => 420 * decay(t, 0.14, 22) + 90,
    (t) => 0.7 * decay(t, 0.14, 26),
    square,
  );
  noise(out, (t) => 0.5 * decay(t, 0.14, 34), rng, 0.55);
  return fadeOut(normalize(out, 0.7));
}

/** Metralhadora: mais grave e mais curta — vai tocar 12 vezes por segundo. */
function machinegun() {
  const out = buffer(0.09);
  const rng = createRng(0x4d61);
  tone(
    out,
    (t) => 300 * decay(t, 0.09, 20) + 70,
    (t) => 0.6 * decay(t, 0.09, 30),
    square,
  );
  noise(out, (t) => 0.55 * decay(t, 0.09, 40), rng, 0.5);
  return fadeOut(normalize(out, 0.62));
}

/** Escopeta: estouro largo, com cauda. O peso é a recompensa da arma. */
function shotgun() {
  const out = buffer(0.34);
  const rng = createRng(0x5867);
  tone(
    out,
    (t) => 180 * decay(t, 0.34, 9) + 48,
    (t) => 0.8 * decay(t, 0.34, 11),
    saw,
  );
  noise(out, (t) => 0.9 * decay(t, 0.34, 13), rng, 0.34);
  return fadeOut(normalize(out, 0.92));
}

/** Arma vazia: clique metálico, sem corpo. Comunica "falta munição". */
function dryFire() {
  const out = buffer(0.07);
  const rng = createRng(0x6d70);
  noise(out, (t) => 0.8 * decay(t, 0.07, 60), rng, 0.9);
  tone(
    out,
    () => 1800,
    (t) => 0.25 * decay(t, 0.07, 70),
    square,
  );
  return fadeOut(normalize(out, 0.4));
}

/* ───────────────────────────── Impactos ─────────────────────────── */

/** Bala no concreto: chiado seco, sem tom. */
function impactConcrete() {
  const out = buffer(0.12);
  const rng = createRng(0x1c04);
  noise(out, (t) => 0.7 * decay(t, 0.12, 30), rng, 0.7);
  return fadeOut(normalize(out, 0.45));
}

/** Bala em metal: o mesmo chiado com um tom agudo — o "tin" do ricochete. */
function impactMetal() {
  const out = buffer(0.18);
  const rng = createRng(0x1c0e);
  noise(out, (t) => 0.5 * decay(t, 0.18, 34), rng, 0.85);
  tone(
    out,
    (t) => 2400 - 600 * t,
    (t) => 0.35 * decay(t, 0.18, 16),
    sine,
  );
  return fadeOut(normalize(out, 0.5));
}

/**
 * Bala em armadura: grave e abafado.
 *
 * É o som mais importante do combate: é ele que diz "acertei, mas não é aqui".
 * Precisa ser CLARAMENTE diferente do impacto no núcleo do boss.
 */
function impactArmor() {
  const out = buffer(0.16);
  const rng = createRng(0x1c0a);
  noise(out, (t) => 0.6 * decay(t, 0.16, 26), rng, 0.25);
  tone(
    out,
    () => 150,
    (t) => 0.5 * decay(t, 0.16, 20),
    triangle,
  );
  return fadeOut(normalize(out, 0.55));
}

/** Acerto no ponto fraco: agudo, brilhante, inconfundível. */
function impactCore() {
  const out = buffer(0.22);
  tone(
    out,
    (t) => 900 + 500 * decay(t, 0.22, 8),
    (t) => 0.7 * pluck(t, 0.22, 0.002, 9),
    sine,
  );
  tone(
    out,
    (t) => 1800 + 900 * decay(t, 0.22, 8),
    (t) => 0.3 * pluck(t, 0.22, 0.002, 12),
    sine,
  );
  return fadeOut(normalize(out, 0.8));
}

/* ─────────────────────────── Explosões ──────────────────────────── */

function explosion(durationSec, seed, peak) {
  const out = buffer(durationSec);
  const rng = createRng(seed);
  noise(out, (t) => 1 * decay(t, durationSec, 6), rng, 0.16);
  tone(
    out,
    (t) => 90 * decay(t, durationSec, 5) + 28,
    (t) => 0.9 * decay(t, durationSec, 7),
    sine,
  );
  return fadeOut(normalize(out, peak));
}

/* ──────────────────────────── Movimento ─────────────────────────── */

/** Pulo: um "sopro" ascendente curto. Confirma o comando, não decora. */
function jump() {
  const out = buffer(0.16);
  tone(
    out,
    (t) => 250 + 420 * t * 6,
    (t) => 0.5 * decay(t, 0.16, 14),
    triangle,
  );
  return fadeOut(normalize(out, 0.4));
}

/** Aterrissagem: batida grave com poeira. */
function land() {
  const out = buffer(0.18);
  const rng = createRng(0x1a4d);
  tone(
    out,
    (t) => 120 * decay(t, 0.18, 12) + 45,
    (t) => 0.7 * decay(t, 0.18, 14),
    sine,
  );
  noise(out, (t) => 0.4 * decay(t, 0.18, 20), rng, 0.2);
  return fadeOut(normalize(out, 0.5));
}

/* ──────────────────────── Dano e progressão ─────────────────────── */

/** Jogador tomando dano: descendente e áspero. Nunca agradável. */
function playerHurt() {
  const out = buffer(0.3);
  const rng = createRng(0x8c17);
  tone(
    out,
    (t) => 420 - 260 * t * 3,
    (t) => 0.6 * decay(t, 0.3, 9),
    saw,
  );
  noise(out, (t) => 0.3 * decay(t, 0.3, 14), rng, 0.4);
  return fadeOut(normalize(out, 0.65));
}

/** Morte do jogador: queda longa de tom. O fim da tentativa precisa doer. */
function playerDeath() {
  const out = buffer(1.1);
  const rng = createRng(0x0d1e);
  tone(
    out,
    (t) => 380 * Math.exp(-1.9 * t) + 42,
    (t) => 0.75 * decay(t, 1.1, 3.4),
    saw,
  );
  noise(out, (t) => 0.35 * decay(t, 1.1, 4), rng, 0.14);
  return fadeOut(normalize(out, 0.8));
}

/** Inimigo comum morrendo: curto e mecânico, para não competir com o combate. */
function enemyDeath() {
  const out = buffer(0.34);
  const rng = createRng(0xe0de);
  noise(out, (t) => 0.8 * decay(t, 0.34, 10), rng, 0.2);
  tone(
    out,
    (t) => 220 * decay(t, 0.34, 7) + 40,
    (t) => 0.5 * decay(t, 0.34, 9),
    square,
  );
  return fadeOut(normalize(out, 0.6));
}

/** Checkpoint: dois tons ascendentes. A recompensa mais barata que existe. */
function checkpoint() {
  const out = buffer(0.6);
  tone(
    out,
    (t) => (t < 0.14 ? note(4) : note(11)),
    (t) => 0.55 * (t < 0.14 ? pluck(t, 0.14, 0.004, 4) : pluck(t - 0.14, 0.46, 0.004, 4)),
    triangle,
  );
  return fadeOut(normalize(out, 0.6));
}

/** Item recolhido: um tom só, brilhante e imediato. */
function pickup() {
  const out = buffer(0.26);
  tone(
    out,
    (t) => note(12) + note(12) * 0.35 * (1 - decay(t, 0.26, 8)),
    (t) => 0.6 * pluck(t, 0.26, 0.003, 7),
    triangle,
  );
  return fadeOut(normalize(out, 0.6));
}

/** Vida extra: arpejo curto ascendente. Só acontece em marco de pontuação. */
function extraLife() {
  const out = buffer(0.72);
  const steps = [0, 4, 7, 12];
  for (let i = 0; i < steps.length; i++) {
    const start = i * 0.13;
    tone(
      out,
      () => note(steps[i]),
      (t) => (t < start ? 0 : 0.45 * pluck(t - start, 0.72 - start, 0.004, 5)),
      triangle,
    );
  }
  return fadeOut(normalize(out, 0.7));
}

/* ──────────────────────────── Boss e UI ─────────────────────────── */

/** Portão da arena fechando: metal pesado, grave, com cauda. */
function gateClose() {
  const out = buffer(0.9);
  const rng = createRng(0x9a7e);
  tone(
    out,
    (t) => 70 * decay(t, 0.9, 3) + 30,
    (t) => 0.9 * decay(t, 0.9, 4),
    sine,
  );
  noise(out, (t) => 0.5 * decay(t, 0.9, 7), rng, 0.1);
  return fadeOut(normalize(out, 0.9));
}

/** Antecipação do boss: sirene curta. É o aviso de "vem coisa". */
function bossTelegraph() {
  const out = buffer(0.45);
  tone(
    out,
    (t) => 300 + 160 * Math.sin(t * 26),
    (t) => 0.55 * decay(t, 0.45, 4),
    square,
  );
  return fadeOut(normalize(out, 0.55));
}

/** Ventoinhas abrindo: o convite para atirar. Sobe, e fica. */
function bossVent() {
  const out = buffer(0.5);
  const rng = createRng(0x7e17);
  tone(
    out,
    (t) => 180 + 420 * t * 2,
    (t) => 0.5 * decay(t, 0.5, 3),
    triangle,
  );
  noise(out, (t) => 0.4 * decay(t, 0.5, 5), rng, 0.6);
  return fadeOut(normalize(out, 0.6));
}

function uiSelect() {
  const out = buffer(0.1);
  tone(
    out,
    () => note(7),
    (t) => 0.5 * pluck(t, 0.1, 0.002, 10),
    square,
  );
  return fadeOut(normalize(out, 0.35));
}

function uiConfirm() {
  const out = buffer(0.24);
  tone(
    out,
    (t) => (t < 0.07 ? note(7) : note(14)),
    (t) => 0.55 * pluck(t % 0.07, 0.1, 0.002, 8),
    square,
  );
  return fadeOut(normalize(out, 0.5));
}

/* ──────────────────────────── Música ────────────────────────────── */

/**
 * Duas faixas curtas em loop. Placeholder honesto: uma linha de baixo, um
 * arpejo e uma marcação — o suficiente para o jogo ter pulso e para dar para
 * julgar o MIX (música vs. efeitos), que é o que o áudio final vai precisar.
 *
 * `loopBars` compassos a `bpm`. A emenda é feita com fade curtíssimo nas duas
 * pontas; sem isso o loop estala a cada volta.
 */
function musicTrack({ bpm, bars, root, pattern, arp, seed, driveArp }) {
  const secondsPerBeat = 60 / bpm;
  const duration = bars * 4 * secondsPerBeat;
  const out = buffer(duration, MUSIC_SAMPLE_RATE);
  const rng = createRng(seed);
  const sr = MUSIC_SAMPLE_RATE;

  // Baixo: uma nota por tempo, seguindo o padrão.
  for (let beat = 0; beat < bars * 4; beat++) {
    const start = beat * secondsPerBeat;
    const semitone = root + pattern[beat % pattern.length];
    const freq = note(semitone) / 2;
    for (let i = 0; i < Math.round(secondsPerBeat * sr); i++) {
      const index = Math.round(start * sr) + i;
      if (index >= out.length) break;
      const t = i / sr;
      out[index] += saw((freq * t) % 1) * 0.34 * decay(t, secondsPerBeat, 3.4);
    }
  }

  // Arpejo: quatro notas por tempo, uma oitava acima.
  const stepSec = secondsPerBeat / (driveArp ? 4 : 2);
  const steps = Math.floor(duration / stepSec);
  for (let step = 0; step < steps; step++) {
    const start = step * stepSec;
    const semitone = root + arp[step % arp.length] + 12;
    const freq = note(semitone);
    for (let i = 0; i < Math.round(stepSec * sr); i++) {
      const index = Math.round(start * sr) + i;
      if (index >= out.length) break;
      const t = i / sr;
      out[index] += triangle((freq * t) % 1) * 0.2 * decay(t, stepSec, 5);
    }
  }

  // Marcação: ruído curto no contratempo. É o que dá andamento.
  for (let beat = 0; beat < bars * 4; beat++) {
    const start = (beat + 0.5) * secondsPerBeat;
    const length = Math.round(0.05 * sr);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const index = Math.round(start * sr) + i;
      if (index >= out.length) break;
      const white = rng() * 2 - 1;
      last += (white - last) * 0.8;
      out[index] += last * 0.16 * decay(i / sr, 0.05, 18);
    }
  }

  normalize(out, 0.6);
  return out;
}

/** Fase: andamento médio, menor, tenso mas caminhável. */
function musicLevel() {
  return musicTrack({
    bpm: 104,
    bars: 8,
    root: -9, // Dó
    pattern: [0, 0, 5, 5, 3, 3, -2, -2],
    arp: [0, 3, 7, 10, 7, 3],
    seed: 0x10ce,
    driveArp: false,
  });
}

/** Boss: mais rápido, mais grave, arpejo em colcheias. */
function musicBoss() {
  return musicTrack({
    bpm: 138,
    bars: 8,
    root: -12,
    pattern: [0, 0, 0, 1, 0, 0, 3, 1],
    arp: [0, 3, 6, 3],
    seed: 0xb055,
    driveArp: true,
  });
}

/**
 * O catálogo. `key` é a chave lógica que o jogo usa; o gameplay nunca
 * referencia um caminho de arquivo.
 */
export const SOUNDS = [
  { key: 'sfx.weapon.pistol', make: pistol, role: 'tiro da pistola' },
  { key: 'sfx.weapon.machinegun', make: machinegun, role: 'tiro da metralhadora' },
  { key: 'sfx.weapon.shotgun', make: shotgun, role: 'tiro da escopeta' },
  { key: 'sfx.weapon.dry', make: dryFire, role: 'sem munição' },
  { key: 'sfx.impact.concrete', make: impactConcrete, role: 'bala no cenário' },
  { key: 'sfx.impact.metal', make: impactMetal, role: 'bala em metal' },
  { key: 'sfx.impact.armor', make: impactArmor, role: 'acerto que NÃO é ponto fraco' },
  { key: 'sfx.impact.core', make: impactCore, role: 'acerto no ponto fraco do boss' },
  { key: 'sfx.explosion.small', make: () => explosion(0.5, 0x5311, 0.85), role: 'barril, inimigo' },
  { key: 'sfx.explosion.medium', make: () => explosion(0.8, 0x5312, 0.95), role: 'granada' },
  { key: 'sfx.explosion.large', make: () => explosion(1.4, 0x5313, 1.0), role: 'morte do boss' },
  { key: 'sfx.player.jump', make: jump, role: 'pulo' },
  { key: 'sfx.player.land', make: land, role: 'aterrissagem pesada' },
  { key: 'sfx.player.hurt', make: playerHurt, role: 'jogador tomou dano' },
  { key: 'sfx.player.death', make: playerDeath, role: 'fim da vida' },
  { key: 'sfx.enemy.death', make: enemyDeath, role: 'inimigo comum caiu' },
  { key: 'sfx.pickup.item', make: pickup, role: 'item recolhido' },
  { key: 'sfx.progress.checkpoint', make: checkpoint, role: 'checkpoint gravado' },
  { key: 'sfx.progress.extraLife', make: extraLife, role: 'vida extra' },
  { key: 'sfx.boss.gate', make: gateClose, role: 'portão da arena fechando' },
  { key: 'sfx.boss.telegraph', make: bossTelegraph, role: 'antecipação de ataque do boss' },
  { key: 'sfx.boss.vent', make: bossVent, role: 'ventoinhas abrindo — hora de atirar' },
  { key: 'sfx.ui.select', make: uiSelect, role: 'navegação de menu' },
  { key: 'sfx.ui.confirm', make: uiConfirm, role: 'confirmação de menu' },
];

export const MUSIC = [
  { key: 'music.level01', make: musicLevel, role: 'fase 1' },
  { key: 'music.boss', make: musicBoss, role: 'luta contra o Estivador' },
];
