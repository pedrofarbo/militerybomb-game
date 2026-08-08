/**
 * REDLINE — paleta de trabalho de 48 cores.
 * Esta é a MESMA paleta exigida da arte final (docs/ART_SPEC.md).
 * Os placeholders usam-na para que a troca por arte definitiva não altere
 * o "clima" de cor do jogo nem o contraste contra o cenário.
 */
export const PALETTE = {
  // Tinta / contornos (2)
  ink: '#0d0b12',
  inkSoft: '#1c1a26',

  // Concreto / neutros de cenário (5)
  con1: '#23272e',
  con2: '#333a44',
  con3: '#47505d',
  con4: '#5e6a79',
  con5: '#7d8a9a',

  // Metal (5)
  met1: '#3a4149',
  met2: '#545e69',
  met3: '#717e8c',
  met4: '#94a2b1',
  met5: '#c3cedb',

  // Laranja-ferrugem — facção do jogador (5)
  rust1: '#3d1a12',
  rust2: '#6e2e1c',
  rust3: '#a94c26',
  rust4: '#d97434',
  rust5: '#f2a24e',

  // Teal industrial — maquinário, energia, luz fria (5)
  teal1: '#0e2b30',
  teal2: '#16484f',
  teal3: '#1f6b74',
  teal4: '#2f959c',
  teal5: '#57c2c4',

  // Amarelo de sinalização — perigo, interativo, HUD (4)
  sig1: '#7a5a10',
  sig2: '#b88a17',
  sig3: '#e8bb28',
  sig4: '#f7dc6a',

  // Pele (4)
  skin1: '#6b3f2a',
  skin2: '#96603f',
  skin3: '#c08a5e',
  skin4: '#e0b189',

  // Consórcio Halcyon — inimigos, azul-petróleo escuro (4)
  hal1: '#14161f',
  hal2: '#232735',
  hal3: '#343a4d',
  hal4: '#4a5268',

  // Perigo / alerta (2)
  haz: '#d43b2f',
  hazDark: '#8a2119',

  // FX quentes: explosão, muzzle, faísca (5)
  fx1: '#fff3c4',
  fx2: '#ffd447',
  fx3: '#ff9420',
  fx4: '#e04b1c',
  fx5: '#7a2a12',

  // Fumaça / poeira (4)
  smoke1: '#2a2a30',
  smoke2: '#45464f',
  smoke3: '#63656f',
  smoke4: '#8a8c96',

  // Extremos + acento de UI (3)
  white: '#f2f5f8',
  black: '#05050a',
  uiAccent: '#e8bb28',
};

export const PALETTE_SIZE = Object.keys(PALETTE).length; // 48

/** '#rrggbb' -> [r,g,b,a] */
export function rgba(name, alpha = 255) {
  const hex = PALETTE[name];
  if (!hex) throw new Error(`Cor fora da paleta: "${name}"`);
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    alpha,
  ];
}

/** RNG determinístico — placeholders precisam ser byte-idênticos entre execuções. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
