import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../types';
import type { PaulingEnemy, VentSide } from '../entities/PaulingEnemy';

/** Game state/actions the vent system UI needs; implemented by GameScene. */
export interface VentUIHost {
  isPaulingEnabled(): boolean;
  isCameraModeNow(): boolean;
  isTeleportedNow(): boolean;
  isVentCameraModeNow(): boolean;
  getPauling(): PaulingEnemy;
  isVentSealedLeft(): boolean;
  isVentSealedRight(): boolean;
  getThermostat(): number;
  toggleVentSeal(side: VentSide): void;
  toggleVentCameraMode(): void;
}

const VENT_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'VENT_ENTRY': { x: 420, y: 180 },
  'VENT_MID': { x: 420, y: 245 },
  'VENT_JUNCTION': { x: 420, y: 310 },
  'VENT_LEFT_UPPER': { x: 270, y: 370 },
  'VENT_RIGHT_UPPER': { x: 570, y: 370 },
  'VENT_LEFT_LOWER': { x: 270, y: 430 },
  'VENT_RIGHT_LOWER': { x: 570, y: 430 },
  'VENT_LEFT_OPENING': { x: 270, y: 490 },
  'VENT_RIGHT_OPENING': { x: 570, y: 490 },
};

/**
 * Vent system UI (Pauling nights): vent map overlay, seal buttons, ROOMS/VENTS
 * tabs, and the wall + panel thermostats. Extracted from GameScene.
 */
export class VentUI {
  private ventUI!: Phaser.GameObjects.Container;
  private ventNodeGraphics: Map<string, Phaser.GameObjects.Container> = new Map();
  private ventPaulingIcon!: Phaser.GameObjects.Container;
  private ventSealLeftBtn!: Phaser.GameObjects.Container;
  private ventSealRightBtn!: Phaser.GameObjects.Container;
  private ventSealLeftIndicator!: Phaser.GameObjects.Rectangle;
  private ventSealRightIndicator!: Phaser.GameObjects.Rectangle;
  private ventCamsToggleBtn!: Phaser.GameObjects.Container;
  private ventCamsToggleText!: Phaser.GameObjects.Text;
  private ventPanelControls!: Phaser.GameObjects.Container;
  private ventPanelThermoFill!: Phaser.GameObjects.Rectangle;
  private ventPanelThermoText!: Phaser.GameObjects.Text;
  private thermostatContainer!: Phaser.GameObjects.Container;
  private thermostatFill!: Phaser.GameObjects.Rectangle;
  private thermostatText!: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private host: VentUIHost,
  ) {}

  /** Build vent map overlay + panel controls (parented to camera UI) + wall thermostat. */
  create(cameraUI: Phaser.GameObjects.Container): void {
    this.createVentUI(cameraUI);
    this.createThermostatUI();
  }

  private createVentUI(cameraUI: Phaser.GameObjects.Container): void {
    // Vent map overlay (shown over the camera feed area when in vent mode)
    this.ventUI = this.scene.add.container(0, 0);
    this.ventUI.setVisible(false);
    this.ventUI.setDepth(105);

    const ventBg = this.scene.add.rectangle(420, 340, 580, 500, 0x0a0a10);
    ventBg.setStrokeStyle(4, 0x151520);
    this.ventUI.add(ventBg);

    const ventTitle = this.scene.add.text(420, 120, 'VENT SYSTEM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    this.ventUI.add(ventTitle);

    const lineGraphics = this.scene.add.graphics();
    lineGraphics.lineStyle(2, 0x553388, 0.6);
    lineGraphics.lineBetween(420, 180, 420, 245);
    lineGraphics.lineBetween(420, 245, 420, 310);
    lineGraphics.lineBetween(420, 310, 270, 370);
    lineGraphics.lineBetween(420, 310, 570, 370);
    lineGraphics.lineBetween(270, 370, 270, 430);
    lineGraphics.lineBetween(570, 370, 570, 430);
    lineGraphics.lineBetween(270, 430, 270, 490);
    lineGraphics.lineBetween(570, 430, 570, 490);
    this.ventUI.add(lineGraphics);

    const nodeNames: Record<string, string> = {
      'VENT_ENTRY': 'ENTRY',
      'VENT_MID': 'MID',
      'VENT_JUNCTION': 'JUNCTION',
      'VENT_LEFT_UPPER': 'L.UPPER',
      'VENT_RIGHT_UPPER': 'R.UPPER',
      'VENT_LEFT_LOWER': 'L.LOWER',
      'VENT_RIGHT_LOWER': 'R.LOWER',
      'VENT_LEFT_OPENING': 'L.VENT',
      'VENT_RIGHT_OPENING': 'R.VENT',
    };

    for (const [nodeId, pos] of Object.entries(VENT_NODE_POSITIONS)) {
      const container = this.scene.add.container(pos.x, pos.y);
      const bg = this.scene.add.rectangle(0, 0, 80, 24, 0x221133);
      bg.setStrokeStyle(1, 0x553388);
      container.add(bg);
      const label = this.scene.add.text(0, 0, nodeNames[nodeId] || nodeId, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#aa88cc',
      }).setOrigin(0.5);
      container.add(label);
      this.ventUI.add(container);
      this.ventNodeGraphics.set(nodeId, container);
    }

    // Pauling icon — silhouette with dark hair and purple outfit
    this.ventPaulingIcon = this.scene.add.container(420, 170);
    const paulingGfx = this.scene.add.graphics();
    // Hair (dark, shoulder-length)
    paulingGfx.fillStyle(0x1a1a2a, 1);
    paulingGfx.fillCircle(0, -20, 8);
    paulingGfx.fillRoundedRect(-7, -20, 14, 10, 2);
    // Face
    paulingGfx.fillStyle(0xddbb99, 1);
    paulingGfx.fillCircle(0, -22, 5);
    // Glasses (small rectangles)
    paulingGfx.fillStyle(0x888888, 0.9);
    paulingGfx.fillRect(-5, -24, 4, 2);
    paulingGfx.fillRect(1, -24, 4, 2);
    // Body (purple dress/suit)
    paulingGfx.fillStyle(0x7733aa, 1);
    paulingGfx.fillRoundedRect(-6, -12, 12, 14, 3);
    // Arms
    paulingGfx.fillRect(-9, -10, 4, 10);
    paulingGfx.fillRect(5, -10, 4, 10);
    this.ventPaulingIcon.add(paulingGfx);
    const paulingLabel = this.scene.add.text(0, 6, 'PAULING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    this.ventPaulingIcon.add(paulingLabel);
    this.ventUI.add(this.ventPaulingIcon);

    // Seal indicators on the vent map (visual only)
    this.ventSealLeftIndicator = this.scene.add.rectangle(270, 510, 80, 8, 0x333333, 0);
    this.ventUI.add(this.ventSealLeftIndicator);
    this.ventSealRightIndicator = this.scene.add.rectangle(570, 510, 80, 8, 0x333333, 0);
    this.ventUI.add(this.ventSealRightIndicator);

    // Seal buttons and thermostat go in the right panel (ventPanelControls)
    this.ventPanelControls = this.scene.add.container(0, 0);
    this.ventPanelControls.setDepth(102);
    this.ventPanelControls.setVisible(false);
    cameraUI.add(this.ventPanelControls);

    // Left seal button (in right panel)
    this.ventSealLeftBtn = this.scene.add.container(920, 280);
    const leftBtnBg = this.scene.add.rectangle(0, 0, 140, 40, 0x332244);
    leftBtnBg.setStrokeStyle(2, 0x664488);
    leftBtnBg.setInteractive({ useHandCursor: true });
    const leftBtnText = this.scene.add.text(0, 0, 'SEAL LEFT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    leftBtnBg.on('pointerdown', () => this.host.toggleVentSeal('LEFT'));
    leftBtnBg.on('pointerover', () => leftBtnBg.setFillStyle(0x443355));
    leftBtnBg.on('pointerout', () => leftBtnBg.setFillStyle(0x332244));
    this.ventSealLeftBtn.add([leftBtnBg, leftBtnText]);
    this.ventPanelControls.add(this.ventSealLeftBtn);

    // Right seal button (in right panel)
    this.ventSealRightBtn = this.scene.add.container(1080, 280);
    const rightBtnBg = this.scene.add.rectangle(0, 0, 140, 40, 0x332244);
    rightBtnBg.setStrokeStyle(2, 0x664488);
    rightBtnBg.setInteractive({ useHandCursor: true });
    const rightBtnText = this.scene.add.text(0, 0, 'SEAL RIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    rightBtnBg.on('pointerdown', () => this.host.toggleVentSeal('RIGHT'));
    rightBtnBg.on('pointerover', () => rightBtnBg.setFillStyle(0x443355));
    rightBtnBg.on('pointerout', () => rightBtnBg.setFillStyle(0x332244));
    this.ventSealRightBtn.add([rightBtnBg, rightBtnText]);
    this.ventPanelControls.add(this.ventSealRightBtn);

    // Vent panel thermostat (vertical, in right panel)
    const ventThermoContainer = this.scene.add.container(1000, 420);

    const vtHousing = this.scene.add.rectangle(0, 0, 36, 90, 0x1a1a22);
    vtHousing.setStrokeStyle(1, 0x333344);
    ventThermoContainer.add(vtHousing);

    const vtLabel = this.scene.add.text(0, -55, 'TEMPERATURE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5);
    ventThermoContainer.add(vtLabel);

    const vtBarBg = this.scene.add.rectangle(0, 0, 14, 66, 0x0a0a0a);
    vtBarBg.setStrokeStyle(1, 0x444444);
    ventThermoContainer.add(vtBarBg);

    this.ventPanelThermoFill = this.scene.add.rectangle(0, 33, 10, 0, 0x44cc44);
    this.ventPanelThermoFill.setOrigin(0.5, 1);
    ventThermoContainer.add(this.ventPanelThermoFill);

    this.ventPanelThermoText = this.scene.add.text(0, 55, '0°', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#666666',
    }).setOrigin(0.5);
    ventThermoContainer.add(this.ventPanelThermoText);

    this.ventPanelControls.add(ventThermoContainer);

    // ROOMS / VENTS folder tabs above the facility overview map panel
    const tabY = 127;
    const tabW = 110;
    const tabH = 30;
    const tabGap = 8;

    this.ventCamsToggleBtn = this.scene.add.container(0, 0);
    this.ventCamsToggleBtn.setDepth(106);

    // "ROOMS" tab
    const roomsTabBg = this.scene.add.rectangle(1000 - tabW/2 - tabGap/2, tabY, tabW, tabH, 0x0a1525);
    roomsTabBg.setStrokeStyle(2, 0x3388cc);
    roomsTabBg.setInteractive({ useHandCursor: true });
    const roomsTabText = this.scene.add.text(1000 - tabW/2 - tabGap/2, tabY, 'ROOMS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#5588cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    roomsTabBg.on('pointerdown', () => {
      if (this.host.isVentCameraModeNow()) this.host.toggleVentCameraMode();
    });
    roomsTabBg.on('pointerover', () => roomsTabBg.setFillStyle(0x112233));
    roomsTabBg.on('pointerout', () => roomsTabBg.setFillStyle(0x0a1525));

    // "VENTS" tab
    const ventsTabBg = this.scene.add.rectangle(1000 + tabW/2 + tabGap/2, tabY, tabW, tabH, 0x15081a);
    ventsTabBg.setStrokeStyle(2, 0x553388);
    ventsTabBg.setInteractive({ useHandCursor: true });
    this.ventCamsToggleText = this.scene.add.text(1000 + tabW/2 + tabGap/2, tabY, 'VENTS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#9944cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    ventsTabBg.on('pointerdown', () => {
      if (!this.host.isVentCameraModeNow()) this.host.toggleVentCameraMode();
    });
    ventsTabBg.on('pointerover', () => ventsTabBg.setFillStyle(0x221133));
    ventsTabBg.on('pointerout', () => ventsTabBg.setFillStyle(0x15081a));

    this.ventCamsToggleBtn.add([roomsTabBg, roomsTabText, ventsTabBg, this.ventCamsToggleText]);
    this.ventCamsToggleBtn.setVisible(false);
    cameraUI.add(this.ventCamsToggleBtn);
  }

  private createThermostatUI(): void {
    // Thermostat on the wall to the left of the right door
    // Right door is at x=1160; place thermostat at x=1060, vertical on the wall
    this.thermostatContainer = this.scene.add.container(1060, 260);
    this.thermostatContainer.setDepth(5);
    this.thermostatContainer.setVisible(false);

    // Thermostat housing (small wall-mounted box)
    const housing = this.scene.add.rectangle(0, 0, 28, 70, 0x1a1a22);
    housing.setStrokeStyle(1, 0x333344);
    this.thermostatContainer.add(housing);

    // Label above
    const label = this.scene.add.text(0, -42, 'TEMP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5);
    this.thermostatContainer.add(label);

    // Vertical bar background (mercury-style)
    const barBg = this.scene.add.rectangle(0, 0, 10, 50, 0x0a0a0a);
    barBg.setStrokeStyle(1, 0x444444);
    this.thermostatContainer.add(barBg);

    // Fill bar (grows upward from bottom)
    this.thermostatFill = this.scene.add.rectangle(0, 25, 6, 0, 0x44cc44);
    this.thermostatFill.setOrigin(0.5, 1);
    this.thermostatContainer.add(this.thermostatFill);

    // Percentage text below
    this.thermostatText = this.scene.add.text(0, 42, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5);
    this.thermostatContainer.add(this.thermostatText);
  }

  /** Show/hide the vent map overlay and its right-panel controls together. */
  setVentViewVisible(visible: boolean): void {
    this.ventUI?.setVisible(visible);
    this.ventPanelControls?.setVisible(visible);
  }

  update(): void {
    if (!this.host.isPaulingEnabled()) return;

    const pauling = this.host.getPauling();
    const ventSealLeft = this.host.isVentSealedLeft();
    const ventSealRight = this.host.isVentSealedRight();

    // Show toggle button when cameras are open
    this.ventCamsToggleBtn.setVisible(this.host.isCameraModeNow());

    // Show thermostat when in Intel room
    this.thermostatContainer.setVisible(!this.host.isTeleportedNow());

    // Update Pauling icon position on vent map
    if (this.ventUI.visible && pauling.isActive()) {
      const pos = VENT_NODE_POSITIONS[pauling.getCurrentNode()];
      if (pos) {
        this.ventPaulingIcon.setPosition(pos.x, pos.y);
      }

      // Highlight current node
      this.ventNodeGraphics.forEach((container, nodeId) => {
        const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
        if (nodeId === pauling.getCurrentNode()) {
          bg.setFillStyle(0x662288);
          bg.setStrokeStyle(2, 0xcc44ff);
        } else {
          bg.setFillStyle(0x221133);
          bg.setStrokeStyle(1, 0x553388);
        }
      });
    }

    // Update seal indicators
    this.ventSealLeftIndicator?.setFillStyle(ventSealLeft ? 0xff4444 : 0x333333, ventSealLeft ? 0.8 : 0);
    this.ventSealRightIndicator?.setFillStyle(ventSealRight ? 0xff4444 : 0x333333, ventSealRight ? 0.8 : 0);

    // Update seal button colors
    const leftBg = this.ventSealLeftBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    const rightBg = this.ventSealRightBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    if (ventSealLeft) {
      leftBg.setStrokeStyle(2, 0xff4444);
      (this.ventSealLeftBtn.getAt(1) as Phaser.GameObjects.Text).setText('UNSEAL L');
    } else {
      leftBg.setStrokeStyle(2, 0x664488);
      (this.ventSealLeftBtn.getAt(1) as Phaser.GameObjects.Text).setText('SEAL LEFT');
    }
    if (ventSealRight) {
      rightBg.setStrokeStyle(2, 0xff4444);
      (this.ventSealRightBtn.getAt(1) as Phaser.GameObjects.Text).setText('UNSEAL R');
    } else {
      rightBg.setStrokeStyle(2, 0x664488);
      (this.ventSealRightBtn.getAt(1) as Phaser.GameObjects.Text).setText('SEAL RIGHT');
    }

    // Update thermostat display (vertical mercury bar) — both Intel room and vent panel
    // Display range: 50° (cold) to 110° (Pyro trigger)
    const pct = Math.min(this.host.getThermostat() / GAME_CONSTANTS.THERMOSTAT_MAX, 1);
    const displayTemp = Math.floor(GAME_CONSTANTS.THERMOSTAT_DISPLAY_MIN + pct * (GAME_CONSTANTS.THERMOSTAT_DISPLAY_MAX - GAME_CONSTANTS.THERMOSTAT_DISPLAY_MIN));
    const thermoColor = pct < 0.4 ? 0x44cc44 : pct < 0.7 ? 0xcccc44 : pct < 0.9 ? 0xff8800 : 0xff2222;
    const tempStr = `${displayTemp}°`;

    this.thermostatFill.setSize(6, 50 * pct);
    this.thermostatFill.setFillStyle(thermoColor);
    this.thermostatText.setText(tempStr);

    // Vent panel thermostat mirror
    if (this.ventPanelThermoFill) {
      this.ventPanelThermoFill.setSize(10, 66 * pct);
      this.ventPanelThermoFill.setFillStyle(thermoColor);
    }
    if (this.ventPanelThermoText) {
      this.ventPanelThermoText.setText(tempStr);
    }
  }
}
