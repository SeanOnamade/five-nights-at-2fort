// One-shot transform: turns extracted GameScene camera-UI methods into builder functions.
import fs from 'node:fs';

const fields = ['cameraUI','cameraFeedPanel','cameraFeedTitle','cameraFeedEmpty','cameraFeedEnemyEyeGlow','cameraFeedEnemy2','cameraFeedEnemy3','cameraFeedEnemy','cameraFeedDemoHead','cameraLureIndicator','cameraStaticGraphics','mapTitleText','cameraMapContent','cameraMapNodes','hackedRoomMapIndicators','intelRoomIcon','scoutMapIcon','soldierMapIcon','cameraStaticBurstOverlay','cameraDestroyedOverlay','cameraDestroyedText','cameraRepairButton','cameraWatchWarning','cameraWatchBar','cameraBootOverlay','administratorHackBarContainer','administratorHackBarBorder','administratorHackBarFill','administratorHackBarCross','administratorRepairOverlay','administratorRepairBarFill','teleportButton','teleportButtonBg','teleportButtonText','teleportRepairBarBg','teleportRepairBarFill','cameraLureButton','roomViewUI','roomDoorway','roomDoorwayEyes','roomViewHeader','returnButton','lureButton','escapeWarning','pyroEscapeWarning','pyroEscapeTimer'];

let t = fs.readFileSync(process.env.TMP + '/cam.txt', 'utf8');

// method signatures -> builder functions
t = t.replace(/^  private createCameraUI\(\): void \{/m, 'function buildMainCameraUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {');
t = t.replace(/^  private createCameraDestroyedOverlay\(\): void \{/m, 'function buildCameraDestroyedOverlay(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {');
t = t.replace(/^  private createAdministratorHackUI\(\): void \{/m, 'function buildAdministratorHackUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {');
t = t.replace(/^  private createTeleporterUI\(\): void \{/m, 'function buildTeleporterUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {');
t = t.replace(/^  private createRoomViewUI\(\): void \{/m, 'function buildRoomViewUI(scene: Phaser.Scene, hooks: CameraUIHooks, el: CameraUIElements): void {');

// closing braces of methods were '  }' at indent 2 -> keep (function bodies now at same indent)

// sub-build calls
t = t.replace(/this\.createCameraDestroyedOverlay\(\);/g, 'buildCameraDestroyedOverlay(scene, hooks, el);');
t = t.replace(/this\.createAdministratorHackUI\(\);/g, 'buildAdministratorHackUI(scene, hooks, el);');
t = t.replace(/this\.createTeleporterUI\(\);/g, 'buildTeleporterUI(scene, hooks, el);');
t = t.replace(/this\.createRoomViewUI\(\);/g, 'buildRoomViewUI(scene, hooks, el);');

// scene services
t = t.replace(/this\.add\./g, 'scene.add.');
t = t.replace(/this\.tweens\./g, 'scene.tweens.');
t = t.replace(/this\.time\./g, 'scene.time.');

// owned fields
t = t.replace(new RegExp('this\\.(' + fields.join('|') + ')\\b', 'g'), 'el.$1');

fs.writeFileSync(process.env.TMP + '/cam-transformed.txt', t);
console.log('remaining this. references:');
const rest = t.match(/this\.[a-zA-Z_]+/g) || [];
const counts = {};
for (const r of rest) counts[r] = (counts[r] || 0) + 1;
console.log(counts);
