import Phaser from 'phaser';
import {
  CUSTOM_NIGHT_ENEMY_ORDER,
  type CustomNightEnemyId,
  loadCustomNightEnemies,
  saveCustomNightEnemies,
} from '../data/customNightStorage';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import {
  drawMedicGhostSilhouette,
  drawPaulingJumpscarePortrait,
} from '../drawing/medicPaulingPortraits';
import { pickRandomSpyDisguise } from '../drawing/spyGalleryDisguise';
import {
  playGameStartChime,
  playMenuButtonSound,
  playMenuToggleOffSound,
  playMenuToggleOnSound,
} from '../utils/menuSounds';
import { PALETTE, headingStyle, osdStyle, terminalStyle } from '../ui/kit/theme';
import { addScanlines, addStatic, addVignette, ensureNoiseTexture } from '../ui/kit/effects';
import { createTextButton } from '../ui/kit/widgets';

const ENEMY_DISPLAY: Record<CustomNightEnemyId, string> = {
  scout: 'SCOUT',
  soldier: 'SOLDIER',
  demoman: 'DEMOMAN',
  heavy: 'HEAVY',
  sniper: 'SNIPER',
  spy: 'SPY',
  pyro: 'PYRO',
  medic: 'MEDIC',
  administrator: 'ADMIN',
  pauling: 'PAULING',
  merasmus: 'MERASMUS',
};

/** Merc silhouettes drawn via `drawCharacterSilhouette` (Spy/Medic/Pauling use dedicated art). */
type PortraitSilhouetteId = Exclude<CustomNightEnemyId, 'spy' | 'medic' | 'pauling'>;

const SILHOUETTE_NAME: Record<PortraitSilhouetteId, string> = {
  scout: 'SCOUT',
  soldier: 'SOLDIER',
  demoman: 'DEMOMAN',
  heavy: 'HEAVY',
  sniper: 'SNIPER',
  pyro: 'PYRO',
  administrator: 'ADMINISTRATOR',
  merasmus: 'MERASMUS',
};

const ENEMY_ACCENT: Record<CustomNightEnemyId, number> = {
  scout: 0x7755aa,
  soldier: 0x6688aa,
  demoman: 0x44aa55,
  heavy: 0xaa6644,
  sniper: 0x5599cc,
  spy: 0x666677,
  pyro: 0xdd6622,
  medic: 0xff4444,
  administrator: 0x9944cc,  // Same purple as Pauling - they work together canonically
  pauling: 0x9944cc,
  merasmus: 0x8866dd,
};

/** The classic story-mode roster (Nights 1-5) */
const STORY_ROSTER: CustomNightEnemyId[] = ['scout', 'soldier', 'demoman', 'heavy', 'sniper', 'spy', 'pyro'];

interface CardRefs {
  frame: Phaser.GameObjects.Rectangle;
  portraitBg: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Container;
  offStatic: Phaser.GameObjects.TileSprite;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

/**
 * Custom night — threat selection on the security terminal.
 * OFF cards read as powered-down monitors (dark + static);
 * ON cards light up with an amber frame.
 */
export class CustomNightScene extends Phaser.Scene {
  private enemies!: Record<CustomNightEnemyId, boolean>;
  private cards = new Map<CustomNightEnemyId, CardRefs>();
  private threatFill!: Phaser.GameObjects.Rectangle;
  private threatLabel!: Phaser.GameObjects.Text;
  private started = false;

  constructor() {
    super({ key: 'CustomNightScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.enemies = loadCustomNightEnemies();
    this.cards.clear();
    this.started = false;
    const spyDisguise = pickRandomSpyDisguise();

    ensureNoiseTexture(this);

    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.bg);
    addVignette(this, width, height);

    // ===== HEADER BAND (y 0-130) =====
    this.add.text(48, 26, 'CUSTOM NIGHT', headingStyle(40, PALETTE.creamCss));
    this.add.text(50, 78, 'SELECT YOUR THREATS — TAP A MONITOR TO TOGGLE', osdStyle(16, PALETTE.amberDimCss));

    // Right block: threat meter on top, presets below — all right-aligned
    const rightEdge = width - 48;
    const meterW = 220;
    const meterValueW = 62; // room for "11/11"
    const meterX = rightEdge - meterValueW - meterW;
    this.add.text(meterX, 24, 'THREAT LEVEL', osdStyle(15, PALETTE.amberDimCss));
    const meterTrack = this.add.rectangle(meterX + meterW / 2, 56, meterW, 10, PALETTE.amberFaint);
    meterTrack.setStrokeStyle(1, PALETTE.amberDim);
    this.threatFill = this.add.rectangle(meterX, 56, 0, 10, PALETTE.amber).setOrigin(0, 0.5);
    this.threatLabel = this.add
      .text(rightEdge, 56, '', terminalStyle(22, PALETTE.creamCss))
      .setOrigin(1, 0.5);

    // Preset row ends at the right edge, right-to-left
    const presetY = 96;
    const presets: Array<[string, () => void]> = [
      ['[ ALL ON ]', () => this.applyPreset(() => true)],
      ['[ STORY ]', () => this.applyPreset((id) => STORY_ROSTER.includes(id))],
      ['[ ALL OFF ]', () => this.applyPreset(() => false)],
    ];
    let presetRightX = rightEdge;
    presets.forEach(([label, action]) => {
      const btn = createTextButton(this, presetRightX, presetY, label, action, 20);
      btn.setOrigin(1, 0.5);
      presetRightX -= btn.width + 24;
    });

    // Header hairline separating the band from the grid
    this.add.rectangle(width / 2, 126, width - 96, 1, PALETTE.amberFaint);

    // ===== CARD GRID — 6 + 5 (no lone straggler row) =====
    const cardW = 186;
    const cardH = 200;
    const gapX = 16;
    const row1Y = 254;
    const row2Y = 254 + cardH + 26;

    const rowCenterX = (count: number, col: number) => {
      const total = count * cardW + (count - 1) * gapX;
      return (width - total) / 2 + cardW / 2 + col * (cardW + gapX);
    };

    CUSTOM_NIGHT_ENEMY_ORDER.forEach((id, index) => {
      const inRow1 = index < 6;
      const cx = inRow1 ? rowCenterX(6, index) : rowCenterX(5, index - 6);
      const cy = inRow1 ? row1Y : row2Y;

      const frame = this.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0.4);
      frame.setStrokeStyle(1, PALETTE.amberFaint);

      const portraitW = cardW - 20;
      const portraitH = 104;
      const portraitCY = cy - 36;
      const portraitBg = this.add.rectangle(cx, portraitCY, portraitW, portraitH, 0x050302, 1);
      portraitBg.setStrokeStyle(1, PALETTE.amberFaint);

      const portraitWrap = this.add.container(cx, portraitCY + 12);
      const portraitGfx = this.add.graphics();
      if (id === 'spy') {
        drawCharacterSilhouette(portraitGfx, 0, 0, spyDisguise.name, spyDisguise.color);
      } else if (id === 'medic') {
        drawMedicGhostSilhouette(portraitGfx);
      } else if (id === 'pauling') {
        drawPaulingJumpscarePortrait(portraitGfx);
      } else {
        drawCharacterSilhouette(portraitGfx, 0, 0, SILHOUETTE_NAME[id], ENEMY_ACCENT[id]);
      }
      portraitWrap.add(portraitGfx);
      portraitWrap.setScale(id === 'pauling' ? 0.36 : 0.44);

      // Powered-off static over the portrait area (visible when OFF)
      const offStatic = addStatic(this, cx, portraitCY, portraitW, portraitH, 0.09);

      const name = this.add
        .text(cx, cy + 40, ENEMY_DISPLAY[id], terminalStyle(22, PALETTE.creamCss))
        .setOrigin(0.5);

      const status = this.add.text(cx, cy + 68, '', osdStyle(15)).setOrigin(0.5);

      const hit = this.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });

      this.cards.set(id, { frame, portraitBg, art: portraitWrap, offStatic, name, status });

      hit.on('pointerover', () => {
        frame.setStrokeStyle(2, PALETTE.cream);
      });
      hit.on('pointerout', () => {
        this.refreshCard(id);
      });
      hit.on('pointerdown', () => {
        this.enemies[id] = !this.enemies[id];
        if (this.enemies[id]) playMenuToggleOnSound();
        else playMenuToggleOffSound();
        saveCustomNightEnemies(this.enemies);
        this.refreshCard(id);
        this.refreshThreatMeter();
      });

      this.refreshCard(id);
    });

    this.refreshThreatMeter();

    // Scanlines over everything
    addScanlines(this, 0, 0, width, height, 0.1).setDepth(90);

    // Footer buttons
    const back = createTextButton(this, 60, height - 26, '◀ BACK', () => this.scene.start('BootScene'), 26);
    back.setOrigin(0, 0.5);

    const readyText = this.add
      .text(width - 60, height - 26, '▶ READY', terminalStyle(30, PALETTE.creamCss))
      .setOrigin(1, 0.5);
    readyText.setInteractive({ useHandCursor: true });
    readyText.on('pointerover', () => readyText.setColor(PALETTE.amberCss));
    readyText.on('pointerout', () => readyText.setColor(PALETTE.creamCss));
    readyText.on('pointerdown', () => this.startCustomNight(readyText));

    // Blinking cursor next to READY
    this.tweens.add({
      targets: readyText,
      alpha: { from: 1, to: 0.75 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private applyPreset(pick: (id: CustomNightEnemyId) => boolean): void {
    CUSTOM_NIGHT_ENEMY_ORDER.forEach((id) => {
      this.enemies[id] = pick(id);
    });
    saveCustomNightEnemies(this.enemies);
    CUSTOM_NIGHT_ENEMY_ORDER.forEach((id) => this.refreshCard(id));
    this.refreshThreatMeter();
  }

  private refreshCard(id: CustomNightEnemyId): void {
    const on = this.enemies[id];
    const refs = this.cards.get(id);
    if (!refs) return;

    if (on) {
      refs.frame.setStrokeStyle(2, PALETTE.amber);
      refs.portraitBg.setFillStyle(0x0a0603, 1);
      refs.portraitBg.setStrokeStyle(1, PALETTE.amberDim);
      refs.art.setAlpha(1);
      refs.offStatic.setVisible(false);
      refs.name.setColor(PALETTE.creamCss);
      refs.status.setText('● ACTIVE');
      refs.status.setColor(PALETTE.amberCss);
    } else {
      refs.frame.setStrokeStyle(1, PALETTE.amberFaint);
      refs.portraitBg.setFillStyle(0x020202, 1);
      refs.portraitBg.setStrokeStyle(1, PALETTE.amberFaint);
      refs.art.setAlpha(0.08);
      refs.offStatic.setVisible(true);
      // Names stay readable when off; status a notch dimmer than the name
      refs.name.setColor(PALETTE.amberCss);
      refs.status.setText('OFFLINE');
      refs.status.setColor(PALETTE.amberDimCss);
    }
  }

  private refreshThreatMeter(): void {
    const total = CUSTOM_NIGHT_ENEMY_ORDER.length;
    const active = CUSTOM_NIGHT_ENEMY_ORDER.filter((id) => this.enemies[id]).length;
    const ratio = active / total;
    const meterW = 240;

    this.threatFill.width = meterW * ratio;
    this.threatFill.setFillStyle(ratio >= 0.7 ? PALETTE.alert : PALETTE.amber);
    this.threatLabel.setText(`${active}/${total}`);
    this.threatLabel.setColor(ratio >= 0.7 ? PALETTE.alertCss : PALETTE.creamCss);
  }

  private startCustomNight(readyText: Phaser.GameObjects.Text): void {
    if (this.started) return;
    this.started = true;
    playMenuButtonSound();
    playGameStartChime();
    readyText.setText('LOADING...');
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.start('GameScene', {
        night: 7,
        customEnemies: { ...this.enemies },
        isCustomNight: true,
      });
    });
  }
}
