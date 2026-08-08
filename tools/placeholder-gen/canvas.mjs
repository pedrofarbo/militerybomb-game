/** Canvas de pixels cru + helpers de desenho. Tudo em coordenadas inteiras. */
import { rgba } from './palette.mjs';

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const a = c[3];
    if (a === 0) return;
    if (a === 255) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    // alpha over
    const sa = a / 255;
    const da = this.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((c[k] * sa + this.data[i + k] * da * (1 - sa)) / (oa || 1));
    }
    this.data[i + 3] = Math.round(oa * 255);
  }

  /** Retângulo preenchido. */
  rect(x, y, w, h, color, alpha = 255) {
    const c = rgba(color, alpha);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }

  /** Retângulo só de contorno (1px). */
  stroke(x, y, w, h, color, alpha = 255) {
    const c = rgba(color, alpha);
    for (let i = 0; i < w; i++) {
      this.px(x + i, y, c);
      this.px(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.px(x, y + j, c);
      this.px(x + w - 1, y + j, c);
    }
    return this;
  }

  /** Bloco: preenchimento + contorno de tinta + realce de topo (leitura de volume). */
  block(x, y, w, h, fill, { outline = 'ink', top = null, alpha = 255 } = {}) {
    this.rect(x, y, w, h, fill, alpha);
    if (top && h > 2) this.rect(x + 1, y + 1, w - 2, 1, top, alpha);
    if (outline) this.stroke(x, y, w, h, outline, alpha);
    return this;
  }

  disc(cx, cy, r, color, alpha = 255) {
    const c = rgba(color, alpha);
    const r2 = r * r;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (i * i + j * j <= r2) this.px(cx + i, cy + j, c);
    return this;
  }

  ring(cx, cy, r, thickness, color, alpha = 255) {
    const c = rgba(color, alpha);
    const outer = r * r;
    const inner = (r - thickness) * (r - thickness);
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const d = i * i + j * j;
        if (d <= outer && d >= inner) this.px(cx + i, cy + j, c);
      }
    return this;
  }

  /**
   * Bresenham. As coordenadas são arredondadas na entrada: um argumento
   * fracionário faria o teste de término nunca casar e o laço nunca sair.
   */
  line(x0, y0, x1, y1, color, alpha = 255) {
    const c = rgba(color, alpha);
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      const e2 = 2 * err;
      if (e2 >= dy) {
        if (x0 === x1) break;
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        if (y0 === y1) break;
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Retângulo com cantos "cortados" — leitura mecânica sem curvas. */
  chamfer(x, y, w, h, fill, outline = 'ink', cut = 2) {
    this.rect(x + cut, y, w - cut * 2, h, fill);
    this.rect(x, y + cut, w, h - cut * 2, fill);
    for (let i = 0; i < cut; i++) {
      this.rect(x + cut - i, y + i, 1, 1, fill);
      this.rect(x + w - cut + i - 1, y + i, 1, 1, fill);
      this.rect(x + cut - i, y + h - 1 - i, 1, 1, fill);
      this.rect(x + w - cut + i - 1, y + h - 1 - i, 1, 1, fill);
    }
    if (outline) {
      const c = rgba(outline);
      for (let i = cut; i < w - cut; i++) {
        this.px(x + i, y, c);
        this.px(x + i, y + h - 1, c);
      }
      for (let j = cut; j < h - cut; j++) {
        this.px(x, y + j, c);
        this.px(x + w - 1, y + j, c);
      }
      for (let i = 0; i < cut; i++) {
        this.px(x + cut - 1 - i, y + i, c);
        this.px(x + w - cut + i, y + i, c);
        this.px(x + cut - 1 - i, y + h - 1 - i, c);
        this.px(x + w - cut + i, y + h - 1 - i, c);
      }
    }
    return this;
  }

  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] === 0) continue;
        const o = ((dy + y) * this.w + (dx + x)) * 4;
        if (dx + x < 0 || dy + y < 0 || dx + x >= this.w || dy + y >= this.h) continue;
        this.data[o] = src.data[i];
        this.data[o + 1] = src.data[i + 1];
        this.data[o + 2] = src.data[i + 2];
        this.data[o + 3] = src.data[i + 3];
      }
    return this;
  }

  /** Espelha horizontalmente (só usado para gerar variantes, não em runtime). */
  flipX() {
    const out = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        const o = (y * this.w + (this.w - 1 - x)) * 4;
        out.data.set(this.data.subarray(i, i + 4), o);
      }
    return out;
  }
}
