import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../types';
import type { PaulingEnemy, VentSide } from '../entities/PaulingEnemy';
import { PALETTE, FONTS } from './kit/theme';

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
  private roomsTabBg!: Phaser.GameObjects.Rectangle;
  private roomsTabText!: Phaser.GameObjects.Text;
  private ventsTabBg!: Phaser.GameObjects.Rectangle;
  private lastTabMode: boolean | null = null;
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

    // Panel chrome — matches the camera monitor housing
    const ventBg = this.scene.add.rectangle(420, 340, 580, 500, 0x1c1409);
    ventBg.setStrokeStyle(6, 0x2e2214);
    this.ventUI.add(ventBg);
    const ventBezel = this.scene.add.rectangle(420, 340, 552, 472, 0x0a0704);
    ventBezel.setStrokeStyle(2, 0x1a1208);
    this.ventUI.add(ventBezel);

    // Faint blueprint grid inside the bezel
    const grid = this.scene.add.graphics();
    grid.lineStyle(1, 0x17100a, 0.9);
    for (let gx = 184; gx <= 656; gx += 40) grid.lineBetween(gx, 108, gx, 572);
    for (let gy = 132; gy <= 572; gy += 40) grid.lineBetween(184, gy, 656, gy);
    this.ventUI.add(grid);

    // Title band
    const titleBand = this.scene.add.rectangle(420, 122, 552, 28, 0x140e06);
    titleBand.setStrokeStyle(1, PALETTE.amberFaint);
    this.ventUI.add(titleBand);
    const ventTitle = this.scene.add.text(420, 122, '◈ VENT SYSTEM ◈', {
      fontFamily: FONTS.terminal,
      fontSize: '18px',
      color: PALETTE.creamCss,
    }).setOrigin(0.5);
    this.ventUI.add(ventTitle);

    // Duct runs — thick two-tone ducts with airflow chevrons, instead of wires
    const lineGraphics = this.scene.add.graphics();
    const ducts: Array<[number, number, number, number]> = [
      [420, 180, 420, 245],
      [420, 245, 420, 310],
      [420, 310, 270, 370],
      [420, 310, 570, 370],
      [270, 370, 270, 430],
      [570, 370, 570, 430],
      [270, 430, 270, 490],
      [570, 430, 570, 490],
    ];
    // Outer duct body
    lineGraphics.lineStyle(16, 0x120c06, 1);
    ducts.forEach(([x1, y1, x2, y2]) => lineGraphics.lineBetween(x1, y1, x2, y2));
    // Inner duct face
    lineGraphics.lineStyle(11, 0x201509, 1);
    ducts.forEach(([x1, y1, x2, y2]) => lineGraphics.lineBetween(x1, y1, x2, y2));
    // Airflow chevrons at each duct midpoint, pointing along the flow
    lineGraphics.lineStyle(2, PALETTE.amberDim, 0.55);
    ducts.forEach(([x1, y1, x2, y2]) => {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      [-0.6, 0.6].forEach((side) => {
        lineGraphics.lineBetween(
          mx + Math.cos(ang + Math.PI + side) * 7,
          my + Math.sin(ang + Math.PI + side) * 7,
          mx, my
        );
      });
    });
    // Vent grilles at the two openings (slatted mouths into the intel room)
    [270, 570].forEach((gx) => {
      lineGraphics.fillStyle(0x120c06, 1);
      lineGraphics.fillRect(gx - 42, 506, 84, 16);
      lineGraphics.lineStyle(1, PALETTE.amberDim, 0.7);
      lineGraphics.strokeRect(gx - 42, 506, 84, 16);
      for (let i = 1; i <= 3; i++) {
        lineGraphics.lineBetween(gx - 38, 506 + i * 4, gx + 38, 506 + i * 4);
      }
    });
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
      const bg = this.scene.add.rectangle(0, 0, 84, 26, PALETTE.panel);
      bg.setStrokeStyle(1, PALETTE.amberFaint);
      container.add(bg);
      // Rivets on the junction plates
      const rivets = this.scene.add.graphics();
      rivets.fillStyle(0x3d2c14, 1);
      rivets.fillCircle(-36, -7, 1.5);
      rivets.fillCircle(36, -7, 1.5);
      rivets.fillCircle(-36, 7, 1.5);
      rivets.fillCircle(36, 7, 1.5);
      container.add(rivets);
      const label = this.scene.add.text(0, 0, nodeNames[nodeId] || nodeId, {
        fontFamily: FONTS.terminal,
        fontSize: '14px',
        color: PALETTE.amberDimCss,
      }).setOrigin(0.5);
      container.add(label);
      this.ventUI.add(container);
      this.ventNodeGraphics.set(nodeId, container);
    }

    // Pauling icon — silhouette with dark hair and purple outfit
    this.ventPaulingIcon = this.scene.add.container(420, 170);
    // Pulsing alert ring behind her so she pops against the map
    const paulingRing = this.scene.add.circle(0, -14, 24, PALETTE.alert, 0.12);
    paulingRing.setStrokeStyle(2, PALETTE.alert, 0.5);
    this.ventPaulingIcon.add(paulingRing);
    this.scene.tweens.add({
      targets: paulingRing,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
      fontFamily: FONTS.terminal,
      fontSize: '10px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    this.ventPaulingIcon.add(paulingLabel);
    this.ventUI.add(this.ventPaulingIcon);

    // Seal indicators — red plates dropped over the vent grilles when sealed
    this.ventSealLeftIndicator = this.scene.add.rectangle(270, 514, 84, 16, 0x7a1410, 0);
    this.ventSealLeftIndicator.setStrokeStyle(2, PALETTE.alert, 0);
    this.ventUI.add(this.ventSealLeftIndicator);
    this.ventSealRightIndicator = this.scene.add.rectangle(570, 514, 84, 16, 0x7a1410, 0);
    this.ventSealRightIndicator.setStrokeStyle(2, PALETTE.alert, 0);
    this.ventUI.add(this.ventSealRightIndicator);

    // Seal buttons and thermostat go in the right panel (ventPanelControls)
    this.ventPanelControls = this.scene.add.container(0, 0);
    this.ventPanelControls.setDepth(102);
    this.ventPanelControls.setVisible(false);
    cameraUI.add(this.ventPanelControls);

    // Section header above the seal buttons
    const sealHeader = this.scene.add.text(1000, 248, '— DUCT SEALS —', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    this.ventPanelControls.add(sealHeader);

    // Left seal button (in right panel)
    this.ventSealLeftBtn = this.scene.add.container(920, 284);
    const leftBtnBg = this.scene.add.rectangle(0, 0, 140, 40, 0x1c1409);
    leftBtnBg.setStrokeStyle(2, PALETTE.amberDim);
    leftBtnBg.setInteractive({ useHandCursor: true });
    const leftBtnText = this.scene.add.text(0, 0, 'SEAL LEFT', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    leftBtnBg.on('pointerdown', () => this.host.toggleVentSeal('LEFT'));
    leftBtnBg.on('pointerover', () => leftBtnBg.setFillStyle(this.host.isVentSealedLeft() ? 0x3a1410 : 0x2a1f10));
    leftBtnBg.on('pointerout', () => leftBtnBg.setFillStyle(this.host.isVentSealedLeft() ? 0x2e100a : 0x1c1409));
    this.ventSealLeftBtn.add([leftBtnBg, leftBtnText]);
    this.ventPanelControls.add(this.ventSealLeftBtn);

    // Right seal button (in right panel)
    this.ventSealRightBtn = this.scene.add.container(1080, 284);
    const rightBtnBg = this.scene.add.rectangle(0, 0, 140, 40, 0x1c1409);
    rightBtnBg.setStrokeStyle(2, PALETTE.amberDim);
    rightBtnBg.setInteractive({ useHandCursor: true });
    const rightBtnText = this.scene.add.text(0, 0, 'SEAL RIGHT', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    rightBtnBg.on('pointerdown', () => this.host.toggleVentSeal('RIGHT'));
    rightBtnBg.on('pointerover', () => rightBtnBg.setFillStyle(this.host.isVentSealedRight() ? 0x3a1410 : 0x2a1f10));
    rightBtnBg.on('pointerout', () => rightBtnBg.setFillStyle(this.host.isVentSealedRight() ? 0x2e100a : 0x1c1409));
    this.ventSealRightBtn.add([rightBtnBg, rightBtnText]);
    this.ventPanelControls.add(this.ventSealRightBtn);

    // Vent panel thermostat (vertical, in right panel)
    const ventThermoContainer = this.scene.add.container(1000, 420);

    const vtHousing = this.scene.add.rectangle(0, 0, 44, 96, 0x1c1409);
    vtHousing.setStrokeStyle(2, 0x3a2c18);
    ventThermoContainer.add(vtHousing);

    const vtLabel = this.scene.add.text(0, -60, '— TEMPERATURE —', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    ventThermoContainer.add(vtLabel);

    const vtBarBg = this.scene.add.rectangle(-4, 0, 14, 66, 0x0a0704);
    vtBarBg.setStrokeStyle(1, PALETTE.amberFaint);
    ventThermoContainer.add(vtBarBg);

    // Gauge ticks + red danger zone at the top (Pyro trigger range)
    const vtTicks = this.scene.add.graphics();
    vtTicks.lineStyle(1, 0x8a6230, 0.6);
    for (let i = 0; i <= 4; i++) {
      const ty = 33 - i * 16.5;
      vtTicks.lineBetween(6, ty, i % 2 === 0 ? 14 : 11, ty);
    }
    vtTicks.lineStyle(3, PALETTE.alert, 0.7);
    vtTicks.lineBetween(6, -33, 6, -33 + 66 * 0.15);
    ventThermoContainer.add(vtTicks);

    this.ventPanelThermoFill = this.scene.add.rectangle(-4, 33, 10, 0, PALETTE.amberDim);
    this.ventPanelThermoFill.setOrigin(0.5, 1);
    ventThermoContainer.add(this.ventPanelThermoFill);

    this.ventPanelThermoText = this.scene.add.text(0, 60, '0°', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.amberDimCss,
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
    this.roomsTabBg = this.scene.add.rectangle(1000 - tabW/2 - tabGap/2, tabY, tabW, tabH, PALETTE.panel);
    this.roomsTabBg.setStrokeStyle(2, PALETTE.amberDim);
    this.roomsTabBg.setInteractive({ useHandCursor: true });
    this.roomsTabText = this.scene.add.text(1000 - tabW/2 - tabGap/2, tabY, 'ROOMS', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    this.roomsTabBg.on('pointerdown', () => {
      if (this.host.isVentCameraModeNow()) this.host.toggleVentCameraMode();
    });
    this.roomsTabBg.on('pointerover', () => this.roomsTabBg.setFillStyle(0x2a1f10));
    this.roomsTabBg.on('pointerout', () => this.styleTabs(true));

    // "VENTS" tab
    this.ventsTabBg = this.scene.add.rectangle(1000 + tabW/2 + tabGap/2, tabY, tabW, tabH, PALETTE.panel);
    this.ventsTabBg.setStrokeStyle(2, PALETTE.amberDim);
    this.ventsTabBg.setInteractive({ useHandCursor: true });
    this.ventCamsToggleText = this.scene.add.text(1000 + tabW/2 + tabGap/2, tabY, 'VENTS', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    this.ventsTabBg.on('pointerdown', () => {
      if (!this.host.isVentCameraModeNow()) this.host.toggleVentCameraMode();
    });
    this.ventsTabBg.on('pointerover', () => this.ventsTabBg.setFillStyle(0x2a1f10));
    this.ventsTabBg.on('pointerout', () => this.styleTabs(true));

    this.ventCamsToggleBtn.add([this.roomsTabBg, this.roomsTabText, this.ventsTabBg, this.ventCamsToggleText]);
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
    const housing = this.scene.add.rectangle(0, 0, 28, 70, 0x1c1409);
    housing.setStrokeStyle(1, 0x3a2c18);
    this.thermostatContainer.add(housing);

    // Label above
    const label = this.scene.add.text(0, -42, 'TEMP', {
      fontFamily: FONTS.terminal,
      fontSize: '10px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    this.thermostatContainer.add(label);

    // Vertical bar background (mercury-style)
    const barBg = this.scene.add.rectangle(0, 0, 10, 50, 0x0a0704);
    barBg.setStrokeStyle(1, PALETTE.amberFaint);
    this.thermostatContainer.add(barBg);

    // Fill bar (grows upward from bottom)
    this.thermostatFill = this.scene.add.rectangle(0, 25, 6, 0, PALETTE.amberDim);
    this.thermostatFill.setOrigin(0.5, 1);
    this.thermostatContainer.add(this.thermostatFill);

    // Percentage text below
    this.thermostatText = this.scene.add.text(0, 42, '', {
      fontFamily: FONTS.terminal,
      fontSize: '10px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    this.thermostatContainer.add(this.thermostatText);
  }

  /** Restyle the ROOMS/VENTS tabs so the active view reads as the raised tab. */
  private styleTabs(force = false): void {
    const ventMode = this.host.isVentCameraModeNow();
    if (!force && ventMode === this.lastTabMode) return;
    this.lastTabMode = ventMode;

    const active = { fill: 0x2a1f10, stroke: PALETTE.cream, text: PALETTE.creamCss };
    const idle = { fill: PALETTE.panel, stroke: PALETTE.amberFaint, text: PALETTE.amberDimCss };

    const rooms = ventMode ? idle : active;
    const vents = ventMode ? active : idle;
    this.roomsTabBg.setFillStyle(rooms.fill);
    this.roomsTabBg.setStrokeStyle(2, rooms.stroke);
    this.roomsTabText.setColor(rooms.text);
    this.ventsTabBg.setFillStyle(vents.fill);
    this.ventsTabBg.setStrokeStyle(2, vents.stroke);
    this.ventCamsToggleText.setColor(vents.text);
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
    this.styleTabs();

    // Show thermostat when in Intel room
    this.thermostatContainer.setVisible(!this.host.isTeleportedNow());

    // Update Pauling icon position on vent map
    if (this.ventUI.visible && pauling.isActive()) {
      const pos = VENT_NODE_POSITIONS[pauling.getCurrentNode()];
      if (pos) {
        this.ventPaulingIcon.setPosition(pos.x, pos.y);
      }

      // Highlight current node — alert red where Pauling is
      this.ventNodeGraphics.forEach((container, nodeId) => {
        const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
        if (nodeId === pauling.getCurrentNode()) {
          bg.setFillStyle(0x2e100a);
          bg.setStrokeStyle(2, PALETTE.alert);
        } else {
          bg.setFillStyle(PALETTE.panel);
          bg.setStrokeStyle(1, PALETTE.amberFaint);
        }
      });
    }

    // Update seal indicators (red plates over the grilles)
    this.ventSealLeftIndicator?.setFillStyle(0x7a1410, ventSealLeft ? 0.85 : 0);
    this.ventSealLeftIndicator?.setStrokeStyle(2, PALETTE.alert, ventSealLeft ? 0.9 : 0);
    this.ventSealRightIndicator?.setFillStyle(0x7a1410, ventSealRight ? 0.85 : 0);
    this.ventSealRightIndicator?.setStrokeStyle(2, PALETTE.alert, ventSealRight ? 0.9 : 0);

    // Update seal button colors (sealed = engaged red state)
    const leftBg = this.ventSealLeftBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    const leftText = this.ventSealLeftBtn.getAt(1) as Phaser.GameObjects.Text;
    const rightBg = this.ventSealRightBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    const rightText = this.ventSealRightBtn.getAt(1) as Phaser.GameObjects.Text;
    if (ventSealLeft) {
      leftBg.setStrokeStyle(2, PALETTE.alert);
      leftText.setText('UNSEAL L');
      leftText.setColor(PALETTE.alertCss);
    } else {
      leftBg.setStrokeStyle(2, PALETTE.amberDim);
      leftText.setText('SEAL LEFT');
      leftText.setColor(PALETTE.amberCss);
    }
    if (ventSealRight) {
      rightBg.setStrokeStyle(2, PALETTE.alert);
      rightText.setText('UNSEAL R');
      rightText.setColor(PALETTE.alertCss);
    } else {
      rightBg.setStrokeStyle(2, PALETTE.amberDim);
      rightText.setText('SEAL RIGHT');
      rightText.setColor(PALETTE.amberCss);
    }

    // Update thermostat display (vertical mercury bar) — both Intel room and vent panel
    // Display range: 50° (cold) to 110° (Pyro trigger)
    const pct = Math.min(this.host.getThermostat() / GAME_CONSTANTS.THERMOSTAT_MAX, 1);
    const displayTemp = Math.floor(GAME_CONSTANTS.THERMOSTAT_DISPLAY_MIN + pct * (GAME_CONSTANTS.THERMOSTAT_DISPLAY_MAX - GAME_CONSTANTS.THERMOSTAT_DISPLAY_MIN));
    // Cool = dim amber, heating = amber → orange → alert red
    const thermoColor = pct < 0.4 ? 0x8a6230 : pct < 0.7 ? 0xffb454 : pct < 0.9 ? 0xff8800 : 0xff3b30;
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
