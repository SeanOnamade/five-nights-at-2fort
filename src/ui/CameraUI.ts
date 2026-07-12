import Phaser from 'phaser';
import { CAMERAS } from '../types';
import { drawEnemySilhouette } from '../drawing/enemySilhouettes';
import { PALETTE, FONTS } from './kit/theme';

/** Green night-vision palette — used ONLY inside the camera feed screen */
const FEED = {
  textCss: '#00dd44',
  dimCss: '#00aa44',
  faintCss: '#006622',
  logCss: '#004422',
  line: 0x003311,
  bg: 0x001a08,
};

/**
 * Scene callbacks for camera UI interactions. Implemented by GameScene, which
 * keeps the game logic (teleporting, repair, lures, hack interrupts).
 */
export interface CameraUIHooks {
  isCameraModeNow(): boolean;
  getGameMinutes(): number;
  selectCamera(index: number): void;
  onRepairCameraClicked(): void;
  onAdminHackBarClicked(): void;
  onTeleportButtonOver(): void;
  onTeleportButtonOut(): void;
  onTeleportButtonDown(): void;
  onTeleportButtonUp(): void;
  onLureButtonOver(): void;
  onLureButtonOut(): void;
  onLureButtonDown(): void;
  onReturnToIntel(): void;
  onToggleLure(): void;
}

/** Every display object the camera system creates; the scene stores these on itself. */
export interface CameraUIElements {
  cameraUI: Phaser.GameObjects.Container;
  cameraFeedPanel: Phaser.GameObjects.Rectangle;
  cameraFeedTitle: Phaser.GameObjects.Text;
  cameraFeedEmpty: Phaser.GameObjects.Text;
  cameraFeedEnemy: Phaser.GameObjects.Container;
  cameraFeedEnemy2: Phaser.GameObjects.Container;
  cameraFeedEnemy3: Phaser.GameObjects.Container;
  cameraFeedEnemyEyeGlow: Phaser.GameObjects.Graphics;
  cameraFeedDemoHead: Phaser.GameObjects.Container;
  cameraLureIndicator: Phaser.GameObjects.Container;
  cameraStaticGraphics: Phaser.GameObjects.Graphics;
  cameraStaticBurstOverlay: Phaser.GameObjects.Graphics;
  cameraFeedRoomProps: Phaser.GameObjects.Graphics;
  roomViewProps: Phaser.GameObjects.Graphics;
  mapTitleText: Phaser.GameObjects.Text;
  cameraMapContent: Phaser.GameObjects.Container;
  cameraMapNodes: Map<string, Phaser.GameObjects.Container>;
  hackedRoomMapIndicators: Map<string, Phaser.GameObjects.Text>;
  hackStartMapIndicators: Map<string, Phaser.GameObjects.Text>;
  intelRoomIcon: Phaser.GameObjects.Arc;
  scoutMapIcon: Phaser.GameObjects.Container;
  soldierMapIcon: Phaser.GameObjects.Container;
  cameraDestroyedOverlay: Phaser.GameObjects.Container;
  cameraDestroyedText: Phaser.GameObjects.Text;
  cameraRepairButton: Phaser.GameObjects.Container;
  cameraWatchWarning: Phaser.GameObjects.Container;
  cameraWatchBar: Phaser.GameObjects.Rectangle;
  cameraBootOverlay: Phaser.GameObjects.Container;
  administratorHackBarContainer: Phaser.GameObjects.Container;
  administratorHackBarBorder: Phaser.GameObjects.Rectangle;
  administratorHackBarFill: Phaser.GameObjects.Rectangle;
  administratorHackLabel: Phaser.GameObjects.Text;
  administratorHackHint: Phaser.GameObjects.Text;
  administratorRepairOverlay: Phaser.GameObjects.Container;
  administratorRepairBarFill: Phaser.GameObjects.Rectangle;
  teleportButton: Phaser.GameObjects.Container;
  teleportButtonBg: Phaser.GameObjects.Rectangle;
  teleportButtonText: Phaser.GameObjects.Text;
  teleportRepairBarBg: Phaser.GameObjects.Rectangle;
  teleportRepairBarFill: Phaser.GameObjects.Rectangle;
  cameraLureButton: Phaser.GameObjects.Container;
  roomViewUI: Phaser.GameObjects.Container;
  roomViewHeader: Phaser.GameObjects.Text;
  lureButton: Phaser.GameObjects.Container;
  returnButton: Phaser.GameObjects.Container;
  escapeWarning: Phaser.GameObjects.Container;
  roomDoorway: Phaser.GameObjects.Container;
  roomDoorwayEyes: Phaser.GameObjects.Container;
  pyroEscapeWarning: Phaser.GameObjects.Container;
  pyroEscapeTimer: Phaser.GameObjects.Text;
}

/**
 * Build the full camera system UI (feed monitor, facility map, destroyed/boot
 * overlays, admin hack bar, teleporter buttons, and the teleported room view).
 * Extracted from GameScene; returns the created objects for the scene to own.
 */
export function buildCameraUI(scene: Phaser.Scene, hooks: CameraUIHooks): CameraUIElements {
  const el = {
    cameraMapNodes: new Map<string, Phaser.GameObjects.Container>(),
    hackedRoomMapIndicators: new Map<string, Phaser.GameObjects.Text>(),
    hackStartMapIndicators: new Map<string, Phaser.GameObjects.Text>(),
  } as CameraUIElements;
  buildMainCameraUI(scene, hooks, el);
  return el;
}

function buildMainCameraUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {
    // Camera UI container (hidden by default)
    el.cameraUI = scene.add.container(0, 0);
    el.cameraUI.setVisible(false);
    el.cameraUI.setDepth(100);  // Above game elements
    
    // Dark overlay with vignette effect
    const overlay = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    el.cameraUI.add(overlay);
    
    // ========== CAMERA FEED PANEL (LEFT/CENTER) ==========
    // Outer monitor housing — warm terminal chrome
    const monitorOuter = scene.add.rectangle(420, 340, 580, 500, 0x1c1409);
    monitorOuter.setStrokeStyle(6, 0x2e2214);
    el.cameraUI.add(monitorOuter);
    
    // Corner bolts for industrial look
    const boltPositions = [[145, 105], [695, 105], [145, 575], [695, 575]];
    boltPositions.forEach(([x, y]) => {
      const boltOuter = scene.add.circle(x, y, 10, 0x39301e);
      boltOuter.setStrokeStyle(2, 0x4a3d24);
      el.cameraUI.add(boltOuter);
      const boltInner = scene.add.circle(x, y, 4, 0x241c10);
      el.cameraUI.add(boltInner);
    });
    
    // Inner bezel with gradient effect
    const monitorBezel = scene.add.rectangle(420, 345, 540, 450, 0x0c0804);
    monitorBezel.setStrokeStyle(4, 0x1a1208);
    el.cameraUI.add(monitorBezel);
    
    // Screen area with green tint (night vision style)
    el.cameraFeedPanel = scene.add.rectangle(420, 350, 510, 410, 0x010804);
    el.cameraFeedPanel.setStrokeStyle(2, 0x003311);
    el.cameraUI.add(el.cameraFeedPanel);
    
    // CRT screen glow effect (green ambient glow around edges)
    const crtGlow = scene.add.graphics();
    // Outer glow
    crtGlow.lineStyle(8, 0x003311, 0.3);
    crtGlow.strokeRoundedRect(162, 142, 516, 416, 4);
    crtGlow.lineStyle(4, 0x004422, 0.2);
    crtGlow.strokeRoundedRect(158, 138, 524, 424, 6);
    el.cameraUI.add(crtGlow);
    
    // CRT corner vignette effect - darker and more pronounced
    const vignetteGraphics = scene.add.graphics();
    vignetteGraphics.fillStyle(0x000000, 0.7);
    // Top-left corner
    vignetteGraphics.fillTriangle(165, 145, 240, 145, 165, 220);
    // Top-right corner  
    vignetteGraphics.fillTriangle(675, 145, 600, 145, 675, 220);
    // Bottom-left corner
    vignetteGraphics.fillTriangle(165, 555, 240, 555, 165, 480);
    // Bottom-right corner
    vignetteGraphics.fillTriangle(675, 555, 600, 555, 675, 480);
    el.cameraUI.add(vignetteGraphics);
    
    // CRT screen curvature simulation (darker edges)
    const curvature = scene.add.graphics();
    curvature.fillStyle(0x000000, 0.25);
    // Top edge darkening
    curvature.fillRect(165, 145, 510, 25);
    // Bottom edge darkening
    curvature.fillRect(165, 530, 510, 25);
    // Left edge darkening
    curvature.fillRect(165, 145, 25, 410);
    // Right edge darkening
    curvature.fillRect(650, 145, 25, 410);
    curvature.setDepth(102);
    el.cameraUI.add(curvature);
    
    // Scanline overlay effect - VISIBLE scanlines
    const scanlines = scene.add.graphics();
    scanlines.setDepth(103);
    for (let y = 145; y < 555; y += 3) {
      scanlines.lineStyle(1, 0x000000, 0.25);
      scanlines.lineBetween(165, y, 675, y);
    }
    el.cameraUI.add(scanlines);
    
    // Green CRT overlay - visible green tint
    const crtGreenOverlay = scene.add.rectangle(420, 350, 510, 410, 0x00ff00, 0.04);
    crtGreenOverlay.setDepth(101);
    el.cameraUI.add(crtGreenOverlay);
    
    // CRT flicker effect (animated green tint that pulses)
    const crtFlicker = scene.add.rectangle(420, 350, 510, 410, 0x003311, 0.05);
    crtFlicker.setDepth(104);
    el.cameraUI.add(crtFlicker);
    scene.tweens.add({
      targets: crtFlicker,
      alpha: 0.12,
      duration: 80,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
      easeParams: [2],
    });
    
    // Camera feed title bar with styled look
    const titleBarBg = scene.add.rectangle(420, 128, 510, 26, 0x001a08);
    titleBarBg.setStrokeStyle(1, 0x003311);
    el.cameraUI.add(titleBarBg);
    
    el.cameraFeedTitle = scene.add.text(420, 128, 'CAM 01 - COURTYARD', {
      fontFamily: FONTS.terminal,
      fontSize: '17px',
      color: FEED.textCss,
    }).setOrigin(0.5);
    el.cameraUI.add(el.cameraFeedTitle);
    
    // Static noise effect for camera feed
    el.cameraStaticGraphics = scene.add.graphics();
    el.cameraUI.add(el.cameraStaticGraphics);
    
    // Room environment in feed — same perspective shell as the intel office,
    // rendered in the night-vision green palette
    const feedGraphics = scene.add.graphics();
    
    // Ceiling
    feedGraphics.fillStyle(0x02140a, 1);
    feedGraphics.beginPath();
    feedGraphics.moveTo(165, 145);
    feedGraphics.lineTo(675, 145);
    feedGraphics.lineTo(600, 190);
    feedGraphics.lineTo(240, 190);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    // Ceiling light fixture (dim green glow)
    feedGraphics.fillStyle(0x0f3a1e, 0.8);
    feedGraphics.fillRect(395, 160, 50, 8);
    feedGraphics.fillStyle(0x0f3a1e, 0.25);
    feedGraphics.fillRect(380, 168, 80, 25);
    
    // Floor with perspective
    feedGraphics.fillStyle(0x03180c, 1);
    feedGraphics.beginPath();
    feedGraphics.moveTo(165, 555);
    feedGraphics.lineTo(675, 555);
    feedGraphics.lineTo(600, 440);
    feedGraphics.lineTo(240, 440);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    // Floor perspective lines
    feedGraphics.lineStyle(1, 0x0a2e16, 0.45);
    feedGraphics.lineBetween(240, 440, 165, 555);
    feedGraphics.lineBetween(320, 440, 260, 555);
    feedGraphics.lineBetween(420, 440, 420, 555);
    feedGraphics.lineBetween(520, 440, 580, 555);
    feedGraphics.lineBetween(600, 440, 675, 555);
    
    // Back wall
    feedGraphics.fillStyle(0x062412, 1);
    feedGraphics.fillRect(240, 190, 360, 250);
    
    // Wainscot band + trim on the back wall (matches the intel office read)
    feedGraphics.fillStyle(0x04200f, 1);
    feedGraphics.fillRect(240, 385, 360, 55);
    feedGraphics.lineStyle(1, 0x1a5a2e, 0.5);
    feedGraphics.lineBetween(240, 385, 600, 385);
    
    // Side walls with perspective
    feedGraphics.fillStyle(0x02140a, 1);
    feedGraphics.beginPath();
    feedGraphics.moveTo(165, 145);
    feedGraphics.lineTo(240, 190);
    feedGraphics.lineTo(240, 440);
    feedGraphics.lineTo(165, 555);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    feedGraphics.beginPath();
    feedGraphics.moveTo(675, 145);
    feedGraphics.lineTo(600, 190);
    feedGraphics.lineTo(600, 440);
    feedGraphics.lineTo(675, 555);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    // Doorway/corridor entrance - darker void
    feedGraphics.fillStyle(0x010402, 1);
    feedGraphics.fillRect(360, 230, 120, 210);
    
    // Door frame
    feedGraphics.lineStyle(2, 0x0f3a1e);
    feedGraphics.strokeRect(360, 230, 120, 210);
    
    el.cameraUI.add(feedGraphics);
    
    // Per-room prop layer — redrawn by GameScene.selectCamera() for each room
    el.cameraFeedRoomProps = scene.add.graphics();
    el.cameraUI.add(el.cameraFeedRoomProps);
    
    // "No activity" text (hidden - doorways just show darkness)
    el.cameraFeedEmpty = scene.add.text(420, 350, '', {
      fontFamily: FONTS.terminal,
      fontSize: '20px',
      color: '#1a4422',
    }).setOrigin(0.5);
    el.cameraFeedEmpty.setVisible(false);  // Never show "CLEAR" text
    el.cameraUI.add(el.cameraFeedEmpty);
    
    // (Removed clear text pulsing - no longer used)
    scene.tweens.add({
      targets: el.cameraFeedEmpty,
      alpha: 0.4,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
    
    // Enemy figure in feed (shown when enemy is at selected camera)
    // Position slightly left to make room for Demo head on right
    el.cameraFeedEnemy = scene.add.container(380, 370);
    
    // Create detailed enemy graphics
    const enemyGraphics = scene.add.graphics();
    
    // Shadow on ground
    enemyGraphics.fillStyle(0x000000, 0.6);
    enemyGraphics.fillEllipse(0, 90, 120, 30);
    
    // Default silhouette (will be redrawn based on enemy type)
    drawEnemySilhouette(enemyGraphics, 'SCOUT');
    
    // Piercing glowing eyes (on face level, not above head)
    el.cameraFeedEnemyEyeGlow = scene.add.graphics();
    el.cameraFeedEnemyEyeGlow.fillStyle(0xff0000, 0.3);
    el.cameraFeedEnemyEyeGlow.fillCircle(-12, -55, 18);
    el.cameraFeedEnemyEyeGlow.fillCircle(12, -55, 18);
    el.cameraFeedEnemyEyeGlow.fillStyle(0xff0000, 1);
    el.cameraFeedEnemyEyeGlow.fillCircle(-12, -55, 7);
    el.cameraFeedEnemyEyeGlow.fillCircle(12, -55, 7);
    el.cameraFeedEnemyEyeGlow.fillStyle(0xffffff, 1);
    el.cameraFeedEnemyEyeGlow.fillCircle(-10, -57, 2);
    el.cameraFeedEnemyEyeGlow.fillCircle(14, -57, 2);
    
    // Pulsing eye animation
    scene.tweens.add({
      targets: el.cameraFeedEnemyEyeGlow,
      alpha: 0.6,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
    
    const enemyLabel = scene.add.text(0, 105, '', {
      fontFamily: FONTS.terminal,
      fontSize: '17px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    
    el.cameraFeedEnemy.add([enemyGraphics, el.cameraFeedEnemyEyeGlow, enemyLabel]);
    el.cameraFeedEnemy.setVisible(false);
    el.cameraUI.add(el.cameraFeedEnemy);
    
    // Slight sway animation for creepiness
    scene.tweens.add({
      targets: el.cameraFeedEnemy,
      x: 385,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // SECOND enemy slot (for showing multiple enemies)
    el.cameraFeedEnemy2 = scene.add.container(480, 370);
    const enemyGraphics2 = scene.add.graphics();
    enemyGraphics2.fillStyle(0x000000, 0.6);
    enemyGraphics2.fillEllipse(0, 90, 100, 25);
    const enemyLabel2 = scene.add.text(0, 105, '', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    el.cameraFeedEnemy2.add([enemyGraphics2, enemyLabel2]);
    el.cameraFeedEnemy2.setVisible(false);
    el.cameraFeedEnemy2.setScale(0.75); // Slightly smaller
    el.cameraUI.add(el.cameraFeedEnemy2);
    
    scene.tweens.add({
      targets: el.cameraFeedEnemy2,
      x: 485,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // THIRD enemy slot (for showing multiple enemies)
    el.cameraFeedEnemy3 = scene.add.container(570, 380);
    const enemyGraphics3 = scene.add.graphics();
    enemyGraphics3.fillStyle(0x000000, 0.6);
    enemyGraphics3.fillEllipse(0, 90, 80, 20);
    const enemyLabel3 = scene.add.text(0, 105, '', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    el.cameraFeedEnemy3.add([enemyGraphics3, enemyLabel3]);
    el.cameraFeedEnemy3.setVisible(false);
    el.cameraFeedEnemy3.setScale(0.6); // Smaller, in background
    el.cameraUI.add(el.cameraFeedEnemy3);
    
    // SECONDARY DISPLAY: Demoman's head (can appear alongside other enemies)
    el.cameraFeedDemoHead = scene.add.container(530, 420);
    const demoHeadGraphics = scene.add.graphics();
    // Will be drawn when visible
    const demoHeadLabel = scene.add.text(0, 55, '', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: '#44ff44',
    }).setOrigin(0.5);
    el.cameraFeedDemoHead.add([demoHeadGraphics, demoHeadLabel]);
    el.cameraFeedDemoHead.setVisible(false);
    el.cameraFeedDemoHead.setScale(0.7); // Smaller, off to the side
    el.cameraUI.add(el.cameraFeedDemoHead);
    
    // LURE INDICATOR - shows when a lure is at this camera (placed or playing)
    el.cameraLureIndicator = scene.add.container(420, 490);
    const lureBg = scene.add.rectangle(0, 0, 180, 28, 0x553300, 0.9);
    lureBg.setStrokeStyle(2, 0xffaa00);
    const lureIcon = scene.add.text(-70, 0, '♪', { fontSize: '16px', color: '#ffaa00' }).setOrigin(0.5);
    const lureText = scene.add.text(10, 0, 'LURE PLACED', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: '#ffcc00',
    }).setOrigin(0.5);
    el.cameraLureIndicator.add([lureBg, lureIcon, lureText]);
    el.cameraLureIndicator.setVisible(false);
    el.cameraUI.add(el.cameraLureIndicator);
    
    // Pulse the lure indicator when active
    scene.tweens.add({
      targets: el.cameraLureIndicator,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    // Recording indicator container - top left of screen
    const recContainer = scene.add.container(185, 158);
    const recBg = scene.add.rectangle(0, 0, 55, 20, 0x220000, 0.7);
    recBg.setStrokeStyle(1, 0x440000);
    const recDot = scene.add.circle(-18, 0, 5, 0xff0000);
    const recText = scene.add.text(5, 0, 'REC', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    recContainer.add([recBg, recDot, recText]);
    el.cameraUI.add(recContainer);
    
    // Timestamp - bottom right of screen with background
    const timestampBg = scene.add.rectangle(625, 538, 85, 20, 0x001a08, 0.7);
    timestampBg.setStrokeStyle(1, 0x003311);
    el.cameraUI.add(timestampBg);
    
    const timestamp = scene.add.text(625, 538, '12:XX AM', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: FEED.dimCss,
    }).setOrigin(0.5);
    el.cameraUI.add(timestamp);
    
    // Update timestamp periodically
    // Update timestamp - only show hour (not minutes) to prevent predicting enemy arrivals
    scene.time.addEvent({
      delay: 1000,  // Update every second
      callback: () => {
        if (hooks.isCameraModeNow()) {
          const hours24 = Math.floor(hooks.getGameMinutes() / 60);
          const displayHours = hours24 === 0 ? 12 : hours24;
          timestamp.setText(`${displayHours}:XX AM`); // No padding
        }
      },
      loop: true,
    });
    
    // Blink recording light
    scene.tweens.add({
      targets: [recDot, recText],
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    // ========== MAP PANEL (RIGHT SIDE) ==========
    // Outer frame stays visible even in vent mode; inner content hides

    // Metal frame with industrial look - EXPANDED
    const mapOuterFrame = scene.add.rectangle(1000, 340, 370, 430, 0x1c1409);
    mapOuterFrame.setStrokeStyle(3, 0x3a2c18);
    el.cameraUI.add(mapOuterFrame);
    
    // Screws/bolts in corners - adjusted for wider frame
    const screwPositions = [[828, 138], [1172, 138], [828, 542], [1172, 542]];
    screwPositions.forEach(([x, y]) => {
      const screw = scene.add.circle(x, y, 5, 0x4a3d24);
      screw.setStrokeStyle(1, 0x5c4c2e);
      el.cameraUI.add(screw);
      const screwSlot = scene.add.text(x, y, '+', {
        fontSize: '8px',
        color: '#2a2114',
      }).setOrigin(0.5);
      el.cameraUI.add(screwSlot);
    });
    
    // Screen bezel - WIDER to fit map
    const mapFrame = scene.add.rectangle(1000, 340, 355, 400, 0x0c0804);
    mapFrame.setStrokeStyle(4, 0x241a0e);
    el.cameraUI.add(mapFrame);
    
    // Inner screen with slight glow - WIDER
    const mapScreen = scene.add.rectangle(1000, 350, 340, 370, PALETTE.bg);
    mapScreen.setStrokeStyle(2, PALETTE.amberFaint);
    el.cameraUI.add(mapScreen);
    
    // Title bar for map - WIDER
    const mapTitleBar = scene.add.rectangle(1000, 155, 340, 24, PALETTE.panel);
    mapTitleBar.setStrokeStyle(1, PALETTE.amberFaint);
    el.cameraUI.add(mapTitleBar);
    
    el.mapTitleText = scene.add.text(1000, 155, '◈ FACILITY OVERVIEW ◈', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    el.cameraUI.add(el.mapTitleText);

    // Inner content container (hidden when viewing vents)
    el.cameraMapContent = scene.add.container(0, 0);
    el.cameraUI.add(el.cameraMapContent);
    
    // Blueprint grid effect - WIDER
    const gridGraphics = scene.add.graphics();
    gridGraphics.lineStyle(1, 0x1c1409, 0.5);
    for (let x = 830; x <= 1170; x += 15) {
      gridGraphics.lineBetween(x, 170, x, 530);
    }
    for (let y = 170; y <= 530; y += 15) {
      gridGraphics.lineBetween(830, y, 1170, y);
    }
    el.cameraMapContent.add(gridGraphics);
    
    // Draw the map layout with paths - ALIGNED LAYOUT
    const mapGraphics = scene.add.graphics();
    const mapOffsetX = 835;  // Shifted left for wider area
    const mapOffsetY = 175;
    const mapScale = 1.0;
    
    // Node positions (matching CAMERAS in types/index.ts) - spaced out bottom row
    const staircaseX = mapOffsetX + 55;
    const staircaseY = mapOffsetY + 30;
    const courtyardX = mapOffsetX + 165;  // Above Spiral (adjusted)
    const courtyardY = mapOffsetY + 30;
    const leftHallX = mapOffsetX + 55;
    const leftHallY = mapOffsetY + 105;
    const rightHallX = mapOffsetX + 105;  // Spaced out
    const rightHallY = mapOffsetY + 180;
    const spiralX = mapOffsetX + 165;     // Spaced out
    const spiralY = mapOffsetY + 180;
    const grateX = mapOffsetX + 225;      // Spaced out
    const grateY = mapOffsetY + 180;
    const bridgeX = mapOffsetX + 285;     // Spaced out
    const bridgeY = mapOffsetY + 180;
    const sewerX = mapOffsetX + 225;      // Below Grate (adjusted)
    const sewerY = mapOffsetY + 255;
    const intelPathX = mapOffsetX + 55;   // Directly below Left Hall
    const intelPathY = mapOffsetY + 255;  // Below the bottom row
    
    // Staircase to Courtyard (straight line at top)
    mapGraphics.lineStyle(2, PALETTE.amberDim, 0.6);
    mapGraphics.lineBetween(staircaseX, staircaseY, courtyardX, courtyardY);
    
    // Staircase to Left Hall (vertical)
    mapGraphics.lineBetween(staircaseX, staircaseY, leftHallX, leftHallY);
    
    // Courtyard to Grate (diagonal connection)
    mapGraphics.lineStyle(2, PALETTE.amberDim, 0.35);
    mapGraphics.lineBetween(courtyardX, courtyardY, grateX, grateY);
    
    // Courtyard to Bridge (diagonal connection)
    mapGraphics.lineBetween(courtyardX, courtyardY, bridgeX, bridgeY);
    
    // Left Hall to Intel (vertical down - directly below)
    mapGraphics.lineStyle(2, 0xff6600, 0.5);
    mapGraphics.lineBetween(leftHallX, leftHallY, intelPathX, intelPathY);
    
    // Right Hall to Intel (diagonal connection)
    mapGraphics.lineStyle(2, 0xff6600, 0.4);
    mapGraphics.lineBetween(rightHallX, rightHallY, intelPathX, intelPathY);
    
    // Left Hall to Right Hall (diagonal)
    mapGraphics.lineStyle(2, PALETTE.amberDim, 0.45);
    mapGraphics.lineBetween(leftHallX, leftHallY, rightHallX, rightHallY);
    
    // Bottom horizontal row: Right Hall - Spiral - Grate - Bridge (more spaced out)
    mapGraphics.lineStyle(2, PALETTE.amberDim, 0.6);
    mapGraphics.lineBetween(rightHallX, rightHallY, spiralX, spiralY);
    mapGraphics.lineBetween(spiralX, spiralY, grateX, grateY);
    mapGraphics.lineBetween(grateX, grateY, bridgeX, bridgeY);
    
    // Grate to Sewer (vertical down)
    mapGraphics.lineStyle(2, PALETTE.amberDim, 0.4);
    mapGraphics.lineBetween(grateX, grateY, sewerX, sewerY);
    
    el.cameraMapContent.add(mapGraphics);
    
    // Create clickable camera nodes on the map - cleaner design
    CAMERAS.forEach((cam, index) => {
      const nodeX = mapOffsetX + cam.mapX * mapScale;
      const nodeY = mapOffsetY + cam.mapY * mapScale;
      
      // Outer selection ring (hidden by default)
      // Node glow (square)
      const nodeGlow = scene.add.rectangle(nodeX, nodeY, 50, 50, PALETTE.amber, 0);
      
      // Node background - square button (larger, easier to click)
      const nodeBg = scene.add.rectangle(nodeX, nodeY, 44, 44, PALETTE.panel);
      nodeBg.setStrokeStyle(2, PALETTE.amberDim);
      nodeBg.setInteractive({ useHandCursor: true });
      
      // Click to select camera
      nodeBg.on('pointerdown', () => {
        hooks.selectCamera(index);
      });
      nodeBg.on('pointerover', () => {
        nodeBg.setFillStyle(0x2a1f10);
        nodeBg.setStrokeStyle(2, PALETTE.cream);
      });
      nodeBg.on('pointerout', () => {
        nodeBg.setFillStyle(PALETTE.panel);
        nodeBg.setStrokeStyle(2, PALETTE.amberDim);
      });
      
      // Camera number - use cam.id to match the feed title
      const camNum = scene.add.text(nodeX, nodeY - 2, `${cam.id}`, {
        fontFamily: FONTS.terminal,
        fontSize: '20px',
        color: PALETTE.amberCss,
      }).setOrigin(0.5);
      
      // Camera name below
      const nodeLabel = scene.add.text(nodeX, nodeY + 32, cam.name, {
        fontFamily: FONTS.terminal,
        fontSize: '11px',
        color: PALETTE.amberDimCss,
      }).setOrigin(0.5);
      
      const nodeContainer = scene.add.container(0, 0, [nodeGlow, nodeBg, camNum, nodeLabel]);
      el.cameraMapNodes.set(cam.node, nodeContainer);
      el.cameraMapContent.add(nodeContainer);
    });

    // Create hacked room X indicators on the map (hidden by default, shown when Administrator hacks a room)
    CAMERAS.forEach((cam) => {
      const nodeX = mapOffsetX + cam.mapX * mapScale;
      const nodeY = mapOffsetY + cam.mapY * mapScale;
      const hackIndicator = scene.add.text(nodeX + 14, nodeY - 14, '✕', {
        fontFamily: FONTS.terminal,
        fontSize: '17px',
        color: PALETTE.alertCss,
      }).setOrigin(0.5).setVisible(false).setDepth(106);
      el.hackedRoomMapIndicators.set(cam.node, hackIndicator);
      el.cameraMapContent.add(hackIndicator);

      // Transient "!" shown for a few seconds when the Administrator BEGINS
      // hacking this room — rewards players who check the map quickly.
      const hackStartIndicator = scene.add.text(nodeX - 16, nodeY - 14, '!', {
        fontFamily: FONTS.terminal,
        fontSize: '22px',
        color: PALETTE.alertCss,
        fontStyle: 'bold',
      }).setOrigin(0.5).setVisible(false).setDepth(106);
      el.hackStartMapIndicators.set(cam.node, hackStartIndicator);
      el.cameraMapContent.add(hackStartIndicator);
    });
    
    // Intel Room marker (your position) - directly below Left Hall
    const intelMarkerX = mapOffsetX + 55;   // Same X as Left Hall
    const intelMarkerY = mapOffsetY + 255;  // Below the bottom row, same as Sewer
    
    // Pulsing outer ring
    const intelGlow = scene.add.circle(intelMarkerX, intelMarkerY, 26, 0xff6600, 0.15);
    el.cameraMapContent.add(intelGlow);
    
    // Main intel icon
    el.intelRoomIcon = scene.add.circle(intelMarkerX, intelMarkerY, 20, 0x331500);
    el.intelRoomIcon.setStrokeStyle(3, 0xff6600);
    el.cameraMapContent.add(el.intelRoomIcon);
    
    // Intel briefcase icon
    const intelIcon = scene.add.text(intelMarkerX, intelMarkerY - 2, '◆', {
      fontSize: '16px',
      color: '#ff8800',
    }).setOrigin(0.5);
    el.cameraMapContent.add(intelIcon);
    
    const intelLabel = scene.add.text(intelMarkerX, intelMarkerY + 32, 'INTEL', {
      fontFamily: FONTS.terminal,
      fontSize: '11px',
      color: '#ff9944',
    }).setOrigin(0.5);
    el.cameraMapContent.add(intelLabel);
    
    // Legend at bottom
    const legendY = 505;
    const legendBg = scene.add.rectangle(1000, legendY, 250, 30, PALETTE.panel, 0.8);
    legendBg.setStrokeStyle(1, PALETTE.amberFaint);
    el.cameraMapContent.add(legendBg);
    
    const legendText = scene.add.text(1000, legendY, 'CLICK NODE TO VIEW CAMERA', {
      fontFamily: FONTS.terminal,
      fontSize: '12px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    el.cameraMapContent.add(legendText);
    
    // Pulsing effect on YOUR position
    scene.tweens.add({
      targets: [el.intelRoomIcon, intelGlow],
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    
    // Status text at bottom of map
    const statusText = scene.add.text(1000, 520, '', {
      fontFamily: FONTS.terminal,
      fontSize: '12px',
      color: PALETTE.amberFaintCss,
    }).setOrigin(0.5);
    el.cameraMapContent.add(statusText);
    
    // Map icons are NOT added - player must check cameras to find enemies
    // Store references but keep them invisible (for internal use only)
    el.scoutMapIcon = scene.add.container(0, 0);
    el.scoutMapIcon.setVisible(false);
    el.soldierMapIcon = scene.add.container(0, 0);
    el.soldierMapIcon.setVisible(false);
    
    // Instructions at bottom
    const camInstructions = scene.add.text(640, 680, 'TAB TO EXIT', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.amberDimCss,
    }).setOrigin(0.5);
    el.cameraUI.add(camInstructions);
    
    // Create camera destroyed overlay (Night 3+)
    buildCameraDestroyedOverlay(scene, hooks, el);

    // Create Administrator hack bar overlay (Custom Night)
    buildAdministratorHackUI(scene, hooks, el);
    
    // Static burst overlay for camera switching (all nights)
    // Added last in createCameraUI so it renders on top of everything
    el.cameraStaticBurstOverlay = scene.add.graphics();
    el.cameraStaticBurstOverlay.setVisible(false);
    el.cameraUI.add(el.cameraStaticBurstOverlay);
    
    // Teleporter UI must be created every run: Phaser reuses this scene instance across
    // scene.start() with different nights; skipping creation on Night 1–2 leaves stale
    // references to Text/Rectangle objects destroyed at shutdown → camera switch crashes.
    // Visibility stays off until Night 3+ (see selectCamera / toggleCameraMode).
    buildTeleporterUI(scene, hooks, el);
  }

  /**
   * Create camera destroyed overlay (shown when Heavy destroys camera)
   */
function buildCameraDestroyedOverlay(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {
    el.cameraDestroyedOverlay = scene.add.container(420, 360);
    el.cameraDestroyedOverlay.setVisible(false);
    el.cameraDestroyedOverlay.setDepth(105);
    
    // Static noise background
    const staticBg = scene.add.rectangle(0, 0, 520, 420, 0x111111, 0.95);
    el.cameraDestroyedOverlay.add(staticBg);
    
    // Static noise effect
    const staticNoise = scene.add.graphics();
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(-250, 250);
      const y = Phaser.Math.Between(-200, 200);
      staticNoise.fillStyle(0xffffff, Math.random() * 0.3);
      staticNoise.fillRect(x, y, 4, 2);
    }
    el.cameraDestroyedOverlay.add(staticNoise);
    
    // Destroyed text
    el.cameraDestroyedText = scene.add.text(0, -50, '-- CAMERA OFFLINE --', {
      fontFamily: FONTS.terminal,
      fontSize: '32px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    el.cameraDestroyedOverlay.add(el.cameraDestroyedText);
    
    // Timer text
    const timerText = scene.add.text(0, 0, 'AUTO REPAIR: 30s', {
      fontFamily: FONTS.terminal,
      fontSize: '19px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    el.cameraDestroyedOverlay.add(timerText);
    
    // Repair button — terminal style
    el.cameraRepairButton = scene.add.container(0, 60);
    const repairBtnBg = scene.add.rectangle(0, 0, 200, 40, PALETTE.panel);
    repairBtnBg.setStrokeStyle(2, PALETTE.amberDim);
    repairBtnBg.setInteractive({ useHandCursor: true });
    
    const repairBtnText = scene.add.text(0, 0, 'REPAIR (50 METAL)', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    
    el.cameraRepairButton.add([repairBtnBg, repairBtnText]);
    el.cameraDestroyedOverlay.add(el.cameraRepairButton);
    
    repairBtnBg.on('pointerover', () => {
      repairBtnBg.setFillStyle(0x2a1f10);
      repairBtnText.setColor(PALETTE.creamCss);
    });
    repairBtnBg.on('pointerout', () => {
      repairBtnBg.setFillStyle(PALETTE.panel);
      repairBtnText.setColor(PALETTE.amberCss);
    });
    repairBtnBg.on('pointerdown', () => {
      hooks.onRepairCameraClicked();
    });
    
    el.cameraUI.add(el.cameraDestroyedOverlay);
    
    // Camera watch warning overlay - shows when Heavy is about to break camera or Sniper is aiming
    el.cameraWatchWarning = scene.add.container(420, 200);
    el.cameraWatchWarning.setVisible(false);
    el.cameraWatchWarning.setDepth(104);
    
    // Warning bar background
    const watchBarBg = scene.add.rectangle(0, 0, 300, 20, 0x331111);
    watchBarBg.setStrokeStyle(2, 0xff4444);
    el.cameraWatchWarning.add(watchBarBg);
    
    // Warning bar fill (will be scaled based on progress)
    el.cameraWatchBar = scene.add.rectangle(-147, 0, 294, 14, 0xff4444, 0.8);
    el.cameraWatchBar.setOrigin(0, 0.5);
    el.cameraWatchWarning.add(el.cameraWatchBar);
    
    // Warning text
    const watchWarningText = scene.add.text(0, -25, 'LOOK AWAY', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    el.cameraWatchWarning.add(watchWarningText);
    
    // Add scary shake animation to warning text
    scene.tweens.add({
      targets: watchWarningText,
      x: -2,
      duration: 50,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: watchWarningText,
      y: -27,
      duration: 60,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    el.cameraUI.add(el.cameraWatchWarning);
    
    // ========== CAMERA BOOT-UP OVERLAY ==========
    // Shown during the 1-second camera boot delay
    // Must cover the entire camera view INCLUDING the title bar at the top
    // Title bar is at y~128, feed goes from ~145 to ~555
    // So we need to cover from y~110 to y~560, centered at y~335
    el.cameraBootOverlay = scene.add.container(420, 335);
    el.cameraBootOverlay.setDepth(110); // Above other camera elements
    
    // Dark boot screen - sized to fully cover the camera screen AND title bar
    // Covers from y=110 to y=560 (height 450) and x=155 to x=685 (width 530)
    const bootScreenBg = scene.add.rectangle(0, 0, 530, 460, 0x000803, 1.0);
    bootScreenBg.setStrokeStyle(2, 0x003311);
    el.cameraBootOverlay.add(bootScreenBg);
    
    // Boot-up text title (adjusted for new container position)
    const bootTitle = scene.add.text(0, -85, 'CAMERA SYSTEM', {
      fontFamily: FONTS.terminal,
      fontSize: '22px',
      color: FEED.dimCss,
    }).setOrigin(0.5);
    el.cameraBootOverlay.add(bootTitle);
    
    // Boot status text (animated)
    const bootStatus = scene.add.text(0, -45, 'INITIALIZING...', {
      fontFamily: FONTS.terminal,
      fontSize: '17px',
      color: FEED.faintCss,
    }).setOrigin(0.5);
    el.cameraBootOverlay.add(bootStatus);
    
    // Progress bar background (adjusted for new container position)
    const bootBarBg = scene.add.rectangle(0, 15, 300, 20, 0x001108);
    bootBarBg.setStrokeStyle(2, 0x003311);
    el.cameraBootOverlay.add(bootBarBg);
    
    // Progress bar fill (will be animated)
    const bootBarFill = scene.add.rectangle(-147, 15, 0, 14, 0x00aa44, 0.8);
    bootBarFill.setOrigin(0, 0.5);
    bootBarFill.setName('bootBarFill');
    el.cameraBootOverlay.add(bootBarFill);
    
    // Boot percentage text
    const bootPercent = scene.add.text(0, 50, '0%', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: FEED.dimCss,
    }).setOrigin(0.5);
    bootPercent.setName('bootPercent');
    el.cameraBootOverlay.add(bootPercent);
    
    // Scanlines for boot screen (matches camera feed aesthetic)
    const bootScanlines = scene.add.graphics();
    for (let y = -230; y < 230; y += 4) {
      bootScanlines.lineStyle(1, 0x000000, 0.3);
      bootScanlines.lineBetween(-265, y, 265, y);
    }
    el.cameraBootOverlay.add(bootScanlines);
    
    // Boot log messages (scrolling up effect, adjusted for new container position)
    const bootLog1 = scene.add.text(0, 95, '> Connecting to network...', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: FEED.logCss,
    }).setOrigin(0.5);
    const bootLog2 = scene.add.text(0, 115, '> Loading camera feeds...', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: FEED.logCss,
    }).setOrigin(0.5);
    const bootLog3 = scene.add.text(0, 135, '> Calibrating night vision...', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: FEED.logCss,
    }).setOrigin(0.5);
    el.cameraBootOverlay.add([bootLog1, bootLog2, bootLog3]);
    
    el.cameraBootOverlay.setVisible(false);
    el.cameraUI.add(el.cameraBootOverlay);
  }

  /**
   * Create Administrator hack bar and teleporter repair overlay (Custom Night)
   */
function buildAdministratorHackUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {
    // ---- Hack bar: shown at bottom of camera feed when Administrator is targeting/hacking ----
    // Camera panel is centered at 420,350 and is 510×410 — bottom edge is at y≈555.
    // Place bar near the bottom inside the panel: y=510 (45px from bottom edge).
    el.administratorHackBarContainer = scene.add.container(420, 510);
    el.administratorHackBarContainer.setVisible(false);
    el.administratorHackBarContainer.setDepth(104);

    // Semi-transparent backing strip — fully transparent so it doesn't obscure camera feed
    const hackBarBacking = scene.add.rectangle(0, 0, 510, 44, 0x000000, 0);
    el.administratorHackBarContainer.add(hackBarBacking);

    // Slim OSD strip: warning label left, interrupt hint right, thin bar below.
    // Text of both is swapped by GameScene depending on the Administrator's
    // phase (TARGETING = can't interrupt yet, HACKING = click to interrupt).
    el.administratorHackLabel = scene.add.text(-178, -6, '⚠ TELEPORTER HACK', {
      fontFamily: FONTS.terminal,
      fontSize: '14px',
      color: PALETTE.alertCss,
    }).setOrigin(0, 0.5);
    el.administratorHackBarContainer.add(el.administratorHackLabel);

    // Blinking warning — active the whole time the strip is visible
    scene.tweens.add({
      targets: el.administratorHackLabel,
      alpha: { from: 1, to: 0.4 },
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    el.administratorHackHint = scene.add.text(178, -6, 'CLICK TO INTERRUPT', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: PALETTE.amberDimCss,
    }).setOrigin(1, 0.5);
    el.administratorHackBarContainer.add(el.administratorHackHint);

    // Thin progress track
    el.administratorHackBarBorder = scene.add.rectangle(0, 10, 356, 7, 0x140e06);
    el.administratorHackBarBorder.setStrokeStyle(1, PALETTE.amberFaint);
    el.administratorHackBarContainer.add(el.administratorHackBarBorder);

    // Bar fill (scales 0→1 left-to-right)
    el.administratorHackBarFill = scene.add.rectangle(-176, 10, 352, 3, 0x3a2c18, 0.85);
    el.administratorHackBarFill.setOrigin(0, 0.5);
    el.administratorHackBarContainer.add(el.administratorHackBarFill);

    // Clickable hit area over the whole strip
    const hackHitArea = scene.add.rectangle(0, 0, 510, 44, 0x000000, 0);
    hackHitArea.setInteractive({ useHandCursor: true });
    hackHitArea.on('pointerdown', () => {
      hooks.onAdminHackBarClicked();
    });
    el.administratorHackBarContainer.add(hackHitArea);

    el.cameraUI.add(el.administratorHackBarContainer);

    // ---- Repair bar: embedded in the teleport button (see createTeleporterUI / updateTeleportButtonAppearance) ----
    // The repair overlay is no longer a camera overlay — repair is done via the TELEPORT HERE button.
    // administratorRepairOverlay is kept as a stub so existing references don't crash.
    el.administratorRepairOverlay = scene.add.container(0, 0);
    el.administratorRepairOverlay.setVisible(false);
    el.administratorRepairBarFill = scene.add.rectangle(0, 0, 0, 0, 0x000000, 0); // invisible stub
  }

  /**
   * Create teleporter UI for Night 3+
   */
function buildTeleporterUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {
    // Teleport button on camera map (shows when viewing a camera)
    el.teleportButton = scene.add.container(1000, 570);
    
    el.teleportButtonBg = scene.add.rectangle(0, 0, 180, 35, 0x1c0a06);
    el.teleportButtonBg.setStrokeStyle(2, PALETTE.alertDim);
    el.teleportButtonBg.setInteractive({ useHandCursor: true });
    
    el.teleportButtonText = scene.add.text(0, 0, 'TELEPORT HERE', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);

    // Repair progress renders as a translucent amber fill INSIDE the button,
    // behind the text (shown only when the room is hacked; hold to fill).
    el.teleportRepairBarFill = scene.add.rectangle(-88, 0, 176, 31, PALETTE.amber, 0.3);
    el.teleportRepairBarFill.setOrigin(0, 0.5);
    el.teleportRepairBarFill.setScale(0, 1);
    el.teleportRepairBarFill.setVisible(false);

    // Legacy track element — no longer drawn (fill sits inside the button now),
    // kept as an invisible stub so existing show/hide calls stay harmless.
    el.teleportRepairBarBg = scene.add.rectangle(0, 0, 1, 1, 0x000000, 0);
    el.teleportRepairBarBg.setVisible(false);
    
    el.teleportButton.add([
      el.teleportButtonBg,
      el.teleportRepairBarBg,
      el.teleportRepairBarFill,
      el.teleportButtonText,
    ]);
    el.teleportButton.setVisible(false);
    el.cameraUI.add(el.teleportButton);
    
    el.teleportButtonBg.on('pointerover', () => hooks.onTeleportButtonOver());
    el.teleportButtonBg.on('pointerout', () => hooks.onTeleportButtonOut());
    el.teleportButtonBg.on('pointerdown', () => hooks.onTeleportButtonDown());
    el.teleportButtonBg.on('pointerup', () => hooks.onTeleportButtonUp());
    
    // Camera lure button (play or remove lure from camera view)
    el.cameraLureButton = scene.add.container(1000, 520);
    
    const lureBtnBg = scene.add.rectangle(0, 0, 180, 35, PALETTE.panel);
    lureBtnBg.setStrokeStyle(2, PALETTE.amberDim);
    lureBtnBg.setInteractive({ useHandCursor: true });
    
    const lureBtnText = scene.add.text(0, 0, 'PLAY LURE', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    
    el.cameraLureButton.add([lureBtnBg, lureBtnText]);
    el.cameraLureButton.setVisible(false);
    el.cameraUI.add(el.cameraLureButton);
    
    lureBtnBg.on('pointerover', () => hooks.onLureButtonOver());
    lureBtnBg.on('pointerout', () => hooks.onLureButtonOut());
    lureBtnBg.on('pointerdown', () => hooks.onLureButtonDown());
    
    // Room view UI (shown when teleported)
    buildRoomViewUI(scene, hooks, el);
  }

  /**
   * Create room view UI (when engineer teleports to a room) - FULLSCREEN
   */
function buildRoomViewUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {
    el.roomViewUI = scene.add.container(0, 0);
    el.roomViewUI.setVisible(false);
    el.roomViewUI.setDepth(110);
    
    // ===== FULLSCREEN ROOM VIEW =====
    // Floor/wall perspective - fills the entire screen
    const roomGraphics = scene.add.graphics();
    
    // Ceiling
    roomGraphics.fillStyle(0x0f0a05, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 0);
    roomGraphics.lineTo(1280, 0);
    roomGraphics.lineTo(1100, 150);
    roomGraphics.lineTo(180, 150);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Back wall
    roomGraphics.fillStyle(0x191108, 1);
    roomGraphics.fillRect(180, 150, 920, 250);
    
    // Wainscot band + beige trim (matches the intel office)
    roomGraphics.fillStyle(0x4a2114, 1);
    roomGraphics.fillRect(180, 345, 920, 55);
    roomGraphics.lineStyle(2, 0x9a8a68, 0.3);
    roomGraphics.lineBetween(180, 345, 1100, 345);
    
    // Left wall
    roomGraphics.fillStyle(0x120c06, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 0);
    roomGraphics.lineTo(180, 150);
    roomGraphics.lineTo(180, 400);
    roomGraphics.lineTo(0, 720);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Right wall
    roomGraphics.fillStyle(0x120c06, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(1280, 0);
    roomGraphics.lineTo(1100, 150);
    roomGraphics.lineTo(1100, 400);
    roomGraphics.lineTo(1280, 720);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Floor with perspective
    roomGraphics.fillStyle(0x0d0905, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 720);
    roomGraphics.lineTo(1280, 720);
    roomGraphics.lineTo(1100, 400);
    roomGraphics.lineTo(180, 400);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Floor grid lines
    roomGraphics.lineStyle(1, 0x1f1710, 0.4);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const y = 400 + t * 320;
      const leftX = 180 - t * 180;
      const rightX = 1100 + t * 180;
      roomGraphics.lineBetween(leftX, y, rightX, y);
    }
    
    // Wall edges
    roomGraphics.lineStyle(2, 0x33270f, 0.6);
    roomGraphics.lineBetween(180, 150, 0, 720);
    roomGraphics.lineBetween(1100, 150, 1280, 720);
    roomGraphics.lineBetween(180, 150, 1100, 150);
    roomGraphics.lineBetween(180, 400, 1100, 400);
    
    // Dome lamp hanging from the ceiling (off-center, clear of the doorway)
    roomGraphics.lineStyle(3, 0x0d0a06, 1);
    roomGraphics.lineBetween(320, 0, 320, 60);
    roomGraphics.fillStyle(0x15100a, 1);
    roomGraphics.slice(320, 86, 30, Math.PI, Math.PI * 2, false);
    roomGraphics.fillPath();
    roomGraphics.fillStyle(0xffdf9a, 0.8);
    roomGraphics.fillRect(314, 84, 12, 4);
    // Dim pool of light on the floor below the lamp
    roomGraphics.fillStyle(0x40300f, 0.3);
    roomGraphics.fillEllipse(320, 430, 220, 36);
    
    el.roomViewUI.add(roomGraphics);
    
    // Per-room prop layer — redrawn when the player teleports to a room
    el.roomViewProps = scene.add.graphics();
    el.roomViewUI.add(el.roomViewProps);
    
    // Doorway in the back wall (larger, centered)
    el.roomDoorway = scene.add.container(640, 280);
    
    const doorFrame = scene.add.graphics();
    // Solid frame surround, like the intel office doorways
    doorFrame.fillStyle(0x0c0804, 1);
    doorFrame.fillRect(-90, -120, 180, 240);
    // Dark doorway opening
    doorFrame.fillStyle(0x000000, 1);
    doorFrame.fillRect(-80, -110, 160, 220);
    // Frame edge highlight
    doorFrame.lineStyle(2, 0x3a2c1a, 0.8);
    doorFrame.strokeRect(-90, -120, 180, 240);
    // Inner darkness
    doorFrame.fillStyle(0x030308, 0.9);
    doorFrame.fillRect(-70, -100, 140, 200);
    
    el.roomDoorway.add(doorFrame);
    el.roomViewUI.add(el.roomDoorway);
    
    // Red eyes in doorway (shown when enemy approaches)
    el.roomDoorwayEyes = scene.add.container(640, 260);
    el.roomDoorwayEyes.setVisible(false);
    
    const eyesGraphics = scene.add.graphics();
    // Left eye - larger
    eyesGraphics.fillStyle(0xff0000, 0.9);
    eyesGraphics.fillCircle(-20, 0, 10);
    eyesGraphics.fillStyle(0xffaaaa, 1);
    eyesGraphics.fillCircle(-23, -3, 3);
    // Right eye
    eyesGraphics.fillStyle(0xff0000, 0.9);
    eyesGraphics.fillCircle(20, 0, 10);
    eyesGraphics.fillStyle(0xffaaaa, 1);
    eyesGraphics.fillCircle(17, -3, 3);
    
    el.roomDoorwayEyes.add(eyesGraphics);
    el.roomViewUI.add(el.roomDoorwayEyes);
    
    // Room name header - top left
    el.roomViewHeader = scene.add.text(40, 26, 'ROOM: ---', {
      fontFamily: FONTS.terminal,
      fontSize: '30px',
      color: PALETTE.creamCss,
    });
    el.roomViewUI.add(el.roomViewHeader);
    
    // (No subline here: the HUD moves the METAL readout to (40, 60) while
    // teleported, so anything under the header would collide with it.)
    
    // "You are here" indicator
    const hereText = scene.add.text(640, 480, '', {  // Empty - not needed
      fontFamily: FONTS.terminal,
      fontSize: '18px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    el.roomViewUI.add(hereText);
    
    // ===== BOTTOM ACTION BAR =====
    const actionBar = scene.add.rectangle(640, 660, 1200, 100, PALETTE.panel, 0.95);
    actionBar.setStrokeStyle(1, PALETTE.amberFaint);
    el.roomViewUI.add(actionBar);
    
    // Lure button - left side of bar
    el.lureButton = scene.add.container(400, 660);
    const lureBtnBg = scene.add.rectangle(0, 0, 280, 60, 0x1c1409);
    lureBtnBg.setStrokeStyle(2, PALETTE.amberDim);
    lureBtnBg.setInteractive({ useHandCursor: true });
    
    const lureBtnText = scene.add.text(0, 0, 'PLACE LURE (50 METAL)', {
      fontFamily: FONTS.terminal,
      fontSize: '20px',
      color: PALETTE.amberCss,
    }).setOrigin(0.5);
    
    el.lureButton.add([lureBtnBg, lureBtnText]);
    el.roomViewUI.add(el.lureButton);
    
    lureBtnBg.on('pointerover', () => lureBtnBg.setFillStyle(0x2a1f10));
    lureBtnBg.on('pointerout', () => lureBtnBg.setFillStyle(0x1c1409));
    lureBtnBg.on('pointerdown', () => hooks.onToggleLure());
    
    // Return button - right side of bar
    el.returnButton = scene.add.container(880, 660);
    const returnBtnBg = scene.add.rectangle(0, 0, 280, 60, 0x1c0a06);
    returnBtnBg.setStrokeStyle(2, PALETTE.alertDim);
    returnBtnBg.setInteractive({ useHandCursor: true });
    
    const returnBtnText = scene.add.text(0, 0, 'RETURN TO INTEL', {
      fontFamily: FONTS.terminal,
      fontSize: '20px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    
    el.returnButton.add([returnBtnBg, returnBtnText]);
    el.roomViewUI.add(el.returnButton);
    
    returnBtnBg.on('pointerover', () => returnBtnBg.setFillStyle(0x2e100a));
    returnBtnBg.on('pointerout', () => returnBtnBg.setFillStyle(0x1c0a06));
    returnBtnBg.on('pointerdown', () => hooks.onReturnToIntel());
    
    // Tip text (removed - not needed)
    const tipText = scene.add.text(640, 620, '', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: PALETTE.amberFaintCss,
    }).setOrigin(0.5);
    el.roomViewUI.add(tipText);
    
    // Escape warning overlay - positioned below the doorway, centered
    el.escapeWarning = scene.add.container(640, 580);
    el.escapeWarning.setVisible(false);
    el.escapeWarning.setDepth(50);
    
    // Bar background (dark, full width)
    const barBg = scene.add.rectangle(0, 0, 320, 20, 0x220000);
    barBg.setStrokeStyle(2, 0x440000);
    
    // Progress bar that shrinks (starts full, shrinks to 0)
    const progressBar = scene.add.rectangle(-155, 0, 310, 14, 0xff0000);
    progressBar.setOrigin(0, 0.5);
    
    // Inner glow effect
    const innerGlow = scene.add.rectangle(-155, 0, 310, 8, 0xff4444);
    innerGlow.setOrigin(0, 0.5);
    
    el.escapeWarning.add([barBg, progressBar, innerGlow]);
    el.roomViewUI.add(el.escapeWarning);
    
    // Pyro escape warning (Custom Night only) - appears in Intel room when Pyro lights match
    el.pyroEscapeWarning = scene.add.container(640, 100);
    el.pyroEscapeWarning.setVisible(false);
    el.pyroEscapeWarning.setDepth(100);
    
    // Fiery background panel
    const pyroBg = scene.add.rectangle(0, 0, 400, 80, 0x331100, 0.95);
    pyroBg.setStrokeStyle(3, 0xff4400);
    
    // Warning text
    const pyroWarningText = scene.add.text(0, -20, 'PYRO LIT A MATCH!', {
      fontFamily: FONTS.terminal,
      fontSize: '28px',
      color: '#ff6600',
    }).setOrigin(0.5);
    
    // Timer text
    el.pyroEscapeTimer = scene.add.text(0, 15, 'ESCAPE: 10s', {
      fontFamily: FONTS.terminal,
      fontSize: '21px',
      color: '#ffaa00',
    }).setOrigin(0.5);
    
    // Fire icon hint
    const fireHint = scene.add.text(0, 40, 'TELEPORT TO ESCAPE!', {
      fontFamily: FONTS.terminal,
      fontSize: '15px',
      color: '#ff8844',
    }).setOrigin(0.5);
    
    el.pyroEscapeWarning.add([pyroBg, pyroWarningText, el.pyroEscapeTimer, fireHint]);
  }

