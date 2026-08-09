/**
 * Aplica a câmera calculada em `core/camera/director.ts` à câmera do Phaser.
 *
 * Deliberadamente NÃO usamos `camera.startFollow` nem `camera.shake`: a lógica
 * de deadzone, lookahead e trauma precisa ser testável e ajustável, e o
 * `startFollow` do Phaser esconde tudo isso dentro do motor.
 */

import type Phaser from 'phaser';
import {
  addTrauma,
  createCameraState,
  stepCamera,
  type CameraState,
  type CameraTarget,
} from '../../core/camera/director';

export class CameraDirector {
  private readonly state: CameraState;
  private readonly target: CameraTarget = { x: 0, y: 0, facing: 1, vx: 0, grounded: true };
  private readonly bounds = { left: 0, width: 0, height: 0 };
  private readonly viewport = { width: 0, height: 0 };

  /** 0..1, vindo das Settings (acessibilidade). */
  shakeIntensity = 1;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    x: number,
    y: number,
  ) {
    this.state = createCameraState(x, y);
  }

  setBounds(width: number, height: number): void {
    this.bounds.left = 0;
    this.bounds.width = width;
    this.bounds.height = height;
  }

  /**
   * Prende a câmera a um trecho da fase (arena de boss) e a solta depois.
   *
   * Sem isto, o jogador poderia empurrar a câmera para fora da arena durante a
   * luta — e o boss sairia de quadro justamente quando ele mais importa.
   */
  setLimits(left: number, right: number): void {
    this.bounds.left = left;
    this.bounds.width = Math.max(0, right - left);
  }

  shake(trauma: number): void {
    addTrauma(this.state, trauma);
  }

  /** Coloca a câmera no alvo imediatamente (spawn, respawn, troca de área). */
  snapTo(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    this.state.anchorY = y;
    this.state.lookahead = 0;
    this.state.trauma = 0;
    this.apply();
  }

  update(x: number, y: number, vx: number, facing: -1 | 1, grounded: boolean, dtMs: number): void {
    this.target.x = x;
    this.target.y = y;
    this.target.vx = vx;
    this.target.facing = facing;
    this.target.grounded = grounded;

    this.viewport.width = this.camera.width;
    this.viewport.height = this.camera.height;

    stepCamera(this.state, this.target, this.viewport, this.bounds, dtMs, this.shakeIntensity);
    this.apply();
  }

  private apply(): void {
    // `Math.round` no scroll: sem isso o tilemap mostra costuras de 1 px
    // enquanto a câmera está numa coordenada fracionária.
    this.camera.scrollX = Math.round(
      this.state.x - this.camera.width / 2 + this.state.shakeOffsetX,
    );
    this.camera.scrollY = Math.round(
      this.state.y - this.camera.height / 2 + this.state.shakeOffsetY,
    );
    this.camera.setRotation(this.state.shakeAngle);
  }

  get debugState(): Readonly<CameraState> {
    return this.state;
  }
}
