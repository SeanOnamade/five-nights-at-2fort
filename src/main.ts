/**
 * TwoFort Nights - Night 1 MVP
 * 
 * A TF2-inspired FNAF-style horror/strategy game prototype.
 * 
 * =============================================
 * HOW TO RUN
 * =============================================
 * 1. npm install
 * 2. npm run dev
 * 3. Open http://localhost:3000 in your browser
 * 4. Press SPACE to start the game
 * 
 * =============================================
 * CONTROLS
 * =============================================
 * F          - Toggle Wrangler ON/OFF
 * HOLD A     - Aim Wrangler at LEFT door (shines light)
 * HOLD D     - Aim Wrangler at RIGHT door (shines light)
 * (neither)  - Sentry aims middle, no light on doors
 * SPACE      - Fire wrangled sentry at aimed door
 * TAB        - Toggle camera view (map showing enemy positions)
 * R          - Repair sentry (50 metal → +50 HP)
 * B          - Build new sentry (100 metal, Level 1)
 * U          - Upgrade sentry (200 metal per level)
 * 
 * When wrangler is ON and you HOLD A or D, you shine a light on that
 * doorway and can see enemies there. Release to aim middle (no light).
 * 
 * =============================================
 * GAME MECHANICS
 * =============================================
 * 
 * OBJECTIVE: Survive from 00:00 to 06:00 (6 real-time minutes)
 * 
 * SENTRY:
 * - Starts at Level 3 with 216 HP
 * - When WRANGLED: You manually aim and fire
 * - When UNWRANGLED: Auto-defends once but is destroyed
 * - Can be repaired, rebuilt, and upgraded
 * 
 * ENEMIES:
 * - SCOUT: Fast, approaches from LEFT door
 *   Path: LOBBY → STAIRCASE → LEFT_HALL → INTEL
 *   Waits at door briefly, then attacks
 * 
 * - SOLDIER: Slow, approaches from RIGHT door
 *   Path: GRATE → SPIRAL → RIGHT_HALL → INTEL
 *   Sieges from doorway, firing rockets at sentry
 *   Must be driven away with wrangled fire
 * 
 * DISPENSER:
 * - Generates 15 metal per second
 * - Max metal: 200
 * 
 * WIN: Survive until 06:00
 * LOSE: Enemy enters Intel Room with no sentry
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Disable right-click context menu
  disableContextMenu: true,
};

// Create the game instance
const game = new Phaser.Game(config);

// Export for potential debugging
export { game };

