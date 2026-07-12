import Phaser from 'phaser';
import { PALETTE } from './theme';

/**
 * Shared CRT / security-camera visual effects.
 * All textures are generated once per game and reused across scenes.
 */

const NOISE_KEY = 'crt-noise';
const NOISE_SIZE = 256;

/**
 * Ensure the static-noise texture exists (generated once per game).
 * Grayscale random pixels — tint/alpha at the sprite level for different uses.
 */
export function ensureNoiseTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(NOISE_KEY)) return NOISE_KEY;

  const tex = scene.textures.createCanvas(NOISE_KEY, NOISE_SIZE, NOISE_SIZE);
  if (!tex) return NOISE_KEY;
  const ctx = tex.getContext();
  const img = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return NOISE_KEY;
}

/**
 * Animated TV-static sprite covering the given rect.
 * Jitters the tile position every few frames to fake re-randomized noise.
 * Returns the sprite; caller sets depth/alpha and adds to containers.
 */
export function addStatic(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.06
): Phaser.GameObjects.TileSprite {
  ensureNoiseTexture(scene);
  const sprite = scene.add.tileSprite(x, y, width, height, NOISE_KEY);
  sprite.setAlpha(alpha);

  const jitter = scene.time.addEvent({
    delay: 50,
    loop: true,
    callback: () => {
      sprite.tilePositionX = Math.random() * NOISE_SIZE;
      sprite.tilePositionY = Math.random() * NOISE_SIZE;
    },
  });
  sprite.once('destroy', () => jitter.remove());
  return sprite;
}

/**
 * Horizontal scanlines over the given rect. Cheap, static graphics.
 */
export function addScanlines(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.12,
  pitch = 4
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x000000, alpha);
  for (let sy = 0; sy < height; sy += pitch) {
    g.lineBetween(x, y + sy, x + width, y + sy);
  }
  return g;
}

/**
 * Dark vignette + amber edge glow — the standard menu backdrop treatment.
 */
export function addVignette(
  scene: Phaser.Scene,
  width: number,
  height: number
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  // Edge glow (emergency lighting)
  g.fillStyle(0x2a1200, 0.35);
  g.fillRect(0, 0, 70, height);
  g.fillRect(width - 70, 0, 70, height);
  g.fillStyle(0x180a00, 0.3);
  g.fillRect(0, height - 100, width, 100);
  // Top darkness
  g.fillStyle(0x000000, 0.5);
  g.fillRect(0, 0, width, 55);
  return g;
}

/**
 * One-shot glitch burst: a full-strength static flash plus a horizontal
 * jitter on the given targets. Used on scene transitions and portrait twitches.
 */
export function glitchBurst(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.Components.Transform[] = [],
  duration = 140,
  depth = 500
): void {
  const cam = scene.cameras.main;
  const flash = addStatic(scene, cam.width / 2, cam.height / 2, cam.width, cam.height, 0.22);
  flash.setDepth(depth);
  flash.setTint(PALETTE.amber);

  scene.time.delayedCall(duration, () => flash.destroy());

  targets.forEach((t) => {
    const originalX = t.x;
    scene.tweens.add({
      targets: t,
      x: { from: originalX + Phaser.Math.Between(-9, 9), to: originalX },
      duration: duration,
      ease: 'Stepped',
      onComplete: () => {
        t.x = originalX;
      },
    });
  });
}

/**
 * Subtle looping vertical-hold jitter (VHS pause wobble) on a container.
 * Returns the timer so callers can pause/remove it.
 */
export function addVerticalHoldJitter(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  baseY = 0
): Phaser.Time.TimerEvent {
  return scene.time.addEvent({
    delay: 90,
    loop: true,
    callback: () => {
      // Mostly rest, occasional 1-2px vertical slip
      target.y = Math.random() < 0.2 ? baseY + Phaser.Math.Between(-2, 2) : baseY;
    },
  });
}
