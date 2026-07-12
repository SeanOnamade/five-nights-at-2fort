import Phaser from 'phaser';
import { TerminalOverlay } from '../../ui/kit/overlay';
import { PALETTE, terminalStyle } from '../../ui/kit/theme';
import { playMenuButtonSound, playMenuHoverSound } from '../../utils/menuSounds';

export interface ExtrasEntry {
  label: string;
  onSelect: () => void;
}

/**
 * EXTRAS submenu — a small terminal list that opens the other overlays
 * (Survival Manual / Gallery / Endings / Service Record).
 */
export class ExtrasOverlay extends TerminalOverlay {
  constructor(
    scene: Phaser.Scene,
    private entries: ExtrasEntry[]
  ) {
    super(scene, 'EXTRAS');
  }

  create(): void {
    super.create(420, 120 + this.entries.length * 56, 90);
  }

  protected buildContent(): void {
    let y = this.panelY - this.panelHeight / 2 + 92;
    this.entries.forEach((entry) => {
      const t = this.scene.add
        .text(this.panelX - this.panelWidth / 2 + 60, y, `▸ ${entry.label}`, terminalStyle(26, PALETTE.amberDimCss))
        .setOrigin(0, 0.5);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        playMenuHoverSound();
        t.setColor(PALETTE.creamCss);
      });
      t.on('pointerout', () => t.setColor(PALETTE.amberDimCss));
      t.on('pointerdown', () => {
        playMenuButtonSound();
        this.container.setVisible(false);
        entry.onSelect();
      });
      this.add(t);
      y += 56;
    });
  }
}
