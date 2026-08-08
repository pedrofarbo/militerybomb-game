import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  createDamageResult,
  createHealth,
  healTo,
  tickHealth,
  type DamageInfo,
} from '../../src/core/combat/health';
import {
  aabbOverlap,
  circleOverlapsAabb,
  distanceToAabb,
  explosionDamageAt,
  hasLineOfSight,
  type Aabb,
} from '../../src/core/combat/overlap';
import { EXPLOSIONS } from '../../src/core/combat/explosives';

function hit(partial: Partial<DamageInfo> = {}): DamageInfo {
  return {
    amount: 10,
    kind: 'bullet',
    sourceId: 1,
    originX: 0,
    originY: 0,
    knockback: 0,
    ...partial,
  };
}

describe('dano', () => {
  it('subtrai a vida e reporta o quanto aplicou', () => {
    const h = createHealth(20);
    const out = createDamageResult();

    applyDamage(h, hit({ amount: 7 }), 0, 0, 0, out);

    expect(h.current).toBe(13);
    expect(out.applied).toBe(7);
    expect(out.killed).toBe(false);
  });

  it('nunca aplica mais dano do que a vida restante', () => {
    const h = createHealth(5);
    const out = createDamageResult();

    applyDamage(h, hit({ amount: 999 }), 0, 0, 0, out);

    expect(out.applied).toBe(5);
    expect(h.current).toBe(0);
    expect(out.killed).toBe(true);
  });

  it('um alvo morto não recebe mais dano', () => {
    const h = createHealth(5);
    const out = createDamageResult();

    applyDamage(h, hit({ amount: 10 }), 0, 0, 0, out);
    applyDamage(h, hit({ amount: 10 }), 0, 0, 0, out);

    expect(out.rejected).toBe('already-dead');
    expect(out.applied).toBe(0);
  });
});

describe('invulnerabilidade', () => {
  it('bloqueia dano durante os i-frames e volta a aceitar depois', () => {
    const h = createHealth(6, 900);
    const out = createDamageResult();

    applyDamage(h, hit({ amount: 1 }), 0, 0, 0, out);
    expect(out.applied).toBe(1);

    applyDamage(h, hit({ amount: 1 }), 0, 0, 10, out);
    expect(out.rejected).toBe('invulnerable');
    expect(h.current).toBe(5);

    tickHealth(h, 900);
    applyDamage(h, hit({ amount: 1 }), 0, 0, 950, out);
    expect(out.applied).toBe(1);
    expect(h.current).toBe(4);
  });

  /**
   * Inimigos NÃO têm i-frames de propósito: com eles, apenas um dos cinco
   * pellets da escopeta contaria e a arma perderia a razão de existir.
   */
  it('sem i-frames, todos os pellets de uma rajada contam', () => {
    const h = createHealth(40, 0);
    const out = createDamageResult();

    for (let i = 0; i < 5; i++) applyDamage(h, hit({ amount: 7 }), 0, 0, 0, out);

    expect(h.current).toBe(5);
  });
});

describe('empurrão', () => {
  it('empurra na direção oposta à origem do golpe', () => {
    const h = createHealth(20);
    const out = createDamageResult();

    applyDamage(h, hit({ originX: 0, originY: 0, knockback: 100 }), 50, 0, 0, out);

    expect(out.knockbackX).toBeGreaterThan(0);
  });

  it('a componente vertical é atenuada — empurrar para o alto atrapalha a leitura', () => {
    const h = createHealth(20);
    const out = createDamageResult();

    applyDamage(h, hit({ originX: 0, originY: 100, knockback: 100 }), 0, 0, 0, out);

    expect(Math.abs(out.knockbackY)).toBeLessThan(100);
  });

  it('golpe exatamente no centro não divide por zero', () => {
    const h = createHealth(20);
    const out = createDamageResult();

    applyDamage(h, hit({ originX: 10, originY: 10, knockback: 100 }), 10, 10, 0, out);

    expect(Number.isFinite(out.knockbackX)).toBe(true);
    expect(Number.isFinite(out.knockbackY)).toBe(true);
  });
});

describe('cura', () => {
  it('não passa do máximo', () => {
    const h = createHealth(6);
    h.current = 4;
    expect(healTo(h, 10)).toBe(2);
    expect(h.current).toBe(6);
  });
});

describe('geometria de combate', () => {
  const box: Aabb = { x: 100, y: 100, w: 20, h: 40 };

  it('detecta sobreposição de caixas', () => {
    expect(aabbOverlap(box, { x: 110, y: 110, w: 10, h: 10 })).toBe(true);
    expect(aabbOverlap(box, { x: 200, y: 100, w: 10, h: 10 })).toBe(false);
    // Encostadas mas sem sobrepor.
    expect(aabbOverlap(box, { x: 120, y: 100, w: 10, h: 10 })).toBe(false);
  });

  it('mede a distância até a BORDA da caixa, não até o centro', () => {
    expect(distanceToAabb(110, 120, box)).toBe(0); // dentro
    expect(distanceToAabb(130, 120, box)).toBe(10); // 10 px à direita da borda
  });

  it('círculo alcança a caixa pela borda mais próxima', () => {
    expect(circleOverlapsAabb(130, 120, 9, box)).toBe(false);
    expect(circleOverlapsAabb(130, 120, 11, box)).toBe(true);
  });
});

describe('explosões', () => {
  const def = EXPLOSIONS.grenade;

  it('dano máximo no centro e mínimo na borda', () => {
    const atCenter = explosionDamageAt(def, 110, 120, { x: 100, y: 100, w: 20, h: 40 });
    expect(atCenter).toBe(def.damageAtCenter);

    // Exatamente na borda do raio, alinhado no eixo X.
    const atEdge = explosionDamageAt(def, 0, 0, { x: def.radius, y: 0, w: 1, h: 1 });
    expect(atEdge).toBeCloseTo(def.damageAtEdge, 5);
  });

  it('não atinge nada fora do raio', () => {
    const far = explosionDamageAt(def, 0, 0, { x: 500, y: 500, w: 20, h: 20 });
    expect(far).toBe(0);
  });

  it('o dano cai com a distância, sem degraus', () => {
    const near = explosionDamageAt(def, 0, 0, { x: 10, y: 0, w: 4, h: 4 });
    const mid = explosionDamageAt(def, 0, 0, { x: 30, y: 0, w: 4, h: 4 });
    const far = explosionDamageAt(def, 0, 0, { x: 50, y: 0, w: 4, h: 4 });
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  /**
   * Medir até a borda importa: um alvo grande encostado na explosão levando
   * dano de borda porque o CENTRO dele está longe faz o jogo parecer quebrado.
   */
  it('alvo grande encostado na explosão leva dano alto', () => {
    const big: Aabb = { x: 5, y: -50, w: 200, h: 200 };
    expect(explosionDamageAt(def, 0, 0, big)).toBeGreaterThan(def.damageAtCenter * 0.85);
  });
});

describe('linha de visão', () => {
  const TILE = 16;
  // Parede vertical na coluna 5.
  const wall = (tx: number, _ty: number): boolean => tx === 5;
  const openField = (): boolean => false;

  it('enxerga em campo aberto', () => {
    expect(hasLineOfSight(8, 8, 200, 8, TILE, openField)).toBe(true);
  });

  it('a parede bloqueia', () => {
    expect(hasLineOfSight(8, 8, 200, 8, TILE, wall)).toBe(false);
  });

  it('enxerga se o alvo está antes da parede', () => {
    expect(hasLineOfSight(8, 8, 60, 8, TILE, wall)).toBe(true);
  });

  it('enxerga na diagonal quando não há obstáculo', () => {
    expect(hasLineOfSight(8, 8, 120, 120, TILE, openField)).toBe(true);
  });

  it('estar dentro de um tile sólido não enxerga nada', () => {
    expect(hasLineOfSight(88, 8, 8, 8, TILE, wall)).toBe(false);
  });
});
