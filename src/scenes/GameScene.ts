import Phaser from 'phaser';
import { 
  SentryState, 
  SentryLevel, 
  GameStatus, 
  NodeId,
  SENTRY_MAX_HP, 
  GAME_CONSTANTS,
  CAMERAS,
  CameraState,
  HackedRoomState,
  LureData,
  ROOM_ADJACENCY,
} from '../types';
import { GameAudio } from '../audio/GameAudio';
import { MobileControls } from '../ui/MobileControls';
import { PauseMenu } from '../ui/PauseMenu';
import { setGameClock } from '../utils/gameClock';
import { isMobileDevice } from '../utils/mobile';
import { 
  updateSaveOnVictory, 
  updateSaveOnNight6Complete 
} from '../utils/saveData';
import { ScoutEnemy } from '../entities/ScoutEnemy';
import { SoldierEnemy } from '../entities/SoldierEnemy';
import { DemomanEnemy } from '../entities/DemomanEnemy';
import { HeavyEnemy } from '../entities/HeavyEnemy';
import { SniperEnemy } from '../entities/SniperEnemy';
import { SpyEnemy } from '../entities/SpyEnemy';
import { PyroEnemy } from '../entities/PyroEnemy';
import { MedicEnemy, UberTarget } from '../entities/MedicEnemy';
import { AdministratorEnemy } from '../entities/AdministratorEnemy';
import { PaulingEnemy, VentSide } from '../entities/PaulingEnemy';
import {
  drawMedicGhostSilhouette,
  drawPaulingJumpscarePortrait,
} from '../drawing/medicPaulingPortraits';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import {
  drawUberGlow,
  drawEnemySilhouette,
  drawDemomanHead,
  drawDemomanHeadSmall,
  drawHeavySilhouette,
  drawHeavyDoorwayShadow,
  drawSniperSilhouette,
  drawJumpscareSilhouette,
  drawCelebratingMercs,
} from '../drawing/enemySilhouettes';

/**
 * GameScene - Main gameplay scene for Night 1
 * 
 * Manages:
 * - Time progression (00:00 to 06:00)
 * - Metal & Dispenser
 * - Sentry & Wrangler mechanics
 * - Camera system
 * - Enemy spawning and behavior
 * - Win/Lose conditions
 */
export class GameScene extends Phaser.Scene {
  private audio: GameAudio = new GameAudio({
    getNightNumber: () => this.nightNumber,
    getGameStatus: () => this.gameStatus,
    isPausedNow: () => this.isPaused,
    isTeleportedNow: () => this.isTeleported,
    isCameraModeNow: () => this.isCameraMode,
    getPyro: () => this.pyro,
    isMerasmusEnabled: () => this.isMerasmusEnabled(),
    isSniperEnabled: () => this.isSniperEnabled(),
    isPyroEnabled: () => this.isPyroEnabled(),
  });

  // ============================================
  // GAME STATE
  // ============================================
  
  private gameStatus: GameStatus = 'PLAYING';
  
  // Time (in game minutes, 0-360 for 00:00 to 06:00)
  private gameMinutes: number = 0;
  private timeAccumulator: number = 0;
  
  // Metal
  private metal: number = GAME_CONSTANTS.START_METAL;
  
  // Sentry
  private sentry: SentryState = {
    exists: true,
    level: 1,
    hp: SENTRY_MAX_HP[1],
    maxHp: SENTRY_MAX_HP[1],
    isWrangled: false,
    aimedDoor: 'NONE',  // Start aiming at middle (no door lit)
  };
  
  // Camera mode
  private isCameraMode: boolean = false;
  private selectedCamera: number = 0;
  private wasWrangledBeforeCamera: boolean = false;  // Remember wrangler state
  
  // Camera boot-up delay (1s delay when raising cameras)
  private isCameraBooting: boolean = false;
  private cameraBootTimer: number = 0;
  private readonly CAMERA_BOOT_DELAY: number = 1000; // 1 second boot-up time
  private cameraBootOverlay!: Phaser.GameObjects.Container;
  
  // Wrangler firing cooldown (prevents spam-clicking)
  private wranglerCooldown: number = 0;
  private readonly WRANGLER_COOLDOWN: number = 1000; // 1 second cooldown between shots
  
  // Demoman eye glow sound
  
  // Pause state
  private isPaused: boolean = false;
  private pauseMenu!: PauseMenu;
  
  // Input state for hold-to-aim (using native DOM events for reliability)
  private keyADown: boolean = false;
  private keyDDown: boolean = false;
  private _keyA!: Phaser.Input.Keyboard.Key;
  private _keyD!: Phaser.Input.Keyboard.Key;
  // Stored so cleanup() can remove them - Phaser reuses the scene instance,
  // so unremoved window listeners would stack on every restart
  private domKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private domKeyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private domBlurHandler: (() => void) | null = null;
  
  // Enemies
  private scout!: ScoutEnemy;
  private soldier!: SoldierEnemy;
  private demoman!: DemomanEnemy;
  private heavy!: HeavyEnemy;
  private sniper!: SniperEnemy;
  private spy!: SpyEnemy;
  private pyro!: PyroEnemy;
  private medic!: MedicEnemy;
  private administrator!: AdministratorEnemy;
  private pauling!: PaulingEnemy;

  // Pauling vent system (Custom Night)
  private ventSealLeft: boolean = false;
  private ventSealRight: boolean = false;
  private thermostat: number = 0;
  private isVentCameraMode: boolean = false;

  // Camera map panel content (nodes/paths/grid hidden when viewing vents; frame stays)
  private cameraMapContent!: Phaser.GameObjects.Container;

  // Vent camera UI elements
  private ventUI!: Phaser.GameObjects.Container;
  private ventNodeGraphics: Map<string, Phaser.GameObjects.Container> = new Map();
  private ventPaulingIcon!: Phaser.GameObjects.Container;
  private ventSealLeftBtn!: Phaser.GameObjects.Container;
  private ventSealRightBtn!: Phaser.GameObjects.Container;
  private ventSealLeftIndicator!: Phaser.GameObjects.Rectangle;
  private ventSealRightIndicator!: Phaser.GameObjects.Rectangle;
  private ventCamsToggleBtn!: Phaser.GameObjects.Container;
  private ventCamsToggleText!: Phaser.GameObjects.Text;
  private mapTitleText!: Phaser.GameObjects.Text;

  // Vent-side controls (in right panel when vent view is active)
  private ventPanelControls!: Phaser.GameObjects.Container;
  private ventPanelThermoFill!: Phaser.GameObjects.Rectangle;
  private ventPanelThermoText!: Phaser.GameObjects.Text;

  // Thermostat HUD
  private thermostatBeepTimer: number = 0;
  private thermostatContainer!: Phaser.GameObjects.Container;
  private thermostatFill!: Phaser.GameObjects.Rectangle;
  private thermostatText!: Phaser.GameObjects.Text;

  // Hacked teleporter rooms (Administrator - Custom Night)
  private hackedRooms: Map<NodeId, HackedRoomState> = new Map();

  // Administrator dual-mode tracking fields
  private lastTeleportedRoom: NodeId | null = null;   // last room player arrived at via teleport
  private administratorNoTeleportTimer: number = 0;         // counts up; triggers Mode 2 at ADMINISTRATOR_NO_TELEPORT_THRESHOLD
  
  // Night number (determines which enemies are active)
  private nightNumber: number = 1;
  
  // Session tracking for save system
  private sessionDestructions: number = 0;  // Sentry destructions this night
  private isBadEndingNight6: boolean = false;  // True if playing bad ending Night 6
  private isCustomNightMode: boolean = false;  // True if playing custom night (extras)
  private isNightmareMode: boolean = false;  // True if playing Nightmare Mode (night 8, starts at 10 AM difficulty)
  
  // Endless Night 6 (bad ending) tracking
  private endlessDay: number = 7;  // Current day in endless mode (Day 7 when 6 AM first reached)
  private hoursAfter6AM: number = 0;  // Hours elapsed after first 6 AM (for difficulty scaling)
  private hasReached6AM: boolean = false;  // True once first 6 AM is reached
  private endlessSurvivalMinutes: number = 0;  // Total minutes survived in endless mode
  
  // Medic ghost apparition (endless mode)
  private medicGhostActive: boolean = false;
  private medicGhostSide: 'LEFT' | 'RIGHT' | null = null;
  private medicGhostTimer: number = 0;
  private medicGhostDuration: number = 3000;  // How long ghost appears (3 sec)
  private medicGhostCooldown: number = 0;  // Cooldown between ghost appearances
  private medicGhostVisual!: Phaser.GameObjects.Container;  // Visual for ghost in doorway
  
  // Custom night enemy configuration (null if not custom night)
  private customEnemies: {
    scout: boolean;
    soldier: boolean;
    demoman: boolean;
    heavy: boolean;
    sniper: boolean;
    spy: boolean;
    pyro: boolean;
    medic: boolean;
    administrator: boolean;
    pauling: boolean;
    merasmus: boolean;
  } | null = null;

  /**
   * Merasmus (Custom Night only when `customEnemies.merasmus` is true).
   * Fade-in threat in Intel; Q toggles full-screen mirror to repel at 8× speed.
   */
  private merasmusViewFlipped = false;
  private merasmusLinearProgress = 0;
  private merasmusRespiteUnflippedMs = 0;
  private merasmusInRespite = false;
  /** Stock Phaser pointer mapper; restored on shutdown so DOM mirror + X invert stay in sync */
  private merasmusStockTransformPointer: Phaser.Input.InputManager['transformPointer'] | null = null;
  private merasmusVignette!: Phaser.GameObjects.Container;
  private merasmusFigureContainer!: Phaser.GameObjects.Container;
  // Night 5+ features - Spy sapper
  private sapperIndicator!: Phaser.GameObjects.Container;
  private sapperRemoveClicks: number = 0;
  private sapperRemoveTimeout: number = 0;
  
  // Night 3+ features
  // Camera destruction states
  private cameraStates: Map<number, CameraState> = new Map();
  
  // Teleporter state
  private isTeleported: boolean = false;
  private currentRoom: NodeId = 'INTEL';
  private activeLure: LureData | null = null;
  private teleportEscapeTimer: number = 0;
  private enemyApproachingRoom: boolean = false;
  private approachingEnemyType: string = 'an enemy'; // Track which enemy triggered the approach
  
  // Teleport animation state (for cancellation)
  private isTeleportAnimating: boolean = false;
  private teleportAnimationOverlay: Phaser.GameObjects.Container | null = null;
  private teleportAnimationCallback: Phaser.Time.TimerEvent | null = null;
  private pendingTeleportDestination: NodeId | null = null;
  
  // Sniper charge visual
  private sniperChargeOverlay!: Phaser.GameObjects.Rectangle;
  private _sniperChargeTimer: number = 0; // Reserved for future use
  
  // ============================================
  // GRAPHICS OBJECTS
  // ============================================
  
  // Main room
  private _roomBackground!: Phaser.GameObjects.Rectangle;
  private leftDoor!: Phaser.GameObjects.Rectangle;
  private rightDoor!: Phaser.GameObjects.Rectangle;
  private _leftDoorFrame!: Phaser.GameObjects.Rectangle;
  private _rightDoorFrame!: Phaser.GameObjects.Rectangle;
  
  // Enemy visuals in doorways (shown when light/wrangler aimed at door)
  private scoutInDoorway!: Phaser.GameObjects.Container;
  private soldierInDoorway!: Phaser.GameObjects.Container;
  private demomanInDoorway!: Phaser.GameObjects.Container;
  private demomanApproachGlow!: Phaser.GameObjects.Graphics; // Green glow when approaching
  private heavyInDoorway!: Phaser.GameObjects.Container;
  private heavyDoorwayGraphics!: Phaser.GameObjects.Graphics;
  private heavyDoorwayMaskLeft!: Phaser.GameObjects.Graphics;
  private heavyDoorwayMaskRight!: Phaser.GameObjects.Graphics;
  private heavyDoorwayLeftMask!: Phaser.Display.Masks.GeometryMask;
  private heavyDoorwayRightMask!: Phaser.Display.Masks.GeometryMask;
  private heavyDoorwayLastLured: boolean | null = null;
  private heavyDoorwayPulseTween: Phaser.Tweens.Tween | null = null;
  
  // Über glow effects for Medic (Custom Night only)
  private uberGlowLeft!: Phaser.GameObjects.Graphics;
  private uberGlowRight!: Phaser.GameObjects.Graphics;
  
  // Sniper laser sight visuals (visible without wrangler - Night 4+)
  private sniperLaserLeft!: Phaser.GameObjects.Container;
  private sniperLaserRight!: Phaser.GameObjects.Container;
  private sniperChargeText!: Phaser.GameObjects.Text;
  
  // Pyro floating mask visuals (Custom Night only - visible with wrangler light)
  private pyroMaskLeft!: Phaser.GameObjects.Container;
  private pyroMaskRight!: Phaser.GameObjects.Container;
  private pyroMaskLeftBurn!: Phaser.GameObjects.Graphics;  // White burn overlay for light exposure
  private pyroMaskRightBurn!: Phaser.GameObjects.Graphics;
  
  // Demoman head visuals (can appear anywhere)
  private demomanHeadInRoom!: Phaser.GameObjects.Container; // In Intel room
  private demomanHeadEyeGlow!: Phaser.GameObjects.Graphics; // Eye glow effect
  
  // Sentry visual
  private sentryGraphic!: Phaser.GameObjects.Container;
  private sentryBody!: Phaser.GameObjects.Rectangle;
  private sentryGun!: Phaser.GameObjects.Rectangle;
  private aimBeam!: Phaser.GameObjects.Graphics;
  
  // Dispenser visual
  private dispenserGraphic!: Phaser.GameObjects.Rectangle;
  
  // HUD elements
  private timeText!: Phaser.GameObjects.Text;
  private metalText!: Phaser.GameObjects.Text;
  private sentryText!: Phaser.GameObjects.Text;
  private wranglerText!: Phaser.GameObjects.Text;
  private _controlsText!: Phaser.GameObjects.Text;
  private alertText!: Phaser.GameObjects.Text;
  private alertContainer!: Phaser.GameObjects.Container;
  private alertBg!: Phaser.GameObjects.Rectangle;
  
  // Lure duration bar (top right when lure is active)
  private lureBarContainer!: Phaser.GameObjects.Container;
  private lureBarFill!: Phaser.GameObjects.Rectangle;
  private lureBarText!: Phaser.GameObjects.Text;
  
  // Camera UI container (FNAF-style with map + camera feed)
  private cameraUI!: Phaser.GameObjects.Container;
  private cameraMapNodes: Map<string, Phaser.GameObjects.Container> = new Map();
  // Map of NodeId -> red X text overlay on the camera map (shown when teleporter is hacked)
  private hackedRoomMapIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  private scoutMapIcon!: Phaser.GameObjects.Container;
  private soldierMapIcon!: Phaser.GameObjects.Container;
  private intelRoomIcon!: Phaser.GameObjects.Arc;
  
  // Camera feed view
  private cameraFeedPanel!: Phaser.GameObjects.Rectangle;
  private cameraFeedTitle!: Phaser.GameObjects.Text;
  private cameraFeedEnemy!: Phaser.GameObjects.Container;
  private cameraFeedEnemy2!: Phaser.GameObjects.Container;  // Second enemy slot
  private cameraFeedEnemy3!: Phaser.GameObjects.Container;  // Third enemy slot
  private cameraFeedEnemyEyeGlow!: Phaser.GameObjects.Graphics; // Control eye glow separately
  private cameraFeedDemoHead!: Phaser.GameObjects.Container; // Secondary display for Demo's head
  private cameraFeedEmpty!: Phaser.GameObjects.Text;
  private cameraStaticGraphics!: Phaser.GameObjects.Graphics;
  private cameraStaticBurstOverlay!: Phaser.GameObjects.Graphics;  // Static burst when switching cameras
  private cameraLureIndicator!: Phaser.GameObjects.Container;  // Shows when lure is at this camera
  
  // Camera destroyed overlay (Night 3+)
  private cameraDestroyedOverlay!: Phaser.GameObjects.Container;
  private cameraDestroyedText!: Phaser.GameObjects.Text;
  private cameraRepairButton!: Phaser.GameObjects.Container;
  
  // Camera watch warning (Heavy/Sniper about to break camera)
  private cameraWatchWarning!: Phaser.GameObjects.Container;
  private cameraWatchBar!: Phaser.GameObjects.Rectangle;

  // Administrator hack bar (teleporter hacking indicator on camera feed)
  private administratorHackBarContainer!: Phaser.GameObjects.Container;
  private administratorHackBarFill!: Phaser.GameObjects.Rectangle;
  private administratorHackBarBorder!: Phaser.GameObjects.Rectangle;
  private administratorHackBarCross!: Phaser.GameObjects.Graphics; // diagonal cross shown when bar is empty
  // Repair overlay for hacked teleporter rooms
  private administratorRepairOverlay!: Phaser.GameObjects.Container;
  private administratorRepairBarFill!: Phaser.GameObjects.Rectangle;
  private administratorRepairActive: boolean = false;
  
  // Teleporter UI (Night 3+)
  private teleportButton!: Phaser.GameObjects.Container;
  private teleportButtonBg!: Phaser.GameObjects.Rectangle;
  private teleportButtonText!: Phaser.GameObjects.Text;
  // Administrator repair bar embedded in teleport button
  private teleportRepairBarBg!: Phaser.GameObjects.Rectangle;
  private teleportRepairBarFill!: Phaser.GameObjects.Rectangle;
  private cameraLureButton!: Phaser.GameObjects.Container;  // Play lure from camera view
  private roomViewUI!: Phaser.GameObjects.Container;
  private roomViewHeader!: Phaser.GameObjects.Text;  // Room name header
  private lureButton!: Phaser.GameObjects.Container;
  private returnButton!: Phaser.GameObjects.Container;
  private escapeWarning!: Phaser.GameObjects.Container;
  private roomDoorway!: Phaser.GameObjects.Container;
  private roomDoorwayEyes!: Phaser.GameObjects.Container;
  
  // Pyro Intel mode warning UI (Custom Night only)
  private pyroEscapeWarning!: Phaser.GameObjects.Container;
  private pyroEscapeTimer!: Phaser.GameObjects.Text;
  
  // Sound state for detection buzzer

  // Sound state for sniper laser hum

  // Sound state for Pyro hallway lighter hiss (ROOM mode, Intel view)
  
  // Shared audio context for consistent sound levels


  // Dispenser ambient hum (plays in Intel room)
  
  // 2Fort Intel room ambience (loops while in Intel; not tied to wrangler aim focus mute)
  
  // End screen
  private endScreen!: Phaser.GameObjects.Container;
  
  // ============================================
  // ENGINEER RECORDINGS (Phone calls)
  // ============================================
  
  private recordingAudio: HTMLAudioElement | null = null;
  private isRecordingPlaying: boolean = false;
  private recordingSkipButton!: Phaser.GameObjects.Container;
  private recordingIndicator!: Phaser.GameObjects.Container;
  private recordingStartDelay: number = 5000; // 5 seconds into night
  private recordingStartTimer: number = 0;
  private hasPlayedRecording: boolean = false;
  private audioLogsEnabled: boolean = true; // Main menu toggle; when false, no recording each night
  
  // ============================================
  // MOBILE CONTROLS
  // ============================================
  
  private isMobile: boolean = false;
  private mobileControls: MobileControls | null = null;
  
  constructor() {
    super({ key: 'GameScene' });
  }
  
  /**
   * Helper methods to check if enemies are enabled (considering custom night)
   */
  private isScoutEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.scout : true;
  }
  
  private isSoldierEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.soldier : true;
  }
  
  private isDemomanEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.demoman : (this.nightNumber >= 2);
  }
  
  private isHeavyEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.heavy : (this.nightNumber >= 3);
  }
  
  private isSniperEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.sniper : (this.nightNumber >= 4);
  }
  
  private isSpyEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.spy : (this.nightNumber >= 4);
  }
  
  private isPyroEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.pyro : (this.nightNumber >= 5);
  }
  
  private isMedicEnabled(): boolean {
    // Medic is CUSTOM NIGHT ONLY - never appears in regular nights
    return this.customEnemies ? this.customEnemies.medic : false;
  }

  private isAdministratorEnabled(): boolean {
    // Administrator is CUSTOM NIGHT ONLY - never appears in regular nights
    return this.customEnemies ? this.customEnemies.administrator ?? false : false;
  }

  private isPaulingEnabled(): boolean {
    // Pauling is CUSTOM NIGHT ONLY - vent infiltrator
    return this.customEnemies ? this.customEnemies.pauling ?? false : false;
  }

  private isMerasmusEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.merasmus ?? false : false;
  }

  private resetMerasmusState(): void {
    this.merasmusLinearProgress = 0;
    this.merasmusRespiteUnflippedMs = 0;
    this.merasmusInRespite = false;
    this.setMerasmusDomMirror(false);
    this.audio.stopMerasmusHum();
    if (this.merasmusVignette) {
      this.merasmusVignette.setVisible(false);
      this.merasmusVignette.setAlpha(0);
    }
    if (this.merasmusFigureContainer) {
      this.merasmusFigureContainer.setVisible(false);
      this.merasmusFigureContainer.setAlpha(0);
    }
  }

  private clearMerasmusMirrorDomAndFlags(): void {
    this.resetMerasmusState();
  }

  private getMerasmusDisplayAlpha(): number {
    const p = Phaser.Math.Clamp(this.merasmusLinearProgress, 0, 1);
    return Math.pow(p, GAME_CONSTANTS.MERASMUS_EASE_POWER);
  }

  private setMerasmusDomMirror(mirrored: boolean): void {
    if (mirrored && !this.isMerasmusEnabled()) return;
    this.merasmusViewFlipped = mirrored;
    const canvas = this.game?.canvas;
    if (!canvas) return;
    if (mirrored) {
      canvas.style.transform = 'scaleX(-1)';
      canvas.style.transformOrigin = '50% 50%';
    } else {
      canvas.style.transform = '';
      canvas.style.transformOrigin = '';
    }
    this.mobileControls?.updateMerasmusFlipButton();
  }

  /**
   * CSS scaleX(-1) on the canvas does not mirror DOM coordinates Phaser receives, so hit tests miss.
   * Wrap InputManager.transformPointer to invert X in game space whenever the Merasmus mirror is active.
   */
  private installMerasmusPointerMirrorFix(): void {
    if (this.merasmusStockTransformPointer !== null) return;
    const im = this.input.manager;
    const scene = this;
    this.merasmusStockTransformPointer = im.transformPointer.bind(im);
    im.transformPointer = (pointer, pageX, pageY, wasMove) => {
      this.merasmusStockTransformPointer!.call(im, pointer, pageX, pageY, wasMove);
      if (scene.merasmusViewFlipped && scene.isMerasmusEnabled()) {
        const w = scene.scale.width;
        pointer.position.x = w - pointer.position.x;
      }
    };
  }

  private uninstallMerasmusPointerMirrorFix(): void {
    if (this.merasmusStockTransformPointer === null) return;
    this.input.manager.transformPointer = this.merasmusStockTransformPointer;
    this.merasmusStockTransformPointer = null;
  }

  private createMerasmusOverlays(): void {
    const width = 1280;
    const height = 720;

    this.merasmusVignette = this.add.container(0, 0);
    this.merasmusVignette.setDepth(140);
    const vignetteGfx = this.add.graphics();
    const fadeDepth = 360;
    const green = 0x44ff66;
    const edgeAlpha = 0.14;

    // Screen-edge vignette only — soft linear fades, no corner rings
    vignetteGfx.fillGradientStyle(green, green, green, green, edgeAlpha, edgeAlpha, 0, 0);
    vignetteGfx.fillRect(0, 0, width, fadeDepth);
    vignetteGfx.fillGradientStyle(green, green, green, green, 0, 0, edgeAlpha, edgeAlpha);
    vignetteGfx.fillRect(0, height - fadeDepth, width, fadeDepth);
    vignetteGfx.fillGradientStyle(green, green, green, green, edgeAlpha, 0, edgeAlpha, 0);
    vignetteGfx.fillRect(0, 0, fadeDepth, height);
    vignetteGfx.fillGradientStyle(green, green, green, green, 0, edgeAlpha, 0, edgeAlpha);
    vignetteGfx.fillRect(width - fadeDepth, 0, fadeDepth, height);

    this.merasmusVignette.add(vignetteGfx);
    this.merasmusVignette.setVisible(false);
    this.merasmusVignette.setAlpha(0);

    // Door frame is 260px tall — scale Merasmus to match wizard height
    const doorCenterY = height / 2 - 50;
    this.merasmusFigureContainer = this.add.container(640, doorCenterY + 8);
    this.merasmusFigureContainer.setDepth(141);
    const figure = this.add.graphics();
    drawCharacterSilhouette(figure, 0, 0, 'MERASMUS', 0x8866dd);
    this.merasmusFigureContainer.add(figure);
    this.merasmusFigureContainer.setScale(2.05);
    this.merasmusFigureContainer.setVisible(false);
    this.merasmusFigureContainer.setAlpha(0);
  }

  private toggleMerasmusFlip(): void {
    if (!this.isMerasmusEnabled()) return;
    if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isTeleported) return;
    // Clear edge holds so swapped zone→key mapping doesn't leave stale aim
    this.keyADown = false;
    this.keyDDown = false;
    this.setMerasmusDomMirror(!this.merasmusViewFlipped);
    this.audio.playMerasmusFlipSound(this.merasmusViewFlipped);
  }

  private updateMerasmus(delta: number): void {
    if (!this.isMerasmusEnabled()) return;

    if (this.isTeleported) {
      if (this.merasmusVignette) {
        this.merasmusVignette.setVisible(false);
      }
      if (this.merasmusFigureContainer) {
        this.merasmusFigureContainer.setVisible(false);
      }
      this.audio.updateMerasmusHumVolume(0);
      return;
    }

    const buildTime = GAME_CONSTANTS.MERASMUS_BUILD_TIME_MS;
    const repelMult = GAME_CONSTANTS.MERASMUS_REPEL_MULTIPLIER;
    const respiteMs = GAME_CONSTANTS.MERASMUS_RESPITE_UNFLIPPED_MS;

    if (this.merasmusLinearProgress >= 1) {
      this.audio.playMerasmusCackle();
      this.gameOver('Merasmus got you!');
      return;
    }

    if (this.merasmusInRespite) {
      if (this.merasmusViewFlipped) {
        this.merasmusRespiteUnflippedMs = 0;
      } else {
        this.merasmusRespiteUnflippedMs += delta;
        if (this.merasmusRespiteUnflippedMs >= respiteMs) {
          this.merasmusInRespite = false;
          this.merasmusRespiteUnflippedMs = 0;
        }
      }
    } else if (this.merasmusViewFlipped && this.merasmusLinearProgress > 0) {
      this.merasmusLinearProgress -= (repelMult * delta) / buildTime;
      if (this.merasmusLinearProgress <= 0) {
        this.merasmusLinearProgress = 0;
        this.merasmusInRespite = true;
        this.merasmusRespiteUnflippedMs = 0;
        this.playMerasmusRespiteFlash();
      }
    } else if (!this.merasmusViewFlipped) {
      this.merasmusLinearProgress += delta / buildTime;
      if (this.merasmusLinearProgress >= 1) {
        this.merasmusLinearProgress = 1;
      }
    }

    const displayAlpha = this.getMerasmusDisplayAlpha();

    if (this.merasmusVignette) {
      const showVignette = displayAlpha > 0.001;
      this.merasmusVignette.setVisible(showVignette);
      this.merasmusVignette.setAlpha(displayAlpha * 0.18);
    }

    if (this.merasmusFigureContainer) {
      const showFigure = displayAlpha > 0.001 && !this.isCameraMode;
      this.merasmusFigureContainer.setVisible(showFigure);
      this.merasmusFigureContainer.setAlpha(displayAlpha);
      this.merasmusFigureContainer.setScale(2.05 + displayAlpha * 0.2);
    }

    this.audio.updateMerasmusHumVolume(displayAlpha);
  }

  /** Brief green flash when repel completes — signals safe to unflip */
  private playMerasmusRespiteFlash(): void {
    this.cameras.main.flash(320, 48, 200, 72, false);
  }

  /** Returns true if the currently selected camera's room has a hacked teleporter */
  private isSelectedCameraHacked(): boolean {
    if (!this.isAdministratorEnabled()) return false;
    const cam = CAMERAS[this.selectedCamera];
    if (!cam) return false;
    const state = this.hackedRooms.get(cam.node);
    return !!state?.hacked;
  }

  /** Returns true if the camera covering a given node is currently destroyed */
  private isNodeCameraDestroyed(node: NodeId): boolean {
    const cam = CAMERAS.find(c => c.node === node);
    if (!cam) return false;
    const state = this.cameraStates.get(cam.id);
    return !!state?.destroyed;
  }
  
  /**
   * Helper methods to check if enemies have "started" for the night.
   * On introduction nights, enemies are delayed until 1am to give players
   * time to listen to the phone recordings and learn mechanics.
   * - Night 1: Scout and Soldier start at 1am
   * - Night 2: Demoman starts at 1am
   * - Night 3: Heavy starts at 1am
   */
  private hasScoutStarted(): boolean {
    // Night 1: Scout doesn't start until 1am (gameMinutes >= 60)
    // All other nights: Scout starts immediately
    if (this.nightNumber === 1 && this.gameMinutes < 60) return false;
    return true;
  }
  
  private hasSoldierStarted(): boolean {
    // Night 1: Soldier doesn't start until 1am (gameMinutes >= 60)
    // All other nights: Soldier starts immediately
    if (this.nightNumber === 1 && this.gameMinutes < 60) return false;
    return true;
  }
  
  private hasDemomanStarted(): boolean {
    // Night 2: Demoman doesn't start until 12:45am (gameMinutes >= 45)
    // All other nights: Demoman starts immediately
    if (this.nightNumber === 2 && this.gameMinutes < 45) return false;
    return true;
  }
  
  private hasHeavyStarted(): boolean {
    // Night 3: Heavy doesn't start until 1am (gameMinutes >= 60)
    // All other nights: Heavy starts immediately
    if (this.nightNumber === 3 && this.gameMinutes < 60) return false;
    return true;
  }
  
  // ============================================
  // ENDLESS NIGHT 6 DIFFICULTY SCALING
  // ============================================
  
  /**
   * Get timer reduction for Scout/Soldier/Sniper/Heavy (in ms)
   * -1 second per hour after 6 AM, capped at reasonable minimums
   */
  private getEndlessTimerReduction(): number {
    if ((!this.isBadEndingNight6 && !this.isNightmareMode) || !this.hasReached6AM) return 0;
    const hours = this.isNightmareMode ? Math.min(this.hoursAfter6AM, 2) : this.hoursAfter6AM;
    return hours * 1000;  // 1 second per hour
  }
  
  /**
   * Get Demoman speed multiplier for endless/nightmare mode
   * Starts at 1.0, increases by 0.1 per hour after 6 AM (1.1x, 1.2x, 1.3x, etc.)
   * Nightmare Mode pre-seeds 2 hours = 1.2x, matching other enemies
   */
  private getDemomanSpeedMultiplier(): number {
    if ((!this.isBadEndingNight6 && !this.isNightmareMode) || !this.hasReached6AM) return 1.0;
    const hours = this.isNightmareMode ? Math.min(this.hoursAfter6AM, 2) : this.hoursAfter6AM;
    return 1.0 + (hours * 0.1);
  }
  
  /**
   * Get Pyro teleport interval reduction for endless mode (in ms)
   * Reduces teleport interval by 500ms per hour after 6 AM
   */
  private getPyroTeleportReduction(): number {
    if ((!this.isBadEndingNight6 && !this.isNightmareMode) || !this.hasReached6AM) return 0;
    const hours = this.isNightmareMode ? Math.min(this.hoursAfter6AM, 3) : this.hoursAfter6AM;
    return hours * 500;  // 0.5 seconds per hour
  }

  /**
   * Reset all game state for a clean start/restart
   */
  private resetGameState(): void {
    this.gameStatus = 'PLAYING';
    this.gameMinutes = 0;
    setGameClock(0, 0);  // Reset log timestamps to 12:00AM
    this.timeAccumulator = 0;
    this.metal = GAME_CONSTANTS.START_METAL;
    this.isCameraMode = false;
    this.isCameraBooting = false;
    this.cameraBootTimer = 0;
    this.selectedCamera = 0;
    this.wasWrangledBeforeCamera = false;
    this.isPaused = false;
    this.audio.isPlayingDetectionSound = false;
    this.wranglerCooldown = 0;
    
    // Reset native key states
    this.keyADown = false;
    this.keyDDown = false;
    
    // Reset sentry state
    this.sentry = {
      exists: true,
      level: 1,
      hp: SENTRY_MAX_HP[1],
      maxHp: SENTRY_MAX_HP[1],
      isWrangled: false,
      aimedDoor: 'NONE',
    };
    
    // Reset teleporter state (Night 3+)
    this.isTeleported = false;
    this.currentRoom = 'INTEL';
    this.activeLure = null;
    this.teleportEscapeTimer = 0;
    this.enemyApproachingRoom = false;
    this.approachingEnemyType = 'an enemy';
    
    // Cancel any teleport animation left over from a mid-animation restart
    if (this.teleportAnimationCallback) {
      this.teleportAnimationCallback.remove();
      this.teleportAnimationCallback = null;
    }
    this.teleportAnimationOverlay = null;  // Scene restart destroys the old display list
    this.isTeleportAnimating = false;
    this.pendingTeleportDestination = null;
    
    // Stop any playing sounds
    this.audio.stopDetectionSound();
    this.audio.stopDemoEyeGlowSound();
    this.audio.stopSniperLaserHum();
    this.audio.stopSapperSound();
    this.audio.stopDispenserHum();
    this.audio.stopPyroHallwayHiss(true);
    this.audio.disposeIntelRoomAmbience();
    
    // Reset Engineer recording state
    this.recordingStartTimer = 0;
    this.hasPlayedRecording = false;
    this.isRecordingPlaying = false;
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio = null;
    }
    // Respect main menu "Audio logs" toggle (default on)
    this.audioLogsEnabled = localStorage.getItem('audioLogsEnabled') !== 'false';
    if (!this.audioLogsEnabled) this.hasPlayedRecording = true; // Skip recording this night
    
    // Reset sapper state for Night 5
    this.sapperRemoveClicks = 0;
    this.sapperRemoveTimeout = 0;
    
    // Reset endless Night 6 state (Day 7 when first 6 AM is reached)
    this.endlessDay = 7;
    // Nightmare Mode pre-seeds difficulty to 8 AM equivalent (hoursAfter6AM = 2)
    this.hoursAfter6AM = this.isNightmareMode ? 2 : 0;
    this.hasReached6AM = this.isNightmareMode ? true : false;
    this.endlessSurvivalMinutes = 0;
    this.medicGhostActive = false;
    this.medicGhostSide = null;
    this.medicGhostTimer = 0;
    this.medicGhostCooldown = 0;

    this.clearMerasmusMirrorDomAndFlags();
  }
  
  /**
   * Cleanup when scene shuts down
   */
  private cleanup(): void {
    this.uninstallMerasmusPointerMirrorFix();
    this.clearMerasmusMirrorDomAndFlags();
    this.stopRecording();
    // Stops every Web Audio sound (incl. Pyro crackling timeouts and the Medic
    // ghost scream's separate AudioContext) and closes the shared context
    this.audio.stopAllGameSounds();
    this.removeDomKeyListeners();
    this.events.off('scoutAtDoor');
    this.events.off('soldierAtDoor');
    this.events.off('soldierRocket');
    this.events.off('demomanAtDoor');
    this.events.off('demomanChargeStart');
    this.events.off('heavyAtDoor');
    this.events.off('sniperHeadshot');
  }

  /** Remove the native window key listeners registered by setupInput() */
  private removeDomKeyListeners(): void {
    if (this.domKeyDownHandler) {
      window.removeEventListener('keydown', this.domKeyDownHandler);
      this.domKeyDownHandler = null;
    }
    if (this.domKeyUpHandler) {
      window.removeEventListener('keyup', this.domKeyUpHandler);
      this.domKeyUpHandler = null;
    }
    if (this.domBlurHandler) {
      window.removeEventListener('blur', this.domBlurHandler);
      this.domBlurHandler = null;
    }
  }
  
  /**
   * Return to title: stop gameplay HTMLAudio (intel room loop) and Web Audio before switching scenes,
   * so ambience cannot keep playing over BootScene.
   */
  private goToMainMenu(): void {
    this.isPaused = false;
    this.pauseMenu?.setVisible(false);
    this.physics?.resume();
    this.stopRecording();
    this.audio.stopAllGameSounds();
    this.scene.start('BootScene');
  }
  
  create(): void {
    // Read mode flags from scene data BEFORE resetGameState so pre-seeding works correctly
    const earlyData = this.scene.settings.data as { isNightmareMode?: boolean; isBadEndingNight6?: boolean } | undefined;
    this.isNightmareMode = earlyData?.isNightmareMode ?? false;
    this.isBadEndingNight6 = earlyData?.isBadEndingNight6 ?? false;
    
    // Reset all state for clean restart
    this.resetGameState();
    
    this.cameras.main.fadeIn(500, 0, 0, 0);
    
    // Get night number and custom config from scene data
    const data = this.scene.settings.data as { 
      night?: number; 
      customEnemies?: {
        scout: boolean;
        soldier: boolean;
        demoman: boolean;
        heavy: boolean;
        sniper: boolean;
        spy: boolean;
        pyro: boolean;
        medic?: boolean;
        administrator?: boolean;
        pauling?: boolean;
        merasmus?: boolean;
      };
      isBadEndingNight6?: boolean;
      isCustomNight?: boolean;
      isNightmareMode?: boolean;
      previewEnding?: 'good' | 'badIntro' | 'dark';  // For endings preview
    } | undefined;
    
    // Handle endings preview mode
    if (data?.previewEnding) {
      this.gameStatus = 'WON';  // Prevent game from running
      this.createEndScreen();
      
      // Show the requested ending
      if (data.previewEnding === 'good') {
        this.showGoodEnding();
      } else if (data.previewEnding === 'badIntro') {
        this.showBadEndingIntro();
      } else if (data.previewEnding === 'dark') {
        // Set up minimal state for dark ending
        this.isBadEndingNight6 = true;
        this.endlessDay = 2;  // Show some survival time
        this.endlessSurvivalMinutes = 359;  // 5 hours 59 minutes - so close to freedom
        this.endScreen.removeAll(true);
        this.endScreen.setVisible(true);
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
        this.endScreen.add(overlay);
        this.showEndlessDarkEnding('Preview mode');
      }
      return;  // Skip normal game initialization
    }
    
    this.nightNumber = data?.night ?? 1;
    this.isBadEndingNight6 = data?.isBadEndingNight6 ?? false;
    this.isCustomNightMode = data?.isCustomNight ?? false;
    this.isNightmareMode = data?.isNightmareMode ?? false;
    this.sessionDestructions = 0;  // Reset for this session
    
    // For custom night (night 7), bad ending night 6, or nightmare mode (night 8), use the enemy toggles
    const isCustomNight = this.nightNumber === 7 || this.nightNumber === 8 || this.isBadEndingNight6 || (this.nightNumber === 6 && !this.isBadEndingNight6);
    
    // Display night number (7 shows as "Custom", 8 shows as "Nightmare")
    const displayNightNumber = this.nightNumber === 7 ? 'Custom' : this.nightNumber === 8 ? 'Nightmare' : this.nightNumber;
    const customEnemies = {
      scout: true, soldier: true, demoman: true, 
      heavy: true, sniper: true, spy: true, pyro: false, medic: false, administrator: false, pauling: false, merasmus: false,
      ...data?.customEnemies,  // Override with passed values (backward compatible)
    };
    
    console.log(`🌙 Starting Night ${this.nightNumber}${isCustomNight ? ' (Custom)' : ''}${this.isNightmareMode ? ' [NIGHTMARE]' : ''}`);
    if (isCustomNight) {
      console.log('Custom enemies:', JSON.stringify(customEnemies, null, 2));
      console.log(`Scout: ${customEnemies.scout}, Soldier: ${customEnemies.soldier}, Demo: ${customEnemies.demoman}, Heavy: ${customEnemies.heavy}, Sniper: ${customEnemies.sniper}, Spy: ${customEnemies.spy}, Pyro: ${customEnemies.pyro}`);
    }
    
    // Initialize enemies - all are created but may be disabled
    this.scout = new ScoutEnemy(this);
    this.soldier = new SoldierEnemy(this);
    this.demoman = new DemomanEnemy(this);
    this.heavy = new HeavyEnemy(this);
    this.sniper = new SniperEnemy(this);
    
    // For custom night, immediately despawn disabled enemies
    if (isCustomNight) {
      if (!customEnemies.scout) this.scout.forceDespawn();
      if (!customEnemies.soldier) this.soldier.forceDespawn();
      if (!customEnemies.demoman) this.demoman.forceDespawn();
      if (!customEnemies.heavy) this.heavy.forceDespawn();
      if (!customEnemies.sniper) this.sniper.forceDespawn();
    }
    
    // Store custom config for use in update loop
    this.customEnemies = isCustomNight ? customEnemies : null;
    
    // Only create Spy on Night 4+ or custom night with spy enabled
    const spyEnabled = isCustomNight ? customEnemies.spy : (this.nightNumber >= 4);
    if (spyEnabled) {
      // In Custom Night, Spy can only disguise as enabled enemies
      // In regular nights, all disguises are available
      let spyDisguises: ('SCOUT' | 'SOLDIER' | 'DEMOMAN_HEAD' | 'HEAVY' | 'SNIPER')[] | undefined;
      if (isCustomNight) {
        spyDisguises = [];
        if (customEnemies.scout) spyDisguises.push('SCOUT');
        if (customEnemies.soldier) spyDisguises.push('SOLDIER');
        if (customEnemies.demoman) spyDisguises.push('DEMOMAN_HEAD');
        if (customEnemies.heavy) spyDisguises.push('HEAVY');
        if (customEnemies.sniper) spyDisguises.push('SNIPER');
        // If empty, Spy will be in sapping-only mode (no camera appearances)
      }
      this.spy = new SpyEnemy(spyDisguises);
      this.spy.setSapDamageCallback((damage) => this.onSpySapDamage(damage));
      this.spy.setDisguiseTargetLocator((disguise) => {
        switch (disguise) {
          case 'SCOUT': return this.scout.currentNode;
          case 'SOLDIER': return this.soldier.currentNode;
          case 'HEAVY': return this.isHeavyEnabled() ? this.heavy.currentNode : null;
          case 'SNIPER': return this.isSniperEnabled() ? this.sniper.currentNode : null;
          case 'DEMOMAN_HEAD': {
            // The head's visible location is headLocation, not currentNode (body position,
            // which goes stale after a charge). INTEL_ROOM isn't a camera node - no conflict.
            if (!this.isDemomanEnabled()) return null;
            const head = this.demoman.headLocation;
            return head === 'INTEL_ROOM' ? null : head;
          }
          default: return null;
        }
      });
    }
    
    // Set up Heavy callbacks for Night 3+ or custom night
    const heavyEnabled = isCustomNight ? customEnemies.heavy : (this.nightNumber >= 3);
    if (heavyEnabled) {
      this.heavy.setDestroyCameraCallback((node) => this.onCameraDestroyed(node, 'HEAVY'));
      this.heavy.setFootstepCallback((volume) => this.audio.playHeavyFootsteps(volume));
    }
    
    // Set up Sniper callbacks for Night 4+ or custom night
    const sniperEnabled = isCustomNight ? customEnemies.sniper : (this.nightNumber >= 4);
    if (sniperEnabled) {
      this.sniper.setChargeCallback((progress) => this.onSniperChargeProgress(progress));
      this.sniper.setTeleportCallback(() => this.audio.playSniperTeleportSound());
    }
    
    // Only create Pyro on Night 5+ or custom night with pyro enabled
    const pyroEnabled = isCustomNight ? customEnemies.pyro : (this.nightNumber >= 5);
    if (pyroEnabled) {
      this.pyro = new PyroEnemy();
      // Set up Pyro callbacks
      this.pyro.setMatchLitCallback(() => this.onPyroMatchLit());
    } else if (isCustomNight && !customEnemies.pyro) {
      // Create but immediately disable Pyro if custom night with pyro disabled
      this.pyro = new PyroEnemy();
      this.pyro.forceDespawn();
    } else if (this.nightNumber < 5) {
      // Regular nights before Night 5: create but disable Pyro
      this.pyro = new PyroEnemy();
      this.pyro.forceDespawn();
    }
    
    // Only create Medic on custom night with medic enabled
    const medicEnabled = isCustomNight ? customEnemies.medic : false;
    this.medic = new MedicEnemy();
    if (medicEnabled) {
      // Determine available targets (only Scout, Soldier, Demoman that are enabled)
      const medicTargets: UberTarget[] = [];
      if (customEnemies.scout) medicTargets.push('SCOUT');
      if (customEnemies.soldier) medicTargets.push('SOLDIER');
      if (customEnemies.demoman) medicTargets.push('DEMOMAN');
      
      if (medicTargets.length > 0) {
        // Set up callback to check if an enemy is valid for Über selection
        // Returns false if enemy is attacking, charging, or at the door
        this.medic.setIsEnemyValidCallback((target) => {
          switch (target) {
            case 'SCOUT':
              // Invalid if Scout is at door (WAITING/ATTACKING) or despawned
              return this.scout.state === 'PATROLLING';
            case 'SOLDIER':
              // Invalid if Soldier is at door (WAITING/ATTACKING/SIEGING) or despawned
              return this.soldier.state === 'PATROLLING';
            case 'DEMOMAN':
              // Invalid if Demoman is charging or at door.
              // Also invalid when >80% built up toward a charge - otherwise he'd get
              // übered and charge seconds later, giving the player no time to react.
              return this.demoman.state === 'DORMANT' && this.demoman.getChargeBuildup() < 0.8;
            default:
              return true;
          }
        });
        
        // Set up callback to play Über charge sound when new target is selected
        this.medic.setTargetChangedCallback((target) => {
          if (target) {
            this.audio.playUberChargeSound();
          }
        });
        this.medic.activate(medicTargets);
      } else {
        // No valid targets - Medic will only appear as a ghost in doorways
        console.log('💉 Medic enabled but no valid targets - ghost mode only!');
        this.medic.activate([]);  // Activate with empty targets for ghost-only mode
      }
    } else {
      this.medic.forceDespawn();
    }

    // Only create Administrator on custom night with administrator enabled
    this.administrator = new AdministratorEnemy();
    // Reset dual-mode tracking fields on each game start
    this.lastTeleportedRoom = null;
    this.administratorNoTeleportTimer = 0;
    this.administratorRepairActive = false;
    if (isCustomNight && customEnemies.administrator) {
      this.administrator.activate();
    } else {
      this.administrator.forceDespawn();
    }
    
    // Only create Pauling on custom night with pauling enabled
    this.pauling = new PaulingEnemy();
    this.ventSealLeft = false;
    this.ventSealRight = false;
    this.thermostat = 0;
    this.thermostatBeepTimer = 0;
    this.isVentCameraMode = false;
    if (isCustomNight && customEnemies.pauling) {
      this.pauling.activate();
    } else {
      this.pauling.forceDespawn();
    }

    // Spy callbacks are now set up when Spy is created above
    
    // Initialize camera states for Night 3+
    this.cameraStates.clear();
    CAMERAS.forEach((cam) => {
      this.cameraStates.set(cam.id, { destroyed: false, destroyedUntil: 0, destroyedBy: null });
    });

    // Initialize hacked room states (Administrator)
    this.hackedRooms.clear();
    (['BRIDGE', 'COURTYARD', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 'LEFT_HALL', 'RIGHT_HALL'] as NodeId[]).forEach((node) => {
      this.hackedRooms.set(node, { hacked: false, repairProgress: 0 });
    });
    
    // Set up enemy event listeners (remove old ones first to prevent duplicates)
    this.events.off('scoutAtDoor');
    this.events.off('soldierAtDoor');
    this.events.off('soldierRocket');
    this.events.off('demomanAtDoor');
    this.events.off('demomanChargeStart');
    this.events.off('heavyAtDoor');
    this.events.off('sniperHeadshot');
    this.events.on('scoutAtDoor', this.onScoutAtDoor, this);
    this.events.on('soldierAtDoor', this.onSoldierAtDoor, this);
    this.events.on('soldierRocket', this.onSoldierRocket, this);
    this.events.on('demomanAtDoor', this.onDemomanAtDoor, this);
    this.events.on('demomanChargeStart', this.onDemomanChargeStart, this);
    this.events.on('heavyAtDoor', this.onHeavyAtDoor, this);
    this.events.on('sniperHeadshot', this.onSniperHeadshot, this);
    
    // Clean up on scene shutdown
    this.events.once('shutdown', this.cleanup, this);
    
    // Check for mobile FIRST (needed for pause menu layout)
    this.isMobile = isMobileDevice();
    
    // Create visuals
    this.createRoom();
    this.createSentry();
    this.createDispenser();
    this.createHUD();
    this.createCameraUI();
    this.createVentUI();
    this.createThermostatUI();
    this.createEndScreen();
    this.createRecordingUI();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.togglePause(),
      onRestart: () => {
        this.audio.stopDetectionSound();
        this.scene.restart();
      },
      onMainMenu: () => this.goToMainMenu(),
      onGiveUp: () => {
        // Player gives up - Pyro jumpscare, then dark ending
        this.isPaused = false;
        this.pauseMenu.setVisible(false);
        this.audio.stopAllGameSounds();
        this.gameStatus = 'LOST';
        
        // Show Pyro jumpscare first!
        this.showGiveUpJumpscare();
      },
    });
    this.pauseMenu.create(this.isBadEndingNight6);
    
    // Set up input
    this.setupInput();
    if (this.isMerasmusEnabled()) {
      this.installMerasmusPointerMirrorFix();
      this.createMerasmusOverlays();
    }
    
    // Create mobile touch controls if on mobile
    if (this.isMobile) {
      this.mobileControls = new MobileControls(this, {
        getGameStatus: () => this.gameStatus,
        isPausedNow: () => this.isPaused,
        isCameraModeNow: () => this.isCameraMode,
        isTeleportedNow: () => this.isTeleported,
        getSentry: () => this.sentry,
        getMetal: () => this.metal,
        isSpySapping: () => !!(this.isSpyEnabled() && this.spy && this.spy.isSapping()),
        isMerasmusEnabled: () => this.isMerasmusEnabled(),
        isMerasmusViewFlipped: () => this.merasmusViewFlipped,
        setAimLeftActive: (active) => this.setMobileAimLeftActive(active),
        setAimRightActive: (active) => this.setMobileAimRightActive(active),
        fireWrangler: () => this.fireWrangler(),
        togglePause: () => this.togglePause(),
        toggleCameraMode: () => this.toggleCameraMode(),
        toggleMerasmusFlip: () => this.toggleMerasmusFlip(),
        handleMobileAction: () => this.handleMobileAction(),
        onWranglerPressed: () => {
          this.sentry.isWrangled = !this.sentry.isWrangled;
          this.audio.playWranglerToggleSound(this.sentry.isWrangled);
          
          // Resume dispenser hum if turning wrangler off (no longer aiming)
          if (!this.sentry.isWrangled && !this.isTeleported) {
            this.sentry.aimedDoor = 'NONE';
            this.audio.startDispenserHum();
          }
          
          this.updateWranglerVisuals();
          this.updateHUD();
          this.mobileControls?.updateWranglerButton();
        },
      });
      this.mobileControls.create();
    }
    
    // Initial HUD update
    this.updateHUD();
    
    // Start ambient dispenser hum in Intel room
    this.audio.startDispenserHum();
    this.audio.startIntelRoomAmbience();
  }
  
  // ============================================
  // VISUAL CREATION
  // ============================================
  
  private createRoom(): void {
    const width = 1280;
    const height = 720;
    
    // Dark room background
    this._roomBackground = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
    
    // Floor
    this.add.rectangle(width / 2, height - 80, width, 160, 0x2d2d44);
    
    // Back wall texture (simple lines)
    const wallGraphics = this.add.graphics();
    wallGraphics.lineStyle(2, 0x252540);
    for (let i = 0; i < width; i += 100) {
      wallGraphics.lineBetween(i, 0, i, height - 160);
    }
    
    // Intel briefcase (center back)
    this.add.rectangle(width / 2, height - 200, 60, 40, 0xcc5500);
    this.add.text(width / 2, height - 200, 'INTEL', {
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5);
    
    // Left doorway
    this._leftDoorFrame = this.add.rectangle(120, height / 2 - 50, 140, 280, 0x0d0d1a);
    this.leftDoor = this.add.rectangle(120, height / 2 - 50, 120, 260, 0x000000);
    this.add.text(120, height / 2 - 180, 'LEFT DOOR', {
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5);
    
    // Right doorway
    this._rightDoorFrame = this.add.rectangle(width - 120, height / 2 - 50, 140, 280, 0x0d0d1a);
    this.rightDoor = this.add.rectangle(width - 120, height / 2 - 50, 120, 260, 0x000000);
    this.add.text(width - 120, height / 2 - 180, 'RIGHT DOOR', {
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5);
    
    // Create enemy visuals for doorways (hidden by default)
    this.createDoorwayEnemies();
  }
  
  private createDoorwayEnemies(): void {
    const height = 720;
    
    // Scout visual (left doorway) - uses full detailed silhouette
    this.scoutInDoorway = this.add.container(120, height / 2 - 30);
    const scoutGraphics = this.add.graphics();
    drawEnemySilhouette(scoutGraphics, 'SCOUT');
    this.scoutInDoorway.add(scoutGraphics);
    this.scoutInDoorway.setVisible(false);
    this.scoutInDoorway.setDepth(10);
    
    // Soldier visual (right doorway) - uses detailed silhouette
    this.soldierInDoorway = this.add.container(1280 - 120, height / 2 - 30);
    const soldierGraphics = this.add.graphics();
    drawEnemySilhouette(soldierGraphics, 'SOLDIER');
    this.soldierInDoorway.add(soldierGraphics);
    this.soldierInDoorway.setVisible(false);
    this.soldierInDoorway.setDepth(10);
    
    // Demoman visual (can appear at either doorway) - headless body with Eyelander
    this.demomanInDoorway = this.add.container(120, height / 2 - 30);
    const demoGraphics = this.add.graphics();
    drawEnemySilhouette(demoGraphics, 'DEMOMAN_BODY');
    this.demomanInDoorway.add(demoGraphics);
    this.demomanInDoorway.setVisible(false);
    this.demomanInDoorway.setDepth(10);
    
    // Demoman approach glow (shown in first half of waiting period)
    this.demomanApproachGlow = this.add.graphics();
    this.demomanApproachGlow.setVisible(false);
    this.demomanApproachGlow.setDepth(9);
    
    // Heavy shadow (massive silhouette behind other doorway enemies — wrangler light only)
    const doorCenterY = height / 2 - 50;
    const doorW = 120;
    const doorH = 260;
    const leftDoorX = 120;
    const rightDoorX = 1280 - 120;

    this.heavyInDoorway = this.add.container(leftDoorX, doorCenterY);
    this.heavyDoorwayGraphics = this.add.graphics();
    drawHeavyDoorwayShadow(this.heavyDoorwayGraphics, false);
    this.heavyInDoorway.add(this.heavyDoorwayGraphics);
    this.heavyInDoorway.setVisible(false);
    this.heavyInDoorway.setDepth(7); // Behind Scout/Soldier/Demo (10) and glows (9)
    this.heavyInDoorway.setScale(1.4);

    // Clip Heavy to doorway opening — keeps mass inside door frame
    this.heavyDoorwayMaskLeft = this.add.graphics();
    this.heavyDoorwayMaskLeft.fillStyle(0xffffff);
    this.heavyDoorwayMaskLeft.fillRect(leftDoorX - doorW / 2, doorCenterY - doorH / 2, doorW, doorH);
    this.heavyDoorwayMaskLeft.setVisible(false);
    this.heavyDoorwayLeftMask = this.heavyDoorwayMaskLeft.createGeometryMask();

    this.heavyDoorwayMaskRight = this.add.graphics();
    this.heavyDoorwayMaskRight.fillStyle(0xffffff);
    this.heavyDoorwayMaskRight.fillRect(rightDoorX - doorW / 2, doorCenterY - doorH / 2, doorW, doorH);
    this.heavyDoorwayMaskRight.setVisible(false);
    this.heavyDoorwayRightMask = this.heavyDoorwayMaskRight.createGeometryMask();
    
    // Über glow effects for Medic (Custom Night)
    // These create a pulsing red aura around Übered enemies
    this.uberGlowLeft = this.add.graphics();
    this.uberGlowLeft.setVisible(false);
    this.uberGlowLeft.setDepth(9);
    
    this.uberGlowRight = this.add.graphics();
    this.uberGlowRight.setVisible(false);
    this.uberGlowRight.setDepth(9);
    
    // Medic ghost apparition (Endless Night 6 and Nightmare Mode - psychological horror)
    // Appears randomly in doorways when Medic isn't ubering, totally harmless
    this.medicGhostVisual = this.add.container(120, height / 2 - 30);
    const medicGhostGraphics = this.add.graphics();
    drawMedicGhostSilhouette(medicGhostGraphics);
    this.medicGhostVisual.add(medicGhostGraphics);
    this.medicGhostVisual.setVisible(false);
    this.medicGhostVisual.setAlpha(0.35);  // Translucent - ghostly
    this.medicGhostVisual.setDepth(8);  // Behind real enemies
    
    // Demoman's severed head (appears in Intel room or on cameras)
    this.demomanHeadInRoom = this.add.container(200, height - 300);
    const headGraphics = this.add.graphics();
    // Head shape - round with beard (dark skin)
    headGraphics.fillStyle(0x3a2a1a, 1);
    headGraphics.fillCircle(0, 0, 25);
    // Beanie on top of head
    headGraphics.fillStyle(0x1a1a2a, 1);
    headGraphics.beginPath();
    headGraphics.arc(0, -5, 27, Math.PI, 0, false);
    headGraphics.closePath();
    headGraphics.fillPath();
    // Beanie fold/rim
    headGraphics.fillStyle(0x2a2a3a, 1);
    headGraphics.fillRect(-27, -7, 54, 6);
    // Beard
    headGraphics.fillStyle(0x1a1a1a, 1);
    headGraphics.fillEllipse(0, 20, 30, 20);
    // Eyepatch (right eye covered)
    headGraphics.fillStyle(0x111111, 1);
    headGraphics.fillCircle(10, -5, 10);
    headGraphics.fillRect(10, -25, 5, 20);
    // Left eye socket (empty/dark)
    headGraphics.fillStyle(0x000000, 1);
    headGraphics.fillCircle(-10, -5, 8);
    
    // Eye glow effect (for when eye lights up)
    this.demomanHeadEyeGlow = this.add.graphics();
    this.demomanHeadInRoom.add([headGraphics, this.demomanHeadEyeGlow]);
    this.demomanHeadInRoom.setVisible(false);
    this.demomanHeadInRoom.setDepth(15); // Above other elements
    
    // Create sniper laser visuals (Night 4+) - visible even without wrangler!
    this.createSniperLasers();
    
    // Create sniper charge overlay (shows when sniper is charging headshot)
    this.sniperChargeOverlay = this.add.rectangle(640, 360, 1280, 720, 0x3366ff, 0);
    this.sniperChargeOverlay.setDepth(150);
    this.sniperChargeOverlay.setVisible(false)
    
    // Add pulsing animation for the head's ghostly glow
    this.tweens.add({
      targets: this.demomanHeadInRoom,
      alpha: 0.7,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
  }
  
  /**
   * Create sniper visor glow visuals (Night 4+)
   * Bright red visor-shaped glow at eye level in the doorway with large light radius
   */
  private createSniperLasers(): void {
    // Eye level position (where sniper's visor would be)
    const eyeLevelY = 280;
    
    // Left door - Sniper visor glow centered in doorway
    const leftDoorX = 120; // Centered in left doorway
    this.sniperLaserLeft = this.add.container(leftDoorX, eyeLevelY);
    
    // Large atmospheric light radius - BRIGHT and BIG
    const glowLeft = this.add.graphics();
    // Very large outer glow - massive light radius
    glowLeft.fillStyle(0xaa2200, 0.08);
    glowLeft.fillCircle(0, 0, 220);
    glowLeft.fillStyle(0xcc3300, 0.12);
    glowLeft.fillCircle(0, 0, 160);
    glowLeft.fillStyle(0xdd4400, 0.18);
    glowLeft.fillCircle(0, 0, 100);
    glowLeft.fillStyle(0xee5500, 0.25);
    glowLeft.fillCircle(0, 0, 60);
    // Medium glow - starting to get visor shaped
    glowLeft.fillStyle(0xff4444, 0.35);
    glowLeft.fillEllipse(0, 0, 90, 40);
    // Inner bright glow - visor shape
    glowLeft.fillStyle(0xff6644, 0.5);
    glowLeft.fillEllipse(0, 0, 65, 20);
    // Bright core - the visor itself
    glowLeft.fillStyle(0xff8866, 0.9);
    glowLeft.fillRoundedRect(-35, -8, 70, 16, 8);
    // White-hot center line
    glowLeft.fillStyle(0xffffff, 1);
    glowLeft.fillRoundedRect(-25, -4, 50, 8, 4);
    
    this.sniperLaserLeft.add([glowLeft]);
    this.sniperLaserLeft.setVisible(false);
    this.sniperLaserLeft.setDepth(12);
    
    // Pulsing animation for left visor glow
    this.tweens.add({
      targets: glowLeft,
      alpha: 0.6,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // Right door - Sniper visor glow centered in doorway
    const rightDoorX = 1280 - 120; // Centered in right doorway
    this.sniperLaserRight = this.add.container(rightDoorX, eyeLevelY);
    
    // Large atmospheric light radius - BRIGHT and BIG
    const glowRight = this.add.graphics();
    glowRight.fillStyle(0xaa2200, 0.08);
    glowRight.fillCircle(0, 0, 220);
    glowRight.fillStyle(0xcc3300, 0.12);
    glowRight.fillCircle(0, 0, 160);
    glowRight.fillStyle(0xdd4400, 0.18);
    glowRight.fillCircle(0, 0, 100);
    glowRight.fillStyle(0xee5500, 0.25);
    glowRight.fillCircle(0, 0, 60);
    glowRight.fillStyle(0xff4444, 0.35);
    glowRight.fillEllipse(0, 0, 90, 40);
    glowRight.fillStyle(0xff6644, 0.5);
    glowRight.fillEllipse(0, 0, 65, 20);
    glowRight.fillStyle(0xff8866, 0.9);
    glowRight.fillRoundedRect(-35, -8, 70, 16, 8);
    glowRight.fillStyle(0xffffff, 1);
    glowRight.fillRoundedRect(-25, -4, 50, 8, 4);
    
    this.sniperLaserRight.add([glowRight]);
    this.sniperLaserRight.setVisible(false);
    this.sniperLaserRight.setDepth(12);
    
    // Pulsing animation for right visor glow
    this.tweens.add({
      targets: glowRight,
      alpha: 0.6,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // Charge countdown text (appears when sniper is charging)
    this.sniperChargeText = this.add.text(640, 150, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#ff0000',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 15, y: 8 },
    }).setOrigin(0.5);
    this.sniperChargeText.setVisible(false);
    this.sniperChargeText.setDepth(100);
    
    // Create Pyro floating mask visuals (Custom Night only)
    this.createPyroMaskVisuals(eyeLevelY);
  }
  
  /**
   * Create floating Pyro mask visuals for hallways (Custom Night only)
   * Ghostly gas mask that floats at eye level - visible only with wrangler light
   */
  private createPyroMaskVisuals(eyeLevelY: number): void {
    // Left hallway Pyro mask
    const leftDoorX = 120;
    this.pyroMaskLeft = this.add.container(leftDoorX, eyeLevelY);
    
    // Eerie orange/red glow behind mask
    const glowLeft = this.add.graphics();
    glowLeft.fillStyle(0xff4400, 0.06);
    glowLeft.fillCircle(0, 0, 180);
    glowLeft.fillStyle(0xff6600, 0.1);
    glowLeft.fillCircle(0, 0, 120);
    glowLeft.fillStyle(0xff8800, 0.15);
    glowLeft.fillCircle(0, 0, 80);
    
    // Gas mask shape - simple iconic silhouette
    const maskLeft = this.add.graphics();
    // Main mask oval
    maskLeft.fillStyle(0x222222, 0.9);
    maskLeft.fillEllipse(0, 0, 70, 80);
    // Eye holes - glowing white/orange
    maskLeft.fillStyle(0xffffff, 0.95);
    maskLeft.fillCircle(-15, -10, 12);
    maskLeft.fillCircle(15, -10, 12);
    // Inner eye glow
    maskLeft.fillStyle(0xff6600, 0.8);
    maskLeft.fillCircle(-15, -10, 6);
    maskLeft.fillCircle(15, -10, 6);
    // Filter canister
    maskLeft.fillStyle(0x333333, 0.9);
    maskLeft.fillRoundedRect(-15, 15, 30, 25, 5);
    // Straps hint
    maskLeft.lineStyle(3, 0x444444, 0.7);
    maskLeft.lineBetween(-35, -5, -45, -20);
    maskLeft.lineBetween(35, -5, 45, -20);
    
    // White burn overlay (appears when player shines light on Pyro)
    this.pyroMaskLeftBurn = this.add.graphics();
    this.pyroMaskLeftBurn.fillStyle(0xffffff, 1);
    this.pyroMaskLeftBurn.fillEllipse(0, 0, 75, 85);
    this.pyroMaskLeftBurn.fillCircle(-15, -10, 14);
    this.pyroMaskLeftBurn.fillCircle(15, -10, 14);
    this.pyroMaskLeftBurn.fillRoundedRect(-18, 12, 36, 30, 6);
    this.pyroMaskLeftBurn.setAlpha(0);
    
    this.pyroMaskLeft.add([glowLeft, maskLeft, this.pyroMaskLeftBurn]);
    this.pyroMaskLeft.setVisible(false);
    this.pyroMaskLeft.setDepth(11);
    
    // Creepy floating animation
    this.tweens.add({
      targets: this.pyroMaskLeft,
      y: eyeLevelY - 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // Right hallway Pyro mask
    const rightDoorX = 1280 - 120;
    this.pyroMaskRight = this.add.container(rightDoorX, eyeLevelY);
    
    // Eerie orange/red glow behind mask
    const glowRight = this.add.graphics();
    glowRight.fillStyle(0xff4400, 0.06);
    glowRight.fillCircle(0, 0, 180);
    glowRight.fillStyle(0xff6600, 0.1);
    glowRight.fillCircle(0, 0, 120);
    glowRight.fillStyle(0xff8800, 0.15);
    glowRight.fillCircle(0, 0, 80);
    
    // Gas mask shape - simple iconic silhouette
    const maskRight = this.add.graphics();
    maskRight.fillStyle(0x222222, 0.9);
    maskRight.fillEllipse(0, 0, 70, 80);
    maskRight.fillStyle(0xffffff, 0.95);
    maskRight.fillCircle(-15, -10, 12);
    maskRight.fillCircle(15, -10, 12);
    maskRight.fillStyle(0xff6600, 0.8);
    maskRight.fillCircle(-15, -10, 6);
    maskRight.fillCircle(15, -10, 6);
    maskRight.fillStyle(0x333333, 0.9);
    maskRight.fillRoundedRect(-15, 15, 30, 25, 5);
    maskRight.lineStyle(3, 0x444444, 0.7);
    maskRight.lineBetween(-35, -5, -45, -20);
    maskRight.lineBetween(35, -5, 45, -20);
    
    // White burn overlay (appears when player shines light on Pyro)
    this.pyroMaskRightBurn = this.add.graphics();
    this.pyroMaskRightBurn.fillStyle(0xffffff, 1);
    this.pyroMaskRightBurn.fillEllipse(0, 0, 75, 85);
    this.pyroMaskRightBurn.fillCircle(-15, -10, 14);
    this.pyroMaskRightBurn.fillCircle(15, -10, 14);
    this.pyroMaskRightBurn.fillRoundedRect(-18, 12, 36, 30, 6);
    this.pyroMaskRightBurn.setAlpha(0);
    
    this.pyroMaskRight.add([glowRight, maskRight, this.pyroMaskRightBurn]);
    this.pyroMaskRight.setVisible(false);
    this.pyroMaskRight.setDepth(11);
    
    // Creepy floating animation
    this.tweens.add({
      targets: this.pyroMaskRight,
      y: eyeLevelY - 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  
  private createSentry(): void {
    const width = 1280;
    const height = 720;
    
    // Sentry container
    this.sentryGraphic = this.add.container(width / 2, height - 220);
    
    // Sentry base/body - RED team
    this.sentryBody = this.add.rectangle(0, 0, 60, 80, 0xBB4444);
    this.sentryBody.setStrokeStyle(3, 0xCC4444);
    
    // Sentry gun barrel
    this.sentryGun = this.add.rectangle(0, -50, 20, 40, 0x555555);
    
    // Level indicator
    const levelBadge = this.add.rectangle(0, 30, 30, 20, 0xff6600);
    const levelText = this.add.text(0, 30, 'L1', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.sentryGraphic.add([this.sentryBody, this.sentryGun, levelBadge, levelText]);
    
    // Make sentry body interactive for mobile tap-to-fire
    this.sentryBody.setInteractive({ useHandCursor: true });
    this.sentryBody.on('pointerdown', () => {
      // Only fire on mobile when wrangled and aimed at a door
      if (!this.isMobile) return;
      if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isCameraMode) return;
      if (!this.sentry.exists || !this.sentry.isWrangled) return;
      if (this.sentry.aimedDoor === 'NONE') return;
      this.fireWrangler();
    });
    
    // Aim beam (for wrangler)
    this.aimBeam = this.add.graphics();
    this.aimBeam.setVisible(false);
    
    // Sapper indicator (Night 5+)
    this.createSapperIndicator();
  }
  
  /**
   * Create sapper visual indicator for Night 5+
   */
  private createSapperIndicator(): void {
    const width = 1280;
    const height = 720;
    
    this.sapperIndicator = this.add.container(width / 2, height - 260);
    
    // Sapper device (red box attached to sentry)
    const sapperBody = this.add.rectangle(35, 20, 25, 18, 0xcc2222);
    sapperBody.setStrokeStyle(2, 0xff4444);
    
    // Blinking light on sapper
    const sapperLight = this.add.circle(35, 12, 4, 0xff0000);
    
    // Electrical arcs (animated sparks)
    const sparks = this.add.graphics();
    sparks.lineStyle(2, 0xffff00, 0.8);
    sparks.lineBetween(-10, -30, 10, -20);
    sparks.lineBetween(5, -35, 20, -25);
    sparks.lineBetween(-20, -25, -5, -35);
    
    // BIG SHAKING instruction above sapper - "TAP" on mobile, "SPACE" on desktop
    const instructionText = this.isMobile ? 'TAP' : 'SPACE';
    const spaceText = this.add.text(0, -80, instructionText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '42px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Make it tappable on mobile - large tap target covering sentry area
    if (this.isMobile) {
      // Tap zone covers from above "TAP" text down to below sentry
      // Container is at (width/2, height-260), sentry is at (width/2, height-220)
      // So sentry is 40px below this container - extend tap zone to cover it
      const tapZone = this.add.rectangle(0, 20, 200, 200, 0x000000, 0);
      tapZone.setInteractive({ useHandCursor: true });
      tapZone.on('pointerdown', () => {
        if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
        if (!this.isSpyEnabled() || !this.spy || !this.spy.isSapping() || this.isTeleported) return;
        
        this.sapperRemoveClicks++;
        this.sapperRemoveTimeout = 2000;
        
        if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
          this.spy.removeSapper();
          this.sapperIndicator.setVisible(false);
          this.audio.stopSapperSound();
          this.showAlert('SAPPER REMOVED!', 0x00ff00);
          this.sapperRemoveClicks = 0;
          this.audio.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
          this.audio.playSound('fire');
        }
      });
      this.sapperIndicator.add(tapZone);
    }
    
    this.sapperIndicator.add([sapperBody, sapperLight, sparks, spaceText]);
    this.sapperIndicator.setVisible(false);
    this.sapperIndicator.setDepth(15);
    
    // Animate the sapper (blinking light and sparks)
    this.tweens.add({
      targets: sapperLight,
      alpha: 0.3,
      duration: 200,
      yoyo: true,
      repeat: -1,
    });
    
    // Animate sparks visibility
    this.tweens.add({
      targets: sparks,
      alpha: 0,
      duration: 150,
      yoyo: true,
      repeat: -1,
    });
    
    // Shake instruction text violently
    this.tweens.add({
      targets: spaceText,
      x: -3,
      duration: 40,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: spaceText,
      y: -85,
      duration: 35,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  
  private createDispenser(): void {
    const height = 720;
    const dispX = 280;
    const dispY = height - 180;
    
    // Dispenser base (bottom left area)
    this.dispenserGraphic = this.add.rectangle(dispX, dispY, 50, 70, 0xBB4444);
    this.dispenserGraphic.setStrokeStyle(2, 0xCC4444);
    
    // Dispenser top cap
    this.add.rectangle(dispX, dispY - 40, 40, 10, 0xDD6666);
    
    // Dispenser screen (dark red tint for RED team)
    const screen = this.add.rectangle(dispX, dispY - 15, 30, 20, 0x331111);
    screen.setStrokeStyle(1, 0xaa4444);
    
    // Metal flow indicator (animated)
    const metalFlow = this.add.graphics();
    this.add.existing(metalFlow);
    
    // Animate metal particles flowing from dispenser
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
        
        // Check if wrangler is blocking metal generation
        const isUsingLight = this.sentry.isWrangled && this.sentry.aimedDoor !== 'NONE';
        if (isUsingLight) return;
        
        // Don't show particles if teleported away from dispenser
        if (this.isTeleported) return;
        
        // Create metal particle
        const particle = this.add.circle(
          dispX + Phaser.Math.Between(-15, 15),
          dispY + 35,
          3,
          0xffcc00
        );
        particle.setDepth(5);  // Below camera UI (which is at depth 100)
        
        // Animate particle floating up and fading
        this.tweens.add({
          targets: particle,
          y: dispY - 20,
          alpha: 0,
          scale: 0.3,
          duration: 800,
          ease: 'Power1',
          onComplete: () => particle.destroy()
        });
      }
    });
    
    this.add.text(dispX, height - 130, 'DISPENSER', {
      fontSize: '10px',
      color: '#ffaaaa',
    }).setOrigin(0.5);
    
    // Animated glow effect
    this.tweens.add({
      targets: this.dispenserGraphic,
      alpha: 0.7,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    // Screen is now static (no flashing)
  }
  
  private createHUD(): void {
    const padding = 20;
    
    // Time display (top center) - RED team color
    this.timeText = this.add.text(640, padding, '00:00', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    
    // Metal display (top left) - always visible on top
    this.metalText = this.add.text(padding, padding, 'METAL: 0/200', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#aabbcc',
    });
    this.metalText.setDepth(200); // Always on top, even in camera/teleport views
    
    // Sentry status (top left, below metal)
    this.sentryText = this.add.text(padding, padding + 35, 'SENTRY: L3 | HP: 216/216', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#88ff88',
    });
    
    // Wrangler status (top left, below sentry)
    this.wranglerText = this.add.text(padding, padding + 60, 'WRANGLER: OFF | AIM: LEFT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff8888',
    });
    
    // Controls hint (bottom)
    const controlsLine = this.isMerasmusEnabled()
      ? 'F: Wrangler | A/D: Aim | SPACE: Fire | TAB: Cameras | R: Build/Repair | Q: Flip View'
      : 'F: Wrangler | HOLD A/D: Aim Left/Right | SPACE: Fire | TAB: Cameras | R: Build/Repair/Upgrade';
    this._controlsText = this.add.text(640, 700, controlsLine, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5, 1);
    
    // Alert container (center, for warnings) - with background for visibility
    this.alertContainer = this.add.container(640, 120);
    this.alertContainer.setDepth(200); // Above everything including room view UI
    this.alertContainer.setVisible(false);
    
    // Dark background with colored border
    this.alertBg = this.add.rectangle(0, 0, 500, 50, 0x000000, 0.85);
    this.alertBg.setStrokeStyle(3, 0xff0000);
    this.alertContainer.add(this.alertBg);
    
    // Alert text
    this.alertText = this.add.text(0, 0, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.alertContainer.add(this.alertText);
    
    // Lure duration bar (to the right of metal count, top left area)
    this.lureBarContainer = this.add.container(280, 32);
    this.lureBarContainer.setDepth(200); // Same depth as HUD
    
    const lureBarBg = this.add.rectangle(0, 0, 120, 24, 0x222222, 0.9);
    lureBarBg.setStrokeStyle(2, 0xffaa00);
    
    this.lureBarFill = this.add.rectangle(-60 + 1, 0, 118, 20, 0xff8800);
    this.lureBarFill.setOrigin(0, 0.5);
    
    this.lureBarText = this.add.text(0, 0, 'LURE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.lureBarContainer.add([lureBarBg, this.lureBarFill, this.lureBarText]);
    this.lureBarContainer.setVisible(false);
  }
  
  private createCameraUI(): void {
    // Camera UI container (hidden by default)
    this.cameraUI = this.add.container(0, 0);
    this.cameraUI.setVisible(false);
    this.cameraUI.setDepth(100);  // Above game elements
    
    // Dark overlay with vignette effect
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    this.cameraUI.add(overlay);
    
    // ========== CAMERA FEED PANEL (LEFT/CENTER) ==========
    // Outer monitor housing - industrial/military style
    const monitorOuter = this.add.rectangle(420, 340, 580, 500, 0x1a1a22);
    monitorOuter.setStrokeStyle(6, 0x2a2a35);
    this.cameraUI.add(monitorOuter);
    
    // Corner bolts for industrial look
    const boltPositions = [[145, 105], [695, 105], [145, 575], [695, 575]];
    boltPositions.forEach(([x, y]) => {
      const boltOuter = this.add.circle(x, y, 10, 0x333340);
      boltOuter.setStrokeStyle(2, 0x444455);
      this.cameraUI.add(boltOuter);
      const boltInner = this.add.circle(x, y, 4, 0x222230);
      this.cameraUI.add(boltInner);
    });
    
    // Inner bezel with gradient effect
    const monitorBezel = this.add.rectangle(420, 345, 540, 450, 0x0a0a10);
    monitorBezel.setStrokeStyle(4, 0x151520);
    this.cameraUI.add(monitorBezel);
    
    // Screen area with green tint (night vision style)
    this.cameraFeedPanel = this.add.rectangle(420, 350, 510, 410, 0x010804);
    this.cameraFeedPanel.setStrokeStyle(2, 0x003311);
    this.cameraUI.add(this.cameraFeedPanel);
    
    // CRT screen glow effect (green ambient glow around edges)
    const crtGlow = this.add.graphics();
    // Outer glow
    crtGlow.lineStyle(8, 0x003311, 0.3);
    crtGlow.strokeRoundedRect(162, 142, 516, 416, 4);
    crtGlow.lineStyle(4, 0x004422, 0.2);
    crtGlow.strokeRoundedRect(158, 138, 524, 424, 6);
    this.cameraUI.add(crtGlow);
    
    // CRT corner vignette effect - darker and more pronounced
    const vignetteGraphics = this.add.graphics();
    vignetteGraphics.fillStyle(0x000000, 0.7);
    // Top-left corner
    vignetteGraphics.fillTriangle(165, 145, 240, 145, 165, 220);
    // Top-right corner  
    vignetteGraphics.fillTriangle(675, 145, 600, 145, 675, 220);
    // Bottom-left corner
    vignetteGraphics.fillTriangle(165, 555, 240, 555, 165, 480);
    // Bottom-right corner
    vignetteGraphics.fillTriangle(675, 555, 600, 555, 675, 480);
    this.cameraUI.add(vignetteGraphics);
    
    // CRT screen curvature simulation (darker edges)
    const curvature = this.add.graphics();
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
    this.cameraUI.add(curvature);
    
    // Scanline overlay effect - VISIBLE scanlines
    const scanlines = this.add.graphics();
    scanlines.setDepth(103);
    for (let y = 145; y < 555; y += 3) {
      scanlines.lineStyle(1, 0x000000, 0.25);
      scanlines.lineBetween(165, y, 675, y);
    }
    this.cameraUI.add(scanlines);
    
    // Green CRT overlay - visible green tint
    const crtGreenOverlay = this.add.rectangle(420, 350, 510, 410, 0x00ff00, 0.04);
    crtGreenOverlay.setDepth(101);
    this.cameraUI.add(crtGreenOverlay);
    
    // CRT flicker effect (animated green tint that pulses)
    const crtFlicker = this.add.rectangle(420, 350, 510, 410, 0x003311, 0.05);
    crtFlicker.setDepth(104);
    this.cameraUI.add(crtFlicker);
    this.tweens.add({
      targets: crtFlicker,
      alpha: 0.12,
      duration: 80,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
      easeParams: [2],
    });
    
    // Camera feed title bar with styled look
    const titleBarBg = this.add.rectangle(420, 128, 510, 26, 0x001a08);
    titleBarBg.setStrokeStyle(1, 0x003311);
    this.cameraUI.add(titleBarBg);
    
    this.cameraFeedTitle = this.add.text(420, 128, 'CAM 01 - COURTYARD', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#00dd44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraUI.add(this.cameraFeedTitle);
    
    // Static noise effect for camera feed
    this.cameraStaticGraphics = this.add.graphics();
    this.cameraUI.add(this.cameraStaticGraphics);
    
    // Room environment in feed - detailed industrial corridor
    const feedGraphics = this.add.graphics();
    
    // Ceiling with lighting fixture
    feedGraphics.fillStyle(0x080810, 1);
    feedGraphics.beginPath();
    feedGraphics.moveTo(165, 145);
    feedGraphics.lineTo(675, 145);
    feedGraphics.lineTo(600, 190);
    feedGraphics.lineTo(240, 190);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    // Ceiling light fixture (dim green glow)
    feedGraphics.fillStyle(0x112211, 0.8);
    feedGraphics.fillRect(395, 160, 50, 8);
    feedGraphics.fillStyle(0x113311, 0.3);
    feedGraphics.fillRect(380, 168, 80, 25);
    
    // Floor with perspective grid lines
    feedGraphics.fillStyle(0x0a0a14, 1);
    feedGraphics.beginPath();
    feedGraphics.moveTo(165, 555);
    feedGraphics.lineTo(675, 555);
    feedGraphics.lineTo(600, 440);
    feedGraphics.lineTo(240, 440);
    feedGraphics.closePath();
    feedGraphics.fill();
    
    // Floor perspective lines
    feedGraphics.lineStyle(1, 0x151520, 0.4);
    feedGraphics.lineBetween(240, 440, 165, 555);
    feedGraphics.lineBetween(320, 440, 260, 555);
    feedGraphics.lineBetween(420, 440, 420, 555);
    feedGraphics.lineBetween(520, 440, 580, 555);
    feedGraphics.lineBetween(600, 440, 675, 555);
    
    // Back wall with panel texture
    feedGraphics.fillStyle(0x0c0c16, 1);
    feedGraphics.fillRect(240, 190, 360, 250);
    
    // Wall panel lines
    feedGraphics.lineStyle(1, 0x141420, 0.5);
    feedGraphics.lineBetween(300, 190, 300, 440);
    feedGraphics.lineBetween(420, 190, 420, 440);
    feedGraphics.lineBetween(540, 190, 540, 440);
    feedGraphics.lineBetween(240, 280, 600, 280);
    feedGraphics.lineBetween(240, 370, 600, 370);
    
    // Side walls with perspective
    feedGraphics.fillStyle(0x080810, 1);
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
    feedGraphics.fillStyle(0x020204, 1);
    feedGraphics.fillRect(360, 230, 120, 210);
    
    // Door frame
    feedGraphics.lineStyle(2, 0x1a1a28);
    feedGraphics.strokeRect(360, 230, 120, 210);
    
    // Pipes on walls
    feedGraphics.fillStyle(0x181825, 1);
    feedGraphics.fillRect(248, 200, 8, 235);
    feedGraphics.fillRect(584, 200, 8, 235);
    
    this.cameraUI.add(feedGraphics);
    
    // "No activity" text (hidden - doorways just show darkness)
    this.cameraFeedEmpty = this.add.text(420, 350, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#1a4422',
    }).setOrigin(0.5);
    this.cameraFeedEmpty.setVisible(false);  // Never show "CLEAR" text
    this.cameraUI.add(this.cameraFeedEmpty);
    
    // (Removed clear text pulsing - no longer used)
    this.tweens.add({
      targets: this.cameraFeedEmpty,
      alpha: 0.4,
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
    
    // Enemy figure in feed (shown when enemy is at selected camera)
    // Position slightly left to make room for Demo head on right
    this.cameraFeedEnemy = this.add.container(380, 370);
    
    // Create detailed enemy graphics
    const enemyGraphics = this.add.graphics();
    
    // Shadow on ground
    enemyGraphics.fillStyle(0x000000, 0.6);
    enemyGraphics.fillEllipse(0, 90, 120, 30);
    
    // Default silhouette (will be redrawn based on enemy type)
    drawEnemySilhouette(enemyGraphics, 'SCOUT');
    
    // Piercing glowing eyes (on face level, not above head)
    this.cameraFeedEnemyEyeGlow = this.add.graphics();
    this.cameraFeedEnemyEyeGlow.fillStyle(0xff0000, 0.3);
    this.cameraFeedEnemyEyeGlow.fillCircle(-12, -55, 18);
    this.cameraFeedEnemyEyeGlow.fillCircle(12, -55, 18);
    this.cameraFeedEnemyEyeGlow.fillStyle(0xff0000, 1);
    this.cameraFeedEnemyEyeGlow.fillCircle(-12, -55, 7);
    this.cameraFeedEnemyEyeGlow.fillCircle(12, -55, 7);
    this.cameraFeedEnemyEyeGlow.fillStyle(0xffffff, 1);
    this.cameraFeedEnemyEyeGlow.fillCircle(-10, -57, 2);
    this.cameraFeedEnemyEyeGlow.fillCircle(14, -57, 2);
    
    // Pulsing eye animation
    this.tweens.add({
      targets: this.cameraFeedEnemyEyeGlow,
      alpha: 0.6,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
    
    const enemyLabel = this.add.text(0, 105, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.cameraFeedEnemy.add([enemyGraphics, this.cameraFeedEnemyEyeGlow, enemyLabel]);
    this.cameraFeedEnemy.setVisible(false);
    this.cameraUI.add(this.cameraFeedEnemy);
    
    // Slight sway animation for creepiness
    this.tweens.add({
      targets: this.cameraFeedEnemy,
      x: 385,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // SECOND enemy slot (for showing multiple enemies)
    this.cameraFeedEnemy2 = this.add.container(480, 370);
    const enemyGraphics2 = this.add.graphics();
    enemyGraphics2.fillStyle(0x000000, 0.6);
    enemyGraphics2.fillEllipse(0, 90, 100, 25);
    const enemyLabel2 = this.add.text(0, 105, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraFeedEnemy2.add([enemyGraphics2, enemyLabel2]);
    this.cameraFeedEnemy2.setVisible(false);
    this.cameraFeedEnemy2.setScale(0.75); // Slightly smaller
    this.cameraUI.add(this.cameraFeedEnemy2);
    
    this.tweens.add({
      targets: this.cameraFeedEnemy2,
      x: 485,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // THIRD enemy slot (for showing multiple enemies)
    this.cameraFeedEnemy3 = this.add.container(570, 380);
    const enemyGraphics3 = this.add.graphics();
    enemyGraphics3.fillStyle(0x000000, 0.6);
    enemyGraphics3.fillEllipse(0, 90, 80, 20);
    const enemyLabel3 = this.add.text(0, 105, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraFeedEnemy3.add([enemyGraphics3, enemyLabel3]);
    this.cameraFeedEnemy3.setVisible(false);
    this.cameraFeedEnemy3.setScale(0.6); // Smaller, in background
    this.cameraUI.add(this.cameraFeedEnemy3);
    
    // SECONDARY DISPLAY: Demoman's head (can appear alongside other enemies)
    this.cameraFeedDemoHead = this.add.container(530, 420);
    const demoHeadGraphics = this.add.graphics();
    // Will be drawn when visible
    const demoHeadLabel = this.add.text(0, 55, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#44ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraFeedDemoHead.add([demoHeadGraphics, demoHeadLabel]);
    this.cameraFeedDemoHead.setVisible(false);
    this.cameraFeedDemoHead.setScale(0.7); // Smaller, off to the side
    this.cameraUI.add(this.cameraFeedDemoHead);
    
    // LURE INDICATOR - shows when a lure is at this camera (placed or playing)
    this.cameraLureIndicator = this.add.container(420, 490);
    const lureBg = this.add.rectangle(0, 0, 180, 28, 0x553300, 0.9);
    lureBg.setStrokeStyle(2, 0xffaa00);
    const lureIcon = this.add.text(-70, 0, '♪', { fontSize: '16px', color: '#ffaa00' }).setOrigin(0.5);
    const lureText = this.add.text(10, 0, 'LURE PLACED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraLureIndicator.add([lureBg, lureIcon, lureText]);
    this.cameraLureIndicator.setVisible(false);
    this.cameraUI.add(this.cameraLureIndicator);
    
    // Pulse the lure indicator when active
    this.tweens.add({
      targets: this.cameraLureIndicator,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    // Recording indicator container - top left of screen
    const recContainer = this.add.container(185, 158);
    const recBg = this.add.rectangle(0, 0, 55, 20, 0x220000, 0.7);
    recBg.setStrokeStyle(1, 0x440000);
    const recDot = this.add.circle(-18, 0, 5, 0xff0000);
    const recText = this.add.text(5, 0, 'REC', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    recContainer.add([recBg, recDot, recText]);
    this.cameraUI.add(recContainer);
    
    // Timestamp - bottom right of screen with background
    const timestampBg = this.add.rectangle(625, 538, 85, 20, 0x001a08, 0.7);
    timestampBg.setStrokeStyle(1, 0x003311);
    this.cameraUI.add(timestampBg);
    
    const timestamp = this.add.text(625, 538, '12:XX AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#00aa44',
    }).setOrigin(0.5);
    this.cameraUI.add(timestamp);
    
    // Update timestamp periodically
    // Update timestamp - only show hour (not minutes) to prevent predicting enemy arrivals
    this.time.addEvent({
      delay: 1000,  // Update every second
      callback: () => {
        if (this.isCameraMode) {
          const hours24 = Math.floor(this.gameMinutes / 60);
          const displayHours = hours24 === 0 ? 12 : hours24;
          timestamp.setText(`${displayHours}:XX AM`); // No padding
        }
      },
      loop: true,
    });
    
    // Blink recording light
    this.tweens.add({
      targets: [recDot, recText],
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    // ========== MAP PANEL (RIGHT SIDE) ==========
    // Outer frame stays visible even in vent mode; inner content hides

    // Metal frame with industrial look - EXPANDED
    const mapOuterFrame = this.add.rectangle(1000, 340, 370, 430, 0x1a1a20);
    mapOuterFrame.setStrokeStyle(3, 0x3a3a44);
    this.cameraUI.add(mapOuterFrame);
    
    // Screws/bolts in corners - adjusted for wider frame
    const screwPositions = [[828, 138], [1172, 138], [828, 542], [1172, 542]];
    screwPositions.forEach(([x, y]) => {
      const screw = this.add.circle(x, y, 5, 0x555566);
      screw.setStrokeStyle(1, 0x777788);
      this.cameraUI.add(screw);
      const screwSlot = this.add.text(x, y, '+', {
        fontSize: '8px',
        color: '#333344',
      }).setOrigin(0.5);
      this.cameraUI.add(screwSlot);
    });
    
    // Screen bezel - WIDER to fit map
    const mapFrame = this.add.rectangle(1000, 340, 355, 400, 0x0a0a0f);
    mapFrame.setStrokeStyle(4, 0x222230);
    this.cameraUI.add(mapFrame);
    
    // Inner screen with slight glow - WIDER
    const mapScreen = this.add.rectangle(1000, 350, 340, 370, 0x050810);
    mapScreen.setStrokeStyle(2, 0x1a3050);
    this.cameraUI.add(mapScreen);
    
    // Title bar for map - WIDER
    const mapTitleBar = this.add.rectangle(1000, 155, 340, 24, 0x0a1525);
    mapTitleBar.setStrokeStyle(1, 0x1a3a55);
    this.cameraUI.add(mapTitleBar);
    
    this.mapTitleText = this.add.text(1000, 155, '◈ FACILITY OVERVIEW ◈', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#5588cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraUI.add(this.mapTitleText);

    // Inner content container (hidden when viewing vents)
    this.cameraMapContent = this.add.container(0, 0);
    this.cameraUI.add(this.cameraMapContent);
    
    // Blueprint grid effect - WIDER
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x0a2035, 0.4);
    for (let x = 830; x <= 1170; x += 15) {
      gridGraphics.lineBetween(x, 170, x, 530);
    }
    for (let y = 170; y <= 530; y += 15) {
      gridGraphics.lineBetween(830, y, 1170, y);
    }
    this.cameraMapContent.add(gridGraphics);
    
    // Draw the map layout with paths - ALIGNED LAYOUT
    const mapGraphics = this.add.graphics();
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
    mapGraphics.lineStyle(2, 0x3388cc, 0.6);
    mapGraphics.lineBetween(staircaseX, staircaseY, courtyardX, courtyardY);
    
    // Staircase to Left Hall (vertical)
    mapGraphics.lineBetween(staircaseX, staircaseY, leftHallX, leftHallY);
    
    // Courtyard to Grate (diagonal connection)
    mapGraphics.lineStyle(2, 0x2266aa, 0.4);
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
    mapGraphics.lineStyle(2, 0x2266aa, 0.5);
    mapGraphics.lineBetween(leftHallX, leftHallY, rightHallX, rightHallY);
    
    // Bottom horizontal row: Right Hall - Spiral - Grate - Bridge (more spaced out)
    mapGraphics.lineStyle(2, 0x3388cc, 0.6);
    mapGraphics.lineBetween(rightHallX, rightHallY, spiralX, spiralY);
    mapGraphics.lineBetween(spiralX, spiralY, grateX, grateY);
    mapGraphics.lineBetween(grateX, grateY, bridgeX, bridgeY);
    
    // Grate to Sewer (vertical down)
    mapGraphics.lineStyle(2, 0x226644, 0.5); // Greenish for sewer
    mapGraphics.lineBetween(grateX, grateY, sewerX, sewerY);
    
    this.cameraMapContent.add(mapGraphics);
    
    // Create clickable camera nodes on the map - cleaner design
    CAMERAS.forEach((cam, index) => {
      const nodeX = mapOffsetX + cam.mapX * mapScale;
      const nodeY = mapOffsetY + cam.mapY * mapScale;
      
      // Outer selection ring (hidden by default)
      // Node glow (square)
      const nodeGlow = this.add.rectangle(nodeX, nodeY, 50, 50, 0x44aaff, 0);
      
      // Node background - square button (larger, easier to click)
      const nodeBg = this.add.rectangle(nodeX, nodeY, 44, 44, 0x0a1830);
      nodeBg.setStrokeStyle(2, 0x2266aa);
      nodeBg.setInteractive({ useHandCursor: true });
      
      // Click to select camera
      nodeBg.on('pointerdown', () => {
        this.selectCamera(index);
      });
      nodeBg.on('pointerover', () => {
        nodeBg.setFillStyle(0x1a3050);
        nodeBg.setStrokeStyle(2, 0x44aaff);
      });
      nodeBg.on('pointerout', () => {
        nodeBg.setFillStyle(0x0a1830);
        nodeBg.setStrokeStyle(2, 0x2266aa);
      });
      
      // Camera number - use cam.id to match the feed title
      const camNum = this.add.text(nodeX, nodeY - 2, `${cam.id}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#66aaee',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      // Camera name below
      const nodeLabel = this.add.text(nodeX, nodeY + 32, cam.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#5588bb',
      }).setOrigin(0.5);
      
      const nodeContainer = this.add.container(0, 0, [nodeGlow, nodeBg, camNum, nodeLabel]);
      this.cameraMapNodes.set(cam.node, nodeContainer);
      this.cameraMapContent.add(nodeContainer);
    });

    // Create hacked room X indicators on the map (hidden by default, shown when Administrator hacks a room)
    CAMERAS.forEach((cam) => {
      const nodeX = mapOffsetX + cam.mapX * mapScale;
      const nodeY = mapOffsetY + cam.mapY * mapScale;
      const hackIndicator = this.add.text(nodeX + 14, nodeY - 14, '✕', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#9944cc',
        fontStyle: 'bold',
      }).setOrigin(0.5).setVisible(false).setDepth(106);
      this.hackedRoomMapIndicators.set(cam.node, hackIndicator);
      this.cameraMapContent.add(hackIndicator);
    });
    
    // Intel Room marker (your position) - directly below Left Hall
    const intelMarkerX = mapOffsetX + 55;   // Same X as Left Hall
    const intelMarkerY = mapOffsetY + 255;  // Below the bottom row, same as Sewer
    
    // Pulsing outer ring
    const intelGlow = this.add.circle(intelMarkerX, intelMarkerY, 26, 0xff6600, 0.15);
    this.cameraMapContent.add(intelGlow);
    
    // Main intel icon
    this.intelRoomIcon = this.add.circle(intelMarkerX, intelMarkerY, 20, 0x331500);
    this.intelRoomIcon.setStrokeStyle(3, 0xff6600);
    this.cameraMapContent.add(this.intelRoomIcon);
    
    // Intel briefcase icon
    const intelIcon = this.add.text(intelMarkerX, intelMarkerY - 2, '◆', {
      fontSize: '16px',
      color: '#ff8800',
    }).setOrigin(0.5);
    this.cameraMapContent.add(intelIcon);
    
    const intelLabel = this.add.text(intelMarkerX, intelMarkerY + 32, 'INTEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      color: '#ff9944',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraMapContent.add(intelLabel);
    
    // Legend at bottom
    const legendY = 505;
    const legendBg = this.add.rectangle(1000, legendY, 250, 30, 0x0a1520, 0.8);
    legendBg.setStrokeStyle(1, 0x1a3050);
    this.cameraMapContent.add(legendBg);
    
    const legendText = this.add.text(1000, legendY, 'CLICK NODE TO VIEW CAMERA', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#4488aa',
    }).setOrigin(0.5);
    this.cameraMapContent.add(legendText);
    
    // Pulsing effect on YOUR position
    this.tweens.add({
      targets: [this.intelRoomIcon, intelGlow],
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
    
    // Status text at bottom of map
    const statusText = this.add.text(1000, 520, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#2a6a3a',
    }).setOrigin(0.5);
    this.cameraMapContent.add(statusText);
    
    // Map icons are NOT added - player must check cameras to find enemies
    // Store references but keep them invisible (for internal use only)
    this.scoutMapIcon = this.add.container(0, 0);
    this.scoutMapIcon.setVisible(false);
    this.soldierMapIcon = this.add.container(0, 0);
    this.soldierMapIcon.setVisible(false);
    
    // Instructions at bottom
    const camInstructions = this.add.text(640, 680, 'TAB TO EXIT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#446644',
    }).setOrigin(0.5);
    this.cameraUI.add(camInstructions);
    
    // Create camera destroyed overlay (Night 3+)
    this.createCameraDestroyedOverlay();

    // Create Administrator hack bar overlay (Custom Night)
    this.createAdministratorHackUI();
    
    // Static burst overlay for camera switching (all nights)
    // Added last in createCameraUI so it renders on top of everything
    this.cameraStaticBurstOverlay = this.add.graphics();
    this.cameraStaticBurstOverlay.setVisible(false);
    this.cameraUI.add(this.cameraStaticBurstOverlay);
    
    // Teleporter UI must be created every run: Phaser reuses this scene instance across
    // scene.start() with different nights; skipping creation on Night 1–2 leaves stale
    // references to Text/Rectangle objects destroyed at shutdown → camera switch crashes.
    // Visibility stays off until Night 3+ (see selectCamera / toggleCameraMode).
    this.createTeleporterUI();
    
    // Initialize with first camera selected
    this.selectedCamera = 0;
  }
  
  /**
   * Create camera destroyed overlay (shown when Heavy destroys camera)
   */
  private createCameraDestroyedOverlay(): void {
    this.cameraDestroyedOverlay = this.add.container(420, 360);
    this.cameraDestroyedOverlay.setVisible(false);
    this.cameraDestroyedOverlay.setDepth(105);
    
    // Static noise background
    const staticBg = this.add.rectangle(0, 0, 520, 420, 0x111111, 0.95);
    this.cameraDestroyedOverlay.add(staticBg);
    
    // Static noise effect
    const staticNoise = this.add.graphics();
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(-250, 250);
      const y = Phaser.Math.Between(-200, 200);
      staticNoise.fillStyle(0xffffff, Math.random() * 0.3);
      staticNoise.fillRect(x, y, 4, 2);
    }
    this.cameraDestroyedOverlay.add(staticNoise);
    
    // Destroyed text
    this.cameraDestroyedText = this.add.text(0, -50, '-- CAMERA OFFLINE --', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#ff3333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraDestroyedOverlay.add(this.cameraDestroyedText);
    
    // Timer text
    const timerText = this.add.text(0, 0, 'AUTO REPAIR: 30s', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.cameraDestroyedOverlay.add(timerText);
    
    // Repair button
    this.cameraRepairButton = this.add.container(0, 60);
    const repairBtnBg = this.add.rectangle(0, 0, 200, 40, 0x224422);
    repairBtnBg.setStrokeStyle(2, 0x44aa44);
    repairBtnBg.setInteractive({ useHandCursor: true });
    
    const repairBtnText = this.add.text(0, 0, 'REPAIR (50 METAL)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#66ff66',
    }).setOrigin(0.5);
    
    this.cameraRepairButton.add([repairBtnBg, repairBtnText]);
    this.cameraDestroyedOverlay.add(this.cameraRepairButton);
    
    repairBtnBg.on('pointerover', () => {
      repairBtnBg.setFillStyle(0x336633);
    });
    repairBtnBg.on('pointerout', () => {
      repairBtnBg.setFillStyle(0x224422);
    });
    repairBtnBg.on('pointerdown', () => {
      this.repairCamera(this.selectedCamera, true);
    });
    
    this.cameraUI.add(this.cameraDestroyedOverlay);
    
    // Camera watch warning overlay - shows when Heavy is about to break camera or Sniper is aiming
    this.cameraWatchWarning = this.add.container(420, 200);
    this.cameraWatchWarning.setVisible(false);
    this.cameraWatchWarning.setDepth(104);
    
    // Warning bar background
    const watchBarBg = this.add.rectangle(0, 0, 300, 20, 0x331111);
    watchBarBg.setStrokeStyle(2, 0xff4444);
    this.cameraWatchWarning.add(watchBarBg);
    
    // Warning bar fill (will be scaled based on progress)
    this.cameraWatchBar = this.add.rectangle(-147, 0, 294, 14, 0xff4444, 0.8);
    this.cameraWatchBar.setOrigin(0, 0.5);
    this.cameraWatchWarning.add(this.cameraWatchBar);
    
    // Warning text
    const watchWarningText = this.add.text(0, -25, 'LOOK AWAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraWatchWarning.add(watchWarningText);
    
    // Add scary shake animation to warning text
    this.tweens.add({
      targets: watchWarningText,
      x: -2,
      duration: 50,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: watchWarningText,
      y: -27,
      duration: 60,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    this.cameraUI.add(this.cameraWatchWarning);
    
    // ========== CAMERA BOOT-UP OVERLAY ==========
    // Shown during the 1-second camera boot delay
    // Must cover the entire camera view INCLUDING the title bar at the top
    // Title bar is at y~128, feed goes from ~145 to ~555
    // So we need to cover from y~110 to y~560, centered at y~335
    this.cameraBootOverlay = this.add.container(420, 335);
    this.cameraBootOverlay.setDepth(110); // Above other camera elements
    
    // Dark boot screen - sized to fully cover the camera screen AND title bar
    // Covers from y=110 to y=560 (height 450) and x=155 to x=685 (width 530)
    const bootScreenBg = this.add.rectangle(0, 0, 530, 460, 0x000803, 1.0);
    bootScreenBg.setStrokeStyle(2, 0x003311);
    this.cameraBootOverlay.add(bootScreenBg);
    
    // Boot-up text title (adjusted for new container position)
    const bootTitle = this.add.text(0, -85, 'CAMERA SYSTEM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#00aa44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add(bootTitle);
    
    // Boot status text (animated)
    const bootStatus = this.add.text(0, -45, 'INITIALIZING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#006622',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add(bootStatus);
    
    // Progress bar background (adjusted for new container position)
    const bootBarBg = this.add.rectangle(0, 15, 300, 20, 0x001108);
    bootBarBg.setStrokeStyle(2, 0x003311);
    this.cameraBootOverlay.add(bootBarBg);
    
    // Progress bar fill (will be animated)
    const bootBarFill = this.add.rectangle(-147, 15, 0, 14, 0x00aa44, 0.8);
    bootBarFill.setOrigin(0, 0.5);
    bootBarFill.setName('bootBarFill');
    this.cameraBootOverlay.add(bootBarFill);
    
    // Boot percentage text
    const bootPercent = this.add.text(0, 50, '0%', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#00aa44',
    }).setOrigin(0.5);
    bootPercent.setName('bootPercent');
    this.cameraBootOverlay.add(bootPercent);
    
    // Scanlines for boot screen (matches camera feed aesthetic)
    const bootScanlines = this.add.graphics();
    for (let y = -230; y < 230; y += 4) {
      bootScanlines.lineStyle(1, 0x000000, 0.3);
      bootScanlines.lineBetween(-265, y, 265, y);
    }
    this.cameraBootOverlay.add(bootScanlines);
    
    // Boot log messages (scrolling up effect, adjusted for new container position)
    const bootLog1 = this.add.text(0, 95, '> Connecting to network...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    const bootLog2 = this.add.text(0, 115, '> Loading camera feeds...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    const bootLog3 = this.add.text(0, 135, '> Calibrating night vision...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add([bootLog1, bootLog2, bootLog3]);
    
    this.cameraBootOverlay.setVisible(false);
    this.cameraUI.add(this.cameraBootOverlay);
  }

  /**
   * Create Administrator hack bar and teleporter repair overlay (Custom Night)
   */
  private createAdministratorHackUI(): void {
    // ---- Hack bar: shown at bottom of camera feed when Administrator is targeting/hacking ----
    // Camera panel is centered at 420,350 and is 510×410 — bottom edge is at y≈555.
    // Place bar near the bottom inside the panel: y=510 (45px from bottom edge).
    this.administratorHackBarContainer = this.add.container(420, 510);
    this.administratorHackBarContainer.setVisible(false);
    this.administratorHackBarContainer.setDepth(104);

    // Semi-transparent backing strip — fully transparent so it doesn't obscure camera feed
    const hackBarBacking = this.add.rectangle(0, 0, 510, 44, 0x000000, 0);
    this.administratorHackBarContainer.add(hackBarBacking);

    // Bar background
    this.administratorHackBarBorder = this.add.rectangle(0, 6, 360, 16, 0x111111);
    this.administratorHackBarBorder.setStrokeStyle(2, 0x555555);
    this.administratorHackBarContainer.add(this.administratorHackBarBorder);

    // Bar fill (scales 0→1 left-to-right)
    this.administratorHackBarFill = this.add.rectangle(-178, 6, 356, 10, 0x444444, 0.7);
    this.administratorHackBarFill.setOrigin(0, 0.5);
    this.administratorHackBarContainer.add(this.administratorHackBarFill);

    // Diagonal cross — drawn over the bar track when empty (TARGETING phase warning)
    this.administratorHackBarCross = this.add.graphics();
    this.administratorHackBarCross.lineStyle(2, 0x553377, 0.8);
    this.administratorHackBarCross.lineBetween(-178, -2, 178, 14);  // top-left → bottom-right
    this.administratorHackBarCross.lineBetween(-178, 14, 178, -2);  // bottom-left → top-right
    this.administratorHackBarContainer.add(this.administratorHackBarCross);

    // Label text (left of bar)
    const hackLabel = this.add.text(-178, -10, 'TELEPORTER HACK', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#bb66ee',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.administratorHackBarContainer.add(hackLabel);

    // Hint text (right of bar)
    const hackHint = this.add.text(178, -10, 'CLICK TO INTERRUPT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#7744aa',
    }).setOrigin(1, 0.5);
    this.administratorHackBarContainer.add(hackHint);

    // Clickable hit area over the whole strip
    const hackHitArea = this.add.rectangle(0, 0, 510, 44, 0x000000, 0);
    hackHitArea.setInteractive({ useHandCursor: true });
    hackHitArea.on('pointerdown', () => {
      if (this.isAdministratorEnabled() && this.administrator && this.administrator.getState() === 'HACKING') {
        this.administrator.interruptHack();
        this.showAlert('Hack interrupted!', 0x00ff88);
      }
    });
    this.administratorHackBarContainer.add(hackHitArea);

    this.cameraUI.add(this.administratorHackBarContainer);

    // ---- Repair bar: embedded in the teleport button (see createTeleporterUI / updateTeleportButtonAppearance) ----
    // The repair overlay is no longer a camera overlay — repair is done via the TELEPORT HERE button.
    // administratorRepairOverlay is kept as a stub so existing references don't crash.
    this.administratorRepairOverlay = this.add.container(0, 0);
    this.administratorRepairOverlay.setVisible(false);
    this.administratorRepairBarFill = this.add.rectangle(0, 0, 0, 0, 0x000000, 0); // invisible stub
  }

  /**
   * Create teleporter UI for Night 3+
   */
  private createTeleporterUI(): void {
    // Teleport button on camera map (shows when viewing a camera)
    this.teleportButton = this.add.container(1000, 570);
    
    this.teleportButtonBg = this.add.rectangle(0, 0, 180, 35, 0x442222);
    this.teleportButtonBg.setStrokeStyle(2, 0xcc4444);
    this.teleportButtonBg.setInteractive({ useHandCursor: true });
    
    this.teleportButtonText = this.add.text(0, 0, 'TELEPORT HERE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#ff8888',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Repair bar (hidden by default, shown when room is hacked)
    this.teleportRepairBarBg = this.add.rectangle(0, 10, 156, 7, 0x150822);
    this.teleportRepairBarBg.setStrokeStyle(1, 0xbb66ee);
    this.teleportRepairBarBg.setVisible(false);

    this.teleportRepairBarFill = this.add.rectangle(-76, 10, 152, 3, 0x00ff88, 0.9);
    this.teleportRepairBarFill.setOrigin(0, 0.5);
    this.teleportRepairBarFill.setScale(0, 1);
    this.teleportRepairBarFill.setVisible(false);
    
    this.teleportButton.add([
      this.teleportButtonBg,
      this.teleportButtonText,
      this.teleportRepairBarBg,
      this.teleportRepairBarFill,
    ]);
    this.teleportButton.setVisible(false);
    this.cameraUI.add(this.teleportButton);
    
    this.teleportButtonBg.on('pointerover', () => {
      if (this.isTeleportAnimating) {
        this.teleportButtonBg.setFillStyle(0x664422);
      } else if (this.isSelectedCameraHacked()) {
        this.teleportButtonBg.setFillStyle(0x222222);
      } else {
        this.teleportButtonBg.setFillStyle(0x663333);
      }
    });
    this.teleportButtonBg.on('pointerout', () => {
      this.administratorRepairActive = false;
      if (this.isTeleportAnimating) {
        this.teleportButtonBg.setFillStyle(0x553311);
      } else if (this.isSelectedCameraHacked()) {
        this.teleportButtonBg.setFillStyle(0x1a1a1a);
      } else {
        this.teleportButtonBg.setFillStyle(0x442222);
      }
    });
    this.teleportButtonBg.on('pointerdown', () => {
      // If teleport animation is in progress, cancel it
      if (this.isTeleportAnimating) {
        this.cancelTeleport();
        return;
      }
      // If room is hacked, start hold-to-repair
      if (this.isSelectedCameraHacked()) {
        this.administratorRepairActive = true;
        this.audio._administratorRepairSoundTimer = 0; // fire first tick immediately
        return;
      }
      const cam = CAMERAS[this.selectedCamera];
      this.teleportToRoom(cam.node);
    });
    this.teleportButtonBg.on('pointerup', () => {
      this.administratorRepairActive = false;
    });
    
    // Camera lure button (play or remove lure from camera view)
    this.cameraLureButton = this.add.container(1000, 520);
    
    const lureBtnBg = this.add.rectangle(0, 0, 180, 35, 0x224444);
    lureBtnBg.setStrokeStyle(2, 0x44aaaa);
    lureBtnBg.setInteractive({ useHandCursor: true });
    
    const lureBtnText = this.add.text(0, 0, 'PLAY LURE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#66ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.cameraLureButton.add([lureBtnBg, lureBtnText]);
    this.cameraLureButton.setVisible(false);
    this.cameraUI.add(this.cameraLureButton);
    
    lureBtnBg.on('pointerover', () => {
      const bg = this.cameraLureButton.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(0x336666);
    });
    lureBtnBg.on('pointerout', () => {
      this.updateCameraLureButtonStyle();
    });
    lureBtnBg.on('pointerdown', () => {
      this.handleCameraLureAction();
    });
    
    // Room view UI (shown when teleported)
    this.createRoomViewUI();
  }
  
  /**
   * Handle camera lure button action (play lure)
   */
  private handleCameraLureAction(): void {
    if (!this.activeLure || !this.activeLure.placed || this.activeLure.playing) return;
    
    // Play the lure
    this.activeLure.playing = true;
    this.activeLure.playTimeRemaining = GAME_CONSTANTS.LURE_DURATION;
    this.showAlert('Lure activated!', 0x00ffff);
    this.audio.playLureSound();
    console.log('Lure activated from camera view at', this.activeLure.node);
    
    this.updateCameraLureButton();
  }
  
  /**
   * Update camera lure button style based on lure state
   */
  private updateCameraLureButtonStyle(): void {
    if (!this.cameraLureButton || !this.activeLure) return;
    
    const btnBg = this.cameraLureButton.list[0] as Phaser.GameObjects.Rectangle;
    const btnText = this.cameraLureButton.list[1] as Phaser.GameObjects.Text;
    
    // Always show play option (button is hidden when lure is playing)
    btnBg.setFillStyle(0x224444);
    btnBg.setStrokeStyle(2, 0x44aaaa);
    btnText.setText('PLAY LURE');
    btnText.setColor('#66ffff');
  }
  
  /**
   * Update camera lure button visibility
   */
  private updateCameraLureButton(): void {
    if (!this.cameraLureButton || !this.isCameraMode) return;
    
    // Show button only if there's a lure placed but NOT playing yet
    const hasUnplayedLure = this.activeLure && this.activeLure.placed && !this.activeLure.playing;
    
    this.cameraLureButton.setVisible(!!hasUnplayedLure && this.nightNumber >= 3);
    
    if (hasUnplayedLure) {
      this.updateCameraLureButtonStyle();
    }
  }
  
  /**
   * Create room view UI (when engineer teleports to a room) - FULLSCREEN
   */
  private createRoomViewUI(): void {
    this.roomViewUI = this.add.container(0, 0);
    this.roomViewUI.setVisible(false);
    this.roomViewUI.setDepth(110);
    
    // ===== FULLSCREEN ROOM VIEW =====
    // Floor/wall perspective - fills the entire screen
    const roomGraphics = this.add.graphics();
    
    // Ceiling
    roomGraphics.fillStyle(0x080810, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 0);
    roomGraphics.lineTo(1280, 0);
    roomGraphics.lineTo(1100, 150);
    roomGraphics.lineTo(180, 150);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Back wall
    roomGraphics.fillStyle(0x12121a, 1);
    roomGraphics.fillRect(180, 150, 920, 250);
    
    // Left wall
    roomGraphics.fillStyle(0x0e0e14, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 0);
    roomGraphics.lineTo(180, 150);
    roomGraphics.lineTo(180, 400);
    roomGraphics.lineTo(0, 720);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Right wall
    roomGraphics.fillStyle(0x0e0e14, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(1280, 0);
    roomGraphics.lineTo(1100, 150);
    roomGraphics.lineTo(1100, 400);
    roomGraphics.lineTo(1280, 720);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Floor with perspective
    roomGraphics.fillStyle(0x0a0a10, 1);
    roomGraphics.beginPath();
    roomGraphics.moveTo(0, 720);
    roomGraphics.lineTo(1280, 720);
    roomGraphics.lineTo(1100, 400);
    roomGraphics.lineTo(180, 400);
    roomGraphics.closePath();
    roomGraphics.fill();
    
    // Floor grid lines
    roomGraphics.lineStyle(1, 0x1a1a25, 0.4);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const y = 400 + t * 320;
      const leftX = 180 - t * 180;
      const rightX = 1100 + t * 180;
      roomGraphics.lineBetween(leftX, y, rightX, y);
    }
    
    // Wall edges
    roomGraphics.lineStyle(2, 0x2a2a40, 0.6);
    roomGraphics.lineBetween(180, 150, 0, 720);
    roomGraphics.lineBetween(1100, 150, 1280, 720);
    roomGraphics.lineBetween(180, 150, 1100, 150);
    roomGraphics.lineBetween(180, 400, 1100, 400);
    
    this.roomViewUI.add(roomGraphics);
    
    // Doorway in the back wall (larger, centered)
    this.roomDoorway = this.add.container(640, 280);
    
    const doorFrame = this.add.graphics();
    // Dark doorway opening
    doorFrame.fillStyle(0x000000, 1);
    doorFrame.fillRect(-80, -110, 160, 220);
    // Door frame edges
    doorFrame.lineStyle(3, 0x333344, 0.8);
    doorFrame.strokeRect(-80, -110, 160, 220);
    // Inner darkness
    doorFrame.fillStyle(0x030308, 0.9);
    doorFrame.fillRect(-70, -100, 140, 200);
    
    this.roomDoorway.add(doorFrame);
    this.roomViewUI.add(this.roomDoorway);
    
    // Red eyes in doorway (shown when enemy approaches)
    this.roomDoorwayEyes = this.add.container(640, 260);
    this.roomDoorwayEyes.setVisible(false);
    
    const eyesGraphics = this.add.graphics();
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
    
    this.roomDoorwayEyes.add(eyesGraphics);
    this.roomViewUI.add(this.roomDoorwayEyes);
    
    // Room name header - top left
    this.roomViewHeader = this.add.text(40, 30, 'ROOM: ---', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#44ff44',
      fontStyle: 'bold',
    });
    this.roomViewUI.add(this.roomViewHeader);
    
    // "You are here" indicator
    const hereText = this.add.text(640, 480, '', {  // Empty - not needed
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#44ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.roomViewUI.add(hereText);
    
    // ===== BOTTOM ACTION BAR =====
    const actionBar = this.add.rectangle(640, 660, 1200, 100, 0x0a0a15, 0.95);
    actionBar.setStrokeStyle(2, 0x333355);
    this.roomViewUI.add(actionBar);
    
    // Lure button - left side of bar
    this.lureButton = this.add.container(400, 660);
    const lureBtnBg = this.add.rectangle(0, 0, 280, 60, 0x224444);
    lureBtnBg.setStrokeStyle(2, 0x44aaaa);
    lureBtnBg.setInteractive({ useHandCursor: true });
    
    const lureBtnText = this.add.text(0, 0, 'PLACE LURE (50 METAL)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#66ffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.lureButton.add([lureBtnBg, lureBtnText]);
    this.roomViewUI.add(this.lureButton);
    
    lureBtnBg.on('pointerover', () => lureBtnBg.setFillStyle(0x335555));
    lureBtnBg.on('pointerout', () => lureBtnBg.setFillStyle(0x224444));
    lureBtnBg.on('pointerdown', () => this.toggleLure());
    
    // Return button - right side of bar
    this.returnButton = this.add.container(880, 660);
    const returnBtnBg = this.add.rectangle(0, 0, 280, 60, 0x442222);
    returnBtnBg.setStrokeStyle(2, 0xaa4444);
    returnBtnBg.setInteractive({ useHandCursor: true });
    
    const returnBtnText = this.add.text(0, 0, 'RETURN TO INTEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.returnButton.add([returnBtnBg, returnBtnText]);
    this.roomViewUI.add(this.returnButton);
    
    returnBtnBg.on('pointerover', () => returnBtnBg.setFillStyle(0x553333));
    returnBtnBg.on('pointerout', () => returnBtnBg.setFillStyle(0x442222));
    returnBtnBg.on('pointerdown', () => this.returnToIntel());
    
    // Tip text (removed - not needed)
    const tipText = this.add.text(640, 620, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#555566',
    }).setOrigin(0.5);
    this.roomViewUI.add(tipText);
    
    // Escape warning overlay - positioned below the doorway, centered
    this.escapeWarning = this.add.container(640, 580);
    this.escapeWarning.setVisible(false);
    this.escapeWarning.setDepth(50);
    
    // Bar background (dark, full width)
    const barBg = this.add.rectangle(0, 0, 320, 20, 0x220000);
    barBg.setStrokeStyle(2, 0x440000);
    
    // Progress bar that shrinks (starts full, shrinks to 0)
    const progressBar = this.add.rectangle(-155, 0, 310, 14, 0xff0000);
    progressBar.setOrigin(0, 0.5);
    
    // Inner glow effect
    const innerGlow = this.add.rectangle(-155, 0, 310, 8, 0xff4444);
    innerGlow.setOrigin(0, 0.5);
    
    this.escapeWarning.add([barBg, progressBar, innerGlow]);
    this.roomViewUI.add(this.escapeWarning);
    
    // Pyro escape warning (Custom Night only) - appears in Intel room when Pyro lights match
    this.pyroEscapeWarning = this.add.container(640, 100);
    this.pyroEscapeWarning.setVisible(false);
    this.pyroEscapeWarning.setDepth(100);
    
    // Fiery background panel
    const pyroBg = this.add.rectangle(0, 0, 400, 80, 0x331100, 0.95);
    pyroBg.setStrokeStyle(3, 0xff4400);
    
    // Warning text
    const pyroWarningText = this.add.text(0, -20, 'PYRO LIT A MATCH!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Timer text
    this.pyroEscapeTimer = this.add.text(0, 15, 'ESCAPE: 10s', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ffaa00',
    }).setOrigin(0.5);
    
    // Fire icon hint
    const fireHint = this.add.text(0, 40, 'TELEPORT TO ESCAPE!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#ff8844',
    }).setOrigin(0.5);
    
    this.pyroEscapeWarning.add([pyroBg, pyroWarningText, this.pyroEscapeTimer, fireHint]);
  }
  
  /**
   * Show/hide Pyro escape warning (Custom Night - Intel mode)
   */
  private showPyroEscapeWarning(show: boolean): void {
    if (this.pyroEscapeWarning) {
      this.pyroEscapeWarning.setVisible(show);
    }
  }
  
  /**
   * Update Pyro escape timer display
   */
  private updatePyroEscapeTimer(secondsRemaining: number): void {
    if (this.pyroEscapeTimer) {
      this.pyroEscapeTimer.setText(`ESCAPE: ${secondsRemaining}s`);
      // Color gets more urgent as time runs out
      if (secondsRemaining <= 3) {
        this.pyroEscapeTimer.setColor('#ff0000');
      } else if (secondsRemaining <= 5) {
        this.pyroEscapeTimer.setColor('#ff4400');
      } else {
        this.pyroEscapeTimer.setColor('#ffaa00');
      }
    }
  }
  
  /**
   * Teleport engineer to a room
   */
  private teleportToRoom(node: NodeId): void {
    if (node === 'INTEL') {
      this.showAlert('Cannot teleport to Intel room!', 0xff0000);
      return;
    }

    // Block teleport if Administrator has hacked this room's teleporter
    if (this.isAdministratorEnabled() && this.hackedRooms.get(node)?.hacked) {
      this.showAlert('TELEPORTER OFFLINE', 0x9944cc);
      return;
    }
    
    // Store pending destination (for cancel feature)
    this.pendingTeleportDestination = node;
    
    // Freeze Pyro and Sniper teleportation during player's teleport animation
    // This prevents the unfair situation where they teleport into the destination
    // while the animation is playing
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      this.pyro.freezeTeleport();
      this.pyro.setBlockedDestination(node);
    }
    if (this.isSniperEnabled() && this.sniper) {
      this.sniper.freezeTeleport();
      this.sniper.setBlockedDestination(node);
    }
    
    // Freeze Scout and Soldier movement during player's teleport animation
    // This prevents them from moving into rooms while player is mid-teleport
    if (this.isScoutEnabled() && this.scout) {
      this.scout.freezeMovement();
    }
    if (this.isSoldierEnabled() && this.soldier) {
      this.soldier.freezeMovement();
    }
    
    // Show teleport animation overlay FIRST, then check for enemies after arrival
    this.showTeleportAnimation(() => {
      // If game ended during teleport animation (e.g., Pyro timer ran out), don't proceed
      if (this.gameStatus !== 'PLAYING') {
        // Still unfreeze enemies to prevent them being stuck
        if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
          this.pyro.unfreezeTeleport();
        }
        if (this.isSniperEnabled() && this.sniper) {
          this.sniper.unfreezeTeleport();
        }
        if (this.isScoutEnabled() && this.scout) {
          this.scout.unfreezeMovement();
        }
        if (this.isSoldierEnabled() && this.soldier) {
          this.soldier.unfreezeMovement();
        }
        return;
      }
      
      // Check if any enemy BODY is in this room (not just heads)
      // NOTE: Pyro stays frozen until AFTER this check completes
      const scoutThere = this.scout.isAtNode(node);
      const soldierThere = this.soldier.isAtNode(node);
      // Demoman body doesn't kill on teleport - his threat is at the doors only
      const heavyThere = this.isHeavyEnabled() && this.heavy.isAtNode(node);
      const sniperThere = this.isSniperEnabled() && this.sniper.isAtNode(node);
      // Pyro: in Room mode, teleporting to his room = death (he's invisible but deadly)
      const pyroThere = this.isPyroEnabled() && this.pyro && 
                        !this.pyro.isForceDespawned() && 
                        this.pyro.isAtNode(node);
      
      console.log(`Arrived at ${node}. Enemies: Scout=${scoutThere}, Soldier=${soldierThere}, Heavy=${heavyThere}, Sniper=${sniperThere}, Pyro=${pyroThere}`);
      
      // Helper to unfreeze enemies before returning
      const unfreezeAndReturn = () => {
        if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
          this.pyro.unfreezeTeleport();
        }
        if (this.isSniperEnabled() && this.sniper) {
          this.sniper.unfreezeTeleport();
        }
        if (this.isScoutEnabled() && this.scout) {
          this.scout.unfreezeMovement();
        }
        if (this.isSoldierEnabled() && this.soldier) {
          this.soldier.unfreezeMovement();
        }
      };
      
      // Check each enemy type and show appropriate jumpscare AFTER teleport animation
      if (scoutThere) {
        unfreezeAndReturn();
        this.gameOver('Scout caught you!');
        return;
      }
      if (soldierThere) {
        unfreezeAndReturn();
        this.gameOver('Soldier got you!');
        return;
      }
      if (heavyThere) {
        unfreezeAndReturn();
        this.gameOver('Heavy crushed you!');
        return;
      }
      if (sniperThere) {
        unfreezeAndReturn();
        this.gameOver('Sniped at close range!');
        return;
      }
      if (pyroThere) {
        unfreezeAndReturn();
        this.gameOver('Pyro burned you alive!');
        return;
      }
      
      // No enemy - safe to teleport
      this.isTeleported = true;
      this.currentRoom = node;
      this.teleportEscapeTimer = 0;
      this.enemyApproachingRoom = false;
      this.approachingEnemyType = 'an enemy';

      // Track last teleported room for Administrator Mode 1; reset no-teleport timer for Mode 2
      this.lastTeleportedRoom = node;
      this.administratorNoTeleportTimer = 0;

      // Scare Administrator if she was targeting this room during TARGETING phase
      if (this.isAdministratorEnabled() && this.administrator && this.administrator.isActive()) {
        if (this.administrator.getCurrentTarget() === node && this.administrator.getState() === 'TARGETING') {
          this.administrator.scareAdministrator();
        }
      }
      
      // Stop dispenser hum when leaving Intel room
      this.audio.stopDispenserHum();
      this.audio.stopIntelRoomAmbience();
      
      // Reset aim states (important for mobile touch zones)
      this.keyADown = false;
      this.keyDDown = false;
      this.sentry.aimedDoor = 'NONE';
      
      // Immediately check for approaching enemies and identify which one
      const adjacent = ROOM_ADJACENCY[this.currentRoom] || [];
      
      let approachingEnemy = '';
      if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned() && this.pyro.getMode() === 'ROOM' && adjacent.includes(this.pyro.currentNode)) {
        approachingEnemy = 'Pyro';
      } else if (this.isHeavyEnabled() && this.heavy.isActive() && adjacent.includes(this.heavy.currentNode)) {
        approachingEnemy = 'Heavy';
      } else if (this.isSniperEnabled() && this.sniper.isActive() && adjacent.includes(this.sniper.currentNode)) {
        approachingEnemy = 'Sniper';
      } else if (this.isScoutEnabled() && this.scout.isActive() && adjacent.includes(this.scout.currentNode)) {
        approachingEnemy = 'Scout';
      } else if (this.isSoldierEnabled() && this.soldier.isActive() && adjacent.includes(this.soldier.currentNode)) {
        approachingEnemy = 'Soldier';
      }
      
      if (approachingEnemy) {
        this.enemyApproachingRoom = true;
        this.approachingEnemyType = approachingEnemy;
        this.teleportEscapeTimer = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
        this.showAlert('A nearby enemy heard you!', 0xff0000);
        this.escapeWarning.setVisible(true);
        this.roomDoorwayEyes.setVisible(true);
        this.audio.playEnemyApproachSound();
      }
      
      // Hide camera UI, show room view
      this.cameraUI.setVisible(false);
      this.isCameraMode = false;
      this.roomViewUI.setVisible(true);
      
      // Move metal text below room header when teleported (aligned with header at x=40)
      this.metalText.setPosition(40, 60);
      
      // Move lure bar below metal text when teleported
      this.lureBarContainer.setPosition(100, 105);
      
      // Update room view header
      this.roomViewHeader.setText(`ROOM: ${node.replace('_', ' ')}`);
      
      // Update lure button text if lure is active here
      this.updateLureButtonText();
      
      // Spy may sap the sentry when player leaves Intel!
      if (this.isSpyEnabled() && this.spy && this.sentry.exists && !this.spy.isSapping()) {
        const sapPlaced = this.spy.attemptSap();
        if (sapPlaced) {
          this.showAlert('⚠ SPY SAPPING SENTRY!', 0xff4444);
          this.sapperIndicator.setVisible(true);
          this.audio.playSapperSound();
          // Flash screen red to make it very noticeable
          this.cameras.main.flash(300, 255, 100, 100, false);
        }
      }
      
      // Unfreeze all enemies AFTER all checks complete - prevents race condition
      if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
        this.pyro.unfreezeTeleport();
      }
      if (this.isSniperEnabled() && this.sniper) {
        this.sniper.unfreezeTeleport();
      }
      if (this.isScoutEnabled() && this.scout) {
        this.scout.unfreezeMovement();
      }
      if (this.isSoldierEnabled() && this.soldier) {
        this.soldier.unfreezeMovement();
      }
      
      console.log(`Engineer teleported to ${node}`);
    });
  }
  
  /**
   * Return engineer to Intel room
   */
  private returnToIntel(): void {
    // Stop any approach sounds
    this.audio.stopApproachGrowl();
    
    // Show teleport animation overlay
    this.showTeleportAnimation(() => {
      this.isTeleported = false;
      this.currentRoom = 'INTEL';
      this.roomViewUI.setVisible(false);
      this.escapeWarning.setVisible(false);
      this.roomDoorwayEyes.setVisible(false);
      this.enemyApproachingRoom = false;
      this.approachingEnemyType = 'an enemy';
      this.teleportEscapeTimer = 0;
      
      // Restore metal text to original position
      this.metalText.setPosition(20, 20);
      
      // Restore lure bar to original position (right of metal count, with spacing)
      this.lureBarContainer.setPosition(300, 28);
      
      // Resume dispenser hum when back in Intel room
      this.audio.startDispenserHum();
      this.audio.startIntelRoomAmbience();
      
      console.log('Engineer returned to Intel room');
      
      // Check if any enemy is waiting in Intel room (reached while player was away)
      if (this.isHeavyEnabled() && this.heavy.currentNode === 'INTEL') {
        this.gameOver('Heavy was waiting for you!');
        return;
      }
      if (this.isScoutEnabled() && this.scout.state === 'ATTACKING') {
        this.gameOver('Scout was waiting for you!');
        return;
      }
      if (this.isSoldierEnabled() && this.soldier.state === 'ATTACKING') {
        this.gameOver('Soldier was waiting for you!');
        return;
      }
      if (this.isDemomanEnabled() && this.demoman.state === 'ATTACKING') {
        this.gameOver('Demoman was waiting for you!');
        return;
      }

      // Administrator Mode 1: auto-hack last teleported room on return to Intel
      this.handleAdministratorMode1();
    });
  }

  /**
   * Administrator Mode 1 — instant auto-hack triggered when player returns to Intel.
   * Hacks the last room the player teleported to (if not already hacked).
   * Every return trip triggers this — no cooldown cap.
   */
  private handleAdministratorMode1(): void {
    if (!this.isAdministratorEnabled() || !this.administrator?.isActive()) return;
    if (!this.lastTeleportedRoom) return; // no teleport yet this night

    const validRooms = AdministratorEnemy.VALID_ROOMS;

    // Target is always the last teleported room (if valid and not already hacked)
    let target: NodeId | null = null;

    if (validRooms.includes(this.lastTeleportedRoom)) {
      const roomState = this.hackedRooms.get(this.lastTeleportedRoom);
      if (roomState && !roomState.hacked && !this.isNodeCameraDestroyed(this.lastTeleportedRoom)) {
        target = this.lastTeleportedRoom;
      }
      // If already hacked or camera is destroyed, do nothing
    }

    if (!target) return;

    // Instantly hack the room
    const roomState = this.hackedRooms.get(target)!;
    roomState.hacked = true;
    roomState.repairProgress = 0;

    // Reset the no-teleport timer so Mode 2 doesn't fire right after a Mode 1 hack
    this.administratorNoTeleportTimer = 0;

    this.showAlert(`⚠ ADMINISTRATOR: ${target.replace('_', ' ')} TELEPORTER HACKED`, 0x9944cc);
    this.updateHackedRoomMapIndicators();
    this.updateTeleportButtonAppearance();
    this.audio.playAdministratorHackSound();
    console.log(`📋 Administrator (Mode 1) instantly hacked ${target}.`);
  }
  
  /**
   * Show teleport animation with particle effects (1 second duration)
   */
  private showTeleportAnimation(onComplete: () => void): void {
    // Mark animation as in progress
    this.isTeleportAnimating = true;
    
    // Update button to show cancel option
    this.updateTeleportButtonAppearance();
    
    // Play teleport sound
    this.audio.playTeleportSound();
    
    // Create teleport overlay
    const overlay = this.add.container(640, 360);
    overlay.setDepth(200);
    
    // Store reference for cancellation
    this.teleportAnimationOverlay = overlay;
    
    // Dark flash background
    const flash = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0);
    overlay.add(flash);
    
    // Red glow circle expanding from center (RED team teleporter)
    const glowCircle = this.add.circle(0, 0, 10, 0xff4444, 0.8);
    overlay.add(glowCircle);
    
    // Inner bright core
    const core = this.add.circle(0, 0, 5, 0xffffff, 1);
    overlay.add(core);
    
    // "TELEPORTING..." text
    const teleportText = this.add.text(0, 150, 'TELEPORTING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    teleportText.setAlpha(0);
    overlay.add(teleportText);
    
    // Create swirling particles
    const particles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const particle = this.add.circle(
        Math.cos(angle) * 50,
        Math.sin(angle) * 50,
        4,
        0xff4444  // RED team teleporter particles
      );
      particle.setAlpha(0);
      particles.push(particle);
      overlay.add(particle);
    }
    
    // Animation sequence
    // 1. Flash in and expand glow
    this.tweens.add({
      targets: flash,
      alpha: 0.7,
      duration: 150,
      yoyo: true,
    });
    
    this.tweens.add({
      targets: glowCircle,
      scale: 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
    });
    
    this.tweens.add({
      targets: core,
      scale: 5,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
    });
    
    // Text fade in
    this.tweens.add({
      targets: teleportText,
      alpha: 1,
      duration: 200,
      delay: 100,
    });
    
    // Swirling particles
    particles.forEach((particle, i) => {
      const delay = i * 30;
      const angle = (i / 20) * Math.PI * 2;
      
      this.tweens.add({
        targets: particle,
        alpha: 1,
        duration: 100,
        delay: delay,
      });
      
      this.tweens.add({
        targets: particle,
        x: Math.cos(angle) * 200,
        y: Math.sin(angle) * 200,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        delay: delay + 100,
        ease: 'Power1',
      });
    });
    
    // Complete after 1 second
    this.teleportAnimationCallback = this.time.delayedCall(1000, () => {
      this.isTeleportAnimating = false;
      this.teleportAnimationOverlay = null;
      this.teleportAnimationCallback = null;
      this.pendingTeleportDestination = null;
      this.updateTeleportButtonAppearance();
      overlay.destroy();
      onComplete();
    });
  }
  
  /**
   * Cancel an in-progress teleport animation
   */
  private cancelTeleport(): void {
    if (!this.isTeleportAnimating) return;
    
    console.log('Teleport cancelled!');
    
    // Cancel the delayed callback
    if (this.teleportAnimationCallback) {
      this.teleportAnimationCallback.remove();
      this.teleportAnimationCallback = null;
    }
    
    // Destroy the overlay (kill child tweens first so orphaned tweens
    // don't keep running against destroyed targets)
    if (this.teleportAnimationOverlay) {
      this.teleportAnimationOverlay.each((child: Phaser.GameObjects.GameObject) => {
        this.tweens.killTweensOf(child);
      });
      this.tweens.killTweensOf(this.teleportAnimationOverlay);
      this.teleportAnimationOverlay.destroy();
      this.teleportAnimationOverlay = null;
    }
    
    // Unfreeze all enemies
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      this.pyro.unfreezeTeleport();
    }
    if (this.isSniperEnabled() && this.sniper) {
      this.sniper.unfreezeTeleport();
    }
    if (this.isScoutEnabled() && this.scout) {
      this.scout.unfreezeMovement();
    }
    if (this.isSoldierEnabled() && this.soldier) {
      this.soldier.unfreezeMovement();
    }
    
    // Reset state
    this.isTeleportAnimating = false;
    this.pendingTeleportDestination = null;
    
    // Update button appearance back to normal
    this.updateTeleportButtonAppearance();
    
    // Show cancel feedback
    this.showAlert('Teleport cancelled!', 0xffaa00);
  }
  
  /**
   * Update teleport button appearance based on animation state
   */
  private updateTeleportButtonAppearance(): void {
    if (!this.teleportButtonBg?.active || !this.teleportButtonText?.active) return;

    const hacked = this.isSelectedCameraHacked();

    if (hacked) {
      // Hacked state — grayed out, shows repair bar
      this.teleportButtonBg.setFillStyle(0x1a1a1a);
      this.teleportButtonBg.setStrokeStyle(2, 0xbb66ee);
      this.teleportButtonText.setText('✕ HACKED');
      this.teleportButtonText.setColor('#bb66ee');
      this.teleportRepairBarBg?.setVisible(true);
      this.teleportRepairBarFill?.setVisible(true);
    } else if (this.isTeleportAnimating) {
      // Cancel mode - orange/warning colors
      this.teleportButtonBg.setFillStyle(0x553311);
      this.teleportButtonBg.setStrokeStyle(2, 0xffaa44);
      this.teleportButtonText.setText('✕ CANCEL');
      this.teleportButtonText.setColor('#ffaa44');
      this.teleportRepairBarBg?.setVisible(false);
      this.teleportRepairBarFill?.setVisible(false);
    } else {
      // Normal mode - red colors (RED team)
      this.teleportButtonBg.setFillStyle(0x442222);
      this.teleportButtonBg.setStrokeStyle(2, 0xcc4444);
      this.teleportButtonText.setText('TELEPORT HERE');
      this.teleportButtonText.setColor('#ff8888');
      this.teleportRepairBarBg?.setVisible(false);
      this.teleportRepairBarFill?.setVisible(false);
    }
  }
  
  /**
   * Handle lure button - place lure or play existing lure
   */
  private toggleLure(): void {
    console.log(`toggleLure called. isTeleported=${this.isTeleported}, currentRoom=${this.currentRoom}`);
    
    // If lure exists and we're at the lure location, play it
    if (this.activeLure && this.activeLure.node === this.currentRoom && this.activeLure.placed) {
      if (!this.activeLure.playing) {
        // Play the lure (activate Medic voice)
        this.activeLure.playing = true;
        this.activeLure.playTimeRemaining = GAME_CONSTANTS.LURE_DURATION;
        this.showAlert('Lure activated!', 0x00ffff);
        this.audio.playLureSound();
        console.log('Lure activated at', this.currentRoom);
      } else {
        this.showAlert('Lure already playing!', 0xffff00);
      }
      this.updateLureButtonText();
      return;
    }
    
    // If lure exists elsewhere, can't do anything here
    if (this.activeLure && this.activeLure.placed) {
      this.showAlert(`Lure already at ${this.activeLure.node.replace('_', ' ')}!`, 0xffff00);
      return;
    }
    
    if (!this.isTeleported) {
      this.showAlert('Must be teleported to place lure!', 0xff6600);
      return;
    }
    
    if (this.currentRoom === 'INTEL') {
      this.showAlert('Cannot place lure in Intel room!', 0xff0000);
      return;
    }
    
    // Place new lure
    if (this.metal < GAME_CONSTANTS.LURE_COST) {
      this.showAlert('Not enough metal! (50 required)', 0xff0000);
      return;
    }
    
    this.metal -= GAME_CONSTANTS.LURE_COST;
    this.activeLure = { 
      node: this.currentRoom, 
      placed: true, 
      playing: false, 
      playTimeRemaining: 0 
    };
    console.log(`Lure placed at ${this.currentRoom}`);
    this.audio.playLurePlacedSound();
    this.showAlert(`Lure placed! Play from cameras.`, 0x00ffff);
    this.updateHUD();
    this.updateLureButtonText();
  }
  
  /**
   * Pick up lure from current room
   */
  private _pickupLure(): void {
    if (this.activeLure && this.activeLure.node === this.currentRoom) {
      this.activeLure = null;
      this.showAlert('Lure picked up', 0xffff00);
      this.updateLureButtonText();
    }
  }
  
  /**
   * Update lure button text based on state
   */
  private updateLureButtonText(): void {
    if (!this.lureButton) return;
    
    const btnText = this.lureButton.list[1] as Phaser.GameObjects.Text;
    const btnBg = this.lureButton.list[0] as Phaser.GameObjects.Rectangle;
    
    if (this.activeLure && this.activeLure.placed) {
      if (this.activeLure.node === this.currentRoom) {
        // At the lure location
        if (this.activeLure.playing) {
          btnText.setText('🔊 LURE PLAYING...');
          btnBg.setFillStyle(0x224444);
          btnBg.setStrokeStyle(2, 0x00ffff);
          btnText.setColor('#66ffff');
        } else {
          btnText.setText('PLAY LURE');
          btnBg.setFillStyle(0x442244);
          btnBg.setStrokeStyle(2, 0xaa44aa);
          btnText.setColor('#cc88ff');
        }
      } else {
        // Lure is placed elsewhere - show info (can't place another)
        const lureRoom = this.activeLure.node.replace('_', ' ');
        btnText.setText(`LURE AT ${lureRoom}`);
        btnBg.setFillStyle(0x222222);
        btnBg.setStrokeStyle(2, 0x555555);
        btnText.setColor('#888888');
      }
    } else {
      // No lure placed - check if enough metal
      const canAfford = this.metal >= GAME_CONSTANTS.LURE_COST;
      btnText.setText('PLACE LURE (50 metal)');
      if (canAfford) {
        btnBg.setFillStyle(0x224444);
        btnBg.setStrokeStyle(2, 0x44aaaa);
        btnText.setColor('#66ffff');
      } else {
        // Greyed out - not enough metal
        btnBg.setFillStyle(0x1a1a1a);
        btnBg.setStrokeStyle(2, 0x333333);
        btnText.setColor('#555555');
      }
    }
  }
  
  /**
   * Repair a destroyed camera
   */
  private repairCamera(cameraIndex: number, remote: boolean): void {
    const cam = CAMERAS[cameraIndex];
    const camState = this.cameraStates.get(cam.id);
    
    if (!camState || !camState.destroyed) {
      return;
    }
    
    if (remote) {
      // Remote repair costs metal
      if (this.metal < GAME_CONSTANTS.CAMERA_REMOTE_REPAIR_COST) {
        this.showAlert('Not enough metal! (50 required)', 0xff0000);
        return;
      }
      this.metal -= GAME_CONSTANTS.CAMERA_REMOTE_REPAIR_COST;
      this.updateHUD();
    }
    
    camState.destroyed = false;
    camState.destroyedBy = null;
    camState.destroyedUntil = 0;
    
    this.showAlert(`Camera ${cam.name} repaired!`, 0x00ff00);
  }
  
  /**
   * Update map node colors to show selected camera and active lures
   */
  private updateMapNodeColors(selectedNode: string): void {
    this.cameraMapNodes.forEach((container, node) => {
      const glow = container.list[0] as Phaser.GameObjects.Arc;
      const bg = container.list[1] as Phaser.GameObjects.Arc;
      
      // Check if lure is at this node
      const lureAtNode = this.activeLure && this.activeLure.placed && this.activeLure.node === node;
      const lurePlayingAtNode = lureAtNode && this.activeLure!.playing;
      
      if (node === selectedNode) {
        // Selected camera - GREEN
        glow.setFillStyle(0x44ff44, 0.3);
        bg.setStrokeStyle(2, 0x66ff66);
        bg.setFillStyle(0x1a4030);
      } else if (lurePlayingAtNode) {
        // Active lure playing - PULSING RED/ORANGE
        glow.setFillStyle(0xff6600, 0.5);
        bg.setStrokeStyle(3, 0xff4400);
        bg.setFillStyle(0x3a1a0a);
      } else if (lureAtNode) {
        // Lure placed but not playing - ORANGE outline
        glow.setFillStyle(0xff8800, 0.2);
        bg.setStrokeStyle(2, 0xff8800);
        bg.setFillStyle(0x2a1a0a);
      } else {
        glow.setFillStyle(0x44aaff, 0);
        bg.setStrokeStyle(2, 0x2266aa);
        bg.setFillStyle(0x0a1830);
      }
    });
  }

  /**
   * Update the hacked room X indicators on the camera map
   * Called when a room is hacked or repaired by Administrator
   */
  private updateHackedRoomMapIndicators(): void {
    this.hackedRoomMapIndicators.forEach((indicator, node) => {
      const hackedState = this.hackedRooms.get(node as NodeId);
      indicator.setVisible(!!(hackedState && hackedState.hacked));
    });
  }

  /**
   * Select a camera and update the feed view
   * Note: Camera switching is allowed during boot so player can select teleport destination
   */
  private selectCamera(index: number): void {
    // Always show teleport button if Night 3+ (even if same camera selected)
    if (this.nightNumber >= 3 && this.teleportButton) {
      this.teleportButton.setVisible(true);
    }

    // Stop repair if switching cameras mid-hold
    this.administratorRepairActive = false;
    this.updateTeleportButtonAppearance();
    
    // Don't do anything else if clicking the camera we're already on
    if (this.selectedCamera === index) {
      return;
    }
    
    this.selectedCamera = index;
    const cam = CAMERAS[index];
    this.cameraFeedTitle.setText(`CAM 0${cam.id} - ${cam.name}`);
    
    // Update map node colors (highlights selected + lure)
    this.updateMapNodeColors(cam.node);
    
    // Camera switch static burst - enhanced visual effect using dedicated overlay
    this.cameraStaticBurstOverlay.clear();
    this.cameraStaticBurstOverlay.setVisible(true);
    
    // Draw multiple layers of static for authentic CRT look
    // Layer 1: Gray flash across entire feed
    this.cameraStaticBurstOverlay.fillStyle(0x888888, 0.7);
    this.cameraStaticBurstOverlay.fillRect(170, 150, 500, 400);
    
    // Layer 2: Horizontal interference lines (blue scan lines)
    this.cameraStaticBurstOverlay.lineStyle(3, 0x4488ff, 0.6);
    for (let i = 0; i < 25; i++) {
      const y = 150 + Math.random() * 400;
      this.cameraStaticBurstOverlay.lineBetween(170, y, 670, y);
    }
    
    // Layer 3: Gray/black static blocks
    for (let i = 0; i < 80; i++) {
      const x = 170 + Math.random() * 500;
      const y = 150 + Math.random() * 400;
      const size = 3 + Math.random() * 15;
      this.cameraStaticBurstOverlay.fillStyle(Math.random() > 0.5 ? 0x000000 : 0x999999, 0.5 + Math.random() * 0.5);
      this.cameraStaticBurstOverlay.fillRect(x, y, size, size * 0.3);
    }
    
    // Layer 4: Blue interference bars
    this.cameraStaticBurstOverlay.fillStyle(0x4488ff, 0.2);
    this.cameraStaticBurstOverlay.fillRect(170, 200 + Math.random() * 200, 500, 20 + Math.random() * 40);
    
    // Play camera switch sound + static burst
    this.audio.playCameraSwitchSound();
    this.audio.playCameraStaticBurst();
    
    // Animate static clearing - frame 2 (less intense)
    this.time.delayedCall(50, () => {
      this.cameraStaticBurstOverlay.clear();
      this.cameraStaticBurstOverlay.fillStyle(0x777777, 0.3);
      this.cameraStaticBurstOverlay.fillRect(170, 150, 500, 400);
      // Fewer, thinner static lines (blue)
      this.cameraStaticBurstOverlay.lineStyle(1, 0x6699ff, 0.4);
      for (let i = 0; i < 10; i++) {
        const y = 150 + Math.random() * 400;
        this.cameraStaticBurstOverlay.lineBetween(170, y, 670, y);
      }
    });
    
    // Frame 3 - almost clear
    this.time.delayedCall(100, () => {
      this.cameraStaticBurstOverlay.clear();
      this.cameraStaticBurstOverlay.fillStyle(0x666666, 0.1);
      this.cameraStaticBurstOverlay.fillRect(170, 150, 500, 400);
    });
    
    // Clear burst overlay completely
    this.time.delayedCall(150, () => {
      this.cameraStaticBurstOverlay.clear();
      this.cameraStaticBurstOverlay.setVisible(false);
      this.updateCameraStatic();
    });
    
    // Check if camera is destroyed (Night 3+)
    if (this.nightNumber >= 3 && this.cameraDestroyedOverlay) {
      const camState = this.cameraStates.get(cam.id);
      if (camState && camState.destroyed) {
        this.cameraDestroyedOverlay.setVisible(true);
        this.cameraFeedEnemy.setVisible(false);
        this.cameraFeedEmpty.setVisible(false);
        if (this.cameraFeedDemoHead) {
          this.cameraFeedDemoHead.setVisible(false);
        }
        
        // Update timer display (list[3] is the timer text)
        const remaining = Math.max(0, Math.ceil((camState.destroyedUntil - Date.now()) / 1000));
        const timerText = this.cameraDestroyedOverlay.list[3] as Phaser.GameObjects.Text;
        timerText.setText(`AUTO REPAIR: ${remaining}s`);
        
        // Update destroyed text (only Heavy can destroy cameras now)
        this.cameraDestroyedText.setText(`-- HEAVY DESTROYED CAMERA --`);
      } else {
        this.cameraDestroyedOverlay.setVisible(false);
      }
    }
    
    // Update camera lure button visibility
    this.updateCameraLureButton();
  }
  
  // Growl sound state for enemy approach
  
  // Pyro ambient crackling sound nodes
  
  // Track if camera warning sound is currently playing
  
  // Throttle for Pyro burning sound (prevent spam)
  
  /**
   * Update camera static noise effect - atmospheric CRT/night vision look
   */
  private updateCameraStatic(): void {
    this.cameraStaticGraphics.clear();
    
    // Scanlines effect (horizontal lines across entire feed)
    for (let y = 150; y < 550; y += 4) {
      const alpha = 0.03 + Math.random() * 0.02;
      this.cameraStaticGraphics.fillStyle(0x000000, alpha);
      this.cameraStaticGraphics.fillRect(170, y, 500, 1);
    }
    
    // Random noise clusters
    for (let i = 0; i < 25; i++) {
      const x = 170 + Math.random() * 500;
      const y = 150 + Math.random() * 400;
      const size = 1 + Math.random() * 3;
      const isGreen = Math.random() < 0.7;
      this.cameraStaticGraphics.fillStyle(isGreen ? 0x225522 : 0x333333, Math.random() * 0.2);
      this.cameraStaticGraphics.fillRect(x, y, size, size);
    }
    
    // Horizontal interference lines (VHS-like)
    for (let i = 0; i < 3; i++) {
      const y = 150 + Math.random() * 400;
      const width = 100 + Math.random() * 300;
      const x = 170 + Math.random() * (500 - width);
      this.cameraStaticGraphics.fillStyle(0x113311, Math.random() * 0.1);
      this.cameraStaticGraphics.fillRect(x, y, width, 1);
    }
    
    // Occasional bright static burst
    if (Math.random() < 0.15) {
      const burstX = 170 + Math.random() * 450;
      const burstY = 150 + Math.random() * 380;
      for (let i = 0; i < 10; i++) {
        const px = burstX + (Math.random() - 0.5) * 50;
        const py = burstY + (Math.random() - 0.5) * 30;
        this.cameraStaticGraphics.fillStyle(0x44ff44, Math.random() * 0.3);
        this.cameraStaticGraphics.fillRect(px, py, 2, 1);
      }
    }
    
    // Rolling band effect (occasional)
    if (Math.random() < 0.1) {
      const bandY = 150 + Math.random() * 400;
      this.cameraStaticGraphics.fillStyle(0x224422, 0.08);
      this.cameraStaticGraphics.fillRect(170, bandY, 500, 8);
    }
  }
  
  // ============================================
  // VENT CAMERA SYSTEM (Pauling - Custom Night)
  // ============================================

  private createVentUI(): void {
    // Vent map overlay (shown over the camera feed area when in vent mode)
    this.ventUI = this.add.container(0, 0);
    this.ventUI.setVisible(false);
    this.ventUI.setDepth(105);

    const ventBg = this.add.rectangle(420, 340, 580, 500, 0x0a0a10);
    ventBg.setStrokeStyle(4, 0x151520);
    this.ventUI.add(ventBg);

    const ventTitle = this.add.text(420, 120, 'VENT SYSTEM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    this.ventUI.add(ventTitle);

    const nodePositions: Record<string, { x: number; y: number }> = {
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

    const lineGraphics = this.add.graphics();
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

    for (const [nodeId, pos] of Object.entries(nodePositions)) {
      const container = this.add.container(pos.x, pos.y);
      const bg = this.add.rectangle(0, 0, 80, 24, 0x221133);
      bg.setStrokeStyle(1, 0x553388);
      container.add(bg);
      const label = this.add.text(0, 0, nodeNames[nodeId] || nodeId, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#aa88cc',
      }).setOrigin(0.5);
      container.add(label);
      this.ventUI.add(container);
      this.ventNodeGraphics.set(nodeId, container);
    }

    // Pauling icon — silhouette with dark hair and purple outfit
    this.ventPaulingIcon = this.add.container(420, 170);
    const paulingGfx = this.add.graphics();
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
    const paulingLabel = this.add.text(0, 6, 'PAULING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    this.ventPaulingIcon.add(paulingLabel);
    this.ventUI.add(this.ventPaulingIcon);

    // Seal indicators on the vent map (visual only)
    this.ventSealLeftIndicator = this.add.rectangle(270, 510, 80, 8, 0x333333, 0);
    this.ventUI.add(this.ventSealLeftIndicator);
    this.ventSealRightIndicator = this.add.rectangle(570, 510, 80, 8, 0x333333, 0);
    this.ventUI.add(this.ventSealRightIndicator);

    // Seal buttons and thermostat go in the right panel (ventPanelControls)
    this.ventPanelControls = this.add.container(0, 0);
    this.ventPanelControls.setDepth(102);
    this.ventPanelControls.setVisible(false);
    this.cameraUI.add(this.ventPanelControls);

    // Left seal button (in right panel)
    this.ventSealLeftBtn = this.add.container(920, 280);
    const leftBtnBg = this.add.rectangle(0, 0, 140, 40, 0x332244);
    leftBtnBg.setStrokeStyle(2, 0x664488);
    leftBtnBg.setInteractive({ useHandCursor: true });
    const leftBtnText = this.add.text(0, 0, 'SEAL LEFT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    leftBtnBg.on('pointerdown', () => this.toggleVentSeal('LEFT'));
    leftBtnBg.on('pointerover', () => leftBtnBg.setFillStyle(0x443355));
    leftBtnBg.on('pointerout', () => leftBtnBg.setFillStyle(0x332244));
    this.ventSealLeftBtn.add([leftBtnBg, leftBtnText]);
    this.ventPanelControls.add(this.ventSealLeftBtn);

    // Right seal button (in right panel)
    this.ventSealRightBtn = this.add.container(1080, 280);
    const rightBtnBg = this.add.rectangle(0, 0, 140, 40, 0x332244);
    rightBtnBg.setStrokeStyle(2, 0x664488);
    rightBtnBg.setInteractive({ useHandCursor: true });
    const rightBtnText = this.add.text(0, 0, 'SEAL RIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#cc88ff',
    }).setOrigin(0.5);
    rightBtnBg.on('pointerdown', () => this.toggleVentSeal('RIGHT'));
    rightBtnBg.on('pointerover', () => rightBtnBg.setFillStyle(0x443355));
    rightBtnBg.on('pointerout', () => rightBtnBg.setFillStyle(0x332244));
    this.ventSealRightBtn.add([rightBtnBg, rightBtnText]);
    this.ventPanelControls.add(this.ventSealRightBtn);

    // Vent panel thermostat (vertical, in right panel)
    const ventThermoContainer = this.add.container(1000, 420);

    const vtHousing = this.add.rectangle(0, 0, 36, 90, 0x1a1a22);
    vtHousing.setStrokeStyle(1, 0x333344);
    ventThermoContainer.add(vtHousing);

    const vtLabel = this.add.text(0, -55, 'TEMPERATURE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5);
    ventThermoContainer.add(vtLabel);

    const vtBarBg = this.add.rectangle(0, 0, 14, 66, 0x0a0a0a);
    vtBarBg.setStrokeStyle(1, 0x444444);
    ventThermoContainer.add(vtBarBg);

    this.ventPanelThermoFill = this.add.rectangle(0, 33, 10, 0, 0x44cc44);
    this.ventPanelThermoFill.setOrigin(0.5, 1);
    ventThermoContainer.add(this.ventPanelThermoFill);

    this.ventPanelThermoText = this.add.text(0, 55, '0°', {
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

    this.ventCamsToggleBtn = this.add.container(0, 0);
    this.ventCamsToggleBtn.setDepth(106);

    // "ROOMS" tab
    const roomsTabBg = this.add.rectangle(1000 - tabW/2 - tabGap/2, tabY, tabW, tabH, 0x0a1525);
    roomsTabBg.setStrokeStyle(2, 0x3388cc);
    roomsTabBg.setInteractive({ useHandCursor: true });
    const roomsTabText = this.add.text(1000 - tabW/2 - tabGap/2, tabY, 'ROOMS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#5588cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    roomsTabBg.on('pointerdown', () => {
      if (this.isVentCameraMode) this.toggleVentCameraMode();
    });
    roomsTabBg.on('pointerover', () => roomsTabBg.setFillStyle(0x112233));
    roomsTabBg.on('pointerout', () => roomsTabBg.setFillStyle(0x0a1525));

    // "VENTS" tab
    const ventsTabBg = this.add.rectangle(1000 + tabW/2 + tabGap/2, tabY, tabW, tabH, 0x15081a);
    ventsTabBg.setStrokeStyle(2, 0x553388);
    ventsTabBg.setInteractive({ useHandCursor: true });
    this.ventCamsToggleText = this.add.text(1000 + tabW/2 + tabGap/2, tabY, 'VENTS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#9944cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    ventsTabBg.on('pointerdown', () => {
      if (!this.isVentCameraMode) this.toggleVentCameraMode();
    });
    ventsTabBg.on('pointerover', () => ventsTabBg.setFillStyle(0x221133));
    ventsTabBg.on('pointerout', () => ventsTabBg.setFillStyle(0x15081a));

    this.ventCamsToggleBtn.add([roomsTabBg, roomsTabText, ventsTabBg, this.ventCamsToggleText]);
    this.ventCamsToggleBtn.setVisible(false);
    this.cameraUI.add(this.ventCamsToggleBtn);
  }

  private createThermostatUI(): void {
    // Thermostat on the wall to the left of the right door
    // Right door is at x=1160; place thermostat at x=1060, vertical on the wall
    this.thermostatContainer = this.add.container(1060, 260);
    this.thermostatContainer.setDepth(5);
    this.thermostatContainer.setVisible(false);

    // Thermostat housing (small wall-mounted box)
    const housing = this.add.rectangle(0, 0, 28, 70, 0x1a1a22);
    housing.setStrokeStyle(1, 0x333344);
    this.thermostatContainer.add(housing);

    // Label above
    const label = this.add.text(0, -42, 'TEMP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5);
    this.thermostatContainer.add(label);

    // Vertical bar background (mercury-style)
    const barBg = this.add.rectangle(0, 0, 10, 50, 0x0a0a0a);
    barBg.setStrokeStyle(1, 0x444444);
    this.thermostatContainer.add(barBg);

    // Fill bar (grows upward from bottom)
    this.thermostatFill = this.add.rectangle(0, 25, 6, 0, 0x44cc44);
    this.thermostatFill.setOrigin(0.5, 1);
    this.thermostatContainer.add(this.thermostatFill);

    // Percentage text below
    this.thermostatText = this.add.text(0, 42, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5);
    this.thermostatContainer.add(this.thermostatText);
  }

  private toggleVentCameraMode(): void {
    if (!this.isPaulingEnabled()) return;

    this.isVentCameraMode = !this.isVentCameraMode;
    this.audio.playVentTabClickSound();

    if (this.isVentCameraMode) {
      this.ventUI.setVisible(true);
      this.ventPanelControls.setVisible(true);
      this.cameraMapContent.setVisible(false);
      this.teleportButton?.setVisible(false);
      this.cameraLureButton?.setVisible(false);
      this.mapTitleText?.setText('◈ VENT MAP ◈');
      this.mapTitleText?.setColor('#9944cc');
    } else {
      this.ventUI.setVisible(false);
      this.ventPanelControls.setVisible(false);
      this.cameraMapContent.setVisible(true);
      if (this.nightNumber >= 3) {
        this.teleportButton?.setVisible(true);
        this.cameraLureButton?.setVisible(true);
      }
      this.mapTitleText?.setText('◈ FACILITY OVERVIEW ◈');
      this.mapTitleText?.setColor('#5588cc');
    }
  }

  private toggleVentSeal(side: VentSide): void {
    if (!this.isPaulingEnabled() || !this.isVentCameraMode) return;

    this.audio.playVentSealSound();

    if (side === 'LEFT') {
      if (this.ventSealLeft) {
        this.ventSealLeft = false;
      } else {
        this.ventSealRight = false;
        this.ventSealLeft = true;
        if (this.pauling.getState() === 'PRYING' && this.pauling.getOpeningSide() === 'LEFT') {
          this.pauling.blockAndReroute();
          this.audio.playVentThudSound();
        }
      }
    } else {
      if (this.ventSealRight) {
        this.ventSealRight = false;
      } else {
        this.ventSealLeft = false;
        this.ventSealRight = true;
        if (this.pauling.getState() === 'PRYING' && this.pauling.getOpeningSide() === 'RIGHT') {
          this.pauling.blockAndReroute();
          this.audio.playVentThudSound();
        }
      }
    }
  }

  private updateVentUI(): void {
    if (!this.isPaulingEnabled()) return;

    // Show toggle button when cameras are open
    this.ventCamsToggleBtn.setVisible(this.isCameraMode);

    // Show thermostat when in Intel room
    this.thermostatContainer.setVisible(!this.isTeleported);

    // Update Pauling icon position on vent map
    if (this.ventUI.visible && this.pauling.isActive()) {
      const nodePositions: Record<string, { x: number; y: number }> = {
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
      const pos = nodePositions[this.pauling.getCurrentNode()];
      if (pos) {
        this.ventPaulingIcon.setPosition(pos.x, pos.y);
      }

      // Highlight current node
      this.ventNodeGraphics.forEach((container, nodeId) => {
        const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
        if (nodeId === this.pauling.getCurrentNode()) {
          bg.setFillStyle(0x662288);
          bg.setStrokeStyle(2, 0xcc44ff);
        } else {
          bg.setFillStyle(0x221133);
          bg.setStrokeStyle(1, 0x553388);
        }
      });
    }

    // Update seal indicators
    this.ventSealLeftIndicator?.setFillStyle(this.ventSealLeft ? 0xff4444 : 0x333333, this.ventSealLeft ? 0.8 : 0);
    this.ventSealRightIndicator?.setFillStyle(this.ventSealRight ? 0xff4444 : 0x333333, this.ventSealRight ? 0.8 : 0);

    // Update seal button colors
    const leftBg = this.ventSealLeftBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    const rightBg = this.ventSealRightBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    if (this.ventSealLeft) {
      leftBg.setStrokeStyle(2, 0xff4444);
      (this.ventSealLeftBtn.getAt(1) as Phaser.GameObjects.Text).setText('UNSEAL L');
    } else {
      leftBg.setStrokeStyle(2, 0x664488);
      (this.ventSealLeftBtn.getAt(1) as Phaser.GameObjects.Text).setText('SEAL LEFT');
    }
    if (this.ventSealRight) {
      rightBg.setStrokeStyle(2, 0xff4444);
      (this.ventSealRightBtn.getAt(1) as Phaser.GameObjects.Text).setText('UNSEAL R');
    } else {
      rightBg.setStrokeStyle(2, 0x664488);
      (this.ventSealRightBtn.getAt(1) as Phaser.GameObjects.Text).setText('SEAL RIGHT');
    }

    // Update thermostat display (vertical mercury bar) — both Intel room and vent panel
    // Display range: 50° (cold) to 110° (Pyro trigger)
    const pct = Math.min(this.thermostat / GAME_CONSTANTS.THERMOSTAT_MAX, 1);
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

  private updatePaulingAndThermostat(delta: number): void {
    if (!this.isPaulingEnabled() || !this.pauling.isActive()) return;

    // Update thermostat
    if (this.ventSealLeft || this.ventSealRight) {
      this.thermostat = Math.min(this.thermostat + GAME_CONSTANTS.THERMOSTAT_FILL_RATE * delta, GAME_CONSTANTS.THERMOSTAT_MAX);
    } else {
      this.thermostat = Math.max(this.thermostat - GAME_CONSTANTS.THERMOSTAT_DRAIN_RATE * delta, 0);
    }

    // Escalating beep only while thermostat is actively rising (seal closed + above 50%)
    const pct = this.thermostat / GAME_CONSTANTS.THERMOSTAT_MAX;
    const isRising = this.ventSealLeft || this.ventSealRight;
    if (pct >= 0.5 && isRising) {
      this.thermostatBeepTimer += delta;
      // Beep interval: 800ms at 50% → 100ms at 100%
      const beepInterval = 800 - (pct - 0.5) * 1400;
      if (this.thermostatBeepTimer >= Math.max(beepInterval, 100)) {
        this.thermostatBeepTimer = 0;
        this.audio.playThermostatBeep(pct);
      }
    } else {
      this.thermostatBeepTimer = 0;
    }

    // Thermostat maxed out — Pyro appears
    if (this.thermostat >= GAME_CONSTANTS.THERMOSTAT_MAX) {
      this.gameOver('The vents overheated! Pyro appeared!');
      return;
    }

    // Update Pauling movement
    const result = this.pauling.update(delta);

    // She arrived at an opening
    if (result.arrivedAtOpening) {
      const sealed = result.arrivedAtOpening === 'LEFT' ? this.ventSealLeft : this.ventSealRight;
      if (sealed) {
        this.pauling.blockAndReroute();
        this.audio.playVentThudSound();
      } else {
        this.pauling.startPrying();
      }
    }

    // She dropped in
    if (result.entered) {
      this.gameOver('Pauling dropped in from the vents!');
    }
  }

  private createEndScreen(): void {
    this.endScreen = this.add.container(0, 0);
    this.endScreen.setVisible(false);
    this.endScreen.setDepth(200);  // Above everything including camera UI
    
    // Dark overlay
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    this.endScreen.add(overlay);
  }
  
  // ============================================
  // ENGINEER RECORDINGS UI
  // ============================================
  
  /**
   * Create the recording UI - skip button and playing indicator
   */
  private createRecordingUI(): void {
    // Skip button - bottom right corner
    this.recordingSkipButton = this.add.container(1200, 680);
    this.recordingSkipButton.setDepth(210);  // Above pause menu (200)
    this.recordingSkipButton.setVisible(false);
    
    const skipBg = this.add.rectangle(0, 0, 80, 30, 0x333333, 0.9);
    skipBg.setStrokeStyle(2, 0x666666);
    skipBg.setInteractive({ useHandCursor: true });
    
    const skipText = this.add.text(0, 0, 'SKIP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    
    skipBg.on('pointerover', () => {
      skipBg.setFillStyle(0x555555);
      skipText.setColor('#ffffff');
    });
    
    skipBg.on('pointerout', () => {
      skipBg.setFillStyle(0x333333);
      skipText.setColor('#aaaaaa');
    });
    
    skipBg.on('pointerdown', () => {
      this.audio.playCassetteStopSound();
      this.stopRecording();
    });
    
    this.recordingSkipButton.add([skipBg, skipText]);
    
    // Recording indicator - tape recorder icon with waveform
    this.recordingIndicator = this.add.container(1100, 680);
    this.recordingIndicator.setDepth(210);  // Above pause menu (200)
    this.recordingIndicator.setVisible(false);
    
    const indicatorBg = this.add.rectangle(0, 0, 100, 30, 0x1a1a1a, 0.9);
    indicatorBg.setStrokeStyle(1, 0x444444);
    
    const tapeIcon = this.add.text(-35, 0, '(●)', {
      fontSize: '12px',
      color: '#ff4444',
    }).setOrigin(0.5);
    
    const playingText = this.add.text(15, 0, 'PLAYING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#00ff00',
    }).setOrigin(0.5);
    
    // Blink the playing text
    this.tweens.add({
      targets: playingText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    this.recordingIndicator.add([indicatorBg, tapeIcon, playingText]);
  }
  
  /**
   * Start playing the Engineer recording for the current night
   */
  private startRecording(): void {
    // Don't play if already played, already loading, or game not playing
    if (this.hasPlayedRecording || this.gameStatus !== 'PLAYING') return;
    
    // Mark as played IMMEDIATELY to prevent multiple calls
    this.hasPlayedRecording = true;
    
    // Determine which recording to play based on night number
    let recordingFile = `night${this.nightNumber}.mp3`;
    
    // Special case for Night 6 bad ending
    if (this.nightNumber === 6 && this.isBadEndingNight6) {
      recordingFile = 'night6.mp3';
    }
    
    // Try to load and play the audio
    try {
      this.recordingAudio = new Audio(`./audio/recordings/${recordingFile}`);
      this.recordingAudio.volume = 0.7;
      
      this.recordingAudio.addEventListener('canplaythrough', () => {
        if (this.recordingAudio && this.gameStatus === 'PLAYING') {
          this.recordingAudio.play();
          this.isRecordingPlaying = true;
          this.recordingSkipButton.setVisible(true);
          this.recordingIndicator.setVisible(true);
          console.log(`🎙️ Playing Engineer recording: ${recordingFile}`);
        }
      });
      
      this.recordingAudio.addEventListener('ended', () => {
        this.stopRecording();
      });
      
      this.recordingAudio.addEventListener('error', () => {
        console.log(`🎙️ No recording found for: ${recordingFile}`);
        this.hasPlayedRecording = true; // Mark as played so we don't retry
      });
      
      this.recordingAudio.load();
    } catch (e) {
      console.log('🎙️ Audio playback not supported');
      this.hasPlayedRecording = true;
    }
  }
  
  /**
   * Stop the current recording
   */
  private stopRecording(): void {
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio.currentTime = 0;
      this.recordingAudio = null;
    }
    
    this.isRecordingPlaying = false;
    this.hasPlayedRecording = true;
    this.recordingSkipButton?.setVisible(false);
    this.recordingIndicator?.setVisible(false);
    console.log('🎙️ Recording stopped');
  }
  
  // ============================================
  // INPUT HANDLING
  // ============================================
  
  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    
    // Store key references for hold-to-aim (Phaser keys as backup)
    this._keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this._keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    
    // Use native DOM events for A/D keys - more reliable with browser extensions
    // This fixes issues where Phaser doesn't receive keyup events
    this.removeDomKeyListeners();  // Guard against stacking on restart
    this.domKeyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        this.keyADown = true;
        e.preventDefault();
      }
      if (e.key === 'd' || e.key === 'D') {
        this.keyDDown = true;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', this.domKeyDownHandler);
    
    this.domKeyUpHandler = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') {
        this.keyADown = false;
      }
      if (e.key === 'd' || e.key === 'D') {
        this.keyDDown = false;
      }
    };
    window.addEventListener('keyup', this.domKeyUpHandler);
    
    // Also reset on blur (when window loses focus)
    this.domBlurHandler = () => {
      this.keyADown = false;
      this.keyDDown = false;
    };
    window.addEventListener('blur', this.domBlurHandler);
    
    console.log('[INPUT] Native DOM key listeners registered for A/D');
    
    // Prevent browser from capturing other game keys
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.Q,
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.TAB,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);
    
    // Q - Toggle Merasmus view flip (Custom Night)
    keyboard.on('keydown-Q', () => {
      this.toggleMerasmusFlip();
    });

    // F - Toggle Wrangler
    keyboard.on('keydown-F', () => {
      if (this.gameStatus !== 'PLAYING') return;
      if (this.isPaused) return;
      if (this.isCameraMode) return; // Can't wrangler in camera mode
      if (!this.sentry.exists) return;
      
      this.sentry.isWrangled = !this.sentry.isWrangled;
      this.audio.playWranglerToggleSound(this.sentry.isWrangled);
      
      // Resume dispenser hum if turning wrangler off (no longer aiming)
      if (!this.sentry.isWrangled && !this.isTeleported) {
        this.sentry.aimedDoor = 'NONE';
        this.audio.startDispenserHum();
      }
      
      this.updateWranglerVisuals();
      this.updateHUD();
    });
    
    // A/D aim handling is now in updateAiming() called from update loop
    
    // SPACE - Fire (or remove sapper on Night 5+)
    keyboard.on('keydown-SPACE', () => {
      if (this.gameStatus !== 'PLAYING') return;
      if (this.isPaused) return;
      if (!this.sentry.exists) return;
      
      // Night 5+: Handle sapper removal - only when in Intel (can't remove sapper when teleported away)
      if (this.isSpyEnabled() && this.spy && this.spy.isSapping() && !this.isTeleported) {
        this.sapperRemoveClicks++;
        this.sapperRemoveTimeout = 2000; // Reset timeout (2 seconds to press again)
        
        if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
          // Sapper removed!
          this.spy.removeSapper();
          this.sapperIndicator.setVisible(false);
          this.audio.stopSapperSound();
          this.showAlert('SAPPER REMOVED!', 0x00ff00);
          this.sapperRemoveClicks = 0;
          this.audio.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
          this.audio.playSound('fire');
        }
        return; // Don't process normal fire when removing sapper
      }
      
      // Normal fire - requires wrangler
      if (!this.sentry.isWrangled) return;
      if (this.sentry.aimedDoor === 'NONE') return; // Can't fire at middle
      
      this.fireWrangler();
    });
    
    // TAB - Toggle Camera
    keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (this.gameStatus !== 'PLAYING') return;
      if (this.isPaused) return;
      
      this.toggleCameraMode();
    });
    
    // R - Smart key: Build if no sentry, Repair if damaged, Upgrade if full HP
    keyboard.on('keydown-R', () => {
      if (this.gameStatus !== 'PLAYING') return;
      if (this.isPaused) return;
      
      if (!this.sentry.exists) {
        // No sentry - build one
        this.buildSentry();
      } else if (this.sentry.hp === this.sentry.maxHp) {
        // Full HP - upgrade
        this.upgradeSentry();
      } else {
        // Damaged - repair
        this.repairSentry();
      }
    });
    
    // U - Upgrade
    // U key removed - R now handles both repair and upgrade
    
    // ESC - Pause/Resume
    keyboard.on('keydown-ESC', () => {
      if (this.gameStatus !== 'PLAYING') return;
      this.togglePause();
    });
  }
  
  // ============================================
  // MOBILE CONTROLS
  // ============================================

  /**
   * Merasmus mirror inverts pointer X, so left/right edge taps hit the opposite zone.
   * Swap which key each zone drives while flipped so screen-side aim stays intuitive.
   */
  private setMobileAimLeftActive(active: boolean): void {
    const mirrored = this.isMerasmusEnabled() && this.merasmusViewFlipped;
    if (mirrored) {
      this.keyDDown = active;
    } else {
      this.keyADown = active;
    }
  }

  private setMobileAimRightActive(active: boolean): void {
    const mirrored = this.isMerasmusEnabled() && this.merasmusViewFlipped;
    if (mirrored) {
      this.keyADown = active;
    } else {
      this.keyDDown = active;
    }
  }
  
  /**
   * Handle mobile action button press (context-sensitive)
   */
  private handleMobileAction(): void {
    // Check for sapper removal first (only when in Intel - can't remove sapper when teleported away)
    if (this.isSpyEnabled() && this.spy && this.spy.isSapping() && !this.isTeleported) {
      this.sapperRemoveClicks++;
      this.sapperRemoveTimeout = 2000;
      
      if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
        this.spy.removeSapper();
        this.sapperIndicator.setVisible(false);
        this.audio.stopSapperSound();
        this.showAlert('SAPPER REMOVED!', 0x00ff00);
        this.sapperRemoveClicks = 0;
        this.audio.playSound('fire');
      } else {
        this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
        this.audio.playSound('fire');
      }
      return;
    }
    
    // Then handle sentry actions
    if (!this.sentry.exists) {
      this.buildSentry();
    } else if (this.sentry.hp < this.sentry.maxHp) {
      this.repairSentry();
    } else if (this.sentry.level < 3) {
      this.upgradeSentry();
    }
  }
  
  /**
   * Pause the game if currently playing and not already paused.
   * Public so main.ts can pause when the mobile portrait overlay appears.
   */
  public pauseGame(): void {
    if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
    this.togglePause();
  }

  /**
   * Toggle pause state
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseMenu.setVisible(this.isPaused);
    
    if (this.isPaused) {
      // Pause the game
      this.audio.playPauseSound();
      this.audio.stopDetectionSound();
      this.audio.stopDispenserHum();
      this.audio.stopIntelRoomAmbience();
      this.audio.stopSniperLaserHum();
      this.audio.stopPyroCracklingAmbient();
      this.audio.stopMerasmusHum();
      this.audio.stopMedicGhostScream();  // Stop ghost scream during pause
      this.physics?.pause();
      
      // Pause Engineer recording if playing
      if (this.recordingAudio && this.isRecordingPlaying) {
        this.recordingAudio.pause();
      }
      
      // Show a random hint
      this.pauseMenu.showRandomHint();
    } else {
      // Resume
      this.audio.playUnpauseSound();
      this.physics?.resume();
      // Resume dispenser hum if in Intel room (plays even with cameras up)
      if (!this.isTeleported) {
        this.audio.startDispenserHum();
        this.audio.startIntelRoomAmbience();
      }
      // Resume Engineer recording if it was playing
      if (this.recordingAudio && this.isRecordingPlaying) {
        this.recordingAudio.play();
      }
      // Resume Pyro crackling if match is still lit (must restart fully, not just schedule)
      if (this.isPyroEnabled() && this.pyro && this.pyro.isMatchLit()) {
        this.audio.startPyroCracklingAmbient();
      }
      // Resume Medic ghost scream if ghost is still active
      if (this.medicGhostActive) {
        this.audio.playMedicGhostScream();
      }
    }
  }
  
  /**
   * Update aim direction based on held keys (called every frame)
   */
  private updateAiming(): void {
    if (!this.sentry.isWrangled || !this.sentry.exists || this.isCameraMode) {
      return;
    }
    
    const prevAim = this.sentry.aimedDoor;
    
    // Use native DOM key states (more reliable than Phaser with browser extensions)
    const rawA = this.keyADown;
    const rawD = this.keyDDown;
    const mirrorAim = this.isMerasmusEnabled() && this.merasmusViewFlipped;
    const aDown = mirrorAim ? rawD : rawA;
    const dDown = mirrorAim ? rawA : rawD;
    
    // Hold A = aim left, Hold D = aim right, Neither = aim middle
    if (aDown && !dDown) {
      this.sentry.aimedDoor = 'LEFT';
    } else if (dDown && !aDown) {
      this.sentry.aimedDoor = 'RIGHT';
    } else {
      this.sentry.aimedDoor = 'NONE';
    }
    
    // Only update visuals if aim changed
    if (prevAim !== this.sentry.aimedDoor) {
      this.updateWranglerVisuals();
      this.updateHUD();
      
      // Play aim sound when changing aim direction
      this.audio.playWranglerAimSound();
      
      // Pause dispenser hum when aiming down a hallway (for focus)
      // Only pause if sentry actually exists - otherwise resume hum
      if (this.sentry.aimedDoor !== 'NONE' && this.sentry.exists) {
        this.audio.stopDispenserHum();
      } else if (!this.isTeleported && !this.isPaused) {
        // Resume hum when no longer aiming (or sentry destroyed)
        this.audio.startDispenserHum();
      }
    }
  }
  
  // ============================================
  // WRANGLER MECHANICS
  // ============================================

  private isHeavyAtHallway(hall: 'LEFT' | 'RIGHT'): boolean {
    if (!this.isHeavyEnabled() || !this.hasHeavyStarted()) return false;
    if (!this.heavy.isActive()) return false;
    const node = hall === 'LEFT' ? 'LEFT_HALL' : 'RIGHT_HALL';
    return this.heavy.currentNode === node;
  }

  private hideHeavyDoorwayShadow(): void {
    this.heavyInDoorway.setVisible(false);
    this.heavyInDoorway.clearMask(false);
    this.stopHeavyDoorwayPulse();
    this.heavyDoorwayLastLured = null;
  }

  private showHeavyDoorwayShadow(doorX: number): void {
    const doorCenterY = 720 / 2 - 50;
    const isLured = this.heavy.isCurrentlyLured();
    if (this.heavyDoorwayLastLured !== isLured) {
      drawHeavyDoorwayShadow(this.heavyDoorwayGraphics, isLured);
      this.heavyDoorwayLastLured = isLured;
    }
    this.heavyInDoorway.setPosition(doorX, doorCenterY);
    this.heavyInDoorway.setMask(
      doorX < 640 ? this.heavyDoorwayLeftMask : this.heavyDoorwayRightMask
    );
    this.heavyInDoorway.setVisible(true);
    this.startHeavyDoorwayPulse();
  }

  private startHeavyDoorwayPulse(): void {
    if (this.heavyDoorwayPulseTween?.isPlaying()) return;
    this.heavyDoorwayPulseTween = this.tweens.add({
      targets: this.heavyInDoorway,
      scaleX: 1.48,
      scaleY: 1.48,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopHeavyDoorwayPulse(): void {
    if (this.heavyDoorwayPulseTween) {
      this.heavyDoorwayPulseTween.stop();
      this.heavyDoorwayPulseTween.remove();
      this.heavyDoorwayPulseTween = null;
    }
    if (this.heavyInDoorway) {
      this.heavyInDoorway.setScale(1.4);
    }
  }
  
  private updateWranglerVisuals(): void {
    // Hide enemies by default
    this.scoutInDoorway.setVisible(false);
    this.soldierInDoorway.setVisible(false);
    this.heavyInDoorway.setVisible(false);
    
    // Hide Pyro masks by default
    if (this.pyroMaskLeft) this.pyroMaskLeft.setVisible(false);
    if (this.pyroMaskRight) this.pyroMaskRight.setVisible(false);
    
    // Hide Über glows by default
    if (this.uberGlowLeft) this.uberGlowLeft.setVisible(false);
    if (this.uberGlowRight) this.uberGlowRight.setVisible(false);
    
    // Reset door colors to dark
    this.leftDoor.setFillStyle(0x000000);
    this.rightDoor.setFillStyle(0x000000);
    
    let enemyDetected = false;
    let heavyDetected = false;
    
    if (!this.sentry.exists || !this.sentry.isWrangled) {
      this.aimBeam.setVisible(false);
      this.stopHeavyDoorwayPulse();
      this.heavyDoorwayLastLured = null;
      this.heavyInDoorway.clearMask(false);
      this.audio.stopDetectionSound();
      return;
    }
    
    this.aimBeam.setVisible(true);
    this.aimBeam.clear();
    
    const sentryX = 640;
    const sentryY = 500;
    
    if (this.sentry.aimedDoor === 'LEFT') {
      // ========== WRANGLER CONE CONFIG (LEFT DOOR) ==========
      // Adjust these values to change the cone shape:
      const coneEdgeX = 50;    // How far left the cone reaches (lower = wider cone)
        const coneTopY = 170;    // Top of cone (lower = taller cone)
        const coneBottomY = 450; // Bottom of cone (higher = shorter cone)
        const beamTargetX = 100; // Where the laser beam points
      const beamTargetY = 290; // Vertical position of beam target
      // ======================================================
      
      // Draw cone of light - covers door area
      this.aimBeam.fillStyle(0xff4400, 0.06);
      this.aimBeam.fillTriangle(sentryX, sentryY, coneEdgeX, coneTopY, coneEdgeX, coneBottomY);
      
      // Main beam line
      this.aimBeam.lineStyle(3, 0xff0000, 0.7);
      this.aimBeam.lineBetween(sentryX, sentryY, beamTargetX, beamTargetY);
      
      // Laser dot at target
      this.aimBeam.fillStyle(0xff0000, 0.9);
      this.aimBeam.fillCircle(beamTargetX, beamTargetY, 6);
      
      // Highlight left door with light
      this.leftDoor.setFillStyle(0x331111);

      // Show Scout if they're at the left door (and enabled)
      const scoutAtDoor = this.isScoutEnabled() && 
                          this.scout.currentNode === 'LEFT_HALL' && 
                          this.scout.isActive() &&
                          (this.scout.state === 'WAITING' || this.scout.state === 'ATTACKING');
      this.scoutInDoorway.setVisible(scoutAtDoor);
      enemyDetected = scoutAtDoor;
      
      // Show Über glow if Scout is Übered
      if (scoutAtDoor && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SCOUT')) {
        drawUberGlow(this.uberGlowLeft, 120, 720 / 2 - 30);
        this.uberGlowLeft.setVisible(true);
        // Change door color to red when Übered
        this.leftDoor.setFillStyle(0x441122);
      }
      
      // Show Pyro floating mask if Pyro is in left hall (Custom Night)
      // Hallway hiss is heard from Intel; wrangler light reveals the mask visually.
      const pyroInLeftHall = this.isPyroEnabled() && this.pyro && 
                             !this.pyro.isForceDespawned() && 
                             this.pyro.getHallway() === 'LEFT';
      if (this.pyroMaskLeft && pyroInLeftHall) {
        this.pyroMaskLeft.setVisible(true);
        enemyDetected = true;
      }

      // Massive Heavy shadow behind other left-door silhouettes
      if (this.isHeavyAtHallway('LEFT')) {
        this.showHeavyDoorwayShadow(120);
        enemyDetected = true;
        heavyDetected = true;
      }
    } else if (this.sentry.aimedDoor === 'RIGHT') {
      // ========== WRANGLER CONE CONFIG (RIGHT DOOR) ==========
      // Adjust these values to change the cone shape:
      const coneEdgeX = 1230;  // How far right the cone reaches (higher = wider cone)
        const coneTopY = 170;    // Top of cone (lower = taller cone)
        const coneBottomY = 450; // Bottom of cone (higher = shorter cone)
        const beamTargetX = 1180; // Where the laser beam points
      const beamTargetY = 290;  // Vertical position of beam target
      // ========================================================
      
      // Draw cone of light - covers door area
      this.aimBeam.fillStyle(0xff4400, 0.06);
      this.aimBeam.fillTriangle(sentryX, sentryY, coneEdgeX, coneTopY, coneEdgeX, coneBottomY);
      
      // Main beam line
      this.aimBeam.lineStyle(3, 0xff0000, 0.7);
      this.aimBeam.lineBetween(sentryX, sentryY, beamTargetX, beamTargetY);
      
      // Laser dot at target
      this.aimBeam.fillStyle(0xff0000, 0.9);
      this.aimBeam.fillCircle(beamTargetX, beamTargetY, 6);
      
      // Highlight right door with light
      this.rightDoor.setFillStyle(0x331111);
      
      // Show Soldier if they're at the right door (and enabled)
      const soldierAtDoor = this.isSoldierEnabled() && 
                            this.soldier.currentNode === 'RIGHT_HALL' && 
                            this.soldier.isActive() &&
                            (this.soldier.state === 'WAITING' || this.soldier.state === 'SIEGING');
      this.soldierInDoorway.setVisible(soldierAtDoor);
      enemyDetected = soldierAtDoor;
      
      // Show Über glow if Soldier is Übered
      if (soldierAtDoor && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SOLDIER')) {
        drawUberGlow(this.uberGlowRight, 1280 - 120, 720 / 2 - 30);
        this.uberGlowRight.setVisible(true);
        // Change door color to red when Übered
        this.rightDoor.setFillStyle(0x441122);
      }
      
      // Show Pyro floating mask if Pyro is in right hall (Custom Night)
      // Hallway hiss is heard from Intel; wrangler light reveals the mask visually.
      const pyroInRightHall = this.isPyroEnabled() && this.pyro && 
                              !this.pyro.isForceDespawned() && 
                              this.pyro.getHallway() === 'RIGHT';
      if (this.pyroMaskRight && pyroInRightHall) {
        this.pyroMaskRight.setVisible(true);
        enemyDetected = true;
      }

      // Massive Heavy shadow behind other right-door silhouettes
      if (this.isHeavyAtHallway('RIGHT')) {
        this.showHeavyDoorwayShadow(1280 - 120);
        enemyDetected = true;
        heavyDetected = true;
      }
    } else {
      // Aiming middle (NONE) - cone straight ahead
      this.aimBeam.fillStyle(0xff4400, 0.06);
      this.aimBeam.fillTriangle(sentryX, sentryY, sentryX - 80, 250, sentryX + 80, 250);
      
      this.aimBeam.lineStyle(3, 0xff0000, 0.6);
      this.aimBeam.lineBetween(sentryX, sentryY, sentryX, 250);
    }

    if (!heavyDetected) {
      this.stopHeavyDoorwayPulse();
      this.heavyDoorwayLastLured = null;
      this.heavyInDoorway.clearMask(false);
    }
    
    // Handle scary detection sound (hysteresis avoids rapid start/stop flicker at doorway edge)
    if (enemyDetected) {
      this.audio.detectionSoundReleaseFrames = 0;
      this.audio.startDetectionSound(heavyDetected);
      this.audio.updateDetectionSoundIntensity(heavyDetected);
    } else if (this.audio.isPlayingDetectionSound) {
      this.audio.detectionSoundReleaseFrames++;
      if (this.audio.detectionSoundReleaseFrames >= 4) {
        this.audio.stopDetectionSound();
      }
    }
  }
  
  /**
   * Update Sniper laser visuals - shown when Sniper is in a hallway (Night 4+)
   * These are visible even WITHOUT the wrangler aimed!
   */
  private updateSniperVisuals(): void {
    if (!this.isSniperEnabled()) return;
    
    // Sniper must be in hallway, active, AND not currently lured to be dangerous
    const sniperThreatening = this.sniper.isActive() && !this.sniper.isCurrentlyLured();
    const sniperInLeftHall = this.sniper.currentNode === 'LEFT_HALL' && sniperThreatening;
    const sniperInRightHall = this.sniper.currentNode === 'RIGHT_HALL' && sniperThreatening;
    
    // Show/hide laser based on Sniper position
    const laserVisible = (sniperInLeftHall || sniperInRightHall) && !this.isCameraMode;
    this.sniperLaserLeft.setVisible(sniperInLeftHall && !this.isCameraMode);
    this.sniperLaserRight.setVisible(sniperInRightHall && !this.isCameraMode);
    
    // Play/stop laser hum - SOUND plays even in camera mode (important feedback!)
    // Only the visual laser hides when in camera mode
    const sniperAiming = sniperInLeftHall || sniperInRightHall;
    if (sniperAiming) {
      const progress = this.sniper.getChargeProgress();
      this.audio.startSniperLaserHum(progress);
    } else {
      this.audio.stopSniperLaserHum();
    }
    
    // Update charge countdown text when Sniper is charging (not when lured!)
    if ((sniperInLeftHall || sniperInRightHall) && !this.isCameraMode) {
      const progress = this.sniper.getChargeProgress();
      const timeRemaining = Math.ceil((1 - progress) * GAME_CONSTANTS.SNIPER_CHARGE_TIME / 1000);
      const shotsRemaining = this.sniper.getShotsRemaining();
      
      // Sniper ALWAYS requires 2 shots to repel (regardless of sentry level)
      const shotText = shotsRemaining === 1 ? '1 shot to repel' : `${shotsRemaining} shots to repel`;
      
      this.sniperChargeText.setText(`⚠ SNIPER AIMING! ${timeRemaining}s (${shotText})`);
      this.sniperChargeText.setVisible(true);
      
      // Intensify laser based on charge progress
      const intensity = 0.3 + progress * 0.7;
      this.sniperLaserLeft.setAlpha(intensity);
      this.sniperLaserRight.setAlpha(intensity);
      
      // Red vignette effect as charge nears completion
      if (progress > 0.5) {
        this.sniperChargeOverlay.setAlpha((progress - 0.5) * 0.3);
        this.sniperChargeOverlay.setVisible(true);
      }
    } else {
      this.sniperChargeText.setVisible(false);
      this.sniperChargeOverlay.setVisible(false);
      this.sniperChargeOverlay.setAlpha(0);
    }
  }
  
  /**
   * Play looping repair buzz while player holds the repair bar
   * Called each frame while administratorRepairActive; manages its own throttle via _administratorRepairSoundTimer
   */
  private fireWrangler(): void {
    if (!this.sentry.exists || !this.sentry.isWrangled) return;
    if (this.sentry.aimedDoor === 'NONE') return; // Can't fire when not aiming at a door
    
    // Check cooldown (1 second between shots)
    if (this.wranglerCooldown > 0) {
      this.showAlert('COOLING DOWN...', 0xff6600);
      this.audio.playDeniedSound();
      return;
    }
    
    // Check if we have enough metal to fire (always costs 50)
    if (this.metal < 50) {
      this.showAlert('NOT ENOUGH METAL TO FIRE!', 0xff0000);
      this.audio.playDeniedSound();
      return;
    }
    
    // Deduct metal cost for firing
    this.metal -= 50;
    
    // Start cooldown
    this.wranglerCooldown = this.WRANGLER_COOLDOWN;
    
    // Visual feedback
    this.cameras.main.shake(100, 0.01);
    this.audio.playSound('fire');
    
    // Fire bullet projectile
    const targetX = this.sentry.aimedDoor === 'LEFT' ? 120 : 1160;
    const targetY = 310;
    this.fireBulletProjectile(640, 500, targetX, targetY);
    
    // Flash the aim beam
    this.aimBeam.clear();
    this.aimBeam.lineStyle(8, 0xffff00, 1);
    if (this.sentry.aimedDoor === 'LEFT') {
      this.aimBeam.lineBetween(640, 500, 120, 310);
    } else {
      this.aimBeam.lineBetween(640, 500, 1160, 310);
    }
    
    // Reset beam after flash
    this.time.delayedCall(100, () => {
      // Don't run after death - updateWranglerVisuals can restart the
      // detection sound over the jumpscare
      if (this.gameStatus !== 'PLAYING') return;
      this.updateWranglerVisuals();
    });
    
    // Check if we hit an enemy
    let hitEnemy = false;
    
    // PYRO REFLECTION CHECK - Pyro reflects sentry fire and destroys sentry!
    // This check happens BEFORE other enemy checks
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      const pyroHallway = this.pyro.getHallway();
      const firingAtPyro = (this.sentry.aimedDoor === 'LEFT' && pyroHallway === 'LEFT') ||
                           (this.sentry.aimedDoor === 'RIGHT' && pyroHallway === 'RIGHT');
      if (firingAtPyro) {
        // Pyro reflects the shot! Sentry is destroyed!
        console.log('🔥 PYRO REFLECTED YOUR SHOT!');
        this.showAlert('PYRO REFLECTED! SENTRY DESTROYED!', 0xff4400);
        this.destroySentry();
        this.audio.playPyroReflectSound();
        // Pyro teleports away immediately after reflecting
        this.pyro.teleportToRandomRoom();
        return; // Don't process any other hits
      }
    }
    
    if (this.sentry.aimedDoor === 'LEFT') {
      // Check Scout at left door (if enabled)
      if (this.isScoutEnabled() && this.scout.currentNode === 'LEFT_HALL' && 
          (this.scout.state === 'WAITING' || this.scout.state === 'ATTACKING')) {
        // Check if Scout is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SCOUT')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true; // Still counts as hitting (spent metal)
        } else {
          this.scout.driveAway();
          this.showAlert('SCOUT REPELLED!', 0x00ff00);
          this.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Demoman at left door (if enabled)
      if (this.isDemomanEnabled() && this.demoman.getChargeDoor() === 'LEFT' &&
          (this.demoman.currentNode === 'LEFT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          // Bonus: +25 metal if hit during body phase (not just glow)
          if (this.demoman.isInBodyPhase()) {
            this.metal = Math.min(this.metal + 25, GAME_CONSTANTS.MAX_METAL);
            this.showAlert('REPELLED LAST SECOND! +25 METAL', 0x00ff00);
          } else {
            this.showAlert('DEMOMAN REPELLED!', 0x00ff00);
          }
          this.demoman.deter();
          // Allow Pyro to teleport to this hallway again
          if (this.isPyroEnabled() && this.pyro) {
            this.pyro.onDemomanChargeEnd();
          }
          this.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Sniper at left door (Night 4+) - ALWAYS requires 2 shots to repel
      // Only hit Sniper if he's actually AIMING (not if lured and just passing through)
      if (this.isSniperEnabled() && this.sniper.currentNode === 'LEFT_HALL' && 
          this.sniper.isActive() && !this.sniper.isCurrentlyLured()) {
        const fullyRepelled = this.sniper.wardOff(this.sentry.level);
        if (fullyRepelled) {
          this.showAlert('SNIPER DRIVEN AWAY!', 0x00ff00);
          this.audio.playEnemyRetreatSound();
        }
        // No alert for partial hits - the sniper aiming UI already shows shots remaining
        hitEnemy = true;
      }
    } else if (this.sentry.aimedDoor === 'RIGHT') {
      // Check Soldier at right door (if enabled)
      if (this.isSoldierEnabled() && this.soldier.currentNode === 'RIGHT_HALL' && 
          (this.soldier.state === 'WAITING' || this.soldier.state === 'SIEGING')) {
        // Check if Soldier is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SOLDIER')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          this.soldier.driveAway();
          this.showAlert('SOLDIER REPELLED!', 0x00ff00);
          this.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Demoman at right door (if enabled)
      if (this.isDemomanEnabled() && this.demoman.getChargeDoor() === 'RIGHT' &&
          (this.demoman.currentNode === 'RIGHT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          // Bonus: +25 metal if hit during body phase (not just glow)
          if (this.demoman.isInBodyPhase()) {
            this.metal = Math.min(this.metal + 25, GAME_CONSTANTS.MAX_METAL);
            this.showAlert('REPELLED LAST SECOND! +25 METAL', 0x00ff00);
          } else {
            this.showAlert('DEMOMAN REPELLED!', 0x00ff00);
          }
          this.demoman.deter();
          // Allow Pyro to teleport to this hallway again
          if (this.isPyroEnabled() && this.pyro) {
            this.pyro.onDemomanChargeEnd();
          }
          this.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Sniper at right door (if enabled) - ALWAYS requires 2 shots to repel
      // Only hit Sniper if he's actually AIMING (not if lured and just passing through)
      if (this.isSniperEnabled() && this.sniper.currentNode === 'RIGHT_HALL' && 
          this.sniper.isActive() && !this.sniper.isCurrentlyLured()) {
        const fullyRepelled = this.sniper.wardOff(this.sentry.level);
        if (fullyRepelled) {
          this.showAlert('SNIPER DRIVEN AWAY!', 0x00ff00);
          this.audio.playEnemyRetreatSound();
        }
        // No alert for partial hits - the sniper aiming UI already shows shots remaining
        hitEnemy = true;
      }
    }

    // If we missed, show feedback (Heavy absorbs sentry fire — lure only)
    if (!hitEnemy) {
      const heavyBlocking =
        (this.sentry.aimedDoor === 'LEFT' && this.isHeavyAtHallway('LEFT')) ||
        (this.sentry.aimedDoor === 'RIGHT' && this.isHeavyAtHallway('RIGHT'));
      if (heavyBlocking) {
        this.showAlert('HEAVY IGNORES SENTRY! LURE HIM!', 0xff6600);
      } else {
        this.showAlert('FIRED! (-50 metal)', 0xffaa00);
      }
    }
  }
  
  // ============================================
  // SENTRY MANAGEMENT
  // ============================================
  
  private buildSentry(): void {
    if (this.sentry.exists) {
      this.showAlert('Sentry already exists!', 0xffff00);
      return;
    }
    
    // Can't build when cameras are up - must lower cameras first
    if (this.isCameraMode) {
      this.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't build remotely - must be in Intel room
    if (this.isTeleported) {
      this.showAlert('Return to Intel to build!', 0xff6600);
      return;
    }
    
    if (this.metal < GAME_CONSTANTS.BUILD_SENTRY_COST) {
      this.showAlert('Not enough metal! (100 required)', 0xff0000);
      return;
    }
    
    this.metal -= GAME_CONSTANTS.BUILD_SENTRY_COST;
    this.sentry = {
      exists: true,
      level: 1,
      hp: SENTRY_MAX_HP[1],
      maxHp: SENTRY_MAX_HP[1],
      isWrangled: false,
      aimedDoor: 'LEFT',
    };
    
    this.sentryGraphic.setVisible(true);
    this.updateSentryVisuals();
    this.updateHUD();
    this.showAlert('SENTRY BUILT!', 0x00ff00);
    this.audio.playSentryBuildSound();
  }
  
  private upgradeSentry(): void {
    if (!this.sentry.exists) {
      this.showAlert('No sentry to upgrade!', 0xff0000);
      return;
    }
    
    // Can't upgrade when cameras are up - must lower cameras first
    if (this.isCameraMode) {
      this.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't upgrade remotely - must be in Intel room
    if (this.isTeleported) {
      this.showAlert('Return to Intel to upgrade!', 0xff6600);
      return;
    }
    
    if (this.sentry.level >= 3) {
      this.showAlert('Sentry already max level!', 0xffff00);
      return;
    }
    
    if (this.sentry.hp < this.sentry.maxHp) {
      this.showAlert('Repair sentry to full HP first!', 0xff0000);
      return;
    }
    
    if (this.metal < GAME_CONSTANTS.UPGRADE_SENTRY_COST) {
      this.showAlert('Not enough metal! (200 required)', 0xff0000);
      return;
    }
    
    this.metal -= GAME_CONSTANTS.UPGRADE_SENTRY_COST;
    this.sentry.level = (this.sentry.level + 1) as SentryLevel;
    this.sentry.maxHp = SENTRY_MAX_HP[this.sentry.level];
    this.sentry.hp = this.sentry.maxHp; // Full heal on upgrade
    
    this.updateSentryVisuals();
    this.updateHUD();
    this.showAlert(`SENTRY UPGRADED TO L${this.sentry.level}!`, 0x00ff00);
    this.audio.playSentryUpgradeSound();
  }
  
  private repairSentry(): void {
    if (!this.sentry.exists) {
      this.showAlert('No sentry to repair!', 0xff0000);
      return;
    }
    
    // Can't repair when cameras are up - must lower cameras first
    if (this.isCameraMode) {
      this.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't repair remotely - must be in Intel room
    if (this.isTeleported) {
      this.showAlert('Return to Intel to repair!', 0xff6600);
      return;
    }
    
    if (this.sentry.hp >= this.sentry.maxHp) {
      this.showAlert('Sentry at full health!', 0xffff00);
      return;
    }
    
    // Calculate how much HP is missing and only charge for what's needed
    const missingHp = this.sentry.maxHp - this.sentry.hp;
    const hpToRepair = Math.min(missingHp, GAME_CONSTANTS.REPAIR_SENTRY_AMOUNT);
    const metalCost = hpToRepair; // 1 metal = 1 HP
    
    if (this.metal < 1) {
      this.showAlert('Not enough metal!', 0xff0000);
      return;
    }
    
    // Use available metal, up to what's needed
    const actualCost = Math.min(metalCost, Math.floor(this.metal));
    const actualRepair = actualCost; // 1:1 ratio
    
    this.metal -= actualCost;
    this.sentry.hp = Math.min(this.sentry.hp + actualRepair, this.sentry.maxHp);
    
    this.updateHUD();
    this.showAlert(`+${Math.floor(actualRepair)} HP (-${Math.floor(actualCost)} metal)`, 0x00ff00);
    this.audio.playSentryRepairSound();
  }
  
  private damageSentry(amount: number): void {
    if (!this.sentry.exists) return;
    
    this.sentry.hp -= amount;
    this.cameras.main.shake(200, 0.02);
    
    // Play rocket hit sound
    this.audio.playSound('rocketHit');
    
    // Flash sentry red
    this.sentryBody.setFillStyle(0xff0000);
    this.time.delayedCall(200, () => {
      if (this.sentry.exists) {
        this.sentryBody.setFillStyle(0xBB4444); // Back to RED team color
      }
    });
    
    if (this.sentry.hp <= 0) {
      this.destroySentry();
    }
    
    this.updateHUD();
  }
  
  private destroySentry(): void {
    this.sentry.exists = false;
    this.sentry.hp = 0;
    this.sentry.isWrangled = false;
    this.sentry.aimedDoor = 'NONE';
    
    // Track destruction for save system (only during story nights 1-5)
    if (!this.isCustomNightMode && this.nightNumber <= 5) {
      this.sessionDestructions++;
      console.log(`🔧 Sentry destroyed! Session destructions: ${this.sessionDestructions}`);
    }
    
    this.sentryGraphic.setVisible(false);
    this.aimBeam.setVisible(false);
    
    // Hide any enemies shown in doorways (fixes Scout glitch)
    this.scoutInDoorway.setVisible(false);
    this.soldierInDoorway.setVisible(false);
    this.hideHeavyDoorwayShadow();
    
    // Stop detection sound
    this.audio.stopDetectionSound();
    
    // Resume dispenser hum if in Intel room (was paused for aiming)
    if (!this.isTeleported && !this.isPaused) {
      this.audio.startDispenserHum();
    }
    
    // Reset door colors
    this.leftDoor.setFillStyle(0x000000);
    this.rightDoor.setFillStyle(0x000000);
    
    // Play sentry destroyed sound
    this.audio.playSound('sentryDestroyed');
    
    this.showAlert('SENTRY DESTROYED!', 0xff0000);
    
    // Clear any active sapper (sentry is gone, so sapper is too)
    if (this.isSpyEnabled() && this.spy.isSapping()) {
      this.spy.removeSapper();
      this.sapperIndicator.setVisible(false);
      this.audio.stopSapperSound();
      console.log('🕵️ Sapper destroyed with sentry');
    }
    
    // If Soldier was sieging, he starts breach countdown
    if (this.isSoldierEnabled() && this.soldier.isSieging()) {
      this.soldier.sentryDestroyed();
      this.showAlert('⚠ SOLDIER BREACHING IN 3 SECONDS! ⚠', 0xff0000);
      
      // Flash the screen red as warning
      this.cameras.main.flash(500, 255, 0, 0, false);
    }
  }
  
  private updateSentryVisuals(): void {
    // Update level badge text
    const levelText = this.sentryGraphic.list[3] as Phaser.GameObjects.Text;
    levelText.setText(`L${this.sentry.level}`);
    
    // Scale sentry based on level
    const scale = 0.8 + (this.sentry.level * 0.1);
    this.sentryGraphic.setScale(scale);
  }
  
  /**
   * Auto-defense: Unwrangled sentry automatically defends but is destroyed
   */
  private triggerAutoDefense(enemyType: string): void {
    if (!this.sentry.exists) return;
    
    // Sentry fires and destroys itself
    this.showAlert(`SENTRY AUTO-DEFENSE vs ${enemyType}!`, 0xffff00);
    
    // Drive away the enemy
    if (enemyType === 'SCOUT') {
      this.scout.driveAway();
    } else if (enemyType === 'DEMOMAN') {
      this.demoman.deter();
      // Allow Pyro to teleport to hallways again
      if (this.isPyroEnabled() && this.pyro) {
        this.pyro.onDemomanChargeEnd();
      }
    } else {
      this.soldier.driveAway();
    }
    
    // Destroy sentry
    this.destroySentry();
  }
  
  /**
   * Handle when player escapes an Übered enemy by teleporting away
   * The enemy retreats, sentry is destroyed, and Medic picks a new target next hour
   */
  private handleUberedEnemyEscaped(enemyType: UberTarget): void {
    // Drive away the enemy (they can't wait in Intel like normal - Über ran out)
    if (enemyType === 'SCOUT') {
      this.scout.driveAway();
    } else if (enemyType === 'SOLDIER') {
      this.soldier.driveAway();
    } else if (enemyType === 'DEMOMAN') {
      this.demoman.deter();
      // Allow Pyro to teleport to hallways again
      if (this.isPyroEnabled() && this.pyro) {
        this.pyro.onDemomanChargeEnd();
      }
    }
    
    // Destroy sentry if it exists
    if (this.sentry.exists) {
      this.showAlert('SENTRY DESTROYED BY ÜBER!', 0xff4444);
      this.destroySentry();
    }
    
    // Notify Medic that the attack resolved - will pick new target next hour
    if (this.medic) {
      this.medic.onTargetAttackResolved();
    }
    
    // Reset Medic ghost cooldown to prevent immediate spawn after Über ends
    // Ghost should wait at least 30 seconds after an Über attack resolves
    this.medicGhostCooldown = Math.max(this.medicGhostCooldown, 30000);
    
    console.log(`💉 ${enemyType} Über attack resolved - player escaped!`);
  }
  
  // ============================================
  // CAMERA SYSTEM
  // ============================================
  
  private toggleCameraMode(): void {
    if (this.isCameraMode) {
      // Exiting camera mode - restore wrangler state if it was on before
      this.audio.playScreenFlipSound('down');
      this.isCameraMode = false;
      this.isCameraBooting = false;
      this.cameraBootTimer = 0;
      this.cameraUI.setVisible(false);
      this.administratorRepairActive = false; // stop repair if camera closed mid-hold
      // Hide vent UI but remember which tab was active
      if (this.isVentCameraMode) {
        this.ventUI?.setVisible(false);
        this.ventPanelControls?.setVisible(false);
      }
      if (this.wasWrangledBeforeCamera && this.sentry.exists) {
        this.sentry.isWrangled = true;
      }
    } else {
      // Entering camera mode - remember wrangler state and turn it off
      this.wasWrangledBeforeCamera = this.sentry.isWrangled;
      this.isCameraMode = true;
      this.cameraUI.setVisible(true);
      this.sentry.isWrangled = false;
      this.audio.stopDetectionSound(); // Stop scary sound when viewing cameras

      // Restore ROOMS/VENTS tab state from last time
      if (this.isVentCameraMode && this.isPaulingEnabled()) {
        this.ventUI?.setVisible(true);
        this.ventPanelControls?.setVisible(true);
        this.cameraMapContent?.setVisible(false);
        this.teleportButton?.setVisible(false);
        this.cameraLureButton?.setVisible(false);
        this.mapTitleText?.setText('◈ VENT MAP ◈');
        this.mapTitleText?.setColor('#9944cc');
      }
      
      // Initialize shared audio context on user gesture (camera button click)
      // This ensures camera switch static works on Night 1+ (browser autoplay policy)
      if (!this.audio.sharedAudioContext || this.audio.sharedAudioContext.state === 'closed') {
        try {
          this.audio.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        } catch (e) {
          // Audio not available
        }
      }
      if (this.audio.sharedAudioContext && this.audio.sharedAudioContext.state === 'suspended') {
        this.audio.sharedAudioContext.resume();
      }
      
      // Start camera boot-up sequence (1 second delay)
      this.isCameraBooting = true;
      this.cameraBootTimer = 0;
      this.cameraBootOverlay.setVisible(true);

      // Play screen flip + camera boot sound
      this.audio.playScreenFlipSound('up');
      this.audio.playCameraBootSound();
      
      // Reset boot bar to 0
      const bootBarFill = this.cameraBootOverlay.getByName('bootBarFill') as Phaser.GameObjects.Rectangle;
      const bootPercent = this.cameraBootOverlay.getByName('bootPercent') as Phaser.GameObjects.Text;
      if (bootBarFill) bootBarFill.setSize(0, 14);
      if (bootPercent) bootPercent.setText('0%');
      
      // Reset aim states (important for mobile touch zones)
      this.keyADown = false;
      this.keyDDown = false;
      this.sentry.aimedDoor = 'NONE';
      
      // Select first camera by default and update view
      this.selectCamera(this.selectedCamera);
    }
    
    this.updateWranglerVisuals();
    this.updateHUD();
  }
  
  /**
   * Update the camera feed view - NO map icons shown (player must check cameras!)
   */
  private updateCameraView(): void {
    if (!this.isCameraMode) return;
    
    // Enemy map icons are intentionally NOT updated - player must check cameras to find enemies
    
    // Update camera feed view based on selected camera
    const selectedCam = CAMERAS[this.selectedCamera];
    
    // Check if camera is destroyed (Night 3+)
    if (this.nightNumber >= 3) {
      const camState = this.cameraStates.get(selectedCam.id);
      if (camState && camState.destroyed) {
        // Camera destroyed - show overlay, hide everything else
        this.cameraDestroyedOverlay.setVisible(true);
        this.cameraFeedEnemy.setVisible(false);
        this.cameraFeedEnemy2.setVisible(false);
        this.cameraFeedEnemy3.setVisible(false);
        this.cameraFeedEmpty.setVisible(false);
        this.cameraFeedDemoHead.setVisible(false);
        this.cameraLureIndicator.setVisible(false);
        this.cameraWatchWarning.setVisible(false); // Hide patience meter too!
        
        // Update timer display (list[3] is the timer text)
        const remaining = Math.max(0, Math.ceil((camState.destroyedUntil - Date.now()) / 1000));
        const timerText = this.cameraDestroyedOverlay.list[3] as Phaser.GameObjects.Text;
        timerText.setText(`AUTO REPAIR: ${remaining}s`);
        
        // Also update destroyed text (only Heavy can destroy cameras now)
        this.cameraDestroyedText.setText(`-- HEAVY DESTROYED CAMERA --`);
        return;
      } else {
        this.cameraDestroyedOverlay.setVisible(false);
      }
    }

    // Administrator: camera view is always unobstructed — repair is done via the teleport button
    
    // Update lure indicator - show if there's a lure at this camera
    if (this.activeLure && this.activeLure.node === selectedCam.node) {
      this.cameraLureIndicator.setVisible(true);
      const lureText = this.cameraLureIndicator.list[2] as Phaser.GameObjects.Text;
      const lureBg = this.cameraLureIndicator.list[0] as Phaser.GameObjects.Rectangle;
      
      if (this.activeLure.playing) {
        lureText.setText('LURE ACTIVE!');
        lureText.setColor('#00ff44');
        lureBg.setFillStyle(0x225522, 0.9);
        lureBg.setStrokeStyle(2, 0x44ff44);
      } else {
        lureText.setText('LURE PLACED');
        lureText.setColor('#ffcc00');
        lureBg.setFillStyle(0x553300, 0.9);
        lureBg.setStrokeStyle(2, 0xffaa00);
      }
    } else {
      this.cameraLureIndicator.setVisible(false);
    }
    
    const scoutAtCam = this.isScoutEnabled() && this.scout.currentNode === selectedCam.node && this.scout.isActive();
    const soldierAtCam = this.isSoldierEnabled() && this.soldier.currentNode === selectedCam.node && this.soldier.isActive();
    
    // Check for Demoman - both head and charging body
    const demomanHeadAtCam = this.isDemomanEnabled() && this.demoman.isHeadAtCamera(selectedCam.node);
    const demomanBodyAtCam = this.isDemomanEnabled() && this.demoman.isCharging() && 
                             this.demoman.currentNode === selectedCam.node;
    
    // Check for Heavy and Sniper
    const heavyAtCam = this.isHeavyEnabled() && this.heavy.currentNode === selectedCam.node && this.heavy.isActive();
    const sniperAtCam = this.isSniperEnabled() && this.sniper.currentNode === selectedCam.node && this.sniper.isActive();
    
    // Check for Spy - only visible when in DISGUISE state
    const spyAtCam = this.isSpyEnabled() && this.spy && this.spy.isInDisguiseState() && this.spy.isAtCamera(selectedCam.node);
    const spyDisguise = spyAtCam ? this.spy.getDisguise() : null;
    
    // Check for Pyro - INVISIBLE on cameras, but plays burning sound (Custom Night only)
    const pyroAtCam = this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned() && 
                      this.pyro.shouldPlayBurningSound(selectedCam.node);
    if (pyroAtCam) {
      // Play burning sound periodically when viewing Pyro's room
      // Use a simple throttle based on time
      if (!this.audio.pyroBurningSoundThrottle || Date.now() - this.audio.pyroBurningSoundThrottle > 800) {
        this.audio.pyroBurningSoundThrottle = Date.now();
        this.audio.playPyroBurningSound();
        console.log(`🔥 BURNING SOUND at ${selectedCam.node} - Pyro is here (invisible)`);
      }
    }
    
    // Update Spy's watching state for fake watch bar
    if (this.isSpyEnabled() && this.spy) {
      this.spy.setBeingWatched(spyAtCam);
    }
    
    // Camera watch warning - show bar when Heavy/Sniper (or Spy disguised as them!) are being watched
    // Spy's fake watch bar does nothing but messes with players
    const spyFakeWatchProgress = spyAtCam && (spyDisguise === 'HEAVY' || spyDisguise === 'SNIPER') 
      ? this.spy.getFakeWatchProgress() : 0;
    
    if (heavyAtCam || sniperAtCam || spyFakeWatchProgress > 0) {
      const heavyProgress = heavyAtCam ? this.heavy.getWatchProgress() : 0;
      const sniperProgress = sniperAtCam ? this.sniper.getWatchProgress() : 0;
      // Include Spy's fake watch progress (looks real but does nothing!)
      const watchProgress = Math.max(heavyProgress, sniperProgress, spyFakeWatchProgress);
      
      if (watchProgress > 0) {
        this.cameraWatchWarning.setVisible(true);
        this.cameraWatchBar.setScale(watchProgress, 1);
        
        // Color gradient: yellow -> orange -> red as danger increases
        if (watchProgress > 0.7) {
          this.cameraWatchBar.setFillStyle(0xff0000, 0.9);
        } else if (watchProgress > 0.4) {
          this.cameraWatchBar.setFillStyle(0xff6600, 0.8);
        } else {
          this.cameraWatchBar.setFillStyle(0xffaa00, 0.7);
        }
        
        // Play mounting warning sound
        if (watchProgress > 0.5) {
          this.audio.playCameraWatchWarningSound(watchProgress);
        }
      } else {
        this.cameraWatchWarning.setVisible(false);
      }
    } else {
      this.cameraWatchWarning.setVisible(false);
    }

    // Administrator hack bar — shown when she's targeting or actively hacking this camera's room
    if (this.isAdministratorEnabled() && this.administrator && this.administrator.isActive() && this.administratorHackBarContainer) {
      const administratorTarget = this.administrator.getCurrentTarget();
      const administratorState = this.administrator.getState();
      if (administratorTarget === selectedCam.node && (administratorState === 'TARGETING' || administratorState === 'HACKING')) {
        this.administratorHackBarContainer.setVisible(true);
        const hackProgress = administratorState === 'HACKING' ? this.administrator.getHackProgress() : 0;
        this.administratorHackBarFill.setScale(hackProgress, 1);
        // Colour: grey (0x555555) when targeting/empty, gradient → Pauling purple (0x9944cc) as bar fills
        if (hackProgress <= 0) {
          this.administratorHackBarFill.setFillStyle(0x444444, 0.7);
          this.administratorHackBarBorder?.setStrokeStyle(2, 0x555555);
          this.administratorHackBarCross?.setVisible(true);
        } else {
          // Lerp grey (0x44,0x44,0x44) → purple (0x99,0x44,0xcc) by progress
          const r = Math.round(0x44 + (0x99 - 0x44) * hackProgress);
          const g = 0x44;
          const b = Math.round(0x44 + (0xcc - 0x44) * hackProgress);
          const col = (r << 16) | (g << 8) | b;
          this.administratorHackBarFill.setFillStyle(col, 0.85 + hackProgress * 0.1);
          this.administratorHackBarBorder?.setStrokeStyle(2, col);
          this.administratorHackBarCross?.setVisible(false);
        }
      } else {
        this.administratorHackBarContainer.setVisible(false);
      }
    } else if (this.administratorHackBarContainer) {
      this.administratorHackBarContainer.setVisible(false);
    }
    type EnemyDisplay = { type: string; label: string; color: string };
    const enemies: EnemyDisplay[] = [];
    
    // Priority: Sniper > Heavy > Demoman Body > Soldier > Scout (sniper is most dangerous - 2 shots needed!)
    if (sniperAtCam) {
      const isLured = this.sniper.isCurrentlyLured();
      const shotsNeeded = this.sniper.getShotsRemaining();
      enemies.push({ 
        type: 'SNIPER', 
        label: isLured ? 'SNIPER(L)' : (shotsNeeded < 2 ? 'SNIPER!' : 'SNIPER'), 
        color: isLured ? '#ffcc00' : '#ff4444'  // Yellow when lured
      });
    }
    if (heavyAtCam) {
      const isLured = this.heavy.isCurrentlyLured();
      enemies.push({ 
        type: 'HEAVY', 
        label: isLured ? 'HEAVY(L)' : 'HEAVY', 
        color: isLured ? '#ffcc00' : '#ff4444'  // Yellow when lured
      });
    }
    if (demomanBodyAtCam) {
      // Check if Demoman is Übered - red glow!
      const demoUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      enemies.push({ 
        type: 'DEMOMAN_BODY', 
        label: demoUbered ? 'DEMO(Ü)' : 'DEMO!', 
        color: demoUbered ? '#4488ff' : '#44ff44'  // Blue when Übered
      });
    }
    if (soldierAtCam) {
      // Check if Soldier is Übered - red glow!
      const soldierUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SOLDIER');
      enemies.push({ 
        type: 'SOLDIER', 
        label: soldierUbered ? 'SOLDIER(Ü)' : 'SOLDIER', 
        color: soldierUbered ? '#4488ff' : '#cc9966'  // Blue when Übered
      });
    }
    if (scoutAtCam) {
      // Check if Scout is Übered - red glow!
      const scoutUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SCOUT');
      enemies.push({ 
        type: 'SCOUT', 
        label: scoutUbered ? 'SCOUT(Ü)' : 'SCOUT', 
        color: scoutUbered ? '#4488ff' : '#88ccff'  // Blue when Übered
      });
    }
    
    // Night 5+: Add Spy disguised as an enemy (looks identical - player can't tell!)
    if (spyAtCam && spyDisguise) {
      // Spy looks like whatever he's disguised as
      if (spyDisguise === 'SNIPER') {
        enemies.push({ type: 'SNIPER', label: 'SNIPER', color: '#ff4444' });
      } else if (spyDisguise === 'HEAVY') {
        const realHeavyLured = heavyAtCam && this.heavy.isCurrentlyLured();
        enemies.push({ 
          type: 'HEAVY', 
          label: realHeavyLured ? 'HEAVY(L)' : 'HEAVY',  // Match real Heavy's state if present
          color: realHeavyLured ? '#ffcc00' : '#ff4444'  // Yellow when lured
        });
      } else if (spyDisguise === 'SOLDIER') {
        enemies.push({ type: 'SOLDIER', label: 'SOLDIER', color: '#cc9966' });
      } else if (spyDisguise === 'SCOUT') {
        enemies.push({ type: 'SCOUT', label: 'SCOUT', color: '#88ccff' });
      }
      // DEMOMAN_HEAD disguise is handled separately below
    }
    
    const containers = [this.cameraFeedEnemy, this.cameraFeedEnemy2, this.cameraFeedEnemy3];
    // Base positions for reference (used in dynamic positioning below)
    const _basePositions = [
      { x: 300, y: 370 },  // Slot 1 (left)
      { x: 420, y: 370 },  // Slot 2 (center)
      { x: 530, y: 380 },  // Slot 3 (right, slightly back)
    ];
    void _basePositions; // Kept for reference
    
    // Hide all enemy containers first and reset alpha (demo head may have changed it)
    containers.forEach(c => {
      c.setVisible(false);
      c.setAlpha(1);  // Reset alpha in case demo head opacity was applied
    });
    this.cameraFeedEnemyEyeGlow.setVisible(false);
    this.cameraFeedDemoHead.setVisible(false);
    this.cameraFeedDemoHead.setAlpha(1);  // Reset demo head alpha too
    
    // Draw ALL enemies present (up to 3)
    if (enemies.length > 0) {
      this.cameraFeedEmpty.setVisible(false);
      
      // Adjust positions based on count
      let positions: { x: number; y: number }[];
      if (enemies.length === 1) {
        positions = [{ x: demomanHeadAtCam ? 350 : 400, y: 370 }];
      } else if (enemies.length === 2) {
        positions = [
          { x: demomanHeadAtCam ? 280 : 320, y: 370 },
          { x: demomanHeadAtCam ? 420 : 480, y: 375 },
        ];
      } else {
        positions = [
          { x: demomanHeadAtCam ? 240 : 280, y: 370 },
          { x: demomanHeadAtCam ? 380 : 420, y: 375 },
          { x: demomanHeadAtCam ? 510 : 550, y: 380 },
        ];
      }
      
      enemies.forEach((enemy, i) => {
        if (i >= 3) return; // Max 3 enemies shown
        
        const container = containers[i];
        const graphics = container.list[0] as Phaser.GameObjects.Graphics;
        const label = container.list[container.list.length - 1] as Phaser.GameObjects.Text;
        
        // Check if this enemy is Übered (for special red glow)
        const isUbered = enemy.label.includes('(Ü)');
        
        // Draw appropriate silhouette with optional Über glow
        if (enemy.type === 'SNIPER') {
          drawSniperSilhouette(graphics, this.sniper.isCurrentlyLured());
        } else if (enemy.type === 'HEAVY') {
          drawHeavySilhouette(graphics, this.heavy.isCurrentlyLured());
        } else if (enemy.type === 'DEMOMAN_BODY') {
          drawEnemySilhouette(graphics, 'DEMOMAN_BODY', isUbered);
        } else if (enemy.type === 'SOLDIER') {
          drawEnemySilhouette(graphics, 'SOLDIER', isUbered);
        } else if (enemy.type === 'SCOUT') {
          drawEnemySilhouette(graphics, 'SCOUT', isUbered);
        }
        
        // Hide labels - Medic ghost indicates Über status
        label.setText('');
        label.setColor(enemy.color);
        
        container.setPosition(positions[i].x, positions[i].y);
        container.setVisible(true);
        
        // Eye glow is now part of silhouettes - no separate layer needed
      });
    } else if (demomanHeadAtCam || (spyAtCam && spyDisguise === 'DEMOMAN_HEAD')) {
      // Only Demoman head (or Spy disguised as demoman head) - show it in center
      this.cameraFeedEnemy.setVisible(true);
      this.cameraFeedEmpty.setVisible(false);
      this.cameraFeedEnemyEyeGlow.setVisible(false);
      
      const enemyGraphics = this.cameraFeedEnemy.list[0] as Phaser.GameObjects.Graphics;
      const enemyLabel = this.cameraFeedEnemy.list[2] as Phaser.GameObjects.Text;
      
      // Check if Demoman is Übered - draw with red glow!
      const demoHeadUbered = demomanHeadAtCam && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      // Pass charge buildup for ghostly aura effect (dim when far from charging, bright when close)
      // Spy disguised as Demo gets a static dim aura (0.15) since he has no charge timer
      const chargeBuildup = demomanHeadAtCam ? this.demoman.getChargeBuildup() : 0.15;
      // Spy's fake head shows WRONG eye - rewards observant players!
      const isFakeHead = !demomanHeadAtCam && spyAtCam && spyDisguise === 'DEMOMAN_HEAD';
      drawDemomanHead(enemyGraphics, demoHeadUbered, chargeBuildup, isFakeHead, this.demoman.isEyeGlowing(), this.demoman.activeEye);
      
      // Keep container at full alpha - the ghostly effect is now in the aura, not transparency
      this.cameraFeedEnemy.setAlpha(1);
      
      // Hide label - Medic ghost indicates Über status
      enemyLabel.setText('');
      enemyLabel.setColor('#44aa44');
      this.cameraFeedEnemy.setPosition(420, 370);
      this.cameraFeedDemoHead.setVisible(false);
    } else {
      // No enemies - show empty
      this.cameraFeedEmpty.setVisible(true);
      this.cameraFeedDemoHead.setVisible(false);
    }
    
    // Update Demoman head display (shown alongside other enemies if present)
    // Night 5+: Also show if Spy is disguised as demoman head!
    const showDemoHead = demomanHeadAtCam || (spyAtCam && spyDisguise === 'DEMOMAN_HEAD');
    
    if (enemies.length > 0 && showDemoHead) {
      this.cameraFeedDemoHead.setVisible(true);
      const demoHeadGraphics = this.cameraFeedDemoHead.list[0] as Phaser.GameObjects.Graphics;
      const demoHeadLabel = this.cameraFeedDemoHead.list[1] as Phaser.GameObjects.Text;
      
      // Check if Demoman is Übered - draw with red glow!
      const demoHeadUbered = demomanHeadAtCam && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      // Pass charge buildup for ghostly aura effect
      // Spy disguised as Demo gets a static dim aura (0.15) since he has no charge timer
      const chargeBuildup = demomanHeadAtCam ? this.demoman.getChargeBuildup() : 0.15;
      // Spy's fake head shows WRONG eye - rewards observant players!
      const isFakeHead = !demomanHeadAtCam && spyAtCam && spyDisguise === 'DEMOMAN_HEAD';
      drawDemomanHeadSmall(demoHeadGraphics, demoHeadUbered, chargeBuildup, isFakeHead, this.demoman.isEyeGlowing(), this.demoman.activeEye);
      
      // Keep container at full alpha - the ghostly effect is now in the aura
      this.cameraFeedDemoHead.setAlpha(1);
      
      // Hide label - Medic ghost indicates Über status
      demoHeadLabel.setText('');
      demoHeadLabel.setColor('#44aa44');
      
      // Position demo head to the right of other enemies
      const demoHeadX = enemies.length === 1 ? 520 : (enemies.length === 2 ? 580 : 620);
      this.cameraFeedDemoHead.setPosition(demoHeadX, 400);
    } else if (enemies.length === 0) {
      this.cameraFeedDemoHead.setVisible(false);
    }
    
    // Add red glow effect when Sniper is in range (if enabled)
    if (this.isSniperEnabled() && this.sniper.canShootIntelRoom() && !this.isTeleported) {
      // Sniper can see Intel from current position - add eerie red glow
      // This is handled by updateSniperChargeVisual() for the Intel room view
    }
    
    // Randomly update static for realism
    if (Math.random() < 0.05) {
      this.updateCameraStatic();
    }
    
    // Update map node colors to show active lures
    this.updateMapNodeColors(selectedCam.node);
    
    // Update camera lure button visibility (ensures button shows after placing lure)
    this.updateCameraLureButton();
  }
  
  /**
   * Draw a small Heavy silhouette for multi-enemy display
   * @deprecated Handled by main draw function with scaling
   */
  private _drawHeavySilhouetteSmall(_isLured: boolean): void {
    // This is handled by the main draw function with scaling
  }
  
  /**
   * Update secondary enemy displays when multiple enemies in room
   * @deprecated Future: could add more container slots for rendering multiple silhouettes
   */
  private _updateSecondaryEnemyDisplays(
    _additionalEnemies: Array<{ type: string; label: string; color: string }>,
    _startX: number,
    _demomanHeadPresent: boolean
  ): void {
    // For now, the label shows all enemies - we show the primary in the main slot
    // Additional enemies are indicated in the combined label
    // Future: could add more container slots for rendering multiple silhouettes
  }
  
  // ============================================
  // ENEMY EVENT HANDLERS
  // ============================================
  
  private onScoutAtDoor(): void {
    // No notification - player must check with wrangler light or cameras
    // This makes the game more tense like FNAF
  }
  
  private onSoldierAtDoor(): void {
    // Check if sentry exists
    if (!this.sentry.exists) {
      // Start breach countdown (3 seconds) - same as when sentry is destroyed
      this.soldier.startBreach();
      return;
    }
    
    // Start siege mode - no notification, player must be vigilant
    this.soldier.startSiege();
  }
  
  private onSoldierRocket(): void {
    if (!this.sentry.exists) return;
    
    // Play rocket animation
    this.playRocketAnimation();
    
    this.damageSentry(GAME_CONSTANTS.ROCKET_DAMAGE);
    this.showAlert(`ROCKET HIT! -${GAME_CONSTANTS.ROCKET_DAMAGE} HP`, 0xff4400);
  }
  
  /**
   * Fire a bullet projectile from sentry to target
   */
  private fireBulletProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    // Create bullet container
    const bullet = this.add.container(fromX, fromY);
    bullet.setDepth(50);
    
    // Bullet body (yellow/orange)
    const bulletBody = this.add.graphics();
    bulletBody.fillStyle(0xffaa00, 1);
    bulletBody.fillCircle(0, 0, 6);
    bulletBody.fillStyle(0xffff00, 1);
    bulletBody.fillCircle(0, 0, 3);
    bullet.add(bulletBody);
    
    // Muzzle flash at start
    const flash = this.add.graphics();
    flash.fillStyle(0xffff00, 0.8);
    flash.fillCircle(fromX, fromY, 20);
    flash.fillStyle(0xffffff, 0.6);
    flash.fillCircle(fromX, fromY, 10);
    flash.setDepth(51);
    
    // Fade out muzzle flash
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy()
    });
    
    // Animate bullet to target
    this.tweens.add({
      targets: bullet,
      x: toX,
      y: toY,
      duration: 150,
      ease: 'Linear',
      onUpdate: () => {
        // Trail effect
        const trail = this.add.graphics();
        trail.fillStyle(0xffaa00, 0.5);
        trail.fillCircle(bullet.x, bullet.y, 3);
        trail.setDepth(49);
        this.tweens.add({
          targets: trail,
          alpha: 0,
          duration: 100,
          onComplete: () => trail.destroy()
        });
      },
      onComplete: () => {
        // Impact flash
        const impact = this.add.graphics();
        impact.fillStyle(0xffff00, 0.8);
        impact.fillCircle(toX, toY, 15);
        impact.setDepth(52);
        
        this.tweens.add({
          targets: impact,
          alpha: 0,
          scale: 2,
          duration: 150,
          onComplete: () => impact.destroy()
        });
        
        bullet.destroy();
      }
    });
  }
  
  /**
   * Play rocket animation from right door to sentry
   */
  private playRocketAnimation(): void {
    // Rocket starting position (right doorway)
    const startX = 1100;
    const startY = 450;
    
    // Sentry position (center-ish)
    const endX = 640;
    const endY = 500;
    
    // Create rocket container
    const rocket = this.add.container(startX, startY);
    rocket.setDepth(50);
    
    // Rocket body (dark grey cylinder)
    const rocketBody = this.add.graphics();
    rocketBody.fillStyle(0x444444, 1);
    rocketBody.fillRect(-20, -5, 40, 10);
    
    // Rocket nose cone (red)
    rocketBody.fillStyle(0xcc2200, 1);
    rocketBody.beginPath();
    rocketBody.moveTo(-20, -5);
    rocketBody.lineTo(-30, 0);
    rocketBody.lineTo(-20, 5);
    rocketBody.closePath();
    rocketBody.fillPath();
    
    // Rocket fins
    rocketBody.fillStyle(0x333333, 1);
    rocketBody.fillTriangle(15, -5, 20, -12, 20, -5);
    rocketBody.fillTriangle(15, 5, 20, 12, 20, 5);
    
    rocket.add(rocketBody);
    
    // Flame trail
    const flame = this.add.graphics();
    flame.fillStyle(0xff6600, 0.9);
    flame.fillEllipse(30, 0, 25, 8);
    flame.fillStyle(0xffcc00, 0.8);
    flame.fillEllipse(35, 0, 15, 5);
    flame.fillStyle(0xffffff, 0.7);
    flame.fillEllipse(38, 0, 8, 3);
    rocket.add(flame);
    
    // Flame flicker animation
    this.tweens.add({
      targets: flame,
      scaleX: 1.3,
      scaleY: 0.8,
      duration: 50,
      yoyo: true,
      repeat: 10,
    });
    
    // Smoke trail particles
    const smokeEmitter = this.time.addEvent({
      delay: 30,
      repeat: 15,
      callback: () => {
        const smokeX = rocket.x + 25;
        const smokeY = rocket.y + Phaser.Math.Between(-5, 5);
        const smoke = this.add.circle(smokeX, smokeY, 8, 0x888888, 0.6);
        smoke.setDepth(45);
        
        this.tweens.add({
          targets: smoke,
          x: smokeX + 30,
          y: smokeY - 20,
          scale: 2,
          alpha: 0,
          duration: 400,
          onComplete: () => smoke.destroy(),
        });
      },
    });
    
    // Rocket flight animation
    this.tweens.add({
      targets: rocket,
      x: endX,
      y: endY,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        // Explosion effect
        this.playExplosionEffect(endX, endY);
        rocket.destroy();
        smokeEmitter.destroy();
      },
    });
  }
  
  /**
   * Play explosion effect at position
   */
  private playExplosionEffect(x: number, y: number): void {
    // Flash
    const flash = this.add.circle(x, y, 30, 0xffff00, 1);
    flash.setDepth(55);
    
    this.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
    
    // Orange/red explosion
    const explosion = this.add.graphics();
    explosion.setPosition(x, y);
    explosion.setDepth(54);
    
    explosion.fillStyle(0xff4400, 0.9);
    explosion.fillCircle(0, 0, 40);
    explosion.fillStyle(0xff6600, 0.8);
    explosion.fillCircle(5, -5, 30);
    explosion.fillStyle(0xffaa00, 0.7);
    explosion.fillCircle(-5, 5, 20);
    
    this.tweens.add({
      targets: explosion,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      onComplete: () => explosion.destroy(),
    });
    
    // Debris particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const debris = this.add.rectangle(
        x, y, 
        Phaser.Math.Between(4, 8), 
        Phaser.Math.Between(4, 8), 
        0x666666
      );
      debris.setDepth(53);
      
      this.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * Phaser.Math.Between(40, 80),
        y: y + Math.sin(angle) * Phaser.Math.Between(40, 80) + 30,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => debris.destroy(),
      });
    }
    
    // Screen shake
    this.cameras.main.shake(100, 0.01);
  }
  
  private onDemomanAtDoor(side: 'LEFT' | 'RIGHT'): void {
    // Demoman is at the door, about to charge in!
    // Play battle cry sound
    this.audio.playDemomanBattleCry();
    console.log(`⚔️ Demoman at ${side} door!`);
  }
  
  private onDemomanChargeStart(side: 'LEFT' | 'RIGHT'): void {
    // Demoman has started charging - play distant battle cry
    this.audio.playDemomanDistantCry();
    console.log(`🗡️ Demoman charge started toward ${side}!`);
  }
  
  // ============================================
  // GAME STATE
  // ============================================
  
  private showAlert(message: string, color: number): void {
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
    this.tweens.add({
      targets: this.alertContainer,
      alpha: 0,
      duration: 2500,
      delay: 500, // Stay visible for 0.5s before fading
      onComplete: () => {
        this.alertContainer.setVisible(false);
      },
    });
  }
  
  private updateHUD(): void {
    // Time (12-hour format: 12:00 AM to 5:59 AM)
    // Only show hour (not minutes) to prevent predicting Scout/Soldier arrival
    const hours24 = Math.floor(this.gameMinutes / 60);
    const displayHours = hours24 === 0 ? 12 : hours24;  // 00:XX becomes 12:XX
    
    // For endless Night 6, show day tracking after first 6 AM
    if (this.isBadEndingNight6 && this.hasReached6AM) {
      this.timeText.setText(`DAY ${this.endlessDay} - ${displayHours} AM`);
    } else {
      this.timeText.setText(`${displayHours} AM`); // No padding - "1 AM" not "01 AM"
    }
    
    // Metal
    this.metalText.setText(`METAL: ${Math.floor(this.metal)}/${GAME_CONSTANTS.MAX_METAL}`);
    
    // Sentry
    if (this.sentry.exists) {
      this.sentryText.setText(`SENTRY: L${this.sentry.level} | HP: ${Math.floor(this.sentry.hp)}/${this.sentry.maxHp}`);
      this.sentryText.setColor('#88ff88');
    } else {
      this.sentryText.setText('SENTRY: DESTROYED (R to rebuild)');
      this.sentryText.setColor('#ff4444');
    }
    
    // Wrangler
    if (this.isCameraMode) {
      this.wranglerText.setText('WRANGLER: DISABLED (Camera Mode)');
      this.wranglerText.setColor('#888888');
    } else if (!this.sentry.exists) {
      this.wranglerText.setText('WRANGLER: N/A');
      this.wranglerText.setColor('#888888');
    } else if (!this.sentry.isWrangled) {
      this.wranglerText.setText('WRANGLER: OFF (Auto-defense mode)');
      this.wranglerText.setColor('#ff8888');
    } else {
      // Wrangler is ON
      const aimText = this.sentry.aimedDoor === 'NONE' ? 'MIDDLE (hold A/D)' : this.sentry.aimedDoor;
      const aimColor = this.sentry.aimedDoor === 'NONE' ? '#ffff88' : '#88ff88';
      this.wranglerText.setText(`WRANGLER: ON | AIM: ${aimText}`);
      this.wranglerText.setColor(aimColor);
    }
    
    // Update lure button state (grey out if not enough metal) - Night 3+
    if (this.nightNumber >= 3 && this.isTeleported) {
      this.updateLureButtonText();
    }
    
    // Update mobile UI if on mobile
    if (this.isMobile) {
      this.mobileControls?.updateUI();
    }
  }
  
  private gameOver(reason: string): void {
    if (this.gameStatus !== 'PLAYING') return;

    this.clearMerasmusMirrorDomAndFlags();
    
    this.gameStatus = 'LOST';
    // Stop ALL sounds immediately
    this.audio.stopAllGameSounds();
    this.stopRecording(); // Stop Engineer recording if playing
    console.log('GAME OVER:', reason);

    // Determine which enemy killed the player
    const reasonLower = reason.toLowerCase();
    const isScout = reasonLower.includes('scout');
    const isDemoman = reasonLower.includes('demoman');
    const isHeavy = reasonLower.includes('heavy');
    const isSoldier = reasonLower.includes('soldier') || reasonLower.includes('breached');
    const isSniper = reasonLower.includes('snipe') || reasonLower.includes('sniper');
    const isPyro = reasonLower.includes('pyro') || reasonLower.includes('burned') || reasonLower.includes('overheated');
    // Note: don't match bare 'vent' - the Pyro thermostat death reason mentions vents too
    const isPauling = reasonLower.includes('pauling');
    const isMerasmus = reasonLower.includes('merasmus');
    
    // Create jumpscare container
    this.endScreen.removeAll(true);
    this.endScreen.setVisible(true);  // IMPORTANT: Make visible!
    
    // Dark flash
    const flash = this.add.rectangle(640, 360, 1280, 720, 0x000000, 1);
    this.endScreen.add(flash);
    
    // Create enemy jumpscare graphic (zooms in from center)
    const jumpscareContainer = this.add.container(640, 360);
    this.endScreen.add(jumpscareContainer);
    
    // Draw proper character model for jumpscare
    const enemyGraphics = this.add.graphics();
    if (isPauling) {
      drawPaulingJumpscarePortrait(enemyGraphics);
    } else if (isMerasmus) {
      drawCharacterSilhouette(enemyGraphics, 0, 0, 'MERASMUS', 0x8866dd);
    } else {
      drawJumpscareSilhouette(enemyGraphics, isScout, isSoldier, isDemoman, isHeavy, isSniper, isPyro);
    }
    jumpscareContainer.add(enemyGraphics);
    
    // The standard kill: jumpscare sound + shake + fast zoom-in
    const startKillSequence = () => {
      flash.setAlpha(1);  // Full blackout behind the jumpscare (linger keeps room visible until now)
      this.tweens.killTweensOf(enemyGraphics);  // Stop the linger walk bob
      enemyGraphics.setPosition(0, 0);
      this.audio.playJumpscareSound();
      this.cameras.main.shake(300, 0.03);

      // Jumpscare zoom animation
      this.tweens.add({
        targets: jumpscareContainer,
        scale: 2.5,
        alpha: 1,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          // Shake while zoomed
          this.tweens.add({
            targets: jumpscareContainer,
            x: 640 + Phaser.Math.Between(-20, 20),
            y: 360 + Phaser.Math.Between(-20, 20),
            duration: 50,
            repeat: 5,
            yoyo: true,
            onComplete: () => {
              // Fade to game over screen
              this.tweens.add({
                targets: jumpscareContainer,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  this.showGameOverScreen(reason);
                }
              });
            }
          });
        }
      });
    };

    // Easter egg: 2-in-5 Scout kills, he bursts through the left door and
    // sprints at the player before the actual jumpscare
    const scoutLinger = isScout && Math.random() < 0.4;

    if (scoutLinger) {
      console.log('👀 Scout linger easter egg triggered!');

      // Reveal the Intel room - Scout rushes in THROUGH the door, not over black
      this.cameraUI?.setVisible(false);
      this.roomViewUI?.setVisible(false);
      this.isCameraMode = false;

      // Lights dim instead of full blackout so the room stays visible behind him
      flash.setAlpha(0.4);

      // Scout bursts through the left doorway (his attack path) and sprints at the player
      jumpscareContainer.setPosition(120, 330);
      jumpscareContainer.setScale(0.55);
      jumpscareContainer.setAlpha(0);
      this.audio.playScoutLingerApproach();

      this.tweens.add({
        targets: jumpscareContainer,
        alpha: 1,
        duration: 80,
        ease: 'Power2',
      });

      // The sprint: door to your face in half a second
      this.tweens.add({
        targets: jumpscareContainer,
        scale: 1.35,
        x: 640,
        y: 385,
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: startKillSequence,
      });

      // Rapid sprint bob on the inner graphics - fast footfalls with a hard tilt
      this.tweens.add({
        targets: enemyGraphics,
        y: 8,
        angle: 3.5,
        duration: 70,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 6,
      });
    } else {
      // Start small and zoom in fast
      jumpscareContainer.setScale(0.1);
      jumpscareContainer.setAlpha(0);
      startKillSequence();
    }
  }

  /**
   * Show Pyro jumpscare for Give Up, then transition to dark ending
   */
  private showGiveUpJumpscare(): void {
    // Play jumpscare sound
    this.audio.playJumpscareSound();
    
    // Screen shake for impact
    this.cameras.main.shake(300, 0.03);
    
    // Create jumpscare container
    this.endScreen.removeAll(true);
    this.endScreen.setVisible(true);
    
    // Dark flash
    const flash = this.add.rectangle(640, 360, 1280, 720, 0x000000, 1);
    this.endScreen.add(flash);
    
    // Create Pyro jumpscare graphic
    const jumpscareContainer = this.add.container(640, 360);
    this.endScreen.add(jumpscareContainer);
    
    // Draw Pyro for the jumpscare (isPyro = true)
    const enemyGraphics = this.add.graphics();
    drawJumpscareSilhouette(enemyGraphics, false, false, false, false, false, true);
    jumpscareContainer.add(enemyGraphics);
    
    // Start small and zoom in fast
    jumpscareContainer.setScale(0.1);
    jumpscareContainer.setAlpha(0);
    
    // Jumpscare zoom animation
    this.tweens.add({
      targets: jumpscareContainer,
      scale: 2.5,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        // Shake while zoomed
        this.tweens.add({
          targets: jumpscareContainer,
          x: 640 + Phaser.Math.Between(-20, 20),
          y: 360 + Phaser.Math.Between(-20, 20),
          duration: 50,
          repeat: 5,
          yoyo: true,
          onComplete: () => {
            // Fade to dark ending
            this.tweens.add({
              targets: jumpscareContainer,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                // Show dark ending with sad chime on menu return
                const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
                this.endScreen.add(overlay);
                this.showEndlessDarkEnding('You gave up...', false, true);  // playSadChimeOnReturn = true
              }
            });
          }
        });
      }
    });
  }

  private showGameOverScreen(reason: string): void {
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
    this.endScreen.add(overlay);
    
    // For endless Night 6, show the dark ending with survival stats
    if (this.isBadEndingNight6) {
      this.showEndlessDarkEnding(reason);
      return;
    }
    
    // Show time of death (12-hour format)
    const hours24 = Math.floor(this.gameMinutes / 60);
    const mins = this.gameMinutes % 60;
    const displayHours = hours24 === 0 ? 12 : hours24;  // 00:XX becomes 12:XX
    const timeStr = `${displayHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} AM`;
    
    const timeText = this.add.text(640, 220, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      color: '#ff4444',
    }).setOrigin(0.5);
    this.endScreen.add(timeText);
    
    const title = this.add.text(640, 290, 'GAME OVER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(title);
    
    const subtitle = this.add.text(640, 370, reason, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.endScreen.add(subtitle);
    
    const menuPrompt = this.add.text(640, 460, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);
    this.endScreen.add(menuPrompt);
    
    this.tweens.add({
      targets: menuPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    
    this.endScreen.setVisible(true);
    
    // Return to menu on space or click
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.goToMainMenu();
    });
    this.input.once('pointerdown', () => {
      this.goToMainMenu();
    });
  }
  
  /**
   * Show the dark ending for endless Night 6 with survival stats
   * This is the "bad ending" - player was trapped in an endless night and eventually fell
   * @param skipSound - If true, don't play the dark ending sound (e.g., when give up sound already played)
   * @param playSadChimeOnReturn - If true, play the give up sound when returning to menu
   */
  private showEndlessDarkEnding(reason: string, skipSound: boolean = false, playSadChimeOnReturn: boolean = false): void {
    if (!skipSound) {
      this.audio.playDarkEndingSound();  // Melancholic melody
    }
    
    // Store flag for menu return
    const shouldPlaySadChime = playSadChimeOnReturn;
    
    // Update save - mark game completed (unlocks everything)
    updateSaveOnNight6Complete();
    
    // Calculate survival stats
    const totalMinutes = this.endlessSurvivalMinutes;
    // Days survived = endlessDay - 6 (Night 6 starts, Day 7 = 1 day survived, etc.)
    const survivalDays = this.hasReached6AM ? (this.endlessDay - 6) : 0;
    const survivalHours = Math.floor(totalMinutes / 60);
    const survivalMins = totalMinutes % 60;
    
    // Format survival time (with proper singular/plural)
    const hourWord = survivalHours === 1 ? 'hour' : 'hours';
    const minWord = survivalMins === 1 ? 'minute' : 'minutes';
    const dayWord = survivalDays === 1 ? 'day' : 'days';
    const hoursInDay = survivalHours % 24;
    const hoursInDayWord = hoursInDay === 1 ? 'hour' : 'hours';
    const minsInHour = survivalMins;
    const minsInHourWord = minsInHour === 1 ? 'minute' : 'minutes';
    
    let survivalStr = '';
    if (survivalDays > 0) {
      // Multiple days - show days, hours, and minutes
      survivalStr = `${survivalDays} ${dayWord}, ${hoursInDay} ${hoursInDayWord}, ${minsInHour} ${minsInHourWord}`;
    } else if (survivalHours > 0) {
      survivalStr = `${survivalHours} ${hourWord}, ${survivalMins} ${minWord}`;
    } else {
      survivalStr = `${survivalMins} ${minWord}`;
    }
    
    // Dark, somber ending screen
    const title = this.add.text(640, 100, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#553333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(title);
    
    const subtitle = this.add.text(640, 170, 'You survived...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#666666',
    }).setOrigin(0.5);
    this.endScreen.add(subtitle);
    
    // Survival time - the "badge of honor"
    const survivalText = this.add.text(640, 230, survivalStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '42px',
      color: '#aa8800',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(survivalText);
    
    const cost = this.add.text(640, 290, 'but at what cost?', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#555555',
    }).setOrigin(0.5);
    this.endScreen.add(cost);
    
    // Lonely Engineer silhouette - sitting alone, defeated
    const graphics = this.add.graphics();
    
    // Dark room backdrop with subtle gradient
    graphics.fillStyle(0x080810, 0.95);
    graphics.fillRect(340, 305, 600, 230);
    
    // Atmospheric spotlight from above - warm but dim
    graphics.fillStyle(0x443322, 0.08);
    graphics.fillCircle(640, 300, 150);
    graphics.fillStyle(0x554433, 0.12);
    graphics.fillCircle(640, 340, 100);
    graphics.fillStyle(0x665544, 0.18);
    graphics.fillCircle(640, 370, 60);
    graphics.fillStyle(0x776655, 0.25);
    graphics.fillCircle(640, 390, 35);
    
    const engX = 640;
    const engY = 430;
    
    // Shadow beneath (drawn first)
    graphics.fillStyle(0x000000, 0.5);
    graphics.fillEllipse(engX, engY + 75, 100, 18);
    
    // LEGS - Engineer's work pants, sitting on crate/ground
    graphics.fillStyle(0x2a2a3a, 1);
    // Left leg bent
    graphics.beginPath();
    graphics.moveTo(engX - 40, engY + 30);
    graphics.lineTo(engX - 15, engY + 30);
    graphics.lineTo(engX - 20, engY + 65);
    graphics.lineTo(engX - 50, engY + 65);
    graphics.closePath();
    graphics.fillPath();
    // Right leg extended slightly
    graphics.beginPath();
    graphics.moveTo(engX + 5, engY + 30);
    graphics.lineTo(engX + 35, engY + 30);
    graphics.lineTo(engX + 55, engY + 65);
    graphics.lineTo(engX + 20, engY + 65);
    graphics.closePath();
    graphics.fillPath();
    
    // Work boots
    graphics.fillStyle(0x222230, 1);
    graphics.fillRoundedRect(engX - 55, engY + 60, 25, 12, 3);
    graphics.fillRoundedRect(engX + 35, engY + 60, 28, 12, 3);
    
    // TORSO - RED team shirt (but dim in shadow)
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX - 35, engY - 35);
    graphics.lineTo(engX + 30, engY - 35);
    graphics.lineTo(engX + 35, engY + 35);
    graphics.lineTo(engX - 40, engY + 35);
    graphics.closePath();
    graphics.fillPath();
    
    // Overalls straps
    graphics.fillStyle(0x252535, 1);
    graphics.fillRect(engX - 25, engY - 30, 8, 50);
    graphics.fillRect(engX + 12, engY - 30, 8, 50);
    
    // LEFT ARM - resting on knee, holding wrench
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX - 35, engY - 25);
    graphics.lineTo(engX - 45, engY - 15);
    graphics.lineTo(engX - 55, engY + 15);
    graphics.lineTo(engX - 45, engY + 20);
    graphics.closePath();
    graphics.fillPath();
    // Gloved hand
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillCircle(engX - 52, engY + 18, 10);
    // Wrench (iconic!)
    graphics.fillStyle(0x444450, 1);
    graphics.fillRect(engX - 75, engY + 10, 30, 6);
    graphics.fillStyle(0x3a3a45, 1);
    graphics.fillRect(engX - 78, engY + 5, 8, 16);
    
    // RIGHT ARM - up to face, defeated pose
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX + 25, engY - 25);
    graphics.lineTo(engX + 35, engY - 35);
    graphics.lineTo(engX + 25, engY - 55);
    graphics.lineTo(engX + 15, engY - 45);
    graphics.closePath();
    graphics.fillPath();
    // Gunslinger (robotic hand) touching face
    graphics.fillStyle(0x4a4a55, 1);
    graphics.fillCircle(engX + 22, engY - 58, 9);
    graphics.fillStyle(0x555560, 1);
    graphics.fillCircle(engX + 22, engY - 58, 6);
    
    // HEAD - slightly tilted down in despair
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillCircle(engX + 5, engY - 65, 24);
    
    // Neck
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillRect(engX - 5, engY - 45, 15, 12);
    
    // HARDHAT - Engineer's iconic yellow hardhat (dimmed)
    // Brim first
    graphics.fillStyle(0x4a4535, 1);
    graphics.fillEllipse(engX + 5, engY - 80, 35, 8);
    // Dome
    graphics.fillStyle(0x555540, 1);
    graphics.beginPath();
    graphics.arc(engX + 5, engY - 82, 26, Math.PI, 0, false);
    graphics.closePath();
    graphics.fillPath();
    // Highlight on dome
    graphics.fillStyle(0x666650, 0.5);
    graphics.beginPath();
    graphics.arc(engX + 5, engY - 85, 18, Math.PI * 1.2, Math.PI * 1.8, false);
    graphics.closePath();
    graphics.fillPath();
    // Hardhat light (dim, not powered)
    graphics.fillStyle(0x444438, 1);
    graphics.fillCircle(engX + 5, engY - 100, 7);
    graphics.fillStyle(0x333330, 1);
    graphics.fillCircle(engX + 5, engY - 100, 4);
    
    // GOGGLES - pushed up on forehead (iconic Engineer look)
    graphics.fillStyle(0x333340, 1);
    graphics.fillRoundedRect(engX - 18, engY - 82, 42, 10, 3);
    // Goggle lenses
    graphics.fillStyle(0x222235, 1);
    graphics.fillCircle(engX - 8, engY - 77, 7);
    graphics.fillCircle(engX + 14, engY - 77, 7);
    // Lens reflection (very subtle)
    graphics.fillStyle(0x334455, 0.3);
    graphics.fillCircle(engX - 10, engY - 79, 3);
    graphics.fillCircle(engX + 12, engY - 79, 3);
    
    // Face details (in shadow but visible)
    // Brow/eye area (shadowed)
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillRect(engX - 12, engY - 70, 30, 8);
    
    // Slight stubble/jaw
    graphics.fillStyle(0x404050, 1);
    graphics.fillEllipse(engX + 5, engY - 50, 18, 12);
    
    this.endScreen.add(graphics);
    
    // Death reason (smaller, at bottom)
    const deathReason = this.add.text(640, 560, reason, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#664444',
    }).setOrigin(0.5);
    this.endScreen.add(deathReason);
    
    const prompt = this.add.text(640, 620, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#444444',
    }).setOrigin(0.5);
    this.endScreen.add(prompt);
    
    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.endScreen.setVisible(true);
    
    console.log(`🌙 Endless Night 6 ended. Survived ${survivalStr} (${survivalDays} days)`);
    
    // Return to menu on space or click
    this.input.keyboard?.once('keydown-SPACE', () => {
      if (shouldPlaySadChime) {
        this.audio.playGiveUpSound();
      }
      this.goToMainMenu();
    });
    this.input.once('pointerdown', () => {
      if (shouldPlaySadChime) {
        this.audio.playGiveUpSound();
      }
      this.goToMainMenu();
    });
  }
  
  private victory(): void {
    if (this.gameStatus !== 'PLAYING') return;

    this.clearMerasmusMirrorDomAndFlags();
    
    this.gameStatus = 'WON';
    this.audio.stopAllGameSounds(); // Stop ALL sounds
    this.stopRecording(); // Stop Engineer recording if playing
    this.audio.playVictoryChime(); // Play triumphant sound
    console.log('VICTORY!');
    
    // Update HUD to show 06 AM (consistent with gameplay display)
    this.timeText.setText('06 AM');
    
    // Handle different victory scenarios
    if (this.isCustomNightMode) {
      // Custom Night - just show standard victory, no save updates
      this.showStandardVictoryScreen();
    } else if (this.isBadEndingNight6) {
      // Survived Night 6 (bad ending path) - show dark ending
      updateSaveOnNight6Complete();
      this.showDarkEnding();
    } else if (this.isNightmareMode) {
      // Nightmare Mode - fixed difficulty finite night, show standard victory
      this.showStandardVictoryScreen();
    } else {
      // Story nights 1-5 - save progress and check for endings
      const { triggeredBadEnding, triggeredGoodEnding } = updateSaveOnVictory(
        this.nightNumber, 
        this.sessionDestructions
      );
      
      if (triggeredGoodEnding) {
        // Night 5 complete with <5 destructions - Good ending!
        this.showGoodEnding();
      } else if (triggeredBadEnding) {
        // Night 5 complete with 5+ destructions - Bad ending path
        this.showBadEndingIntro();
      } else {
        // Nights 1-4: standard victory screen
        this.showStandardVictoryScreen();
      }
    }
  }
  
  /**
   * Show standard night complete victory screen
   */
  private showStandardVictoryScreen(): void {
    this.endScreen.removeAll(true);
    
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    this.endScreen.add(overlay);
    
    const time = this.add.text(640, 200, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '72px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(time);
    
    const displayNight = this.nightNumber === 7 ? 'CUSTOM' : this.nightNumber === 8 ? 'NIGHTMARE' : this.nightNumber;
    const title = this.add.text(640, 300, `NIGHT ${displayNight} COMPLETE!`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(title);
    
    const subtitle = this.add.text(640, 370, 'You survived the night!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.endScreen.add(subtitle);
    
    // Star rating based on sentry level
    const starLevel = this.sentry.exists ? this.sentry.level : 0;
    const stars = '★'.repeat(starLevel) + '☆'.repeat(3 - starLevel);
    const starColor = starLevel === 3 ? '#ffd700' : starLevel === 2 ? '#c0c0c0' : '#cd7f32';
    
    const ratingLabel = this.add.text(640, 430, 'SENTRY RATING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#888888',
    }).setOrigin(0.5);
    this.endScreen.add(ratingLabel);
    
    const starRating = this.add.text(640, 470, stars, {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: starColor,
    }).setOrigin(0.5);
    this.endScreen.add(starRating);
    
    const levelText = this.add.text(640, 510, starLevel > 0 ? `Level ${starLevel} Sentry` : 'No Sentry', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.endScreen.add(levelText);
    
    const menuPrompt = this.add.text(640, 580, 'SPACE or CLICK to continue', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);
    this.endScreen.add(menuPrompt);
    
    this.tweens.add({
      targets: menuPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    
    this.endScreen.setVisible(true);
    
    // Return to menu on space or click
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.goToMainMenu();
    });
    this.input.once('pointerdown', () => {
      this.goToMainMenu();
    });
  }
  
  /**
   * Show good ending - peaceful scene with all mercs celebrating
   */
  private showGoodEnding(): void {
    this.audio.playGoodEndingSound();  // Triumphant fanfare
    
    this.endScreen.removeAll(true);
    
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
    this.endScreen.add(overlay);
    
    // Peaceful blue/warm gradient feel
    const gradientOverlay = this.add.rectangle(640, 360, 1280, 720, 0x1a2a4a, 0.3);
    this.endScreen.add(gradientOverlay);
    
    const time = this.add.text(640, 80, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(time);
    
    const title = this.add.text(640, 140, 'The nightmare is over.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.endScreen.add(title);
    
    const subtitle = this.add.text(640, 180, 'You held the line, Engineer.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#66cc66',
    }).setOrigin(0.5);
    this.endScreen.add(subtitle);
    
    // Draw all 9 mercs celebrating (simplified silhouettes)
    const celebrationGraphics = this.add.graphics();
    drawCelebratingMercs(celebrationGraphics);
    this.endScreen.add(celebrationGraphics);
    
    const theEnd = this.add.text(640, 520, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(theEnd);
    
    // Credits
    const credits = this.add.text(640, 590, '- Thank you for playing -', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);
    this.endScreen.add(credits);
    
    const prompt = this.add.text(640, 650, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#555555',
    }).setOrigin(0.5);
    this.endScreen.add(prompt);
    
    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.endScreen.setVisible(true);
    
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.goToMainMenu();
    });
    this.input.once('pointerdown', () => {
      this.goToMainMenu();
    });
  }
  
  /**
   * Show bad ending intro - Medic gone mad screen before Night 6
   */
  private showBadEndingIntro(): void {
    this.audio.playBadEndingIntroSound();  // Ominous drone
    
    this.endScreen.removeAll(true);
    
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.98);
    this.endScreen.add(overlay);
    
    // Red tint for ominous feel
    const redOverlay = this.add.rectangle(640, 360, 1280, 720, 0x330000, 0.3);
    this.endScreen.add(redOverlay);
    
    // Story text - appearing line by line
    const lines = [
      'The constant gunfire...',
      'The explosions...',
      '',
      'The sentry\'s destruction echoed through',
      'the base, night after night.',
      '',
      'Medic couldn\'t take it anymore.',
      '',
      'He\'s thrown himself to the monsters.',
      'He\'s become one of them.',
    ];
    
    let y = 180;
    lines.forEach((line, i) => {
      if (line === '') {
        y += 20;
        return;
      }
      
      const text = this.add.text(640, y, line, {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        color: i >= 6 ? '#ff4444' : '#aaaaaa',
      }).setOrigin(0.5).setAlpha(0);
      this.endScreen.add(text);
      
      // Fade in each line
      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 500,
        delay: i * 400,
      });
      
      y += 35;
    });
    
    // Night 6 announcement
    const night6 = this.add.text(640, 550, 'NIGHT 6', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.endScreen.add(night6);
    
    this.tweens.add({
      targets: night6,
      alpha: 1,
      duration: 1000,
      delay: 4500,
    });
    
    const prompt = this.add.text(640, 620, 'SPACE or CLICK to begin', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5).setAlpha(0);
    this.endScreen.add(prompt);
    
    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 500,
      delay: 5500,
      onComplete: () => {
        this.tweens.add({
          targets: prompt,
          alpha: 0.3,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }
    });
    
    this.endScreen.setVisible(true);
    
    // Start Night 6 on input (after delay)
    this.time.delayedCall(5500, () => {
      const startNight6 = () => {
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.time.delayedCall(800, () => {
          this.scene.start('GameScene', { 
            night: 6,
            isBadEndingNight6: true,
            customEnemies: {
              scout: true,
              soldier: true,
              demoman: true,
              heavy: true,
              sniper: true,
              spy: true,
              pyro: true,
              medic: true
            }
          });
        });
      };
      
      this.input.keyboard?.once('keydown-SPACE', startNight6);
      this.input.once('pointerdown', startNight6);
    });
  }
  
  /**
   * Show dark ending after surviving Night 6
   */
  private showDarkEnding(): void {
    this.endScreen.removeAll(true);
    
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.98);
    this.endScreen.add(overlay);
    
    const time = this.add.text(640, 150, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#aa8800',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(time);
    
    const survived = this.add.text(640, 230, 'You survived...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#888888',
    }).setOrigin(0.5);
    this.endScreen.add(survived);
    
    const cost = this.add.text(640, 280, 'but at what cost?', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#666666',
    }).setOrigin(0.5);
    this.endScreen.add(cost);
    
    // Lonely Engineer silhouette
    const graphics = this.add.graphics();
    
    // Dark room with single figure
    graphics.fillStyle(0x111122, 0.8);
    graphics.fillRect(440, 320, 400, 200);
    
    // Engineer silhouette - alone, hunched
    graphics.fillStyle(0x333344, 1);
    graphics.fillCircle(640, 380, 30); // Head
    graphics.fillRoundedRect(610, 400, 60, 80, 10); // Body
    // Hardhat
    graphics.fillStyle(0x444455, 1);
    graphics.fillEllipse(640, 360, 40, 15);
    
    // Single dim light above
    graphics.fillStyle(0x554422, 0.3);
    graphics.fillCircle(640, 320, 80);
    graphics.fillStyle(0x665533, 0.5);
    graphics.fillCircle(640, 340, 40);
    
    this.endScreen.add(graphics);
    
    const theEnd = this.add.text(640, 550, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#553333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endScreen.add(theEnd);
    
    const prompt = this.add.text(640, 650, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#444444',
    }).setOrigin(0.5);
    this.endScreen.add(prompt);
    
    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.endScreen.setVisible(true);
    
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.goToMainMenu();
    });
    this.input.once('pointerdown', () => {
      this.goToMainMenu();
    });
  }
  
  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(_time: number, delta: number): void {
    if (this.gameStatus !== 'PLAYING') return;
    if (this.isPaused) return;
    
    // ---- ENGINEER RECORDING TIMER ----
    if (!this.hasPlayedRecording && !this.isRecordingPlaying) {
      this.recordingStartTimer += delta;
      if (this.recordingStartTimer >= this.recordingStartDelay) {
        this.startRecording();
      }
    }
    
    // ---- UPDATE WRANGLER COOLDOWN ----
    if (this.wranglerCooldown > 0) {
      this.wranglerCooldown -= delta;
    }
    
    // ---- TIME PROGRESSION ----
    this.timeAccumulator += delta;
    if (this.timeAccumulator >= GAME_CONSTANTS.MS_PER_GAME_MINUTE) {
      this.timeAccumulator -= GAME_CONSTANTS.MS_PER_GAME_MINUTE;
      this.gameMinutes++;
      
      // Keep the global log-timestamp clock in sync
      setGameClock(Math.floor(this.gameMinutes / 60), this.gameMinutes % 60);
      
      // Track total survival time for endless mode
      if (this.isBadEndingNight6) {
        this.endlessSurvivalMinutes++;
      }
      
      // Check for 6:00 AM (360 minutes)
      if (this.gameMinutes >= 360) {
        if (this.isBadEndingNight6) {
          // ENDLESS MODE: Don't end the night, play bell and continue
          if (!this.hasReached6AM) {
            this.hasReached6AM = true;
            this.audio.play6AMBellChime();
            this.showAlert('6:00 AM... but the night continues', 0xaa8800);
          }
          
          // Track hours after 6 AM for difficulty scaling (every 60 game minutes = 1 hour)
          const minutesAfter6AM = this.gameMinutes - 360;
          this.hoursAfter6AM = Math.floor(minutesAfter6AM / 60);
          
          // Roll over to next day at midnight (720 minutes = 12 hours after midnight = next day)
          // Since we start at 12 AM (0), 6 AM is 360, next 12 AM is 720
          if (this.gameMinutes >= 720) {
            this.gameMinutes = 0;  // Reset to 12:00 AM
            this.endlessDay++;
            this.showAlert(`DAY ${this.endlessDay}`, 0xff4444);
            console.log(`🌙 Endless Night 6 - Day ${this.endlessDay} begins!`);
          }
        } else {
          // Normal night or Nightmare Mode - victory!
          this.victory();
          return;
        }
      }
    }
    
    // ---- DISPENSER: GENERATE METAL ----
    // Metal generation pauses when:
    // 1. Using wrangler light (aiming at a door)
    // 2. Teleported away from Intel room (not near dispenser)
    const isUsingLight = this.sentry.isWrangled && this.sentry.aimedDoor !== 'NONE';
    const awayFromDispenser = this.isTeleported;
    if (!isUsingLight && !awayFromDispenser) {
      const metalPerFrame = (GAME_CONSTANTS.DISPENSER_RATE / 1000) * delta;
      this.metal = Math.min(this.metal + metalPerFrame, GAME_CONSTANTS.MAX_METAL);
    }
    
    // ---- UPDATE AIMING (hold A/D to aim) ----
    this.updateAiming();

    // ---- MERASMUS FADE THREAT (Custom Night) ----
    this.updateMerasmus(delta);
    
    // ---- UPDATE ENEMIES ----
    this.updateEnemies(delta);
    
    // ---- UPDATE CAMERA BOOT TIMER ----
    if (this.isCameraMode && this.isCameraBooting) {
      this.cameraBootTimer += delta;
      
      // Update boot progress bar and percentage
      const progress = Math.min(this.cameraBootTimer / this.CAMERA_BOOT_DELAY, 1);
      const bootBarFill = this.cameraBootOverlay.getByName('bootBarFill') as Phaser.GameObjects.Rectangle;
      const bootPercent = this.cameraBootOverlay.getByName('bootPercent') as Phaser.GameObjects.Text;
      if (bootBarFill) bootBarFill.setSize(294 * progress, 14);
      if (bootPercent) bootPercent.setText(`${Math.floor(progress * 100)}%`);
      
      // Camera buttons stay enabled during boot so player can select teleport destination
      
      // Boot complete after 1 second
      if (this.cameraBootTimer >= this.CAMERA_BOOT_DELAY) {
        this.isCameraBooting = false;
        this.cameraBootOverlay.setVisible(false);
        
        // Update lure button visibility now that boot is complete
        this.updateCameraLureButton();
      }
    }
    
    // ---- UPDATE CAMERA VIEW ----
    if (this.isCameraMode) {
      this.updateCameraView();
    }
    
    // ---- UPDATE WRANGLER VISUALS (to show enemies in doorways) ----
    if (this.sentry.isWrangled) {
      this.updateWranglerVisuals();
    }
    
    // ---- UPDATE HUD ----
    this.updateHUD();
  }
  
  private updateEnemies(delta: number): void {
    // Calculate difficulty scaling for endless Night 6
    // Timer reduction makes enemies act as if more time has passed
    const timerReduction = this.getEndlessTimerReduction();
    const demoSpeedMultiplier = this.getDemomanSpeedMultiplier();
    const pyroTeleportReduction = this.getPyroTeleportReduction();
    
    // Scale factor for Scout/Soldier/Heavy/Sniper (faster = higher effective delta)
    // Each hour after 6 AM, reduce timers by 1 second = enemies effectively get 1 second "ahead"
    // We achieve this by scaling delta slightly higher
    const timerScaleFactor = timerReduction > 0 ? 1 + (timerReduction / 10000) : 1;  // Gradual scaling
    
    // Update Scout (if enabled and started)
    // Night 1: Scout doesn't start until 1am to give player time to learn
    if (this.isScoutEnabled() && this.hasScoutStarted()) {
      const scoutDelta = delta * timerScaleFactor;
      const scoutResult = this.scout.update(scoutDelta);
      
      if (scoutResult.reachedIntel) {
        // Scout reached Intel Room
        const scoutIsUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SCOUT');
        
        if (scoutIsUbered) {
          // Übered Scout - cannot be stopped by sentry!
          if (this.isTeleported) {
            // Player escaped via teleporter - Scout retreats, sentry destroyed
            console.log('💉 Übered Scout reached Intel but player escaped!');
            this.handleUberedEnemyEscaped('SCOUT');
          } else {
            // Player is in Intel - Übered Scout kills!
            this.gameOver('Übered Scout broke in! You should have teleported!');
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Scout waits in Intel - player dies when they return
            console.log('Scout reached Intel but player was teleported!');
            // Scout will be at Intel - player dies when they return (handled in returnToIntel)
          } else {
            this.gameOver('Scout broke in with no sentry!');
            return;
          }
        } else {
          // Sentry exists
          // If sentry is WRANGLED, player must manually fire to repel - otherwise GAME OVER
          if (this.sentry.isWrangled) {
            // Player was wrangling but didn't fire in time - Scout kills!
            if (!this.isTeleported) {
              this.gameOver('Scout attacked while sentry was wrangled!');
              return;
            }
          } else {
            // Sentry is UNWRANGLED - trigger auto-defense (sentry destroyed, scout repelled)
            this.triggerAutoDefense('SCOUT');
          }
        }
      }
    }
    
    // Update Soldier (if enabled and started)
    // Night 1: Soldier doesn't start until 1am to give player time to learn
    if (this.isSoldierEnabled() && this.hasSoldierStarted()) {
      const soldierDelta = delta * timerScaleFactor;
      const soldierResult = this.soldier.update(soldierDelta);
      
      if (soldierResult.reachedIntel) {
        // Soldier reached Intel Room
        const soldierIsUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SOLDIER');
        
        if (soldierIsUbered) {
          // Übered Soldier - cannot be stopped by sentry!
          if (this.isTeleported) {
            // Player escaped via teleporter - Soldier retreats, sentry destroyed
            console.log('💉 Übered Soldier reached Intel but player escaped!');
            this.handleUberedEnemyEscaped('SOLDIER');
          } else {
            // Player is in Intel - Übered Soldier kills!
            this.gameOver('Übered Soldier breached! You should have teleported!');
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Soldier waits in Intel - player dies when they return
            console.log('Soldier reached Intel but player was teleported!');
          } else {
            this.gameOver('Soldier breached with no sentry!');
            return;
          }
        } else {
          // Soldier won't attack if sentry exists - he sieges instead
          // This case shouldn't normally happen because Soldier transitions to SIEGING
          // But if it does, he just retreats
          this.soldier.driveAway();
        }
      }
    }
    
    // Update Demoman (if enabled and started)
    // Night 2: Demoman doesn't start until 1am to give player time to learn
    if (this.isDemomanEnabled() && this.hasDemomanStarted()) {
      // Check if player is watching Demoman's head
      // Can watch on cameras OR if head is in Intel room (cameras down = watching it)
      // BUT destroyed cameras don't count as watching!
      // Viewing vents does NOT count as watching cameras
      let isWatchingHead = false;
      
      if (this.isCameraMode && !this.isVentCameraMode) {
        // Watching on camera - but only if camera is NOT destroyed
        const selectedCam = CAMERAS[this.selectedCamera];
        const camState = this.cameraStates.get(selectedCam.id);
        const cameraWorking = !camState || !camState.destroyed;
        
        if (cameraWorking) {
          isWatchingHead = this.demoman.isHeadAtCamera(selectedCam.node);
        }
        // If camera is destroyed, we can't see Demoman's head even if it's there
      } else if (!this.isCameraMode) {
        // Cameras down - if head is in Intel room, player is "watching" it
        isWatchingHead = this.demoman.isHeadInIntelRoom();
      }
      
      this.demoman.setBeingWatched(isWatchingHead);
      
      // Demoman gets progressively faster in endless mode (1.2x, 1.4x, 1.6x, etc.)
      const demoDelta = delta * demoSpeedMultiplier;
      const demoResult = this.demoman.update(demoDelta);
      
      // If Demoman's eye just lit (charge warning), evacuate Pyro from hallways
      if (demoResult.eyeJustLit && this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
        // Pass the charging direction so Pyro won't teleport back into that hallway
        const chargingHallway = this.demoman.activeEye;
        if (chargingHallway === 'LEFT' || chargingHallway === 'RIGHT') {
          this.pyro.onDemomanChargeStart(chargingHallway);
        }
      }
      
      // Update Demoman head visibility in Intel room
      this.updateDemomanHeadVisual();
      
      // Update Demoman doorway visibility
      this.updateDemomanDoorwayVisual();
      
      if (demoResult.reachedIntel) {
        // Demoman charged into Intel Room
        const chargeDoor = this.demoman.getChargeDoor();
        const doorName = chargeDoor === 'LEFT' ? 'LEFT' : 'RIGHT';
        const demoIsUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
        
        if (demoIsUbered) {
          // Übered Demoman - cannot be stopped by sentry!
          if (this.isTeleported) {
            // Player escaped via teleporter - Demoman retreats, sentry destroyed
            console.log('💉 Übered Demoman reached Intel but player escaped!');
            this.handleUberedEnemyEscaped('DEMOMAN');
          } else {
            // Player is in Intel - Übered Demoman kills!
            this.gameOver(`Übered Demoman charged from ${doorName}! You should have teleported!`);
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Demoman waits in Intel - player dies when they return
            console.log('Demoman reached Intel but player was teleported!');
          } else {
            this.gameOver(`Demoman charged from ${doorName}!`);
            return;
          }
        } else if (this.sentry.isWrangled) {
          // Player had wrangler on but didn't stop him
          if (!this.isTeleported) {
            this.gameOver(`Demoman charged from ${doorName}!`);
            return;
          }
        } else {
          // Sentry is UNWRANGLED - auto-defense (sentry destroyed, demoman deterred)
          this.triggerAutoDefense('DEMOMAN');
        }
      }
    }
    
    // Check for Übered enemies waiting at door when player is teleported
    // They should leave immediately instead of waiting
    if (this.isTeleported && this.isMedicEnabled() && this.medic && !this.medic.isForceDespawned()) {
      // Scout waiting at door while Übered
      if (this.isScoutEnabled() && this.medic.isEnemyUbered('SCOUT') && 
          this.scout.currentNode === 'LEFT_HALL' && 
          (this.scout.state === 'WAITING')) {
        console.log('💉 Übered Scout leaving - player teleported away');
        this.handleUberedEnemyEscaped('SCOUT');
      }
      
      // Soldier waiting/sieging at door while Übered
      if (this.isSoldierEnabled() && this.medic.isEnemyUbered('SOLDIER') && 
          this.soldier.currentNode === 'RIGHT_HALL' && 
          (this.soldier.state === 'WAITING' || this.soldier.state === 'SIEGING')) {
        console.log('💉 Übered Soldier leaving - player teleported away');
        this.handleUberedEnemyEscaped('SOLDIER');
      }
      
      // Demoman charging or waiting while Übered
      // Note: Demoman uses CHARGING state, not WAITING, when rushing to the door
      if (this.isDemomanEnabled() && this.medic.isEnemyUbered('DEMOMAN') && 
          (this.demoman.state === 'CHARGING' || this.demoman.state === 'WAITING')) {
        console.log('💉 Übered Demoman leaving - player teleported away');
        this.handleUberedEnemyEscaped('DEMOMAN');
      }
    }
    
    // Update Heavy, Sniper, Spy, Pyro (if enabled)
    if (this.isHeavyEnabled() || this.isSniperEnabled() || this.isSpyEnabled() || this.isPyroEnabled()) {
      this.updateHeavyAndSniper(delta, timerScaleFactor, pyroTeleportReduction);
    }

    // Update Medic (Custom Night only) - outside updateHeavyAndSniper so it runs even when no other enemies are active
    if (this.isMedicEnabled() && this.medic && !this.medic.isForceDespawned()) {
      this.medic.update(delta);
    }

    // Update Medic ghost apparition (Endless Night 6, Nightmare Mode, Custom Night)
    // Must be outside updateHeavyAndSniper: that only runs when Heavy/Sniper/Spy/Pyro
    // are enabled, which silently disabled the ghost on Medic-only loadouts
    this.updateMedicGhost(delta);

    // Update Administrator (Custom Night only) - outside updateHeavyAndSniper so it runs even alone
    if (this.isAdministratorEnabled() && this.administrator && this.administrator.isActive()) {
      // Tick Mode 2 no-teleport timer (only when player is in Intel, not teleported)
      // Nightmare Mode: Mode 1 only — skip the fallback hack bar entirely
      if (!this.isNightmareMode && !this.isTeleported && !this.isTeleportAnimating) {
        this.administratorNoTeleportTimer += delta;
        if (
          this.administratorNoTeleportTimer >= GAME_CONSTANTS.ADMINISTRATOR_NO_TELEPORT_THRESHOLD &&
          this.administrator.getState() === 'WAITING'
        ) {
          this.administratorNoTeleportTimer = 0;
          const excludedNodes = Array.from(this.hackedRooms.entries())
            .filter(([node, s]) => s.hacked || this.isNodeCameraDestroyed(node))
            .map(([node]) => node);
          this.administrator.triggerFallbackHack(excludedNodes);
          if (this.administrator.getState() === 'TARGETING') {
            this.audio.playAdministratorTargetingSound();
          }
          console.log('📋 Administrator Mode 2 fallback triggered (no teleport for 30s)');
        }
      }

      const administratorResult = this.administrator.update(delta);
      if (administratorResult.hackComplete && administratorResult.targetNode) {
        const hackedState = this.hackedRooms.get(administratorResult.targetNode);
        if (hackedState && !hackedState.hacked) {
          // Only apply if not already hacked by Mode 1 mid-way through
          hackedState.hacked = true;
          hackedState.repairProgress = 0;
          this.showAlert(`⚠ ADMINISTRATOR: ${administratorResult.targetNode.replace('_', ' ')} TELEPORTER HACKED`, 0x9944cc);
          this.updateHackedRoomMapIndicators();
          this.audio.playAdministratorHackSound();
          if (this.isCameraMode) this.updateTeleportButtonAppearance();
        }
      }

      // Drive hold-to-repair via teleport button
      if (this.isCameraMode && this.administratorRepairActive) {
        const cam = CAMERAS[this.selectedCamera];
        const hackedState = cam ? this.hackedRooms.get(cam.node) : null;
        if (hackedState && hackedState.hacked) {
          hackedState.repairProgress += delta / GAME_CONSTANTS.ADMINISTRATOR_REPAIR_DURATION;
          // Repair tick sound while holding
          this.audio.playAdministratorRepairTickSound();
          // Update bar fill
          if (this.teleportRepairBarFill) {
            this.teleportRepairBarFill.setScale(Math.min(hackedState.repairProgress, 1), 1);
          }
          if (hackedState.repairProgress >= 1) {
            hackedState.hacked = false;
            hackedState.repairProgress = 0;
            this.administratorRepairActive = false;
            if (this.teleportRepairBarFill) this.teleportRepairBarFill.setScale(0, 1);
            this.showAlert('Teleporter restored!', 0x00ff88);
            this.audio.playAdministratorRepairCompleteSound();
            this.updateHackedRoomMapIndicators();
            this.updateTeleportButtonAppearance();
          }
        } else {
          // Room no longer hacked (race condition guard)
          this.administratorRepairActive = false;
        }
      } else if (!this.administratorRepairActive) {
        // Decay repair progress on ALL hacked rooms whenever not actively repairing
        this.hackedRooms.forEach((hackedState) => {
          if (hackedState.hacked && hackedState.repairProgress > 0) {
            hackedState.repairProgress = Math.max(0, hackedState.repairProgress - delta / (GAME_CONSTANTS.ADMINISTRATOR_REPAIR_DURATION * 2));
          }
        });
        // Sync the repair bar visual for the currently viewed camera
        if (this.isCameraMode) {
          const cam = CAMERAS[this.selectedCamera];
          const hackedState = cam ? this.hackedRooms.get(cam.node) : null;
          if (hackedState && this.teleportRepairBarFill) {
            this.teleportRepairBarFill.setScale(Math.min(hackedState.repairProgress, 1), 1);
          }
        }
      }

      // Keep teleport button appearance in sync each frame
      if (this.isCameraMode) this.updateTeleportButtonAppearance();
    }

    // Update Pauling vent system and thermostat (Custom Night only)
    this.updatePaulingAndThermostat(delta);
    this.updateVentUI();

    // Update teleport danger check (always runs, regardless of which enemies are enabled)
    this.updateTeleportDanger(delta);
  }
  
  /**
   * Update Heavy (Night 3+) and Sniper (Night 4+) enemies
   * @param timerScaleFactor - Speed multiplier for endless Night 6 difficulty scaling
   * @param pyroTeleportReduction - Pyro teleport interval reduction (ms) for endless mode
   */
  private updateHeavyAndSniper(delta: number, timerScaleFactor: number = 1, pyroTeleportReduction: number = 0): void {
    const heavyEnabled = this.isHeavyEnabled();
    const sniperEnabled = this.isSniperEnabled();
    // Track if player is watching Heavy/Sniper on camera
    // Viewing vents does NOT count as watching cameras
    if (this.isCameraMode && !this.isVentCameraMode) {
      const selectedCam = CAMERAS[this.selectedCamera];
      const camState = this.cameraStates.get(selectedCam.id);
      
      // Only track watching if camera isn't destroyed
      // During camera boot, timers are PAUSED (not watched) - this is fair to the player
      if (!camState?.destroyed) {
        if (this.isCameraBooting) {
          // During boot: pause Heavy/Sniper timers (don't count as watched OR unwatched)
          // By not calling setBeingWatched, their timers stay frozen
          // We explicitly set to false so timers don't build up during boot
          this.heavy.setBeingWatched(false);
          if (this.isSniperEnabled()) {
            this.sniper.setBeingWatched(false);
          }
        } else {
          // Normal operation: track watching
          const heavyAtCam = this.isHeavyEnabled() && this.heavy.isAtNode(selectedCam.node);
          const sniperAtCam = this.isSniperEnabled() && this.sniper.isAtNode(selectedCam.node);
          
          // If BOTH Heavy and Sniper are on the same camera, their timers run at 2x speed
          // If enemy is LURED, add 1.5x multiplier (makes it harder to watch lured enemies)
          let heavyMultiplier = (heavyAtCam && sniperAtCam) ? 2 : 1;
          let sniperMultiplier = (heavyAtCam && sniperAtCam) ? 2 : 1;
          
          // Apply 1.5x when lured (stacks with double multiplier if both on same camera)
          if (this.heavy.isCurrentlyLured()) {
            heavyMultiplier *= 1.5;
          }
          if (this.isSniperEnabled() && this.sniper.isCurrentlyLured()) {
            sniperMultiplier *= 1.5;
          }
          
          this.heavy.setBeingWatched(heavyAtCam, heavyMultiplier);
          // Sniper watching (if enabled)
          if (this.isSniperEnabled()) {
            this.sniper.setBeingWatched(sniperAtCam, sniperMultiplier);
          }
        }
      }
    } else {
      this.heavy.setBeingWatched(false);
      if (this.isSniperEnabled()) {
        this.sniper.setBeingWatched(false);
      }
    }
    
    // Update lure duration and bar
    if (this.activeLure && this.activeLure.playing) {
      this.activeLure.playTimeRemaining -= delta;
      
      // Update lure bar
      const progress = this.activeLure.playTimeRemaining / GAME_CONSTANTS.LURE_DURATION;
      const fillWidth = Math.max(0, 118 * progress);
      this.lureBarFill.setSize(fillWidth, 20);
      this.lureBarText.setText(`LURE ${Math.ceil(this.activeLure.playTimeRemaining / 1000)}s`);
      this.lureBarContainer.setVisible(true);
      
      if (this.activeLure.playTimeRemaining <= 0) {
        // Lure is consumed (auto-removed after playing)
        console.log('Lure consumed - enemies will return to patrolling');
        this.showAlert('LURE CONSUMED!', 0xff6600);
        this.audio.playLureConsumedSound();
        // Clear Heavy's lure target so he resumes patrol
        if (this.heavy && this.heavy.isCurrentlyLured()) {
          this.heavy.clearLure();
        }
        // Clear Sniper's lure target (Night 4+)
        if (this.isSniperEnabled() && this.sniper && this.sniper.isCurrentlyLured()) {
          this.sniper.clearLure();
        }
        // Remove the lure entirely
        this.activeLure = null;
        this.lureBarContainer.setVisible(false);
        this.updateLureButtonText();
        this.updateCameraLureButton();
      }
    } else {
      // Hide lure bar if no active lure playing
      this.lureBarContainer.setVisible(false);
    }
    
    // Check if Heavy should be lured by PLAYING lure
    if (this.activeLure && this.activeLure.playing) {
      const lureNode = this.activeLure.node;
      
      // Try to lure Heavy if adjacent
      if (!this.heavy.isCurrentlyLured()) {
        const wasLured = this.heavy.lure(lureNode);
        if (wasLured) {
          console.log(`Heavy lured toward ${lureNode}!`);
        }
      }
    }
    
    // Update Heavy (if enabled and started)
    // Night 3: Heavy doesn't start until 1am to give player time to learn
    if (heavyEnabled && this.hasHeavyStarted()) {
      // Heavy moves faster in endless mode
      const heavyDelta = delta * timerScaleFactor;
      const heavyResult = this.heavy.update(heavyDelta);
      
      if (heavyResult.destroyedCamera) {
      // Camera destruction is handled by callback
    }
    
      if (heavyResult.reachedIntel) {
        // Heavy reached Intel - only kills if player is there!
        if (!this.isTeleported) {
          this.gameOver('Heavy smashed through!');
          return;
        } else {
          // Player escaped by teleporting! Heavy waits in Intel
          console.log('Heavy reached Intel but player was teleported!');
          // Heavy will be in Intel - player dies when they return (checked in returnToIntel)
        }
      }
    }
    
    // Update Sniper (if enabled)
    if (sniperEnabled) {
      // Try to lure Sniper if lure is playing
      if (this.activeLure && this.activeLure.playing) {
        const sniperLureNode = this.activeLure.node;
        if (!this.sniper.isCurrentlyLured()) {
          const wasLured = this.sniper.lure(sniperLureNode);
          if (wasLured) {
            console.log(`Sniper lured toward ${sniperLureNode}!`);
          }
        }
      }
      
      // Sniper moves and charges faster in endless mode
      const sniperDelta = delta * timerScaleFactor;
      const sniperResult = this.sniper.update(sniperDelta);
      
      if (sniperResult.headshotThroughCamera) {
        // Sniper headshot the player through the camera!
        this.gameOver('Sniped through the camera!');
        return;
      }
      
      if (sniperResult.headshotReady) {
        // Sniper has charged a headshot - only kills if player is in Intel room!
        if (!this.isTeleported) {
          const door = this.sniper.getAimingDoor();
          this.gameOver(`Sniped from ${door} hall!`);
          return;
        } else {
          // Player dodged by teleporting! Sniper destroys sentry and teleports away
          console.log('Sniper headshot missed player but destroyed sentry!');
          this.destroySentry();
          this.showAlert('SNIPER DESTROYED YOUR SENTRY!', 0xff0000);
          // Sniper teleports to a random room (not halls)
          this.sniper.forceDespawn();
          this.sniper.respawn();
        }
      }
      
      // Update sniper laser visuals
      this.updateSniperVisuals();
    }
    
    // Update Spy (if enabled)
    if (this.isSpyEnabled() && this.spy) {
      this.spy.update(delta);
      
      // Handle sapper removal timeout - if player doesn't press SPACE again in time, reset counter
      if (this.sapperRemoveClicks > 0) {
        this.sapperRemoveTimeout -= delta;
        if (this.sapperRemoveTimeout <= 0) {
          this.sapperRemoveClicks = 0;
        }
      }
      
      // Update sapper indicator visibility
      if (this.spy.isSapping() && this.sentry.exists) {
        this.sapperIndicator.setVisible(true);
      } else {
        this.sapperIndicator.setVisible(false);
        this.audio.stopSapperSound();
      }
    }
    
    // Update Pyro (Custom Night only)
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      // Player is in Intel if not teleported away
      const playerInIntel = !this.isTeleported;
      
      // Tell Pyro which hallway is blocked (player shining light there)
      // This prevents Pyro from teleporting into a lit hallway
      const playerLightingHallway = playerInIntel && 
                                    !this.isCameraMode &&
                                    this.sentry.exists && 
                                    this.sentry.isWrangled &&
                                    this.sentry.aimedDoor !== 'NONE';
      if (playerLightingHallway) {
        this.pyro.setBlockedHallway(this.sentry.aimedDoor as 'LEFT' | 'RIGHT');
      } else {
        this.pyro.setBlockedHallway(null);
      }
      
      // Tell Pyro which hallway Sniper is aiming from (prevents unfair Pyro+Sniper combo)
      if (this.isSniperEnabled() && this.sniper.isActive()) {
        const sniperHallway = this.sniper.getAimingDoor();
        this.pyro.setSniperChargingHallway(sniperHallway);
      } else {
        this.pyro.setSniperChargingHallway(null);
      }
      
      // Check if player is shining wrangler light on Pyro in hallway
      const pyroHallway = this.pyro.getHallway();
      const isLightingPyro = playerInIntel && 
                             !this.isCameraMode &&
                             this.sentry.exists && 
                             this.sentry.isWrangled && 
                             pyroHallway !== null &&
                             this.sentry.aimedDoor === pyroHallway;
      
      // Update light exposure and check if Pyro was driven away
      // Reward = metal lost during 1.5s repel time (11.25) + 10 bonus ≈ 20 metal
      const pyroDrivenAway = this.pyro.updateLightExposure(isLightingPyro, delta);
      if (pyroDrivenAway) {
        this.showAlert('Pyro fled! +20 metal', 0x00ff00);
        this.metal = Math.min(this.metal + 20, GAME_CONSTANTS.MAX_METAL);
        this.updateHUD();
      }
      
      // Update Pyro mask burn overlay based on light exposure progress
      const burnProgress = this.pyro.getLightExposureProgress();
      if (pyroHallway === 'LEFT' && this.pyroMaskLeftBurn) {
        // Fade in white overlay as exposure increases (0 -> 0.9 alpha)
        this.pyroMaskLeftBurn.setAlpha(burnProgress * 0.9);
        this.pyroMaskRightBurn?.setAlpha(0);
      } else if (pyroHallway === 'RIGHT' && this.pyroMaskRightBurn) {
        this.pyroMaskRightBurn.setAlpha(burnProgress * 0.9);
        this.pyroMaskLeftBurn?.setAlpha(0);
      } else {
        // Reset both if Pyro not in hallway
        this.pyroMaskLeftBurn?.setAlpha(0);
        this.pyroMaskRightBurn?.setAlpha(0);
      }
      
      // Pyro teleports more frequently in endless mode
      const pyroDelta = delta * (1 + (pyroTeleportReduction / 5000));  // Gradual increase
      const pyroResult = this.pyro.update(pyroDelta, playerInIntel);
      
      // Handle match just lit warning
      if (pyroResult.matchJustLit) {
        // Match was just lit - show escape warning (handled by callback, but update UI too)
        this.showPyroEscapeWarning(true);
      }
      
      // Handle ongoing escape timer
      if (pyroResult.playerMustEscape && playerInIntel) {
        // Update escape timer display
        const timeRemaining = Math.ceil(pyroResult.escapeTimeRemaining / 1000);
        this.updatePyroEscapeTimer(timeRemaining);
      } else {
        this.showPyroEscapeWarning(false);
        // Stop crackling if match is no longer lit
        if (!this.pyro.isMatchLit()) {
          this.audio.stopPyroCracklingAmbient();
        }
      }
      
      // Handle player burned (didn't escape in time)
      if (pyroResult.playerBurned && playerInIntel) {
        this.gameOver('Pyro burned you alive!');
      }
      
      // If player teleported away while match was lit, notify Pyro
      if (this.isTeleported && this.pyro.isMatchLit()) {
        this.pyro.onPlayerEscaped();
        this.showAlert('Escaped Pyro!', 0x00ff00);
        this.showPyroEscapeWarning(false);
        this.audio.stopPyroCracklingAmbient();
      }
    }

    this.audio.updatePyroHallwayAudio(delta);

    // Update camera repair timers
    const now = Date.now();
    this.cameraStates.forEach((state, _camId) => {
      if (state.destroyed && state.destroyedUntil <= now) {
        state.destroyed = false;
        state.destroyedBy = null;
      }
    });
  }
  
  /**
   * Update teleport danger check - runs every frame regardless of which enemies are enabled
   */
  private updateTeleportDanger(delta: number): void {
    // Only run on Night 3+ when teleporting is available (escapeWarning only exists then)
    if (!this.escapeWarning) return;
    
    // Check if enemy is IN the Engineer's room or approaching
    if (this.isTeleported && this.currentRoom !== 'INTEL') {
      // Check if any enemy is IN the same room as engineer (very dangerous!)
      const scoutInRoom = this.isScoutEnabled() && this.scout.currentNode === this.currentRoom && this.scout.isActive();
      const soldierInRoom = this.isSoldierEnabled() && this.soldier.currentNode === this.currentRoom && this.soldier.isActive();
      const heavyInRoom = this.isHeavyEnabled() && this.heavy.currentNode === this.currentRoom && this.heavy.isActive();
      const sniperInRoom = this.isSniperEnabled() && this.sniper.currentNode === this.currentRoom && this.sniper.isActive();
      const demomanInRoom = this.isDemomanEnabled() && this.demoman.isCharging() && this.demoman.currentNode === this.currentRoom;
      const pyroInRoom = this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned() && this.pyro.isAtNode(this.currentRoom);
      
      const enemyInRoom = scoutInRoom || soldierInRoom || heavyInRoom || sniperInRoom || demomanInRoom || pyroInRoom;
      
      const adjacent = ROOM_ADJACENCY[this.currentRoom] || [];
      
      // Identify which enemy is approaching (prioritize in-room over adjacent)
      let newApproachingEnemy = '';
      if (pyroInRoom) newApproachingEnemy = 'Pyro';
      else if (scoutInRoom) newApproachingEnemy = 'Scout';
      else if (soldierInRoom) newApproachingEnemy = 'Soldier';
      else if (heavyInRoom) newApproachingEnemy = 'Heavy';
      else if (sniperInRoom) newApproachingEnemy = 'Sniper';
      else if (demomanInRoom) newApproachingEnemy = 'Demoman';
      else if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned() && this.pyro.getMode() === 'ROOM' && adjacent.includes(this.pyro.currentNode)) {
        newApproachingEnemy = 'Pyro';
      } else if (this.isHeavyEnabled() && this.heavy.isActive() && adjacent.includes(this.heavy.currentNode)) {
        newApproachingEnemy = 'Heavy';
      } else if (this.isSniperEnabled() && this.sniper.isActive() && adjacent.includes(this.sniper.currentNode)) {
        newApproachingEnemy = 'Sniper';
      } else if (this.isScoutEnabled() && this.scout.isActive() && adjacent.includes(this.scout.currentNode)) {
        newApproachingEnemy = 'Scout';
      } else if (this.isSoldierEnabled() && this.soldier.isActive() && adjacent.includes(this.soldier.currentNode)) {
        newApproachingEnemy = 'Soldier';
      }
      
      // Enemy in room OR adjacent triggers warning
      const enemyApproaching = enemyInRoom || !!newApproachingEnemy;
      
      if (enemyApproaching && !this.enemyApproachingRoom) {
        // Enemy just arrived - start the danger timer
        this.enemyApproachingRoom = true;
        this.approachingEnemyType = newApproachingEnemy || 'an enemy';
        this.teleportEscapeTimer = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
        this.showAlert('A nearby enemy heard you!', 0xff0000);
        this.escapeWarning.setVisible(true);
        this.roomDoorwayEyes.setVisible(true);
        this.audio.playEnemyApproachSound();
      } else if (!enemyApproaching && this.enemyApproachingRoom) {
        // Enemy left the area - reset the warning so it can trigger again
        // But DON'T hide the escape warning yet - player still needs to leave
        // Just allow future enemies to re-trigger the alert
        console.log('Enemy left area, resetting approach detection');
        this.enemyApproachingRoom = false;
        this.escapeWarning.setVisible(false);
        this.roomDoorwayEyes.setVisible(false);
        this.audio.stopApproachGrowl();
      }
      
      // Keep the danger active while enemy is nearby
      if (this.enemyApproachingRoom) {
        this.teleportEscapeTimer -= delta;
        
        // Update progress bar (shrinks from full to empty)
        const progress = Math.max(0, this.teleportEscapeTimer / GAME_CONSTANTS.TELEPORT_ESCAPE_TIME);
        const progressBar = this.escapeWarning.list[1] as Phaser.GameObjects.Rectangle;
        const innerGlow = this.escapeWarning.list[2] as Phaser.GameObjects.Rectangle;
        
        // Use displayWidth instead of scale for proper visual shrinking
        progressBar.displayWidth = 310 * progress;
        innerGlow.displayWidth = 310 * progress;
        
        // Shake effect - gets more intense as time runs out
        const shakeIntensity = (1 - progress) * 8;
        this.escapeWarning.setPosition(640 + (Math.random() - 0.5) * shakeIntensity, 580);
        
        // Pulse the red eyes
        const eyesAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.4;
        this.roomDoorwayEyes.setAlpha(eyesAlpha);
        
        // Update growl intensity
        this.audio.updateApproachGrowl(this.teleportEscapeTimer);
        
        if (this.teleportEscapeTimer <= 0) {
          // Too late - player dies. Use the enemy that triggered the approach.
          this.audio.stopApproachGrowl();
          
          // Use the stored approaching enemy type (the one who triggered the timer)
          // This ensures proper jumpscare even if the enemy moved away
          const killer = this.approachingEnemyType || 'an enemy';
          
          this.gameOver(`${killer} caught you!`);
          return;
        }
      }
    } else if (!this.isTeleported && this.escapeWarning.visible) {
      // Hide warning when back at Intel
      this.escapeWarning.setVisible(false);
      this.audio.stopApproachGrowl();
    }
  }
  
  /**
   * Handle camera destroyed by Heavy (Sniper headshots player instead of destroying cameras)
   */
  private onCameraDestroyed(node: NodeId, destroyedBy: 'HEAVY'): void {
    // Find which camera corresponds to this node
    const camera = CAMERAS.find(cam => cam.node === node);
    if (!camera) return;
    
    const camState = this.cameraStates.get(camera.id);
    if (!camState) return;
    
    camState.destroyed = true;
    camState.destroyedUntil = Date.now() + GAME_CONSTANTS.CAMERA_REPAIR_TIME;
    camState.destroyedBy = destroyedBy;
    
    this.audio.playCameraDestroySound();
    this.showAlert(`${destroyedBy} destroyed ${camera.name} camera!`, 0xff4444);
    
    console.log(`Camera ${camera.name} destroyed by ${destroyedBy}!`);
  }
  
  /**
   * Handle Heavy reaching the door
   */
  private onHeavyAtDoor(): void {
    // Heavy at door - nothing can stop him except lures
    console.log('Heavy at door!');
  }
  
  /**
   * Handle Spy sapper damaging the sentry (Night 5+)
   */
  private onSpySapDamage(damage: number): void {
    if (!this.sentry.exists) return;
    
    this.sentry.hp -= damage;
    
    // Update sentry visuals based on damage
    const healthPercent = this.sentry.hp / this.sentry.maxHp;
    if (healthPercent < 0.3) {
      this.sentryBody.setFillStyle(0xff4444); // Critical
    } else if (healthPercent < 0.6) {
      this.sentryBody.setFillStyle(0xDD6666); // Damaged (lighter red)
    } else {
      this.sentryBody.setFillStyle(0xBB4444); // Healthy RED
    }
    
    if (this.sentry.hp <= 0) {
      this.destroySentry();
      this.showAlert('SPY SAPPED YOUR SENTRY!', 0xff0000);
      if (this.spy) this.spy.removeSapper();
      this.sapperIndicator.setVisible(false);
      this.audio.stopSapperSound();
    }
    
    this.updateHUD();
  }
  
  /**
   * Handle Sniper headshot
   */
  private onSniperHeadshot(): void {
    // This is triggered when sniper's charge completes
    this.gameOver('Sniped!');
  }
  
  /**
   * Handle Pyro match lit warning (Custom Night)
   * No alert notification - just play the sound. The escape timer UI will show.
   */
  private onPyroMatchLit(): void {
    console.log('🔥 PYRO MATCH LIT! ESCAPE NOW!');
    this.audio.playPyroMatchSound();
  }
  
  /**
   * Update sniper charge visual overlay
   * @deprecated Visual handled inline in update loop
   */
  private _updateSniperChargeVisual(): void {
    if (!this.sniperChargeOverlay) return;
    
    if (this.sniper.isChargingHeadshot() && !this.isCameraMode && !this.isTeleported) {
      const progress = this.sniper.getChargeProgress();
      this.sniperChargeOverlay.setVisible(true);
      this.sniperChargeOverlay.setAlpha(progress * 0.4);
      
      // Flash red as it gets close
      if (progress > 0.7) {
        const flash = Math.sin(Date.now() / 100) * 0.5 + 0.5;
        this.sniperChargeOverlay.setAlpha(progress * 0.4 + flash * 0.2);
      }
    } else {
      this.sniperChargeOverlay.setVisible(false);
    }
  }
  
  /**
   * Sniper charge progress callback
   */
  private onSniperChargeProgress(progress: number): void {
    // Play warning sound when charge gets high
    if (progress > 0.5 && progress < 0.55) {
      this.audio.playSniperChargeSound();
    }
  }
  
  /**
   * Update Demoman head visual in Intel room
   */
  private updateDemomanHeadVisual(): void {
    if (!this.isDemomanEnabled()) {
      this.demomanHeadInRoom.setVisible(false);
      this.audio.stopDemoEyeGlowSound();
      return;
    }
    
    // Show head in Intel room if that's where it is
    const inIntelRoom = this.demoman.isHeadInIntelRoom();
    const headVisibleInRoom = inIntelRoom && !this.isCameraMode;
    this.demomanHeadInRoom.setVisible(headVisibleInRoom);
    
    // Check if eye is visible anywhere (room or on selected camera)
    const eyeGlowing = this.demoman.isEyeGlowing();
    const eyeVisibleOnCamera = this.isCameraMode && 
      this.demoman.isHeadAtCamera(CAMERAS[this.selectedCamera].node);
    const eyeVisible = eyeGlowing && (headVisibleInRoom || eyeVisibleOnCamera);
    
    // Play/stop fire sound based on eye visibility
    if (eyeVisible) {
      this.audio.startDemoEyeGlowSound();
    } else {
      this.audio.stopDemoEyeGlowSound();
    }
    
    // Update eye glow based on Demoman state
    // Check if Übered - use red glow instead of green
    const isUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
    const glowColor = isUbered ? 0xff4444 : 0x00ff44;  // Red when Übered, green otherwise
    
    this.demomanHeadEyeGlow.clear();
    if (eyeGlowing) {
      const eyeX = this.demoman.activeEye === 'LEFT' ? -10 : 10;
      // Glowing eye (red when Übered, green otherwise)
      this.demomanHeadEyeGlow.fillStyle(glowColor, 0.6);
      this.demomanHeadEyeGlow.fillCircle(eyeX, -5, 15);
      this.demomanHeadEyeGlow.fillStyle(glowColor, 1);
      this.demomanHeadEyeGlow.fillCircle(eyeX, -5, 8);
      this.demomanHeadEyeGlow.fillStyle(0xffffff, 1);
      this.demomanHeadEyeGlow.fillCircle(eyeX - 2, -7, 2);
      
      // Add outer red glow ring when Übered
      if (isUbered) {
        this.demomanHeadEyeGlow.fillStyle(0xff4444, 0.2);
        this.demomanHeadEyeGlow.fillCircle(0, 0, 50);
      }
    } else if (isUbered && headVisibleInRoom) {
      // Even when not actively glowing, show red Über aura around head
      this.demomanHeadEyeGlow.fillStyle(0xff4444, 0.15);
      this.demomanHeadEyeGlow.fillCircle(0, 0, 45);
      this.demomanHeadEyeGlow.fillStyle(0xff4444, 0.25);
      this.demomanHeadEyeGlow.fillCircle(0, 0, 30);
    }
  }
  
  /**
   * Update Demoman body visual in doorway (when charging)
   * First 0.75s: Approaching green glow (getting brighter)
   * Last 0.75s: Full body visible
   */
  private updateDemomanDoorwayVisual(): void {
    // Hide everything by default
    this.demomanInDoorway.setVisible(false);
    this.demomanApproachGlow.setVisible(false);
    this.demomanApproachGlow.clear();
    
    if (!this.isDemomanEnabled() || !this.demoman.isCharging()) {
      return;
    }
    
    // Position based on which door he's charging toward
    const chargeDoor = this.demoman.getChargeDoor();
    let doorX = 120;
    if (chargeDoor === 'LEFT') {
      doorX = 120;
      this.demomanInDoorway.setPosition(120, 720 / 2 - 30);
    } else if (chargeDoor === 'RIGHT') {
      doorX = 1280 - 120;
      this.demomanInDoorway.setPosition(1280 - 120, 720 / 2 - 30);
    }
    
    // Only show if at the doorway and wrangler light is on that door
    const atDoor = this.demoman.currentNode === 'LEFT_HALL' || this.demoman.currentNode === 'RIGHT_HALL';
    const lightOnDoor = this.sentry.isWrangled && 
                        ((chargeDoor === 'LEFT' && this.sentry.aimedDoor === 'LEFT') ||
                         (chargeDoor === 'RIGHT' && this.sentry.aimedDoor === 'RIGHT'));
    
    if (!atDoor || !lightOnDoor) {
      return;
    }
    
    // Get attack progress (0 to 1 over 1.5 seconds)
    const progress = this.demoman.getAttackProgress();
    
    // Check if Demoman is Übered - use red glow instead of green
    const isUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
    const glowColor = isUbered ? 0xff4444 : 0x00ff44;  // Red when Übered, green otherwise
    
    // First 0.75s (75%): approaching glow | Last 0.25s (25%): body visible
    if (progress < 0.75) {
      // First phase (0-0.75s): Show approaching glow, getting brighter
      // Progress 0-0.75 maps to glow intensity 0.1-0.6
      const phaseProgress = progress / 0.75; // Normalize to 0-1 for this phase
      const glowIntensity = 0.1 + phaseProgress * 0.5;
      const glowSize = 20 + phaseProgress * 60; // 20 to 80 pixels
      
      this.demomanApproachGlow.setVisible(true);
      
      // Draw approaching glow at door position
      // Outer glow
      this.demomanApproachGlow.fillStyle(glowColor, glowIntensity * 0.3);
      this.demomanApproachGlow.fillCircle(doorX, 360, glowSize * 1.5);
      // Middle glow
      this.demomanApproachGlow.fillStyle(glowColor, glowIntensity * 0.5);
      this.demomanApproachGlow.fillCircle(doorX, 360, glowSize);
      // Inner bright core
      this.demomanApproachGlow.fillStyle(glowColor, glowIntensity);
      this.demomanApproachGlow.fillCircle(doorX, 360, glowSize * 0.5);
      // Sword glow hint (vertical line)
      this.demomanApproachGlow.fillStyle(glowColor, glowIntensity * 0.8);
      this.demomanApproachGlow.fillRect(doorX - 3, 360 - glowSize, 6, glowSize * 2);
    } else {
      // Second phase (0.75-1.0s): Show full body - only 0.25s to react!
      this.demomanInDoorway.setVisible(true);
      
      // Show Über glow behind body if Übered
      if (isUbered) {
        const glowGraphics = chargeDoor === 'LEFT' ? this.uberGlowLeft : this.uberGlowRight;
        if (glowGraphics) {
          drawUberGlow(glowGraphics, doorX, 720 / 2 - 30);
          glowGraphics.setVisible(true);
        }
      }
    }
  }
  
  // ============================================
  // MEDIC GHOST APPARITION (ENDLESS NIGHT 6)
  // ============================================
  
  /**
   * Update Medic ghost apparition logic
   * Ghost appears randomly in doorways when Medic isn't actively ubering
   * Purely psychological - harmless, translucent, disappears when light shines on it
   * 
   * Ghost appears in:
   * - Endless Night 6 / Nightmare Mode: when Medic isn't actively Übering
   * - Custom Night: when Medic is enabled and isn't actively Übering
   */
  private updateMedicGhost(delta: number): void {
    // Check if Medic is enabled
    if (!this.isMedicEnabled()) {
      this.medicGhostVisual?.setVisible(false);
      return;
    }
    
    // Ghost appears in every mode where Medic exists (Endless Night 6, Nightmare
    // Mode, Custom Night), whenever he isn't actively Übering someone. On Custom
    // Night with über targets enabled this means the 60s gaps between übers.
    const ghostModeActive = this.isBadEndingNight6 || this.isNightmareMode || this.isCustomNightMode;
    
    if (!ghostModeActive) {
      this.medicGhostVisual?.setVisible(false);
      return;
    }
    
    // Check if Medic is currently ubering someone (ghost won't appear while ubering)
    const medicIsUbering = this.medic && this.medic.getCurrentTarget() !== null;
    
    if (this.medicGhostActive) {
      // Check if player is shining light on the ghost - it vanishes instantly!
      const isLightOnGhost = this.sentry.isWrangled && 
        ((this.medicGhostSide === 'LEFT' && this.sentry.aimedDoor === 'LEFT') ||
         (this.medicGhostSide === 'RIGHT' && this.sentry.aimedDoor === 'RIGHT'));
      
      if (isLightOnGhost) {
        // Ghost flickers and vanishes when light hits it
        this.medicGhostActive = false;
        this.medicGhostSide = null;
        this.medicGhostVisual.setVisible(false);
        this.medicGhostCooldown = 60000;  // 60 sec cooldown (max once per hour)
        this.audio.stopMedicGhostScream();  // Stop the scream immediately!
        console.log('👻 Medic ghost dispersed by light!');
        return;
      }
      
      // Ghost is currently visible - update timer
      this.medicGhostTimer += delta;
      
      // Fade out effect as ghost disappears
      const fadeProgress = this.medicGhostTimer / this.medicGhostDuration;
      const alpha = 0.35 * (1 - fadeProgress * 0.5);  // Fade from 0.35 to ~0.18
      this.medicGhostVisual.setAlpha(alpha);
      
      // Ghost duration complete - hide it
      if (this.medicGhostTimer >= this.medicGhostDuration) {
        this.medicGhostActive = false;
        this.medicGhostSide = null;
        this.medicGhostVisual.setVisible(false);
        this.medicGhostCooldown = 60000;  // 60 sec cooldown (max once per hour)
        this.audio.stopMedicGhostScream();  // Clean up audio
        console.log('👻 Medic ghost vanished');
      }
    } else {
      // Ghost not active - check if we should spawn one
      this.medicGhostCooldown -= delta;
      
      if (this.medicGhostCooldown <= 0 && !medicIsUbering) {
        // Spawn ghost when cooldown is ready (max once per hour)
        this.spawnMedicGhost();
      }
    }
    
    // Position ghost in correct doorway
    if (this.medicGhostActive && this.medicGhostVisual) {
      const height = 720;
      if (this.medicGhostSide === 'LEFT') {
        this.medicGhostVisual.setPosition(120, height / 2 - 30);
      } else {
        this.medicGhostVisual.setPosition(1280 - 120, height / 2 - 30);
      }
      this.medicGhostVisual.setVisible(true);
    }
  }
  
  /**
   * Spawn a Medic ghost in a random doorway
   */
  private spawnMedicGhost(): void {
    this.medicGhostActive = true;
    this.medicGhostSide = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
    this.medicGhostTimer = 0;
    this.medicGhostDuration = 2500 + Math.random() * 2000;  // 2.5-4.5 seconds
    this.medicGhostVisual.setAlpha(0.35);
    
    // Play creepy scream when ghost appears!
    this.audio.playMedicGhostScream();
    
    console.log(`👻 Medic ghost appeared in ${this.medicGhostSide} doorway!`);
  }
  
}

