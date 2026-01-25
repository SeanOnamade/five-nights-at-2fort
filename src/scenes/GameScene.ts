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
  LureData,
  ROOM_ADJACENCY,
} from '../types';
import { isMobileDevice } from '../utils/mobile';
import { ScoutEnemy } from '../entities/ScoutEnemy';
import { SoldierEnemy } from '../entities/SoldierEnemy';
import { DemomanEnemy } from '../entities/DemomanEnemy';
import { HeavyEnemy } from '../entities/HeavyEnemy';
import { SniperEnemy } from '../entities/SniperEnemy';
import { SpyEnemy } from '../entities/SpyEnemy';
import { PyroEnemy } from '../entities/PyroEnemy';
import { MedicEnemy, UberTarget } from '../entities/MedicEnemy';

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
  private demoEyeGlowSoundPlaying: boolean = false;
  private demoEyeGlowOscillator: OscillatorNode | null = null;
  private demoEyeGlowGain: GainNode | null = null;
  
  // Pause state
  private isPaused: boolean = false;
  private pauseMenu!: Phaser.GameObjects.Container;
  private pauseHintText!: Phaser.GameObjects.Text;
  
  // Hints for pause menu
  private readonly pauseHints: string[] = [
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
    "Heavy and Sniper will destroy your camera if you stare too long.",
    "Lures can distract certain enemies, buying you precious time!",
    "Metal regenerates over time -- manage it wisely!",
    "Sniper requires 2 shots to repel.",
    "When Heavy reaches the intel room, you have very little time to react!",
    "Pyro blocks doorways until you shine the Wrangler light on him!",
    "Pyro reflects sentry shots! Use the Wrangler light to drive him away.",
  ];
  
  // Input state for hold-to-aim (using native DOM events for reliability)
  private keyADown: boolean = false;
  private keyDDown: boolean = false;
  private _keyA!: Phaser.Input.Keyboard.Key;
  private _keyD!: Phaser.Input.Keyboard.Key;
  
  // Enemies
  private scout!: ScoutEnemy;
  private soldier!: SoldierEnemy;
  private demoman!: DemomanEnemy;
  private heavy!: HeavyEnemy;
  private sniper!: SniperEnemy;
  private spy!: SpyEnemy;
  private pyro!: PyroEnemy;
  private medic!: MedicEnemy;
  
  // Night number (determines which enemies are active)
  private nightNumber: number = 1;
  
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
  } | null = null;
  
  // Night 5+ features - Spy sapper
  private sapperIndicator!: Phaser.GameObjects.Container;
  private sapperRemoveClicks: number = 0;
  private sapperRemoveTimeout: number = 0;
  private sapperSoundOscillator: OscillatorNode | null = null;
  private sapperSoundGain: GainNode | null = null;
  
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
  private cameraLureIndicator!: Phaser.GameObjects.Container;  // Shows when lure is at this camera
  
  // Camera destroyed overlay (Night 3+)
  private cameraDestroyedOverlay!: Phaser.GameObjects.Container;
  private cameraDestroyedText!: Phaser.GameObjects.Text;
  private cameraRepairButton!: Phaser.GameObjects.Container;
  
  // Camera watch warning (Heavy/Sniper about to break camera)
  private cameraWatchWarning!: Phaser.GameObjects.Container;
  private cameraWatchBar!: Phaser.GameObjects.Rectangle;
  
  // Teleporter UI (Night 3+)
  private teleportButton!: Phaser.GameObjects.Container;
  private teleportButtonBg!: Phaser.GameObjects.Rectangle;
  private teleportButtonText!: Phaser.GameObjects.Text;
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
  private isPlayingDetectionSound: boolean = false;
  private detectionSoundContext: AudioContext | null = null;
  
  // Sound state for sniper laser hum
  private isPlayingSniperHum: boolean = false;
  private sniperHumOscillator: OscillatorNode | null = null;
  private sniperHumGain: GainNode | null = null;
  private detectionOscillator: OscillatorNode | null = null;
  
  // Shared audio context for consistent sound levels
  private sharedAudioContext: AudioContext | null = null;
  
  // Dispenser ambient hum (plays in Intel room)
  private isPlayingDispenserHum: boolean = false;
  private dispenserHumOscillator: OscillatorNode | null = null;
  private dispenserHumOscillator2: OscillatorNode | null = null;
  private dispenserHumGain: GainNode | null = null;
  
  // End screen
  private endScreen!: Phaser.GameObjects.Container;
  
  // ============================================
  // MOBILE CONTROLS
  // ============================================
  
  private isMobile: boolean = false;
  private mobileUI!: Phaser.GameObjects.Container;
  private mobileCameraButton!: Phaser.GameObjects.Container;
  private mobileWranglerButton!: Phaser.GameObjects.Container;
  private mobileActionButton!: Phaser.GameObjects.Container;
  private mobileActionText!: Phaser.GameObjects.Text;
  private mobileActionCostText!: Phaser.GameObjects.Text;
  private mobileFireButton!: Phaser.GameObjects.Container;
  private mobilePauseButton!: Phaser.GameObjects.Container;
  private mobileLeftZone!: Phaser.GameObjects.Rectangle;
  private mobileRightZone!: Phaser.GameObjects.Rectangle;
  private mobileLeftHint!: Phaser.GameObjects.Graphics;
  private mobileRightHint!: Phaser.GameObjects.Graphics;
  
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
  
  /**
   * Reset all game state for a clean start/restart
   */
  private resetGameState(): void {
    this.gameStatus = 'PLAYING';
    this.gameMinutes = 0;
    this.timeAccumulator = 0;
    this.metal = GAME_CONSTANTS.START_METAL;
    this.isCameraMode = false;
    this.selectedCamera = 0;
    this.wasWrangledBeforeCamera = false;
    this.isPaused = false;
    this.isPlayingDetectionSound = false;
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
    
    // Stop any playing sounds
    this.stopDetectionSound();
    this.stopDemoEyeGlowSound();
    this.stopSniperLaserHum();
    this.stopSapperSound();
    this.stopDispenserHum();
    
    // Reset sapper state for Night 5
    this.sapperRemoveClicks = 0;
    this.sapperRemoveTimeout = 0;
  }
  
  /**
   * Cleanup when scene shuts down
   */
  private cleanup(): void {
    this.stopDetectionSound();
    this.events.off('scoutAtDoor');
    this.events.off('soldierAtDoor');
    this.events.off('soldierRocket');
  }
  
  create(): void {
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
      };
    } | undefined;
    this.nightNumber = data?.night ?? 1;
    
    // For custom night (6), use the enemy toggles; otherwise use night-based rules
    const isCustomNight = this.nightNumber === 6;
    const customEnemies = {
      scout: true, soldier: true, demoman: true, 
      heavy: true, sniper: true, spy: true, pyro: false, medic: false,
      ...data?.customEnemies,  // Override with passed values (backward compatible)
    };
    
    console.log(`🌙 Starting Night ${this.nightNumber}${isCustomNight ? ' (Custom)' : ''}`);
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
      this.spy = new SpyEnemy();
      // Set up Spy sapper callback
      this.spy.setSapDamageCallback((damage) => this.onSpySapDamage(damage));
    }
    
    // Set up Heavy callbacks for Night 3+ or custom night
    const heavyEnabled = isCustomNight ? customEnemies.heavy : (this.nightNumber >= 3);
    if (heavyEnabled) {
      this.heavy.setDestroyCameraCallback((node) => this.onCameraDestroyed(node, 'HEAVY'));
      this.heavy.setFootstepCallback((volume) => this.playHeavyFootsteps(volume));
    }
    
    // Set up Sniper callbacks for Night 4+ or custom night
    const sniperEnabled = isCustomNight ? customEnemies.sniper : (this.nightNumber >= 4);
    if (sniperEnabled) {
      this.sniper.setDestroyCameraCallback((node) => this.onCameraDestroyed(node, 'SNIPER'));
      this.sniper.setChargeCallback((progress) => this.onSniperChargeProgress(progress));
      this.sniper.setTeleportCallback(() => this.playSniperTeleportSound());
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
              // Invalid if Demoman is charging or at door
              return this.demoman.state === 'DORMANT'; // Only valid when dormant (head watching)
            default:
              return true;
          }
        });
        
        // Set up callback to play Über charge sound when new target is selected
        this.medic.setTargetChangedCallback((target) => {
          if (target) {
            this.playUberChargeSound();
          }
        });
        this.medic.activate(medicTargets);
      } else {
        console.log('💉 Medic enabled but no valid targets (Scout/Soldier/Demoman)!');
        this.medic.forceDespawn();
      }
    } else {
      this.medic.forceDespawn();
    }
    
    // Spy callbacks are now set up when Spy is created above
    
    // Initialize camera states for Night 3+
    this.cameraStates.clear();
    CAMERAS.forEach((cam) => {
      this.cameraStates.set(cam.id, { destroyed: false, destroyedUntil: 0, destroyedBy: null });
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
    this.createEndScreen();
    this.createPauseMenu(); // Uses this.isMobile for layout
    
    // Set up input
    this.setupInput();
    
    // Create mobile touch controls if on mobile
    if (this.isMobile) {
      this.createMobileControls();
    }
    
    // Initial HUD update
    this.updateHUD();
    
    // Start ambient dispenser hum in Intel room
    this.startDispenserHum();
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
    this.drawEnemySilhouette(scoutGraphics, 'SCOUT');
    this.scoutInDoorway.add(scoutGraphics);
    this.scoutInDoorway.setVisible(false);
    this.scoutInDoorway.setDepth(10);
    
    // Soldier visual (right doorway) - uses detailed silhouette
    this.soldierInDoorway = this.add.container(1280 - 120, height / 2 - 30);
    const soldierGraphics = this.add.graphics();
    this.drawEnemySilhouette(soldierGraphics, 'SOLDIER');
    this.soldierInDoorway.add(soldierGraphics);
    this.soldierInDoorway.setVisible(false);
    this.soldierInDoorway.setDepth(10);
    
    // Demoman visual (can appear at either doorway) - headless body with Eyelander
    this.demomanInDoorway = this.add.container(120, height / 2 - 30);
    const demoGraphics = this.add.graphics();
    this.drawEnemySilhouette(demoGraphics, 'DEMOMAN_BODY');
    this.demomanInDoorway.add(demoGraphics);
    this.demomanInDoorway.setVisible(false);
    this.demomanInDoorway.setDepth(10);
    
    // Demoman approach glow (shown in first half of waiting period)
    this.demomanApproachGlow = this.add.graphics();
    this.demomanApproachGlow.setVisible(false);
    this.demomanApproachGlow.setDepth(9);
    
    // Über glow effects for Medic (Custom Night)
    // These create a pulsing blue aura around Übered enemies
    this.uberGlowLeft = this.add.graphics();
    this.uberGlowLeft.setVisible(false);
    this.uberGlowLeft.setDepth(9);
    
    this.uberGlowRight = this.add.graphics();
    this.uberGlowRight.setVisible(false);
    this.uberGlowRight.setDepth(9);
    
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
   * Bright blue visor-shaped glow at eye level in the doorway with large light radius
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
    glowLeft.fillStyle(0x0055aa, 0.08);
    glowLeft.fillCircle(0, 0, 220);
    glowLeft.fillStyle(0x0066cc, 0.12);
    glowLeft.fillCircle(0, 0, 160);
    glowLeft.fillStyle(0x0077dd, 0.18);
    glowLeft.fillCircle(0, 0, 100);
    glowLeft.fillStyle(0x0088ee, 0.25);
    glowLeft.fillCircle(0, 0, 60);
    // Medium glow - starting to get visor shaped
    glowLeft.fillStyle(0x00aaff, 0.35);
    glowLeft.fillEllipse(0, 0, 90, 40);
    // Inner bright glow - visor shape
    glowLeft.fillStyle(0x44ddff, 0.5);
    glowLeft.fillEllipse(0, 0, 65, 20);
    // Bright core - the visor itself
    glowLeft.fillStyle(0x66eeff, 0.9);
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
    glowRight.fillStyle(0x0055aa, 0.08);
    glowRight.fillCircle(0, 0, 220);
    glowRight.fillStyle(0x0066cc, 0.12);
    glowRight.fillCircle(0, 0, 160);
    glowRight.fillStyle(0x0077dd, 0.18);
    glowRight.fillCircle(0, 0, 100);
    glowRight.fillStyle(0x0088ee, 0.25);
    glowRight.fillCircle(0, 0, 60);
    glowRight.fillStyle(0x00aaff, 0.35);
    glowRight.fillEllipse(0, 0, 90, 40);
    glowRight.fillStyle(0x44ddff, 0.5);
    glowRight.fillEllipse(0, 0, 65, 20);
    glowRight.fillStyle(0x66eeff, 0.9);
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
    
    // Sentry base/body - BLU team
    this.sentryBody = this.add.rectangle(0, 0, 60, 80, 0x4488bb);
    this.sentryBody.setStrokeStyle(3, 0x336699);
    
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
        if (!this.isSpyEnabled() || !this.spy || !this.spy.isSapping()) return;
        
        this.sapperRemoveClicks++;
        this.sapperRemoveTimeout = 2000;
        
        if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
          this.spy.removeSapper();
          this.sapperIndicator.setVisible(false);
          this.stopSapperSound();
          this.showAlert('SAPPER REMOVED!', 0x00ff00);
          this.sapperRemoveClicks = 0;
          this.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
          this.playSound('fire');
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
    this.dispenserGraphic = this.add.rectangle(dispX, dispY, 50, 70, 0x4488ff);
    this.dispenserGraphic.setStrokeStyle(2, 0x2266cc);
    
    // Dispenser top cap
    this.add.rectangle(dispX, dispY - 40, 40, 10, 0x66aaff);
    
    // Dispenser screen
    const screen = this.add.rectangle(dispX, dispY - 15, 30, 20, 0x003366);
    screen.setStrokeStyle(1, 0x00aaff);
    
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
      color: '#aaddff',
    }).setOrigin(0.5);
    
    // Animated glow effect
    this.tweens.add({
      targets: this.dispenserGraphic,
      alpha: 0.7,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    // Screen blink
    this.tweens.add({
      targets: screen,
      fillColor: 0x006699,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }
  
  private createHUD(): void {
    const padding = 20;
    
    // Time display (top center) - BLU team color
    this.timeText = this.add.text(640, padding, '00:00', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#4488ff',
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
    this._controlsText = this.add.text(640, 700, 
      'F: Wrangler | HOLD A/D: Aim Left/Right | SPACE: Fire | TAB: Cameras | R: Build/Repair/Upgrade', {
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
    
    // "No activity" text (shown when no enemy) with pulsing effect
    this.cameraFeedEmpty = this.add.text(420, 350, '- CLEAR -', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#1a4422',
    }).setOrigin(0.5);
    this.cameraUI.add(this.cameraFeedEmpty);
    
    // Pulse the clear text subtly
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
    this.drawEnemySilhouette(enemyGraphics, 'SCOUT');
    
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
    
    const mapTitle = this.add.text(1000, 155, '◈ FACILITY OVERVIEW ◈', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#5588cc',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraUI.add(mapTitle);
    
    // Blueprint grid effect - WIDER
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x0a2035, 0.4);
    for (let x = 830; x <= 1170; x += 15) {
      gridGraphics.lineBetween(x, 170, x, 530);
    }
    for (let y = 170; y <= 530; y += 15) {
      gridGraphics.lineBetween(830, y, 1170, y);
    }
    this.cameraUI.add(gridGraphics);
    
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
    
    this.cameraUI.add(mapGraphics);
    
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
      this.cameraUI.add(nodeContainer);
    });
    
    // Intel Room marker (your position) - directly below Left Hall
    const intelMarkerX = mapOffsetX + 55;   // Same X as Left Hall
    const intelMarkerY = mapOffsetY + 255;  // Below the bottom row, same as Sewer
    
    // Pulsing outer ring
    const intelGlow = this.add.circle(intelMarkerX, intelMarkerY, 26, 0xff6600, 0.15);
    this.cameraUI.add(intelGlow);
    
    // Main intel icon
    this.intelRoomIcon = this.add.circle(intelMarkerX, intelMarkerY, 20, 0x331500);
    this.intelRoomIcon.setStrokeStyle(3, 0xff6600);
    this.cameraUI.add(this.intelRoomIcon);
    
    // Intel briefcase icon
    const intelIcon = this.add.text(intelMarkerX, intelMarkerY - 2, '◆', {
      fontSize: '16px',
      color: '#ff8800',
    }).setOrigin(0.5);
    this.cameraUI.add(intelIcon);
    
    const intelLabel = this.add.text(intelMarkerX, intelMarkerY + 32, 'INTEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      color: '#ff9944',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraUI.add(intelLabel);
    
    // Legend at bottom
    const legendY = 505;
    const legendBg = this.add.rectangle(1000, legendY, 250, 30, 0x0a1520, 0.8);
    legendBg.setStrokeStyle(1, 0x1a3050);
    this.cameraUI.add(legendBg);
    
    const legendText = this.add.text(1000, legendY, 'CLICK NODE TO VIEW CAMERA', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#4488aa',
    }).setOrigin(0.5);
    this.cameraUI.add(legendText);
    
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
    this.cameraUI.add(statusText);
    
    // Map icons are NOT added - player must check cameras to find enemies
    // Store references but keep them invisible (for internal use only)
    this.scoutMapIcon = this.add.container(0, 0);
    this.scoutMapIcon.setVisible(false);
    this.soldierMapIcon = this.add.container(0, 0);
    this.soldierMapIcon.setVisible(false);
    
    // Instructions at bottom
    const camInstructions = this.add.text(640, 680, 'TAB TO EXIT  •  FIND THE THREATS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#446644',
    }).setOrigin(0.5);
    this.cameraUI.add(camInstructions);
    
    // Create camera destroyed overlay (Night 3+)
    this.createCameraDestroyedOverlay();
    
    // Create teleporter UI (Night 3+)
    if (this.nightNumber >= 3) {
      this.createTeleporterUI();
    }
    
    // Initialize with first camera selected
    this.selectedCamera = 0;
  }
  
  /**
   * Create camera destroyed overlay (shown when Heavy/Sniper destroy camera)
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
    
    // Camera watch warning overlay - shows when Heavy/Sniper are about to break camera
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
    this.cameraBootOverlay = this.add.container(420, 350);
    this.cameraBootOverlay.setDepth(110); // Above other camera elements
    
    // Dark boot screen (fully opaque so player can't see camera feed behind it)
    const bootScreenBg = this.add.rectangle(0, 0, 510, 410, 0x000803, 1.0);
    bootScreenBg.setStrokeStyle(2, 0x003311);
    this.cameraBootOverlay.add(bootScreenBg);
    
    // Boot-up text title
    const bootTitle = this.add.text(0, -100, 'CAMERA SYSTEM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#00aa44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add(bootTitle);
    
    // Boot status text (animated)
    const bootStatus = this.add.text(0, -60, 'INITIALIZING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#006622',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add(bootStatus);
    
    // Progress bar background
    const bootBarBg = this.add.rectangle(0, 0, 300, 20, 0x001108);
    bootBarBg.setStrokeStyle(2, 0x003311);
    this.cameraBootOverlay.add(bootBarBg);
    
    // Progress bar fill (will be animated)
    const bootBarFill = this.add.rectangle(-147, 0, 0, 14, 0x00aa44, 0.8);
    bootBarFill.setOrigin(0, 0.5);
    bootBarFill.setName('bootBarFill');
    this.cameraBootOverlay.add(bootBarFill);
    
    // Boot percentage text
    const bootPercent = this.add.text(0, 35, '0%', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#00aa44',
    }).setOrigin(0.5);
    bootPercent.setName('bootPercent');
    this.cameraBootOverlay.add(bootPercent);
    
    // Scanlines for boot screen (matches camera feed aesthetic)
    const bootScanlines = this.add.graphics();
    for (let y = -200; y < 200; y += 4) {
      bootScanlines.lineStyle(1, 0x000000, 0.3);
      bootScanlines.lineBetween(-250, y, 250, y);
    }
    this.cameraBootOverlay.add(bootScanlines);
    
    // Boot log messages (scrolling up effect)
    const bootLog1 = this.add.text(0, 80, '> Connecting to network...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    const bootLog2 = this.add.text(0, 100, '> Loading camera feeds...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    const bootLog3 = this.add.text(0, 120, '> Calibrating night vision...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#004422',
    }).setOrigin(0.5);
    this.cameraBootOverlay.add([bootLog1, bootLog2, bootLog3]);
    
    this.cameraBootOverlay.setVisible(false);
    this.cameraUI.add(this.cameraBootOverlay);
  }
  
  /**
   * Create teleporter UI for Night 3+
   */
  private createTeleporterUI(): void {
    // Teleport button on camera map (shows when viewing a camera)
    this.teleportButton = this.add.container(1000, 570);
    
    this.teleportButtonBg = this.add.rectangle(0, 0, 180, 35, 0x224466);
    this.teleportButtonBg.setStrokeStyle(2, 0x4488cc);
    this.teleportButtonBg.setInteractive({ useHandCursor: true });
    
    this.teleportButtonText = this.add.text(0, 0, 'TELEPORT HERE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#88ccff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.teleportButton.add([this.teleportButtonBg, this.teleportButtonText]);
    this.teleportButton.setVisible(false);
    this.cameraUI.add(this.teleportButton);
    
    this.teleportButtonBg.on('pointerover', () => {
      if (this.isTeleportAnimating) {
        this.teleportButtonBg.setFillStyle(0x664422);
      } else {
        this.teleportButtonBg.setFillStyle(0x336688);
      }
    });
    this.teleportButtonBg.on('pointerout', () => {
      if (this.isTeleportAnimating) {
        this.teleportButtonBg.setFillStyle(0x553311);
      } else {
        this.teleportButtonBg.setFillStyle(0x224466);
      }
    });
    this.teleportButtonBg.on('pointerdown', () => {
      // If teleport animation is in progress, cancel it
      if (this.isTeleportAnimating) {
        this.cancelTeleport();
        return;
      }
      const cam = CAMERAS[this.selectedCamera];
      this.teleportToRoom(cam.node);
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
    this.playLureSound();
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
    
    // Store pending destination (for cancel feature)
    this.pendingTeleportDestination = node;
    
    // Freeze Pyro and Sniper teleportation during player's teleport animation
    // This prevents the unfair situation where they teleport into the destination
    // while the animation is playing
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      this.pyro.freezeTeleport();
    }
    if (this.isSniperEnabled() && this.sniper) {
      this.sniper.freezeTeleport();
    }
    
    // Show teleport animation overlay FIRST, then check for enemies after arrival
    this.showTeleportAnimation(() => {
      // Check if any enemy BODY is in this room (not just heads)
      // NOTE: Pyro stays frozen until AFTER this check completes
      const scoutThere = this.scout.isAtNode(node);
      const soldierThere = this.soldier.isAtNode(node);
      // Demoman: only check if his BODY is there (when charging), not just his head
      const demomanBodyThere = this.isDemomanEnabled() && 
                                this.demoman.isCharging() && 
                                this.demoman.currentNode === node;
      const heavyThere = this.isHeavyEnabled() && this.heavy.isAtNode(node);
      const sniperThere = this.isSniperEnabled() && this.sniper.isAtNode(node);
      // Pyro: in Room mode, teleporting to his room = death (he's invisible but deadly)
      const pyroThere = this.isPyroEnabled() && this.pyro && 
                        !this.pyro.isForceDespawned() && 
                        this.pyro.isAtNode(node);
      
      console.log(`Arrived at ${node}. Enemies: Scout=${scoutThere}, Soldier=${soldierThere}, DemoBody=${demomanBodyThere}, Heavy=${heavyThere}, Sniper=${sniperThere}, Pyro=${pyroThere}`);
      
      // Helper to unfreeze Pyro and Sniper before returning
      const unfreezeAndReturn = () => {
        if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
          this.pyro.unfreezeTeleport();
        }
        if (this.isSniperEnabled() && this.sniper) {
          this.sniper.unfreezeTeleport();
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
      if (demomanBodyThere) {
        unfreezeAndReturn();
        this.gameOver('Demoman charged you!');
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
      
      // Stop dispenser hum when leaving Intel room
      this.stopDispenserHum();
      
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
        this.playEnemyApproachSound();
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
          this.playSapperSound();
          // Flash screen red to make it very noticeable
          this.cameras.main.flash(300, 255, 100, 100, false);
        }
      }
      
      // Unfreeze Pyro and Sniper AFTER all checks complete - prevents race condition
      if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
        this.pyro.unfreezeTeleport();
      }
      if (this.isSniperEnabled() && this.sniper) {
        this.sniper.unfreezeTeleport();
      }
      
      console.log(`Engineer teleported to ${node}`);
    });
  }
  
  /**
   * Return engineer to Intel room
   */
  private returnToIntel(): void {
    // Stop any approach sounds
    this.stopApproachGrowl();
    
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
      this.startDispenserHum();
      
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
    });
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
    this.playTeleportSound();
    
    // Create teleport overlay
    const overlay = this.add.container(640, 360);
    overlay.setDepth(200);
    
    // Store reference for cancellation
    this.teleportAnimationOverlay = overlay;
    
    // Dark flash background
    const flash = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0);
    overlay.add(flash);
    
    // Blue glow circle expanding from center
    const glowCircle = this.add.circle(0, 0, 10, 0x4488ff, 0.8);
    overlay.add(glowCircle);
    
    // Inner bright core
    const core = this.add.circle(0, 0, 5, 0xffffff, 1);
    overlay.add(core);
    
    // "TELEPORTING..." text
    const teleportText = this.add.text(0, 150, 'TELEPORTING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#66ccff',
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
        0x44aaff
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
    
    // Destroy the overlay
    if (this.teleportAnimationOverlay) {
      this.teleportAnimationOverlay.destroy();
      this.teleportAnimationOverlay = null;
    }
    
    // Unfreeze Pyro and Sniper
    if (this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
      this.pyro.unfreezeTeleport();
    }
    if (this.isSniperEnabled() && this.sniper) {
      this.sniper.unfreezeTeleport();
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
    if (!this.teleportButtonBg || !this.teleportButtonText) return;
    
    if (this.isTeleportAnimating) {
      // Cancel mode - orange/warning colors
      this.teleportButtonBg.setFillStyle(0x553311);
      this.teleportButtonBg.setStrokeStyle(2, 0xffaa44);
      this.teleportButtonText.setText('✕ CANCEL');
      this.teleportButtonText.setColor('#ffaa44');
    } else {
      // Normal mode - blue colors
      this.teleportButtonBg.setFillStyle(0x224466);
      this.teleportButtonBg.setStrokeStyle(2, 0x4488cc);
      this.teleportButtonText.setText('TELEPORT HERE');
      this.teleportButtonText.setColor('#88ccff');
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
        this.playLureSound();
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
    this.playLurePlacedSound();
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
   * Play Medic voice lure sound
   */
  private playLureSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Medic voice-like sound (German accent "MEDIC!")
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Warbling voice-like sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(450, audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.6);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play sound when lure is placed - short confirmation beep
   */
  private playLurePlacedSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Short rising confirmation beep
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play sound when lure is consumed - distinctive "power down" sound
   */
  private playLureConsumedSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Descending "power down" tone to indicate lure stopped
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not available
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
        btnText.setText(`📍 LURE @ ${lureRoom}`);
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
   * Select a camera and update the feed view
   * Note: Camera switching is allowed during boot so player can select teleport destination
   */
  private selectCamera(index: number): void {
    this.selectedCamera = index;
    const cam = CAMERAS[index];
    this.cameraFeedTitle.setText(`CAM 0${cam.id} - ${cam.name}`);
    
    // Update map node colors (highlights selected + lure)
    this.updateMapNodeColors(cam.node);
    
    // Camera switch static burst
    this.cameraStaticGraphics.clear();
    this.cameraStaticGraphics.fillStyle(0xffffff, 0.4);
    this.cameraStaticGraphics.fillRect(170, 150, 500, 400);
    
    // Play camera switch sound
    this.playCameraSwitchSound();
    
    // Clear static after brief moment
    this.time.delayedCall(80, () => {
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
        
        // Update destroyed text with who destroyed it
        const destroyer = camState.destroyedBy === 'HEAVY' ? 'HEAVY' : 'SNIPER';
        this.cameraDestroyedText.setText(`-- ${destroyer} DESTROYED CAMERA --`);
      } else {
        this.cameraDestroyedOverlay.setVisible(false);
      }
    }
    
    // Show teleport button if Night 3+
    if (this.nightNumber >= 3 && this.teleportButton) {
      this.teleportButton.setVisible(true);
    }
    
    // Update camera lure button visibility
    this.updateCameraLureButton();
  }
  
  /**
   * Draw blue Über glow effect for Medic's Übercharge
   * Creates a pulsing blue aura around the target position
   */
  private drawUberGlow(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.clear();
    graphics.setPosition(x, y);
    
    // Outer glow ring (faint)
    graphics.fillStyle(0x4488ff, 0.15);
    graphics.fillCircle(0, 0, 120);
    
    // Middle glow ring
    graphics.fillStyle(0x4488ff, 0.25);
    graphics.fillCircle(0, 0, 90);
    
    // Inner glow ring (brightest)
    graphics.fillStyle(0x66aaff, 0.35);
    graphics.fillCircle(0, 0, 60);
    
    // Core glow
    graphics.fillStyle(0x88ccff, 0.2);
    graphics.fillCircle(0, 0, 40);
  }
  
  /**
   * Draw enemy silhouette for camera feed
   * @param isUbered - If true, draws a bright blue Über glow behind the enemy
   */
  private drawEnemySilhouette(graphics: Phaser.GameObjects.Graphics, type: 'SCOUT' | 'SOLDIER' | 'DEMOMAN_BODY', isUbered: boolean = false): void {
    graphics.clear();
    
    // Shadow
    graphics.fillStyle(0x000000, 0.6);
    graphics.fillEllipse(0, 90, 120, 30);
    
    // Draw Über glow if enemy is Übered by Medic
    if (isUbered) {
      // Outer pulsing blue glow
      graphics.fillStyle(0x4488ff, 0.3);
      graphics.fillCircle(0, 0, 100);
      // Middle glow
      graphics.fillStyle(0x4488ff, 0.4);
      graphics.fillCircle(0, 0, 80);
      // Inner bright glow
      graphics.fillStyle(0x66aaff, 0.5);
      graphics.fillCircle(0, 0, 60);
    }
    
    if (type === 'SCOUT') {
      // Scout - lean Boston speedster (UPDATED to match gallery)
      
      // Blue glow behind (normal - skip if Übered since we drew it above)
      if (!isUbered) {
        graphics.fillStyle(0x3366aa, 0.15);
        graphics.fillCircle(0, 0, 75);
      }
      
      // Legs - khaki pants
      graphics.fillStyle(0x8b7355, 1);
      graphics.fillRect(-15, 15, 13, 40);
      graphics.fillRect(2, 12, 13, 43);
      // Knee wraps
      graphics.fillStyle(0xcccccc, 1);
      graphics.fillRect(-14, 30, 11, 6);
      graphics.fillRect(3, 28, 11, 6);
      
      // Running shoes - red with white stripe
      graphics.fillStyle(0xcc2222, 1);
      graphics.fillRoundedRect(-18, 52, 18, 10, 3);
      graphics.fillRoundedRect(2, 52, 18, 10, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-14, 55, 8, 3);
      graphics.fillRect(6, 55, 8, 3);
      
      // Athletic torso - BLU team shirt
      graphics.fillStyle(0x335599, 1);
      graphics.beginPath();
      graphics.moveTo(-20, -20);
      graphics.lineTo(18, -20);
      graphics.lineTo(15, 18);
      graphics.lineTo(-17, 18);
      graphics.closePath();
      graphics.fillPath();
      
      // Dog tags
      graphics.fillStyle(0x777777, 1);
      graphics.fillRect(-1, -15, 2, 20);
      graphics.fillStyle(0x999999, 1);
      graphics.fillEllipse(0, 7, 6, 8);
      graphics.fillEllipse(2, 9, 6, 8);
      
      // Bandages on hands/forearms - iconic Scout look
      graphics.fillStyle(0xdddddd, 1);
      graphics.fillRect(-38, 5, 12, 18);
      graphics.fillRect(26, -25, 12, 18);
      // Tape strips
      graphics.fillStyle(0xcccccc, 1);
      for (let i = 0; i < 4; i++) {
        graphics.fillRect(-37, 7 + i * 4, 10, 2);
        graphics.fillRect(27, -23 + i * 4, 10, 2);
      }
      
      // Arms - BLU team
      graphics.fillStyle(0x335599, 1);
      graphics.fillCircle(-22, -14, 10);
      graphics.fillCircle(20, -14, 10);
      graphics.fillRect(-42, -18, 22, 12);
      graphics.fillRect(18, -35, 12, 25);
      
      // Hands (under bandages)
      graphics.fillStyle(0xd4a574, 1);
      graphics.fillCircle(-35, 20, 8);
      graphics.fillCircle(30, -38, 8);
      
      // Baseball bat - aluminum
      graphics.fillStyle(0xaaaaaa, 1);
      graphics.fillRect(24, -70, 10, 50);
      graphics.fillStyle(0x888888, 1);
      graphics.fillRoundedRect(22, -78, 14, 22, 5);
      // Grip tape
      graphics.fillStyle(0x222222, 1);
      graphics.fillRect(25, -25, 8, 18);
      graphics.fillStyle(0xcc2222, 1);
      graphics.fillCircle(29, -5, 5);
      
      // Head
      graphics.fillStyle(0xd4a574, 1);
      graphics.fillCircle(0, -40, 22);
      graphics.fillEllipse(0, -22, 16, 10);
      
      // Patrol cap - grey military
      graphics.fillStyle(0x4a4a4a, 1);
      graphics.beginPath();
      graphics.arc(0, -48, 24, Math.PI, 0, false);
      graphics.closePath();
      graphics.fillPath();
      // Bill (facing backward/right)
      graphics.fillStyle(0x3a3a3a, 1);
      graphics.beginPath();
      graphics.moveTo(24, -46);
      graphics.lineTo(45, -38);
      graphics.lineTo(40, -44);
      graphics.lineTo(5, -46);
      graphics.closePath();
      graphics.fillPath();
      // Cap button
      graphics.fillStyle(0x555555, 1);
      graphics.fillCircle(0, -62, 4);
      
      // Headset
      graphics.fillStyle(0x333333, 1);
      graphics.fillRect(12, -55, 14, 4);
      graphics.fillCircle(22, -42, 9);
      graphics.fillStyle(0x222222, 1);
      graphics.fillCircle(22, -42, 6);
      // Mic
      graphics.fillStyle(0x444444, 1);
      graphics.fillRect(20, -38, 3, 20);
      graphics.fillCircle(21, -18, 5);
      
      // No mouth - more threatening
      
      // Red eyes
      graphics.fillStyle(0xff0000, 0.4);
      graphics.fillCircle(-8, -40, 8);
      graphics.fillCircle(8, -40, 8);
      graphics.fillStyle(0xff0000, 1);
      graphics.fillCircle(-8, -40, 5);
      graphics.fillCircle(8, -40, 5);
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillCircle(-10, -42, 2);
      graphics.fillCircle(6, -42, 2);
      
    } else if (type === 'SOLDIER') {
      // Soldier - UPDATED to match gallery sprite
      
      // Red/orange glow behind (skip if Übered - blue glow drawn above)
      if (!isUbered) {
        graphics.fillStyle(0xcc4422, 0.12);
        graphics.fillCircle(0, 0, 80);
      }
      
      // Legs - wide military stance
      graphics.fillStyle(0x3a3a4a, 1);
      graphics.fillRect(-24, 22, 18, 36);
      graphics.fillRect(6, 22, 18, 36);
      // Knee pads
      graphics.fillStyle(0x2a2a3a, 1);
      graphics.fillEllipse(-15, 32, 10, 8);
      graphics.fillEllipse(15, 32, 10, 8);
      // Combat boots
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(-28, 52, 24, 12, 3);
      graphics.fillRoundedRect(4, 52, 24, 12, 3);
      graphics.fillStyle(0x111111, 1);
      graphics.fillRect(-28, 62, 24, 3);
      graphics.fillRect(4, 62, 24, 3);
      
      // Stocky military torso - BLU team
      graphics.fillStyle(0x224488, 1);
      graphics.fillRoundedRect(-32, -18, 64, 45, 6);
      // Jacket center seam
      graphics.fillStyle(0x1a3377, 1);
      graphics.fillRect(-3, -15, 6, 40);
      // Jacket collar
      graphics.fillStyle(0x1a2a66, 1);
      graphics.fillRect(-18, -20, 36, 8);
      // Chest pockets
      graphics.fillStyle(0x335599, 0.5);
      graphics.fillRect(-26, -8, 14, 12);
      graphics.fillRect(12, -8, 14, 12);
      // Pocket buttons
      graphics.fillStyle(0x888866, 1);
      graphics.fillCircle(-19, -2, 2);
      graphics.fillCircle(19, -2, 2);
      
      // Ammo pouches
      graphics.fillStyle(0x4a4a3a, 1);
      graphics.fillRect(-30, 14, 14, 14);
      graphics.fillRect(16, 14, 14, 14);
      graphics.fillStyle(0x3a3a2a, 1);
      graphics.fillRect(-30, 14, 14, 5);
      graphics.fillRect(16, 14, 14, 5);
      
      // Strong arms - BLU team
      graphics.fillStyle(0x224488, 1);
      graphics.fillCircle(-32, -8, 14);
      graphics.fillCircle(32, -8, 14);
      graphics.fillRect(-44, -10, 16, 40);
      graphics.fillRect(28, -25, 16, 30);
      
      // Hands
      graphics.fillStyle(0xc49a64, 1);
      graphics.fillCircle(-38, 32, 10);
      graphics.fillCircle(36, -28, 10);
      
      // Head (mostly hidden)
      graphics.fillStyle(0x9a8a7a, 1);
      graphics.fillCircle(0, -35, 20);
      graphics.fillStyle(0xaa9a8a, 1);
      graphics.fillEllipse(0, -18, 18, 12);
      // Stubble
      graphics.fillStyle(0x6a5a4a, 0.4);
      graphics.fillEllipse(0, -20, 16, 10);
      
      // Iconic pot helmet
      graphics.fillStyle(0x5a5a4a, 1);
      graphics.fillCircle(0, -44, 28);
      graphics.fillRect(-28, -44, 56, 22);
      // Helmet rim
      graphics.fillStyle(0x4a4a3a, 1);
      graphics.fillRoundedRect(-34, -26, 68, 12, 3);
      // Deep shadow
      graphics.fillStyle(0x1a1a1a, 0.85);
      graphics.fillRect(-28, -20, 56, 12);
      // Battle damage dent
      graphics.fillStyle(0x3a3a2a, 1);
      graphics.fillCircle(12, -48, 6);
      
      // Glowing eyes in shadow
      graphics.fillStyle(0xff0000, 0.5);
      graphics.fillCircle(-11, -16, 10);
      graphics.fillCircle(11, -16, 10);
      graphics.fillStyle(0xff0000, 1);
      graphics.fillCircle(-11, -16, 6);
      graphics.fillCircle(11, -16, 6);
      graphics.fillStyle(0xffaaaa, 1);
      graphics.fillCircle(-11, -16, 3);
      graphics.fillCircle(11, -16, 3);
      
      // ROCKET LAUNCHER - detailed
      graphics.fillStyle(0x5a5a5a, 1);
      graphics.fillRoundedRect(18, -55, 58, 20, 4);
      graphics.fillStyle(0x4a4a4a, 1);
      graphics.fillCircle(76, -45, 14);
      graphics.fillStyle(0x333333, 1);
      graphics.fillCircle(76, -45, 10);
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillCircle(76, -45, 6);
      // Sight
      graphics.fillStyle(0x444444, 1);
      graphics.fillRect(35, -62, 18, 8);
      graphics.fillStyle(0x333333, 1);
      graphics.fillRect(38, -66, 4, 6);
      // Handle
      graphics.fillStyle(0x4a3a2a, 1);
      graphics.fillRect(32, -40, 10, 18);
      // Trigger guard
      graphics.fillStyle(0x3a3a3a, 1);
      graphics.fillRect(28, -38, 6, 12);
      
      // Grenades on belt - detailed
      graphics.fillStyle(0x3a4a3a, 1);
      graphics.fillCircle(-22, 30, 8);
      graphics.fillCircle(-6, 30, 8);
      graphics.fillCircle(10, 30, 8);
      graphics.fillStyle(0x2a3a2a, 1);
      graphics.fillRect(-25, 22, 6, 6);
      graphics.fillRect(-9, 22, 6, 6);
      graphics.fillRect(7, 22, 6, 6);
      graphics.fillStyle(0xaaaa88, 1);
      graphics.fillCircle(-22, 23, 3);
      graphics.fillCircle(-6, 23, 3);
      graphics.fillCircle(10, 23, 3);
      
    } else if (type === 'DEMOMAN_BODY') {
      // Demoman - HEADLESS body with Eyelander (matches gallery)
      
      // Ghostly green glow (skip if Übered - blue glow drawn above)
      if (!isUbered) {
        graphics.fillStyle(0x00ff44, 0.18);
        graphics.fillCircle(0, 10, 95);
      }
      
      // Legs
      graphics.fillStyle(0x2a2a3a, 1);
      graphics.fillRect(-22, 22, 18, 55);
      graphics.fillRect(4, 22, 18, 55);
      // Boots
      graphics.fillStyle(0x1a1a1a, 1);
      graphics.fillRoundedRect(-26, 70, 24, 14, 3);
      graphics.fillRoundedRect(2, 70, 24, 14, 3);
      
      // Stocky torso - BLU team
      graphics.fillStyle(0x224488, 1);
      graphics.fillRoundedRect(-32, -28, 64, 55, 6);
      // Vest/harness
      graphics.fillStyle(0x3a2a1a, 1);
      graphics.fillRect(-28, -22, 12, 45);
      graphics.fillRect(16, -22, 12, 45);
      graphics.fillRect(-28, -5, 56, 10);
      
      // Grenade bandolier
      graphics.fillStyle(0x4a4a3a, 1);
      graphics.beginPath();
      graphics.moveTo(-30, 18);
      graphics.lineTo(30, -16);
      graphics.lineTo(30, -6);
      graphics.lineTo(-30, 28);
      graphics.closePath();
      graphics.fillPath();
      // Stickybombs
      graphics.fillStyle(0x333333, 1);
      for (let i = 0; i < 5; i++) {
        const gx = -24 + i * 12;
        const gy = 12 - i * 6;
        graphics.fillCircle(gx, gy, 7);
        graphics.fillStyle(0xff3300, 1);
        graphics.fillCircle(gx, gy, 4);
        graphics.fillStyle(0x333333, 1);
      }
      
      // Arms - BLU team
      graphics.fillStyle(0x224488, 1);
      graphics.fillCircle(-32, -16, 14);
      graphics.fillCircle(32, -16, 14);
      graphics.fillRect(-44, -18, 16, 48);
      graphics.fillRect(28, -42, 16, 36);
      
      // Hands
      graphics.fillStyle(0x5a4a3a, 1);
      graphics.fillCircle(-40, 32, 12);
      graphics.fillCircle(36, -48, 12);
      
      // NECK STUMP (headless!)
      graphics.fillStyle(0x4a3a2a, 1);
      graphics.fillEllipse(0, -32, 20, 12);
      // Green ectoplasm
      graphics.fillStyle(0x00ff44, 0.7);
      graphics.fillEllipse(-6, -28, 10, 14);
      graphics.fillEllipse(8, -30, 8, 12);
      graphics.fillStyle(0x00ff44, 0.4);
      graphics.fillEllipse(-2, -20, 6, 10);
      
      // EYELANDER SWORD
      graphics.fillStyle(0x00ff44, 0.4);
      graphics.fillRect(30, -100, 14, 65);
      graphics.fillStyle(0x666666, 1);
      graphics.fillRect(32, -98, 10, 60);
      graphics.fillStyle(0x00ff44, 0.9);
      graphics.fillRect(32, -98, 3, 60);
      // Blade tip
      graphics.beginPath();
      graphics.moveTo(32, -98);
      graphics.lineTo(42, -98);
      graphics.lineTo(37, -110);
      graphics.closePath();
      graphics.fillStyle(0x00ff44, 0.7);
      graphics.fillPath();
      // Crossguard
      graphics.fillStyle(0x444444, 1);
      graphics.fillRect(24, -42, 26, 8);
      // Handle
      graphics.fillStyle(0x3a2a1a, 1);
      graphics.fillRect(32, -36, 10, 22);
      // Pommel
      graphics.fillStyle(0x555555, 1);
      graphics.fillCircle(37, -14, 5);
    }
  }
  
  /**
   * Draw Demoman's severed head for camera feed
   * @param isUbered - If true, draws a bright blue Über glow around the head
   */
  private drawDemomanHead(graphics: Phaser.GameObjects.Graphics, isUbered: boolean = false): void {
    graphics.clear();
    
    // Draw Über glow if Demoman is Übered by Medic
    if (isUbered) {
      // Outer pulsing blue glow
      graphics.fillStyle(0x4488ff, 0.4);
      graphics.fillCircle(0, 0, 90);
      // Middle glow
      graphics.fillStyle(0x4488ff, 0.5);
      graphics.fillCircle(0, 0, 70);
      // Inner bright glow
      graphics.fillStyle(0x66aaff, 0.6);
      graphics.fillCircle(0, 0, 55);
    }
    
    // Shadow under head
    graphics.fillStyle(0x000000, 0.4);
    graphics.fillEllipse(0, 55, 80, 20);
    
    // Head - larger for camera view (dark skin)
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillCircle(0, 0, 45);
    
    // Beanie (dark blue/black)
    graphics.fillStyle(0x1a1a2a, 1);
    graphics.beginPath();
    graphics.arc(0, -10, 48, Math.PI, 0, false);
    graphics.closePath();
    graphics.fillPath();
    
    // Beanie rim
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillRect(-48, -12, 96, 8);
    
    // Beard
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillEllipse(0, 35, 55, 35);
    
    // Eyepatch (right eye - covers the missing eye)
    graphics.fillStyle(0x111111, 1);
    graphics.fillCircle(18, -8, 18);
    graphics.fillRect(16, -35, 8, 30);
    
    // Left eye socket - dark void (or glowing if active)
    // Use blue glow when Übered, green normally
    const eyeGlowColor = isUbered ? 0x4488ff : 0x00ff44;
    if (this.demoman.isEyeGlowing() && this.demoman.activeEye === 'LEFT') {
      graphics.fillStyle(eyeGlowColor, 0.6);
      graphics.fillCircle(-18, -8, 25);
      graphics.fillStyle(eyeGlowColor, 1);
      graphics.fillCircle(-18, -8, 15);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(-22, -12, 4);
    } else if (isUbered) {
      // Even when eye not glowing, show blue aura in socket when Übered
      graphics.fillStyle(0x4488ff, 0.4);
      graphics.fillCircle(-18, -8, 18);
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(-18, -8, 12);
    } else {
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(-18, -8, 15);
    }
    
    // Right eye (under patch) glows through if active
    if (this.demoman.isEyeGlowing() && this.demoman.activeEye === 'RIGHT') {
      graphics.fillStyle(eyeGlowColor, 0.8);
      graphics.fillCircle(18, -8, 20);
    } else if (isUbered) {
      // Blue glow visible through eyepatch when Übered
      graphics.fillStyle(0x4488ff, 0.3);
      graphics.fillCircle(18, -8, 15);
    }
  }
  
  /**
   * Draw Heavy silhouette for camera feed - massive, intimidating
   */
  private drawHeavySilhouette(graphics: Phaser.GameObjects.Graphics, isLured: boolean): void {
    graphics.clear();
    
    // Shadow
    graphics.fillStyle(0x000000, 0.6);
    graphics.fillEllipse(0, 90, 130, 35);
    
    // Glow effect (yellow when lured, red normally)
    graphics.fillStyle(isLured ? 0xccaa00 : 0xaa3333, 0.12);
    graphics.fillCircle(0, 0, 90);
    
    // Thick powerful legs
    const bodyColor = isLured ? 0x6a5a2a : 0x224488;  // BLU team color when not lured
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillRect(-30, 25, 26, 38);
    graphics.fillRect(4, 25, 26, 38);
    // Knee pads
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillEllipse(-17, 35, 14, 10);
    graphics.fillEllipse(17, 35, 14, 10);
    // Combat boots
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRoundedRect(-34, 58, 32, 12, 3);
    graphics.fillRoundedRect(2, 58, 32, 12, 3);
    // Boot laces
    graphics.fillStyle(0x444444, 1);
    graphics.fillRect(-22, 60, 10, 2);
    graphics.fillRect(12, 60, 10, 2);
    
    // MASSIVE barrel chest
    graphics.fillStyle(bodyColor, 1);
    graphics.fillRoundedRect(-50, -30, 100, 60, 12);
    // Pec definition
    graphics.fillStyle(isLured ? 0x5a4a1a : 0x1a3377, 0.4);
    graphics.fillEllipse(-22, -5, 22, 28);
    graphics.fillEllipse(22, -5, 22, 28);
    
    // Vest with buckles
    graphics.fillStyle(0x1a2a55, 1);
    graphics.fillRect(-6, -25, 12, 55);
    graphics.fillStyle(0xaa9944, 1);
    graphics.fillRect(-8, -15, 16, 6);
    graphics.fillRect(-8, 5, 16, 6);
    graphics.fillRect(-8, 20, 16, 6);
    
    // Ammo belt - THICK diagonal
    graphics.fillStyle(0x6a5a3a, 1);
    graphics.beginPath();
    graphics.moveTo(-48, 15);
    graphics.lineTo(48, -18);
    graphics.lineTo(48, -5);
    graphics.lineTo(-48, 28);
    graphics.closePath();
    graphics.fillPath();
    // Brass bullets
    graphics.fillStyle(0xccaa33, 1);
    for (let i = 0; i < 9; i++) {
      const bx = -42 + i * 11;
      const by = 13 - i * 3.8;
      graphics.fillRect(bx, by, 6, 10);
      graphics.fillStyle(0xdd6633, 1);
      graphics.fillRect(bx, by + 6, 6, 4);
      graphics.fillStyle(0xccaa33, 1);
    }
    
    // HUGE arms
    graphics.fillStyle(bodyColor, 1);
    graphics.fillCircle(-50, -15, 22);
    graphics.fillRect(-70, -20, 28, 55);
    graphics.fillCircle(50, -15, 22);
    graphics.fillRect(42, -20, 28, 50);
    
    // Meaty hands
    graphics.fillStyle(0xd4a574, 1);
    graphics.fillCircle(-60, 38, 16);
    graphics.fillCircle(55, 32, 16);
    // Thick fingers
    graphics.fillStyle(0xc49a64, 1);
    graphics.fillCircle(-70, 35, 7);
    graphics.fillCircle(-52, 48, 6);
    graphics.fillCircle(65, 28, 7);
    graphics.fillCircle(48, 42, 6);
    
    // Big bald head
    graphics.fillStyle(0x8a7a6a, 1);
    graphics.fillCircle(0, -52, 36);
    graphics.fillStyle(0x9a8a7a, 1);
    graphics.fillCircle(0, -48, 30);
    // Ears
    graphics.fillStyle(0x8a7a6a, 1);
    graphics.fillCircle(-34, -50, 12);
    graphics.fillCircle(34, -50, 12);
    
    // 5 o'clock shadow
    graphics.fillStyle(0x5a4a3a, 0.4);
    graphics.fillEllipse(0, -32, 26, 18);
    
    // Heavy brow
    graphics.fillStyle(0x6a5a4a, 1);
    graphics.fillRect(-26, -62, 52, 12);
    
    // Angry eyebrows - thick
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.beginPath();
    graphics.moveTo(-26, -58);
    graphics.lineTo(-6, -52);
    graphics.lineTo(-26, -52);
    graphics.closePath();
    graphics.fillPath();
    graphics.beginPath();
    graphics.moveTo(26, -58);
    graphics.lineTo(6, -52);
    graphics.lineTo(26, -52);
    graphics.closePath();
    graphics.fillPath();
    
    // Eyes (yellow when lured, red normally)
    const eyeColor = isLured ? 0xffcc00 : 0xff0000;
    graphics.fillStyle(eyeColor, 0.6);
    graphics.fillCircle(-14, -50, 14);
    graphics.fillCircle(14, -50, 14);
    graphics.fillStyle(eyeColor, 1);
    graphics.fillCircle(-14, -50, 9);
    graphics.fillCircle(14, -50, 9);
    graphics.fillStyle(isLured ? 0xffffaa : 0xffaaaa, 1);
    graphics.fillCircle(-14, -50, 4);
    graphics.fillCircle(14, -50, 4);
    // Eye glints
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillCircle(-18, -54, 3);
    graphics.fillCircle(10, -54, 3);
    
    // Wide nose
    graphics.fillStyle(0x7a6a5a, 1);
    graphics.fillEllipse(0, -40, 14, 10);
    
    // No mouth - more menacing
    
    // MINIGUN "SASHA" - massive and iconic
    graphics.fillStyle(0x555555, 1);
    graphics.fillRoundedRect(-72, 30, 135, 26, 4);
    // Barrel shroud
    graphics.fillStyle(0x666666, 1);
    graphics.fillRoundedRect(-80, 32, 25, 22, 3);
    // Rotating barrel cluster
    graphics.fillStyle(0x4a4a4a, 1);
    graphics.fillCircle(-85, 43, 20);
    graphics.fillStyle(0x3a3a3a, 1);
    graphics.fillCircle(-85, 43, 16);
    // Individual barrels with depth
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const bx = -85 + Math.cos(angle) * 10;
      const by = 43 + Math.sin(angle) * 10;
      graphics.fillStyle(0x222222, 1);
      graphics.fillCircle(bx, by, 4);
      graphics.fillStyle(0x111111, 1);
      graphics.fillCircle(bx, by, 2);
    }
    // Center spindle
    graphics.fillStyle(0x333333, 1);
    graphics.fillCircle(-85, 43, 5);
    
    // Handle grips
    graphics.fillStyle(0x4a3a2a, 1);
    graphics.fillRect(0, 16, 16, 22);
    graphics.fillRect(35, 20, 12, 18);
    // Grip texture
    graphics.fillStyle(0x3a2a1a, 1);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(2, 18 + i * 5, 12, 2);
    }
  }
  
  /**
   * Draw Sniper silhouette for camera feed - tall, lean, rifle
   */
  private drawSniperSilhouette(graphics: Phaser.GameObjects.Graphics, isLured: boolean): void {
    graphics.clear();
    
    // Shadow
    graphics.fillStyle(0x000000, 0.5);
    graphics.fillEllipse(0, 90, 80, 18);
    
    // Eerie blue glow (yellow when lured)
    graphics.fillStyle(isLured ? 0xffcc00 : 0x4488ff, 0.25);
    graphics.fillCircle(0, -10, 95);
    graphics.fillStyle(isLured ? 0xccaa00 : 0x2266dd, 0.2);
    graphics.fillCircle(0, -30, 60);
    
    // Tall lean legs - crouched aiming stance
    graphics.fillStyle(0x4a4a3a, 1);
    graphics.fillRect(-16, 20, 14, 55);
    graphics.fillRect(2, 18, 14, 58);
    // Knee details
    graphics.fillStyle(0x3a3a2a, 1);
    graphics.fillEllipse(-9, 35, 9, 7);
    graphics.fillEllipse(9, 33, 9, 7);
    // Boots
    graphics.fillStyle(0x2a2a1a, 1);
    graphics.fillRoundedRect(-18, 70, 16, 16, 2);
    graphics.fillRoundedRect(2, 72, 16, 16, 2);
    
    // Lean vest (yellowish when lured)
    const bodyColor = isLured ? 0x6a5a2a : 0x224488;  // BLU team color when not lured
    graphics.fillStyle(bodyColor, 1);
    graphics.beginPath();
    graphics.moveTo(-26, -32);
    graphics.lineTo(24, -32);
    graphics.lineTo(20, 25);
    graphics.lineTo(-22, 25);
    graphics.closePath();
    graphics.fillPath();
    // Vest details
    graphics.fillStyle(isLured ? 0x5a4a1a : 0x1a3377, 1);
    graphics.fillRect(-3, -28, 4, 50);
    // Shirt collar
    graphics.fillStyle(0xaa9988, 1);
    graphics.fillRect(-14, -36, 28, 6);
    
    // Arms in aiming position
    graphics.fillStyle(bodyColor, 1);
    graphics.fillCircle(-26, -24, 12);
    graphics.fillCircle(24, -24, 12);
    graphics.fillRect(-34, -30, 14, 16);
    graphics.fillRect(18, -30, 14, 16);
    
    // Hands gripping rifle
    graphics.fillStyle(0xc49a64, 1);
    graphics.fillCircle(-10, -18, 10);
    graphics.fillCircle(14, -15, 10);
    
    // Head tilted, looking down scope
    graphics.fillStyle(0xb49a7a, 1);
    graphics.fillCircle(6, -58, 22);
    graphics.fillEllipse(6, -40, 16, 12);
    // Stubble
    graphics.fillStyle(0x5a4a3a, 0.5);
    graphics.fillEllipse(6, -42, 14, 10);
    
    // Slouch hat
    graphics.fillStyle(0x5a4a3a, 1);
    graphics.fillEllipse(6, -66, 40, 12);
    graphics.fillStyle(0x4a3a2a, 1);
    graphics.fillRoundedRect(-12, -88, 36, 24, 4);
    // Hat band
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillRect(-12, -68, 36, 5);
    // Hat dent
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillRect(-2, -88, 16, 6);
    
    // Blue visor (glowing) - spans across both eyes
    const visorColor = isLured ? 0xffcc00 : 0x00aaff;
    // Visor frame
    graphics.fillStyle(0x222222, 1);
    graphics.fillRoundedRect(-14, -66, 40, 14, 4);
    // Visor glass - glowing blue
    graphics.fillStyle(visorColor, 0.3);
    graphics.fillRoundedRect(-12, -64, 36, 10, 3);
    graphics.fillStyle(visorColor, 0.7);
    graphics.fillRoundedRect(-10, -62, 32, 6, 2);
    // Bright center glow
    graphics.fillStyle(visorColor, 1);
    graphics.fillRoundedRect(-6, -61, 24, 4, 2);
    // Outer glow effect
    graphics.fillStyle(visorColor, 0.2);
    graphics.fillRoundedRect(-16, -68, 44, 18, 5);
    
    // SNIPER RIFLE - aimed at viewer (foreshortened)
    graphics.fillStyle(0x3a3a3a, 1);
    graphics.fillRoundedRect(-20, -12, 42, 24, 4);
    // Stock
    graphics.fillStyle(0x5a4a3a, 1);
    graphics.fillRoundedRect(18, -8, 24, 16, 3);
    
    // SCOPE facing viewer - prominent
    graphics.fillStyle(0x2a2a2a, 1);
    graphics.fillCircle(-8, -28, 20);
    graphics.fillStyle(0x222222, 1);
    graphics.fillCircle(-8, -28, 16);
    // Scope lens - GLOWING (aimed at you!)
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillCircle(-8, -28, 12);
    graphics.fillStyle(isLured ? 0xffcc00 : 0x4488ff, 0.5);
    graphics.fillCircle(-8, -28, 12);
    graphics.fillStyle(isLured ? 0xffcc00 : 0x4488ff, 1);
    graphics.fillCircle(-8, -28, 7);
    graphics.fillStyle(isLured ? 0xffffcc : 0x88ccff, 1);
    graphics.fillCircle(-10, -30, 3);
    // Crosshair in scope
    graphics.fillStyle(0x000000, 0.6);
    graphics.fillRect(-9, -36, 2, 16);
    graphics.fillRect(-16, -29, 16, 2);
    
    // Barrel toward viewer
    graphics.fillStyle(0x2a2a2a, 1);
    graphics.fillCircle(-8, 8, 10);
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillCircle(-8, 8, 7);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(-8, 8, 4);
    
    // Kukri on belt
    graphics.fillStyle(0x888888, 1);
    graphics.fillRect(-28, 12, 18, 4);
    graphics.fillStyle(0x4a3a2a, 1);
    graphics.fillRect(-32, 10, 6, 8);
  }
  
  /**
   * Play victory chime - triumphant fanfare
   */
  private playVictoryChime(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Triumphant chord sequence
      const notes = [
        { freq: 523.25, time: 0, dur: 0.2 },     // C5
        { freq: 659.25, time: 0.15, dur: 0.2 },  // E5
        { freq: 783.99, time: 0.3, dur: 0.2 },   // G5
        { freq: 1046.50, time: 0.45, dur: 0.5 }, // C6 (hold)
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = audioContext.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur + 0.1);
      });
      
      // Add sparkle effect
      for (let i = 0; i < 5; i++) {
        const sparkle = audioContext.createOscillator();
        const sparkleGain = audioContext.createGain();
        sparkle.connect(sparkleGain);
        sparkleGain.connect(audioContext.destination);
        
        sparkle.type = 'sine';
        sparkle.frequency.value = 2000 + Math.random() * 2000;
        
        const t = audioContext.currentTime + 0.5 + i * 0.1;
        sparkleGain.gain.setValueAtTime(0.08, t);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        sparkle.start(t);
        sparkle.stop(t + 0.2);
      }
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Start the Demoman eye glow fire sound (looping crackle)
   */
  private startDemoEyeGlowSound(): void {
    if (this.demoEyeGlowSoundPlaying) return;
    
    try {
      const audioContext = this.sharedAudioContext || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Create a subtle crackling fire sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      const mainGain = audioContext.createGain();
      
      // LFO for crackling effect
      lfo.type = 'square';
      lfo.frequency.value = 8; // Crackle rate
      lfo.connect(lfoGain);
      lfoGain.gain.value = 30;
      lfoGain.connect(osc1.frequency);
      
      // Main oscillators - low rumble with higher crackle
      osc1.type = 'sawtooth';
      osc1.frequency.value = 80;
      osc2.type = 'triangle';
      osc2.frequency.value = 120;
      
      osc1.connect(mainGain);
      osc2.connect(mainGain);
      mainGain.connect(audioContext.destination);
      
      mainGain.gain.value = 0.08; // Subtle
      
      lfo.start();
      osc1.start();
      osc2.start();
      
      this.demoEyeGlowOscillator = osc1;
      this.demoEyeGlowGain = mainGain;
      this.demoEyeGlowSoundPlaying = true;
      
      // Store references for cleanup
      (osc1 as unknown as { _lfo: OscillatorNode })._lfo = lfo;
      (osc1 as unknown as { _osc2: OscillatorNode })._osc2 = osc2;
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Stop the Demoman eye glow fire sound
   */
  private stopDemoEyeGlowSound(): void {
    if (!this.demoEyeGlowSoundPlaying) return;
    
    try {
      if (this.demoEyeGlowGain) {
        this.demoEyeGlowGain.gain.linearRampToValueAtTime(0, 
          (this.sharedAudioContext?.currentTime || 0) + 0.1);
      }
      if (this.demoEyeGlowOscillator) {
        const osc = this.demoEyeGlowOscillator as unknown as { _lfo?: OscillatorNode; _osc2?: OscillatorNode };
        setTimeout(() => {
          try {
            this.demoEyeGlowOscillator?.stop();
            osc._lfo?.stop();
            osc._osc2?.stop();
          } catch (e) { /* ignore */ }
        }, 150);
      }
    } catch (e) {
      // ignore
    }
    
    this.demoEyeGlowOscillator = null;
    this.demoEyeGlowGain = null;
    this.demoEyeGlowSoundPlaying = false;
  }
  
  /**
   * Play jumpscare sound for game over
   */
  private playJumpscareSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Loud stinger chord
      const frequencies = [120, 180, 240, 360];  // Dissonant chord
      frequencies.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = i === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioContext.currentTime + 0.8);
        
        gain.gain.setValueAtTime(0.4, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.8);
      });
      
      // Harsh noise burst
      const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSource = audioContext.createBufferSource();
      const noiseGain = audioContext.createGain();
      noiseSource.buffer = noiseBuffer;
      noiseSource.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      noiseGain.gain.setValueAtTime(0.5, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      noiseSource.start(audioContext.currentTime);
      
      // Deep bass hit
      const bassOsc = audioContext.createOscillator();
      const bassGain = audioContext.createGain();
      bassOsc.connect(bassGain);
      bassGain.connect(audioContext.destination);
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(40, audioContext.currentTime);
      bassOsc.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
      bassGain.gain.setValueAtTime(0.6, audioContext.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      bassOsc.start(audioContext.currentTime);
      bassOsc.stop(audioContext.currentTime + 0.5);
      
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play camera switch sound - consistent volume
   */
  private playCameraSwitchSound(): void {
    try {
      // Reuse shared audio context for consistent volume
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Consistent click sound
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.03);
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);  // Fixed volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play Heavy footstep sound - THREE loud thuds (old style, louder)
   */
  private playHeavyFootsteps(volume: number): void {
    if (this.nightNumber < 3) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Volume based on distance - VERY LOUD (minimum 0.4, max 1.0)
      const actualVolume = Math.max(0.4, volume) * 1.0;
      
      // Play THREE thuds with slight delays
      const thudDelays = [0, 0.2, 0.45]; // Timing for each thud
      
      thudDelays.forEach((delay) => {
        const thudTime = audioContext.currentTime + delay;
        
        // OLD STYLE - Deep thudding footstep
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const osc3 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc3.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Very low frequency thud - impact
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(40, thudTime);
        osc1.frequency.exponentialRampToValueAtTime(20, thudTime + 0.3);
        
        // Mid rumble
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(70, thudTime);
        osc2.frequency.exponentialRampToValueAtTime(30, thudTime + 0.2);
        
        // High transient click
        osc3.type = 'square';
        osc3.frequency.setValueAtTime(150, thudTime);
        osc3.frequency.exponentialRampToValueAtTime(50, thudTime + 0.05);
        
        gainNode.gain.setValueAtTime(actualVolume, thudTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, thudTime + 0.35);
        
        osc1.start(thudTime);
        osc1.stop(thudTime + 0.35);
        osc2.start(thudTime);
        osc2.stop(thudTime + 0.25);
        osc3.start(thudTime);
        osc3.stop(thudTime + 0.08);
      });
      
    } catch (e) {
      // Audio error
    }
  }
  
  /**
   * Play teleport sound effect - sci-fi zap/whoosh
   */
  private playTeleportSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // High-pitched rising tone
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Rising sci-fi sweep
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(200, audioContext.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.15);
      
      // Harmonic for thickness
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300, audioContext.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1500, audioContext.currentTime + 0.15);
      
      // Lowpass filter for sci-fi effect
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(4000, audioContext.currentTime + 0.1);
      filter.Q.value = 5;
      
      // Quick fade in/out
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.2);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not available
    }
  }
  
  // Growl sound state for enemy approach
  private approachGrowlOsc: OscillatorNode | null = null;
  private approachGrowlGain: GainNode | null = null;
  
  /**
   * Play enemy approaching warning sound - growing growl
   */
  private playEnemyApproachSound(): void {
    this.startApproachGrowl();
  }
  
  /**
   * Start the growling sound that intensifies during escape countdown
   */
  private startApproachGrowl(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Stop any existing growl
      this.stopApproachGrowl();
      
      // Create low rumbling growl
      this.approachGrowlOsc = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      this.approachGrowlGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      this.approachGrowlOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(this.approachGrowlGain);
      this.approachGrowlGain.connect(audioContext.destination);
      
      // Low menacing rumble
      this.approachGrowlOsc.type = 'sawtooth';
      this.approachGrowlOsc.frequency.setValueAtTime(50, audioContext.currentTime);
      
      // Secondary growl tone
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(70, audioContext.currentTime);
      
      // Lowpass filter for rumble
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, audioContext.currentTime);
      filter.Q.value = 2;
      
      // Start quiet, will be updated by updateApproachGrowl
      this.approachGrowlGain.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      this.approachGrowlOsc.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      
      // Stop after 6 seconds max
      this.approachGrowlOsc.stop(audioContext.currentTime + 6);
      osc2.stop(audioContext.currentTime + 6);
      
    } catch (e) {
      // Audio error
    }
  }
  
  /**
   * Update growl intensity based on time remaining
   */
  private updateApproachGrowl(timeRemaining: number): void {
    if (!this.approachGrowlGain || !this.sharedAudioContext) return;
    
    try {
      // Intensity increases as time runs out (5s -> 0s maps to 0.1 -> 0.8)
      const maxTime = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
      const progress = 1 - (timeRemaining / maxTime);
      const volume = 0.1 + (progress * 0.7);
      
      this.approachGrowlGain.gain.setValueAtTime(volume, this.sharedAudioContext.currentTime);
      
      // Also increase filter frequency for more intensity
      if (this.approachGrowlOsc) {
        const freq = 50 + (progress * 100);
        this.approachGrowlOsc.frequency.setValueAtTime(freq, this.sharedAudioContext.currentTime);
      }
    } catch (e) {
      // Audio error
    }
  }
  
  /**
   * Stop the approach growl sound
   */
  private stopApproachGrowl(): void {
    try {
      if (this.approachGrowlOsc) {
        this.approachGrowlOsc.stop();
        this.approachGrowlOsc = null;
      }
      if (this.approachGrowlGain) {
        this.approachGrowlGain = null;
      }
    } catch (e) {
      // Already stopped
    }
  }
  
  /**
   * Play Sniper charge warning sound - rising tension
   */
  private playSniperChargeSound(): void {
    if (this.nightNumber < 3) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Rising warning tone
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 1.5);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.5);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 1.5);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play Sniper teleport sound - eerie digital glitch/shimmer
   */
  private playSniperTeleportSound(): void {
    if (!this.isSniperEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Eerie digital shimmer/glitch sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // High-pitched shimmer
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2000, audioContext.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 0.3);
      
      // Low rumble underneath
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(80, audioContext.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.3);
      osc2.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play Pyro match lighting sound - sharp click followed by fire fwoosh
   * Plays once when match is lit, does not loop.
   * LOUD - plays even when player is on cameras.
   */
  private playPyroMatchSound(): void {
    if (!this.isPyroEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      
      // === PART 1: Sharp click (match head striking) ===
      // Very short, bright click sound - LOUD
      const clickBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.03, audioContext.sampleRate);
      const clickData = clickBuffer.getChannelData(0);
      for (let i = 0; i < clickData.length; i++) {
        // Sharp attack with fast decay
        const t = i / audioContext.sampleRate;
        clickData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 150);
      }
      const clickSource = audioContext.createBufferSource();
      clickSource.buffer = clickBuffer;
      
      // Highpass to make it bright and clicky
      const clickFilter = audioContext.createBiquadFilter();
      clickFilter.type = 'highpass';
      clickFilter.frequency.value = 2500;
      
      const clickGain = audioContext.createGain();
      clickGain.gain.setValueAtTime(0.7, now); // LOUDER
      
      clickSource.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(audioContext.destination);
      
      clickSource.start(now);
      clickSource.stop(now + 0.03);
      
      // === PART 2: Fire fwoosh (ignition) ===
      // Rising then falling noise with warmth - LOUD
      const fwooshDuration = 0.8;
      const fwooshBuffer = audioContext.createBuffer(1, audioContext.sampleRate * fwooshDuration, audioContext.sampleRate);
      const fwooshData = fwooshBuffer.getChannelData(0);
      for (let i = 0; i < fwooshData.length; i++) {
        const t = i / fwooshData.length;
        // Envelope: quick rise, sustained, gradual fall
        const envelope = Math.sin(t * Math.PI) * (1 - t * 0.3);
        fwooshData[i] = (Math.random() * 2 - 1) * envelope;
      }
      const fwooshSource = audioContext.createBufferSource();
      fwooshSource.buffer = fwooshBuffer;
      
      // Bandpass filter for fire-like warmth
      const fwooshFilter = audioContext.createBiquadFilter();
      fwooshFilter.type = 'bandpass';
      fwooshFilter.frequency.value = 500;
      fwooshFilter.Q.value = 0.6;
      
      const fwooshGain = audioContext.createGain();
      fwooshGain.gain.setValueAtTime(0, now + 0.02);
      fwooshGain.gain.linearRampToValueAtTime(0.6, now + 0.1);  // LOUDER
      fwooshGain.gain.linearRampToValueAtTime(0.45, now + 0.4);
      fwooshGain.gain.exponentialRampToValueAtTime(0.001, now + fwooshDuration + 0.02);
      
      fwooshSource.connect(fwooshFilter);
      fwooshFilter.connect(fwooshGain);
      fwooshGain.connect(audioContext.destination);
      
      fwooshSource.start(now + 0.02); // Start right after click
      fwooshSource.stop(now + 0.02 + fwooshDuration);
      
      // Start the ambient crackling sound after the match ignites
      this.startPyroCracklingAmbient();
    } catch (e) {
      // Audio not available
    }
  }
  
  // Pyro ambient crackling sound nodes
  private pyroCracklingGain: GainNode | null = null;
  private pyroCracklingInterval: number | null = null;
  private pyroCracklingIntensity: number = 0; // 0-1, increases as time runs out
  private pyroCracklingLastInterval: number = 200; // Track current interval speed
  
  /**
   * Start low ambient crackling sound while match is lit
   */
  private startPyroCracklingAmbient(): void {
    // Stop any existing crackling first
    this.stopPyroCracklingAmbient();
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') return;
      const audioContext = this.sharedAudioContext;
      
      // Create master gain for crackling - starts quiet
      this.pyroCracklingGain = audioContext.createGain();
      this.pyroCracklingGain.gain.setValueAtTime(0.08, audioContext.currentTime); // Start low
      this.pyroCracklingGain.connect(audioContext.destination);
      
      // Reset intensity tracking
      this.pyroCracklingIntensity = 0;
      this.pyroCracklingLastInterval = 200;
      
      // Start the crackling loop
      this.schedulePyroCrackle();
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Schedule the next crackle sound with dynamic timing based on intensity
   */
  private schedulePyroCrackle(): void {
    if (!this.pyroCracklingGain || !this.sharedAudioContext) return;
    
    const audioContext = this.sharedAudioContext;
    
    // Check if Pyro's match is still lit
    if (!this.pyro || !this.pyro.isMatchLit()) {
      this.stopPyroCracklingAmbient();
      return;
    }
    
    // Calculate intensity based on escape time (0 = full time, 1 = about to die)
    const escapeRemaining = this.pyro.getEscapeTimeRemaining();
    const escapeTotal = GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME;
    this.pyroCracklingIntensity = 1 - (escapeRemaining / escapeTotal);
    
    // Update gain: starts at 0.08, ramps up to 0.5 as intensity increases
    const baseGain = 0.08;
    const maxGain = 0.5;
    const currentGain = baseGain + (maxGain - baseGain) * this.pyroCracklingIntensity;
    
    try {
      this.pyroCracklingGain.gain.setValueAtTime(currentGain, audioContext.currentTime);
    } catch (e) {
      // Gain node may have been disconnected
    }
    
    // Play a crackle
    this.playPyroCrackleSound();
    
    // Schedule next crackle with dynamic interval
    // Starts at 200ms, accelerates to 40ms as intensity increases
    const baseInterval = 200;
    const minInterval = 40;
    const interval = baseInterval - (baseInterval - minInterval) * this.pyroCracklingIntensity;
    this.pyroCracklingLastInterval = interval;
    
    // Add some randomness but less as intensity increases (more frantic)
    const randomness = 50 * (1 - this.pyroCracklingIntensity * 0.7);
    const nextInterval = interval + Math.random() * randomness;
    
    this.pyroCracklingInterval = window.setTimeout(() => {
      this.schedulePyroCrackle();
    }, nextInterval);
  }
  
  /**
   * Play a single crackle sound
   */
  private playPyroCrackleSound(): void {
    if (!this.pyroCracklingGain || !this.sharedAudioContext) return;
    
    try {
      const ctx = this.sharedAudioContext;
      const now = ctx.currentTime;
      
      // Random short crackle - duration decreases as intensity increases
      const baseDuration = 0.05 + Math.random() * 0.08;
      const duration = baseDuration * (1 - this.pyroCracklingIntensity * 0.3);
      
      const crackleBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleData.length; i++) {
        const env = Math.exp(-i / (crackleData.length * 0.3));
        crackleData[i] = (Math.random() * 2 - 1) * env;
      }
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = crackleBuffer;
      
      // Bandpass for fire crackle - pitch increases with intensity
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800 + Math.random() * 600 + this.pyroCracklingIntensity * 400;
      filter.Q.value = 2;
      
      crackleSource.connect(filter);
      filter.connect(this.pyroCracklingGain!);
      
      crackleSource.start(now);
      crackleSource.stop(now + duration);
    } catch (e) {
      // Audio context issue
    }
  }
  
  /**
   * Stop ambient crackling sound
   */
  private stopPyroCracklingAmbient(): void {
    if (this.pyroCracklingInterval) {
      clearTimeout(this.pyroCracklingInterval);
      this.pyroCracklingInterval = null;
    }
    if (this.pyroCracklingGain) {
      try {
        this.pyroCracklingGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.pyroCracklingGain = null;
    }
    this.pyroCracklingIntensity = 0;
  }
  
  /**
   * Play Pyro burning/crackling ambient sound (for camera viewing)
   * Creates a realistic fire crackle with pops and hisses
   */
  private playPyroBurningSound(): void {
    if (!this.isPyroEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const duration = 0.4;
      const now = audioContext.currentTime;
      
      // Create multiple short crackle bursts for fire effect
      for (let burst = 0; burst < 4; burst++) {
        const burstStart = now + burst * 0.08 + Math.random() * 0.05;
        const burstDuration = 0.03 + Math.random() * 0.04;
        
        // High-frequency crackle (short noise burst)
        const crackleBuffer = audioContext.createBuffer(1, audioContext.sampleRate * burstDuration, audioContext.sampleRate);
        const crackleData = crackleBuffer.getChannelData(0);
        for (let i = 0; i < crackleData.length; i++) {
          // Sharp attack, quick decay for crackle effect
          const envelope = Math.exp(-i / (crackleData.length * 0.2));
          crackleData[i] = (Math.random() * 2 - 1) * envelope;
        }
        const crackleSource = audioContext.createBufferSource();
        crackleSource.buffer = crackleBuffer;
        
        // Highpass filter for crisp crackle
        const highpass = audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 2000 + Math.random() * 3000;
        
        // Vary volume for each burst
        const crackleGain = audioContext.createGain();
        crackleGain.gain.setValueAtTime(0.08 + Math.random() * 0.1, burstStart);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, burstStart + burstDuration);
        
        crackleSource.connect(highpass);
        highpass.connect(crackleGain);
        crackleGain.connect(audioContext.destination);
        
        crackleSource.start(burstStart);
        crackleSource.stop(burstStart + burstDuration);
      }
      
      // Low rumbling base fire sound
      const baseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const baseData = baseBuffer.getChannelData(0);
      for (let i = 0; i < baseData.length; i++) {
        // Slow modulation for fire roar
        const mod = Math.sin(i / (audioContext.sampleRate * 0.05)) * 0.3 + 0.7;
        baseData[i] = (Math.random() * 2 - 1) * mod * 0.5;
      }
      const baseSource = audioContext.createBufferSource();
      baseSource.buffer = baseBuffer;
      
      // Bandpass for warm fire tone
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 400;
      bandpass.Q.value = 0.5;
      
      const baseGain = audioContext.createGain();
      baseGain.gain.setValueAtTime(0.06, now);
      baseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      baseSource.connect(bandpass);
      bandpass.connect(baseGain);
      baseGain.connect(audioContext.destination);
      
      baseSource.start(now);
      baseSource.stop(now + duration);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play Pyro airblast sound - sudden burst of compressed air
   */
  private playPyroReflectSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      
      // === Airblast: sudden burst of compressed air ===
      // Fast attack white noise with rapid decay - "PSSH!"
      const blastDuration = 0.25;
      const blastBuffer = audioContext.createBuffer(1, audioContext.sampleRate * blastDuration, audioContext.sampleRate);
      const blastData = blastBuffer.getChannelData(0);
      for (let i = 0; i < blastData.length; i++) {
        const t = i / blastData.length;
        // Sharp attack, quick decay
        const envelope = Math.exp(-t * 15) * (1 - Math.exp(-t * 100));
        blastData[i] = (Math.random() * 2 - 1) * envelope;
      }
      const blastSource = audioContext.createBufferSource();
      blastSource.buffer = blastBuffer;
      
      // Highpass filter for airy, hissy quality
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 2000;
      
      // Bandpass for body
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 4000;
      bandpass.Q.value = 0.5;
      
      const blastGain = audioContext.createGain();
      blastGain.gain.setValueAtTime(0.5, now);
      
      blastSource.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(blastGain);
      blastGain.connect(audioContext.destination);
      
      blastSource.start(now);
      blastSource.stop(now + blastDuration);
      
      // === Low thump for impact ===
      const thumpOsc = audioContext.createOscillator();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(80, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      
      const thumpGain = audioContext.createGain();
      thumpGain.gain.setValueAtTime(0.3, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      thumpOsc.connect(thumpGain);
      thumpGain.connect(audioContext.destination);
      
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.15);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play Medic Übercharge sound - rising electrical charge sound
   * Heard from anywhere to alert player that a new enemy has been Übered
   */
  private playUberChargeSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      const duration = 0.8;
      
      // === Rising electrical charge tone ===
      // Base tone that rises in pitch
      const chargeOsc = audioContext.createOscillator();
      chargeOsc.type = 'sawtooth';
      chargeOsc.frequency.setValueAtTime(150, now);
      chargeOsc.frequency.exponentialRampToValueAtTime(600, now + duration * 0.7);
      chargeOsc.frequency.setValueAtTime(600, now + duration * 0.7);
      
      // Harmonic overtone
      const harmOsc = audioContext.createOscillator();
      harmOsc.type = 'square';
      harmOsc.frequency.setValueAtTime(300, now);
      harmOsc.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.7);
      
      // Modulation for electrical crackle effect
      const modOsc = audioContext.createOscillator();
      modOsc.type = 'square';
      modOsc.frequency.setValueAtTime(30, now);
      modOsc.frequency.linearRampToValueAtTime(60, now + duration);
      
      const modGain = audioContext.createGain();
      modGain.gain.setValueAtTime(50, now);
      
      modOsc.connect(modGain);
      modGain.connect(chargeOsc.frequency);
      
      // Main envelope - builds up then quick release
      const mainGain = audioContext.createGain();
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      mainGain.gain.setValueAtTime(0.25, now + duration * 0.7);
      mainGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      // Harmonic envelope
      const harmGain = audioContext.createGain();
      harmGain.gain.setValueAtTime(0, now);
      harmGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
      harmGain.gain.setValueAtTime(0.1, now + duration * 0.7);
      harmGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      // Low-pass filter for warmth
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(3000, now + duration * 0.7);
      
      chargeOsc.connect(mainGain);
      harmOsc.connect(harmGain);
      mainGain.connect(filter);
      harmGain.connect(filter);
      filter.connect(audioContext.destination);
      
      chargeOsc.start(now);
      harmOsc.start(now);
      modOsc.start(now);
      
      chargeOsc.stop(now + duration);
      harmOsc.stop(now + duration);
      modOsc.stop(now + duration);
      
      // === Final "pop" at the end ===
      const popOsc = audioContext.createOscillator();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(800, now + duration * 0.65);
      popOsc.frequency.exponentialRampToValueAtTime(200, now + duration * 0.65 + 0.15);
      
      const popGain = audioContext.createGain();
      popGain.gain.setValueAtTime(0.3, now + duration * 0.65);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.65 + 0.15);
      
      popOsc.connect(popGain);
      popGain.connect(audioContext.destination);
      
      popOsc.start(now + duration * 0.65);
      popOsc.stop(now + duration * 0.65 + 0.2);
      
    } catch (e) {
      // Audio not available
    }
  }
  
  // Track if camera warning sound is currently playing
  private cameraWarningSoundPlaying: boolean = false;
  
  // Throttle for Pyro burning sound (prevent spam)
  private pyroBurningSoundThrottle: number = 0;
  
  /**
   * Play mounting camera watch warning sound - gets more intense as watch progress increases
   */
  private playCameraWatchWarningSound(progress: number): void {
    if (this.nightNumber < 3) return;
    if (this.cameraWarningSoundPlaying) return; // Don't overlap sounds
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      this.cameraWarningSoundPlaying = true;
      
      // Low rumbling warning sound that increases in pitch/volume
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Frequency increases with progress
      const baseFreq = 60 + progress * 100;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, audioContext.currentTime + 0.3);
      
      // Volume increases with progress
      const volume = 0.05 + progress * 0.15;
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.3);
      
      // Allow next sound after this one finishes
      setTimeout(() => {
        this.cameraWarningSoundPlaying = false;
      }, 350);
    } catch (e) {
      this.cameraWarningSoundPlaying = false;
    }
  }
  
  /**
   * Play denied/error sound - when player can't do an action (not enough metal)
   */
  private playDeniedSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Two descending tones - classic "denied" sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // First tone (higher)
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(400, audioContext.currentTime);
      osc1.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      
      // Second tone (lower, slightly delayed)
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(0, audioContext.currentTime);
      osc2.frequency.setValueAtTime(250, audioContext.currentTime + 0.15);
      osc2.frequency.setValueAtTime(200, audioContext.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime + 0.15);
      osc1.stop(audioContext.currentTime + 0.15);
      osc2.stop(audioContext.currentTime + 0.35);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play camera destroy sound - static burst and smash
   */
  private playCameraDestroySound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Static noise burst
      const bufferSize = audioContext.sampleRate * 0.3;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioContext.createGain();
      noise.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      noiseGain.gain.setValueAtTime(0.4, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      noise.start(audioContext.currentTime);
      
      // Low crunch
      const osc = audioContext.createOscillator();
      const oscGain = audioContext.createGain();
      osc.connect(oscGain);
      oscGain.connect(audioContext.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.15);
      oscGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not available
    }
  }
  
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
  
  private createEndScreen(): void {
    this.endScreen = this.add.container(0, 0);
    this.endScreen.setVisible(false);
    this.endScreen.setDepth(200);  // Above everything including camera UI
    
    // Dark overlay
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    this.endScreen.add(overlay);
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
    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.keyADown = true;
        e.preventDefault();
      }
      if (e.key === 'd' || e.key === 'D') {
        this.keyDDown = true;
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.keyADown = false;
      }
      if (e.key === 'd' || e.key === 'D') {
        this.keyDDown = false;
      }
    });
    
    // Also reset on blur (when window loses focus)
    window.addEventListener('blur', () => {
      this.keyADown = false;
      this.keyDDown = false;
    });
    
    console.log('[INPUT] Native DOM key listeners registered for A/D');
    
    // Prevent browser from capturing other game keys
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.TAB,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);
    
    // F - Toggle Wrangler
    keyboard.on('keydown-F', () => {
      if (this.gameStatus !== 'PLAYING') return;
      if (this.isPaused) return;
      if (this.isCameraMode) return; // Can't wrangler in camera mode
      if (!this.sentry.exists) return;
      
      this.sentry.isWrangled = !this.sentry.isWrangled;
      
      // Resume dispenser hum if turning wrangler off (no longer aiming)
      if (!this.sentry.isWrangled && !this.isTeleported) {
        this.sentry.aimedDoor = 'NONE';
        this.startDispenserHum();
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
      
      // Night 5+: Handle sapper removal - NO wrangler needed, NO cost!
      if (this.isSpyEnabled() && this.spy && this.spy.isSapping()) {
        this.sapperRemoveClicks++;
        this.sapperRemoveTimeout = 2000; // Reset timeout (2 seconds to press again)
        
        if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
          // Sapper removed!
          this.spy.removeSapper();
          this.sapperIndicator.setVisible(false);
          this.stopSapperSound();
          this.showAlert('SAPPER REMOVED!', 0x00ff00);
          this.sapperRemoveClicks = 0;
          this.playSound('fire');
        } else {
          this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
          this.playSound('fire');
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
   * Create mobile touch controls (only called on mobile devices)
   */
  private createMobileControls(): void {
    const width = 1280;
    const height = 720;
    
    // Main container for all mobile UI
    this.mobileUI = this.add.container(0, 0);
    this.mobileUI.setDepth(150); // Above game, below pause menu
    
    // ===== LEFT TOUCH ZONE (A key equivalent) =====
    this.mobileLeftZone = this.add.rectangle(0, height / 2, 180, height, 0x000000, 0);
    this.mobileLeftZone.setOrigin(0, 0.5);
    this.mobileLeftZone.setInteractive();
    
    // Left visual hint (subtle edge glow)
    this.mobileLeftHint = this.add.graphics();
    this.mobileLeftHint.fillStyle(0x4488ff, 0.15);
    this.mobileLeftHint.fillRect(0, 50, 15, height - 100);
    this.mobileLeftHint.setVisible(true);
    this.mobileUI.add(this.mobileLeftHint);
    
    // Left zone touch handlers
    const resetLeftZone = () => {
      this.keyADown = false;
      this.mobileLeftHint.clear();
      this.mobileLeftHint.fillStyle(0x4488ff, 0.15);
      this.mobileLeftHint.fillRect(0, 50, 15, height - 100);
    };
    this.mobileLeftZone.on('pointerdown', () => {
      if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isCameraMode || this.isTeleported) return;
      this.keyADown = true;
      this.mobileLeftHint.clear();
      this.mobileLeftHint.fillStyle(0x4488ff, 0.4);
      this.mobileLeftHint.fillRect(0, 50, 30, height - 100);
    });
    this.mobileLeftZone.on('pointerup', resetLeftZone);
    this.mobileLeftZone.on('pointerout', resetLeftZone);
    this.mobileLeftZone.on('pointercancel', resetLeftZone);
    
    // ===== RIGHT TOUCH ZONE (D key equivalent) =====
    this.mobileRightZone = this.add.rectangle(width, height / 2, 180, height, 0x000000, 0);
    this.mobileRightZone.setOrigin(1, 0.5);
    this.mobileRightZone.setInteractive();
    
    // Right visual hint
    this.mobileRightHint = this.add.graphics();
    this.mobileRightHint.fillStyle(0x4488ff, 0.15);
    this.mobileRightHint.fillRect(width - 15, 50, 15, height - 100);
    this.mobileRightHint.setVisible(true);
    this.mobileUI.add(this.mobileRightHint);
    
    // Right zone touch handlers
    const resetRightZone = () => {
      this.keyDDown = false;
      this.mobileRightHint.clear();
      this.mobileRightHint.fillStyle(0x4488ff, 0.15);
      this.mobileRightHint.fillRect(width - 15, 50, 15, height - 100);
    };
    this.mobileRightZone.on('pointerdown', () => {
      if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isCameraMode || this.isTeleported) return;
      this.keyDDown = true;
      this.mobileRightHint.clear();
      this.mobileRightHint.fillStyle(0x4488ff, 0.4);
      this.mobileRightHint.fillRect(width - 30, 50, 30, height - 100);
    });
    this.mobileRightZone.on('pointerup', resetRightZone);
    this.mobileRightZone.on('pointerout', resetRightZone);
    this.mobileRightZone.on('pointercancel', resetRightZone);
    
    // ===== FIRE BUTTON (appears near sentry when wrangled + aimed) =====
    this.mobileFireButton = this.add.container(width / 2, height - 320);
    const fireBg = this.add.rectangle(0, 0, 100, 50, 0x442222);
    fireBg.setStrokeStyle(3, 0xff4444);
    fireBg.setInteractive({ useHandCursor: true });
    const fireText = this.add.text(0, 0, 'FIRE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    fireBg.on('pointerdown', () => {
      if (this.gameStatus !== 'PLAYING' || this.isPaused || this.isCameraMode) return;
      if (!this.sentry.exists || !this.sentry.isWrangled) return;
      if (this.sentry.aimedDoor === 'NONE') return;
      this.fireWrangler();
    });
    fireBg.on('pointerover', () => fireBg.setFillStyle(0x663333));
    fireBg.on('pointerout', () => fireBg.setFillStyle(0x442222));
    this.mobileFireButton.add([fireBg, fireText]);
    this.mobileFireButton.setVisible(false);
    this.mobileUI.add(this.mobileFireButton);
    
    // ===== PAUSE BUTTON (top right corner) =====
    this.mobilePauseButton = this.add.container(width - 50, 50);
    const pauseBg = this.add.rectangle(0, 0, 80, 40, 0x1a2a3a, 0.9);
    pauseBg.setStrokeStyle(2, 0x3a5a7a);
    pauseBg.setInteractive({ useHandCursor: true });
    // Pause icon: two vertical bars using graphics
    const pauseIconGfx = this.add.graphics();
    pauseIconGfx.fillStyle(0x7799bb, 1);
    pauseIconGfx.fillRect(-12, -10, 8, 20); // Left bar
    pauseIconGfx.fillRect(4, -10, 8, 20);   // Right bar
    pauseBg.on('pointerdown', () => {
      if (this.gameStatus !== 'PLAYING') return;
      this.togglePause();
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
      if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
      if (this.isTeleported) return; // Can't use cameras when teleported
      this.toggleCameraMode();
    });
    this.mobileUI.add(this.mobileCameraButton);
    
    // ===== WRANGLER BUTTON (below pause/cam row) =====
    this.mobileWranglerButton = this.createMobileButton(width - 50, 100, 'WRANGLE', () => {
      if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
      if (this.isCameraMode) return;
      if (!this.sentry.exists) return;
      
      this.sentry.isWrangled = !this.sentry.isWrangled;
      
      // Resume dispenser hum if turning wrangler off (no longer aiming)
      if (!this.sentry.isWrangled && !this.isTeleported) {
        this.sentry.aimedDoor = 'NONE';
        this.startDispenserHum();
      }
      
      this.updateWranglerVisuals();
      this.updateHUD();
      this.updateMobileWranglerButton();
    });
    this.mobileUI.add(this.mobileWranglerButton);
    
    // ===== ACTION BUTTON (to the left of CAM button, visible in camera mode too) =====
    // Spacing: Pause at width-50, CAM at width-145 (95px apart), ACTION at width-240 (95px apart)
    this.mobileActionButton = this.add.container(width - 240, 50);
    
    const actionBg = this.add.rectangle(0, 0, 80, 40, 0x224422);
    actionBg.setStrokeStyle(2, 0x44aa44);
    actionBg.setInteractive({ useHandCursor: true });
    
    // Two-line text: action on top, cost below
    this.mobileActionText = this.add.text(0, -6, 'BUILD', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#88ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    this.mobileActionCostText = this.add.text(0, 8, '(100)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      color: '#88ff88',
    }).setOrigin(0.5);
    
    actionBg.on('pointerdown', () => {
      if (this.gameStatus !== 'PLAYING' || this.isPaused) return;
      if (this.isTeleported) return; // Can't build/repair/upgrade when teleported
      this.handleMobileAction();
    });
    
    actionBg.on('pointerover', () => actionBg.setFillStyle(0x336633));
    actionBg.on('pointerout', () => actionBg.setFillStyle(0x224422));
    
    this.mobileActionButton.add([actionBg, this.mobileActionText, this.mobileActionCostText]);
    this.mobileUI.add(this.mobileActionButton);
    
    // Initial update
    this.updateMobileUI();
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
    const container = this.add.container(x, y);
    
    const bg = this.add.rectangle(0, 0, 80, 40, 0x1a2a3a, 0.9);
    bg.setStrokeStyle(2, 0x3a5a7a);
    bg.setInteractive({ useHandCursor: true });
    
    const labelText = this.add.text(0, 0, label, {
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
   * Handle mobile action button press (context-sensitive)
   */
  private handleMobileAction(): void {
    // Check for sapper removal first
    if (this.isSpyEnabled() && this.spy && this.spy.isSapping()) {
      this.sapperRemoveClicks++;
      this.sapperRemoveTimeout = 2000;
      
      if (this.sapperRemoveClicks >= GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS) {
        this.spy.removeSapper();
        this.sapperIndicator.setVisible(false);
        this.stopSapperSound();
        this.showAlert('SAPPER REMOVED!', 0x00ff00);
        this.sapperRemoveClicks = 0;
        this.playSound('fire');
      } else {
        this.showAlert(`REMOVING SAPPER... (${this.sapperRemoveClicks}/${GAME_CONSTANTS.SPY_SAP_REMOVE_CLICKS})`, 0xffaa00);
        this.playSound('fire');
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
   * Update mobile UI state
   */
  private updateMobileUI(): void {
    if (!this.isMobile) return;
    
    // Update button states
    this.updateMobileWranglerButton();
    this.updateMobileActionButton();
    this.updateMobileCameraButton();
    this.updateMobileFireButton();
    
    // Show/hide zones based on mode
    const inIntelRoom = !this.isCameraMode && !this.isTeleported;
    this.mobileLeftHint.setVisible(inIntelRoom);
    this.mobileRightHint.setVisible(inIntelRoom);
    
    // Wrangler button: only in intel room with sentry
    this.mobileWranglerButton.setVisible(inIntelRoom && this.sentry.exists);
    
    // Action button: visible except when teleported (stays visible in camera mode)
    this.mobileActionButton.setVisible(!this.isTeleported);
    
    // Camera button: available except when teleported
    this.mobileCameraButton.setVisible(!this.isTeleported);
    
    // Pause button: always visible
    this.mobilePauseButton.setVisible(true);
  }
  
  /**
   * Update fire button visibility (shows when wrangled + aimed at door)
   */
  private updateMobileFireButton(): void {
    if (!this.isMobile || !this.mobileFireButton) return;
    
    const inIntelRoom = !this.isCameraMode && !this.isTeleported;
    const canFire = inIntelRoom && 
                    this.sentry.exists && 
                    this.sentry.isWrangled && 
                    this.sentry.aimedDoor !== 'NONE';
    
    this.mobileFireButton.setVisible(canFire);
  }
  
  /**
   * Update wrangler button appearance based on state
   */
  private updateMobileWranglerButton(): void {
    if (!this.isMobile || !this.mobileWranglerButton) return;
    
    const bg = this.mobileWranglerButton.list[0] as Phaser.GameObjects.Rectangle;
    const label = this.mobileWranglerButton.list[1] as Phaser.GameObjects.Text;
    
    if (this.sentry.isWrangled) {
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
  private updateMobileActionButton(): void {
    if (!this.isMobile || !this.mobileActionText) return;
    
    const bg = this.mobileActionButton.list[0] as Phaser.GameObjects.Rectangle;
    
    // Check for sapper - single line, no cost
    if (this.isSpyEnabled() && this.spy && this.spy.isSapping()) {
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
    
    // Normal sentry actions
    if (!this.sentry.exists) {
      const canBuild = this.metal >= GAME_CONSTANTS.BUILD_SENTRY_COST;
      this.mobileActionText.setText('BUILD');
      this.mobileActionCostText.setText(`(${GAME_CONSTANTS.BUILD_SENTRY_COST})`);
      const color = canBuild ? '#88ff88' : '#888888';
      this.mobileActionText.setColor(color);
      this.mobileActionCostText.setColor(color);
      bg.setFillStyle(canBuild ? 0x224422 : 0x222222);
      bg.setStrokeStyle(2, canBuild ? 0x44aa44 : 0x444444);
    } else if (this.sentry.hp < this.sentry.maxHp) {
      const repairCost = Math.ceil(Math.min(this.sentry.maxHp - this.sentry.hp, GAME_CONSTANTS.REPAIR_SENTRY_AMOUNT));
      const canRepair = this.metal >= repairCost;
      this.mobileActionText.setText('REPAIR');
      this.mobileActionCostText.setText(`(${repairCost})`);
      const color = canRepair ? '#ffaa44' : '#888888';
      this.mobileActionText.setColor(color);
      this.mobileActionCostText.setColor(color);
      bg.setFillStyle(canRepair ? 0x442a22 : 0x222222);
      bg.setStrokeStyle(2, canRepair ? 0xaa6644 : 0x444444);
    } else if (this.sentry.level < 3) {
      const canUpgrade = this.metal >= GAME_CONSTANTS.UPGRADE_SENTRY_COST;
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
  private updateMobileCameraButton(): void {
    if (!this.isMobile || !this.mobileCameraButton) return;
    
    const bg = this.mobileCameraButton.list[0] as Phaser.GameObjects.Rectangle;
    const label = this.mobileCameraButton.list[1] as Phaser.GameObjects.Text;
    
    if (this.isCameraMode) {
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
  
  /**
   * Create the pause menu UI
   */
  private createPauseMenu(): void {
    this.pauseMenu = this.add.container(0, 0);
    this.pauseMenu.setVisible(false);
    this.pauseMenu.setDepth(200);
    
    // Dark overlay
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
    this.pauseMenu.add(overlay);
    
    // Main pause panel (center)
    const panel = this.add.rectangle(640, 360, 400, 350, 0x1a1a2a);
    panel.setStrokeStyle(3, 0xff6600);
    this.pauseMenu.add(panel);
    
    // Title
    const title = this.add.text(640, 220, 'PAUSED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.pauseMenu.add(title);
    
    // Buttons Y position
    const buttonsStartY = 310;
    
    // Resume button
    const resumeBtn = this.add.rectangle(640, buttonsStartY, 250, 45, 0x224422);
    resumeBtn.setStrokeStyle(2, 0x44aa44);
    resumeBtn.setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerover', () => resumeBtn.setFillStyle(0x336633));
    resumeBtn.on('pointerout', () => resumeBtn.setFillStyle(0x224422));
    resumeBtn.on('pointerdown', () => this.togglePause());
    this.pauseMenu.add(resumeBtn);
    
    const resumeText = this.add.text(640, buttonsStartY, 'RESUME', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.pauseMenu.add(resumeText);
    
    // Restart button
    const restartBtn = this.add.rectangle(640, buttonsStartY + 55, 250, 45, 0x442222);
    restartBtn.setStrokeStyle(2, 0xaa4444);
    restartBtn.setInteractive({ useHandCursor: true });
    restartBtn.on('pointerover', () => restartBtn.setFillStyle(0x663333));
    restartBtn.on('pointerout', () => restartBtn.setFillStyle(0x442222));
    restartBtn.on('pointerdown', () => {
      this.stopDetectionSound();
      this.scene.restart();
    });
    this.pauseMenu.add(restartBtn);
    
    const restartText = this.add.text(640, buttonsStartY + 55, 'RESTART NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#ff8888',
    }).setOrigin(0.5);
    this.pauseMenu.add(restartText);
    
    // Main menu button
    const menuBtn = this.add.rectangle(640, buttonsStartY + 110, 250, 45, 0x222244);
    menuBtn.setStrokeStyle(2, 0x4444aa);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x333366));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x222244));
    menuBtn.on('pointerdown', () => {
      this.stopDetectionSound();
      this.scene.start('BootScene');
    });
    this.pauseMenu.add(menuBtn);
    
    const menuText = this.add.text(640, buttonsStartY + 110, 'MAIN MENU', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#8888ff',
    }).setOrigin(0.5);
    this.pauseMenu.add(menuText);
    
    // Hint background (bottom)
    const hintBg = this.add.rectangle(640, 620, 500, 55, 0x0a0a14, 0.95);
    hintBg.setStrokeStyle(1, 0x333344);
    this.pauseMenu.add(hintBg);
    
    // Hint text (random hint shown each pause)
    this.pauseHintText = this.add.text(640, 620, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#cccccc',
      fontStyle: 'italic',
      wordWrap: { width: 470 },
      align: 'center',
    }).setOrigin(0.5);
    this.pauseMenu.add(this.pauseHintText);
  }
  
  /**
   * Toggle pause state
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseMenu.setVisible(this.isPaused);
    
    if (this.isPaused) {
      // Pause the game
      this.stopDetectionSound();
      this.stopDispenserHum();
      this.physics?.pause();
      
      // Show a random hint
      const randomHint = this.pauseHints[Math.floor(Math.random() * this.pauseHints.length)];
      this.pauseHintText.setText(randomHint);
    } else {
      // Resume
      this.physics?.resume();
      // Resume dispenser hum if in Intel room (plays even with cameras up)
      if (!this.isTeleported) {
        this.startDispenserHum();
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
    const aDown = this.keyADown;
    const dDown = this.keyDDown;
    
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
      
      // Pause dispenser hum when aiming down a hallway (for focus)
      // Only pause if sentry actually exists - otherwise resume hum
      if (this.sentry.aimedDoor !== 'NONE' && this.sentry.exists) {
        this.stopDispenserHum();
      } else if (!this.isTeleported && !this.isPaused) {
        // Resume hum when no longer aiming (or sentry destroyed)
        this.startDispenserHum();
      }
    }
  }
  
  // ============================================
  // WRANGLER MECHANICS
  // ============================================
  
  private updateWranglerVisuals(): void {
    // Hide enemies by default
    this.scoutInDoorway.setVisible(false);
    this.soldierInDoorway.setVisible(false);
    
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
    
    if (!this.sentry.exists || !this.sentry.isWrangled) {
      this.aimBeam.setVisible(false);
      this.stopDetectionSound();
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
        this.drawUberGlow(this.uberGlowLeft, 120, 720 / 2 - 30);
        this.uberGlowLeft.setVisible(true);
        // Change door color to blue when Übered
        this.leftDoor.setFillStyle(0x112244);
      }
      
      // Show Pyro floating mask if Pyro is in left hall (Custom Night)
      // No sound here - only visual. Sound is for cameras only.
      const pyroInLeftHall = this.isPyroEnabled() && this.pyro && 
                             !this.pyro.isForceDespawned() && 
                             this.pyro.getHallway() === 'LEFT';
      if (this.pyroMaskLeft && pyroInLeftHall) {
        this.pyroMaskLeft.setVisible(true);
        enemyDetected = true;
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
        this.drawUberGlow(this.uberGlowRight, 1280 - 120, 720 / 2 - 30);
        this.uberGlowRight.setVisible(true);
        // Change door color to blue when Übered
        this.rightDoor.setFillStyle(0x112244);
      }
      
      // Show Pyro floating mask if Pyro is in right hall (Custom Night)
      // No sound here - only visual. Sound is for cameras only.
      const pyroInRightHall = this.isPyroEnabled() && this.pyro && 
                              !this.pyro.isForceDespawned() && 
                              this.pyro.getHallway() === 'RIGHT';
      if (this.pyroMaskRight && pyroInRightHall) {
        this.pyroMaskRight.setVisible(true);
        enemyDetected = true;
      }
    } else {
      // Aiming middle (NONE) - cone straight ahead
      this.aimBeam.fillStyle(0xff4400, 0.06);
      this.aimBeam.fillTriangle(sentryX, sentryY, sentryX - 80, 250, sentryX + 80, 250);
      
      this.aimBeam.lineStyle(3, 0xff0000, 0.6);
      this.aimBeam.lineBetween(sentryX, sentryY, sentryX, 250);
    }
    
    // Handle scary detection sound
    if (enemyDetected) {
      this.startDetectionSound();
    } else {
      this.stopDetectionSound();
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
    
    // Play/stop laser hum based on visibility
    if (laserVisible) {
      const progress = this.sniper.getChargeProgress();
      this.startSniperLaserHum(progress);
    } else {
      this.stopSniperLaserHum();
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
   * Start the sniper laser hum - electrical/ominous sound that intensifies with charge
   */
  private startSniperLaserHum(chargeProgress: number): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // If already playing, just update the intensity
      if (this.isPlayingSniperHum && this.sniperHumGain && this.sniperHumOscillator) {
        // Update volume and frequency based on charge progress
        const baseVolume = 0.03 + chargeProgress * 0.08;
        const baseFreq = 80 + chargeProgress * 60;
        this.sniperHumGain.gain.setTargetAtTime(baseVolume, audioContext.currentTime, 0.1);
        this.sniperHumOscillator.frequency.setTargetAtTime(baseFreq, audioContext.currentTime, 0.1);
        return;
      }
      
      // Create new hum sound
      this.sniperHumOscillator = audioContext.createOscillator();
      this.sniperHumGain = audioContext.createGain();
      
      // Add a second oscillator for richness
      const osc2 = audioContext.createOscillator();
      
      this.sniperHumOscillator.connect(this.sniperHumGain);
      osc2.connect(this.sniperHumGain);
      this.sniperHumGain.connect(audioContext.destination);
      
      // Low electrical hum
      this.sniperHumOscillator.type = 'sawtooth';
      this.sniperHumOscillator.frequency.value = 80 + chargeProgress * 60;
      
      // Higher harmonic for "electrical" feel
      osc2.type = 'sine';
      osc2.frequency.value = 240 + chargeProgress * 120;
      
      this.sniperHumGain.gain.value = 0.03 + chargeProgress * 0.08;
      
      this.sniperHumOscillator.start();
      osc2.start();
      this.isPlayingSniperHum = true;
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Stop the sniper laser hum
   */
  private stopSniperLaserHum(): void {
    if (!this.isPlayingSniperHum) return;
    
    try {
      if (this.sniperHumOscillator) {
        this.sniperHumOscillator.stop();
        this.sniperHumOscillator.disconnect();
        this.sniperHumOscillator = null;
      }
      if (this.sniperHumGain) {
        this.sniperHumGain.disconnect();
        this.sniperHumGain = null;
      }
    } catch (e) {
      // Already stopped
    }
    this.isPlayingSniperHum = false;
  }
  
  /**
   * Start the dispenser ambient hum - low continuous electrical hum
   */
  private startDispenserHum(): void {
    if (this.isPlayingDispenserHum) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Main gain node
      this.dispenserHumGain = audioContext.createGain();
      this.dispenserHumGain.gain.setValueAtTime(0.08, audioContext.currentTime);
      this.dispenserHumGain.connect(audioContext.destination);
      
      // Primary low hum (electrical transformer sound)
      this.dispenserHumOscillator = audioContext.createOscillator();
      this.dispenserHumOscillator.type = 'sine';
      this.dispenserHumOscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      this.dispenserHumOscillator.connect(this.dispenserHumGain);
      
      // Secondary harmonic for richness (higher pitch whir)
      this.dispenserHumOscillator2 = audioContext.createOscillator();
      this.dispenserHumOscillator2.type = 'triangle';
      this.dispenserHumOscillator2.frequency.setValueAtTime(200, audioContext.currentTime);
      
      const secondaryGain = audioContext.createGain();
      secondaryGain.gain.setValueAtTime(0.04, audioContext.currentTime);
      secondaryGain.connect(audioContext.destination);
      this.dispenserHumOscillator2.connect(secondaryGain);
      
      // Add subtle wobble to make it sound more organic
      const lfo = audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.3, audioContext.currentTime);
      const lfoGain = audioContext.createGain();
      lfoGain.gain.setValueAtTime(2, audioContext.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(this.dispenserHumOscillator.frequency);
      lfo.start();
      
      this.dispenserHumOscillator.start();
      this.dispenserHumOscillator2.start();
      this.isPlayingDispenserHum = true;
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Stop the dispenser ambient hum
   */
  private stopDispenserHum(): void {
    if (!this.isPlayingDispenserHum) return;
    
    try {
      if (this.dispenserHumOscillator) {
        this.dispenserHumOscillator.stop();
        this.dispenserHumOscillator.disconnect();
        this.dispenserHumOscillator = null;
      }
      if (this.dispenserHumOscillator2) {
        this.dispenserHumOscillator2.stop();
        this.dispenserHumOscillator2.disconnect();
        this.dispenserHumOscillator2 = null;
      }
      if (this.dispenserHumGain) {
        this.dispenserHumGain.disconnect();
        this.dispenserHumGain = null;
      }
    } catch (e) {
      // Already stopped
    }
    this.isPlayingDispenserHum = false;
  }
  
  /**
   * Play sapper sparking/buzzing sound (Night 5+)
   */
  private playSapperSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Create oscillators for electrical sparking sound
      this.sapperSoundGain = audioContext.createGain();
      this.sapperSoundGain.gain.setValueAtTime(0.15, audioContext.currentTime);
      this.sapperSoundGain.connect(audioContext.destination);
      
      // Main buzzing oscillator
      this.sapperSoundOscillator = audioContext.createOscillator();
      this.sapperSoundOscillator.type = 'sawtooth';
      this.sapperSoundOscillator.frequency.setValueAtTime(120, audioContext.currentTime);
      
      // Add modulation for sparking effect
      const modulator = audioContext.createOscillator();
      modulator.type = 'square';
      modulator.frequency.setValueAtTime(8, audioContext.currentTime);
      
      const modulatorGain = audioContext.createGain();
      modulatorGain.gain.setValueAtTime(30, audioContext.currentTime);
      
      modulator.connect(modulatorGain);
      modulatorGain.connect(this.sapperSoundOscillator.frequency);
      
      this.sapperSoundOscillator.connect(this.sapperSoundGain);
      
      this.sapperSoundOscillator.start();
      modulator.start();
      
    } catch (e) {
      console.log('Failed to play sapper sound:', e);
    }
  }
  
  /**
   * Stop sapper sound
   */
  private stopSapperSound(): void {
    try {
      if (this.sapperSoundOscillator) {
        this.sapperSoundOscillator.stop();
        this.sapperSoundOscillator.disconnect();
        this.sapperSoundOscillator = null;
      }
      if (this.sapperSoundGain) {
        this.sapperSoundGain.disconnect();
        this.sapperSoundGain = null;
      }
    } catch (e) {
      // Already stopped
    }
  }
  
  /**
   * Start the scary buzzing/detection sound when enemy is in lit doorway
   */
  private startDetectionSound(): void {
    if (this.isPlayingDetectionSound) return;
    
    try {
      this.detectionSoundContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Create an unsettling buzz/drone
      this.detectionOscillator = this.detectionSoundContext.createOscillator();
      const gainNode = this.detectionSoundContext.createGain();
      
      // Low frequency modulator for wobble effect
      const lfo = this.detectionSoundContext.createOscillator();
      const lfoGain = this.detectionSoundContext.createGain();
      
      lfo.frequency.value = 8; // Wobble speed
      lfoGain.gain.value = 30; // Wobble depth
      
      lfo.connect(lfoGain);
      lfoGain.connect(this.detectionOscillator.frequency);
      
      this.detectionOscillator.type = 'sawtooth';
      this.detectionOscillator.frequency.value = 80;
      
      this.detectionOscillator.connect(gainNode);
      gainNode.connect(this.detectionSoundContext.destination);
      
      gainNode.gain.value = 0.15;
      
      lfo.start();
      this.detectionOscillator.start();
      this.isPlayingDetectionSound = true;
    } catch (e) {
      console.log('Detection sound not available');
    }
  }
  
  /**
   * Stop the detection sound
   */
  private stopDetectionSound(): void {
    if (!this.isPlayingDetectionSound) return;
    
    try {
      if (this.detectionOscillator) {
        this.detectionOscillator.stop();
        this.detectionOscillator.disconnect();
        this.detectionOscillator = null;
      }
      if (this.detectionSoundContext) {
        this.detectionSoundContext.close();
        this.detectionSoundContext = null;
      }
    } catch (e) {
      // Ignore errors
    }
    this.isPlayingDetectionSound = false;
  }
  
  /**
   * Stop ALL game sounds - called on game over/victory
   */
  private stopAllGameSounds(): void {
    // Stop all individual sound types
    this.stopDetectionSound();
    this.stopSniperLaserHum();
    this.stopSapperSound();
    this.stopDemoEyeGlowSound();
    this.stopApproachGrowl();
    this.stopDispenserHum();
    this.stopPyroCracklingAmbient();
    
    // Force stop any oscillators that might still be running
    const oscillatorsToStop = [
      this.demoEyeGlowOscillator,
      this.sapperSoundOscillator,
      this.sniperHumOscillator,
      this.detectionOscillator,
      this.approachGrowlOsc,
      this.dispenserHumOscillator,
      this.dispenserHumOscillator2,
    ];
    
    for (const osc of oscillatorsToStop) {
      if (osc) {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Already stopped
        }
      }
    }
    
    // Null out all oscillator references
    this.demoEyeGlowOscillator = null;
    this.sapperSoundOscillator = null;
    this.sniperHumOscillator = null;
    this.detectionOscillator = null;
    this.approachGrowlOsc = null;
    this.dispenserHumOscillator = null;
    this.dispenserHumOscillator2 = null;
    
    // Null out gain nodes too
    this.demoEyeGlowGain = null;
    this.sapperSoundGain = null;
    this.sniperHumGain = null;
    this.approachGrowlGain = null;
    this.dispenserHumGain = null;
    this.pyroCracklingGain = null;
    
    // Close the shared audio context completely to stop ALL sounds
    if (this.sharedAudioContext) {
      try {
        this.sharedAudioContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.sharedAudioContext = null;  // Will be recreated when needed
    }
    
    // Also close the detection sound's separate audio context
    if (this.detectionSoundContext) {
      try {
        this.detectionSoundContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.detectionSoundContext = null;
    }
    
    // Reset all audio state flags
    this.isPlayingDetectionSound = false;
    this.isPlayingSniperHum = false;
    this.demoEyeGlowSoundPlaying = false;
  }
  
  private fireWrangler(): void {
    if (!this.sentry.exists || !this.sentry.isWrangled) return;
    if (this.sentry.aimedDoor === 'NONE') return; // Can't fire when not aiming at a door
    
    // Check cooldown (1 second between shots)
    if (this.wranglerCooldown > 0) {
      this.showAlert('COOLING DOWN...', 0xff6600);
      this.playDeniedSound();
      return;
    }
    
    // Check if we have enough metal to fire (always costs 50)
    if (this.metal < 50) {
      this.showAlert('NOT ENOUGH METAL TO FIRE!', 0xff0000);
      this.playDeniedSound();
      return;
    }
    
    // Deduct metal cost for firing
    this.metal -= 50;
    
    // Start cooldown
    this.wranglerCooldown = this.WRANGLER_COOLDOWN;
    
    // Visual feedback
    this.cameras.main.shake(100, 0.01);
    this.playSound('fire');
    
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
        this.playPyroReflectSound();
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
          this.showAlert('ÜBERED! CANNOT REPEL!', 0x4488ff);
          hitEnemy = true; // Still counts as hitting (spent metal)
        } else {
          this.scout.driveAway();
          this.showAlert('SCOUT REPELLED!', 0x00ff00);
          hitEnemy = true;
        }
      }
      // Check Demoman at left door (if enabled)
      if (this.isDemomanEnabled() && this.demoman.getChargeDoor() === 'LEFT' &&
          (this.demoman.currentNode === 'LEFT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0x4488ff);
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
          this.showAlert('ÜBERED! CANNOT REPEL!', 0x4488ff);
          hitEnemy = true;
        } else {
          this.soldier.driveAway();
          this.showAlert('SOLDIER REPELLED!', 0x00ff00);
          hitEnemy = true;
        }
      }
      // Check Demoman at right door (if enabled)
      if (this.isDemomanEnabled() && this.demoman.getChargeDoor() === 'RIGHT' &&
          (this.demoman.currentNode === 'RIGHT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN')) {
          this.showAlert('ÜBERED! CANNOT REPEL!', 0x4488ff);
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
        }
        // No alert for partial hits - the sniper aiming UI already shows shots remaining
        hitEnemy = true;
      }
    }

    // If we missed, show feedback
    if (!hitEnemy) {
      this.showAlert('FIRED! (-50 metal)', 0xffaa00);
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
  }
  
  private damageSentry(amount: number): void {
    if (!this.sentry.exists) return;
    
    this.sentry.hp -= amount;
    this.cameras.main.shake(200, 0.02);
    
    // Play rocket hit sound
    this.playSound('rocketHit');
    
    // Flash sentry red
    this.sentryBody.setFillStyle(0xff0000);
    this.time.delayedCall(200, () => {
      if (this.sentry.exists) {
        this.sentryBody.setFillStyle(0x4488bb); // Back to BLU team color
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
    
    this.sentryGraphic.setVisible(false);
    this.aimBeam.setVisible(false);
    
    // Hide any enemies shown in doorways (fixes Scout glitch)
    this.scoutInDoorway.setVisible(false);
    this.soldierInDoorway.setVisible(false);
    
    // Stop detection sound
    this.stopDetectionSound();
    
    // Resume dispenser hum if in Intel room (was paused for aiming)
    if (!this.isTeleported && !this.isPaused) {
      this.startDispenserHum();
    }
    
    // Reset door colors
    this.leftDoor.setFillStyle(0x000000);
    this.rightDoor.setFillStyle(0x000000);
    
    // Play sentry destroyed sound
    this.playSound('sentryDestroyed');
    
    this.showAlert('SENTRY DESTROYED!', 0xff0000);
    
    // Clear any active sapper (sentry is gone, so sapper is too)
    if (this.isSpyEnabled() && this.spy.isSapping()) {
      this.spy.removeSapper();
      this.sapperIndicator.setVisible(false);
      this.stopSapperSound();
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
  
  /**
   * Play a procedural sound effect using Web Audio API
   */
  private playSound(type: 'fire' | 'rocketHit' | 'sentryDestroyed'): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch (type) {
        case 'fire':
          // Sharp attack sound
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
          
        case 'rocketHit':
          // Explosion - balanced volume
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.4);
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
          
          // Bass thump
          const bassOsc = audioContext.createOscillator();
          const bassGain = audioContext.createGain();
          bassOsc.connect(bassGain);
          bassGain.connect(audioContext.destination);
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(50, audioContext.currentTime);
          bassOsc.frequency.exponentialRampToValueAtTime(25, audioContext.currentTime + 0.25);
          bassGain.gain.setValueAtTime(0.35, audioContext.currentTime);
          bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
          bassOsc.start(audioContext.currentTime);
          bassOsc.stop(audioContext.currentTime + 0.25);
          
          // Impact crack
          const crackOsc = audioContext.createOscillator();
          const crackGain = audioContext.createGain();
          crackOsc.connect(crackGain);
          crackGain.connect(audioContext.destination);
          crackOsc.type = 'square';
          crackOsc.frequency.setValueAtTime(150, audioContext.currentTime);
          crackOsc.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.1);
          crackGain.gain.setValueAtTime(0.25, audioContext.currentTime);
          crackGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          crackOsc.start(audioContext.currentTime);
          crackOsc.stop(audioContext.currentTime + 0.1);
          
          // Explosion noise
          const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
          const noiseData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
          }
          const noiseSource = audioContext.createBufferSource();
          const noiseGain = audioContext.createGain();
          noiseSource.buffer = noiseBuffer;
          noiseSource.connect(noiseGain);
          noiseGain.connect(audioContext.destination);
          noiseGain.gain.setValueAtTime(0.2, audioContext.currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          noiseSource.start(audioContext.currentTime);
          break;
          
        case 'sentryDestroyed':
          // Descending crash/explosion
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          
          // Add a second layer for more impact
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(100, audioContext.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(10, audioContext.currentTime + 0.6);
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.6);
          break;
      }
    } catch (e) {
      // Audio not supported, fail silently
      console.log('Audio not available');
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
    }
    
    // Destroy sentry if it exists
    if (this.sentry.exists) {
      this.showAlert('SENTRY DESTROYED BY ÜBER!', 0x4488ff);
      this.destroySentry();
    }
    
    // Notify Medic that the attack resolved - will pick new target next hour
    if (this.medic) {
      this.medic.onTargetAttackResolved();
    }
    
    console.log(`💉 ${enemyType} Über attack resolved - player escaped!`);
  }
  
  // ============================================
  // CAMERA SYSTEM
  // ============================================
  
  private toggleCameraMode(): void {
    if (this.isCameraMode) {
      // Exiting camera mode - restore wrangler state if it was on before
      this.isCameraMode = false;
      this.isCameraBooting = false;
      this.cameraBootTimer = 0;
      this.cameraUI.setVisible(false);
      if (this.wasWrangledBeforeCamera && this.sentry.exists) {
        this.sentry.isWrangled = true;
      }
    } else {
      // Entering camera mode - remember wrangler state and turn it off
      this.wasWrangledBeforeCamera = this.sentry.isWrangled;
      this.isCameraMode = true;
      this.cameraUI.setVisible(true);
      this.sentry.isWrangled = false;
      this.stopDetectionSound(); // Stop scary sound when viewing cameras
      
      // Start camera boot-up sequence (1 second delay)
      this.isCameraBooting = true;
      this.cameraBootTimer = 0;
      this.cameraBootOverlay.setVisible(true);
      
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
        
        // Also update destroyed text
        const destroyer = camState.destroyedBy === 'HEAVY' ? 'HEAVY' : 'SNIPER';
        this.cameraDestroyedText.setText(`-- ${destroyer} DESTROYED CAMERA --`);
        return;
      } else {
        this.cameraDestroyedOverlay.setVisible(false);
      }
    }
    
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
      if (!this.pyroBurningSoundThrottle || Date.now() - this.pyroBurningSoundThrottle > 800) {
        this.pyroBurningSoundThrottle = Date.now();
        this.playPyroBurningSound();
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
          this.playCameraWatchWarningSound(watchProgress);
        }
      } else {
        this.cameraWatchWarning.setVisible(false);
      }
    } else {
      this.cameraWatchWarning.setVisible(false);
    }
    
    // Build list of enemies present with their info
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
      // Check if Demoman is Übered - blue glow!
      const demoUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      enemies.push({ 
        type: 'DEMOMAN_BODY', 
        label: demoUbered ? 'DEMO(Ü)' : 'DEMO!', 
        color: demoUbered ? '#4488ff' : '#44ff44'  // Blue when Übered
      });
    }
    if (soldierAtCam) {
      // Check if Soldier is Übered - blue glow!
      const soldierUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('SOLDIER');
      enemies.push({ 
        type: 'SOLDIER', 
        label: soldierUbered ? 'SOLDIER(Ü)' : 'SOLDIER', 
        color: soldierUbered ? '#4488ff' : '#cc9966'  // Blue when Übered
      });
    }
    if (scoutAtCam) {
      // Check if Scout is Übered - blue glow!
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
    
    // Hide all enemy containers first
    containers.forEach(c => c.setVisible(false));
    this.cameraFeedEnemyEyeGlow.setVisible(false);
    this.cameraFeedDemoHead.setVisible(false);
    
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
        
        // Check if this enemy is Übered (for special blue glow)
        const isUbered = enemy.label.includes('(Ü)');
        
        // Draw appropriate silhouette with optional Über glow
        if (enemy.type === 'SNIPER') {
          this.drawSniperSilhouette(graphics, this.sniper.isCurrentlyLured());
        } else if (enemy.type === 'HEAVY') {
          this.drawHeavySilhouette(graphics, this.heavy.isCurrentlyLured());
        } else if (enemy.type === 'DEMOMAN_BODY') {
          this.drawEnemySilhouette(graphics, 'DEMOMAN_BODY', isUbered);
        } else if (enemy.type === 'SOLDIER') {
          this.drawEnemySilhouette(graphics, 'SOLDIER', isUbered);
        } else if (enemy.type === 'SCOUT') {
          this.drawEnemySilhouette(graphics, 'SCOUT', isUbered);
        }
        
        // Show Über label if enemy is Übered, otherwise hide labels
        if (isUbered) {
          label.setText('ÜBERED');
          label.setColor('#4488ff');
          label.setFontSize('14px');
        } else {
          label.setText('');  // Labels removed - use Extras screen to learn enemies
          label.setColor(enemy.color);
        }
        
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
      
      // Check if Demoman is Übered - draw with blue glow!
      const demoHeadUbered = demomanHeadAtCam && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      this.drawDemomanHead(enemyGraphics, demoHeadUbered);
      
      // Show ÜBERED label if Demoman is Übered
      if (demoHeadUbered) {
        enemyLabel.setText('ÜBERED');
        enemyLabel.setColor('#4488ff');
        enemyLabel.setFontSize('16px');
      } else {
        enemyLabel.setText('');
        enemyLabel.setColor('#44aa44');
      }
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
      
      // Check if Demoman is Übered - draw with blue glow!
      const demoHeadUbered = demomanHeadAtCam && this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
      this.drawDemomanHeadSmall(demoHeadGraphics, demoHeadUbered);
      
      // Show ÜBERED label if Demoman is Übered
      if (demoHeadUbered) {
        demoHeadLabel.setText('ÜBERED');
        demoHeadLabel.setColor('#4488ff');
        demoHeadLabel.setFontSize('12px');
      } else {
        demoHeadLabel.setText('');
        demoHeadLabel.setColor('#44aa44');
      }
      
      // Position demo head to the right of other enemies
      const demoHeadX = enemies.length === 1 ? 520 : (enemies.length === 2 ? 580 : 620);
      this.cameraFeedDemoHead.setPosition(demoHeadX, 400);
    } else if (enemies.length === 0) {
      this.cameraFeedDemoHead.setVisible(false);
    }
    
    // Add blue glow effect when Sniper is in range (if enabled)
    if (this.isSniperEnabled() && this.sniper.canShootIntelRoom() && !this.isTeleported) {
      // Sniper can see Intel from current position - add eerie blue glow
      // This is handled by updateSniperChargeVisual() for the Intel room view
    }
    
    // Randomly update static for realism
    if (Math.random() < 0.05) {
      this.updateCameraStatic();
    }
    
    // Update map node colors to show active lures
    this.updateMapNodeColors(selectedCam.node);
  }
  
  /**
   * Draw a smaller version of Demoman's head for secondary display
   * @param isUbered - If true, draws a bright blue Über glow around the head
   */
  private drawDemomanHeadSmall(graphics: Phaser.GameObjects.Graphics, isUbered: boolean = false): void {
    graphics.clear();
    
    // Draw Über glow if Demoman is Übered by Medic
    if (isUbered) {
      // Outer pulsing blue glow
      graphics.fillStyle(0x4488ff, 0.4);
      graphics.fillCircle(0, 0, 60);
      // Middle glow
      graphics.fillStyle(0x4488ff, 0.5);
      graphics.fillCircle(0, 0, 45);
      // Inner bright glow
      graphics.fillStyle(0x66aaff, 0.6);
      graphics.fillCircle(0, 0, 35);
    }
    
    // Shadow
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillEllipse(0, 35, 50, 15);
    
    // Head - smaller
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillCircle(0, 0, 30);
    
    // Beanie (dark blue/black)
    graphics.fillStyle(0x1a1a2a, 1);
    graphics.beginPath();
    graphics.arc(0, -5, 32, Math.PI, 0, false);
    graphics.closePath();
    graphics.fillPath();
    
    // Beanie rim
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillRect(-32, -7, 64, 5);
    
    // Beard
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillEllipse(0, 22, 35, 22);
    
    // Eyepatch
    graphics.fillStyle(0x111111, 1);
    graphics.fillCircle(12, -5, 12);
    graphics.fillRect(10, -22, 6, 18);
    
    // Eye socket / glow - use blue when Übered
    const eyeGlowColor = isUbered ? 0x4488ff : 0x00ff44;
    if (this.demoman.isEyeGlowing() && this.demoman.activeEye === 'LEFT') {
      graphics.fillStyle(eyeGlowColor, 0.8);
      graphics.fillCircle(-12, -5, 15);
      graphics.fillStyle(eyeGlowColor, 1);
      graphics.fillCircle(-12, -5, 8);
    } else if (isUbered) {
      // Blue aura in socket when Übered
      graphics.fillStyle(0x4488ff, 0.4);
      graphics.fillCircle(-12, -5, 12);
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(-12, -5, 8);
    } else {
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(-12, -5, 10);
    }
    
    if (this.demoman.isEyeGlowing() && this.demoman.activeEye === 'RIGHT') {
      graphics.fillStyle(eyeGlowColor, 0.6);
      graphics.fillCircle(12, -5, 14);
    } else if (isUbered) {
      // Blue glow visible through eyepatch when Übered
      graphics.fillStyle(0x4488ff, 0.3);
      graphics.fillCircle(12, -5, 10);
    }
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
  
  /**
   * Draw character model for jumpscare - reuses camera/gallery poses exactly
   */
  private drawJumpscareSilhouette(
    graphics: Phaser.GameObjects.Graphics,
    isScout: boolean,
    isSoldier: boolean,
    isDemoman: boolean,
    isHeavy: boolean,
    isSniper: boolean,
    isPyro: boolean = false
  ): void {
    graphics.clear();
    
    // Use the exact same drawing functions as camera/gallery - no extra overlays
    if (isPyro) {
      // Pyro floating mask - eerie gas mask with glowing eyes
      this.drawPyroMaskJumpscare(graphics);
    } else if (isScout) {
      this.drawEnemySilhouette(graphics, 'SCOUT');
    } else if (isSoldier) {
      this.drawEnemySilhouette(graphics, 'SOLDIER');
    } else if (isDemoman) {
      this.drawEnemySilhouette(graphics, 'DEMOMAN_BODY');
    } else if (isHeavy) {
      this.drawHeavySilhouette(graphics, false);
    } else if (isSniper) {
      this.drawSniperSilhouette(graphics, false);
    } else {
      // Default - generic figure
      graphics.fillStyle(0x444444, 1);
      graphics.fillCircle(0, -50, 30);
      graphics.fillStyle(0xff0000, 1);
      graphics.fillCircle(-10, -55, 8);
      graphics.fillCircle(10, -55, 8);
      graphics.fillStyle(0x444444, 1);
      graphics.fillRect(-35, -20, 70, 90);
    }
  }
  
  /**
   * Draw Pyro's floating mask for jumpscare - larger and more menacing
   */
  private drawPyroMaskJumpscare(graphics: Phaser.GameObjects.Graphics): void {
    // Dark background glow (fire aura)
    graphics.fillStyle(0xff4400, 0.3);
    graphics.fillCircle(0, 0, 80);
    graphics.fillStyle(0xff6600, 0.2);
    graphics.fillCircle(0, 0, 100);
    
    // Mask base - dark rubber/leather look
    graphics.fillStyle(0x222222, 1);
    graphics.fillEllipse(0, 0, 100, 120);
    
    // Mask shape - rounded bottom for filter area
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillEllipse(0, 30, 80, 60);
    
    // Eye lenses - large circular with eerie white glow
    graphics.fillStyle(0x111111, 1);
    graphics.fillCircle(-25, -15, 22);
    graphics.fillCircle(25, -15, 22);
    
    // Eye lens rims
    graphics.lineStyle(3, 0x333333, 1);
    graphics.strokeCircle(-25, -15, 22);
    graphics.strokeCircle(25, -15, 22);
    
    // Glowing white eyes - the signature Pyro stare
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(-25, -15, 12);
    graphics.fillCircle(25, -15, 12);
    
    // Inner eye glow
    graphics.fillStyle(0xffeecc, 0.8);
    graphics.fillCircle(-25, -15, 8);
    graphics.fillCircle(25, -15, 8);
    
    // Filter canister (center bottom of mask)
    graphics.fillStyle(0x2a2a2a, 1);
    graphics.fillCircle(0, 35, 25);
    graphics.lineStyle(2, 0x444444, 1);
    graphics.strokeCircle(0, 35, 25);
    
    // Filter ridges
    graphics.lineStyle(2, 0x333333, 1);
    for (let i = -15; i <= 15; i += 6) {
      graphics.beginPath();
      graphics.arc(0, 35, 20, 
        Phaser.Math.DegToRad(180 + i * 3), 
        Phaser.Math.DegToRad(180 + i * 3 + 30), false);
      graphics.strokePath();
    }
    
    // Straps (side of head)
    graphics.lineStyle(4, 0x333333, 1);
    graphics.beginPath();
    graphics.moveTo(-50, -10);
    graphics.lineTo(-60, -30);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(50, -10);
    graphics.lineTo(60, -30);
    graphics.strokePath();
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
    this.playDemomanBattleCry();
    console.log(`⚔️ Demoman at ${side} door!`);
  }
  
  private onDemomanChargeStart(side: 'LEFT' | 'RIGHT'): void {
    // Demoman has started charging - play distant battle cry
    this.playDemomanDistantCry();
    console.log(`🗡️ Demoman charge started toward ${side}!`);
  }
  
  /**
   * Play Demoman's battle cry when he reaches the door
   */
  private playDemomanBattleCry(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Scottish battle cry - low growl with harmonics
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioContext.destination);
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(100, audioContext.currentTime);
      osc1.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.3);
      osc1.frequency.linearRampToValueAtTime(80, audioContext.currentTime + 0.6);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(200, audioContext.currentTime);
      osc2.frequency.linearRampToValueAtTime(300, audioContext.currentTime + 0.3);
      osc2.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.4, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.7);
      osc2.stop(audioContext.currentTime + 0.7);
    } catch (e) {
      // Audio not available
    }
  }
  
  /**
   * Play distant cry when Demoman starts charging
   */
  private playDemomanDistantCry(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Filtered/distant version
      const osc = audioContext.createOscillator();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(180, audioContext.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not available
    }
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
    this.timeText.setText(`${displayHours} AM`); // No padding - "1 AM" not "01 AM"
    
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
      this.updateMobileUI();
    }
  }
  
  private gameOver(reason: string): void {
    if (this.gameStatus !== 'PLAYING') return;
    
    this.gameStatus = 'LOST';
    // Stop ALL sounds immediately
    this.stopAllGameSounds();
    console.log('GAME OVER:', reason);
    
    // Play jumpscare sound!
    this.playJumpscareSound();
    
    // Screen shake for impact
    this.cameras.main.shake(300, 0.03);
    
    // Determine which enemy killed the player
    const reasonLower = reason.toLowerCase();
    const isScout = reasonLower.includes('scout');
    const isDemoman = reasonLower.includes('demoman');
    const isHeavy = reasonLower.includes('heavy');
    const isSoldier = reasonLower.includes('soldier') || reasonLower.includes('breached');
    const isSniper = reasonLower.includes('snipe') || reasonLower.includes('sniper');
    const isPyro = reasonLower.includes('pyro') || reasonLower.includes('burned');
    
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
    this.drawJumpscareSilhouette(enemyGraphics, isScout, isSoldier, isDemoman, isHeavy, isSniper, isPyro);
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
  }
  
  private showGameOverScreen(reason: string): void {
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
    this.endScreen.add(overlay);
    
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
      this.scene.start('BootScene');
    });
    this.input.once('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
  
  private victory(): void {
    if (this.gameStatus !== 'PLAYING') return;
    
    this.gameStatus = 'WON';
    this.stopAllGameSounds(); // Stop ALL sounds
    this.playVictoryChime(); // Play triumphant sound
    console.log('VICTORY!');
    
    // Update HUD to show 06 AM (consistent with gameplay display)
    this.timeText.setText('06 AM');
    
    // Show end screen
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
    
    const title = this.add.text(640, 300, `NIGHT ${this.nightNumber} COMPLETE!`, {
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
    
    const menuPrompt = this.add.text(640, 580, 'SPACE or CLICK to return to menu', {
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
      this.scene.start('BootScene');
    });
    this.input.once('pointerdown', () => {
      this.scene.start('BootScene');
    });
  }
  
  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(_time: number, delta: number): void {
    if (this.gameStatus !== 'PLAYING') return;
    if (this.isPaused) return;
    
    // ---- UPDATE WRANGLER COOLDOWN ----
    if (this.wranglerCooldown > 0) {
      this.wranglerCooldown -= delta;
    }
    
    // ---- TIME PROGRESSION ----
    this.timeAccumulator += delta;
    if (this.timeAccumulator >= GAME_CONSTANTS.MS_PER_GAME_MINUTE) {
      this.timeAccumulator -= GAME_CONSTANTS.MS_PER_GAME_MINUTE;
      this.gameMinutes++;
      
      // Check for victory (6:00 AM = 360 minutes)
      if (this.gameMinutes >= 360) {
        this.victory();
        return;
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
    // Update Scout (if enabled)
    if (this.isScoutEnabled()) {
      const scoutResult = this.scout.update(delta);
      
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
    
    // Update Soldier (if enabled)
    if (this.isSoldierEnabled()) {
      const soldierResult = this.soldier.update(delta);
      
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
    
    // Update Demoman (if enabled)
    if (this.isDemomanEnabled()) {
      // Check if player is watching Demoman's head
      // Can watch on cameras OR if head is in Intel room (cameras down = watching it)
      // BUT destroyed cameras don't count as watching!
      let isWatchingHead = false;
      
      if (this.isCameraMode) {
        // Watching on camera - but only if camera is NOT destroyed
        const selectedCam = CAMERAS[this.selectedCamera];
        const camState = this.cameraStates.get(selectedCam.id);
        const cameraWorking = !camState || !camState.destroyed;
        
        if (cameraWorking) {
          isWatchingHead = this.demoman.isHeadAtCamera(selectedCam.node);
        }
        // If camera is destroyed, we can't see Demoman's head even if it's there
      } else {
        // Cameras down - if head is in Intel room, player is "watching" it
        isWatchingHead = this.demoman.isHeadInIntelRoom();
      }
      
      this.demoman.setBeingWatched(isWatchingHead);
      
      const demoResult = this.demoman.update(delta);
      
      // If Demoman's eye just lit (charge warning), evacuate Pyro from hallways
      if (demoResult.eyeJustLit && this.isPyroEnabled() && this.pyro && !this.pyro.isForceDespawned()) {
        this.pyro.onDemomanChargeStart();
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
      this.updateHeavyAndSniper(delta);
    }
    
    // Update teleport danger check (always runs, regardless of which enemies are enabled)
    this.updateTeleportDanger(delta);
  }
  
  /**
   * Update Heavy (Night 3+) and Sniper (Night 4+) enemies
   */
  private updateHeavyAndSniper(delta: number): void {
    const heavyEnabled = this.isHeavyEnabled();
    const sniperEnabled = this.isSniperEnabled();
    // Track if player is watching Heavy/Sniper on camera
    if (this.isCameraMode) {
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
          
          // If BOTH Heavy and Sniper are on the same camera, destruction time is HALVED (multiplier 2)
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
        this.playLureConsumedSound();
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
    
    // Update Heavy (if enabled)
    if (heavyEnabled) {
      const heavyResult = this.heavy.update(delta);
      
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
      
      const sniperResult = this.sniper.update(delta);
      
      if (sniperResult.destroyedCamera) {
        // Camera destruction is handled by callback
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
      // Pass game time to Spy for logging
      const hours24 = Math.floor(this.gameMinutes / 60);
      const minutes = Math.floor(this.gameMinutes % 60);
      this.spy.setGameTime(hours24, minutes);
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
        this.stopSapperSound();
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
      
      const pyroResult = this.pyro.update(delta, playerInIntel);
      
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
          this.stopPyroCracklingAmbient();
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
        this.stopPyroCracklingAmbient();
      }
    }
    
    // Update Medic (Custom Night only)
    if (this.isMedicEnabled() && this.medic && !this.medic.isForceDespawned()) {
      this.medic.update(delta);
    }
    
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
        this.playEnemyApproachSound();
      } else if (!enemyApproaching && this.enemyApproachingRoom) {
        // Enemy left the area - reset the warning so it can trigger again
        // But DON'T hide the escape warning yet - player still needs to leave
        // Just allow future enemies to re-trigger the alert
        console.log('Enemy left area, resetting approach detection');
        this.enemyApproachingRoom = false;
        this.escapeWarning.setVisible(false);
        this.roomDoorwayEyes.setVisible(false);
        this.stopApproachGrowl();
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
        this.updateApproachGrowl(this.teleportEscapeTimer);
        
        if (this.teleportEscapeTimer <= 0) {
          // Too late - player dies. Use the enemy that triggered the approach.
          this.stopApproachGrowl();
          
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
      this.stopApproachGrowl();
    }
  }
  
  /**
   * Handle camera destroyed by Heavy or Sniper
   */
  private onCameraDestroyed(node: NodeId, destroyedBy: 'HEAVY' | 'SNIPER'): void {
    // Find which camera corresponds to this node
    const camera = CAMERAS.find(cam => cam.node === node);
    if (!camera) return;
    
    const camState = this.cameraStates.get(camera.id);
    if (!camState) return;
    
    camState.destroyed = true;
    camState.destroyedUntil = Date.now() + GAME_CONSTANTS.CAMERA_REPAIR_TIME;
    camState.destroyedBy = destroyedBy;
    
    this.playCameraDestroySound();
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
      this.sentryBody.setFillStyle(0x6699dd); // Damaged (lighter blue)
    } else {
      this.sentryBody.setFillStyle(0x4488bb); // Healthy BLU
    }
    
    if (this.sentry.hp <= 0) {
      this.destroySentry();
      this.showAlert('SPY SAPPED YOUR SENTRY!', 0xff0000);
      if (this.spy) this.spy.removeSapper();
      this.sapperIndicator.setVisible(false);
      this.stopSapperSound();
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
    this.playPyroMatchSound();
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
      this.playSniperChargeSound();
    }
  }
  
  /**
   * Update Demoman head visual in Intel room
   */
  private updateDemomanHeadVisual(): void {
    if (!this.isDemomanEnabled()) {
      this.demomanHeadInRoom.setVisible(false);
      this.stopDemoEyeGlowSound();
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
      this.startDemoEyeGlowSound();
    } else {
      this.stopDemoEyeGlowSound();
    }
    
    // Update eye glow based on Demoman state
    // Check if Übered - use blue glow instead of green
    const isUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
    const glowColor = isUbered ? 0x4488ff : 0x00ff44;  // Blue when Übered, green otherwise
    
    this.demomanHeadEyeGlow.clear();
    if (eyeGlowing) {
      const eyeX = this.demoman.activeEye === 'LEFT' ? -10 : 10;
      // Glowing eye (blue when Übered, green otherwise)
      this.demomanHeadEyeGlow.fillStyle(glowColor, 0.6);
      this.demomanHeadEyeGlow.fillCircle(eyeX, -5, 15);
      this.demomanHeadEyeGlow.fillStyle(glowColor, 1);
      this.demomanHeadEyeGlow.fillCircle(eyeX, -5, 8);
      this.demomanHeadEyeGlow.fillStyle(0xffffff, 1);
      this.demomanHeadEyeGlow.fillCircle(eyeX - 2, -7, 2);
      
      // Add outer blue glow ring when Übered
      if (isUbered) {
        this.demomanHeadEyeGlow.fillStyle(0x4488ff, 0.2);
        this.demomanHeadEyeGlow.fillCircle(0, 0, 50);
      }
    } else if (isUbered && headVisibleInRoom) {
      // Even when not actively glowing, show blue Über aura around head
      this.demomanHeadEyeGlow.fillStyle(0x4488ff, 0.15);
      this.demomanHeadEyeGlow.fillCircle(0, 0, 45);
      this.demomanHeadEyeGlow.fillStyle(0x4488ff, 0.25);
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
    
    // Check if Demoman is Übered - use blue glow instead of green
    const isUbered = this.isMedicEnabled() && this.medic && this.medic.isEnemyUbered('DEMOMAN');
    const glowColor = isUbered ? 0x4488ff : 0x00ff44;  // Blue when Übered, green otherwise
    
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
          this.drawUberGlow(glowGraphics, doorX, 720 / 2 - 30);
          glowGraphics.setVisible(true);
        }
      }
    }
  }
}

