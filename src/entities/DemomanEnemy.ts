import Phaser from 'phaser';
import { 
  NodeId, 
  EnemyState,
  GAME_CONSTANTS,
  DEMOMAN_PATH_LEFT,
  DEMOMAN_PATH_RIGHT,
} from '../types';

/**
 * DemomanEnemy - The ghostly Demoman with his severed Eyelander head
 * 
 * Unique mechanics:
 * - His severed head appears on cameras or in the Intel room
 * - Head has two black eye holes normally (DORMANT state)
 * - When one eye glows green, his body spawns and rushes (CHARGING state)
 * - The glowing eye indicates which door he'll charge through
 * - Much faster than Scout - requires quick reactions
 * - Can be deterred by:
 *   - Wrangled sentry aimed at his door
 *   - Unwrangled sentry (destroys sentry)
 *   - Watching him on camera (like Foxy) - delays his charge
 * - After deterred, body disappears and head teleports to new location
 */
export class DemomanEnemy {
  private scene: Phaser.Scene;
  
  // State
  public state: EnemyState = 'DORMANT';
  public currentNode: NodeId = 'LOBBY'; // Where his body is (when charging)
  public headLocation: NodeId | 'INTEL_ROOM' = 'LOBBY'; // Where his head appears
  public activeEye: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE'; // Which eye is glowing
  
  // Path (set when charging starts)
  private path: NodeId[] = [];
  private pathIndex: number = 0;
  
  // Timers
  private dormantTimer: number = 0;
  private dormantDuration: number = 0; // Randomized each cycle
  private chargeWarningTimer: number = 0; // Time before charge starts after eye lights
  private chargeTimer: number = 0; // Movement timer during charge
  private attackTimer: number = 0; // Time at door before attacking
  private teleportTimer: number = 0; // Time before head teleports after deter
  private watchTimer: number = 0; // Time being watched on camera
  
  // Flags
  private hasEmittedDoorEvent: boolean = false;
  private isBeingWatched: boolean = false;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.reset();
  }
  
  /**
   * Reset Demoman to initial state
   */
  public reset(): void {
    this.state = 'DORMANT';
    this.activeEye = 'NONE';
    this.pathIndex = 0;
    this.hasEmittedDoorEvent = false;
    this.isBeingWatched = false;
    this.watchTimer = 0;
    this.chargeWarningTimer = 0;
    this.chargeTimer = 0;
    this.attackTimer = 0;
    this.teleportTimer = 0;
    
    // Randomize dormant duration
    this.dormantDuration = Phaser.Math.Between(
      GAME_CONSTANTS.DEMOMAN_DORMANT_MIN,
      GAME_CONSTANTS.DEMOMAN_DORMANT_MAX
    );
    this.dormantTimer = 0;
    
    // Teleport head to random location
    this.teleportHead();
  }
  
  /**
   * Teleport head to a random camera location or Intel room
   * Can appear at ANY camera location or in front of the player
   */
  private teleportHead(): void {
    const locations: (NodeId | 'INTEL_ROOM')[] = [
      'BRIDGE', 'LOBBY', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 
      'LEFT_HALL', 'RIGHT_HALL', 'INTEL_ROOM'
    ];
    
    // Pick a random location (different from current if possible)
    let newLocation = locations[Phaser.Math.Between(0, locations.length - 1)];
    if (locations.length > 1 && newLocation === this.headLocation) {
      newLocation = locations[(locations.indexOf(newLocation) + 1) % locations.length];
    }
    
    this.headLocation = newLocation;
    console.log(`🗡️ Demoman head teleported to ${this.headLocation}`);
  }
  
  /**
   * Called when player is watching Demoman on camera
   */
  public setBeingWatched(watched: boolean): void {
    this.isBeingWatched = watched;
    if (!watched) {
      this.watchTimer = 0;
    }
  }
  
  /**
   * Check if player is looking at Demoman's head location
   */
  public isHeadAtCamera(cameraNode: NodeId): boolean {
    return this.headLocation === cameraNode;
  }
  
  /**
   * Check if head is in Intel room (visible to player without camera)
   */
  public isHeadInIntelRoom(): boolean {
    return this.headLocation === 'INTEL_ROOM';
  }
  
  /**
   * Get which door Demoman is charging toward
   */
  public getChargeDoor(): 'LEFT' | 'RIGHT' | null {
    // Include ATTACKING state - we need to know the door even after he attacks
    if (this.state !== 'CHARGING' && this.state !== 'WAITING' && this.state !== 'ATTACKING') {
      return null;
    }
    return this.activeEye === 'LEFT' ? 'LEFT' : 'RIGHT';
  }
  
  /**
   * Main update loop
   */
  public update(delta: number): {
    reachedIntel: boolean;
    atDoorway: boolean;
    doorSide: 'LEFT' | 'RIGHT' | null;
    eyeJustLit: boolean;
    chargeStarted: boolean;
  } {
    const result = {
      reachedIntel: false,
      atDoorway: false,
      doorSide: null as 'LEFT' | 'RIGHT' | null,
      eyeJustLit: false,
      chargeStarted: false,
    };
    
    switch (this.state) {
      case 'DORMANT':
        // Head is sitting somewhere, waiting to activate
        // If being watched, the timer is FROZEN - watching keeps him dormant
        if (!this.isBeingWatched) {
          this.dormantTimer += delta;
        }
        
        if (this.dormantTimer >= this.dormantDuration) {
          // Eye lights up! Pick which eye (determines which door)
          this.activeEye = Phaser.Math.Between(0, 1) === 0 ? 'LEFT' : 'RIGHT';
          this.state = 'PATROLLING'; // Transitional state before charging
          this.chargeWarningTimer = 0;
          result.eyeJustLit = true;
          console.log(`👁️ Demoman's ${this.activeEye} eye lit up! Charging soon...`);
        }
        break;
        
      case 'PATROLLING':
        // Eye is glowing - this is the warning phase before charge
        // Once eye is glowing, watching does NOT stop him - he WILL charge
        this.chargeWarningTimer += delta;
        
        if (this.chargeWarningTimer >= GAME_CONSTANTS.DEMOMAN_CHARGE_WARNING) {
          // START THE CHARGE!
          this.startCharge();
          result.chargeStarted = true;
        }
        break;
        
      case 'CHARGING':
        // Body is rushing toward Intel at lightning speed
        this.chargeTimer += delta;
        
        if (this.chargeTimer >= GAME_CONSTANTS.DEMOMAN_CHARGE_SPEED) {
          this.chargeTimer = 0;
          this.moveAlongPath();
        }
        break;
        
      case 'WAITING':
        // At doorway, about to charge in
        result.atDoorway = true;
        result.doorSide = this.activeEye === 'LEFT' ? 'LEFT' : 'RIGHT';
        
        if (!this.hasEmittedDoorEvent) {
          this.hasEmittedDoorEvent = true;
          this.scene.events.emit('demomanAtDoor', this.activeEye);
          console.log(`⚔️ DEMOMAN AT ${this.activeEye} DOOR! Battle cry incoming!`);
        }
        
        this.attackTimer += delta;
        if (this.attackTimer >= GAME_CONSTANTS.DEMOMAN_CHARGE_ATTACK_DELAY) {
          this.state = 'ATTACKING';
        }
        break;
        
      case 'ATTACKING':
        result.reachedIntel = true;
        break;
        
      case 'DESPAWNED':
        // After being deterred, wait then teleport head
        this.teleportTimer += delta;
        if (this.teleportTimer >= GAME_CONSTANTS.DEMOMAN_HEAD_TELEPORT_DELAY) {
          this.reset();
        }
        break;
    }
    
    return result;
  }
  
  /**
   * Start the charge sequence
   */
  private startCharge(): void {
    // Set path based on which eye is glowing
    this.path = this.activeEye === 'LEFT' ? [...DEMOMAN_PATH_LEFT] : [...DEMOMAN_PATH_RIGHT];
    this.pathIndex = 0;
    this.currentNode = this.path[0];
    this.state = 'CHARGING';
    this.chargeTimer = 0;
    
    // Emit charge start event (for battle cry sound)
    this.scene.events.emit('demomanChargeStart', this.activeEye);
    console.log(`🗡️ DEMOMAN CHARGE! Heading ${this.activeEye}!`);
  }
  
  /**
   * Move along the charge path
   */
  private moveAlongPath(): void {
    if (this.pathIndex < this.path.length - 1) {
      this.pathIndex++;
      this.currentNode = this.path[this.pathIndex];
      
      console.log(`⚡ Demoman at ${this.currentNode}`);
      
      // Check if we've reached a doorway
      if (this.currentNode === 'LEFT_HALL' || this.currentNode === 'RIGHT_HALL') {
        this.state = 'WAITING';
        this.attackTimer = 0;
        this.hasEmittedDoorEvent = false;
      }
    }
  }
  
  /**
   * Deter Demoman - he retreats and head teleports INSTANTLY
   */
  public deter(): void {
    this.activeEye = 'NONE';
    this.hasEmittedDoorEvent = false;
    console.log(`🛡️ Demoman deterred! Head teleporting...`);
    // Instant reset - head teleports immediately
    this.reset();
  }
  
  /**
   * Check if Demoman is currently charging (body visible)
   */
  public isCharging(): boolean {
    return this.state === 'CHARGING' || this.state === 'WAITING' || this.state === 'ATTACKING';
  }
  
  /**
   * Check if eye is glowing (warning phase)
   */
  public isEyeGlowing(): boolean {
    return this.activeEye !== 'NONE' && (this.state === 'PATROLLING' || this.isCharging());
  }
  
  /**
   * Check if Demoman is active (not despawned)
   */
  public isActive(): boolean {
    return this.state !== 'DESPAWNED';
  }
  
  /**
   * Permanently despawn (for custom night)
   */
  public forceDespawn(): void {
    this.state = 'DESPAWNED';
  }
  
  /**
   * Get current state for debugging
   */
  public getDebugInfo(): string {
    return `Demo: ${this.state} | Head: ${this.headLocation} | Eye: ${this.activeEye} | Node: ${this.currentNode}`;
  }
  
  /**
   * Get attack timer progress (0-1) when in WAITING state
   * Used for visual effects (approaching glow -> body visible)
   */
  public getAttackProgress(): number {
    if (this.state !== 'WAITING') return 0;
    return Math.min(1, this.attackTimer / GAME_CONSTANTS.DEMOMAN_CHARGE_ATTACK_DELAY);
  }
  
  /**
   * Check if Demoman is in the "body visible" phase at the door (last 0.25s of 1.5s)
   * First 1.25s is glow phase, last 0.25s is body phase
   */
  public isInBodyPhase(): boolean {
    if (this.state !== 'WAITING') return false;
    return this.getAttackProgress() >= 0.833; // 83.3% = 1.25s of 1.5s
  }
}

