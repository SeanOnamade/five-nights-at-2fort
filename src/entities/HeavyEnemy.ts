import Phaser from 'phaser';
import { EnemyBase } from './EnemyBase';
import { 
  NodeId, 
  HEAVY_PATHS,
  GAME_CONSTANTS,
  ROOM_ADJACENCY,
} from '../types';

/**
 * HeavyEnemy - Night 3 enemy
 * 
 * Characteristics:
 * - Very slow movement with loud footsteps
 * - CANNOT be stopped by any sentry (wrangled or unwrangled)
 * - MUST be lured away with Medic voice lures
 * - Destroys cameras if watched for too long (rage)
 * - Instant kill if reaches Intel room without being lured
 */
export class HeavyEnemy extends EnemyBase {
  // Configuration
  protected moveInterval = GAME_CONSTANTS.HEAVY_MOVE_INTERVAL;
  protected waitTime = 3000; // Heavy doesn't really wait - instant kill

  // Camera watching tracking
  private watchTimer: number = 0;
  private isBeingWatched: boolean = false;
  private _destroyingCamera: boolean = false;
  private destroyCameraCallback: ((cameraNode: NodeId) => void) | null = null;

  // Lure tracking
  private targetLureNode: NodeId | null = null;
  private originalPath: NodeId[];
  private isLured: boolean = false;

  // Footstep timing
  private _footstepTimer: number = 0; // Reserved for future footstep timing
  private footstepCallback: ((volume: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    // Heavy randomly chooses a path - either left (Bridge) or right (Sewer)
    const selectedPath = HEAVY_PATHS[Math.floor(Math.random() * HEAVY_PATHS.length)];
    const path = [...selectedPath];
    const spawnNode = path[0]; // BRIDGE or SEWER
    
    console.log(`Heavy spawning via ${spawnNode === 'BRIDGE' ? 'left path' : 'right path (Sewer)'}`);
    
    super(scene, 'HEAVY', spawnNode, path);
    this.originalPath = [...path];
  }

  /**
   * Set callback for when Heavy destroys a camera
   */
  public setDestroyCameraCallback(callback: (cameraNode: NodeId) => void): void {
    this.destroyCameraCallback = callback;
  }

  /**
   * Set callback for footstep sounds
   */
  public setFootstepCallback(callback: (volume: number) => void): void {
    this.footstepCallback = callback;
  }

  /**
   * Update Heavy's state
   */
  public update(delta: number): { 
    reachedIntel: boolean; 
    atDoorway: boolean;
    doorSide: 'LEFT' | 'RIGHT' | null;
    destroyedCamera: boolean;
  } {
    const result = { 
      reachedIntel: false, 
      atDoorway: false,
      doorSide: null as 'LEFT' | 'RIGHT' | null,
      destroyedCamera: false,
    };

    // Handle camera watching/destruction
    // watchMultiplier is 2 if both Heavy and Sniper are on the same camera (halves time)
    if (this.isBeingWatched && this.state !== 'DESPAWNED') {
      // Timer increases when being watched
      this.watchTimer += delta * this.watchMultiplier;
      if (this.watchTimer >= GAME_CONSTANTS.CAMERA_WATCH_DESTROY_TIME) {
        // Heavy destroys the camera in rage!
        this._destroyingCamera = true;
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

    // Footsteps are played via playMovementFootstep() when Heavy moves to a new room
    // (not on a timer - only when he actually moves)

    switch (this.state) {
      case 'PATROLLING':
        this.moveTimer += delta;
        if (this.moveTimer >= this.moveInterval) {
          this.moveTimer = 0;
          this.moveToNextNode();
        }
        break;

      case 'LURED':
        // Move toward lure location - 3x FASTER than normal!
        this.moveTimer += delta;
        if (this.moveTimer >= GAME_CONSTANTS.HEAVY_LURED_MOVE_INTERVAL) {
          this.moveTimer = 0;
          this.moveTowardLure();
        }
        break;

      case 'WAITING':
        // Heavy doesn't wait - he moves right into attacking
        result.atDoorway = true;
        result.doorSide = this.getDoorSide();
        this.waitTimer += delta;
        if (this.waitTimer >= this.waitTime) {
          this.state = 'ATTACKING';
        }
        break;

      case 'ATTACKING':
        result.reachedIntel = true;
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
          this._destroyingCamera = false;
          this.state = this.isLured ? 'LURED' : 'PATROLLING';
          this.waitTimer = 0;
        }
        break;
    }

    return result;
  }

  /**
   * Move to next node in path
   */
  protected moveToNextNode(): void {
    if (this.pathIndex < this.path.length - 1) {
      this.pathIndex++;
      this.currentNode = this.path[this.pathIndex];
      
      // Play footstep sound when moving to new room
      this.playMovementFootstep();

      // Check if reached Intel
      if (this.currentNode === 'INTEL') {
        this.state = 'ATTACKING';
      }
      // Check if at a doorway
      else if (this.currentNode === 'LEFT_HALL' || this.currentNode === 'RIGHT_HALL') {
        this.state = 'WAITING';
        this.waitTimer = 0;
        this.onReachDoorway();
      }
    }
  }
  
  /**
   * Play footstep sound when Heavy moves to a new room
   */
  private playMovementFootstep(): void {
    if (this.footstepCallback) {
      const volume = this.getFootstepVolume();
      this.footstepCallback(volume);
    }
  }

  /**
   * Move toward lure location - Heavy navigates toward the Medic voice
   */
  private moveTowardLure(): void {
    if (!this.targetLureNode) {
      // No lure, return to patrolling
      this.isLured = false;
      this.state = 'PATROLLING';
      this.rebuildPathToIntel();
      return;
    }

    // Check if we've reached the lure
    if (this.currentNode === this.targetLureNode) {
      // Reached lure! Stay here while lure is active
      console.log(`Heavy reached lure at ${this.currentNode}`);
      return;
    }

    // Check if lure is adjacent - move directly there
    const adjacent = ROOM_ADJACENCY[this.currentNode] || [];
    if (adjacent.includes(this.targetLureNode)) {
      console.log(`Heavy moving to adjacent lure: ${this.currentNode} -> ${this.targetLureNode}`);
      this.currentNode = this.targetLureNode;
      this.playMovementFootstep();
      return;
    }

    // Lure is not adjacent - find path toward it
    // Simple BFS-like approach: move toward the lure through adjacency
    // For Heavy's path (Bridge -> Lobby -> Staircase -> Left Hall), we navigate accordingly
    const pathToLure = this.findNextStepToward(this.targetLureNode);
    if (pathToLure) {
      console.log(`Heavy navigating toward lure: ${this.currentNode} -> ${pathToLure}`);
      this.currentNode = pathToLure;
      this.playMovementFootstep();
    } else {
      // Can't find path, continue on normal path
      if (this.pathIndex < this.path.length - 1) {
        this.pathIndex++;
        this.currentNode = this.path[this.pathIndex];
        this.playMovementFootstep();
      }
    }
  }
  
  /**
   * Find the next node to move to in order to reach the target using BFS
   * This properly handles crossing between left/right paths via LOBBY-GRATE connection
   */
  private findNextStepToward(target: NodeId): NodeId | null {
    const adjacent = ROOM_ADJACENCY[this.currentNode] || [];
    
    // If target is adjacent, return it
    if (adjacent.includes(target)) {
      return target;
    }
    
    // BFS to find shortest path
    const visited = new Set<NodeId>([this.currentNode]);
    const queue: { node: NodeId; firstStep: NodeId }[] = [];
    
    // Add all adjacent nodes as starting points
    for (const adj of adjacent) {
      queue.push({ node: adj, firstStep: adj });
      visited.add(adj);
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Found target - return the first step we took to get here
      if (current.node === target) {
        return current.firstStep;
      }
      
      // Explore neighbors
      const neighbors = ROOM_ADJACENCY[current.node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && neighbor !== 'INTEL') { // Don't path through Intel
          visited.add(neighbor);
          queue.push({ node: neighbor, firstStep: current.firstStep });
        }
      }
    }
    
    // No path found - fallback to first adjacent
    return adjacent.length > 0 ? adjacent[0] : null;
  }

  /**
   * Lure Heavy to a specific node
   * Heavy can hear the Medic voice from ANYWHERE and will move toward it
   */
  public lure(targetNode: NodeId): boolean {
    // Heavy hears the lure from any distance - Medic voice carries!
    if (this.state !== 'DESPAWNED' && this.state !== 'ATTACKING') {
      this.targetLureNode = targetNode;
      this.isLured = true;
      this.state = 'LURED';
      console.log(`Heavy heard lure at ${targetNode}! Moving toward it from ${this.currentNode}`);
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
    this.state = 'PATROLLING';
    // Reset path to continue toward Intel
    this.rebuildPathToIntel();
  }

  /**
   * Rebuild path from current node to Intel using BFS
   * This handles the case where Heavy crossed between paths via LOBBY-GRATE
   */
  private rebuildPathToIntel(): void {
    // If current node is on original path, just continue from there
    const currentIdx = this.originalPath.indexOf(this.currentNode);
    if (currentIdx >= 0) {
      this.path = this.originalPath.slice(currentIdx);
      this.pathIndex = 0;
      console.log(`Heavy rebuilding path from ${this.currentNode}: ${this.path.join(' -> ')}`);
      return;
    }
    
    // Heavy is on the OTHER path - use BFS to find shortest route to Intel
    const newPath = this.findPathToIntel();
    if (newPath.length > 0) {
      this.path = newPath;
      this.pathIndex = 0;
      console.log(`Heavy crossed paths! New route: ${this.path.join(' -> ')}`);
    } else {
      // Fallback: just try to get to a hallway
      console.log(`Heavy lost! Trying to find any path to Intel from ${this.currentNode}`);
    }
  }
  
  /**
   * BFS to find path from current node to INTEL
   */
  private findPathToIntel(): NodeId[] {
    const target: NodeId = 'INTEL';
    
    if (this.currentNode === target) {
      return [target];
    }
    
    const visited = new Set<NodeId>([this.currentNode]);
    const queue: { node: NodeId; path: NodeId[] }[] = [];
    
    // Start with adjacent nodes
    const adjacent = ROOM_ADJACENCY[this.currentNode] || [];
    for (const adj of adjacent) {
      queue.push({ node: adj, path: [this.currentNode, adj] });
      visited.add(adj);
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.node === target) {
        return current.path;
      }
      
      const neighbors = ROOM_ADJACENCY[current.node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...current.path, neighbor] });
        }
      }
    }
    
    // No path found
    return [this.currentNode];
  }

  // Watch speed multiplier (2x if both Heavy and Sniper on same camera)
  private watchMultiplier: number = 1;
  
  /**
   * Set whether Heavy is being watched on camera
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
   * Get footstep volume based on distance to Intel (0-1)
   */
  public getFootstepVolume(): number {
    // Calculate distance based on path position
    const distanceMap: Record<NodeId, number> = {
      'SEWER': 0.05,    // Furthest spawn point
      'BRIDGE': 0.1,
      'LOBBY': 0.25,
      'GRATE': 0.25,
      'STAIRCASE': 0.5,
      'SPIRAL': 0.5,
      'LEFT_HALL': 0.8,
      'RIGHT_HALL': 0.8,
      'INTEL': 1.0,
    };
    return distanceMap[this.currentNode] || 0;
  }

  /**
   * Check if Heavy is currently being lured
   */
  public isCurrentlyLured(): boolean {
    return this.isLured;
  }

  /**
   * Get the node Heavy is being lured to
   */
  public getLureTarget(): NodeId | null {
    return this.targetLureNode;
  }

  /**
   * Override respawn to reset path - picks a new random path each time
   */
  protected respawn(): void {
    // Randomly choose a new path on respawn
    const selectedPath = HEAVY_PATHS[Math.floor(Math.random() * HEAVY_PATHS.length)];
    this.path = [...selectedPath];
    this.originalPath = [...this.path];
    this.currentNode = this.path[0]; // BRIDGE or SEWER
    this.pathIndex = 0;
    this.state = 'PATROLLING';
    this.moveTimer = 0;
    this.waitTimer = 0;
    this.respawnTimer = 0;
    this.isLured = false;
    this.targetLureNode = null;
    this.watchTimer = 0;
    console.log(`Heavy respawned at ${this.currentNode} (${this.currentNode === 'BRIDGE' ? 'left' : 'right'} path)`);
  }

  /**
   * Heavy cannot be driven away by sentries - only lured
   */
  public driveAway(): void {
    // Heavy ignores sentry fire - does nothing
    console.log('Heavy ignores the sentry!');
  }

  /**
   * Force despawn (used when lured far enough away)
   */
  public forceDespawn(): void {
    this.state = 'DESPAWNED';
    this.respawnTimer = 0;
    this.isLured = false;
    this.targetLureNode = null;
  }
}

