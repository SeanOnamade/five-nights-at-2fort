/**
 * PaulingEnemy - Custom Night Enemy
 *
 * Ms. Pauling is the Administrator's cleaner. She never enters the base directly —
 * she's not going anywhere near the infected mercs. Instead she works remotely,
 * hacking teleporter nodes to cut off Engineer's escape routes and mobility.
 *
 * LORE: Pauling was the last person to see Sniper before he turned. Engineer is
 * getting close to the truth, and she needs to silence him before he puts it together.
 *
 * MECHANICS — two modes:
 *
 * MODE 1 (triggered by GameScene on return to Intel):
 *   - Instantly hacks the last room the player teleported to — no warning, no counterplay
 *   - GameScene enforces a 1-per-hour cap and picks a fallback room if needed
 *
 * MODE 2 (fallback — triggered by GameScene after 60s without a player teleport):
 *   - Uses the TARGETING/HACKING bar system on a random camera
 *   - TARGETING: empty grey bar visible; player can scare her off by teleporting there
 *   - HACKING: bar fills pink over 8s; click bar once to interrupt
 *   - Does NOT count toward the Mode 1 hour cap
 */

import { NodeId, GAME_CONSTANTS } from '../types';

export type PaulingState = 'WAITING' | 'TARGETING' | 'HACKING' | 'SCARED' | 'INACTIVE';

export class PaulingEnemy {
  private state: PaulingState = 'INACTIVE';

  // The node she is currently targeting for a hack (Mode 2 only)
  private targetNode: NodeId | null = null;

  // TARGETING: warning window before the hack actually starts (Mode 2)
  private warnTimer: number = 0;
  private warnDuration: number = 0;

  // HACKING: fill progress (Mode 2)
  private hackTimer: number = 0;

  // SCARED: cooldown after teleport scare (Mode 2)
  private scaredTimer: number = 0;

  // Valid rooms she can target — outer rooms only, never hallways or Intel
  public static readonly VALID_ROOMS: NodeId[] = [
    'BRIDGE', 'COURTYARD', 'GRATE', 'SEWER', 'STAIRCASE', 'SPIRAL', 'LEFT_HALL', 'RIGHT_HALL',
  ];

  constructor() {
    // Stays INACTIVE until activate() is called
  }

  /**
   * Activate Pauling (called when Custom Night starts with her enabled)
   */
  public activate(): void {
    this.state = 'WAITING';
    console.log('📋 Ms. Pauling activated — watching the base remotely');
  }

  /**
   * Main update loop — called every frame from GameScene.
   * Only advances TARGETING / HACKING / SCARED states.
   * Mode 1 hacks are applied directly by GameScene (instant, no update needed).
   */
  public update(delta: number): { hackComplete: boolean; targetNode: NodeId | null } {
    const result = { hackComplete: false, targetNode: null as NodeId | null };

    switch (this.state) {
      case 'WAITING':
        // Idle — waiting for GameScene to trigger Mode 1 or Mode 2
        break;

      case 'TARGETING':
        // Mode 2: grey bar visible; player can scare her off by teleporting here
        this.warnTimer += delta;
        if (this.warnTimer >= this.warnDuration) {
          this.state = 'HACKING';
          this.hackTimer = 0;
          console.log(`📋 Pauling began hacking ${this.targetNode}!`);
        }
        break;

      case 'HACKING':
        this.hackTimer += delta;
        if (this.hackTimer >= GAME_CONSTANTS.PAULING_HACK_DURATION) {
          result.hackComplete = true;
          result.targetNode = this.targetNode;
          console.log(`📋 Pauling hacked ${this.targetNode}! Teleporter offline.`);
          this.targetNode = null;
          this.state = 'WAITING';
        }
        break;

      case 'SCARED':
        this.scaredTimer += delta;
        if (this.scaredTimer >= GAME_CONSTANTS.PAULING_SCARE_COOLDOWN) {
          this.state = 'WAITING';
          console.log('📋 Pauling recovered — waiting for next opportunity');
        }
        break;

      case 'INACTIVE':
        break;
    }

    return result;
  }

  /**
   * MODE 2: Start targeting a random room with the visible hack bar.
   * Called by GameScene when the player hasn't teleported for PAULING_NO_TELEPORT_THRESHOLD ms.
   * @param alreadyHacked - rooms that are already hacked and should be excluded
   * @param excludeNode - additional room to exclude (e.g. avoid retargeting same room)
   */
  public triggerFallbackHack(alreadyHacked: NodeId[] = [], excludeNode?: NodeId): void {
    if (this.state !== 'WAITING') return; // already busy with Mode 2

    const candidates = PaulingEnemy.VALID_ROOMS.filter(r => {
      if (alreadyHacked.includes(r)) return false;
      if (excludeNode && r === excludeNode) return false;
      return true;
    });

    if (candidates.length === 0) return; // all rooms already hacked

    this.targetNode = candidates[Math.floor(Math.random() * candidates.length)];
    this.state = 'TARGETING';
    this.warnTimer = 0;
    this.pickWarnDuration();
    console.log(`📋 Pauling (Mode 2) targeting ${this.targetNode} — hack begins in ${(this.warnDuration / 1000).toFixed(1)}s`);
  }

  /**
   * Called when the player teleports to Pauling's target room during TARGETING phase (Mode 2).
   */
  public scarePauling(): void {
    if (this.state !== 'TARGETING') return;
    console.log(`📋 Pauling scared off from ${this.targetNode}! She'll try elsewhere.`);
    this.targetNode = null;
    this.state = 'SCARED';
    this.scaredTimer = 0;
  }

  /**
   * Called when the player clicks the hack bar during HACKING phase (Mode 2).
   */
  public interruptHack(): void {
    if (this.state !== 'HACKING') return;
    console.log(`📋 Pauling's hack on ${this.targetNode} was interrupted!`);
    this.targetNode = null;
    this.state = 'WAITING';
  }

  /**
   * Permanently deactivate (for Custom Night with Pauling disabled)
   */
  public forceDespawn(): void {
    this.state = 'INACTIVE';
    this.targetNode = null;
    console.log('📋 Pauling force despawned');
  }

  // ============================================================
  // Getters
  // ============================================================

  public getState(): PaulingState {
    return this.state;
  }

  public getCurrentTarget(): NodeId | null {
    return this.targetNode;
  }

  /**
   * Returns hack progress 0-1 during HACKING state, 0 otherwise.
   * Returns 0 during TARGETING (bar is shown empty as a warning).
   */
  public getHackProgress(): number {
    if (this.state !== 'HACKING') return 0;
    return Math.min(this.hackTimer / GAME_CONSTANTS.PAULING_HACK_DURATION, 1);
  }

  public isActive(): boolean {
    return this.state !== 'INACTIVE';
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private pickWarnDuration(): void {
    const min = GAME_CONSTANTS.PAULING_WARN_DURATION_MIN;
    const max = GAME_CONSTANTS.PAULING_WARN_DURATION_MAX;
    this.warnDuration = min + Math.random() * (max - min);
  }

  /**
   * Debug info string
   */
  public getDebugInfo(): string {
    if (this.state === 'INACTIVE') return 'Pauling: INACTIVE';
    if (this.state === 'WAITING') return 'Pauling: WAITING';
    if (this.state === 'TARGETING') return `Pauling: TARGETING ${this.targetNode} (${((this.warnDuration - this.warnTimer) / 1000).toFixed(1)}s to hack)`;
    if (this.state === 'HACKING') return `Pauling: HACKING ${this.targetNode} (${(this.getHackProgress() * 100).toFixed(0)}%)`;
    if (this.state === 'SCARED') return `Pauling: SCARED (${((GAME_CONSTANTS.PAULING_SCARE_COOLDOWN - this.scaredTimer) / 1000).toFixed(1)}s)`;
    return 'Pauling: UNKNOWN';
  }
}
