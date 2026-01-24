/**
 * TwoFort Nights - Type Definitions
 * 
 * This file contains all shared types and interfaces used throughout the game.
 */

// ============================================
// MAP & NAVIGATION TYPES
// ============================================

/**
 * All possible map nodes that enemies can traverse.
 * INTEL is the player's room (destination).
 */
export type NodeId = 
  | 'BRIDGE'      // Heavy's spawn point (before Courtyard)
  | 'COURTYARD' 
  | 'GRATE' 
  | 'SEWER'       // Beyond Grate - new room
  | 'STAIRCASE' 
  | 'SPIRAL' 
  | 'LEFT_HALL' 
  | 'RIGHT_HALL' 
  | 'INTEL';

/**
 * The two doorways enemies can approach from, or NONE for middle aim
 */
export type DoorSide = 'LEFT' | 'RIGHT' | 'NONE';

/**
 * Path definitions for each enemy type
 */
export const SCOUT_PATH: NodeId[] = ['COURTYARD', 'STAIRCASE', 'LEFT_HALL', 'INTEL'];
export const SOLDIER_PATH: NodeId[] = ['GRATE', 'SPIRAL', 'RIGHT_HALL', 'INTEL'];

// Demoman can charge down either hallway - path determined by which eye glows
export const DEMOMAN_PATH_LEFT: NodeId[] = ['BRIDGE', 'COURTYARD', 'STAIRCASE', 'LEFT_HALL', 'INTEL'];
export const DEMOMAN_PATH_RIGHT: NodeId[] = ['BRIDGE', 'COURTYARD', 'STAIRCASE', 'RIGHT_HALL', 'INTEL'];

// Heavy paths - Heavy can now spawn from different locations and take different routes
export const HEAVY_PATH_LEFT: NodeId[] = ['BRIDGE', 'COURTYARD', 'STAIRCASE', 'LEFT_HALL', 'INTEL'];
export const HEAVY_PATH_RIGHT: NodeId[] = ['SEWER', 'GRATE', 'SPIRAL', 'RIGHT_HALL', 'INTEL'];
// All possible Heavy paths (randomly selected)
export const HEAVY_PATHS: NodeId[][] = [HEAVY_PATH_LEFT, HEAVY_PATH_RIGHT];
// Default for backwards compatibility
export const HEAVY_PATH: NodeId[] = HEAVY_PATH_LEFT;
export const SNIPER_PATH_LEFT: NodeId[] = ['COURTYARD', 'STAIRCASE', 'LEFT_HALL', 'INTEL'];
export const SNIPER_PATH_RIGHT: NodeId[] = ['GRATE', 'SPIRAL', 'RIGHT_HALL', 'INTEL'];

// Room adjacency map - which rooms are adjacent to each position
// Matches real TF2 2Fort layout with cross-connections
export const ROOM_ADJACENCY: Record<NodeId, NodeId[]> = {
  'BRIDGE': ['COURTYARD', 'GRATE'],               // Connected to both sides (like real 2Fort)
  'COURTYARD': ['BRIDGE', 'STAIRCASE', 'GRATE'],  // Connected to GRATE for path crossing
  'GRATE': ['SPIRAL', 'SEWER', 'COURTYARD', 'BRIDGE'],  // Connected to BRIDGE and COURTYARD
  'SEWER': ['GRATE'],             // New room beyond Grate
  'STAIRCASE': ['COURTYARD', 'LEFT_HALL'],
  'SPIRAL': ['GRATE', 'RIGHT_HALL'],
  'LEFT_HALL': ['STAIRCASE', 'INTEL', 'RIGHT_HALL'],  // Connected to RIGHT_HALL (behind Intel)
  'RIGHT_HALL': ['SPIRAL', 'INTEL', 'LEFT_HALL'],     // Connected to LEFT_HALL (behind Intel)
  'INTEL': ['LEFT_HALL', 'RIGHT_HALL'],
};

// ============================================
// ENEMY TYPES
// ============================================

/**
 * Enemy types available in the game
 */
export type EnemyType = 'SCOUT' | 'SOLDIER' | 'DEMOMAN' | 'HEAVY' | 'SNIPER' | 'SPY' | 'PYRO' | 'MEDIC';

/**
 * Spy-specific state (Night 5)
 */
export type SpyState = 'DISGUISE' | 'SAPPING';

/**
 * What enemy Spy is disguised as
 */
export type SpyDisguise = 'SCOUT' | 'SOLDIER' | 'DEMOMAN_HEAD' | 'HEAVY' | 'SNIPER';

/**
 * Pyro mode (Custom Night only)
 */
export type PyroMode = 'ROOM' | 'INTEL' | 'TRANSITIONING';

/**
 * Possible states an enemy can be in
 */
export type EnemyState = 
  | 'PATROLLING'      // Moving between nodes
  | 'WAITING'         // At doorway, waiting to strike
  | 'ATTACKING'       // Charging into Intel
  | 'SIEGING'         // Soldier-specific: firing rockets
  | 'RETREATING'      // Being driven away
  | 'DESPAWNED'       // Temporarily removed, will respawn
  | 'DORMANT'         // Demoman-specific: head present, body inactive
  | 'CHARGING'        // Demoman-specific: body rushing toward Intel
  | 'BREACHING'       // Soldier-specific: counting down to attack after sentry destroyed
  | 'LURED'           // Heavy/Sniper: moving toward a lure
  | 'DESTROYING_CAMERA'; // Heavy/Sniper: destroying camera after being watched

/**
 * Base interface for enemy data
 */
export interface EnemyData {
  type: EnemyType;
  currentNode: NodeId;
  state: EnemyState;
  moveTimer: number;        // Time until next move (ms)
  waitTimer: number;        // Time waiting at doorway (ms)
  respawnTimer: number;     // Time until respawn after being driven away (ms)
}

// ============================================
// SENTRY TYPES
// ============================================

/**
 * Sentry levels and their stats
 */
export type SentryLevel = 1 | 2 | 3;

export const SENTRY_MAX_HP: Record<SentryLevel, number> = {
  1: 150,
  2: 180,
  3: 216,
};

/**
 * Sentry state interface
 */
export interface SentryState {
  exists: boolean;
  level: SentryLevel;
  hp: number;
  maxHp: number;
  isWrangled: boolean;
  aimedDoor: DoorSide;
}

// ============================================
// GAME STATE TYPES
// ============================================

/**
 * Overall game state
 */
export type GameStatus = 'PLAYING' | 'WON' | 'LOST';

/**
 * Camera data for each viewable location with map positions
 */
export interface CameraData {
  id: number;
  name: string;
  node: NodeId;
  // Map coordinates (relative to map display area)
  mapX: number;
  mapY: number;
}

/**
 * All camera locations with map positions
 * Map layout (aligned visual):
 * 
 *   STAIRCASE ----- COURTYARD -------- BRIDGE
 *       |               |                 |
 *   LEFT_HALL           |                 |
 *       | \             |                 |
 *       |   R.HALL -- SPIRAL -- GRATE ---+
 *       |     |                   |
 *     INTEL --+                 SEWER
 */
export const CAMERAS: CameraData[] = [
  { id: 4, name: 'STAIRCASE', node: 'STAIRCASE', mapX: 55, mapY: 30 },       // Top left
  { id: 2, name: 'COURTYARD', node: 'COURTYARD', mapX: 165, mapY: 30 },      // Above Spiral
  { id: 6, name: 'LEFT HALL', node: 'LEFT_HALL', mapX: 55, mapY: 105 },      // Below Staircase
  { id: 7, name: 'RIGHT HALL', node: 'RIGHT_HALL', mapX: 105, mapY: 180 },   // Bottom row (spaced)
  { id: 5, name: 'SPIRAL', node: 'SPIRAL', mapX: 165, mapY: 180 },           // Below Courtyard (spaced)
  { id: 3, name: 'GRATE', node: 'GRATE', mapX: 225, mapY: 180 },             // Right of Spiral (spaced)
  { id: 1, name: 'BRIDGE', node: 'BRIDGE', mapX: 285, mapY: 180 },           // Far right (spaced)
  { id: 8, name: 'SEWER', node: 'SEWER', mapX: 225, mapY: 255 },             // Below Grate
];

/**
 * Camera destruction state (for Night 3+)
 */
export interface CameraState {
  destroyed: boolean;
  destroyedUntil: number;  // Timestamp when camera becomes usable again
  destroyedBy: EnemyType | null;
}

/**
 * Lure data for teleporter system
 */
export interface LureData {
  node: NodeId;
  placed: boolean;      // Lure device is placed
  playing: boolean;     // Medic voice is currently playing
  playTimeRemaining: number;  // How long until lure stops playing (ms)
}

// ============================================
// GAME CONSTANTS
// ============================================

export const GAME_CONSTANTS = {
  // Time settings
  NIGHT_START_HOUR: 0,      // 00:00 (midnight)
  NIGHT_END_HOUR: 6,        // 06:00 AM
  MS_PER_GAME_MINUTE: 1000, // 1 real second = 1 game minute
  
  // Metal settings
  MAX_METAL: 200,
  START_METAL: 0,
  DISPENSER_RATE: 7.5,      // Metal per second (halved from 15)
  
  // Sentry costs
  BUILD_SENTRY_COST: 100,
  UPGRADE_SENTRY_COST: 200,
  REPAIR_SENTRY_COST: 50,
  REPAIR_SENTRY_AMOUNT: 50,
  
  // Soldier rocket damage
  ROCKET_DAMAGE: 60,
  ROCKET_INTERVAL: 3000,    // ms between rockets
  
  // Enemy timings (ms) - NIGHT 1 BALANCED
  SCOUT_MOVE_INTERVAL: 12000,     // Time between Scout moves (12 sec)
  SCOUT_WAIT_TIME: 5000,          // Time Scout waits at door before attacking (5 sec)
  SOLDIER_MOVE_INTERVAL: 15000,   // Time between Soldier moves (15 sec)
  ENEMY_RESPAWN_DELAY: 8000,      // Time before enemy respawns (8 sec)
  
  // Demoman settings - NIGHT 2
  DEMOMAN_DORMANT_MIN: 20000,     // Min time head stays dormant (20 sec)
  DEMOMAN_DORMANT_MAX: 40000,     // Max time head stays dormant (40 sec)
  DEMOMAN_CHARGE_SPEED: 300,      // Speed per node during charge (0.3 sec/node)
  DEMOMAN_CHARGE_WARNING: 3000,   // Eye glow warning before charge (3 sec)
  DEMOMAN_CHARGE_ATTACK_DELAY: 1000, // Time at door before attacking (1 sec to react)
  DEMOMAN_HEAD_TELEPORT_DELAY: 3000, // Time before head teleports after deterred
  DEMOMAN_WATCH_DETER_TIME: 3000,   // (unused now - watching freezes dormant only)
  
  // Heavy settings - NIGHT 3
  HEAVY_MOVE_INTERVAL: 18000,       // Time between Heavy moves (18 sec - very slow)
  HEAVY_LURED_MOVE_INTERVAL: 6000,  // Time between moves when lured (6 sec - 3x faster)
  HEAVY_FOOTSTEP_INTERVAL: 1500,    // Time between footstep sounds
  
  // Sniper settings - NIGHT 4
  SNIPER_TELEPORT_INTERVAL: 15000,  // Time between Sniper random teleports (15 sec)
  SNIPER_CHARGE_TIME: 4000,         // Time to charge headshot when in range (4 sec)
  SNIPER_CHARGE_WARNING_TIME: 2000, // Warning sound starts this long before shot
  SNIPER_SHOTS_TO_REPEL: 2,         // Number of wrangler shots needed to drive Sniper away
  
  // Camera destruction - NIGHT 3+ (Heavy), NIGHT 4+ (Sniper)
  CAMERA_WATCH_DESTROY_TIME: 4500,  // Time watching Heavy/Sniper before camera destroyed (4.5 sec - HALVED!)
  CAMERA_REPAIR_TIME: 30000,        // Time camera stays destroyed (30 sec)
  CAMERA_REMOTE_REPAIR_COST: 50,    // Metal cost to remotely repair camera
  
  // Teleporter settings - NIGHT 3
  LURE_COST: 50,                    // Metal cost to place a lure (doubled)
  TELEPORT_ESCAPE_TIME: 5000,       // Time to escape when enemy approaches (5 sec)
  LURE_ATTRACT_RANGE: 2,            // Lures attract from adjacent rooms
  LURE_DURATION: 15000,             // How long lure plays when activated (15 sec)
  LURE_COOLDOWN: 5000,              // Cooldown before lure can be played again (5 sec)
  
  // Wrangler repel cost
  REPEL_COST: 50,                   // Metal cost to fire wrangler
  
  // Wrangler light cone settings (adjust these to change cone size)
  CONE_LEFT_DOOR_X: 50,             // Left edge of left door cone
  CONE_RIGHT_DOOR_X: 1230,          // Right edge of right door cone
  CONE_TOP_Y: 95,                   // Top of door frame
  CONE_BOTTOM_Y: 480,               // Bottom of door frame
  
  // Spy settings - NIGHT 5
  SPY_STATE_TOGGLE_INTERVAL: 60000, // Time between state changes (60 sec = 1 in-game hour)
  SPY_TELEPORT_INTERVAL: 8000,      // How often Spy moves when disguised (8 sec)
  SPY_SAP_CHANCE: 1.0,              // 100% chance to sap when player teleports away
  SPY_SAP_DAMAGE_RATE: 30,          // HP per second drain when sapping
  SPY_SAP_REMOVE_CLICKS: 2,         // SPACE presses needed to remove sapper
  SPY_FAKE_WATCH_SPEED: 1.5,        // Fake watch bar fills at 1.5x normal speed
  
  // Pyro settings - CUSTOM NIGHT ONLY
  PYRO_ROOM_TELEPORT_INTERVAL: 7000,  // Time between Pyro teleports in room mode (7 sec)
  PYRO_HALLWAY_LIGHT_TIME: 1500,      // Time player must shine light on Pyro in hallway to drive away (1.5 sec)
  PYRO_MODE_TOGGLE_INTERVAL: 45000,   // Time between ROOM/INTEL mode switches (45 sec)
  PYRO_MODE_TRANSITION_TIME: 10000,   // Cooldown time between mode switches (10 sec despawn)
  PYRO_INTEL_ESCAPE_TIME: 10000,      // Time to escape after match is lit (10 sec)
  PYRO_INTEL_SPAWN_CHANCE: 0.15,      // 15% chance to spawn in Intel each check (reduced from 30%)
  PYRO_INTEL_CHECK_INTERVAL: 4000,    // Check for Intel spawn every 4 sec (was 2 sec)
  PYRO_INTEL_ESCAPE_COOLDOWN: 8000,   // Cooldown after player escapes before Pyro can attack again
  
  // Medic settings - CUSTOM NIGHT ONLY
  MEDIC_HOUR_INTERVAL: 60000,         // Time between Über target selections (60 sec = 1 in-game hour)
} as const;

