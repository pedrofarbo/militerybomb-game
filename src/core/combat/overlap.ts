/**
 * Consultas geométricas de combate.
 *
 * Projéteis usam o broadphase do Arcade; explosões e hitboxes de ataque usam
 * estas funções, porque são poucas dezenas de caixas por frame e porque assim
 * a regra fica testável sem motor de física.
 *
 * Convenção: `Aabb` é canto superior esquerdo + tamanho, igual ao corpo Arcade.
 */

export interface Aabb {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExplosionDef {
  readonly radius: number;
  readonly damageAtCenter: number;
  readonly damageAtEdge: number;
  readonly knockback: number;
  /** Trauma de câmera 0..1. */
  readonly shake: number;
  readonly fx: string;
}

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Distância do ponto até a caixa (0 se estiver dentro). */
export function distanceToAabb(px: number, py: number, box: Aabb): number {
  const dx = Math.max(box.x - px, 0, px - (box.x + box.w));
  const dy = Math.max(box.y - py, 0, py - (box.y + box.h));
  return Math.hypot(dx, dy);
}

export function circleOverlapsAabb(cx: number, cy: number, radius: number, box: Aabb): boolean {
  return distanceToAabb(cx, cy, box) <= radius;
}

/**
 * Dano de explosão com queda linear pela distância.
 *
 * A distância é medida até a BORDA da caixa, não até o centro: um alvo grande
 * encostado na explosão tomar dano de borda porque o centro dele está longe é
 * o tipo de coisa que faz o jogador achar que o jogo está quebrado.
 */
export function explosionDamageAt(def: ExplosionDef, cx: number, cy: number, box: Aabb): number {
  const distance = distanceToAabb(cx, cy, box);
  if (distance > def.radius) return 0;
  const t = def.radius <= 0 ? 0 : distance / def.radius;
  return def.damageAtCenter + (def.damageAtEdge - def.damageAtCenter) * t;
}

export function aabbCenterX(box: Aabb): number {
  return box.x + box.w / 2;
}

export function aabbCenterY(box: Aabb): number {
  return box.y + box.h / 2;
}

/**
 * Linha de visão sobre uma grade de tiles sólidos (DDA de Amanatides & Woo).
 * A camada de jogo passa um predicado que consulta o tilemap; a lógica de
 * travessia fica aqui, testável com uma grade sintética.
 */
export function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize: number,
  isSolid: (tileX: number, tileY: number) => boolean,
): boolean {
  let tileX = Math.floor(x0 / tileSize);
  let tileY = Math.floor(y0 / tileSize);
  const endX = Math.floor(x1 / tileSize);
  const endY = Math.floor(y1 / tileSize);

  if (isSolid(tileX, tileY)) return false;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);

  // Comprimento do raio para cruzar um tile em cada eixo.
  const tDeltaX = dx === 0 ? Infinity : Math.abs(tileSize / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(tileSize / dy);

  const nextBoundaryX = (tileX + (stepX > 0 ? 1 : 0)) * tileSize;
  const nextBoundaryY = (tileY + (stepY > 0 ? 1 : 0)) * tileSize;
  let tMaxX = dx === 0 ? Infinity : (nextBoundaryX - x0) / dx;
  let tMaxY = dy === 0 ? Infinity : (nextBoundaryY - y0) / dy;

  // Teto de passos: protege contra coordenadas absurdas travarem o frame.
  const maxSteps = 512;
  for (let i = 0; i < maxSteps; i++) {
    if (tileX === endX && tileY === endY) return true;
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      tileX += stepX;
    } else {
      tMaxY += tDeltaY;
      tileY += stepY;
    }
    if (tMaxX > 1 && tMaxY > 1) return true;
    if (isSolid(tileX, tileY)) return false;
  }
  return false;
}
