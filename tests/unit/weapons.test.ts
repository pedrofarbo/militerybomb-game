import { describe, expect, it } from 'vitest';
import { createFireOutcome, tryFire, type FireContext } from '../../src/core/weapons/fire';
import { createWeaponState } from '../../src/core/weapons/weapon-def';
import { WEAPONS } from '../../src/core/weapons/weapons.data';
import { createRng } from '../../src/core/math';

function makeContext(partial: Partial<FireContext> = {}): FireContext {
  return {
    x: 0,
    y: 0,
    angleRad: 0,
    ownerId: 1,
    team: 'player',
    triggerHeld: true,
    triggerPressed: true,
    random: createRng(1),
    ...partial,
  };
}

describe('armas — cadência e gatilho', () => {
  it('respeita a cadência de tiro', () => {
    const def = WEAPONS.machinegun;
    const state = createWeaponState(def);
    const out = createFireOutcome();
    const ctx = makeContext();

    tryFire(state, def, ctx, 0, out);
    expect(out.fired).toBe(true);

    tryFire(state, def, makeContext({ triggerPressed: false }), def.fireRateMs - 1, out);
    expect(out.fired).toBe(false);
    expect(out.reason).toBe('cooldown');

    tryFire(state, def, makeContext({ triggerPressed: false }), def.fireRateMs, out);
    expect(out.fired).toBe(true);
  });

  it('arma semiautomática não dispara segurando o gatilho', () => {
    const def = WEAPONS.pistol;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    tryFire(state, def, makeContext(), 0, out);
    expect(out.fired).toBe(true);

    tryFire(state, def, makeContext({ triggerPressed: false }), 10_000, out);
    expect(out.fired).toBe(false);
    expect(out.reason).toBe('semi-auto');
  });

  it('semiautomática volta a disparar depois de soltar e apertar', () => {
    const def = WEAPONS.pistol;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    tryFire(state, def, makeContext(), 0, out);
    tryFire(state, def, makeContext({ triggerHeld: false, triggerPressed: false }), 500, out);
    tryFire(state, def, makeContext(), 1000, out);

    expect(out.fired).toBe(true);
  });

  it('automática dispara enquanto o gatilho estiver segurado', () => {
    const def = WEAPONS.machinegun;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    let shots = 0;
    for (let t = 0; t <= 500; t += def.fireRateMs) {
      tryFire(state, def, makeContext({ triggerPressed: false }), t, out);
      if (out.fired) shots++;
    }
    expect(shots).toBeGreaterThan(4);
  });
});

describe('armas — munição', () => {
  it('consome munição e para ao esgotar', () => {
    const def = WEAPONS.shotgun;
    const state = createWeaponState(def);
    state.ammo = 2;
    const out = createFireOutcome();

    tryFire(state, def, makeContext(), 0, out);
    expect(state.ammo).toBe(1);

    tryFire(state, def, makeContext(), def.fireRateMs, out);
    expect(state.ammo).toBe(0);

    tryFire(state, def, makeContext(), def.fireRateMs * 2, out);
    expect(out.fired).toBe(false);
    expect(out.reason).toBe('no-ammo');
  });

  it('arma inicial nunca fica sem munição', () => {
    const def = WEAPONS.pistol;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    for (let i = 0; i < 50; i++) {
      tryFire(state, def, makeContext(), i * def.fireRateMs, out);
    }
    expect(state.ammo).toBe('infinite');
  });
});

describe('armas — dispersão', () => {
  it('escopeta gera todos os pellets em um único disparo', () => {
    const def = WEAPONS.shotgun;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    tryFire(state, def, makeContext(), 0, out);

    expect(out.shots).toHaveLength(def.pelletsPerShot);
    const angles = out.shots.map((s) => s.angleRad);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(0.2);
  });

  it('precisão da metralhadora cai com o fogo contínuo e se recupera parada', () => {
    const def = WEAPONS.machinegun;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    for (let i = 0; i < 8; i++) {
      tryFire(state, def, makeContext({ triggerPressed: false }), i * def.fireRateMs, out);
    }
    const hot = state.spreadDeg;
    expect(hot).toBeGreaterThan(def.spreadDeg);

    tryFire(
      state,
      def,
      makeContext({ triggerHeld: false, triggerPressed: false }),
      8 * def.fireRateMs + def.spreadRecoveryMs * 2,
      out,
    );
    expect(state.spreadDeg).toBeLessThan(hot);
  });

  it('mesma semente produz a mesma dispersão (replays reprodutíveis)', () => {
    const def = WEAPONS.shotgun;
    const fire = (): number[] => {
      const state = createWeaponState(def);
      const out = createFireOutcome();
      tryFire(state, def, makeContext({ random: createRng(42) }), 0, out);
      return out.shots.map((s) => s.angleRad);
    };
    expect(fire()).toEqual(fire());
  });

  it('projétil herda dono, time e dano da arma', () => {
    const def = WEAPONS.machinegun;
    const state = createWeaponState(def);
    const out = createFireOutcome();

    tryFire(state, def, makeContext({ ownerId: 7, team: 'enemy' }), 0, out);

    expect(out.shots[0]).toMatchObject({ ownerId: 7, team: 'enemy', damage: def.damage });
  });
});
