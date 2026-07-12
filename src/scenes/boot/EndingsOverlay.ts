import Phaser from 'phaser';
import { TerminalOverlay } from '../../ui/kit/overlay';
import { PALETTE, terminalStyle, osdStyle } from '../../ui/kit/theme';
import { playMenuButtonSound, playMenuHoverSound } from '../../utils/menuSounds';

/**
 * Endings preview — replay any ending cinematic (post-game / dev).
 */
export class EndingsOverlay extends TerminalOverlay {
  constructor(scene: Phaser.Scene) {
    super(scene, 'ARCHIVED FOOTAGE — ENDINGS');
  }

  create(): void {
    super.create(640, 500, 100);
  }

  protected buildContent(): void {
    const entries: Array<{ title: string; desc: string; danger?: boolean; start: () => void }> = [
      {
        title: 'GOOD ENDING',
        desc: 'Peaceful celebration — all mercs together.',
        start: () => this.scene.scene.start('GameScene', { night: 5, previewEnding: 'good' }),
      },
      {
        title: 'BAD ENDING INTRO',
        desc: 'Medic goes mad — leads to Night 6.',
        danger: true,
        start: () => this.scene.scene.start('GameScene', { night: 5, previewEnding: 'badIntro' }),
      },
      {
        title: 'DARK ENDING',
        desc: 'Night 6 survival end — lonely Engineer.',
        start: () => this.scene.scene.start('GameScene', { night: 6, previewEnding: 'dark' }),
      },
    ];

    let y = this.panelY - 90;
    entries.forEach((entry) => {
      const idle = entry.danger ? PALETTE.alertDimCss : PALETTE.amberDimCss;
      const hot = entry.danger ? PALETTE.alertCss : PALETTE.creamCss;

      const row = this.scene.add.rectangle(this.panelX, y, this.panelWidth - 80, 74, 0x0a0704, 0.6);
      row.setStrokeStyle(1, PALETTE.amberFaint);
      row.setInteractive({ useHandCursor: true });
      this.add(row);

      const title = this.scene.add
        .text(this.panelX - this.panelWidth / 2 + 64, y - 14, `▸ ${entry.title}`, terminalStyle(26, idle))
        .setOrigin(0, 0.5);
      this.add(title);

      const desc = this.scene.add
        .text(this.panelX - this.panelWidth / 2 + 90, y + 16, entry.desc, osdStyle(17, PALETTE.amberFaintCss))
        .setOrigin(0, 0.5);
      this.add(desc);

      row.on('pointerover', () => {
        playMenuHoverSound();
        title.setColor(hot);
        row.setStrokeStyle(1, entry.danger ? PALETTE.alertDim : PALETTE.amberDim);
      });
      row.on('pointerout', () => {
        title.setColor(idle);
        row.setStrokeStyle(1, PALETTE.amberFaint);
      });
      row.on('pointerdown', () => {
        playMenuButtonSound();
        entry.start();
      });

      y += 96;
    });
  }
}
