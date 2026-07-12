import Phaser from 'phaser';
import { TerminalOverlay } from '../../ui/kit/overlay';
import { PALETTE, terminalStyle, osdStyle } from '../../ui/kit/theme';
import { drawCharacterSilhouette } from '../../drawing/characterSilhouettes';
import { pickRandomSpyDisguise } from '../../drawing/spyGalleryDisguise';

/**
 * Character gallery — subject files on the security terminal.
 * The Spy card re-rolls a random disguise every time the gallery opens.
 */
export class GalleryOverlay extends TerminalOverlay {
  private spyCardElements: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 'SUBJECT GALLERY');
  }

  create(): void {
    super.create(1060, 620, 100);
  }

  protected buildContent(): void {
    const characters = [
      { name: 'SCOUT', night: 1 },
      { name: 'SOLDIER', night: 1 },
      { name: 'DEMOMAN', night: 2 },
      { name: 'HEAVY', night: 3 },
      { name: 'SNIPER', night: 4 },
      { name: 'PYRO', night: 5 },
    ];

    // Row 1: four cards, Row 2: two cards + spy placeholder
    const cardW = 200;
    const gap = 40;
    const row1Y = this.panelY - 90;
    const row2Y = this.panelY + 140;
    const row1StartX = this.panelX - 1.5 * (cardW + gap);

    for (let i = 0; i < 4; i++) {
      this.drawCard(row1StartX + i * (cardW + gap), row1Y, characters[i].name, characters[i].night);
    }
    for (let i = 4; i < 6; i++) {
      this.drawCard(this.panelX - (cardW + gap) + (i - 4) * (cardW + gap), row2Y, characters[i].name, characters[i].night);
    }
    // Spy card generated per-show in onShow()
  }

  protected onShow(): void {
    // Re-roll the Spy disguise each time the gallery opens
    this.spyCardElements.forEach((el) => el.destroy());
    this.spyCardElements = [];

    const disguise = pickRandomSpyDisguise();
    const x = this.panelX + 240;
    const y = this.panelY + 140;

    this.spyCardElements = this.drawCard(x, y, disguise.name, 4, {
      label: 'SPY',
      labelColor: PALETTE.alertCss,
      artColor: disguise.color,
    });
  }

  private drawCard(
    x: number,
    y: number,
    silhouetteName: string,
    night: number,
    override?: { label: string; labelColor: string; artColor: number }
  ): Phaser.GameObjects.GameObject[] {
    const created: Phaser.GameObjects.GameObject[] = [];

    const cardBg = this.scene.add.rectangle(x, y, 200, 210, 0x0a0704, 0.9);
    cardBg.setStrokeStyle(1, override ? PALETTE.alertDim : PALETTE.amberFaint);
    this.add(cardBg);
    created.push(cardBg);

    const silhouette = this.scene.add.graphics();
    drawCharacterSilhouette(silhouette, 0, 0, silhouetteName, override?.artColor ?? 0xffffff);
    const wrap = this.scene.add.container(x, y - 20, [silhouette]);
    wrap.setScale(0.62);
    this.add(wrap);
    created.push(wrap);

    const nameText = this.scene.add
      .text(x, y + 78, override?.label ?? silhouetteName, terminalStyle(24, override?.labelColor ?? PALETTE.creamCss))
      .setOrigin(0.5);
    this.add(nameText);
    created.push(nameText);

    const badge = this.scene.add
      .text(x + 82, y - 88, `N${night}`, osdStyle(15, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.add(badge);
    created.push(badge);

    return created;
  }
}
