import Phaser from 'phaser';
import { GameStatus, SentryState, GAME_CONSTANTS } from '../types';

/**
 * Narrow view of game state/actions the mobile touch controls need.
 * Implemented by GameScene.
 */
export interface MobileControlsHost {
  getGameStatus(): GameStatus;
  isPausedNow(): boolean;
  isCameraModeNow(): boolean;
  isTeleportedNow(): boolean;
  getSentry(): SentryState;
  getMetal(): number;
  isSpySapping(): boolean;
  isMerasmusEnabled(): boolean;
  isMerasmusViewFlipped(): boolean;
  setAimLeftActive(active: boolean): void;
  setAimRightActive(active: boolean): void;
  fireWrangler(): void;
  togglePause(): void;
  toggleCameraMode(): void;
  toggleMerasmusFlip(): void;
  handleMobileAction(): void;
  onWranglerPressed(): void;
}

/**
 * Mobile touch controls: edge aim zones plus CAM/WRANGLE/ACTION/FIRE/PAUSE/FLIP buttons.
 * Only instantiated on mobile devices. Extracted from GameScene.
 */
export class MobileControls {
  private mobileUI!: Phaser.GameObjects.Container;
  private mobileCameraButton!: Phaser.GameObjects.Container;
  private mobileWranglerButton!: Phaser.GameObjects.Container;
  private mobileActionButton!: Phaser.GameObjects.Container;
  private mobileActionText!: Phaser.GameObjects.Text;
  private mobileActionCostText!: Phaser.GameObjects.Text;
  private mobileFireButton!: Phaser.GameObjects.Container;
  private mobilePauseButton!: Phaser.GameObjects.Container;
  private mobileMerasmusFlipButton!: Phaser.GameObjects.Container;
  private mobileLeftZone!: Phaser.GameObjects.Rectangle;
  private mobileRightZone!: Phaser.GameObjects.Rectangle;
  private mobileLeftHint!: Phaser.GameObjects.Graphics;
  private mobileRightHint!: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private host: MobileControlsHost,
  ) {}

  /**
   * Create mobile touch controls (only called on mobile devices)
   */
  create(): void {
    const width = 1280;
    const height = 720;
    
    // Main container for all mobile UI
    this.mobileUI = this.scene.add.container(0, 0);
    this.mobileUI.setDepth(150); // Above game, below pause menu
    
    // ===== LEFT TOUCH ZONE (A key equivalent) =====
    this.mobileLeftZone = this.scene.add.rectangle(0, height / 2, 180, height, 0x000000, 0);
    this.mobileLeftZone.setOrigin(0, 0.5);
    this.mobileLeftZone.setInteractive();
    
    // Left visual hint (subtle edge glow)
    this.mobileLeftHint = this.scene.add.graphics();
    this.mobileLeftHint.fillStyle(0x4488ff, 0.15);
    this.mobileLeftHint.fillRect(0, 50, 15, height - 100);
    this.mobileLeftHint.setVisible(true);
    this.mobileUI.add(this.mobileLeftHint);
    
    // Left zone touch handlers
    const resetLeftZone = () => {
      this.host.setAimLeftActive(false);
      this.mobileLeftHint.clear();
      this.mobileLeftHint.fillStyle(0x4488ff, 0.15);
      this.mobileLeftHint.fillRect(0, 50, 15, height - 100);
    };
    this.mobileLeftZone.on('pointerdown', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow() || this.host.isCameraModeNow() || this.host.isTeleportedNow()) return;
      this.host.setAimLeftActive(true);
      this.mobileLeftHint.clear();
      this.mobileLeftHint.fillStyle(0x4488ff, 0.4);
      this.mobileLeftHint.fillRect(0, 50, 30, height - 100);
    });
    this.mobileLeftZone.on('pointerup', resetLeftZone);
    this.mobileLeftZone.on('pointerout', resetLeftZone);
    this.mobileLeftZone.on('pointercancel', resetLeftZone);
    
    // ===== RIGHT TOUCH ZONE (D key equivalent) =====
    this.mobileRightZone = this.scene.add.rectangle(width, height / 2, 180, height, 0x000000, 0);
    this.mobileRightZone.setOrigin(1, 0.5);
    this.mobileRightZone.setInteractive();
    
    // Right visual hint
    this.mobileRightHint = this.scene.add.graphics();
    this.mobileRightHint.fillStyle(0x4488ff, 0.15);
    this.mobileRightHint.fillRect(width - 15, 50, 15, height - 100);
    this.mobileRightHint.setVisible(true);
    this.mobileUI.add(this.mobileRightHint);
    
    // Right zone touch handlers
    const resetRightZone = () => {
      this.host.setAimRightActive(false);
      this.mobileRightHint.clear();
      this.mobileRightHint.fillStyle(0x4488ff, 0.15);
      this.mobileRightHint.fillRect(width - 15, 50, 15, height - 100);
    };
    this.mobileRightZone.on('pointerdown', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow() || this.host.isCameraModeNow() || this.host.isTeleportedNow()) return;
      this.host.setAimRightActive(true);
      this.mobileRightHint.clear();
      this.mobileRightHint.fillStyle(0x4488ff, 0.4);
      this.mobileRightHint.fillRect(width - 30, 50, 30, height - 100);
    });
    this.mobileRightZone.on('pointerup', resetRightZone);
    this.mobileRightZone.on('pointerout', resetRightZone);
    this.mobileRightZone.on('pointercancel', resetRightZone);
    
    // ===== FIRE BUTTON (appears near sentry when wrangled + aimed) =====
    this.mobileFireButton = this.scene.add.container(width / 2, height - 320);
    const fireBg = this.scene.add.rectangle(0, 0, 100, 50, 0x442222);
    fireBg.setStrokeStyle(3, 0xff4444);
    fireBg.setInteractive({ useHandCursor: true });
    const fireText = this.scene.add.text(0, 0, 'FIRE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    fireBg.on('pointerdown', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow() || this.host.isCameraModeNow()) return;
      const sentry = this.host.getSentry();
      if (!sentry.exists || !sentry.isWrangled) return;
      if (sentry.aimedDoor === 'NONE') return;
      this.host.fireWrangler();
    });
    fireBg.on('pointerover', () => fireBg.setFillStyle(0x663333));
    fireBg.on('pointerout', () => fireBg.setFillStyle(0x442222));
    this.mobileFireButton.add([fireBg, fireText]);
    this.mobileFireButton.setVisible(false);
    this.mobileUI.add(this.mobileFireButton);
    
    // ===== PAUSE BUTTON (top right corner) =====
    this.mobilePauseButton = this.scene.add.container(width - 50, 50);
    const pauseBg = this.scene.add.rectangle(0, 0, 80, 40, 0x1a2a3a, 0.9);
    pauseBg.setStrokeStyle(2, 0x3a5a7a);
    pauseBg.setInteractive({ useHandCursor: true });
    // Pause icon: two vertical bars using graphics
    const pauseIconGfx = this.scene.add.graphics();
    pauseIconGfx.fillStyle(0x7799bb, 1);
    pauseIconGfx.fillRect(-12, -10, 8, 20); // Left bar
    pauseIconGfx.fillRect(4, -10, 8, 20);   // Right bar
    pauseBg.on('pointerdown', () => {
      if (this.host.getGameStatus() !== 'PLAYING') return;
      this.host.togglePause();
    });
    pauseBg.on('pointerover', () => {
      pauseBg.setFillStyle(0x2a3a4a);
      pauseBg.setStrokeStyle(2, 0x5a8aba);
    });
    pauseBg.on('pointerout', () => {
      pauseBg.setFillStyle(0x1a2a3a, 0.9);
      pauseBg.setStrokeStyle(2, 0x3a5a7a);
    });
    this.mobilePauseButton.add([pauseBg, pauseIconGfx]);
    this.mobileUI.add(this.mobilePauseButton);
    
    // ===== CAMERA BUTTON (to the left of pause, with spacing) =====
    this.mobileCameraButton = this.createMobileButton(width - 145, 50, 'CAM', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow()) return;
      if (this.host.isTeleportedNow()) return; // Can't use cameras when teleported
      this.host.toggleCameraMode();
    });
    this.mobileUI.add(this.mobileCameraButton);
    
    // ===== WRANGLER BUTTON (below pause/cam row) =====
    this.mobileWranglerButton = this.createMobileButton(width - 50, 100, 'WRANGLE', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow()) return;
      if (this.host.isCameraModeNow()) return;
      if (!this.host.getSentry().exists) return;
      
      this.host.onWranglerPressed();
    });
    this.mobileUI.add(this.mobileWranglerButton);
    
    // ===== ACTION BUTTON (to the left of CAM button, visible in camera mode too) =====
    // Spacing: Pause width-50, CAM width-145, ACTION width-240, FLIP width-335 (95px apart)
    this.mobileActionButton = this.scene.add.container(width - 240, 50);
    
    const actionBg = this.scene.add.rectangle(0, 0, 80, 40, 0x224422);
    actionBg.setStrokeStyle(2, 0x44aa44);
    actionBg.setInteractive({ useHandCursor: true });
    
    // Two-line text: action on top, cost below
    this.mobileActionText = this.scene.add.text(0, -6, 'BUILD', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#88ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.mobileActionCostText = this.scene.add.text(0, 8, '(100)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      color: '#88ff88',
    }).setOrigin(0.5);
    
    actionBg.on('pointerdown', () => {
      if (this.host.getGameStatus() !== 'PLAYING' || this.host.isPausedNow()) return;
      if (this.host.isTeleportedNow()) return; // Can't build/repair/upgrade when teleported
      this.host.handleMobileAction();
    });
    
    actionBg.on('pointerover', () => actionBg.setFillStyle(0x336633));
    actionBg.on('pointerout', () => actionBg.setFillStyle(0x224422));
    
    this.mobileActionButton.add([actionBg, this.mobileActionText, this.mobileActionCostText]);
    this.mobileUI.add(this.mobileActionButton);

    // ===== MERASMUS FLIP BUTTON (left of ACTION, Custom Night only) =====
    this.mobileMerasmusFlipButton = this.createMobileButton(width - 335, 50, 'FLIP', () => {
      this.host.toggleMerasmusFlip();
    });
    this.mobileMerasmusFlipButton.setVisible(this.host.isMerasmusEnabled());
    this.mobileUI.add(this.mobileMerasmusFlipButton);
    
    // Initial update
    this.updateUI();
  }
  
  /**
   * Create a styled mobile button (text only, no emojis)
   */
  private createMobileButton(
    x: number, 
    y: number, 
    label: string, 
    callback: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    const bg = this.scene.add.rectangle(0, 0, 80, 40, 0x1a2a3a, 0.9);
    bg.setStrokeStyle(2, 0x3a5a7a);
    bg.setInteractive({ useHandCursor: true });
    
    const labelText = this.scene.add.text(0, 0, label, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#7799bb',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    bg.on('pointerdown', callback);
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a3a4a);
      bg.setStrokeStyle(2, 0x5a8aba);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a2a3a, 0.9);
      bg.setStrokeStyle(2, 0x3a5a7a);
    });
    
    container.add([bg, labelText]);
    return container;
  }
  
  /**
   * Update mobile UI state
   */
  updateUI(): void {
    if (!this.mobileUI) return;
    
    // Update button states
    this.updateWranglerButton();
    this.updateActionButton();
    this.updateCameraButton();
    this.updateFireButton();
    
    // Show/hide zones based on mode
    const inIntelRoom = !this.host.isCameraModeNow() && !this.host.isTeleportedNow();
    this.mobileLeftHint.setVisible(inIntelRoom);
    this.mobileRightHint.setVisible(inIntelRoom);
    
    // Wrangler button: only in intel room with sentry
    this.mobileWranglerButton.setVisible(inIntelRoom && this.host.getSentry().exists);
    
    // Action button: visible except when teleported (stays visible in camera mode)
    this.mobileActionButton.setVisible(!this.host.isTeleportedNow());
    
    // Camera button: available except when teleported
    this.mobileCameraButton.setVisible(!this.host.isTeleportedNow());
    
    // Pause button: always visible
    this.mobilePauseButton.setVisible(true);

    // Merasmus flip: Custom Night only, not when teleported
    if (this.mobileMerasmusFlipButton) {
      this.mobileMerasmusFlipButton.setVisible(this.host.isMerasmusEnabled() && !this.host.isTeleportedNow());
      this.updateMerasmusFlipButton();
    }
  }

  /**
   * Update Merasmus flip button appearance when view is mirrored
   */
  updateMerasmusFlipButton(): void {
    if (!this.mobileMerasmusFlipButton) return;
    // During scene shutdown/restart this runs via cleanup() -> resetMerasmusState()
    // after Phaser has destroyed the container (its list is emptied). Touching the
    // dead children threw and aborted the scene transition - frozen game on mobile.
    if (!this.mobileMerasmusFlipButton.active) return;

    const bg = this.mobileMerasmusFlipButton.list[0] as Phaser.GameObjects.Rectangle | undefined;
    const label = this.mobileMerasmusFlipButton.list[1] as Phaser.GameObjects.Text | undefined;
    if (!bg || !label) return;

    if (this.host.isMerasmusViewFlipped()) {
      bg.setFillStyle(0x2a4a2a);
      bg.setStrokeStyle(2, 0x44ff44);
      label.setColor('#44ff44');
      label.setText('FLIPPED');
    } else {
      bg.setFillStyle(0x1a2a3a, 0.9);
      bg.setStrokeStyle(2, 0x3a5a7a);
      label.setColor('#7799bb');
      label.setText('FLIP');
    }
  }
  
  /**
   * Update fire button visibility (shows when wrangled + aimed at door)
   */
  updateFireButton(): void {
    if (!this.mobileFireButton) return;
    
    const sentry = this.host.getSentry();
    const inIntelRoom = !this.host.isCameraModeNow() && !this.host.isTeleportedNow();
    const canFire = inIntelRoom && 
                    sentry.exists && 
                    sentry.isWrangled && 
                    sentry.aimedDoor !== 'NONE';
    
    this.mobileFireButton.setVisible(canFire);
  }
  
  /**
   * Update wrangler button appearance based on state
   */
  updateWranglerButton(): void {
    if (!this.mobileWranglerButton) return;
    
    const bg = this.mobileWranglerButton.list[0] as Phaser.GameObjects.Rectangle;
    const label = this.mobileWranglerButton.list[1] as Phaser.GameObjects.Text;
    
    if (this.host.getSentry().isWrangled) {
      bg.setFillStyle(0x2a4a2a);
      bg.setStrokeStyle(2, 0x44ff44);
      label.setText('WRANGLED');
      label.setColor('#44ff44');
    } else {
      bg.setFillStyle(0x1a2a3a, 0.9);
      bg.setStrokeStyle(2, 0x3a5a7a);
      label.setText('WRANGLE');
      label.setColor('#7799bb');
    }
  }
  
  /**
   * Update action button text based on current state (two-line format)
   */
  updateActionButton(): void {
    if (!this.mobileActionText) return;
    
    const bg = this.mobileActionButton.list[0] as Phaser.GameObjects.Rectangle;
    
    // Check for sapper - single line, no cost
    if (this.host.isSpySapping()) {
      this.mobileActionText.setText('REMOVE');
      this.mobileActionText.setY(0); // Center vertically
      this.mobileActionCostText.setText('SAP');
      this.mobileActionText.setColor('#ff8888');
      this.mobileActionCostText.setColor('#ff8888');
      bg.setFillStyle(0x442222);
      bg.setStrokeStyle(2, 0xaa4444);
      this.mobileActionButton.setVisible(true);
      return;
    }
    
    // Reset Y positions for two-line format
    this.mobileActionText.setY(-6);
    
    const sentry = this.host.getSentry();
    const metal = this.host.getMetal();
    
    // Normal sentry actions
    if (!sentry.exists) {
      const canBuild = metal >= GAME_CONSTANTS.BUILD_SENTRY_COST;
      this.mobileActionText.setText('BUILD');
      this.mobileActionCostText.setText(`(${GAME_CONSTANTS.BUILD_SENTRY_COST})`);
      const color = canBuild ? '#88ff88' : '#888888';
      this.mobileActionText.setColor(color);
      this.mobileActionCostText.setColor(color);
      bg.setFillStyle(canBuild ? 0x224422 : 0x222222);
      bg.setStrokeStyle(2, canBuild ? 0x44aa44 : 0x444444);
    } else if (sentry.hp < sentry.maxHp) {
      const repairCost = Math.ceil(Math.min(sentry.maxHp - sentry.hp, GAME_CONSTANTS.REPAIR_SENTRY_AMOUNT));
      const canRepair = metal >= repairCost;
      this.mobileActionText.setText('REPAIR');
      this.mobileActionCostText.setText(`(${repairCost})`);
      const color = canRepair ? '#ffaa44' : '#888888';
      this.mobileActionText.setColor(color);
      this.mobileActionCostText.setColor(color);
      bg.setFillStyle(canRepair ? 0x442a22 : 0x222222);
      bg.setStrokeStyle(2, canRepair ? 0xaa6644 : 0x444444);
    } else if (sentry.level < 3) {
      const canUpgrade = metal >= GAME_CONSTANTS.UPGRADE_SENTRY_COST;
      this.mobileActionText.setText('UPGRADE');
      this.mobileActionCostText.setText(`(${GAME_CONSTANTS.UPGRADE_SENTRY_COST})`);
      const color = canUpgrade ? '#88aaff' : '#888888';
      this.mobileActionText.setColor(color);
      this.mobileActionCostText.setColor(color);
      bg.setFillStyle(canUpgrade ? 0x222244 : 0x222222);
      bg.setStrokeStyle(2, canUpgrade ? 0x4466aa : 0x444444);
    } else {
      // Max level, no action needed - single line
      this.mobileActionText.setText('MAX');
      this.mobileActionText.setY(0);
      this.mobileActionCostText.setText('');
      this.mobileActionText.setColor('#44aa44');
      bg.setFillStyle(0x223322);
      bg.setStrokeStyle(2, 0x336633);
    }
  }
  
  /**
   * Update camera button based on camera mode
   */
  updateCameraButton(): void {
    if (!this.mobileCameraButton) return;
    
    const bg = this.mobileCameraButton.list[0] as Phaser.GameObjects.Rectangle;
    const label = this.mobileCameraButton.list[1] as Phaser.GameObjects.Text;
    
    if (this.host.isCameraModeNow()) {
      label.setText('CLOSE');
      bg.setFillStyle(0x4a2a2a);
      bg.setStrokeStyle(2, 0xaa5555);
      label.setColor('#ff8888');
    } else {
      label.setText('CAM');
      bg.setFillStyle(0x1a2a3a, 0.9);
      bg.setStrokeStyle(2, 0x3a5a7a);
      label.setColor('#7799bb');
    }
  }
}
