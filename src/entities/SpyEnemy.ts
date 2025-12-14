/**
 * SpyEnemy - Night 5 Enemy
 * 
 * A non-lethal saboteur that toggles between two states:
 * - DISGUISE: Appears on cameras impersonating another enemy
 * - SAPPING: Has a chance to sap the sentry when player teleports away
 * 
 * Spy never kills the player - pure psychological/mechanical sabotage.
 */

import { NodeId, SpyState, SpyDisguise, GAME_CONSTANTS } from '../types';

export class SpyEnemy {
  // Current state
  private spyState: SpyState = 'DISGUISE';
  private stateTimer: number = 0;
  
  // Disguise state properties
  private currentDisguise: SpyDisguise = 'SCOUT';
  public currentNode: NodeId = 'COURTYARD';
  private teleportTimer: number = 0;
  private fakeWatchTimer: number = 0;
  private isBeingWatched: boolean = false;
  
  // Sapping state properties
  private _isSapping: boolean = false;
  private sapDamageCallback: ((damage: number) => void) | null = null;
  
  // Valid rooms for Spy to appear (excludes Intel and hallways)
  private static VALID_ROOMS: NodeId[] = ['BRIDGE', 'COURTYARD', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL'];
  
  constructor() {
    // Start in a random state
    this.spyState = Math.random() < 0.5 ? 'DISGUISE' : 'SAPPING';
    this.pickNewDisguise();
    this.teleportToRandomRoom();
    console.log(`🕵️ Spy initialized in ${this.spyState} state, disguised as ${this.currentDisguise}`);
  }
  
  /**
   * Set callback for when sapper damages sentry
   */
  public setSapDamageCallback(callback: (damage: number) => void): void {
    this.sapDamageCallback = callback;
  }
  
  // Track game time for logging
  private gameTime: { hours: number; minutes: number } = { hours: 12, minutes: 0 };
  private lastLoggedSecond: number = -1; // For periodic debug logging
  
  /**
   * Set game time for logging purposes
   */
  public setGameTime(hours: number, minutes: number): void {
    this.gameTime = { hours, minutes };
  }
  
  private getTimeString(): string {
    const h = this.gameTime.hours === 0 ? 12 : this.gameTime.hours;
    const m = this.gameTime.minutes.toString().padStart(2, '0');
    return `${h}:${m}AM`;
  }
  
  /**
   * Main update loop
   */
  public update(delta: number): { stateChanged: boolean; sapDamage: number } {
    const result = { stateChanged: false, sapDamage: 0 };
    
    // Log every 10 seconds to confirm update is running
    const currentSecond = Math.floor(this.stateTimer / 10000);
    if (currentSecond !== this.lastLoggedSecond && currentSecond > 0) {
      this.lastLoggedSecond = currentSecond;
      console.log(`🕵️ [${this.getTimeString()}] Spy update running - state=${this.spyState}, stateTimer=${(this.stateTimer/1000).toFixed(1)}s, teleportTimer=${(this.teleportTimer/1000).toFixed(1)}s, at ${this.currentNode}`);
    }
    
    // State toggle timer
    this.stateTimer += delta;
    if (this.stateTimer >= GAME_CONSTANTS.SPY_STATE_TOGGLE_INTERVAL) {
      this.toggleState();
      result.stateChanged = true;
    }
    
    // Handle current state
    if (this.spyState === 'DISGUISE') {
      // Teleport around when in disguise mode
      this.teleportTimer += delta;
      if (this.teleportTimer >= GAME_CONSTANTS.SPY_TELEPORT_INTERVAL) {
        this.teleportTimer = 0;
        this.teleportToRandomRoom();
        console.log(`🕵️ [${this.getTimeString()}] Spy teleported to ${this.currentNode} (disguised as ${this.currentDisguise})`);
      }
      
      // Update fake watch timer if being watched and disguised as Heavy/Sniper
      if (this.isBeingWatched && (this.currentDisguise === 'HEAVY' || this.currentDisguise === 'SNIPER')) {
        this.fakeWatchTimer += delta * GAME_CONSTANTS.SPY_FAKE_WATCH_SPEED;
        if (this.fakeWatchTimer >= GAME_CONSTANTS.CAMERA_WATCH_DESTROY_TIME) {
          // Fake watch bar filled - reset it (nothing happens!)
          this.fakeWatchTimer = 0;
          console.log('🕵️ Spy fake watch bar filled - nothing happens!');
        }
      } else if (!this.isBeingWatched && this.fakeWatchTimer > 0) {
        // Decay fake watch timer when not being watched
        this.fakeWatchTimer -= delta * 0.5;
        if (this.fakeWatchTimer < 0) this.fakeWatchTimer = 0;
      }
    }
    
    // Sapper damage happens regardless of Spy's current state!
    // Once placed, it drains until removed
    if (this._isSapping) {
      const damage = (GAME_CONSTANTS.SPY_SAP_DAMAGE_RATE * delta) / 1000;
      result.sapDamage = damage;
      if (this.sapDamageCallback) {
        this.sapDamageCallback(damage);
      }
    }
    
    return result;
  }
  
  /**
   * Toggle between DISGUISE and SAPPING states
   * NOTE: Sapper persists even when switching states - only removed by player!
   */
  private toggleState(): void {
    this.stateTimer = 0;
    this.teleportTimer = 0; // Reset teleport timer on state change
    
    if (this.spyState === 'DISGUISE') {
      this.spyState = 'SAPPING';
      // Clear disguise-related state
      this.fakeWatchTimer = 0;
      console.log(`🕵️ [${this.getTimeString()}] Spy switched to SAPPING state`);
    } else {
      this.spyState = 'DISGUISE';
      this.pickNewDisguise();
      this.teleportToRandomRoom();
      // DO NOT clear sapper - it persists until player removes it!
      console.log(`🕵️ [${this.getTimeString()}] Spy switched to DISGUISE state as ${this.currentDisguise} at ${this.currentNode}${this._isSapping ? ' (sapper still active!)' : ''}`);
    }
  }
  
  /**
   * Pick a new random disguise
   */
  private pickNewDisguise(): void {
    const disguises: SpyDisguise[] = ['SCOUT', 'SOLDIER', 'DEMOMAN_HEAD', 'HEAVY', 'SNIPER'];
    this.currentDisguise = disguises[Math.floor(Math.random() * disguises.length)];
  }
  
  /**
   * Teleport to a random room
   */
  private teleportToRandomRoom(): void {
    const rooms = SpyEnemy.VALID_ROOMS.filter(r => r !== this.currentNode);
    this.currentNode = rooms[Math.floor(Math.random() * rooms.length)];
  }
  
  /**
   * Attempt to sap the sentry (called when player teleports away)
   * @returns true if sapper was placed
   */
  public attemptSap(): boolean {
    if (this.spyState !== 'SAPPING') {
      return false;
    }
    
    if (this._isSapping) {
      // Already sapping
      return false;
    }
    
    // Roll for sap chance
    if (Math.random() < GAME_CONSTANTS.SPY_SAP_CHANCE) {
      this._isSapping = true;
      console.log(`🕵️ [${this.getTimeString()}] SPY PLACED SAPPER ON SENTRY!`);
      return true;
    }
    
    console.log(`🕵️ [${this.getTimeString()}] Spy sap attempt failed (rolled > ${GAME_CONSTANTS.SPY_SAP_CHANCE * 100}% chance)`);
    return false;
  }
  
  /**
   * Remove the sapper from the sentry
   */
  public removeSapper(): void {
    this._isSapping = false;
    console.log(`🕵️ [${this.getTimeString()}] Sapper removed from sentry!`);
  }
  
  /**
   * Check if sapper is currently active
   */
  public isSapping(): boolean {
    return this._isSapping;
  }
  
  /**
   * Get current state
   */
  public getState(): SpyState {
    return this.spyState;
  }
  
  /**
   * Get current disguise
   */
  public getDisguise(): SpyDisguise {
    return this.currentDisguise;
  }
  
  /**
   * Check if Spy is at a specific camera location
   */
  public isAtCamera(node: NodeId): boolean {
    if (this.spyState !== 'DISGUISE') {
      return false;
    }
    return this.currentNode === node;
  }
  
  /**
   * Check if Spy is at a specific node (regardless of state)
   */
  public isAtNode(node: NodeId): boolean {
    return this.currentNode === node;
  }
  
  /**
   * Get fake watch progress (0-1) for Heavy/Sniper disguise
   */
  public getFakeWatchProgress(): number {
    if (this.currentDisguise !== 'HEAVY' && this.currentDisguise !== 'SNIPER') {
      return 0;
    }
    return Math.min(this.fakeWatchTimer / GAME_CONSTANTS.CAMERA_WATCH_DESTROY_TIME, 1);
  }
  
  /**
   * Set whether Spy is being watched on camera
   */
  public setBeingWatched(watched: boolean): void {
    this.isBeingWatched = watched;
  }
  
  /**
   * Check if Spy is currently being watched
   */
  public isCurrentlyWatched(): boolean {
    return this.isBeingWatched;
  }
  
  /**
   * Check if Spy is in disguise state
   */
  public isInDisguiseState(): boolean {
    return this.spyState === 'DISGUISE';
  }
  
  /**
   * Check if Spy is in sapping state
   */
  public isInSappingState(): boolean {
    return this.spyState === 'SAPPING';
  }
  
  /**
   * Get the camera node where Spy currently is (for display)
   */
  public getCameraNode(): NodeId | null {
    if (this.spyState === 'DISGUISE') {
      return this.currentNode;
    }
    return null;
  }
}

