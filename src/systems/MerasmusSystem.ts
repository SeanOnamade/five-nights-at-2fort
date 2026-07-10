import Phaser from 'phaser';
import { GameStatus, GAME_CONSTANTS } from '../types';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import type { GameAudio } from '../audio/GameAudio';

/** Scene state/actions the Merasmus mechanic needs; implemented by GameScene. */
export interface MerasmusHost {
  isMerasmusEnabled(): boolean;
  getGameStatus(): GameStatus;
  isPausedNow(): boolean;
  isTeleportedNow(): boolean;
  isCameraModeNow(): boolean;
  clearAimKeys(): void;
  gameOver(reason: string): void;
  onFlipStateChanged(): void;
}

/**
 * Merasmus (Custom Night): the screen-mirror mechanic. The wizard builds up in
 * the doorway while the view is normal; flipping the whole screen (CSS mirror)
 * repels him. Owns the vignette/figure overlays, the DOM canvas mirror, and the
 * pointer-coordinate fix the mirror requires. Extracted from GameScene.
 */
export class MerasmusSystem {
  private viewFlipped = false;
  private linearProgress = 0;
  private respiteUnflippedMs = 0;
  private inRespite = false;
  // Original InputManager.transformPointer, restored on uninstall
  private stockTransformPointer: Phaser.Input.InputManager['transformPointer'] | null = null;
  private vignette!: Phaser.GameObjects.Container;
  private figureContainer!: Phaser.GameObjects.Container;

  constructor(
    private scene: Phaser.Scene,
    private audio: GameAudio,
    private host: MerasmusHost,
  ) {}

  isViewFlipped(): boolean {
    return this.viewFlipped;
  }

  reset(): void {
    this.linearProgress = 0;
    this.respiteUnflippedMs = 0;
    this.inRespite = false;
    this.setDomMirror(false);
    this.audio.stopMerasmusHum();
    if (this.vignette) {
      this.vignette.setVisible(false);
      this.vignette.setAlpha(0);
    }
    if (this.figureContainer) {
      this.figureContainer.setVisible(false);
      this.figureContainer.setAlpha(0);
    }
  }

  private getDisplayAlpha(): number {
    const p = Phaser.Math.Clamp(this.linearProgress, 0, 1);
    return Math.pow(p, GAME_CONSTANTS.MERASMUS_EASE_POWER);
  }

  private setDomMirror(mirrored: boolean): void {
    if (mirrored && !this.host.isMerasmusEnabled()) return;
    this.viewFlipped = mirrored;
    const canvas = this.scene.game?.canvas;
    if (!canvas) return;
    if (mirrored) {
      canvas.style.transform = 'scaleX(-1)';
      canvas.style.transformOrigin = '50% 50%';
    } else {
      canvas.style.transform = '';
      canvas.style.transformOrigin = '';
    }
    this.host.onFlipStateChanged();
  }

  /**
   * CSS scaleX(-1) on the canvas does not mirror DOM coordinates Phaser receives, so hit tests miss.
   * Wrap InputManager.transformPointer to invert X in game space whenever the Merasmus mirror is active.
   */
  installPointerMirrorFix(): void {
    if (this.stockTransformPointer !== null) return;
    const im = this.scene.input.manager;
    this.stockTransformPointer = im.transformPointer.bind(im);
    im.transformPointer = (pointer, pageX, pageY, wasMove) => {
      this.stockTransformPointer!.call(im, pointer, pageX, pageY, wasMove);
      if (this.viewFlipped && this.host.isMerasmusEnabled()) {
        const w = this.scene.scale.width;
        pointer.position.x = w - pointer.position.x;
      }
    };
  }

  uninstallPointerMirrorFix(): void {
    if (this.stockTransformPointer === null) return;
    this.scene.input.manager.transformPointer = this.stockTransformPointer;
    this.stockTransformPointer = null;
  }

  createOverlays(): void {
    const width = 1280;
    const height = 720;

    this.vignette = this.scene.add.container(0, 0);
    this.vignette.setDepth(140);
    const vignetteGfx = this.scene.add.graphics();
    const fadeDepth = 360;
    const green = 0x44ff66;
    const edgeAlpha = 0.14;

    // Screen-edge vignette only — soft linear fades, no corner rings
    vignetteGfx.fillGradientStyle(green, green, green, green, edgeAlpha, edgeAlpha, 0, 0);
    vignetteGfx.fillRect(0, 0, width, fadeDepth);
    vignetteGfx.fillGradientStyle(green, green, green, green, 0, 0, edgeAlpha, edgeAlpha);
    vignetteGfx.fillRect(0, height - fadeDepth, width, fadeDepth);
    vignetteGfx.fillGradientStyle(green, green, green, green, edgeAlpha, 0, edgeAlpha, 0);
    vignetteGfx.fillRect(0, 0, fadeDepth, height);
    vignetteGfx.fillGradientStyle(green, green, green, green, 0, edgeAlpha, 0, edgeAlpha);
    vignetteGfx.fillRect(width - fadeDepth, 0, fadeDepth, height);

    this.vignette.add(vignetteGfx);
    this.vignette.setVisible(false);
    this.vignette.setAlpha(0);

    // Door frame is 260px tall — scale Merasmus to match wizard height
    const doorCenterY = height / 2 - 50;
    this.figureContainer = this.scene.add.container(640, doorCenterY + 8);
    this.figureContainer.setDepth(141);
    const figure = this.scene.add.graphics();
    drawCharacterSilhouette(figure, 0, 0, 'MERASMUS', 0x8866dd);
    this.figureContainer.add(figure);
    this.figureContainer.setScale(2.05);
    this.figureContainer.setVisible(false);
    this.figureContainer.setAlpha(0);
  }

  toggleFlip(): void {
    if (!this.host.isMerasmusEnabled()) return;
    if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow() || this.host.isTeleportedNow()) return;
    // Clear edge holds so swapped zone→key mapping doesn't leave stale aim
    this.host.clearAimKeys();
    this.setDomMirror(!this.viewFlipped);
    this.audio.playMerasmusFlipSound(this.viewFlipped);
  }

  update(delta: number): void {
    if (!this.host.isMerasmusEnabled()) return;

    if (this.host.isTeleportedNow()) {
      if (this.vignette) {
        this.vignette.setVisible(false);
      }
      if (this.figureContainer) {
        this.figureContainer.setVisible(false);
      }
      this.audio.updateMerasmusHumVolume(0);
      return;
    }

    const buildTime = GAME_CONSTANTS.MERASMUS_BUILD_TIME_MS;
    const repelMult = GAME_CONSTANTS.MERASMUS_REPEL_MULTIPLIER;
    const respiteMs = GAME_CONSTANTS.MERASMUS_RESPITE_UNFLIPPED_MS;

    if (this.linearProgress >= 1) {
      this.audio.playMerasmusCackle();
      this.host.gameOver('Merasmus got you!');
      return;
    }

    if (this.inRespite) {
      if (this.viewFlipped) {
        this.respiteUnflippedMs = 0;
      } else {
        this.respiteUnflippedMs += delta;
        if (this.respiteUnflippedMs >= respiteMs) {
          this.inRespite = false;
          this.respiteUnflippedMs = 0;
        }
      }
    } else if (this.viewFlipped && this.linearProgress > 0) {
      this.linearProgress -= (repelMult * delta) / buildTime;
      if (this.linearProgress <= 0) {
        this.linearProgress = 0;
        this.inRespite = true;
        this.respiteUnflippedMs = 0;
        this.playRespiteFlash();
      }
    } else if (!this.viewFlipped) {
      this.linearProgress += delta / buildTime;
      if (this.linearProgress >= 1) {
        this.linearProgress = 1;
      }
    }

    const displayAlpha = this.getDisplayAlpha();

    if (this.vignette) {
      const showVignette = displayAlpha > 0.001;
      this.vignette.setVisible(showVignette);
      this.vignette.setAlpha(displayAlpha * 0.18);
    }

    if (this.figureContainer) {
      const showFigure = displayAlpha > 0.001 && !this.host.isCameraModeNow();
      this.figureContainer.setVisible(showFigure);
      this.figureContainer.setAlpha(displayAlpha);
      this.figureContainer.setScale(2.05 + displayAlpha * 0.2);
    }

    this.audio.updateMerasmusHumVolume(displayAlpha);
  }

  /** Brief green flash when repel completes — signals safe to unflip */
  private playRespiteFlash(): void {
    this.scene.cameras.main.flash(320, 48, 200, 72, false);
  }
}
