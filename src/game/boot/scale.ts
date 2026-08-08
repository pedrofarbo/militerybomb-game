/**
 * Escala: altura lógica FIXA, largura ELÁSTICA.
 *
 * A alternativa óbvia (`Scale.FIT` numa resolução fixa) letterboxa muito em
 * telas 19.5:9 de celular. Aqui a altura é sempre 360 px lógicos — então o
 * balanceamento vertical nunca muda entre aparelhos — e a largura estica entre
 * 640 e 800 para preencher a tela.
 *
 * O canvas renderiza SEMPRE na resolução lógica (≤ 800×360 = 288 mil pixels) e
 * o upscale é feito pelo CSS com `image-rendering: pixelated`. Isso é o que
 * mais economiza GPU em celular: um aparelho 1080p desenha 288k pixels por
 * frame em vez de 2 milhões.
 */

import { WORLD } from '../../core/config/tuning';
import { clamp } from '../../core/math';

export interface LogicalSize {
  width: number;
  height: number;
  /** Fator de upscale aplicado por CSS (pode ser fracionário). */
  zoom: number;
}

export function computeLogicalSize(viewportWidth: number, viewportHeight: number): LogicalSize {
  const height = WORLD.height;
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  // Largura par: meio-pixel em resolução lógica produz costura no tilemap.
  const raw = Math.round((height * aspect) / 2) * 2;
  const width = clamp(raw, WORLD.widthMin, WORLD.widthMax);
  const zoom = Math.min(viewportWidth / width, viewportHeight / height);
  return { width, height, zoom };
}

export function isPortrait(viewportWidth: number, viewportHeight: number): boolean {
  return viewportHeight > viewportWidth;
}
