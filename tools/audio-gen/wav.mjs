/**
 * Codificador WAV mínimo, sem dependências.
 *
 * O mesmo raciocínio do `png.mjs`: um formato de container simples escrito à
 * mão vale muito mais do que uma dependência para gerar placeholder. RIFF/PCM
 * cabe em 40 linhas e é lido por todo browser.
 *
 * PCM 16 bits mono. 16 bits e não 8 porque o ruído de quantização de 8 bits
 * aparece justamente nas caudas longas (explosões, reverb) — e é ali que se
 * julga se um som "termina" ou "corta".
 */

const HEADER_BYTES = 44;

/**
 * @param {Float32Array} samples  amostras em -1..1
 * @param {number} sampleRate
 * @returns {Uint8Array} arquivo .wav completo
 */
export function encodeWav(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // tamanho do bloco fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // alinhamento de bloco
  view.setUint16(34, 16, true); // bits por amostra
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    // Satura em vez de dar a volta: um som alto demais deve distorcer, não
    // virar estalo — e estalo é exatamente o que o wraparound produz.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, Math.round(clamped * 32767), true);
  }

  return new Uint8Array(buffer);
}
