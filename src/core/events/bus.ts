/**
 * Event bus tipado.
 *
 * Existe para que HUD, áudio e FX reajam ao gameplay sem que o gameplay
 * conheça nenhum deles. É deliberadamente pequeno: ~40 linhas resolvem o
 * problema, e uma biblioteca de estado resolveria um problema que não temos.
 */

import type { QualityLevel } from '../config/tuning';

export interface GameEventMap {
  'player:spawned': { x: number; y: number };
  'player:damaged': { hp: number; max: number };
  'player:died': { atCheckpointId: string | null };
  'player:jumped': { x: number; y: number };
  'player:landed': { x: number; y: number; fallSpeed: number };
  'player:fired': { x: number; y: number; angleRad: number; weaponId: string };
  'weapon:changed': { weaponId: string; ammo: number | 'infinite' };
  'ammo:changed': { ammo: number | 'infinite' };
  'grenades:changed': { count: number };
  'score:changed': { score: number; delta: number };
  'enemy:killed': { typeId: string; x: number; y: number };
  'checkpoint:reached': { id: string };
  'level:complete': { levelId: string; timeMs: number; score: number };
  'quality:changed': { level: QualityLevel };
  'input:deviceChanged': { device: 'keyboard' | 'gamepad' | 'touch' };
  'game:paused': { paused: boolean };
}

export type GameEventKey = keyof GameEventMap;
export type Unsubscribe = () => void;

export interface GameEventBus {
  on<K extends GameEventKey>(key: K, fn: (payload: GameEventMap[K]) => void): Unsubscribe;
  once<K extends GameEventKey>(key: K, fn: (payload: GameEventMap[K]) => void): Unsubscribe;
  emit<K extends GameEventKey>(key: K, payload: GameEventMap[K]): void;
  clear(): void;
}

type AnyHandler = (payload: never) => void;

export function createEventBus(): GameEventBus {
  const handlers = new Map<GameEventKey, Set<AnyHandler>>();

  const on = <K extends GameEventKey>(
    key: K,
    fn: (payload: GameEventMap[K]) => void,
  ): Unsubscribe => {
    let set = handlers.get(key);
    if (!set) handlers.set(key, (set = new Set()));
    set.add(fn as AnyHandler);
    return () => {
      set.delete(fn as AnyHandler);
    };
  };

  return {
    on,
    once(key, fn) {
      const off = on(key, (payload) => {
        off();
        fn(payload);
      });
      return off;
    },
    emit(key, payload) {
      const set = handlers.get(key);
      if (!set) return;
      // Cópia rasa: um handler pode se desinscrever durante o despacho.
      for (const fn of [...set]) (fn as (p: GameEventMap[typeof key]) => void)(payload);
    },
    clear() {
      handlers.clear();
    },
  };
}
