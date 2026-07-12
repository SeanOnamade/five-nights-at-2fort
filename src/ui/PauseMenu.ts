import Phaser from 'phaser';
import { PALETTE, headingStyle, osdStyle, terminalStyle } from './kit/theme';
import { addScanlines, addStatic, ensureNoiseTexture } from './kit/effects';
import { playMenuButtonSound, playMenuHoverSound } from '../utils/menuSounds';
import { SettingsOverlay } from './SettingsOverlay';

/** Actions triggered by the pause menu buttons; implemented by GameScene. */
export interface PauseMenuCallbacks {
  onResume(): void;
  onRestart(): void;
  onMainMenu(): void;
  onGiveUp(): void;
  /** Where the Engineer currently is, e.g. "INTEL ROOM" or "CAM 05 — SPIRAL" */
  getLocationLabel(): string;
  /** Whether the flip-view (Q) control is active this night */
  isMerasmusEnabled(): boolean;
  /** Touch device — show button names instead of keyboard keys */
  isMobile(): boolean;
}

/**
 * Pause menu — the security tape on hold. Freeze-frame treatment
 * (scanlines + vertical-hold jitter), OSD "PAUSED" marker, terminal-style
 * text buttons, and a random Engineer's Log hint. Includes Settings.
 */
export class PauseMenu {
  private container!: Phaser.GameObjects.Container;
  private jitterTarget!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private tapeLabel!: Phaser.GameObjects.Text;
  private jitterTimer: Phaser.Time.TimerEvent | null = null;
  private settingsOverlay!: SettingsOverlay;

  // Hints for pause menu
  private readonly hints: string[] = [
    // User-provided hints
    "Demoman can be stalled by watching his head!",
    "Only Scout, Soldier, Pyro, Sniper, and Demoman's body show up in the Wrangler light.",
    "Scout is the fastest of the mercs.",
    "Sniper moves at random!",
    "Spy can disguise as any enemy except Pyro! When disguised, he won't attempt to sap your sentry!",
    "Deterring Demoman's charge at the last second provides bonus metal! Test your luck!",
    "Heavy's footsteps get louder the closer he is to Intel!",
    "Press Space twice to remove a Sapper!",
    "Spy and Demoman's head will not attack you when teleported.",
    "If you don't have the metal to ward off an enemy, unwrangle your Sentry before they attack to save yourself!",
    "Spy switches mode every hour.",
    "You can cancel a teleport by clicking the button again.",
    "When teleporting, if an enemy is in an adjacent room, they will hear you and approach.",
    "Demo will never begin his attack while you're watching him.",
    // Additional hints
    "One sentry attack can affect multiple enemies.",
    "Heavy will destroy your camera if you stare too long. Sniper will headshot you through it!",
    "Lures can distract certain enemies, buying you precious time!",
    "Metal regenerates over time -- manage it wisely!",
    "Sniper requires 2 shots to repel.",
    "When Heavy reaches the intel room, you have very little time to react!",
    "Pyro blocks doorways until you shine the Wrangler light on him!",
    "Pyro reflects sentry shots! Use the Wrangler light to drive him away.",
  ];

  constructor(
    private scene: Phaser.Scene,
    private callbacks: PauseMenuCallbacks,
  ) {}

  /**
   * Create the pause menu UI
   * @param showGiveUp - Adds the Give Up button (endless Night 6 only)
   */
  create(showGiveUp: boolean): void {
    const width = 1280;
    const height = 720;

    ensureNoiseTexture(this.scene);

    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(200);

    // Everything that should wobble with the vertical hold lives in here
    this.jitterTarget = this.scene.add.container(0, 0);
    this.container.add(this.jitterTarget);

    // Freeze-frame: darken + faint static + heavy scanlines
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82);
    overlay.setInteractive(); // block clicks reaching the game underneath
    this.jitterTarget.add(overlay);

    const grain = addStatic(this.scene, width / 2, height / 2, width, height, 0.05);
    this.jitterTarget.add(grain);

    const scan = addScanlines(this.scene, 0, 0, width, height, 0.16, 3);
    this.jitterTarget.add(scan);

    // Dark OSD band across the top so the PAUSED marker doesn't tangle with
    // the HUD readouts showing through the freeze-frame. Lives OUTSIDE the
    // jitter container (added to `container` after it) so the band, its rule,
    // and the labels on it hold steady while the freeze-frame wobbles.
    const osdBand = this.scene.add.rectangle(width / 2, 60, width, 124, 0x000000, 0.72);
    this.container.add(osdBand);
    const osdBandRule = this.scene.add.rectangle(width / 2, 122, width, 1, PALETTE.amberFaint);
    this.container.add(osdBandRule);

    // OSD "PAUSED" marker — top-left, like a VCR
    const pausedLabel = this.scene.add.text(46, 36, '▮▮ PAUSED', headingStyle(38, PALETTE.creamCss));
    this.container.add(pausedLabel);
    this.tapeLabel = this.scene.add.text(48, 84, '', osdStyle(17, PALETTE.amberDimCss));
    this.container.add(this.tapeLabel);

    // Blinking pause bars
    this.scene.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        if (this.container.visible) pausedLabel.setAlpha(pausedLabel.alpha === 1 ? 0.55 : 1);
      },
    });

    // Terminal button list (center-left)
    const menuX = 140;
    let menuY = 280;
    const pitch = 54;

    this.addButton(menuX, menuY, 'RESUME', () => this.callbacks.onResume());
    menuY += pitch;
    this.addButton(menuX, menuY, 'RESTART NIGHT', () => this.callbacks.onRestart());
    menuY += pitch;
    this.addButton(menuX, menuY, 'SETTINGS', () => this.settingsOverlay.show());
    menuY += pitch;
    this.addButton(menuX, menuY, 'MAIN MENU', () => this.callbacks.onMainMenu());
    menuY += pitch;
    if (showGiveUp) {
      this.addButton(menuX, menuY, 'GIVE UP', () => this.callbacks.onGiveUp(), true);
      menuY += pitch;
    }

    // Controls strip along the bottom (above the Engineer's Log) — keeps the
    // center of the screen as negative space. Touch devices get the on-screen
    // button names instead of keyboard keys.
    const mobile = this.callbacks.isMobile();
    const controlPairs: Array<[string, string]> = mobile
      ? [
          ['WRANGLE', 'WRANGLER'],
          ['EDGES', 'AIM'],
          ['FIRE', 'FIRE'],
          ['CAM', 'CAMERAS'],
          ['ACTION', 'BUILD/REPAIR'],
        ]
      : [
          ['F', 'WRANGLER'],
          ['A/D', 'AIM'],
          ['SPACE', 'FIRE'],
          ['TAB', 'CAMERAS'],
          ['R', 'BUILD/REPAIR'],
          ['ESC', 'PAUSE'],
        ];
    if (this.callbacks.isMerasmusEnabled()) {
      controlPairs.splice(5, 0, mobile ? ['FLIP', 'FLIP VIEW'] : ['Q', 'FLIP VIEW']);
    }
    const stripY = 580;
    const keyGap = 10;   // between key and its action
    const pairGap = 34;  // between control groups
    const stripParts: Phaser.GameObjects.Text[] = [];
    let cursorX = 0;
    controlPairs.forEach(([key, action], i) => {
      if (i > 0) {
        const sep = this.scene.add
          .text(cursorX, stripY, '·', terminalStyle(20, PALETTE.amberFaintCss))
          .setOrigin(0, 0.5);
        stripParts.push(sep);
        cursorX += sep.width + pairGap;
      }
      const keyText = this.scene.add
        .text(cursorX, stripY, key, terminalStyle(20, PALETTE.creamCss))
        .setOrigin(0, 0.5);
      stripParts.push(keyText);
      cursorX += keyText.width + keyGap;
      const actionText = this.scene.add
        .text(cursorX, stripY, action, terminalStyle(20, PALETTE.amberDimCss))
        .setOrigin(0, 0.5);
      stripParts.push(actionText);
      cursorX += actionText.width + pairGap;
    });
    // Center the whole strip
    const stripOffset = (width - (cursorX - pairGap)) / 2;
    stripParts.forEach((t) => {
      t.x += stripOffset;
      this.jitterTarget.add(t);
    });

    // Engineer's Log hint (bottom)
    const hintRule = this.scene.add.rectangle(width / 2, 618, width - 160, 1, PALETTE.amberFaint);
    this.jitterTarget.add(hintRule);

    const hintHeader = this.scene.add
      .text(80, 636, "ENGINEER'S LOG", osdStyle(16, PALETTE.amberDimCss))
      .setOrigin(0, 0.5);
    this.jitterTarget.add(hintHeader);

    this.hintText = this.scene.add
      .text(80, 668, '', {
        fontFamily: 'VT323, "Courier New", monospace',
        fontSize: '21px',
        color: PALETTE.amberCss,
        fontStyle: 'italic',
        wordWrap: { width: width - 200 },
      })
      .setOrigin(0, 0.5);
    this.jitterTarget.add(this.hintText);

    // Settings overlay (sits above the pause menu)
    this.settingsOverlay = new SettingsOverlay(this.scene);
    this.settingsOverlay.create();
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, danger = false): void {
    const idle = danger ? PALETTE.alertDimCss : PALETTE.amberDimCss;
    const hot = danger ? PALETTE.alertCss : PALETTE.creamCss;

    const cursor = this.scene.add.text(x - 38, y, '>>', terminalStyle(28, hot)).setOrigin(0, 0.5);
    cursor.setVisible(false);
    this.jitterTarget.add(cursor);

    const t = this.scene.add.text(x, y, label, terminalStyle(28, idle)).setOrigin(0, 0.5);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => {
      playMenuHoverSound();
      t.setColor(hot);
      cursor.setVisible(true);
    });
    t.on('pointerout', () => {
      t.setColor(idle);
      cursor.setVisible(false);
    });
    t.on('pointerdown', () => {
      playMenuButtonSound();
      onClick();
    });
    this.jitterTarget.add(t);
  }

  setVisible(visible: boolean): void {
    this.container?.setVisible(visible);

    if (visible && this.tapeLabel) {
      this.tapeLabel.setText(`SECURITY FEED ON HOLD — ${this.callbacks.getLocationLabel()}`);
    }

    if (visible && !this.jitterTimer) {
      // Vertical-hold wobble while paused
      this.jitterTimer = this.scene.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          this.jitterTarget.y = Math.random() < 0.18 ? Phaser.Math.Between(-2, 2) : 0;
        },
      });
    } else if (!visible && this.jitterTimer) {
      this.jitterTimer.remove();
      this.jitterTimer = null;
      this.jitterTarget.y = 0;
      if (this.settingsOverlay?.isVisible()) {
        this.settingsOverlay.hide();
      }
    }
  }

  /** Pick and display a random gameplay hint (called when pausing). */
  showRandomHint(): void {
    const randomHint = this.hints[Math.floor(Math.random() * this.hints.length)];
    this.hintText.setText(randomHint);
  }
}
