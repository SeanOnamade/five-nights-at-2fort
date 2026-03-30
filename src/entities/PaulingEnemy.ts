/**
 * PaulingEnemy - Custom Night Vent Infiltrator
 *
 * Ms. Pauling crawls silently through a horseshoe-shaped vent system toward Intel.
 * She makes absolutely no sound — the only way to track her is via the vent cameras.
 * The player must seal the correct vent opening before she drops in.
 *
 * VENT LAYOUT (9 traversable nodes, big horseshoe):
 *   VENT_ENTRY -> VENT_MID -> VENT_JUNCTION
 *     -> VENT_LEFT_UPPER -> VENT_LEFT_LOWER -> VENT_LEFT_OPENING
 *     -> VENT_RIGHT_UPPER -> VENT_RIGHT_LOWER -> VENT_RIGHT_OPENING
 *
 * When blocked, she always retreats all the way back to VENT_ENTRY and starts over.
 */

import { VentNodeId, GAME_CONSTANTS } from '../types';

export type PaulingVentState = 'INACTIVE' | 'WAITING' | 'MOVING' | 'PRYING' | 'REROUTING' | 'ENTERED';

export type VentSide = 'LEFT' | 'RIGHT';

const PATH_TO_LEFT: VentNodeId[] = [
  'VENT_ENTRY', 'VENT_MID', 'VENT_JUNCTION',
  'VENT_LEFT_UPPER', 'VENT_LEFT_LOWER', 'VENT_LEFT_OPENING',
];
const PATH_TO_RIGHT: VentNodeId[] = [
  'VENT_ENTRY', 'VENT_MID', 'VENT_JUNCTION',
  'VENT_RIGHT_UPPER', 'VENT_RIGHT_LOWER', 'VENT_RIGHT_OPENING',
];

const REROUTE_FROM_LEFT: VentNodeId[] = [
  'VENT_LEFT_OPENING', 'VENT_LEFT_LOWER', 'VENT_LEFT_UPPER',
  'VENT_JUNCTION', 'VENT_MID', 'VENT_ENTRY',
];
const REROUTE_FROM_RIGHT: VentNodeId[] = [
  'VENT_RIGHT_OPENING', 'VENT_RIGHT_LOWER', 'VENT_RIGHT_UPPER',
  'VENT_JUNCTION', 'VENT_MID', 'VENT_ENTRY',
];

export class PaulingEnemy {
  private state: PaulingVentState = 'INACTIVE';
  private currentNode: VentNodeId = 'VENT_ENTRY';

  private currentPath: VentNodeId[] = [];
  private pathIndex: number = 0;

  private waitTimer: number = 0;
  private waitDuration: number = 0;
  private moveTimer: number = 0;
  private pryTimer: number = 0;

  private targetSide: VentSide | null = null;

  constructor() {}

  public activate(): void {
    this.state = 'WAITING';
    this.currentNode = 'VENT_ENTRY';
    this.targetSide = null;
    this.currentPath = [...PATH_TO_LEFT];
    this.pathIndex = 0;
    this.pickWaitDuration();
    console.log('📋 Pauling activated — entering the vents silently');
  }

  public update(delta: number): { arrivedAtOpening: VentSide | null; entered: boolean } {
    const result = { arrivedAtOpening: null as VentSide | null, entered: false };

    switch (this.state) {
      case 'WAITING': {
        this.waitTimer += delta;
        if (this.waitTimer >= this.waitDuration) {
          this.state = 'MOVING';
          this.moveTimer = 0;
        }
        break;
      }

      case 'MOVING': {
        this.moveTimer += delta;
        if (this.moveTimer >= GAME_CONSTANTS.PAULING_MOVE_INTERVAL_MIN) {
          this.moveTimer = 0;
          this.advanceOnPath();

          if (this.currentNode === 'VENT_LEFT_OPENING') {
            result.arrivedAtOpening = 'LEFT';
            this.targetSide = 'LEFT';
          } else if (this.currentNode === 'VENT_RIGHT_OPENING') {
            result.arrivedAtOpening = 'RIGHT';
            this.targetSide = 'RIGHT';
          } else if (this.currentNode === 'VENT_JUNCTION' && this.state === 'MOVING') {
            this.pickSideAtJunction();
            this.state = 'WAITING';
            this.pickWaitDuration();
          } else {
            this.state = 'WAITING';
            this.pickWaitDuration();
          }
        }
        break;
      }

      case 'PRYING': {
        this.pryTimer += delta;
        if (this.pryTimer >= GAME_CONSTANTS.PAULING_PRY_TIME) {
          this.state = 'ENTERED';
          result.entered = true;
          console.log('📋 Pauling dropped into Intel from the vents!');
        }
        break;
      }

      case 'REROUTING': {
        this.moveTimer += delta;
        if (this.moveTimer >= GAME_CONSTANTS.PAULING_REROUTE_SPEED) {
          this.moveTimer = 0;
          this.advanceOnPath();

          if (this.currentNode === 'VENT_ENTRY') {
            this.currentPath = [...PATH_TO_LEFT];
            this.pathIndex = 0;
            this.state = 'WAITING';
            this.pickWaitDuration();
            this.targetSide = null;
            console.log('📋 Pauling retreated to ENTRY, restarting approach');
          }
        }
        break;
      }

      case 'INACTIVE':
      case 'ENTERED':
        break;
    }

    return result;
  }

  public startPrying(): void {
    this.state = 'PRYING';
    this.pryTimer = 0;
    console.log(`📋 Pauling prying open ${this.currentNode}...`);
  }

  /**
   * When blocked, she always retreats all the way back to VENT_ENTRY.
   */
  public blockAndReroute(): void {
    console.log(`📋 Pauling blocked at ${this.currentNode}! Retreating to ENTRY...`);

    const side = this.getOpeningSide();
    if (side === 'LEFT') {
      this.currentPath = [...REROUTE_FROM_LEFT];
    } else {
      this.currentPath = [...REROUTE_FROM_RIGHT];
    }
    this.pathIndex = 0;
    this.state = 'REROUTING';
    this.moveTimer = 0;
  }

  public forceDespawn(): void {
    this.state = 'INACTIVE';
    this.currentNode = 'VENT_ENTRY';
    this.targetSide = null;
    console.log('📋 Pauling force despawned');
  }

  // ============================================================
  // Getters
  // ============================================================

  public getState(): PaulingVentState { return this.state; }
  public getCurrentNode(): VentNodeId { return this.currentNode; }
  public getTargetSide(): VentSide | null { return this.targetSide; }
  public isActive(): boolean { return this.state !== 'INACTIVE'; }

  public isAtOpening(): boolean {
    return this.currentNode === 'VENT_LEFT_OPENING' || this.currentNode === 'VENT_RIGHT_OPENING';
  }

  public getOpeningSide(): VentSide | null {
    if (this.currentNode === 'VENT_LEFT_OPENING') return 'LEFT';
    if (this.currentNode === 'VENT_RIGHT_OPENING') return 'RIGHT';
    return null;
  }

  public getPryProgress(): number {
    if (this.state !== 'PRYING') return 0;
    return Math.min(this.pryTimer / GAME_CONSTANTS.PAULING_PRY_TIME, 1);
  }

  public getDebugInfo(): string {
    if (this.state === 'INACTIVE') return 'Pauling: INACTIVE';
    if (this.state === 'ENTERED') return 'Pauling: ENTERED (game over)';
    const side = this.targetSide ? ` [${this.targetSide}]` : '';
    if (this.state === 'PRYING') return `Pauling: PRYING ${this.currentNode} (${(this.getPryProgress() * 100).toFixed(0)}%)${side}`;
    return `Pauling: ${this.state} at ${this.currentNode}${side}`;
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private pickWaitDuration(): void {
    const min = GAME_CONSTANTS.PAULING_MOVE_INTERVAL_MIN;
    const max = GAME_CONSTANTS.PAULING_MOVE_INTERVAL_MAX;
    this.waitDuration = min + Math.random() * (max - min);
    this.waitTimer = 0;
  }

  private advanceOnPath(): void {
    if (this.pathIndex < this.currentPath.length - 1) {
      this.pathIndex++;
      this.currentNode = this.currentPath[this.pathIndex];
    }
  }

  private pickSideAtJunction(): void {
    const side: VentSide = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
    this.targetSide = side;

    if (side === 'LEFT') {
      this.currentPath = [...PATH_TO_LEFT];
      this.pathIndex = PATH_TO_LEFT.indexOf('VENT_JUNCTION');
    } else {
      this.currentPath = [...PATH_TO_RIGHT];
      this.pathIndex = PATH_TO_RIGHT.indexOf('VENT_JUNCTION');
    }
  }
}
