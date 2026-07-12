import Phaser from 'phaser';
import {
  SaveData,
  loadSave,
  createNewSave,
  deleteSave,
  hasSave,
  unlockEverything,
  calculateTotalDestructions,
} from '../utils/saveData';
import { loadCustomNightEnemies } from '../data/customNightStorage';
import { playGameStartChime, playMenuButtonSound } from '../utils/menuSounds';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import { PALETTE, titleStyle, headingStyle, osdStyle } from '../ui/kit/theme';
import { addScanlines, addStatic, addVignette, ensureNoiseTexture, glitchBurst } from '../ui/kit/effects';
import { createTerminalMenu, TerminalMenu, TerminalMenuItem } from '../ui/kit/widgets';
import { getMusicVolume, getSettings, onSettingsChange } from '../utils/settings';
import { SettingsOverlay } from '../ui/SettingsOverlay';
import { TutorialOverlay } from './boot/TutorialOverlay';
import { GalleryOverlay } from './boot/GalleryOverlay';
import { EndingsOverlay } from './boot/EndingsOverlay';
import { StatsOverlay } from './boot/StatsOverlay';
import { ExtrasOverlay, ExtrasEntry } from './boot/ExtrasOverlay';

/** Mercs that can lurk on the right side of the terminal */
const PORTRAIT_POOL = ['SCOUT', 'SOLDIER', 'DEMOMAN', 'HEAVY', 'SNIPER', 'PYRO', 'ADMINISTRATOR', 'MERASMUS'];

const MENU_MUSIC_BASE_VOLUME = 0.18;

/**
 * BootScene — Main Menu, styled as the Engineer's security terminal.
 *
 * Menu states:
 * 1. No save: NEW GAME only
 * 2. Save exists, incomplete: CONTINUE + NEW GAME
 * 3. Night 5 beaten: night select + Custom Night + Nightmare Mode
 */
export class BootScene extends Phaser.Scene {
  private selectedNight = 1;
  private saveData: SaveData | null = null;
  private started = false;

  private menu: TerminalMenu | null = null;
  private nightInfoText: Phaser.GameObjects.Text | null = null;

  // Overlays
  private tutorialOverlay!: TutorialOverlay;
  private galleryOverlay!: GalleryOverlay;
  private endingsOverlay: EndingsOverlay | null = null;
  private statsOverlay!: StatsOverlay;
  private extrasOverlay!: ExtrasOverlay;
  private settingsOverlay!: SettingsOverlay;

  // Developer password tracking
  private devPasswordBuffer = '';
  private readonly DEV_PASSWORD = '2FORT';
  private devInputEl: HTMLInputElement | null = null;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const loadingText = this.add.text(width / 2, height / 2, 'CONNECTING...', {
      fontFamily: 'VT323, "Courier New", monospace',
      fontSize: '32px',
      color: PALETTE.amberCss,
    });
    loadingText.setOrigin(0.5);

    if (!this.cache.audio.exists('menu-music')) {
      this.load.audio('menu-music', 'audio/menu-music.mp3');
    }
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.saveData = loadSave();
    const hasBeatenNight5 = this.saveData?.hasBeatenNight5 || false;
    const hasExistingSave = hasSave();
    this.selectedNight = this.saveData?.currentNight || 1;
    this.devPasswordBuffer = '';
    this.started = false;

    this.children.removeAll();
    ensureNoiseTexture(this);

    // ===== MENU MUSIC =====
    if (this.sound.get('menu-music')) {
      this.sound.get('menu-music').stop();
    }
    const menuMusic = this.sound.add('menu-music', {
      loop: true,
      volume: MENU_MUSIC_BASE_VOLUME * getMusicVolume(),
    });
    menuMusic.play();
    const unsubscribe = onSettingsChange(() => {
      // getMusicVolume() folds in the mute toggle
      (menuMusic as Phaser.Sound.WebAudioSound).setVolume(MENU_MUSIC_BASE_VOLUME * getMusicVolume());
    });
    this.events.once('shutdown', () => {
      menuMusic.stop();
      unsubscribe();
    });

    // ===== BACKGROUND =====
    const bgBase = this.add.rectangle(width / 2, height / 2, width, height, PALETTE.bg);
    bgBase.setDepth(0);
    addVignette(this, width, height).setDepth(1);

    // ===== LURKING MERC PORTRAIT (right panel) =====
    this.createPortrait(width, height);

    // ===== CRT DRESSING =====
    const grain = addStatic(this, width / 2, height / 2, width, height, 0.035);
    grain.setDepth(88);
    addScanlines(this, 0, 0, width, height, 0.11).setDepth(90);

    // ===== TITLE BLOCK (top-left) =====
    const titleX = 95;
    this.add.text(titleX, 68, 'FIVE NIGHTS AT', headingStyle(34, PALETTE.amberCss)).setDepth(5);
    const bigTitle = this.add.text(titleX - 4, 96, '2FORT', titleStyle(104)).setDepth(5);
    this.add
      .text(titleX + 2, 212, 'A TF2-INSPIRED FNAF EXPERIENCE', osdStyle(17, PALETTE.amberDimCss))
      .setDepth(5);
    this.add.rectangle(titleX + 210, 236, 420, 1, PALETTE.amberFaint).setDepth(5);

    // Slow phosphor flicker on the big title
    this.tweens.add({
      targets: bigTitle,
      alpha: { from: 1, to: 0.82 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ===== OVERLAYS =====
    this.settingsOverlay = new SettingsOverlay(this);
    this.settingsOverlay.create();
    this.tutorialOverlay = new TutorialOverlay(this);
    this.tutorialOverlay.create();
    this.galleryOverlay = new GalleryOverlay(this);
    this.galleryOverlay.create();
    this.statsOverlay = new StatsOverlay(this);
    this.statsOverlay.create();
    if (hasBeatenNight5) {
      this.endingsOverlay = new EndingsOverlay(this);
      this.endingsOverlay.create();
    }

    const extrasEntries: ExtrasEntry[] = [
      { label: 'HOW TO PLAY', onSelect: () => this.tutorialOverlay.show() },
      { label: 'GALLERY', onSelect: () => this.galleryOverlay.show() },
      { label: 'SERVICE RECORD', onSelect: () => this.statsOverlay.show() },
    ];
    if (this.endingsOverlay) {
      extrasEntries.splice(2, 0, { label: 'ENDINGS', onSelect: () => this.endingsOverlay!.show() });
    }
    this.extrasOverlay = new ExtrasOverlay(this, extrasEntries);
    this.extrasOverlay.create();

    // ===== TERMINAL MENU =====
    if (hasBeatenNight5) {
      this.createPostGameMenu();
    } else {
      this.createPreGameMenu(hasExistingSave);
    }

    // ===== INCIDENT-REPORT TICKER (bottom) =====
    this.createTicker(width, height, hasBeatenNight5);

    // ===== DEVELOPER PASSWORD =====
    this.setupDevPasswordInput();
    this.setupDevPasswordListener();

    // Version tag
    this.add.text(width - 26, height - 22, 'v1.1', osdStyle(15, PALETTE.amberFaintCss)).setOrigin(1, 0.5).setDepth(95);
  }

  // ============================================
  // MENUS
  // ============================================

  private isOverlayOpen(): boolean {
    return Boolean(
      this.tutorialOverlay?.isVisible() ||
        this.galleryOverlay?.isVisible() ||
        this.endingsOverlay?.isVisible() ||
        this.statsOverlay?.isVisible() ||
        this.extrasOverlay?.isVisible() ||
        this.settingsOverlay?.isVisible()
    );
  }

  private startGame(night: number, opts: { custom?: boolean; badEnding?: boolean; nightmare?: boolean } = {}): void {
    if (this.started) return;
    this.started = true;

    playGameStartChime();
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(600, () => {
      if (opts.custom) {
        const customNightEnemies = loadCustomNightEnemies();
        this.scene.start('GameScene', {
          night: 7, // 7 = custom night, distinguishes from story Night 6
          customEnemies: { ...customNightEnemies },
          isCustomNight: true,
        });
      } else if (opts.nightmare) {
        this.scene.start('GameScene', {
          night: 8,
          isNightmareMode: true,
          customEnemies: {
            scout: true, soldier: true, demoman: true, heavy: true, sniper: true,
            spy: true, pyro: true, medic: true, administrator: true,
            pauling: false, merasmus: false,
          },
        });
      } else if (opts.badEnding) {
        this.scene.start('GameScene', {
          night: 6,
          isBadEndingNight6: true,
          customEnemies: {
            scout: true, soldier: true, demoman: true, heavy: true, sniper: true,
            spy: true, pyro: true, medic: true,
            administrator: false, pauling: false, merasmus: false,
          },
        });
      } else {
        this.scene.start('GameScene', { night });
      }
    });
  }

  private createPreGameMenu(hasExistingSave: boolean): void {
    const items: TerminalMenuItem[] = [];

    if (hasExistingSave && this.saveData) {
      const continueNight = this.saveData.currentNight;
      items.push({
        id: 'continue',
        label: `CONTINUE — NIGHT ${continueNight}`,
        onSelect: () => this.startGame(continueNight, { badEnding: continueNight === 6 }),
      });
    }

    items.push({
      id: 'new-game',
      label: 'NEW GAME',
      onSelect: () => {
        deleteSave();
        createNewSave();
        this.selectedNight = 1;
        this.startGame(1);
      },
    });

    items.push({ id: 'extras', label: 'EXTRAS', onSelect: () => this.extrasOverlay.show() });
    items.push({ id: 'settings', label: 'SETTINGS', onSelect: () => this.settingsOverlay.show() });

    this.menu = createTerminalMenu(this, items, {
      x: 130,
      y: 320,
      pitch: 52,
      fontSize: 30,
      isBlocked: () => this.isOverlayOpen() || this.started,
    });
    this.menu.container.setDepth(10);
  }

  private createPostGameMenu(): void {
    const items: TerminalMenuItem[] = [
      {
        id: 'start',
        label: `START NIGHT ${this.selectedNight}`,
        onSelect: () => this.startGame(this.selectedNight, { badEnding: this.selectedNight === 6 }),
        onLeft: () => this.cycleNight(-1),
        onRight: () => this.cycleNight(1),
      },
      { id: 'custom', label: 'CUSTOM NIGHT', onSelect: () => this.scene.start('CustomNightScene') },
      {
        id: 'nightmare',
        label: 'NIGHTMARE MODE',
        danger: true,
        onSelect: () => this.startGame(8, { nightmare: true }),
      },
      { id: 'extras', label: 'EXTRAS', onSelect: () => this.extrasOverlay.show() },
      { id: 'settings', label: 'SETTINGS', onSelect: () => this.settingsOverlay.show() },
    ];

    this.menu = createTerminalMenu(this, items, {
      x: 130,
      y: 310,
      pitch: 52,
      fontSize: 30,
      isBlocked: () => this.isOverlayOpen() || this.started,
    });
    this.menu.container.setDepth(10);

    // Selected-night detail line under the menu
    this.nightInfoText = this.add
      .text(130, 310 + items.length * 52 + 8, '', osdStyle(17, PALETTE.amberDimCss))
      .setDepth(10);
    this.updateNightInfo();
  }

  private cycleNight(dir: number): void {
    const maxNight = 6; // post-game always has Night 6 unlocked
    this.selectedNight = ((this.selectedNight - 1 + dir + maxNight) % maxNight) + 1;
    this.menu?.setLabel('start', `START NIGHT ${this.selectedNight}`);
    this.updateNightInfo();
  }

  private updateNightInfo(): void {
    if (!this.nightInfoText) return;
    const save = this.saveData;
    const night = this.selectedNight;

    if (night === 6) {
      this.nightInfoText.setText('N6 ▸ ENDLESS SHIFT — ALL THREATS ACTIVE');
      this.nightInfoText.setColor(PALETTE.alertDimCss);
      return;
    }

    const losses = save?.nightDestructions?.[night];
    const total = calculateTotalDestructions(save?.nightDestructions || {});
    const canRedeem = save?.hasBeatenNight5 && !save.goodEndingAchieved && total < 5;

    if (night === 5 && canRedeem) {
      this.nightInfoText.setText('N5 ▸ GOOD ENDING AVAILABLE — CLEAR IT NOW');
      this.nightInfoText.setColor(PALETTE.amberCss);
    } else if (losses !== undefined && losses > 0) {
      this.nightInfoText.setText(`N${night} ▸ SENTRIES LOST: ${losses} — REPLAY TO REDUCE`);
      this.nightInfoText.setColor(PALETTE.alertDimCss);
    } else {
      this.nightInfoText.setText(`N${night} ▸ CLEAN RECORD`);
      this.nightInfoText.setColor(PALETTE.amberDimCss);
    }
  }

  // ============================================
  // TICKER
  // ============================================

  private createTicker(width: number, height: number, postGame: boolean): void {
    const y = height - 24;

    this.add.rectangle(width / 2, y - 18, width - 80, 1, PALETTE.amberFaint).setDepth(95);

    // Blinking REC dot
    const recDot = this.add.circle(52, y, 5, PALETTE.alert).setDepth(95);
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => recDot.setVisible(!recDot.visible),
    });
    this.add.text(66, y, 'REC', osdStyle(17, PALETTE.amberDimCss)).setOrigin(0, 0.5).setDepth(95);
    this.add
      .text(120, y, 'INTEL ROOM — 2FORT DEFENSE TERMINAL', osdStyle(17, PALETTE.amberFaintCss))
      .setOrigin(0, 0.5)
      .setDepth(95);

    if (!postGame) return;

    // Post-game status segment (right-aligned)
    const save = this.saveData;
    const total = calculateTotalDestructions(save?.nightDestructions || {});
    const canRedeem = save?.hasBeatenNight5 && !save.goodEndingAchieved && total < 5;

    let statusText: string;
    let statusColor: string;
    if (save?.goodEndingAchieved) {
      statusText = `LOSSES: ${total} — GOOD ENDING ON FILE`;
      statusColor = PALETTE.creamCss;
    } else if (canRedeem) {
      statusText = `LOSSES: ${total}/5 — GOOD ENDING AVAILABLE`;
      statusColor = PALETTE.amberCss;
    } else {
      statusText = `LOSSES: ${total}/5 — REPLAY NIGHTS TO REDUCE`;
      statusColor = PALETTE.alertDimCss;
    }

    const status = this.add
      .text(width - 80, y, statusText, osdStyle(17, statusColor))
      .setOrigin(1, 0.5)
      .setDepth(95);

    if (canRedeem) {
      this.tweens.add({
        targets: status,
        alpha: { from: 1, to: 0.45 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ============================================
  // PORTRAIT
  // ============================================

  /** A random merc lurking in the dark on the right side, with glitch reveals. */
  private createPortrait(width: number, height: number): void {
    const name = PORTRAIT_POOL[Math.floor(Math.random() * PORTRAIT_POOL.length)];
    const px = Math.round(width * 0.72);
    const py = Math.round(height * 0.52);

    // Faint red aura (layered circles for a soft falloff)
    const aura = this.add.graphics();
    aura.fillStyle(0xff0000, 0.02);
    aura.fillCircle(px, py, 300);
    aura.fillStyle(0xff0000, 0.025);
    aura.fillCircle(px, py, 220);
    aura.fillStyle(0xff0000, 0.03);
    aura.fillCircle(px, py, 145);
    aura.setDepth(2);

    const gfx = this.add.graphics();
    drawCharacterSilhouette(gfx, 0, 0, name, 0xffffff);
    const portrait = this.add.container(px, py, [gfx]);
    portrait.setScale(3.1);
    portrait.setAlpha(0.16);
    portrait.setDepth(3);

    // Breathing sway
    this.tweens.add({
      targets: portrait,
      y: py + 6,
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Occasional glitch: static burst + brief reveal + twitch
    const scheduleGlitch = () => {
      this.time.delayedCall(Phaser.Math.Between(2800, 7000), () => {
        glitchBurst(this, [portrait], 130, 89);
        portrait.setAlpha(0.5);
        portrait.x = px + Phaser.Math.Between(-14, 14);
        this.time.delayedCall(Phaser.Math.Between(80, 160), () => {
          portrait.setAlpha(0.16);
          portrait.x = px;
          scheduleGlitch();
        });
      });
    };
    scheduleGlitch();
  }

  // ============================================
  // DEVELOPER PASSWORD
  // ============================================

  /**
   * Unlabeled corner text input for the dev code (mobile-friendly).
   * Anchored to the canvas's on-screen rect so it stays inside the visible
   * game area with FIT letterboxing and in fullscreen.
   */
  private setupDevPasswordInput(): void {
    const id = 'boot-dev-input';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const canvas = this.game.canvas;
    const container = document.getElementById('game-container');
    if (!canvas || !container) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', ' ');
    Object.assign(input.style, {
      position: 'absolute',
      width: '72px',
      height: '18px',
      padding: '0 4px',
      fontFamily: 'VT323, "Courier New", monospace',
      fontSize: '10px',
      color: '#3d2c14',
      background: 'rgba(20, 14, 6, 0.6)',
      border: '1px solid #2a1e0e',
      borderRadius: '2px',
      outline: 'none',
      caretColor: '#3d2c14',
      boxSizing: 'border-box',
      zIndex: '10',
    });
    // Must live INSIDE the fullscreen target (#game-container): elements
    // outside the fullscreened element don't render in fullscreen mode.
    container.style.position = 'relative';
    container.appendChild(input);
    this.devInputEl = input;

    // Sit on the ticker line, just right of "…2FORT DEFENSE TERMINAL"
    // (game-space ~(400, 687) of 1280x720). Both axes scale with the canvas
    // rect so it stays put windowed, letterboxed, and fullscreen.
    const reposition = () => {
      requestAnimationFrame(() => {
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        input.style.left = `${Math.round(canvasRect.left - containerRect.left + canvasRect.width * (400 / 1280))}px`;
        input.style.top = `${Math.round(canvasRect.top - containerRect.top + canvasRect.height * (687 / 720))}px`;
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    document.addEventListener('fullscreenchange', reposition);
    this.scale.on('resize', reposition);

    const check = () => {
      const value = (input.value || '').toUpperCase().trim();
      if (value === this.DEV_PASSWORD) {
        input.value = '';
        input.blur();
        this.onDevPasswordEntered();
      }
    };
    input.addEventListener('input', check);
    input.addEventListener('change', check);

    this.events.once('shutdown', () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('fullscreenchange', reposition);
      this.scale.off('resize', reposition);
      input.remove();
      this.devInputEl = null;
    });
  }

  /** Keyboard fallback for the dev password (desktop). */
  private setupDevPasswordListener(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
        this.devPasswordBuffer += event.key.toUpperCase();
        if (this.devPasswordBuffer.length > this.DEV_PASSWORD.length) {
          this.devPasswordBuffer = this.devPasswordBuffer.slice(-this.DEV_PASSWORD.length);
        }
        if (this.devPasswordBuffer === this.DEV_PASSWORD) {
          this.onDevPasswordEntered();
        }
      }
    });
  }

  private onDevPasswordEntered(): void {
    unlockEverything();

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const unlockText = this.add
      .text(width / 2, height / 2, 'DEVELOPER ACCESS GRANTED', {
        fontFamily: 'VT323, "Courier New", monospace',
        fontSize: '34px',
        color: PALETTE.creamCss,
        backgroundColor: '#0a0704',
        padding: { left: 24, right: 24, top: 12, bottom: 12 },
      })
      .setOrigin(0.5)
      .setDepth(400);

    playGameStartChime();
    glitchBurst(this, [], 200, 399);

    this.tweens.add({
      targets: unlockText,
      alpha: 0,
      duration: 1500,
      delay: 1000,
      onComplete: () => {
        unlockText.destroy();
        this.scene.restart();
      },
    });
  }
}
