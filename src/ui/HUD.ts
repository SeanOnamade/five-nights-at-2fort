import Phaser from 'phaser';
import { SentryState, GAME_CONSTANTS } from '../types';
import { PALETTE, FONTS } from './kit/theme';

/**
 * Semantic alert levels — every in-game alert is one of these four.
 * success: something went the player's way (repelled, built, escaped)
 * info:    neutral feedback (lure placed, shot fired)
 * warning: rejected action or caution (not enough metal, cooling down)
 * danger:  active threat or loss (sentry destroyed, sapping, hack, breach)
 */
export type AlertLevel = 'success' | 'info' | 'warning' | 'danger';

const ALERT_COLORS: Record<AlertLevel, number> = {
  success: 0x66ff66,        // feed green — reads instantly as "good"
  info: PALETTE.cream,      // neutral terminal cream
  warning: 0xffaa00,        // warm orange, distinct from body amber
  danger: PALETTE.alert,    // the one true red
};

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
  private alertContainer!: Phaser.GameObjects.Container;
  private alertBg!: Phaser.GameObjects.Rectangle;
  private alertText!: Phaser.GameObjects.Text;
  private alertTimerBar!: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    private host: HUDHost,
  ) {}

  create(): void {
    const padding = 20;
    
    // Time display (top center) — cream terminal clock
    this.timeText = this.scene.add.text(640, padding, '00:00', {
      fontFamily: FONTS.terminal,
      fontSize: '52px',
      color: PALETTE.creamCss,
    }).setOrigin(0.5, 0);
    
    // Metal display (top left) - always visible on top
    this.metalText = this.scene.add.text(padding, padding, 'METAL: 0/200', {
      fontFamily: FONTS.terminal,
      fontSize: '26px',
      color: PALETTE.amberCss,
    });
    this.metalText.setDepth(200); // Always on top, even in camera/teleport views
    
    // Sentry status (top left, below metal)
    this.sentryText = this.scene.add.text(padding, padding + 35, 'SENTRY: L3 | HP: 216/216', {
      fontFamily: FONTS.terminal,
      fontSize: '21px',
      color: PALETTE.amberCss,
    });
    
    // Wrangler status (top left, below sentry)
    this.wranglerText = this.scene.add.text(padding, padding + 60, 'WRANGLER: OFF | AIM: LEFT', {
      fontFamily: FONTS.terminal,
      fontSize: '21px',
      color: PALETTE.amberDimCss,
    });
    
    // Alert container (center, for warnings) - with background for visibility
    this.alertContainer = this.scene.add.container(640, 120);
    this.alertContainer.setDepth(200); // Above everything including room view UI
    this.alertContainer.setVisible(false);
    
    // Terminal panel with the alert's accent color as a thin border
    this.alertBg = this.scene.add.rectangle(0, 0, 500, 50, PALETTE.panel, 0.92);
    this.alertBg.setStrokeStyle(2, PALETTE.alert);
    this.alertContainer.add(this.alertBg);
    
    // Alert text
    this.alertText = this.scene.add.text(0, 0, '', {
      fontFamily: FONTS.terminal,
      fontSize: '26px',
      color: PALETTE.alertCss,
    }).setOrigin(0.5);
    this.alertContainer.add(this.alertText);
    
    // Thin countdown line along the banner's bottom edge — shrinks to nothing
    // over the alert's lifetime, then the banner disappears (no alpha fade)
    this.alertTimerBar = this.scene.add.rectangle(0, 21, 500, 3, PALETTE.alert, 0.95);
    this.alertTimerBar.setOrigin(0, 0.5);
    this.alertContainer.add(this.alertTimerBar);
    
    // Lure duration bar (to the right of metal count, top left area)
    this.lureBarContainer = this.scene.add.container(280, 32);
    this.lureBarContainer.setDepth(200); // Same depth as HUD
    
    const lureBarBg = this.scene.add.rectangle(0, 0, 120, 24, PALETTE.panel, 0.9);
    lureBarBg.setStrokeStyle(1, PALETTE.amberDim);
    
    this.lureBarFill = this.scene.add.rectangle(-60 + 1, 0, 118, 20, 0xff8800);
    this.lureBarFill.setOrigin(0, 0.5);
    
    this.lureBarText = this.scene.add.text(0, 0, 'LURE', {
      fontFamily: FONTS.terminal,
      fontSize: '13px',
      color: PALETTE.creamCss,
    }).setOrigin(0.5);
    
    this.lureBarContainer.add([lureBarBg, this.lureBarFill, this.lureBarText]);
    this.lureBarContainer.setVisible(false);
  }

  /** Flash an alert banner in the center of the screen, fading out after a moment. */
  showAlert(message: string, level: AlertLevel = 'warning'): void {
    const color = ALERT_COLORS[level];
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    
    // Kill the previous alert's countdown + fade tweens so they can't hide
    // this one (a stale fade tween would keep driving alpha toward 0)
    this.scene.tweens.killTweensOf(this.alertTimerBar);
    this.scene.tweens.killTweensOf(this.alertContainer);
    
    // Update text and colors
    this.alertText.setText(message);
    this.alertText.setColor(colorHex);
    this.alertBg.setStrokeStyle(3, color);
    
    // Resize background to fit text
    const bgWidth = Math.max(300, this.alertText.width + 40);
    this.alertBg.setSize(bgWidth, 50);
    
    // Countdown line hugs the banner's bottom edge, matching its width/color
    this.alertTimerBar.setFillStyle(color, 0.95);
    this.alertTimerBar.setSize(bgWidth - 6, 3);
    this.alertTimerBar.setPosition(-(bgWidth - 6) / 2, 21);
    this.alertTimerBar.setScale(1, 1);
    
    // Show at full opacity — no fading; the shrinking line is the timer
    this.alertContainer.setVisible(true);
    this.alertContainer.setAlpha(1);
    
    this.scene.tweens.add({
      targets: this.alertTimerBar,
      scaleX: 0,
      duration: 3000,
      ease: 'Linear',
      onComplete: () => {
        // Countdown done — quick fade rather than an abrupt pop-off
        this.scene.tweens.add({
          targets: this.alertContainer,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            this.alertContainer.setVisible(false);
          },
        });
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
      // Amber when healthy, alert red when badly damaged
      this.sentryText.setColor(sentry.hp / sentry.maxHp < 0.3 ? PALETTE.alertCss : PALETTE.amberCss);
    } else {
      this.sentryText.setText('SENTRY: DESTROYED (R to rebuild)');
      this.sentryText.setColor(PALETTE.alertCss);
    }
    
    // Wrangler
    if (this.host.isCameraModeNow()) {
      this.wranglerText.setText('WRANGLER: DISABLED (Camera Mode)');
      this.wranglerText.setColor(PALETTE.amberFaintCss);
    } else if (!sentry.exists) {
      this.wranglerText.setText('WRANGLER: N/A');
      this.wranglerText.setColor(PALETTE.amberFaintCss);
    } else if (!sentry.isWrangled) {
      this.wranglerText.setText('WRANGLER: OFF (Auto-defense mode)');
      this.wranglerText.setColor(PALETTE.amberDimCss);
    } else {
      // Wrangler is ON
      const aimText = sentry.aimedDoor === 'NONE' ? 'MIDDLE (hold A/D)' : sentry.aimedDoor;
      const aimColor = sentry.aimedDoor === 'NONE' ? PALETTE.amberCss : PALETTE.creamCss;
      this.wranglerText.setText(`WRANGLER: ON | AIM: ${aimText}`);
      this.wranglerText.setColor(aimColor);
    }
  }
}
