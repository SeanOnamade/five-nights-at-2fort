import Phaser from 'phaser';
import { SentryState, GAME_CONSTANTS } from '../types';

/** Scene state the HUD displays; implemented by GameScene. */
export interface HUDHost {
  getGameMinutes(): number;
  getMetal(): number;
  getSentry(): SentryState;
  isCameraModeNow(): boolean;
  isBadEndingNight6Now(): boolean;
  hasReached6AMNow(): boolean;
  getEndlessDay(): number;
  isMerasmusEnabled(): boolean;
}

/**
 * Main HUD: time/metal/sentry/wrangler readouts, alert banner, and the lure
 * duration bar. Extracted from GameScene.
 */
export class HUD {
  timeText!: Phaser.GameObjects.Text;
  metalText!: Phaser.GameObjects.Text;
  lureBarContainer!: Phaser.GameObjects.Container;
  lureBarFill!: Phaser.GameObjects.Rectangle;
  lureBarText!: Phaser.GameObjects.Text;
  private sentryText!: Phaser.GameObjects.Text;
  private wranglerText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private alertContainer!: Phaser.GameObjects.Container;
  private alertBg!: Phaser.GameObjects.Rectangle;
  private alertText!: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    private host: HUDHost,
  ) {}

  create(): void {
    const padding = 20;
    
    // Time display (top center) - RED team color
    this.timeText = this.scene.add.text(640, padding, '00:00', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    
    // Metal display (top left) - always visible on top
    this.metalText = this.scene.add.text(padding, padding, 'METAL: 0/200', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#aabbcc',
    });
    this.metalText.setDepth(200); // Always on top, even in camera/teleport views
    
    // Sentry status (top left, below metal)
    this.sentryText = this.scene.add.text(padding, padding + 35, 'SENTRY: L3 | HP: 216/216', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#88ff88',
    });
    
    // Wrangler status (top left, below sentry)
    this.wranglerText = this.scene.add.text(padding, padding + 60, 'WRANGLER: OFF | AIM: LEFT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff8888',
    });
    
    // Controls hint (bottom)
    const controlsLine = this.host.isMerasmusEnabled()
      ? 'F: Wrangler | A/D: Aim | SPACE: Fire | TAB: Cameras | R: Build/Repair | Q: Flip View'
      : 'F: Wrangler | HOLD A/D: Aim Left/Right | SPACE: Fire | TAB: Cameras | R: Build/Repair/Upgrade';
    this.controlsText = this.scene.add.text(640, 700, controlsLine, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5, 1);
    
    // Alert container (center, for warnings) - with background for visibility
    this.alertContainer = this.scene.add.container(640, 120);
    this.alertContainer.setDepth(200); // Above everything including room view UI
    this.alertContainer.setVisible(false);
    
    // Dark background with colored border
    this.alertBg = this.scene.add.rectangle(0, 0, 500, 50, 0x000000, 0.85);
    this.alertBg.setStrokeStyle(3, 0xff0000);
    this.alertContainer.add(this.alertBg);
    
    // Alert text
    this.alertText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.alertContainer.add(this.alertText);
    
    // Lure duration bar (to the right of metal count, top left area)
    this.lureBarContainer = this.scene.add.container(280, 32);
    this.lureBarContainer.setDepth(200); // Same depth as HUD
    
    const lureBarBg = this.scene.add.rectangle(0, 0, 120, 24, 0x222222, 0.9);
    lureBarBg.setStrokeStyle(2, 0xffaa00);
    
    this.lureBarFill = this.scene.add.rectangle(-60 + 1, 0, 118, 20, 0xff8800);
    this.lureBarFill.setOrigin(0, 0.5);
    
    this.lureBarText = this.scene.add.text(0, 0, 'LURE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.lureBarContainer.add([lureBarBg, this.lureBarFill, this.lureBarText]);
    this.lureBarContainer.setVisible(false);
  }

  /** Flash an alert banner in the center of the screen, fading out after a moment. */
  showAlert(message: string, color: number): void {
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    
    // Update text and colors
    this.alertText.setText(message);
    this.alertText.setColor(colorHex);
    this.alertBg.setStrokeStyle(3, color);
    
    // Resize background to fit text
    const textWidth = this.alertText.width + 40;
    this.alertBg.setSize(Math.max(300, textWidth), 50);
    
    // Show and reset alpha
    this.alertContainer.setVisible(true);
    this.alertContainer.setAlpha(1);
    
    // Fade out
    this.scene.tweens.add({
      targets: this.alertContainer,
      alpha: 0,
      duration: 2500,
      delay: 500, // Stay visible for 0.5s before fading
      onComplete: () => {
        this.alertContainer.setVisible(false);
      },
    });
  }

  /** Refresh the time/metal/sentry/wrangler readouts from game state. */
  update(): void {
    // Time (12-hour format: 12:00 AM to 5:59 AM)
    // Only show hour (not minutes) to prevent predicting Scout/Soldier arrival
    const hours24 = Math.floor(this.host.getGameMinutes() / 60);
    const displayHours = hours24 === 0 ? 12 : hours24;  // 00:XX becomes 12:XX
    
    // For endless Night 6, show day tracking after first 6 AM
    if (this.host.isBadEndingNight6Now() && this.host.hasReached6AMNow()) {
      this.timeText.setText(`DAY ${this.host.getEndlessDay()} - ${displayHours} AM`);
    } else {
      this.timeText.setText(`${displayHours} AM`); // No padding - "1 AM" not "01 AM"
    }
    
    // Metal
    this.metalText.setText(`METAL: ${Math.floor(this.host.getMetal())}/${GAME_CONSTANTS.MAX_METAL}`);
    
    // Sentry
    const sentry = this.host.getSentry();
    if (sentry.exists) {
      this.sentryText.setText(`SENTRY: L${sentry.level} | HP: ${Math.floor(sentry.hp)}/${sentry.maxHp}`);
      this.sentryText.setColor('#88ff88');
    } else {
      this.sentryText.setText('SENTRY: DESTROYED (R to rebuild)');
      this.sentryText.setColor('#ff4444');
    }
    
    // Wrangler
    if (this.host.isCameraModeNow()) {
      this.wranglerText.setText('WRANGLER: DISABLED (Camera Mode)');
      this.wranglerText.setColor('#888888');
    } else if (!sentry.exists) {
      this.wranglerText.setText('WRANGLER: N/A');
      this.wranglerText.setColor('#888888');
    } else if (!sentry.isWrangled) {
      this.wranglerText.setText('WRANGLER: OFF (Auto-defense mode)');
      this.wranglerText.setColor('#ff8888');
    } else {
      // Wrangler is ON
      const aimText = sentry.aimedDoor === 'NONE' ? 'MIDDLE (hold A/D)' : sentry.aimedDoor;
      const aimColor = sentry.aimedDoor === 'NONE' ? '#ffff88' : '#88ff88';
      this.wranglerText.setText(`WRANGLER: ON | AIM: ${aimText}`);
      this.wranglerText.setColor(aimColor);
    }
  }
}
