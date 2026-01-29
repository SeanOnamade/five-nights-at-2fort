import Phaser from 'phaser';
import { 
  NodeId, 
  EnemyType, 
  EnemyState, 
  GAME_CONSTANTS 
} from '../types';

/**
 * EnemyBase - Abstract base class for all enemies
 * 
 * Handles common enemy behavior:
 * - Node-based pathfinding
 * - State machine management
 * - Movement timing
 * - Respawn logic
 */
export abstract class EnemyBase {
  protected scene: Phaser.Scene;
  
  // Identity
  public readonly type: EnemyType;
  public readonly spawnNode: NodeId;
  protected path: NodeId[];
  
  // State
  public currentNode: NodeId;
  public state: EnemyState;
  protected pathIndex: number;
  
  // Timers (in ms)
  protected moveTimer: number;
  protected waitTimer: number;
  protected respawnTimer: number;
  
  // Track if attack has been reported (to avoid spamming reachedIntel every frame)
  private hasReportedAttack: boolean = false;
  
  // Freeze movement when player is teleporting (prevents unfair deaths)
  private _movementFrozen: boolean = false;
  
  // Configuration (override in subclasses)
  protected abstract moveInterval: number;
  protected abstract waitTime: number;
  
  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    spawnNode: NodeId,
    path: NodeId[]
  ) {
    this.scene = scene;
    this.type = type;
    this.spawnNode = spawnNode;
    this.path = path;
    
    // Initialize at spawn
    this.currentNode = spawnNode;
    this.pathIndex = 0;
    this.state = 'PATROLLING';
    this.moveTimer = 0;
    this.waitTimer = 0;
    this.respawnTimer = 0;
  }
  
  /**
   * Update the enemy state - called each frame
   * @param delta - Time elapsed since last frame (ms)
   * @returns Object with flags for game events
   */
  public update(delta: number): { 
    reachedIntel: boolean; 
    atDoorway: boolean;
    doorSide: 'LEFT' | 'RIGHT' | null;
  } {
    const result = { 
      reachedIntel: false, 
      atDoorway: false,
      doorSide: null as 'LEFT' | 'RIGHT' | null
    };
    
    switch (this.state) {
      case 'PATROLLING':
        // Don't move if frozen (player is teleporting)
        if (!this._movementFrozen) {
          this.moveTimer += delta;
          if (this.moveTimer >= this.moveInterval) {
            this.moveTimer = 0;
            this.moveToNextNode();
          }
        }
        break;
        
      case 'WAITING':
        result.atDoorway = true;
        result.doorSide = this.getDoorSide();
        this.waitTimer += delta;
        if (this.waitTimer >= this.waitTime) {
          this.state = 'ATTACKING';
        }
        break;
        
      case 'ATTACKING':
        // Only report reachedIntel ONCE (not every frame)
        if (!this.hasReportedAttack) {
          result.reachedIntel = true;
          this.hasReportedAttack = true;
        }
        break;
        
      case 'DESPAWNED':
        this.respawnTimer += delta;
        if (this.respawnTimer >= GAME_CONSTANTS.ENEMY_RESPAWN_DELAY) {
          this.respawn();
        }
        break;
        
      case 'SIEGING':
        // Handled in SoldierEnemy subclass
        result.atDoorway = true;
        result.doorSide = 'RIGHT';
        break;
    }
    
    return result;
  }
  
  /**
   * Move to the next node in the path
   */
  protected moveToNextNode(): void {
    if (this.pathIndex < this.path.length - 1) {
      this.pathIndex++;
      this.currentNode = this.path[this.pathIndex];
      
      // Check if we've reached a doorway
      if (this.currentNode === 'LEFT_HALL' || this.currentNode === 'RIGHT_HALL') {
        this.state = 'WAITING';
        this.waitTimer = 0;
        this.onReachDoorway();
      }
    }
  }
  
  /**
   * Called when enemy reaches their doorway - override for custom behavior
   */
  protected onReachDoorway(): void {
    // Play sound cue, show warning, etc.
    console.log(`${this.type} reached doorway at ${this.currentNode}!`);
  }
  
  /**
   * Get which door side this enemy approaches from
   */
  public getDoorSide(): 'LEFT' | 'RIGHT' | null {
    if (this.currentNode === 'LEFT_HALL') return 'LEFT';
    if (this.currentNode === 'RIGHT_HALL') return 'RIGHT';
    return null;
  }
  
  /**
   * Drive the enemy away - they retreat and will respawn
   */
  public driveAway(): void {
    this.state = 'DESPAWNED';
    this.respawnTimer = 0;
    this.hasReportedAttack = false;  // Reset for next attack
    console.log(`${this.type} driven away! Will respawn in ${GAME_CONSTANTS.ENEMY_RESPAWN_DELAY}ms`);
  }
  
  /**
   * Respawn the enemy at their starting position
   */
  protected respawn(): void {
    this.currentNode = this.spawnNode;
    this.pathIndex = 0;
    this.state = 'PATROLLING';
    this.moveTimer = 0;
    this.waitTimer = 0;
    this.respawnTimer = 0;
    this.hasReportedAttack = false;  // Reset for next attack
    console.log(`${this.type} respawned at ${this.spawnNode}`);
  }
  
  /**
   * Check if enemy is currently active (not despawned)
   */
  public isActive(): boolean {
    return this.state !== 'DESPAWNED';
  }
  
  /**
   * Check if enemy is at a specific node
   */
  public isAtNode(node: NodeId): boolean {
    return this.currentNode === node && this.isActive();
  }
  
  /**
   * Permanently despawn enemy (won't respawn) - used for custom night
   */
  public forceDespawn(): void {
    this.state = 'DESPAWNED';
    this.respawnTimer = -999999; // Will never reach respawn threshold
  }
  
  /**
   * Freeze movement (used when player is teleporting to prevent unfair deaths)
   */
  public freezeMovement(): void {
    this._movementFrozen = true;
  }
  
  /**
   * Unfreeze movement (player finished teleporting)
   */
  public unfreezeMovement(): void {
    this._movementFrozen = false;
  }
  
  /**
   * Check if movement is currently frozen
   */
  public isMovementFrozen(): boolean {
    return this._movementFrozen;
  }
}

