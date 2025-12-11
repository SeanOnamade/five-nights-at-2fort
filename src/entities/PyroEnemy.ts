/**
 * PyroEnemy - Custom Night Only Enemy
 * 
 * A ghostly, invisible threat with two alternating modes:
 * - ROOM Mode: Teleports rapidly between rooms. Invisible on cameras but emits
 *   burning/crackling sounds. Teleporting to Pyro's room = death. In hallways,
 *   a floating Pyro mask is visible with wrangler light. Firing sentry at Pyro
 *   in hallway = sentry destroyed (reflected attack).
 * - INTEL Mode: Has a chance to appear in Intel room (while player is there).
 *   Match igniting sound warns player. Must teleport away within 10 seconds or die.
 *   After player escapes, Pyro despawns and mode continues.
 * 
 * Pyro is meant to be a very tough, psychological horror enemy.
 */

import { NodeId, PyroMode, GAME_CONSTANTS } from '../types';

export class PyroEnemy {
  // Current mode and state
  private mode: PyroMode = 'ROOM';
  private modeTimer: number = 0;
  
  // Room mode properties
  public currentNode: NodeId = 'LOBBY';
  private teleportTimer: number = 0;
  
  // Intel mode properties
  private isInIntel: boolean = false;
  private intelSpawnTimer: number = 0;
  private escapeTimer: number = 0;
  private matchLit: boolean = false;
  
  // Callbacks
  private onMatchLitCallback: (() => void) | null = null;
  private onBurningCallback: ((node: NodeId) => void) | null = null;
  
  // All rooms Pyro can teleport to in Room mode (including hallways, excluding Intel)
  private static readonly TELEPORT_ROOMS: NodeId[] = [
    'LOBBY', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 'LEFT_HALL', 'RIGHT_HALL', 'BRIDGE'
  ];
  
  constructor() {
    // Start in Room mode at a random location
    this.mode = 'ROOM';
    this.teleportToRandomRoom();
    console.log(`🔥 Pyro initialized in ${this.mode} mode at ${this.currentNode}`);
  }
  
  /**
   * Set callback for when match is lit (Intel mode warning)
   */
  public setMatchLitCallback(callback: () => void): void {
    this.onMatchLitCallback = callback;
  }
  
  /**
   * Set callback for burning sound (when viewing Pyro's room on camera)
   */
  public setBurningCallback(callback: (node: NodeId) => void): void {
    this.onBurningCallback = callback;
  }
  
  /**
   * Main update loop
   * @param delta Time elapsed since last frame (ms)
   * @param playerInIntel Whether the player is currently in the Intel room
   * @returns Object with event flags
   */
  public update(delta: number, playerInIntel: boolean): {
    modeChanged: boolean;
    matchJustLit: boolean;
    playerMustEscape: boolean;
    escapeTimeRemaining: number;
    playerBurned: boolean;
  } {
    // Skip update if force despawned
    if (this._forceDespawned) {
      return {
        modeChanged: false,
        matchJustLit: false,
        playerMustEscape: false,
        escapeTimeRemaining: 0,
        playerBurned: false,
      };
    }
    
    const result = {
      modeChanged: false,
      matchJustLit: false,
      playerMustEscape: false,
      escapeTimeRemaining: 0,
      playerBurned: false,
    };
    
    // Mode toggle timer
    this.modeTimer += delta;
    if (this.modeTimer >= GAME_CONSTANTS.PYRO_MODE_TOGGLE_INTERVAL) {
      this.toggleMode();
      result.modeChanged = true;
    }
    
    // Handle current mode
    if (this.mode === 'ROOM') {
      // Teleport frequently in Room mode (unless frozen during player teleport)
      this.teleportTimer += delta;
      
      if (this.teleportTimer >= GAME_CONSTANTS.PYRO_ROOM_TELEPORT_INTERVAL) {
        this.teleportTimer = 0;
        // Only teleport if not frozen - prevents unfair race condition
        if (!this._teleportFrozen) {
          this.teleportToRandomRoom();
        }
      }
    } else {
      // INTEL mode
      if (this.matchLit) {
        // Match is lit - countdown to death
        this.escapeTimer += delta;
        result.playerMustEscape = true;
        result.escapeTimeRemaining = Math.max(0, GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME - this.escapeTimer);
        
        if (this.escapeTimer >= GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME) {
          // Player didn't escape in time - they burn!
          result.playerBurned = true;
        }
      } else if (playerInIntel && !this.isInIntel) {
        // Check if Pyro should appear in Intel
        this.intelSpawnTimer += delta;
        if (this.intelSpawnTimer >= GAME_CONSTANTS.PYRO_INTEL_CHECK_INTERVAL) {
          this.intelSpawnTimer = 0;
          
          // Roll for spawn chance
          if (Math.random() < GAME_CONSTANTS.PYRO_INTEL_SPAWN_CHANCE) {
            this.lightMatch();
            result.matchJustLit = true;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Toggle between ROOM and INTEL modes
   */
  private toggleMode(): void {
    this.modeTimer = 0;
    
    if (this.mode === 'ROOM') {
      this.mode = 'INTEL';
      this.isInIntel = false;
      this.matchLit = false;
      this.escapeTimer = 0;
      this.intelSpawnTimer = 0;
      console.log('🔥 Pyro switched to INTEL mode');
    } else {
      this.mode = 'ROOM';
      this.teleportTimer = 0;
      this.teleportToRandomRoom();
      console.log(`🔥 Pyro switched to ROOM mode at ${this.currentNode}`);
    }
  }
  
  /**
   * Teleport to a random room (Room mode)
   */
  private teleportToRandomRoom(): void {
    const availableRooms = PyroEnemy.TELEPORT_ROOMS.filter(r => r !== this.currentNode);
    this.currentNode = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    console.log(`🔥 Pyro teleported to ${this.currentNode}`);
  }
  
  /**
   * Light the match in Intel room (Intel mode)
   */
  private lightMatch(): void {
    this.matchLit = true;
    this.isInIntel = true;
    this.escapeTimer = 0;
    console.log('🔥 PYRO LIT A MATCH IN INTEL! Player must escape!');
    
    if (this.onMatchLitCallback) {
      this.onMatchLitCallback();
    }
  }
  
  /**
   * Called when player successfully escapes Intel during match lit phase
   */
  public onPlayerEscaped(): void {
    if (this.matchLit) {
      console.log('🔥 Player escaped Pyro! Pyro despawns from Intel.');
      this.matchLit = false;
      this.isInIntel = false;
      this.escapeTimer = 0;
      this.intelSpawnTimer = 0;
    }
  }
  
  /**
   * Check if Pyro is at a specific node (Room mode only)
   */
  public isAtNode(node: NodeId): boolean {
    return this.mode === 'ROOM' && this.currentNode === node;
  }
  
  /**
   * Check if Pyro is in a hallway (for visual/sentry interaction)
   */
  public isInHallway(): boolean {
    return this.mode === 'ROOM' && 
           (this.currentNode === 'LEFT_HALL' || this.currentNode === 'RIGHT_HALL');
  }
  
  /**
   * Get which hallway Pyro is in, if any
   */
  public getHallway(): 'LEFT' | 'RIGHT' | null {
    if (this.mode !== 'ROOM') return null;
    if (this.currentNode === 'LEFT_HALL') return 'LEFT';
    if (this.currentNode === 'RIGHT_HALL') return 'RIGHT';
    return null;
  }
  
  /**
   * Check if match is currently lit (Intel mode)
   */
  public isMatchLit(): boolean {
    return this.matchLit;
  }
  
  /**
   * Get current mode
   */
  public getMode(): PyroMode {
    return this.mode;
  }
  
  /**
   * Get escape time remaining (when match is lit)
   */
  public getEscapeTimeRemaining(): number {
    if (!this.matchLit) return 0;
    return Math.max(0, GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME - this.escapeTimer);
  }
  
  /**
   * Check if Pyro is currently active (always true for Pyro - he never truly despawns)
   */
  public isActive(): boolean {
    return true;
  }
  
  /**
   * Check if player should hear burning sound for a camera node
   * Returns true if Pyro is in that room in Room mode
   */
  public shouldPlayBurningSound(cameraNode: NodeId): boolean {
    return this.mode === 'ROOM' && this.currentNode === cameraNode;
  }
  
  /**
   * Force despawn Pyro (for disabling in custom night)
   */
  private _forceDespawned: boolean = false;
  
  public forceDespawn(): void {
    this._forceDespawned = true;
    console.log('🔥 Pyro force despawned');
  }
  
  public isForceDespawned(): boolean {
    return this._forceDespawned;
  }
  
  /**
   * Teleport freeze - prevents Pyro from teleporting during player teleport animation
   * This prevents the unfair situation where Pyro teleports into the player's destination
   * while the teleport animation is playing.
   */
  private _teleportFrozen: boolean = false;
  
  public freezeTeleport(): void {
    this._teleportFrozen = true;
    console.log('🔥 Pyro teleport frozen (player teleporting)');
  }
  
  public unfreezeTeleport(): void {
    this._teleportFrozen = false;
    console.log('🔥 Pyro teleport unfrozen');
  }
  
  public isTeleportFrozen(): boolean {
    return this._teleportFrozen;
  }
}

