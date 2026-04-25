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
  administrator: 0xff0088,
  pauling: 0x9944cc,
};

/**
 * FNAF-style custom night gallery — pick threats, then READY.
 */
export class CustomNightScene extends Phaser.Scene {
  private enemies!: Record<CustomNightEnemyId, boolean>;
  private portraitPanels = new Map<CustomNightEnemyId, Phaser.GameObjects.Rectangle>();
  private portraitArt = new Map<CustomNightEnemyId, Phaser.GameObjects.Container>();
  private cardStatusLabels = new Map<CustomNightEnemyId, Phaser.GameObjects.Text>();
  private started = false;

  constructor() {
    super({ key: 'CustomNightScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.enemies = loadCustomNightEnemies();
    this.started = false;
    const spyDisguise = pickRandomSpyDisguise();

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050508, 0x050508, 0x101018, 0x101018, 1);
    bg.fillRect(0, 0, width, height);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1a1a28, 0.35);
    for (let x = 0; x < width; x += 48) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 48) grid.lineBetween(0, y, width, y);

    this.add
      .text(width / 2, 52, 'CUSTOM NIGHT', {
        fontFamily: 'Courier New, monospace',
        fontSize: '44px',
        color: '#cc5522',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 98, 'SELECT YOUR THREATS — TAP A PORTRAIT TO TOGGLE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        color: '#666677',
      })
      .setOrigin(0.5);

    const cols = 5;
    const cardW = 210;
    const cardH = 168;
    const gapX = 18;
    const gapY = 22;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const originX = (width - gridW) / 2 + cardW / 2;
    const row1Y = 200;
    const row2Y = row1Y + cardH + gapY;

    CUSTOM_NIGHT_ENEMY_ORDER.forEach((id, index) => {
      const col = index % cols;
      const row = index < cols ? 0 : 1;
      const cx = originX + col * (cardW + gapX);
      const cy = row === 0 ? row1Y : row2Y;

      const frame = this.add.rectangle(cx, cy, cardW + 6, cardH + 6, 0x000000, 0.35);
      frame.setStrokeStyle(2, 0x333344);

      const portraitW = cardW - 24;
      const portraitH = 88;
      const portraitBg = this.add.rectangle(cx, cy - 12, portraitW, portraitH, 0x06060a, 1);
      portraitBg.setStrokeStyle(2, 0x151520);

      const drawY = cy - 2;
      const portraitWrap = this.add.container(cx, drawY);
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
      portraitWrap.setScale(id === 'pauling' ? 0.32 : 0.38);

      this.portraitPanels.set(id, portraitBg);
      this.portraitArt.set(id, portraitWrap);

      this.add
        .text(cx, cy + 52, ENEMY_DISPLAY[id], {
          fontFamily: 'Courier New, monospace',
          fontSize: '15px',
          color: '#dddddd',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const status = this.add.text(cx, cy + 74, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#8899aa',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const hit = this.add.rectangle(cx, cy, cardW + 6, cardH + 6, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });

      this.cardStatusLabels.set(id, status);

      hit.on('pointerover', () => {
        frame.setStrokeStyle(2, 0xff8833);
      });
      hit.on('pointerout', () => {
        frame.setStrokeStyle(2, 0x333344);
      });
      hit.on('pointerdown', () => {
        this.enemies[id] = !this.enemies[id];
        if (this.enemies[id]) playMenuToggleOnSound();
        else playMenuToggleOffSound();
        saveCustomNightEnemies(this.enemies);
        this.refreshCard(id);
      });

      this.refreshCard(id);
    });

    const backBg = this.add.rectangle(120, height - 48, 200, 44, 0x12121a);
    backBg.setStrokeStyle(2, 0x445566);
    backBg.setInteractive({ useHandCursor: true });
    const backText = this.add
      .text(120, height - 48, '◀ BACK', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#8899bb',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    backBg.on('pointerover', () => {
      backBg.setFillStyle(0x1c1c28);
      backText.setColor('#aabbdd');
    });
    backBg.on('pointerout', () => {
      backBg.setFillStyle(0x12121a);
      backText.setColor('#8899bb');
    });
    backBg.on('pointerdown', () => {
      playMenuButtonSound();
      this.scene.start('BootScene');
    });

    const readyBg = this.add.rectangle(width - 160, height - 48, 240, 48, 0x1a2218);
    readyBg.setStrokeStyle(3, 0x44aa44);
    readyBg.setInteractive({ useHandCursor: true });
    const readyText = this.add
      .text(width - 160, height - 48, '▶ READY', {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#66dd66',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    readyBg.on('pointerover', () => {
      readyBg.setFillStyle(0x243024);
      readyText.setColor('#88ff88');
    });
    readyBg.on('pointerout', () => {
      readyBg.setFillStyle(0x1a2218);
      readyText.setColor('#66dd66');
    });
    readyBg.on('pointerdown', () => this.startCustomNight(readyText));
  }

  private refreshCard(id: CustomNightEnemyId): void {
    const on = this.enemies[id];
    const panel = this.portraitPanels.get(id);
    const art = this.portraitArt.get(id);
    const label = this.cardStatusLabels.get(id);
    if (panel) {
      panel.setAlpha(on ? 1 : 0.42);
      panel.setStrokeStyle(2, on ? 0x66ff88 : 0x151520);
    }
    if (art) {
      art.setAlpha(on ? 1 : 0.42);
    }
    if (label) {
      label.setText(on ? 'ACTIVE' : 'OFF');
      label.setColor(on ? '#66ff99' : '#666677');
    }
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
