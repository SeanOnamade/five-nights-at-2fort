import Phaser from 'phaser';
import { PALETTE, headingStyle, osdStyle } from './theme';
import { addScanlines, addStatic, glitchBurst } from './effects';
import { createTextButton } from './widgets';
import { playMenuButtonSound } from '../../utils/menuSounds';

/**
 * Base class for full-screen terminal overlays (Survival Manual, Gallery,
 * Endings, Service Record, Settings). Provides the dark backdrop, panel,
 * OSD-style header, scanlines/static, and close behavior.
 */
export abstract class TerminalOverlay {
  protected container!: Phaser.GameObjects.Container;
  protected panelX = 0;
  protected panelY = 0;
  protected panelWidth = 0;
  protected panelHeight = 0;

  constructor(
    protected scene: Phaser.Scene,
    protected title: string,
    protected onClose?: () => void
  ) {}

  /**
   * Build the overlay shell (hidden). Subclasses add content via buildContent().
   */
  create(panelWidth = 900, panelHeight = 600, depth = 100): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(depth);
    this.container.setVisible(false);

    // Dark backdrop — clicking it closes the overlay
    const backdrop = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.94);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.hide());
    this.container.add(backdrop);

    this.panelX = width / 2;
    this.panelY = height / 2;
    this.panelWidth = panelWidth;
    this.panelHeight = panelHeight;

    // Terminal panel
    const panel = this.scene.add.rectangle(this.panelX, this.panelY, panelWidth, panelHeight, PALETTE.panel, 0.97);
    panel.setStrokeStyle(1, PALETTE.amberDim);
    // Swallow clicks so the backdrop close doesn't trigger through the panel
    panel.setInteractive();
    this.container.add(panel);

    // Header bar
    const headerY = this.panelY - panelHeight / 2 + 30;
    const headerRule = this.scene.add.rectangle(this.panelX, headerY + 24, panelWidth - 40, 1, PALETTE.amberFaint);
    this.container.add(headerRule);

    const heading = this.scene.add
      .text(this.panelX - panelWidth / 2 + 24, headerY, this.title, headingStyle(26, PALETTE.creamCss))
      .setOrigin(0, 0.5);
    this.container.add(heading);

    const osdTag = this.scene.add
      .text(this.panelX + panelWidth / 2 - 24, headerY, 'RED ▸ TERMINAL', osdStyle(16))
      .setOrigin(1, 0.5);
    this.container.add(osdTag);

    // Close button (top-right corner of panel, below OSD tag line)
    const closeBtn = createTextButton(
      this.scene,
      this.panelX + panelWidth / 2 - 50,
      this.panelY + panelHeight / 2 - 26,
      '[ CLOSE ]',
      () => this.hide(),
      20
    );
    this.container.add(closeBtn);

    // Subclass content
    this.buildContent();

    // CRT dressing on top of content
    const grain = addStatic(this.scene, this.panelX, this.panelY, panelWidth, panelHeight, 0.03);
    this.container.add(grain);
    const scan = addScanlines(
      this.scene,
      this.panelX - panelWidth / 2,
      this.panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      0.09
    );
    this.container.add(scan);
  }

  protected abstract buildContent(): void;

  /** Add a game object (or several) to the overlay container. */
  protected add(child: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): void {
    this.container.add(child as Phaser.GameObjects.GameObject);
  }

  show(): void {
    this.onShow();
    this.container.setVisible(true);
    glitchBurst(this.scene, [], 120, this.container.depth + 1);
  }

  hide(): void {
    playMenuButtonSound();
    this.container.setVisible(false);
    this.onClose?.();
  }

  /** Hook for subclasses to refresh dynamic content before showing. */
  protected onShow(): void {}

  isVisible(): boolean {
    return this.container?.visible ?? false;
  }
}
