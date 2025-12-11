import Phaser from 'phaser';
import { EnemyBase } from './EnemyBase';
import { SCOUT_PATH, GAME_CONSTANTS } from '../types';

/**
 * ScoutEnemy - Fast attacker that approaches from the left
 * 
 * Behavior:
 * - Spawns at LOBBY
 * - Path: LOBBY → STAIRCASE → LEFT_HALL → INTEL
 * - Moves quickly between nodes
 * - At LEFT_HALL (left doorway), waits briefly then attacks
 * - Can be driven away by wrangled sentry fire at left door
 * - If enters Intel with no sentry = Game Over
 * - If sentry present, triggers auto-defense (sentry destroyed, scout repelled)
 */
export class ScoutEnemy extends EnemyBase {
  // Scout-specific timing (fast mover)
  protected moveInterval = GAME_CONSTANTS.SCOUT_MOVE_INTERVAL;
  protected waitTime = GAME_CONSTANTS.SCOUT_WAIT_TIME;
  
  constructor(scene: Phaser.Scene) {
    super(scene, 'SCOUT', 'LOBBY', SCOUT_PATH);
  }
  
  /**
   * Called when Scout reaches the left doorway
   * Plays audio cue (laugh sound)
   */
  protected onReachDoorway(): void {
    super.onReachDoorway();
    // In a full implementation, play Scout's laugh sound here
    // For now, we'll trigger a visual cue in GameScene
    this.scene.events.emit('scoutAtDoor');
  }
}



