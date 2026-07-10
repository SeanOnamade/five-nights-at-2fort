// One-shot: rewires GameScene to use MerasmusSystem (run AFTER extracting the
// old methods with extract-methods.mjs).
import fs from 'node:fs';

const f = 'src/scenes/GameScene.ts';
let t = fs.readFileSync(f, 'utf8');

// field declarations -> single system field
t = t.replace(
  `  private merasmusViewFlipped = false;`,
  `  private merasmus!: MerasmusSystem;`);
const removeLines = [
  /^  private merasmusLinearProgress = 0;\n/m,
  /^  private merasmusRespiteUnflippedMs = 0;\n/m,
  /^  private merasmusInRespite = false;\n/m,
  /^  private merasmusStockTransformPointer: Phaser\.Input\.InputManager\['transformPointer'\] \| null = null;\n/m,
  /^  private merasmusVignette!: Phaser\.GameObjects\.Container;\n/m,
  /^  private merasmusFigureContainer!: Phaser\.GameObjects\.Container;\n/m,
];
for (const re of removeLines) t = t.replace(re, '');

// call-site rewires
t = t.replace(/this\.clearMerasmusMirrorDomAndFlags\(\)/g, 'this.merasmus.reset()');
t = t.replace(/this\.resetMerasmusState\(\)/g, 'this.merasmus.reset()');
t = t.replace(/this\.uninstallMerasmusPointerMirrorFix\(\)/g, 'this.merasmus.uninstallPointerMirrorFix()');
t = t.replace(/this\.installMerasmusPointerMirrorFix\(\)/g, 'this.merasmus.installPointerMirrorFix()');
t = t.replace(/this\.createMerasmusOverlays\(\)/g, 'this.merasmus.createOverlays()');
t = t.replace(/this\.toggleMerasmusFlip\(\)/g, 'this.merasmus.toggleFlip()');
t = t.replace(/this\.updateMerasmus\(delta\)/g, 'this.merasmus.update(delta)');
t = t.replace(/this\.merasmusViewFlipped\b/g, 'this.merasmus.isViewFlipped()');

// instantiate right after the audio field (constructor-time so reset() in
// resetGameState works before create() adds overlays)
t = t.replace(
  `  private merasmus!: MerasmusSystem;`,
  `  private merasmus: MerasmusSystem = new MerasmusSystem(this, this.audio, {
    isMerasmusEnabled: () => this.isMerasmusEnabled(),
    getGameStatus: () => this.gameStatus,
    isPausedNow: () => this.isPaused,
    isTeleportedNow: () => this.isTeleported,
    isCameraModeNow: () => this.isCameraMode,
    clearAimKeys: () => {
      this.keyADown = false;
      this.keyDDown = false;
    },
    gameOver: (reason) => this.gameOver(reason),
    onFlipStateChanged: () => this.mobileControls?.updateMerasmusFlipButton(),
  });`);

// import
t = t.replace(
  "import { HUD } from '../ui/HUD';",
  "import { HUD } from '../ui/HUD';\nimport { MerasmusSystem } from '../systems/MerasmusSystem';");

fs.writeFileSync(f, t);
console.log('done');
