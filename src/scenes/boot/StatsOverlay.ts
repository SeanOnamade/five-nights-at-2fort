import Phaser from 'phaser';
import { TerminalOverlay } from '../../ui/kit/overlay';
import { PALETTE, terminalStyle, osdStyle } from '../../ui/kit/theme';
import { loadSave, calculateTotalDestructions } from '../../utils/saveData';

/**
 * "Service Record" — personnel-file stats printout from save data.
 * Rebuilt from the save every time it opens.
 */
export class StatsOverlay extends TerminalOverlay {
  private dynamicContent: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 'SERVICE RECORD');
  }

  create(): void {
    super.create(620, 560, 100);
  }

  protected buildContent(): void {
    // All content is dynamic; rendered in onShow()
  }

  protected onShow(): void {
    this.dynamicContent.forEach((el) => el.destroy());
    this.dynamicContent = [];

    const save = loadSave();
    const leftX = this.panelX - this.panelWidth / 2 + 50;
    let y = this.panelY - this.panelHeight / 2 + 90;

    const put = (
      x: number,
      yy: number,
      text: string,
      color: string = PALETTE.amberDimCss,
      size = 22
    ): Phaser.GameObjects.Text => {
      const t = this.scene.add.text(x, yy, text, terminalStyle(size, color));
      this.container.add(t);
      this.dynamicContent.push(t);
      return t;
    };

    put(leftX, y, 'EMPLOYEE: NIGHT-SHIFT ENGINEER', PALETTE.creamCss, 24);
    y += 30;
    put(leftX, y, 'POSTING:  2FORT — INTEL ROOM', PALETTE.amberFaintCss, 19);
    y += 44;

    if (!save) {
      put(leftX, y, 'NO FILE ON RECORD.', PALETTE.alertDimCss, 24);
      y += 34;
      put(leftX, y, 'Complete a night to open a service record.', PALETTE.amberFaintCss, 20);
      return;
    }

    // Night-by-night destruction table
    put(leftX, y, 'NIGHT', PALETTE.creamCss, 21);
    put(leftX + 150, y, 'STATUS', PALETTE.creamCss, 21);
    put(leftX + 340, y, 'SENTRIES LOST', PALETTE.creamCss, 21);
    y += 30;

    for (let night = 1; night <= 5; night++) {
      const cleared = night < save.currentNight || save.hasBeatenNight5;
      const destructions = save.nightDestructions[night];
      put(leftX, y, `${night}`, PALETTE.amberDimCss);
      put(leftX + 150, y, cleared ? 'CLEARED' : night === save.currentNight ? 'ACTIVE' : 'LOCKED',
        cleared ? PALETTE.amberCss : night === save.currentNight ? PALETTE.creamCss : PALETTE.amberFaintCss);
      put(
        leftX + 340,
        y,
        destructions === undefined ? '—' : `${destructions}`,
        destructions !== undefined && destructions > 0 ? PALETTE.alertDimCss : PALETTE.amberDimCss
      );
      y += 28;
    }
    y += 16;

    const total = calculateTotalDestructions(save.nightDestructions);
    put(leftX, y, `TOTAL EQUIPMENT LOSSES: ${total}`, total >= 5 ? PALETTE.alertCss : PALETTE.amberCss, 22);
    y += 42;

    put(leftX, y, 'INCIDENT REPORTS', PALETTE.creamCss, 21);
    y += 30;
    const endingLine = (label: string, achieved: boolean, danger = false) => {
      put(leftX, y, `${achieved ? '■' : '□'} ${label}`,
        achieved ? (danger ? PALETTE.alertCss : PALETTE.amberCss) : PALETTE.amberFaintCss, 21);
      y += 28;
    };
    endingLine('NIGHT 5 SURVIVED', save.hasBeatenNight5);
    endingLine('GOOD ENDING', save.goodEndingAchieved);
    endingLine('BAD ENDING (NIGHT 6)', save.badEndingAchieved, true);
  }
}
