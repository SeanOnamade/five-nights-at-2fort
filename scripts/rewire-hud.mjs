// One-shot: rewires GameScene to use the HUD class (run AFTER extracting
// createHUD/showAlert/updateHUD with extract-methods.mjs).
import fs from 'node:fs';

const f = 'src/scenes/GameScene.ts';
let t = fs.readFileSync(f, 'utf8');

// field declarations -> single hud field
const fieldNames = ['timeText','metalText','sentryText','wranglerText','_controlsText','alertContainer','alertBg','alertText','lureBarContainer','lureBarFill','lureBarText'];
const lines = t.split('\n');
const re = new RegExp('^  private (' + fieldNames.join('|') + ')\\s*[!?:=]');
let removed = 0;
let filtered = [];
let added = false;
for (const l of lines) {
  if (re.test(l)) {
    removed++;
    if (!added) {
      filtered.push('  private hud!: HUD;');
      added = true;
    }
    continue;
  }
  filtered.push(l);
}
t = filtered.join('\n');
console.log('removed', removed, 'field lines');

// creation call
t = t.replace(
  `    this.createHUD();`,
  `    this.hud = new HUD(this, {
      getGameMinutes: () => this.gameMinutes,
      getMetal: () => this.metal,
      getSentry: () => this.sentry,
      isCameraModeNow: () => this.isCameraMode,
      isBadEndingNight6Now: () => this.isBadEndingNight6,
      hasReached6AMNow: () => this.hasReached6AM,
      getEndlessDay: () => this.endlessDay,
      isMerasmusEnabled: () => this.isMerasmusEnabled(),
    });
    this.hud.create();`);

// re-add slim wrappers before gameOver (which followed updateHUD originally)
t = t.replace(
  `  private gameOver(reason: string): void {`,
  `  private showAlert(message: string, color: number): void {
    this.hud.showAlert(message, color);
  }

  private updateHUD(): void {
    this.hud.update();

    // Update lure button state (grey out if not enough metal) - Night 3+
    if (this.nightNumber >= 3 && this.isTeleported) {
      this.updateLureButtonText();
    }

    // Update mobile UI if on mobile
    if (this.isMobile) {
      this.mobileControls?.updateUI();
    }
  }

  private gameOver(reason: string): void {`);

// external field references
t = t.replace(/this\.(timeText|metalText|lureBarContainer|lureBarFill|lureBarText)\b/g, 'this.hud.$1');

// import
t = t.replace(
  "import { RecordingUI } from '../ui/RecordingUI';",
  "import { RecordingUI } from '../ui/RecordingUI';\nimport { HUD } from '../ui/HUD';");

fs.writeFileSync(f, t);
console.log('done');
