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
import { VentUI } from '../ui/VentUI';
import { buildCameraUI } from '../ui/CameraUI';
import { drawRoomProps, RoomBounds } from '../ui/roomProps';

// Back-wall bounds for the per-room prop layers in each view
const CAMERA_FEED_BOUNDS: RoomBounds = { x: 240, y: 190, w: 360, h: 250, floorDepth: 115 };
const TELEPORT_ROOM_BOUNDS: RoomBounds = { x: 180, y: 150, w: 920, h: 250, floorDepth: 320 };
import { RecordingUI } from '../ui/RecordingUI';
import { HUD, AlertLevel } from '../ui/HUD';
import { MerasmusSystem } from '../systems/MerasmusSystem';
import { TeleportSystem } from '../systems/TeleportSystem';
import { LureSystem } from '../systems/LureSystem';
import { SentrySystem } from '../systems/SentrySystem';
import { EndingsSystem } from '../systems/EndingsSystem';
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
import { PALETTE, FONTS } from '../ui/kit/theme';
import { addStatic, ensureNoiseTexture } from '../ui/kit/effects';

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
  private teleport: TeleportSystem = new TeleportSystem(this);
  public sentrySystem: SentrySystem = new SentrySystem(this);
  public endings: EndingsSystem = new EndingsSystem(this);
  public lure: LureSystem = new LureSystem(this);

  public audio: GameAudio = new GameAudio({
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
  
  public gameStatus: GameStatus = 'PLAYING';
  
  // Time (in game minutes, 0-360 for 00:00 to 06:00)
  public gameMinutes: number = 0;
  private timeAccumulator: number = 0;
  
  // Metal
  public metal: number = GAME_CONSTANTS.START_METAL;
  
  // Sentry
  public sentry: SentryState = {
    exists: true,
    level: 1,
    hp: SENTRY_MAX_HP[1],
    maxHp: SENTRY_MAX_HP[1],
    isWrangled: false,
    aimedDoor: 'NONE',  // Start aiming at middle (no door lit)
  };
  
  // Camera mode
  public isCameraMode: boolean = false;
  private selectedCamera: number = 0;
  private wasWrangledBeforeCamera: boolean = false;  // Remember wrangler state
  
  // Camera boot-up delay (1s delay when raising cameras)
  private isCameraBooting: boolean = false;
  private cameraBootTimer: number = 0;
  private readonly CAMERA_BOOT_DELAY: number = 1000; // 1 second boot-up time
  private cameraBootOverlay!: Phaser.GameObjects.Container;
  
  // Wrangler firing cooldown (prevents spam-clicking)
  public wranglerCooldown: number = 0;
  public readonly WRANGLER_COOLDOWN: number = 1000; // 1 second cooldown between shots
  
  // Demoman eye glow sound
  
  // Pause state
  public isPaused: boolean = false;
  private pauseMenu!: PauseMenu;
  
  // Input state for hold-to-aim (using native DOM events for reliability)
  public keyADown: boolean = false;
  public keyDDown: boolean = false;
  private _keyA!: Phaser.Input.Keyboard.Key;
  private _keyD!: Phaser.Input.Keyboard.Key;
  // Stored so cleanup() can remove them - Phaser reuses the scene instance,
  // so unremoved window listeners would stack on every restart
  private domKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private domKeyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private domBlurHandler: (() => void) | null = null;
  
  // Enemies
  public scout!: ScoutEnemy;
  public soldier!: SoldierEnemy;
  public demoman!: DemomanEnemy;
  public heavy!: HeavyEnemy;
  public sniper!: SniperEnemy;
  public spy!: SpyEnemy;
  public pyro!: PyroEnemy;
  public medic!: MedicEnemy;
  public administrator!: AdministratorEnemy;
  private pauling!: PaulingEnemy;

  // Pauling vent system (Custom Night)
  private ventSealLeft: boolean = false;
  private ventSealRight: boolean = false;
  private thermostat: number = 0;
  private isVentCameraMode: boolean = false;
  private ventUI!: VentUI;

  // Camera map panel content (nodes/paths/grid hidden when viewing vents; frame stays)
  private cameraMapContent!: Phaser.GameObjects.Container;

  // Vent camera UI elements
  private mapTitleText!: Phaser.GameObjects.Text;

  // Vent-side controls (in right panel when vent view is active)

  // Thermostat HUD
  private thermostatBeepTimer: number = 0;

  // Hacked teleporter rooms (Administrator - Custom Night)
  public hackedRooms: Map<NodeId, HackedRoomState> = new Map();

  // Administrator dual-mode tracking fields
  public lastTeleportedRoom: NodeId | null = null;   // last room player arrived at via teleport
  public administratorNoTeleportTimer: number = 0;         // counts up; triggers Mode 2 at ADMINISTRATOR_NO_TELEPORT_THRESHOLD
  
  // Night number (determines which enemies are active)
  public nightNumber: number = 1;
  
  // Session tracking for save system
  public sessionDestructions: number = 0;  // Sentry destructions this night
  public isBadEndingNight6: boolean = false;  // True if playing bad ending Night 6
  public isCustomNightMode: boolean = false;  // True if playing custom night (extras)
  public isNightmareMode: boolean = false;  // True if playing Nightmare Mode (night 8, starts at 10 AM difficulty)
  
  // Endless Night 6 (bad ending) tracking
  public endlessDay: number = 7;  // Current day in endless mode (Day 7 when 6 AM first reached)
  private hoursAfter6AM: number = 0;  // Hours elapsed after first 6 AM (for difficulty scaling)
  public hasReached6AM: boolean = false;  // True once first 6 AM is reached
  public endlessSurvivalMinutes: number = 0;  // Total minutes survived in endless mode
  
  // Medic ghost apparition (endless mode)
  private medicGhostActive: boolean = false;
  private medicGhostSide: 'LEFT' | 'RIGHT' | null = null;
  private medicGhostTimer: number = 0;
  private medicGhostDuration: number = 3000;  // How long ghost appears (3 sec)
  public medicGhostCooldown: number = 0;  // Cooldown between ghost appearances
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
  public merasmus: MerasmusSystem = new MerasmusSystem(this, this.audio, {
    isMerasmusEnabled: () => this.isMerasmusEnabled(),
    getGameStatus: () => this.gameStatus,
    isPausedNow: () => this.isPaused,
    isTeleportedNow: () => this.isTeleported,
    isCameraModeNow: () => this.isCameraMode,
    clearAimKeys: () => {
      this.keyADown = false;
      this.keyDDown = false;
    },
    gameOver: (reason) => this.endings.gameOver(reason),
    onFlipStateChanged: () => this.mobileControls?.updateMerasmusFlipButton(),
  });
  /** Stock Phaser pointer mapper; restored on shutdown so DOM mirror + X invert stay in sync */
  // Night 5+ features - Spy sapper
  public sapperIndicator!: Phaser.GameObjects.Container;
  private sapperRemoveClicks: number = 0;
  private sapperRemoveTimeout: number = 0;
  
  // Night 3+ features
  // Camera destruction states
  private cameraStates: Map<number, CameraState> = new Map();
  
  // Teleporter state
  public isTeleported: boolean = false;
  public currentRoom: NodeId = 'INTEL';
  public activeLure: LureData | null = null;
  public teleportEscapeTimer: number = 0;
  public enemyApproachingRoom: boolean = false;
  public approachingEnemyType: string = 'an enemy'; // Track which enemy triggered the approach
  
  // Teleport animation state (for cancellation)
  public isTeleportAnimating: boolean = false;
  public teleportAnimationOverlay: Phaser.GameObjects.Container | null = null;
  public teleportAnimationCallback: Phaser.Time.TimerEvent | null = null;
  public pendingTeleportDestination: NodeId | null = null;
  
  // Sniper charge visual
  private sniperChargeOverlay!: Phaser.GameObjects.Rectangle;
  private _sniperChargeTimer: number = 0; // Reserved for future use
  
  // ============================================
  // GRAPHICS OBJECTS
  // ============================================
  
  // Main room
  private _roomBackground!: Phaser.GameObjects.Rectangle;
  public leftDoor!: Phaser.GameObjects.Rectangle;
  public rightDoor!: Phaser.GameObjects.Rectangle;
  private _leftDoorFrame!: Phaser.GameObjects.Rectangle;
  private _rightDoorFrame!: Phaser.GameObjects.Rectangle;
  
  // Enemy visuals in doorways (shown when light/wrangler aimed at door)
  public scoutInDoorway!: Phaser.GameObjects.Container;
  public soldierInDoorway!: Phaser.GameObjects.Container;
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
  public sentryGraphic!: Phaser.GameObjects.Container;
  public sentryBody!: Phaser.GameObjects.Rectangle;
  public sentryLevelText!: Phaser.GameObjects.Text;
  private sentryHead!: Phaser.GameObjects.Container;
  private sentryHeadAngle = 0;
  private sentryGun!: Phaser.GameObjects.Rectangle;
  public aimBeam!: Phaser.GameObjects.Graphics;
  
  // Dispenser visual
  private dispenserGraphic!: Phaser.GameObjects.Rectangle;
  
  // HUD elements
  public hud!: HUD;
  
  // Lure duration bar (top right when lure is active)
  
  // Camera UI container (FNAF-style with map + camera feed)
  public cameraUI!: Phaser.GameObjects.Container;
  private cameraMapNodes: Map<string, Phaser.GameObjects.Container> = new Map();
  // Map of NodeId -> red X text overlay on the camera map (shown when teleporter is hacked)
  private hackedRoomMapIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
  // Map of NodeId -> transient "!" on the camera map (flashes for 3s when a hack starts)
  private hackStartMapIndicators: Map<string, Phaser.GameObjects.Text> = new Map();
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
  private administratorHackLabel!: Phaser.GameObjects.Text;
  private administratorHackHint!: Phaser.GameObjects.Text;
  // Repair overlay for hacked teleporter rooms
  private administratorRepairOverlay!: Phaser.GameObjects.Container;
  private administratorRepairBarFill!: Phaser.GameObjects.Rectangle;
  private administratorRepairActive: boolean = false;
  
  // Teleporter UI (Night 3+)
  private teleportButton!: Phaser.GameObjects.Container;
  public teleportButtonBg!: Phaser.GameObjects.Rectangle;
  public teleportButtonText!: Phaser.GameObjects.Text;
  // Administrator repair bar embedded in teleport button
  public teleportRepairBarBg!: Phaser.GameObjects.Rectangle;
  public teleportRepairBarFill!: Phaser.GameObjects.Rectangle;
  public cameraLureButton!: Phaser.GameObjects.Container;  // Play lure from camera view
  public roomViewUI!: Phaser.GameObjects.Container;
  public roomViewHeader!: Phaser.GameObjects.Text;  // Room name header
  public roomViewProps!: Phaser.GameObjects.Graphics;  // Per-room props in teleported view
  private cameraFeedRoomProps!: Phaser.GameObjects.Graphics;  // Per-room props in camera feed
  public lureButton!: Phaser.GameObjects.Container;
  private returnButton!: Phaser.GameObjects.Container;
  public escapeWarning!: Phaser.GameObjects.Container;
  private roomDoorway!: Phaser.GameObjects.Container;
  public roomDoorwayEyes!: Phaser.GameObjects.Container;
  
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
  public endScreen!: Phaser.GameObjects.Container;
  
  // ============================================
  // ENGINEER RECORDINGS (Phone calls)
  // ============================================
  
  public recordings: RecordingUI = new RecordingUI(this, {
    getGameStatus: () => this.gameStatus,
    getNightNumber: () => this.nightNumber,
    isBadEndingNight6Now: () => this.isBadEndingNight6,
    playCassetteStopSound: () => this.audio.playCassetteStopSound(),
  });
  
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
  public isScoutEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.scout : true;
  }
  
  public isSoldierEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.soldier : true;
  }
  
  public isDemomanEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.demoman : (this.nightNumber >= 2);
  }
  
  public isHeavyEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.heavy : (this.nightNumber >= 3);
  }
  
  public isSniperEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.sniper : (this.nightNumber >= 4);
  }
  
  public isSpyEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.spy : (this.nightNumber >= 4);
  }
  
  public isPyroEnabled(): boolean {
    return this.customEnemies ? this.customEnemies.pyro : (this.nightNumber >= 5);
  }
  
  public isMedicEnabled(): boolean {
    // Medic is CUSTOM NIGHT ONLY - never appears in regular nights
    return this.customEnemies ? this.customEnemies.medic : false;
  }

  public isAdministratorEnabled(): boolean {
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

  /** Returns true if the currently selected camera's room has a hacked teleporter */
  public isSelectedCameraHacked(): boolean {
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
    
    // Reset Engineer recording state (respects main menu Audio logs toggle)
    this.recordings?.reset();
    
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

    this.merasmus.reset();
  }
  
  /**
   * Cleanup when scene shuts down
   */
  private cleanup(): void {
    this.merasmus.uninstallPointerMirrorFix();
    this.merasmus.reset();
    this.recordings.stop();
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
   * OSD label for where the Engineer currently is: "INTEL ROOM" at the desk,
   * or the camera feed name (e.g. "CAM 05 — SPIRAL") when teleported out.
   */
  public getLocationLabel(): string {
    if (!this.isTeleported || this.currentRoom === 'INTEL') {
      return 'INTEL ROOM';
    }
    const cam = CAMERAS.find((c) => c.node === this.currentRoom);
    if (cam) {
      return `CAM ${cam.id.toString().padStart(2, '0')} — ${cam.name}`;
    }
    return this.currentRoom.replace(/_/g, ' ');
  }

  /**
   * Return to title: stop gameplay HTMLAudio (intel room loop) and Web Audio before switching scenes,
   * so ambience cannot keep playing over BootScene.
   */
  public goToMainMenu(): void {
    this.isPaused = false;
    this.pauseMenu?.setVisible(false);
    this.physics?.resume();
    this.recordings.stop();
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
        this.endings.showGoodEnding();
      } else if (data.previewEnding === 'badIntro') {
        this.endings.showBadEndingIntro();
      } else if (data.previewEnding === 'dark') {
        // Set up minimal state for dark ending
        this.isBadEndingNight6 = true;
        this.endlessDay = 2;  // Show some survival time
        this.endlessSurvivalMinutes = 359;  // 5 hours 59 minutes - so close to freedom
        this.endScreen.removeAll(true);
        this.endScreen.setVisible(true);
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
        this.endScreen.add(overlay);
        this.endings.showEndlessDarkEnding('Preview mode');
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
    this.hud = new HUD(this, {
      getGameMinutes: () => this.gameMinutes,
      getMetal: () => this.metal,
      getSentry: () => this.sentry,
      isCameraModeNow: () => this.isCameraMode,
      isBadEndingNight6Now: () => this.isBadEndingNight6,
      hasReached6AMNow: () => this.hasReached6AM,
      getEndlessDay: () => this.endlessDay,
      isMerasmusEnabled: () => this.isMerasmusEnabled(),
    });
    this.hud.create();
    this.buildCameraSystemUI();
    this.ventUI = new VentUI(this, {
      isPaulingEnabled: () => this.isPaulingEnabled(),
      isCameraModeNow: () => this.isCameraMode,
      isTeleportedNow: () => this.isTeleported,
      isVentCameraModeNow: () => this.isVentCameraMode,
      getPauling: () => this.pauling,
      isVentSealedLeft: () => this.ventSealLeft,
      isVentSealedRight: () => this.ventSealRight,
      getThermostat: () => this.thermostat,
      toggleVentSeal: (side) => this.toggleVentSeal(side),
      toggleVentCameraMode: () => this.toggleVentCameraMode(),
    });
    this.ventUI.create(this.cameraUI);
    this.createEndScreen();
    this.recordings.create();
    this.pauseMenu = new PauseMenu(this, {
      getLocationLabel: () => this.getLocationLabel(),
      isMerasmusEnabled: () => this.isMerasmusEnabled(),
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
        this.endings.showGiveUpJumpscare();
      },
    });
    this.pauseMenu.create(this.isBadEndingNight6);
    
    // Set up input
    this.setupInput();
    if (this.isMerasmusEnabled()) {
      this.merasmus.installPointerMirrorFix();
      this.merasmus.createOverlays();
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
        isMerasmusViewFlipped: () => this.merasmus.isViewFlipped(),
        setAimLeftActive: (active) => this.setMobileAimLeftActive(active),
        setAimRightActive: (active) => this.setMobileAimRightActive(active),
        fireWrangler: () => this.sentrySystem.fireWrangler(),
        togglePause: () => this.togglePause(),
        toggleCameraMode: () => this.toggleCameraMode(),
        toggleMerasmusFlip: () => this.merasmus.toggleFlip(),
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
    
    // FNAF-style night title card over the opening moments
    this.showNightTitleCard();
  }
  
  /**
   * "12:00 AM — NIGHT X" title card shown at night start.
   * Purely visual: input and the clock keep running underneath.
   */
  private showNightTitleCard(): void {
    const width = 1280;
    const height = 720;
    
    ensureNoiseTexture(this);
    
    const card = this.add.container(0, 0);
    card.setDepth(500);
    
    const blackout = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1);
    card.add(blackout);
    
    const grain = addStatic(this, width / 2, height / 2, width, height, 0.05);
    card.add(grain);
    
    const clockText = this.add.text(width / 2, height / 2 - 40, '12:00 AM', {
      fontFamily: FONTS.terminal,
      fontSize: '64px',
      color: PALETTE.creamCss,
    }).setOrigin(0.5);
    card.add(clockText);
    
    let nightLabel: string;
    let nightColor: string = PALETTE.amberCss;
    if (this.isNightmareMode) {
      nightLabel = 'NIGHTMARE';
      nightColor = PALETTE.alertCss;
    } else if (this.isCustomNightMode) {
      nightLabel = 'CUSTOM NIGHT';
    } else if (this.isBadEndingNight6) {
      nightLabel = 'NIGHT 6';
      nightColor = PALETTE.alertCss;
    } else {
      nightLabel = `NIGHT ${this.nightNumber}`;
    }
    
    const nightText = this.add.text(width / 2, height / 2 + 28, nightLabel, {
      fontFamily: FONTS.display,
      fontSize: '36px',
      color: nightColor,
    }).setOrigin(0.5);
    card.add(nightText);
    
    // Subtle flicker on the clock while the card holds
    const flicker = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => clockText.setAlpha(Math.random() < 0.15 ? 0.6 : 1),
    });
    
    // Hold, then fade into the night
    this.tweens.add({
      targets: card,
      alpha: 0,
      duration: 700,
      delay: 2200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        flicker.remove();
        card.destroy();
      },
    });
  }
  
  // ============================================
  // VISUAL CREATION
  // ============================================
  
  private createRoom(): void {
    const width = 1280;
    const height = 720;
    const floorY = 440; // Top of the floor plane — doorways sit on it
    
    // Dark room background — warm near-black (terminal palette)
    this._roomBackground = this.add.rectangle(width / 2, height / 2, width, height, 0x171008);
    
    // Floor plane (big foreground expanse, like the intel room's open court)
    this.add.rectangle(width / 2, (floorY + height) / 2, width, height - floorY, 0x231a10);
    
    // ---- Static room dressing (single graphics object, flat 8-bit shapes) ----
    const room = this.add.graphics();
    
    // Ceiling beam — heavy dark rafter running across the very top (source shots)
    room.fillStyle(0x0c0805, 1);
    room.fillRect(0, 0, width, 18);
    room.lineStyle(2, 0x000000, 0.6);
    room.lineBetween(0, 18, width, 18);
    
    // Wainscot band along the back wall (RED intel's orange-red lower wall)
    room.fillStyle(0x5e2a16, 1);
    room.fillRect(190, floorY - 70, 900, 70);
    room.lineStyle(3, 0x9a8a68, 0.35); // beige trim rail on top of the wainscot
    room.lineBetween(190, floorY - 70, 1090, floorY - 70);
    
    // Corner seams — side walls converge ahead (doorways live on the side walls)
    room.lineStyle(2, 0x2a1c0e, 1);
    room.lineBetween(190, floorY, 100, 18);   // left wall/back wall seam
    room.lineBetween(1090, floorY, 1180, 18); // right wall/back wall seam
    // Floor edges continuing the same seams toward the viewer
    room.lineBetween(190, floorY, 0, height);
    room.lineBetween(1090, floorY, width, height);
    // Back wall / floor junction
    room.lineStyle(2, 0x0e0a05, 1);
    room.lineBetween(190, floorY, 1090, floorY);
    
    // Observation windows — underground, so they glow with the red-lit map
    // rooms behind them (like the RED world-map windows in the source shots)
    const paneY = 36;
    const paneW = 82;
    const paneH = 56;
    [380, 472, 726, 818].forEach((paneX, i) => {
      // Warm red glow base
      room.fillStyle(0x3a1410, 1);
      room.fillRect(paneX, paneY, paneW, paneH);
      // Map continents — brighter red blobs, staggered per pane
      room.fillStyle(0x63201a, 1);
      const off = (i % 2) * 18;
      room.fillRect(paneX + 10 + off, paneY + 12, 24, 14);
      room.fillRect(paneX + 44 - off, paneY + 32, 20, 12);
      room.fillRect(paneX + 30, paneY + 6, 12, 8);
      // Frame + mullion
      room.lineStyle(2, 0x2a2018, 1);
      room.strokeRect(paneX, paneY, paneW, paneH);
      room.lineBetween(paneX + paneW / 2, paneY, paneX + paneW / 2, paneY + paneH);
    });
    
    // Painted court lines on the floor (faint, like the capture-zone markings)
    room.lineStyle(2, 0x8a7a5a, 0.10);
    room.strokeRect(320, 475, 640, 160);
    
    // Circular RED floor decal under the sentry — ring, disc, lettering ring
    room.fillStyle(0x3f1712, 0.40);
    room.fillEllipse(640, 585, 300, 110);
    room.lineStyle(4, 0x7a2418, 0.45);
    room.strokeEllipse(640, 585, 300, 110);
    room.lineStyle(2, 0x9a8a68, 0.14); // faint cream lettering ring
    room.strokeEllipse(640, 585, 230, 82);
    
    // Cream script "RED" in the decal center, squashed flat onto the floor
    this.add.text(640, 585, 'RED', {
      fontFamily: FONTS.display,
      fontSize: '44px',
      color: '#9a8a68',
    }).setOrigin(0.5).setAlpha(0.28).setScale(1, 0.5);
    
    // ---- Hanging lamps (dome shades like the source; light pools pulse slowly) ----
    const lampXs = [300, 980];
    lampXs.forEach((lampX) => {
      room.lineStyle(3, 0x0d0a06, 1);
      room.lineBetween(lampX, 18, lampX, 96);
      // Dome shade (flat bottom at y=124)
      room.fillStyle(0x15100a, 1);
      room.slice(lampX, 124, 32, Math.PI, Math.PI * 2, false);
      room.fillPath();
      // Warm bulb glint under the shade
      room.fillStyle(0xffdf9a, 0.85);
      room.fillRect(lampX - 6, 122, 12, 4);
      
      // Dim pool of light on the floor below (separate object so it can pulse)
      const pool = this.add.ellipse(lampX, 480, 200, 34, 0x40300f, 0.4);
      this.tweens.add({
        targets: pool,
        alpha: 0.25,
        duration: 2800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    
    // ---- Foreground desk, centered at the bottom — the Engineer sits behind
    // it in the corner, looking out at the doorways ----
    const deskTop = 640;
    const deskL = 340;
    const deskR = 940;
    const desk = this.add.graphics();
    // Tabletop (night-dim wood tan)
    desk.fillStyle(0x54402a, 1);
    desk.fillRect(deskL, deskTop, deskR - deskL, 60);
    desk.lineStyle(2, 0x76593a, 1); // top highlight edge
    desk.lineBetween(deskL, deskTop, deskR, deskTop);
    // Front face
    desk.fillStyle(0x32261a, 1);
    desk.fillRect(deskL, deskTop + 60, deskR - deskL, height - (deskTop + 60));
    
    // Black rotary phone, right side of the desk (as in the source shots)
    desk.fillStyle(0x0d0d0d, 1);
    desk.fillRect(788, deskTop + 10, 44, 18);             // base
    desk.fillRect(782, deskTop, 56, 8);                   // handset bar
    desk.fillCircle(782, deskTop + 4, 7);                 // handset ends
    desk.fillCircle(838, deskTop + 4, 7);
    desk.fillStyle(0x2a2a2a, 1);
    desk.fillCircle(810, deskTop + 19, 7);                // dial
    
    // Clipboard, left of center — dark board, beige paper, metal clip
    desk.fillStyle(0x3e2c18, 1);
    desk.fillRect(430, deskTop + 8, 50, 34);
    desk.fillStyle(0x9a8a68, 0.9);
    desk.fillRect(434, deskTop + 12, 42, 26);
    desk.fillStyle(0x777777, 1);
    desk.fillRect(447, deskTop + 5, 16, 6);
    // Faint scribble lines on the paper
    desk.lineStyle(1, 0x54402a, 0.8);
    desk.lineBetween(438, deskTop + 18, 470, deskTop + 18);
    desk.lineBetween(438, deskTop + 24, 464, deskTop + 24);
    desk.lineBetween(438, deskTop + 30, 472, deskTop + 30);
    
    // Stack of logbooks near center — dark red ledger on brown journal
    desk.fillStyle(0x46341e, 1);
    desk.fillRect(580, deskTop + 22, 68, 14);
    desk.fillStyle(0x5e1c14, 1);
    desk.fillRect(586, deskTop + 10, 58, 12);
    desk.lineStyle(1, 0x9a8a68, 0.5); // page edges
    desk.lineBetween(586, deskTop + 20, 644, deskTop + 20);
    
    // Left doorway
    this._leftDoorFrame = this.add.rectangle(120, height / 2 - 50, 140, 280, 0x0c0804);
    this.leftDoor = this.add.rectangle(120, height / 2 - 50, 120, 260, 0x000000);
    this.add.text(120, height / 2 - 180, 'LEFT DOOR', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberFaintCss,
    }).setOrigin(0.5);
    
    // Right doorway
    this._rightDoorFrame = this.add.rectangle(width - 120, height / 2 - 50, 140, 280, 0x0c0804);
    this.rightDoor = this.add.rectangle(width - 120, height / 2 - 50, 120, 260, 0x000000);
    this.add.text(width - 120, height / 2 - 180, 'RIGHT DOOR', {
      fontFamily: FONTS.terminal,
      fontSize: '16px',
      color: PALETTE.amberFaintCss,
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
      fontFamily: FONTS.terminal,
      fontSize: '34px',
      color: PALETTE.alertCss,
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
    
    // Tripod legs + mounting column (drawn first, behind the head)
    const sentryLegs = this.add.graphics();
    sentryLegs.lineStyle(5, 0x2a2a26, 1);
    sentryLegs.lineBetween(0, 18, -30, 52);   // front-left leg
    sentryLegs.lineBetween(0, 18, 30, 52);    // front-right leg
    sentryLegs.lineBetween(0, 18, 0, 56);     // rear leg
    sentryLegs.fillStyle(0x1c1c1a, 1);        // feet
    sentryLegs.fillRect(-34, 50, 10, 5);
    sentryLegs.fillRect(24, 50, 10, 5);
    sentryLegs.fillRect(-5, 54, 10, 5);
    sentryLegs.fillStyle(0x3a3a36, 1);        // column between legs and head
    sentryLegs.fillRect(-8, 8, 16, 14);
    
    // Head assembly — swivels toward the aimed door (pivot at body center)
    this.sentryHead = this.add.container(0, -8);
    
    // The red sensor/ammo box (flash + mobile tap target)
    this.sentryBody = this.add.rectangle(0, 0, 60, 44, 0xa63c30);
    this.sentryBody.setStrokeStyle(3, 0x2e0f0a);
    
    // Gun barrel on top
    this.sentryGun = this.add.rectangle(0, -34, 14, 28, 0x4a4a4a);
    this.sentryGun.setStrokeStyle(2, 0x1c1c1c);
    
    // Head detailing (drawn over the body)
    const sentryDetail = this.add.graphics();
    // Top highlight band on the head box
    sentryDetail.fillStyle(0xc9574a, 0.5);
    sentryDetail.fillRect(-27, -19, 54, 8);
    // Corner rivets
    sentryDetail.fillStyle(0x2e0f0a, 1);
    sentryDetail.fillCircle(-24, -16, 2);
    sentryDetail.fillCircle(24, -16, 2);
    sentryDetail.fillCircle(-24, 16, 2);
    sentryDetail.fillCircle(24, 16, 2);
    // Barrel core highlight + muzzle band
    sentryDetail.fillStyle(0x6a6a6a, 1);
    sentryDetail.fillRect(-2, -46, 4, 22);
    sentryDetail.fillStyle(0x1c1c1c, 1);
    sentryDetail.fillRect(-9, -52, 18, 6);
    // Sensor lens with red eye and faint glow ring
    sentryDetail.fillStyle(0x1c1210, 1);
    sentryDetail.fillRect(-12, -7, 24, 14);
    sentryDetail.fillStyle(0xff3b30, 0.95);
    sentryDetail.fillCircle(0, 0, 3.5);
    sentryDetail.lineStyle(2, 0xff3b30, 0.25);
    sentryDetail.strokeCircle(0, 0, 6);
    // Side antenna
    sentryDetail.lineStyle(2, 0x1c1c1c, 1);
    sentryDetail.lineBetween(26, -18, 34, -38);
    
    this.sentryHead.add([this.sentryBody, this.sentryGun, sentryDetail]);
    
    // Level indicator on the column
    const levelBadge = this.add.rectangle(0, 30, 30, 18, 0xff6600);
    levelBadge.setStrokeStyle(2, 0x2e0f0a);
    this.sentryLevelText = this.add.text(0, 30, 'L1', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.sentryGraphic.add([sentryLegs, this.sentryHead, levelBadge, this.sentryLevelText]);
    
    // Make sentry body interactive for mobile tap-to-fire
    this.sentryBody.setInteractive({ useHandCursor: true });
    this.sentryBody.on('pointerdown', () => {
      // Only fire on mobile when wrangled and aimed at a door
      if (!this.isMobile) return;
      if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isCameraMode) return;
      if (!this.sentry.exists || !this.sentry.isWrangled) return;
      if (this.sentry.aimedDoor === 'NONE') return;
      this.sentrySystem.fireWrangler();
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
      fontFamily: FONTS.terminal,
      fontSize: '46px',
      color: PALETTE.alertCss,
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
          this.showAlert('SAPPER REMOVED!', 'success');
          this.sapperRemoveClicks = 0;
          this.audio.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 'warning');
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
    
    // Dispenser cabinet ("Provisions" vending machine from the source art).
    // The cabinet rectangle stays the glow-tween target.
    this.dispenserGraphic = this.add.rectangle(dispX, dispY, 54, 80, 0xa63c30);
    this.dispenserGraphic.setStrokeStyle(2, 0x2e0f0a);
    
    const disp = this.add.graphics();
    
    // Control box on top with a small green cross indicator
    disp.fillStyle(0x3a3230, 1);
    disp.fillRect(dispX - 16, dispY - 54, 32, 14);
    disp.lineStyle(2, 0x1c1c1a, 1);
    disp.strokeRect(dispX - 16, dispY - 54, 32, 14);
    disp.fillStyle(0x3f8f3f, 1);
    disp.fillRect(dispX - 2, dispY - 51, 8, 3);   // cross: horizontal bar
    disp.fillRect(dispX + 1, dispY - 54, 2, 9);   // cross: vertical bar (chunky 8-bit)
    
    // Cream "Provisions" marquee band with a red script squiggle
    disp.fillStyle(0x9a8a68, 1);
    disp.fillRect(dispX - 23, dispY - 36, 46, 11);
    disp.lineStyle(2, 0x7a2418, 0.9);
    disp.lineBetween(dispX - 16, dispY - 30, dispX + 16, dispY - 30);
    
    // Radar screen — dark glass, pink dial arc and needle
    disp.fillStyle(0x1c0f0c, 1);
    disp.fillRect(dispX - 17, dispY - 20, 34, 24);
    disp.lineStyle(2, 0x7a2c22, 1);
    disp.strokeRect(dispX - 17, dispY - 20, 34, 24);
    disp.lineStyle(2, 0xd97a6a, 0.8);
    disp.beginPath();
    disp.arc(dispX, dispY + 2, 12, Math.PI, Math.PI * 2);
    disp.strokePath();
    disp.lineBetween(dispX, dispY + 2, dispX + 8, dispY - 7); // needle
    
    // Three control knobs under the screen
    disp.fillStyle(0x2a2a2a, 1);
    [-11, 0, 11].forEach((dx) => disp.fillCircle(dispX + dx, dispY + 11, 3));
    
    // Vent grille at the bottom
    disp.fillStyle(0x3a3632, 1);
    disp.fillRect(dispX - 16, dispY + 20, 32, 14);
    disp.lineStyle(1, 0x1c1c1a, 1);
    disp.lineBetween(dispX - 13, dispY + 24, dispX + 13, dispY + 24);
    disp.lineBetween(dispX - 13, dispY + 28, dispX + 13, dispY + 28);
    
    // Orange oxygen-style tank strapped to the left side
    disp.fillStyle(0xb85c20, 1);
    disp.fillRect(dispX - 37, dispY - 4, 10, 26);
    disp.fillCircle(dispX - 32, dispY - 4, 5);
    disp.lineStyle(2, 0x2e0f0a, 1);
    disp.lineBetween(dispX - 37, dispY + 6, dispX - 27, dispY + 6); // strap
    
    // Pressure gauge on the top-right corner
    disp.fillStyle(0x9a8a68, 1);
    disp.fillCircle(dispX + 22, dispY - 45, 7);
    disp.lineStyle(2, 0x2e0f0a, 1);
    disp.strokeCircle(dispX + 22, dispY - 45, 7);
    disp.lineBetween(dispX + 22, dispY - 45, dispX + 26, dispY - 50); // needle
    
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
      fontFamily: FONTS.terminal,
      fontSize: '12px',
      color: PALETTE.amberFaintCss,
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
  
  /**
   * Build the camera system UI (construction lives in src/ui/CameraUI.ts) and
   * adopt the created objects as scene fields. Interaction logic stays here.
   */
  private buildCameraSystemUI(): void {
    const el = buildCameraUI(this, {
      isCameraModeNow: () => this.isCameraMode,
      getGameMinutes: () => this.gameMinutes,
      selectCamera: (index) => this.selectCamera(index),
      onRepairCameraClicked: () => this.repairCamera(this.selectedCamera, true),
      onAdminHackBarClicked: () => {
        if (this.isAdministratorEnabled() && this.administrator && this.administrator.getState() === 'HACKING') {
          this.administrator.interruptHack();
          this.showAlert('Hack interrupted!', 'success');
        }
      },
      onTeleportButtonOver: () => {
        if (this.isTeleportAnimating) {
          this.teleportButtonBg.setFillStyle(0x3a2c14);
        } else if (this.isSelectedCameraHacked()) {
          this.teleportButtonBg.setFillStyle(0x241a0e);
        } else {
          this.teleportButtonBg.setFillStyle(0x2e100a);
        }
      },
      onTeleportButtonOut: () => {
        this.administratorRepairActive = false;
        if (this.isTeleportAnimating) {
          this.teleportButtonBg.setFillStyle(0x2a1f10);
        } else if (this.isSelectedCameraHacked()) {
          this.teleportButtonBg.setFillStyle(0x140e06);
        } else {
          this.teleportButtonBg.setFillStyle(0x1c0a06);
        }
      },
      onTeleportButtonDown: () => {
        // Ignore clicks that race with death/pause — otherwise a post-mortem
        // teleport starts (enemy freezes + ambience restarts on a dead game)
        if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
        // If teleport animation is in progress, cancel it
        if (this.isTeleportAnimating) {
          this.teleport.cancelTeleport();
          return;
        }
        // If room is hacked, start hold-to-repair
        if (this.isSelectedCameraHacked()) {
          this.administratorRepairActive = true;
          this.audio._administratorRepairSoundTimer = 0; // fire first tick immediately
          return;
        }
        const cam = CAMERAS[this.selectedCamera];
        this.teleport.teleportToRoom(cam.node);
      },
      onTeleportButtonUp: () => {
        this.administratorRepairActive = false;
      },
      onLureButtonOver: () => {
        const bg = this.cameraLureButton.list[0] as Phaser.GameObjects.Rectangle;
        bg.setFillStyle(0x2a1f10);
      },
      onLureButtonOut: () => this.lure.updateCameraLureButtonStyle(),
      onLureButtonDown: () => this.lure.handleCameraLureAction(),
      onReturnToIntel: () => {
        if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
        this.teleport.returnToIntel();
      },
      onToggleLure: () => this.lure.toggleLure(),
    });

    this.cameraUI = el.cameraUI;
    this.cameraFeedPanel = el.cameraFeedPanel;
    this.cameraFeedTitle = el.cameraFeedTitle;
    this.cameraFeedEmpty = el.cameraFeedEmpty;
    this.cameraFeedEnemy = el.cameraFeedEnemy;
    this.cameraFeedEnemy2 = el.cameraFeedEnemy2;
    this.cameraFeedEnemy3 = el.cameraFeedEnemy3;
    this.cameraFeedEnemyEyeGlow = el.cameraFeedEnemyEyeGlow;
    this.cameraFeedDemoHead = el.cameraFeedDemoHead;
    this.cameraLureIndicator = el.cameraLureIndicator;
    this.cameraStaticGraphics = el.cameraStaticGraphics;
    this.cameraStaticBurstOverlay = el.cameraStaticBurstOverlay;
    this.mapTitleText = el.mapTitleText;
    this.cameraMapContent = el.cameraMapContent;
    this.cameraMapNodes = el.cameraMapNodes;
    this.hackedRoomMapIndicators = el.hackedRoomMapIndicators;
    this.hackStartMapIndicators = el.hackStartMapIndicators;
    this.intelRoomIcon = el.intelRoomIcon;
    this.scoutMapIcon = el.scoutMapIcon;
    this.soldierMapIcon = el.soldierMapIcon;
    this.cameraDestroyedOverlay = el.cameraDestroyedOverlay;
    this.cameraDestroyedText = el.cameraDestroyedText;
    this.cameraRepairButton = el.cameraRepairButton;
    this.cameraWatchWarning = el.cameraWatchWarning;
    this.cameraWatchBar = el.cameraWatchBar;
    this.cameraBootOverlay = el.cameraBootOverlay;
    this.administratorHackBarContainer = el.administratorHackBarContainer;
    this.administratorHackBarBorder = el.administratorHackBarBorder;
    this.administratorHackBarFill = el.administratorHackBarFill;
    this.administratorHackLabel = el.administratorHackLabel;
    this.administratorHackHint = el.administratorHackHint;
    this.administratorRepairOverlay = el.administratorRepairOverlay;
    this.administratorRepairBarFill = el.administratorRepairBarFill;
    this.teleportButton = el.teleportButton;
    this.teleportButtonBg = el.teleportButtonBg;
    this.teleportButtonText = el.teleportButtonText;
    this.teleportRepairBarBg = el.teleportRepairBarBg;
    this.teleportRepairBarFill = el.teleportRepairBarFill;
    this.cameraLureButton = el.cameraLureButton;
    this.roomViewUI = el.roomViewUI;
    this.roomViewHeader = el.roomViewHeader;
    this.roomViewProps = el.roomViewProps;
    this.cameraFeedRoomProps = el.cameraFeedRoomProps;
    this.lureButton = el.lureButton;
    this.returnButton = el.returnButton;
    this.escapeWarning = el.escapeWarning;
    this.roomDoorway = el.roomDoorway;
    this.roomDoorwayEyes = el.roomDoorwayEyes;
    this.pyroEscapeWarning = el.pyroEscapeWarning;
    this.pyroEscapeTimer = el.pyroEscapeTimer;

    // Initialize with first camera selected (draw its props too, since
    // selectCamera() early-returns when re-selecting the same index)
    this.selectedCamera = 0;
    drawRoomProps(this.cameraFeedRoomProps, CAMERAS[0].node, CAMERA_FEED_BOUNDS, 'feed');
  }
  
  /** Redraw the teleported room view's per-room props (called on teleport). */
  public drawTeleportedRoomProps(node: NodeId): void {
    drawRoomProps(this.roomViewProps, node, TELEPORT_ROOM_BOUNDS, 'warm');
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
   * Administrator Mode 1 — instant auto-hack triggered when player returns to Intel.
   * Hacks the last room the player teleported to (if not already hacked).
   * Every return trip triggers this — no cooldown cap.
   */
  public handleAdministratorMode1(): void {
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

    this.showAlert(`⚠ ADMINISTRATOR: ${target.replace('_', ' ')} TELEPORTER HACKED`, 'danger');
    this.updateHackedRoomMapIndicators();
    this.teleport.updateTeleportButtonAppearance();
    this.audio.playAdministratorHackSound();
    console.log(`📋 Administrator (Mode 1) instantly hacked ${target}.`);
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
        this.showAlert('Not enough metal! (50 required)', 'warning');
        return;
      }
      this.metal -= GAME_CONSTANTS.CAMERA_REMOTE_REPAIR_COST;
      this.updateHUD();
    }
    
    camState.destroyed = false;
    camState.destroyedBy = null;
    camState.destroyedUntil = 0;
    
    this.showAlert(`Camera ${cam.name} repaired!`, 'success');
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
        // Selected camera - feed green (matches the live monitor)
        glow.setFillStyle(0x44ff44, 0.3);
        bg.setStrokeStyle(2, 0x66ff66);
        bg.setFillStyle(0x14301a);
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
        glow.setFillStyle(0xffb454, 0);
        bg.setStrokeStyle(2, 0x8a6230);
        bg.setFillStyle(0x140e06);
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
   * Flash a "!" next to the map node of the room the Administrator just began
   * hacking. Visible for ~3 seconds, then fades — quick players spot the hack
   * without searching; slower ones must remember which camera it was.
   */
  private flashHackStartIndicator(node: NodeId): void {
    const indicator = this.hackStartMapIndicators.get(node);
    if (!indicator) return;

    this.tweens.killTweensOf(indicator);
    indicator.setVisible(true);
    indicator.setAlpha(1);

    // Urgent blink for the first moments, then fade out (3s total)
    this.tweens.add({
      targets: indicator,
      alpha: { from: 1, to: 0.25 },
      duration: 250,
      yoyo: true,
      repeat: 3,  // ~2s of blinking
      onComplete: () => {
        this.tweens.add({
          targets: indicator,
          alpha: 0,
          duration: 1000,
          onComplete: () => indicator.setVisible(false),
        });
      },
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
    this.teleport.updateTeleportButtonAppearance();
    
    // Don't do anything else if clicking the camera we're already on
    if (this.selectedCamera === index) {
      return;
    }
    
    this.selectedCamera = index;
    const cam = CAMERAS[index];
    this.cameraFeedTitle.setText(`CAM 0${cam.id} - ${cam.name}`);
    
    // Redraw this room's identifying props in the feed
    drawRoomProps(this.cameraFeedRoomProps, cam.node, CAMERA_FEED_BOUNDS, 'feed');
    
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
    this.lure.updateCameraLureButton();
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

  private toggleVentCameraMode(): void {
    if (!this.isPaulingEnabled()) return;

    this.isVentCameraMode = !this.isVentCameraMode;
    this.audio.playVentTabClickSound();

    if (this.isVentCameraMode) {
      this.ventUI.setVentViewVisible(true);
      this.cameraMapContent.setVisible(false);
      this.teleportButton?.setVisible(false);
      this.cameraLureButton?.setVisible(false);
      this.mapTitleText?.setText('◈ VENT MAP ◈');
      this.mapTitleText?.setColor(PALETTE.creamCss);
    } else {
      this.ventUI.setVentViewVisible(false);
      this.cameraMapContent.setVisible(true);
      if (this.nightNumber >= 3) {
        this.teleportButton?.setVisible(true);
        this.cameraLureButton?.setVisible(true);
      }
      this.mapTitleText?.setText('◈ FACILITY OVERVIEW ◈');
      this.mapTitleText?.setColor(PALETTE.amberDimCss);
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
      // Occasional metallic expansion tinks while running hot (self-throttled)
      this.audio.maybePlayHeatCreak(pct);
    } else {
      this.thermostatBeepTimer = 0;
    }

    // Thermostat maxed out — Pyro appears
    if (this.thermostat >= GAME_CONSTANTS.THERMOSTAT_MAX) {
      this.endings.gameOver('The vents overheated! Pyro appeared!');
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
      this.endings.gameOver('Pauling dropped in from the vents!');
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
      this.merasmus.toggleFlip();
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
          this.showAlert('SAPPER REMOVED!', 'success');
          this.sapperRemoveClicks = 0;
          this.audio.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 'warning');
          this.audio.playSound('fire');
        }
        return; // Don't process normal fire when removing sapper
      }
      
      // Normal fire - requires wrangler
      if (!this.sentry.isWrangled) return;
      if (this.sentry.aimedDoor === 'NONE') return; // Can't fire at middle
      
      this.sentrySystem.fireWrangler();
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
        this.sentrySystem.buildSentry();
      } else if (this.sentry.hp === this.sentry.maxHp) {
        // Full HP - upgrade
        this.sentrySystem.upgradeSentry();
      } else {
        // Damaged - repair
        this.sentrySystem.repairSentry();
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
    const mirrored = this.isMerasmusEnabled() && this.merasmus.isViewFlipped();
    if (mirrored) {
      this.keyDDown = active;
    } else {
      this.keyADown = active;
    }
  }

  private setMobileAimRightActive(active: boolean): void {
    const mirrored = this.isMerasmusEnabled() && this.merasmus.isViewFlipped();
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
        this.showAlert('SAPPER REMOVED!', 'success');
        this.sapperRemoveClicks = 0;
        this.audio.playSound('fire');
      } else {
        this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 'warning');
        this.audio.playSound('fire');
      }
      return;
    }
    
    // Then handle sentry actions
    if (!this.sentry.exists) {
      this.sentrySystem.buildSentry();
    } else if (this.sentry.hp < this.sentry.maxHp) {
      this.sentrySystem.repairSentry();
    } else if (this.sentry.level < 3) {
      this.sentrySystem.upgradeSentry();
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
      // Pause the game — tape goes on hold
      this.audio.playVcrPauseSound();
      this.audio.stopDetectionSound();
      this.audio.stopDispenserHum();
      this.audio.stopIntelRoomAmbience();
      this.audio.stopSniperLaserHum();
      this.audio.stopPyroCracklingAmbient();
      this.audio.stopMerasmusHum();
      this.audio.stopMedicGhostScream();  // Stop ghost scream during pause
      this.audio.stopApproachGrowl();     // Teleport-room "enemy heard you" growl
      this.audio.stopSapperSound();       // Spy sapper loop
      this.audio.stopPyroHallwayHiss(true);
      this.audio.stopDemoEyeGlowSound();
      this.physics?.pause();
      
      // Pause Engineer recording if playing
      this.recordings.pauseAudio();
      
      // Show a random hint
      this.pauseMenu.showRandomHint();
    } else {
      // Resume — tape rolls again
      this.audio.playVcrResumeSound();
      this.physics?.resume();
      // Resume dispenser hum if in Intel room (plays even with cameras up)
      if (!this.isTeleported) {
        this.audio.startDispenserHum();
        this.audio.startIntelRoomAmbience();
      }
      // Resume Engineer recording if it was playing
      this.recordings.resumeAudio();
      // Resume Pyro crackling if match is still lit (must restart fully, not just schedule)
      if (this.isPyroEnabled() && this.pyro && this.pyro.isMatchLit()) {
        this.audio.startPyroCracklingAmbient();
      }
      // Resume Medic ghost scream if ghost is still active
      if (this.medicGhostActive) {
        this.audio.playMedicGhostScream();
      }
      // Resume approach growl if an enemy is still closing in on the teleport room
      // (its per-frame update only adjusts volume; it doesn't restart the loop)
      if (this.isTeleported && this.enemyApproachingRoom) {
        this.audio.startApproachGrowl();
        this.audio.updateApproachGrowl(this.teleportEscapeTimer);
      }
      // Resume sapper loop if the Spy is still sapping
      if (this.isSpyEnabled() && this.spy && this.spy.isSapping()) {
        this.audio.playSapperSound();
      }
      // Sniper laser hum, Pyro hallway hiss, and Demo eye-glow sound are
      // start/stopped every frame by update() and restart on their own.
    }

    // Camera ambience / dead-feed hiss / hack tick follow the pause state
    // (update() early-returns while paused, so sync them here too)
    this.updateCameraAudioState();
  }

  /**
   * Keep the camera-view audio loops (room ambience, dead-feed hiss, and the
   * Administrator hack tick) in sync with what the player is looking at.
   * Called every frame and from pause/camera toggles; all starts no-op when
   * already running, so this is cheap.
   */
  private updateCameraAudioState(): void {
    const camsUp =
      this.gameStatus === 'PLAYING' &&
      this.isCameraMode &&
      !this.isCameraBooting &&
      !this.isPaused &&
      !this.isVentCameraMode;

    const cam = CAMERAS[this.selectedCamera];
    const camState = this.cameraStates.get(cam.id);
    const destroyed = !!camState?.destroyed;

    // Room ambience: only on a live feed
    if (camsUp && !destroyed) {
      this.audio.startCameraRoomAmbience(cam.node);
    } else {
      this.audio.stopCameraRoomAmbience();
    }

    // Dead-feed hiss: only while looking at a destroyed camera
    if (camsUp && destroyed) {
      this.audio.startCameraDeadFeedHiss();
    } else {
      this.audio.stopCameraDeadFeedHiss();
    }

    // Hack tick: ONLY while watching the exact camera the Administrator is
    // actively hacking — off-screen hacks stay silent (insidious by design)
    const ticking =
      camsUp &&
      this.isAdministratorEnabled() &&
      this.administrator &&
      this.administrator.isActive() &&
      this.administrator.getState() === 'HACKING' &&
      this.administrator.getCurrentTarget() === cam.node;
    if (ticking) {
      this.audio.startHackTickLoop();
      this.audio.setHackTickProgress(this.administrator.getHackProgress());
    } else {
      this.audio.stopHackTickLoop();
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
    const mirrorAim = this.isMerasmusEnabled() && this.merasmus.isViewFlipped();
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
      
      // Play aim sound when changing aim direction (sweep matches head swivel)
      this.audio.playWranglerAimSound(this.sentry.aimedDoor);
      
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

  public isHeavyAtHallway(hall: 'LEFT' | 'RIGHT'): boolean {
    if (!this.isHeavyEnabled() || !this.hasHeavyStarted()) return false;
    if (!this.heavy.isActive()) return false;
    const node = hall === 'LEFT' ? 'LEFT_HALL' : 'RIGHT_HALL';
    return this.heavy.currentNode === node;
  }

  public hideHeavyDoorwayShadow(): void {
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
  
  public updateWranglerVisuals(): void {
    // Swivel the sentry head toward the aimed door
    const headAngle = !this.sentry.exists || !this.sentry.isWrangled
      ? 0
      : this.sentry.aimedDoor === 'LEFT' ? -55
      : this.sentry.aimedDoor === 'RIGHT' ? 55
      : 0;
    if (headAngle !== this.sentryHeadAngle) {
      this.sentryHeadAngle = headAngle;
      this.tweens.killTweensOf(this.sentryHead);
      this.tweens.add({
        targets: this.sentryHead,
        angle: headAngle,
        duration: 140,
        ease: 'Sine.easeOut',
      });
    }
    
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
  
  // ============================================
  // SENTRY MANAGEMENT
  // ============================================
  
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
        this.ventUI?.setVentViewVisible(false);
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
        this.ventUI?.setVentViewVisible(true);
        this.cameraMapContent?.setVisible(false);
        this.teleportButton?.setVisible(false);
        this.cameraLureButton?.setVisible(false);
        this.mapTitleText?.setText('◈ VENT MAP ◈');
        this.mapTitleText?.setColor(PALETTE.creamCss);
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
        // Phase-dependent strip text: during TARGETING the hack hasn't started
        // yet and can't be interrupted; once HACKING begins, clicking works.
        if (administratorState === 'TARGETING') {
          // Greyed out while she's locking on — nothing is clickable yet
          this.administratorHackLabel?.setText('⚠ TELEPORTER HACK INCOMING');
          this.administratorHackLabel?.setColor('#9a9a9a');
          this.administratorHackHint?.setText('CANNOT INTERRUPT YET');
          this.administratorHackHint?.setColor('#666666');
        } else {
          // Hack is live — colors return to signal the strip is actionable
          this.administratorHackLabel?.setText('⚠ TELEPORTER HACK');
          this.administratorHackLabel?.setColor(PALETTE.alertCss);
          this.administratorHackHint?.setText('CLICK TO INTERRUPT');
          this.administratorHackHint?.setColor(PALETTE.creamCss);
        }
        // Colour: dim amber when targeting/empty, gradient → alert red as bar fills
        if (hackProgress <= 0) {
          this.administratorHackBarFill.setFillStyle(0x3a2c18, 0.85);
          this.administratorHackBarBorder?.setStrokeStyle(1, 0x3d2c14);
        } else {
          // Lerp dim amber (0x8a,0x62,0x30) → alert red (0xff,0x3b,0x30) by progress
          const r = Math.round(0x8a + (0xff - 0x8a) * hackProgress);
          const g = Math.round(0x62 + (0x3b - 0x62) * hackProgress);
          const b = 0x30;
          const col = (r << 16) | (g << 8) | b;
          this.administratorHackBarFill.setFillStyle(col, 0.9);
          this.administratorHackBarBorder?.setStrokeStyle(1, col);
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
    this.lure.updateCameraLureButton();
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
    
    this.sentrySystem.damageSentry(GAME_CONSTANTS.ROCKET_DAMAGE);
    this.showAlert(`ROCKET HIT! -${GAME_CONSTANTS.ROCKET_DAMAGE} HP`, 'danger');
  }
  
  /**
   * Fire a bullet projectile from sentry to target
   */
  public fireBulletProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
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
  
  public showAlert(message: string, level: AlertLevel = 'warning'): void {
    this.audio.playAlertSound(level);
    this.hud.showAlert(message, level);
  }

  public updateHUD(): void {
    this.hud.update();

    // Update lure button state (grey out if not enough metal) - Night 3+
    if (this.nightNumber >= 3 && this.isTeleported) {
      this.lure.updateLureButtonText();
    }

    // Update mobile UI if on mobile
    if (this.isMobile) {
      this.mobileControls?.updateUI();
    }
  }

  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(_time: number, delta: number): void {
    if (this.gameStatus !== 'PLAYING') return;
    if (this.isPaused) return;
    
    // Keep camera-view audio loops in sync with what's on screen
    this.updateCameraAudioState();
    
    // ---- ENGINEER RECORDING TIMER ----
    this.recordings.update(delta);
    
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
            this.showAlert('6:00 AM... but the night continues', 'warning');
          }
          
          // Track hours after 6 AM for difficulty scaling (every 60 game minutes = 1 hour)
          const minutesAfter6AM = this.gameMinutes - 360;
          this.hoursAfter6AM = Math.floor(minutesAfter6AM / 60);
          
          // Roll over to next day at midnight (720 minutes = 12 hours after midnight = next day)
          // Since we start at 12 AM (0), 6 AM is 360, next 12 AM is 720
          if (this.gameMinutes >= 720) {
            this.gameMinutes = 0;  // Reset to 12:00 AM
            this.endlessDay++;
            this.showAlert(`DAY ${this.endlessDay}`, 'danger');
            console.log(`🌙 Endless Night 6 - Day ${this.endlessDay} begins!`);
          }
        } else {
          // Normal night or Nightmare Mode - victory!
          this.endings.victory();
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
    this.merasmus.update(delta);
    
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
        this.lure.updateCameraLureButton();
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
            this.sentrySystem.handleUberedEnemyEscaped('SCOUT');
          } else {
            // Player is in Intel - Übered Scout kills!
            this.endings.gameOver('Übered Scout broke in! You should have teleported!');
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Scout waits in Intel - player dies when they return
            console.log('Scout reached Intel but player was teleported!');
            // Scout will be at Intel - player dies when they return (handled in returnToIntel)
          } else {
            this.endings.gameOver('Scout broke in with no sentry!');
            return;
          }
        } else {
          // Sentry exists
          // If sentry is WRANGLED, player must manually fire to repel - otherwise GAME OVER
          if (this.sentry.isWrangled) {
            // Player was wrangling but didn't fire in time - Scout kills!
            if (!this.isTeleported) {
              this.endings.gameOver('Scout attacked while sentry was wrangled!');
              return;
            }
          } else {
            // Sentry is UNWRANGLED - trigger auto-defense (sentry destroyed, scout repelled)
            this.sentrySystem.triggerAutoDefense('SCOUT');
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
            this.sentrySystem.handleUberedEnemyEscaped('SOLDIER');
          } else {
            // Player is in Intel - Übered Soldier kills!
            this.endings.gameOver('Übered Soldier breached! You should have teleported!');
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Soldier waits in Intel - player dies when they return
            console.log('Soldier reached Intel but player was teleported!');
          } else {
            this.endings.gameOver('Soldier breached with no sentry!');
            return;
          }
        } else {
          // Breach countdown expired but a sentry is up — the player rebuilt
          // in time. The Soldier doesn't give up: he sieges the new sentry,
          // and destroying it earns him another breach attempt.
          console.log('Soldier breach blocked by rebuilt sentry - resuming siege!');
          this.showAlert('SENTRY REBUILT! SOLDIER RESUMES SIEGE!', 'warning');
          this.soldier.startSiege();
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
            this.sentrySystem.handleUberedEnemyEscaped('DEMOMAN');
          } else {
            // Player is in Intel - Übered Demoman kills!
            this.endings.gameOver(`Übered Demoman charged from ${doorName}! You should have teleported!`);
            return;
          }
        } else if (!this.sentry.exists) {
          // No sentry - check if player is teleported away
          if (this.isTeleported) {
            // Demoman waits in Intel - player dies when they return
            console.log('Demoman reached Intel but player was teleported!');
          } else {
            this.endings.gameOver(`Demoman charged from ${doorName}!`);
            return;
          }
        } else if (this.sentry.isWrangled) {
          // Player had wrangler on but didn't stop him
          if (!this.isTeleported) {
            this.endings.gameOver(`Demoman charged from ${doorName}!`);
            return;
          }
        } else {
          // Sentry is UNWRANGLED - auto-defense (sentry destroyed, demoman deterred)
          this.sentrySystem.triggerAutoDefense('DEMOMAN');
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
        this.sentrySystem.handleUberedEnemyEscaped('SCOUT');
      }
      
      // Soldier waiting/sieging at door while Übered
      if (this.isSoldierEnabled() && this.medic.isEnemyUbered('SOLDIER') && 
          this.soldier.currentNode === 'RIGHT_HALL' && 
          (this.soldier.state === 'WAITING' || this.soldier.state === 'SIEGING')) {
        console.log('💉 Übered Soldier leaving - player teleported away');
        this.sentrySystem.handleUberedEnemyEscaped('SOLDIER');
      }
      
      // Demoman charging or waiting while Übered
      // Note: Demoman uses CHARGING state, not WAITING, when rushing to the door
      if (this.isDemomanEnabled() && this.medic.isEnemyUbered('DEMOMAN') && 
          (this.demoman.state === 'CHARGING' || this.demoman.state === 'WAITING')) {
        console.log('💉 Übered Demoman leaving - player teleported away');
        this.sentrySystem.handleUberedEnemyEscaped('DEMOMAN');
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
            // Flash "!" on the map node the moment she picks a target, in sync
            // with the sound cue — quick players can spot the room right away
            const targetNode = this.administrator.getCurrentTarget();
            if (targetNode) this.flashHackStartIndicator(targetNode);
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
          this.showAlert(`⚠ ADMINISTRATOR: ${administratorResult.targetNode.replace('_', ' ')} TELEPORTER HACKED`, 'danger');
          this.updateHackedRoomMapIndicators();
          this.audio.playAdministratorHackSound();
          if (this.isCameraMode) this.teleport.updateTeleportButtonAppearance();
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
            this.showAlert('Teleporter restored!', 'success');
            this.audio.playAdministratorRepairCompleteSound();
            this.updateHackedRoomMapIndicators();
            this.teleport.updateTeleportButtonAppearance();
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
      if (this.isCameraMode) this.teleport.updateTeleportButtonAppearance();
    }

    // Update Pauling vent system and thermostat (Custom Night only)
    this.updatePaulingAndThermostat(delta);
    this.ventUI.update();

    // Update teleport danger check (always runs, regardless of which enemies are enabled)
    this.teleport.updateTeleportDanger(delta);
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
      this.hud.lureBarFill.setSize(fillWidth, 20);
      this.hud.lureBarText.setText(`LURE ${Math.ceil(this.activeLure.playTimeRemaining / 1000)}s`);
      this.hud.lureBarContainer.setVisible(true);
      
      if (this.activeLure.playTimeRemaining <= 0) {
        // Lure is consumed (auto-removed after playing)
        console.log('Lure consumed - enemies will return to patrolling');
        this.showAlert('LURE CONSUMED!', 'info');
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
        this.hud.lureBarContainer.setVisible(false);
        this.lure.updateLureButtonText();
        this.lure.updateCameraLureButton();
      }
    } else {
      // Hide lure bar if no active lure playing
      this.hud.lureBarContainer.setVisible(false);
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
          this.endings.gameOver('Heavy smashed through!');
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
        this.endings.gameOver('Sniped through the camera!');
        return;
      }
      
      if (sniperResult.headshotReady) {
        // Sniper has charged a headshot - only kills if player is in Intel room!
        if (!this.isTeleported) {
          const door = this.sniper.getAimingDoor();
          this.endings.gameOver(`Sniped from ${door} hall!`);
          return;
        } else {
          // Player dodged by teleporting! Sniper destroys sentry and teleports away
          console.log('Sniper headshot missed player but destroyed sentry!');
          this.sentrySystem.destroySentry('SNIPER DESTROYED YOUR SENTRY!');
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
        this.showAlert('Pyro fled! +20 metal', 'success');
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
        this.endings.gameOver('Pyro burned you alive!');
      }
      
      // If player teleported away while match was lit, notify Pyro
      if (this.isTeleported && this.pyro.isMatchLit()) {
        this.pyro.onPlayerEscaped();
        this.showAlert('Escaped Pyro!', 'success');
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
    this.showAlert(`${destroyedBy} destroyed ${camera.name} camera!`, 'danger');
    
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
      this.sentryBody.setFillStyle(0xff3b30); // Critical
    } else if (healthPercent < 0.6) {
      this.sentryBody.setFillStyle(0xc9574a); // Damaged (lighter red)
    } else {
      this.sentryBody.setFillStyle(0xa63c30); // Healthy RED
    }
    
    if (this.sentry.hp <= 0) {
      this.sentrySystem.destroySentry('SPY SAPPED YOUR SENTRY!');
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
    this.endings.gameOver('Sniped!');
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

