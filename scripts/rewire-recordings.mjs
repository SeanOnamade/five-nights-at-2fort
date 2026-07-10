// One-shot: rewires GameScene to use the RecordingUI class.
import fs from 'node:fs';

const f = 'src/scenes/GameScene.ts';
let t = fs.readFileSync(f, 'utf8');
const before = t;

// remove field declarations
t = t.replace(
  `  private recordingAudio: HTMLAudioElement | null = null;
  private isRecordingPlaying: boolean = false;
  private recordingSkipButton!: Phaser.GameObjects.Container;
  private recordingIndicator!: Phaser.GameObjects.Container;
  private recordingStartDelay: number = 5000; // 5 seconds into night
  private recordingStartTimer: number = 0;
  private hasPlayedRecording: boolean = false;
  private audioLogsEnabled: boolean = true; // Main menu toggle; when false, no recording each night
`,
  `  private recordings!: RecordingUI;
`);

// reset block
t = t.replace(
  `    // Reset Engineer recording state
    this.recordingStartTimer = 0;
    this.hasPlayedRecording = false;
    this.isRecordingPlaying = false;
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio = null;
    }
    // Respect main menu "Audio logs" toggle (default on)
    this.audioLogsEnabled = localStorage.getItem('audioLogsEnabled') !== 'false';
    if (!this.audioLogsEnabled) this.hasPlayedRecording = true; // Skip recording this night
`,
  `    // Reset Engineer recording state (respects main menu Audio logs toggle)
    this.recordings?.reset();
`);

// stop calls
t = t.replace(/this\.stopRecording\(\)/g, 'this.recordings.stop()');

// pause/resume in togglePause
t = t.replace(
  `      // Pause Engineer recording if playing
      if (this.recordingAudio && this.isRecordingPlaying) {
        this.recordingAudio.pause();
      }
`,
  `      // Pause Engineer recording if playing
      this.recordings.pauseAudio();
`);
t = t.replace(
  `      // Resume Engineer recording if it was playing
      if (this.recordingAudio && this.isRecordingPlaying) {
        this.recordingAudio.play();
      }
`,
  `      // Resume Engineer recording if it was playing
      this.recordings.resumeAudio();
`);

// update loop timer block
t = t.replace(
  `    // ---- ENGINEER RECORDING TIMER ----
    if (!this.hasPlayedRecording && !this.isRecordingPlaying) {
      this.recordingStartTimer += delta;
      if (this.recordingStartTimer >= this.recordingStartDelay) {
        this.startRecording();
      }
    }
`,
  `    // ---- ENGINEER RECORDING TIMER ----
    this.recordings.update(delta);
`);

// creation
t = t.replace(
  `    this.createRecordingUI();`,
  `    this.recordings = new RecordingUI(this, {
      getGameStatus: () => this.gameStatus,
      getNightNumber: () => this.nightNumber,
      isBadEndingNight6Now: () => this.isBadEndingNight6,
      playCassetteStopSound: () => this.audio.playCassetteStopSound(),
    });
    this.recordings.create();`);

t = t.replace(
  "import { buildCameraUI } from '../ui/CameraUI';",
  "import { buildCameraUI } from '../ui/CameraUI';\nimport { RecordingUI } from '../ui/RecordingUI';");

fs.writeFileSync(f, t);
console.log('changed:', before !== t);
