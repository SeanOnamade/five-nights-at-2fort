import Phaser from 'phaser';
import { EnemyBase } from './EnemyBase';
import { 
  NodeId, 
  GAME_CONSTANTS,
  ROOM_ADJACENCY,
} from '../types';

/**
 * SniperEnemy - Night 4 enemy
 * 
 * Characteristics:
 * - Random teleportation between rooms (not a fixed path)
 * - Can kill player from hallways (headshot when in LEFT_HALL or RIGHT_HALL)
 * - Requires 2 wrangler shots to drive away
 * - Can be lured from anywhere (like Heavy)
 * - Destroys cameras if watched for too long
 * - Red laser beam visible in hallways without wrangler
 */
export class SniperEnemy extends EnemyBase {
  // Configuration
  protected moveInterval = GAME_CONSTANTS.SNIPER_TELEPORT_INTERVAL;
  protected waitTime = GAME_CONSTANTS.SNIPER_CHARGE_TIME; // Time to charge headshot

  // Camera watching tracking
  private watchTimer: number = 0;
  private isBeingWatched: boolean = false;
  private destroyCameraCallback: ((cameraNode: NodeId) => void) | null = null;

  // Headshot charge tracking
  private chargeTimer: number = 0;
  private isCharging: boolean = false;
  private chargeCallback: ((progress: number) => void) | null = null;

  // Two-shot mechanic
  private shotsRemaining: number = GAME_CONSTANTS.SNIPER_SHOTS_TO_REPEL;

  // Lure tracking
  private targetLureNode: NodeId | null = null;
  private isLured: boolean = false;

  // All rooms Sniper can teleport to (not INTEL, not halls for initial spawn)
  private static readonly TELEPORT_ROOMS: NodeId[] = [
    'LOBBY', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 'LEFT_HALL', 'RIGHT_HALL', 'BRIDGE'
  ];
  
  // Safe spawn rooms (no halls - prevents instant death at game start)
  private static readonly SPAWN_ROOMS: NodeId[] = [
    'LOBBY', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 'BRIDGE'
  ];
  
  // Teleport sound callback
  private teleportCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    // Start at a SAFE room (not in halls!)
    const startRoom = SniperEnemy.SPAWN_ROOMS[
      Math.floor(Math.random() * SniperEnemy.SPAWN_ROOMS.length)
    ];
    
    // No fixed path - Sniper teleports randomly
    super(scene, 'SNIPER', startRoom, [startRoom]);
  }
  
  /**
   * Set callback for when Sniper teleports (for sound effect)
   */
  public setTeleportCallback(callback: () => void): void {
    this.teleportCallback = callback;
  }

  /**
   * Set callback for when Sniper destroys a camera
   */
  public setDestroyCameraCallback(callback: (cameraNode: NodeId) => void): void {
    this.destroyCameraCallback = callback;
  }

  /**
   * Set callback for headshot charge progress
   */
  public setChargeCallback(callback: (progress: number) => void): void {
    this.chargeCallback = callback;
  }

  /**
   * Update Sniper's state
   */
  public update(delta: number): { 
    reachedIntel: boolean; 
    atDoorway: boolean;
    doorSide: 'LEFT' | 'RIGHT' | null;
    destroyedCamera: boolean;
    headshotReady: boolean;
    canShootIntel: boolean;
  } {
    const result = { 
      reachedIntel: false, 
      atDoorway: false,
      doorSide: null as 'LEFT' | 'RIGHT' | null,
      destroyedCamera: false,
      headshotReady: false,
      canShootIntel: this.canShootIntelRoom(),
    };

    // Handle camera watching/destruction
    // watchMultiplier is 2 if both Heavy and Sniper are on the same camera (halves time)
    if (this.isBeingWatched && this.state !== 'DESPAWNED') {
      // Timer increases when being watched
      this.watchTimer += delta * this.watchMultiplier;
      if (this.watchTimer >= GAME_CONSTANTS.CAMERA_WATCH_DESTROY_TIME) {
        // Sniper shoots out the camera!
        result.destroyedCamera = true;
        if (this.destroyCameraCallback) {
          this.destroyCameraCallback(this.currentNode);
        }
        this.watchTimer = 0;
        this.isBeingWatched = false;
      }
    } else if (this.watchTimer > 0 && this.state !== 'DESPAWNED') {
      // Timer slowly decays when NOT being watched (at half the rate it builds)
      // This makes quick camera flips dangerous!
      this.watchTimer -= delta * 0.5;
      if (this.watchTimer < 0) this.watchTimer = 0;
    }

    // Handle headshot charging when in hallway (can see Intel)
    if (this.canShootIntelRoom() && this.state !== 'DESPAWNED' && this.state !== 'LURED') {
      this.isCharging = true;
      this.chargeTimer += delta;
      
      // Report charge progress
      const progress = Math.min(this.chargeTimer / GAME_CONSTANTS.SNIPER_CHARGE_TIME, 1);
      if (this.chargeCallback) {
        this.chargeCallback(progress);
      }

      // Set door side when charging
      result.atDoorway = true;
      result.doorSide = this.currentNode === 'LEFT_HALL' ? 'LEFT' : 'RIGHT';

      if (this.chargeTimer >= GAME_CONSTANTS.SNIPER_CHARGE_TIME) {
        // Headshot ready!
        result.headshotReady = true;
      }
    } else {
      this.isCharging = false;
      this.chargeTimer = 0;
    }

    switch (this.state) {
      case 'PATROLLING':
        this.moveTimer += delta;
        if (this.moveTimer >= this.moveInterval) {
          this.moveTimer = 0;
          this.teleportToRandomRoom();
        }
        break;

      case 'LURED':
        // Move toward lure location (faster when lured)
        this.moveTimer += delta;
        if (this.moveTimer >= this.moveInterval * 0.5) { // Move twice as fast when lured
          this.moveTimer = 0;
          this.moveTowardLure();
        }
        break;

      case 'DESPAWNED':
        this.respawnTimer += delta;
        if (this.respawnTimer >= GAME_CONSTANTS.ENEMY_RESPAWN_DELAY) {
          this.respawn();
        }
        break;

      case 'DESTROYING_CAMERA':
        // Brief pause while destroying camera, then continue
        this.waitTimer += delta;
        if (this.waitTimer >= 1000) {
          this.state = this.isLured ? 'LURED' : 'PATROLLING';
          this.waitTimer = 0;
        }
        break;
    }

    return result;
  }

  /**
   * Teleport to a random room (Sniper's unique movement)
   */
  private teleportToRandomRoom(): void {
    // Pick a random room different from current
    const availableRooms = SniperEnemy.TELEPORT_ROOMS.filter(r => r !== this.currentNode);
    const newRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    
    this.currentNode = newRoom;
    console.log(`Sniper teleported to ${this.currentNode}`);
    
    // Play teleport sound
    if (this.teleportCallback) {
      this.teleportCallback();
    }
  }

  // Track if we've already logged reaching the lure
  private hasReachedLure: boolean = false;
  
  /**
   * Move toward lure location (navigate through adjacent rooms)
   */
  private moveTowardLure(): void {
    if (!this.targetLureNode) {
      // No lure, return to patrolling
      this.isLured = false;
      this.hasReachedLure = false;
      this.state = 'PATROLLING';
      return;
    }

    // Check if we've reached the lure
    if (this.currentNode === this.targetLureNode) {
      // Reached lure! Stay here while lure is active
      if (!this.hasReachedLure) {
        console.log(`Sniper reached lure at ${this.currentNode}`);
        this.hasReachedLure = true;
      }
      return;
    }

    // Find path toward lure through adjacent rooms
    const adjacent = ROOM_ADJACENCY[this.currentNode] || [];
    
    // If lure is adjacent, move directly to it
    if (adjacent.includes(this.targetLureNode)) {
      this.currentNode = this.targetLureNode;
      console.log(`Sniper moved to lure at ${this.currentNode}`);
      return;
    }

    // Otherwise, move to an adjacent room that gets us closer
    // Simple heuristic: prefer rooms that are adjacent to the target
    for (const room of adjacent) {
      const roomAdjacent = ROOM_ADJACENCY[room] || [];
      if (roomAdjacent.includes(this.targetLureNode)) {
        this.currentNode = room;
        console.log(`Sniper moved toward lure: ${this.currentNode}`);
        return;
      }
    }

    // If no clear path, just move to a random adjacent room (but NEVER to INTEL)
    const safeAdjacent = adjacent.filter(r => r !== 'INTEL');
    if (safeAdjacent.length > 0) {
      this.currentNode = safeAdjacent[Math.floor(Math.random() * safeAdjacent.length)];
      console.log(`Sniper moved randomly toward lure: ${this.currentNode}`);
    }
  }

  /**
   * Lure Sniper to a specific node - works from ANYWHERE (like Heavy)
   */
  public lure(targetNode: NodeId): boolean {
    // Sniper can be lured from anywhere when lure is playing
    // Only lure if not already lured and not despawned
    if (this.state !== 'DESPAWNED' && !this.isLured) {
      this.targetLureNode = targetNode;
      this.isLured = true;
      this.state = 'LURED';
      this.chargeTimer = 0; // Reset charge when lured - STOPS HIS ATTACK!
      this.isCharging = false;
      this.shotsRemaining = GAME_CONSTANTS.SNIPER_SHOTS_TO_REPEL; // Reset shots when lured!
      return true;
    }
    return false;
  }

  /**
   * Clear the current lure
   */
  public clearLure(): void {
    this.targetLureNode = null;
    this.isLured = false;
    this.hasReachedLure = false;
    this.state = 'PATROLLING';
    this.moveTimer = 0;
  }

  // Watch speed multiplier (2x if both Heavy and Sniper on same camera)
  private watchMultiplier: number = 1;
  
  /**
   * Set whether Sniper is being watched on camera
   * @param watched Whether being watched
   * @param multiplier Speed multiplier (2 if both Heavy and Sniper on same camera)
   */
  public setBeingWatched(watched: boolean, multiplier: number = 1): void {
    // Don't reset timer when starting to watch - let it continue from decay
    // Don't reset timer when stopping watch - let it decay naturally
    this.isBeingWatched = watched;
    this.watchMultiplier = multiplier;
  }
  
  /**
   * Get camera watch progress (0-1) - used for warning effects
   * Returns progress even when not actively watching (during decay)
   */
  public getWatchProgress(): number {
    return Math.min(this.watchTimer / GAME_CONSTANTS.CAMERA_WATCH_DESTROY_TIME, 1);
  }

  /**
   * Check if Sniper can shoot into Intel room from current position
   */
  public canShootIntelRoom(): boolean {
    // Sniper can shoot Intel from adjacent hallways
    return this.currentNode === 'LEFT_HALL' || this.currentNode === 'RIGHT_HALL';
  }

  /**
   * Get all rooms Sniper can currently see/shoot into
   */
  public getAdjacentRooms(): NodeId[] {
    return ROOM_ADJACENCY[this.currentNode] || [];
  }

  /**
   * Check if Sniper is currently charging a headshot
   */
  public isChargingHeadshot(): boolean {
    return this.isCharging;
  }

  /**
   * Get headshot charge progress (0-1)
   */
  public getChargeProgress(): number {
    return Math.min(this.chargeTimer / GAME_CONSTANTS.SNIPER_CHARGE_TIME, 1);
  }

  /**
   * Check if Sniper is currently being lured
   */
  public isCurrentlyLured(): boolean {
    return this.isLured;
  }

  /**
   * Get the node Sniper is being lured to
   */
  public getLureTarget(): NodeId | null {
    return this.targetLureNode;
  }

  /**
   * Get remaining shots needed to drive Sniper away
   */
  public getShotsRemaining(): number {
    return this.shotsRemaining;
  }

  /**
   * Get the door side Sniper is aiming from
   */
  public getAimingDoor(): 'LEFT' | 'RIGHT' | null {
    if (this.currentNode === 'LEFT_HALL') return 'LEFT';
    if (this.currentNode === 'RIGHT_HALL') return 'RIGHT';
    return null;
  }

  /**
   * Respawn Sniper at a safe room (not halls)
   */
  public respawn(): void {
    // Pick random SAFE spawn room (not halls - prevents unfair instant death)
    this.currentNode = SniperEnemy.SPAWN_ROOMS[
      Math.floor(Math.random() * SniperEnemy.SPAWN_ROOMS.length)
    ];
    
    this.state = 'PATROLLING';
    this.moveTimer = 0;
    this.waitTimer = 0;
    this.respawnTimer = 0;
    this.isLured = false;
    this.targetLureNode = null;
    this.watchTimer = 0;
    this.chargeTimer = 0;
    this.isCharging = false;
    this.shotsRemaining = GAME_CONSTANTS.SNIPER_SHOTS_TO_REPEL; // Reset shot counter!
    console.log(`Sniper respawned at ${this.currentNode}`);
    
    // Play teleport sound on respawn too
    if (this.teleportCallback) {
      this.teleportCallback();
    }
  }

  /**
   * Ward off Sniper with wrangler shot
   * Level 2/3 sentry = 1 shot to repel, Level 1 = 2 shots
   * Sniper STAYS IN THE SAME HALLWAY after first hit - must shoot again quickly!
   * Returns true if Sniper is fully driven away, false if more shots needed
   */
  public wardOff(sentryLevel: number = 1): boolean {
    // Level 2+ sentry does double damage (instant repel)
    const damage = sentryLevel >= 2 ? 2 : 1;
    this.shotsRemaining -= damage;
    this.chargeTimer = 0; // Reset charge on any hit - gives player another 4 seconds
    this.isCharging = false;
    
    console.log(`Sniper hit! (L${sentryLevel} sentry, -${damage}) ${this.shotsRemaining} shot(s) remaining`);
    
    if (this.shotsRemaining <= 0) {
      // Fully driven away - NOW he teleports away
      this.state = 'DESPAWNED';
      this.respawnTimer = 0;
      this.isLured = false;
      this.targetLureNode = null;
      console.log('Sniper driven away!');
      return true;
    }
    
    // Not driven away yet - STAYS IN SAME HALLWAY!
    // Charge will restart on next update cycle (player has 4 more seconds)
    console.log('Sniper staggers but holds position! Shoot again!');
    return false;
  }

  /**
   * Force despawn (used when lured far enough away)
   */
  public forceDespawn(): void {
    this.state = 'DESPAWNED';
    this.respawnTimer = 0;
    this.isLured = false;
    this.targetLureNode = null;
    this.chargeTimer = 0;
    this.isCharging = false;
    this.shotsRemaining = GAME_CONSTANTS.SNIPER_SHOTS_TO_REPEL;
  }

  /**
   * Check if Sniper is active (not despawned)
   */
  public isActive(): boolean {
    return this.state !== 'DESPAWNED';
  }
}
