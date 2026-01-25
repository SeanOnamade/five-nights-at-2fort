import Phaser from 'phaser';
import { EnemyBase } from './EnemyBase';
import { SOLDIER_PATH, GAME_CONSTANTS, EnemyState } from '../types';

/**
 * SoldierEnemy - Slow siege attacker that approaches from the right
 * 
 * Behavior:
 * - Spawns at GRATE
 * - Path: GRATE → SPIRAL → RIGHT_HALL → INTEL
 * - Moves slowly between nodes
 * - At RIGHT_HALL (right doorway), enters SIEGE mode if sentry exists:
 *   - Fires rockets at sentry (60 damage every 3 seconds)
 *   - Continues until sentry destroyed or Soldier driven away
 * - If no sentry when reaching RIGHT_HALL = immediate Game Over
 * - Can only be driven away by wrangled sentry fire at right door
 */
export class SoldierEnemy extends EnemyBase {
  // Soldier-specific timing (slow mover)
  protected moveInterval = GAME_CONSTANTS.SOLDIER_MOVE_INTERVAL;
  protected waitTime = Infinity; // Soldier doesn't auto-attack, he sieges
  
  // Siege state
  private rocketTimer: number = 0;
  private breachTimer: number = 0;
  private isBreaching: boolean = false;
  
  constructor(scene: Phaser.Scene) {
    super(scene, 'SOLDIER', 'GRATE', SOLDIER_PATH);
  }
  
  /**
   * Override update to handle siege behavior and breach delay
   */
  public update(delta: number): { 
    reachedIntel: boolean; 
    atDoorway: boolean;
    doorSide: 'LEFT' | 'RIGHT' | null;
    firedRocket?: boolean;
  } {
    const result = {
      ...super.update(delta),
      firedRocket: false
    };
    
    // Handle siege state rocket firing
    if (this.state === 'SIEGING') {
      this.rocketTimer += delta;
      if (this.rocketTimer >= GAME_CONSTANTS.ROCKET_INTERVAL) {
        this.rocketTimer = 0;
        result.firedRocket = true;
        this.scene.events.emit('soldierRocket');
      }
    }
    
    // Handle breach delay after sentry destroyed
    // Only process if not despawned (safety check)
    if (this.isBreaching && this.state !== 'DESPAWNED') {
      this.breachTimer += delta;
      if (this.breachTimer >= 3000) {  // 3 second delay
        this.isBreaching = false;
        this.state = 'ATTACKING';
        result.reachedIntel = true;  // Now he attacks
      }
    }
    
    return result;
  }
  
  /**
   * Called when Soldier reaches the right doorway
   */
  protected onReachDoorway(): void {
    super.onReachDoorway();
    // Soldier doesn't wait like Scout - he goes into siege mode
    // The game scene will check if sentry exists and handle accordingly
    this.scene.events.emit('soldierAtDoor');
  }
  
  /**
   * Start siege mode - called by GameScene when Soldier reaches door and sentry exists
   */
  public startSiege(): void {
    this.state = 'SIEGING' as EnemyState;
    this.rocketTimer = 0;
    console.log('Soldier entering siege mode - firing rockets!');
  }
  
  /**
   * Check if Soldier is currently sieging
   */
  public isSieging(): boolean {
    return this.state === 'SIEGING';
  }
  
  /**
   * Called when sentry is destroyed during siege
   * Soldier will start breach countdown (3 seconds)
   */
  public sentryDestroyed(): void {
    if (this.state === 'SIEGING') {
      this.startBreach();
    }
  }
  
  /**
   * Start breach countdown - called when reaching door with no sentry OR when sentry destroyed
   * Gives player 3 seconds to react (build sentry, etc.)
   */
  public startBreach(): void {
    this.isBreaching = true;
    this.breachTimer = 0;
    this.state = 'WAITING' as EnemyState;  // Visual state
    console.log('Soldier preparing to breach! 3 seconds...');
  }
  
  /**
   * Check if Soldier is currently breaching (countdown active)
   */
  public isBreachingIn(): boolean {
    return this.isBreaching;
  }
  
  /**
   * Override respawn to reset timers
   */
  protected respawn(): void {
    super.respawn();
    this.rocketTimer = 0;
    this.breachTimer = 0;
    this.isBreaching = false;
  }
  
  /**
   * Override driveAway to reset breach state
   * Critical fix: prevents Soldier from continuing breach countdown after being driven away
   */
  public driveAway(): void {
    super.driveAway();
    this.rocketTimer = 0;
    this.breachTimer = 0;
    this.isBreaching = false;
  }
}

