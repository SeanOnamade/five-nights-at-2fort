/**
 * MedicEnemy - Custom Night Enemy
 * 
 * A support enemy that makes other enemies invincible via Übercharge.
 * 
 * LORE: Medic was working with Engineer on a cure for the zombified mercenaries.
 * Engineer watched at night while Medic slept, and vice versa during the day.
 * When Medic turned, his Übercharge now makes enemies unstoppable.
 * 
 * MECHANICS:
 * - Medic is NEVER visible on cameras - only the Übered enemy has a blue glow
 * - Picks a random target (Scout, Soldier, or Demoman) at the start
 * - Stays with that target until their first attack resolves
 * - After the attack, Medic despawns and picks a new target next "hour" (60 seconds)
 * - Übered enemies CANNOT be repelled by sentries - player must teleport away
 * - When player teleports away from an Übered enemy attack:
 *   - The enemy retreats as if deterred
 *   - The sentry is destroyed (if it exists)
 * 
 * NOTE: Medic only targets Scout, Soldier, and Demoman (door-based attackers).
 * Heavy/Sniper have different mechanics (lures/headshots) that don't fit Über.
 */

import { NodeId, GAME_CONSTANTS } from '../types';

// Enemies that Medic can Übercharge
export type UberTarget = 'SCOUT' | 'SOLDIER' | 'DEMOMAN';

export class MedicEnemy {
  // Current state
  private _isActive: boolean = false;
  private hourTimer: number = 0;
  
  // Über target
  private _currentTarget: UberTarget | null = null;
  private _targetHasAttacked: boolean = false;
  
  // Callbacks
  private onTargetChangedCallback: ((target: UberTarget | null) => void) | null = null;
  private isEnemyValidCallback: ((target: UberTarget) => boolean) | null = null;
  
  // Available targets (set by GameScene based on which enemies are enabled)
  private availableTargets: UberTarget[] = [];
  
  // Waiting for a valid target to become available
  private _waitingForValidTarget: boolean = false;
  private validTargetCheckTimer: number = 0;
  private readonly VALID_TARGET_CHECK_INTERVAL: number = 500; // Check every 0.5 seconds
  
  constructor() {
    console.log('💉 Medic initialized (inactive until activated)');
  }
  
  /**
   * Activate Medic with the list of available targets
   * Called when custom night starts with Medic enabled
   */
  public activate(availableTargets: UberTarget[]): void {
    this.availableTargets = availableTargets;
    this._isActive = true;
    this.hourTimer = 0;
    this._targetHasAttacked = false;
    
    // Pick initial target
    this.pickNewTarget();
    
    console.log(`💉 Medic activated! Available targets: ${availableTargets.join(', ')}`);
  }
  
  /**
   * Deactivate Medic
   */
  public deactivate(): void {
    this._isActive = false;
    this._currentTarget = null;
    this._targetHasAttacked = false;
    console.log('💉 Medic deactivated');
  }
  
  /**
   * Set callback for when target changes
   */
  public setTargetChangedCallback(callback: (target: UberTarget | null) => void): void {
    this.onTargetChangedCallback = callback;
  }
  
  /**
   * Set callback to check if an enemy is valid for Über selection
   * Returns false if enemy is currently attacking, charging, or at the door
   */
  public setIsEnemyValidCallback(callback: (target: UberTarget) => boolean): void {
    this.isEnemyValidCallback = callback;
  }
  
  /**
   * Main update loop
   * @param delta Time elapsed since last frame (ms)
   */
  public update(delta: number): { targetChanged: boolean; newTarget: UberTarget | null } {
    const result = { targetChanged: false, newTarget: null as UberTarget | null };
    
    if (!this._isActive) {
      return result;
    }
    
    // If waiting for a valid target to become available, check periodically
    if (this._waitingForValidTarget) {
      this.validTargetCheckTimer += delta;
      
      if (this.validTargetCheckTimer >= this.VALID_TARGET_CHECK_INTERVAL) {
        this.validTargetCheckTimer = 0;
        this.pickNewTarget();
        
        // If we found a target, notify
        if (this._currentTarget && !this._waitingForValidTarget) {
          result.targetChanged = true;
          result.newTarget = this._currentTarget;
        }
      }
      return result;
    }
    
    // If target has attacked, wait for next hour to pick new target
    if (this._targetHasAttacked) {
      this.hourTimer += delta;
      
      if (this.hourTimer >= GAME_CONSTANTS.MEDIC_HOUR_INTERVAL) {
        this.hourTimer = 0;
        this._targetHasAttacked = false;
        this.pickNewTarget();
        result.targetChanged = true;
        result.newTarget = this._currentTarget;
      }
    }
    
    return result;
  }
  
  /**
   * Pick a new random target from available enemies
   * Filters out enemies that are currently attacking, charging, or at the door
   */
  private pickNewTarget(): void {
    if (this.availableTargets.length === 0) {
      this._currentTarget = null;
      this._waitingForValidTarget = false;
      console.log('💉 Medic has no available targets!');
      return;
    }
    
    // Filter to only enemies that are valid (not currently attacking/charging/at door)
    let validTargets = this.availableTargets;
    if (this.isEnemyValidCallback) {
      validTargets = this.availableTargets.filter(target => this.isEnemyValidCallback!(target));
    }
    
    if (validTargets.length === 0) {
      // No valid targets right now - wait and check again later
      this._currentTarget = null;
      this._waitingForValidTarget = true;
      this.validTargetCheckTimer = 0;
      console.log('💉 Medic waiting for a valid target (all are busy attacking)...');
      return;
    }
    
    // Pick random target from valid ones
    const randomIndex = Math.floor(Math.random() * validTargets.length);
    this._currentTarget = validTargets[randomIndex];
    this._waitingForValidTarget = false;
    
    console.log(`💉 Medic chose new target: ${this._currentTarget}`);
    
    if (this.onTargetChangedCallback) {
      this.onTargetChangedCallback(this._currentTarget);
    }
  }
  
  /**
   * Called when the Übered enemy's attack resolves (either kills player or is evaded)
   * Medic will wait for the next hour to pick a new target
   */
  public onTargetAttackResolved(): void {
    if (!this._isActive) return;
    
    console.log(`💉 Übered ${this._currentTarget}'s attack resolved. Waiting for next hour...`);
    this._targetHasAttacked = true;
    this._currentTarget = null;
    this.hourTimer = 0;
    
    if (this.onTargetChangedCallback) {
      this.onTargetChangedCallback(null);
    }
  }
  
  /**
   * Check if a specific enemy is currently Übered
   */
  public isEnemyUbered(enemyType: UberTarget): boolean {
    return this._isActive && this._currentTarget === enemyType && !this._targetHasAttacked;
  }
  
  /**
   * Get current Über target (or null if none)
   */
  public getCurrentTarget(): UberTarget | null {
    if (!this._isActive || this._targetHasAttacked) return null;
    return this._currentTarget;
  }
  
  /**
   * Check if Medic is active
   */
  public isActive(): boolean {
    return this._isActive;
  }
  
  /**
   * Check if Medic is waiting between targets (no current target)
   */
  public isWaitingForNextHour(): boolean {
    return this._isActive && this._targetHasAttacked;
  }
  
  /**
   * Check if Medic is waiting for a valid target to become available
   */
  public isWaitingForValidTarget(): boolean {
    return this._isActive && this._waitingForValidTarget;
  }
  
  /**
   * Get time until next target selection (for debugging)
   */
  public getTimeUntilNextTarget(): number {
    if (!this._targetHasAttacked) return 0;
    return Math.max(0, GAME_CONSTANTS.MEDIC_HOUR_INTERVAL - this.hourTimer);
  }
  
  /**
   * Update available targets (in case enemies are despawned/respawned)
   */
  public updateAvailableTargets(targets: UberTarget[]): void {
    this.availableTargets = targets;
    
    // If current target is no longer available, wait for next hour
    if (this._currentTarget && !targets.includes(this._currentTarget)) {
      console.log(`💉 Current target ${this._currentTarget} no longer available`);
      this.onTargetAttackResolved();
    }
  }
  
  /**
   * Force despawn Medic (for disabling in custom night)
   */
  private _forceDespawned: boolean = false;
  
  public forceDespawn(): void {
    this._forceDespawned = true;
    this._isActive = false;
    this._currentTarget = null;
    console.log('💉 Medic force despawned');
  }
  
  public isForceDespawned(): boolean {
    return this._forceDespawned;
  }
  
  /**
   * Get debug info
   */
  public getDebugInfo(): string {
    if (!this._isActive) return 'Medic: INACTIVE';
    if (this._waitingForValidTarget) {
      return 'Medic: WAITING FOR VALID TARGET';
    }
    if (this._targetHasAttacked) {
      return `Medic: WAITING (${(this.getTimeUntilNextTarget() / 1000).toFixed(1)}s)`;
    }
    return `Medic: ÜBERING ${this._currentTarget}`;
  }
}
