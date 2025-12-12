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
  private transitionTimer: number = 0;  // Timer for mode transition cooldown
  private pendingMode: 'ROOM' | 'INTEL' = 'INTEL';  // Mode to switch to after transition
  
  // Room mode properties
  public currentNode: NodeId = 'LOBBY';
  private teleportTimer: number = 0;
  private lightExposureTimer: number = 0;  // Time player has been shining light on Pyro in hallway
  private blockedHallway: 'LEFT' | 'RIGHT' | null = null;  // Hallway being lit by player (can't teleport there)
  
  // Intel mode properties
  private isInIntel: boolean = false;
  private intelSpawnTimer: number = 0;
  private escapeTimer: number = 0;
  private matchLit: boolean = false;
  private escapeCooldown: number = 0;  // Cooldown after player escapes
  
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
    
    // Mode toggle timer (only counts when not transitioning)
    if (this.mode !== 'TRANSITIONING') {
      this.modeTimer += delta;
      if (this.modeTimer >= GAME_CONSTANTS.PYRO_MODE_TOGGLE_INTERVAL) {
        this.startModeTransition();
        result.modeChanged = true;
      }
    }
    
    // Handle current mode
    if (this.mode === 'TRANSITIONING') {
      // Pyro is despawned during transition
      this.transitionTimer += delta;
      if (this.transitionTimer >= GAME_CONSTANTS.PYRO_MODE_TRANSITION_TIME) {
        this.completeTransition();
      }
    } else if (this.mode === 'ROOM') {
      // In hallways, Pyro stays indefinitely until player shines light on him
      if (this.isInHallway()) {
        // Don't auto-teleport from hallways - player must use wrangler light
        // Light exposure is tracked via setBeingLit() called from GameScene
      } else {
        // Normal room teleportation
        this.teleportTimer += delta;
        
        if (this.teleportTimer >= GAME_CONSTANTS.PYRO_ROOM_TELEPORT_INTERVAL) {
          this.teleportTimer = 0;
          // Only teleport if not frozen - prevents unfair race condition
          if (!this._teleportFrozen) {
            this.teleportToRandomRoom();
          }
        }
      }
    } else {
      // INTEL mode
      
      // Tick down escape cooldown
      if (this.escapeCooldown > 0) {
        this.escapeCooldown -= delta;
      }
      
      if (this.matchLit) {
        // Match is lit - countdown to death
        this.escapeTimer += delta;
        result.playerMustEscape = true;
        result.escapeTimeRemaining = Math.max(0, GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME - this.escapeTimer);
        
        if (this.escapeTimer >= GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME) {
          // Player didn't escape in time - they burn!
          result.playerBurned = true;
        }
      } else if (playerInIntel && !this.isInIntel && this.escapeCooldown <= 0) {
        // Check if Pyro should appear in Intel (only if cooldown is over)
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
   * Start transition between modes (enters cooldown/despawn state)
   */
  private startModeTransition(): void {
    // Determine which mode we're going to
    if (this.mode === 'ROOM') {
      this.pendingMode = 'INTEL';
    } else {
      this.pendingMode = 'ROOM';
    }
    
    // Enter transition state
    this.mode = 'TRANSITIONING';
    this.transitionTimer = 0;
    this.modeTimer = 0;
    
    // Clear any active state from previous mode
    this.matchLit = false;
    this.isInIntel = false;
    this.lightExposureTimer = 0;
    
    console.log(`🔥 Pyro entering transition (despawned for 10s), will become ${this.pendingMode} mode`);
  }
  
  /**
   * Complete transition and enter new mode
   */
  private completeTransition(): void {
    if (this.pendingMode === 'INTEL') {
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
   * Respects blocked hallways (player is shining light there)
   */
  public teleportToRandomRoom(): void {
    // Filter out current room and any blocked hallway
    let availableRooms = PyroEnemy.TELEPORT_ROOMS.filter(r => r !== this.currentNode);
    
    // Don't teleport into a hallway the player is actively lighting
    if (this.blockedHallway === 'LEFT') {
      availableRooms = availableRooms.filter(r => r !== 'LEFT_HALL');
    } else if (this.blockedHallway === 'RIGHT') {
      availableRooms = availableRooms.filter(r => r !== 'RIGHT_HALL');
    }
    
    // Safety check - if all rooms blocked somehow, just pick any
    if (availableRooms.length === 0) {
      availableRooms = PyroEnemy.TELEPORT_ROOMS.filter(r => r !== this.currentNode);
    }
    
    this.currentNode = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    console.log(`🔥 Pyro teleported to ${this.currentNode}`);
  }
  
  /**
   * Set which hallway is currently blocked (player shining light there)
   * Pyro won't teleport into a blocked hallway
   */
  public setBlockedHallway(hallway: 'LEFT' | 'RIGHT' | null): void {
    this.blockedHallway = hallway;
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
      console.log('🔥 Player escaped Pyro! Pyro despawns from Intel. Cooldown started.');
      this.matchLit = false;
      this.isInIntel = false;
      this.escapeTimer = 0;
      this.intelSpawnTimer = 0;
      // Start cooldown so Pyro doesn't immediately attack again
      this.escapeCooldown = GAME_CONSTANTS.PYRO_INTEL_ESCAPE_COOLDOWN;
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
   * Update light exposure when player is shining wrangler at Pyro in hallway
   * @param isBeingLit Whether player is currently shining light on Pyro's hallway
   * @param delta Time elapsed since last frame (ms)
   * @returns true if Pyro was driven away by the light
   */
  public updateLightExposure(isBeingLit: boolean, delta: number): boolean {
    if (!this.isInHallway()) {
      this.lightExposureTimer = 0;
      return false;
    }
    
    if (isBeingLit) {
      this.lightExposureTimer += delta;
      
      if (this.lightExposureTimer >= GAME_CONSTANTS.PYRO_HALLWAY_LIGHT_TIME) {
        // Player has shone light on Pyro long enough - drive him away!
        console.log('🔥 Pyro driven away by wrangler light!');
        this.lightExposureTimer = 0;
        this.teleportToNonHallway();
        return true;
      }
    } else {
      // Reset timer if not being lit
      this.lightExposureTimer = 0;
    }
    
    return false;
  }
  
  /**
   * Get light exposure progress (0-1) for UI display
   */
  public getLightExposureProgress(): number {
    if (!this.isInHallway()) return 0;
    return Math.min(1, this.lightExposureTimer / GAME_CONSTANTS.PYRO_HALLWAY_LIGHT_TIME);
  }
  
  /**
   * Teleport to a random non-hallway room
   */
  private teleportToNonHallway(): void {
    const nonHallwayRooms = PyroEnemy.TELEPORT_ROOMS.filter(
      r => r !== 'LEFT_HALL' && r !== 'RIGHT_HALL' && r !== this.currentNode
    );
    this.currentNode = nonHallwayRooms[Math.floor(Math.random() * nonHallwayRooms.length)];
    this.teleportTimer = 0;
    console.log(`🔥 Pyro teleported to ${this.currentNode} (fled from light)`);
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
   * Check if Pyro is currently transitioning between modes (despawned)
   */
  public isTransitioning(): boolean {
    return this.mode === 'TRANSITIONING';
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

