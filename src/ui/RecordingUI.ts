import Phaser from 'phaser';
import { GameStatus } from '../types';

/** Scene state the Engineer recordings need; implemented by GameScene. */
export interface RecordingUIHost {
  getGameStatus(): GameStatus;
  getNightNumber(): number;
  isBadEndingNight6Now(): boolean;
  playCassetteStopSound(): void;
}

/**
 * Engineer recordings (phone calls): per-night HTMLAudio playback with a
 * SKIP button and blinking "PLAYING" indicator. Extracted from GameScene.
 */
export class RecordingUI {
  private recordingAudio: HTMLAudioElement | null = null;
  isRecordingPlaying: boolean = false;
  private recordingSkipButton!: Phaser.GameObjects.Container;
  private recordingIndicator!: Phaser.GameObjects.Container;
  private readonly recordingStartDelay: number = 5000; // 5 seconds into night
  private recordingStartTimer: number = 0;
  private hasPlayedRecording: boolean = false;
  private audioLogsEnabled: boolean = true; // Main menu toggle; when false, no recording each night

  constructor(
    private scene: Phaser.Scene,
    private host: RecordingUIHost,
  ) {}

  /**
   * Create the recording UI - skip button and playing indicator
   */
  create(): void {
    // Skip button - bottom right corner
    this.recordingSkipButton = this.scene.add.container(1200, 680);
    this.recordingSkipButton.setDepth(210);  // Above pause menu (200)
    this.recordingSkipButton.setVisible(false);
    
    const skipBg = this.scene.add.rectangle(0, 0, 80, 30, 0x333333, 0.9);
    skipBg.setStrokeStyle(2, 0x666666);
    skipBg.setInteractive({ useHandCursor: true });
    
    const skipText = this.scene.add.text(0, 0, 'SKIP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    
    skipBg.on('pointerover', () => {
      skipBg.setFillStyle(0x555555);
      skipText.setColor('#ffffff');
    });
    
    skipBg.on('pointerout', () => {
      skipBg.setFillStyle(0x333333);
      skipText.setColor('#aaaaaa');
    });
    
    skipBg.on('pointerdown', () => {
      this.host.playCassetteStopSound();
      this.stop();
    });
    
    this.recordingSkipButton.add([skipBg, skipText]);
    
    // Recording indicator - tape recorder icon with waveform
    this.recordingIndicator = this.scene.add.container(1100, 680);
    this.recordingIndicator.setDepth(210);  // Above pause menu (200)
    this.recordingIndicator.setVisible(false);
    
    const indicatorBg = this.scene.add.rectangle(0, 0, 100, 30, 0x1a1a1a, 0.9);
    indicatorBg.setStrokeStyle(1, 0x444444);
    
    const tapeIcon = this.scene.add.text(-35, 0, '(●)', {
      fontSize: '12px',
      color: '#ff4444',
    }).setOrigin(0.5);
    
    const playingText = this.scene.add.text(15, 0, 'PLAYING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#00ff00',
    }).setOrigin(0.5);
    
    // Blink the playing text
    this.scene.tweens.add({
      targets: playingText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    this.recordingIndicator.add([indicatorBg, tapeIcon, playingText]);
  }

  /** Reset per-night recording state (called from resetGameState). */
  reset(): void {
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
  }

  /** Tick the start-delay timer; kicks off playback ~5s into the night. */
  update(delta: number): void {
    if (!this.hasPlayedRecording && !this.isRecordingPlaying) {
      this.recordingStartTimer += delta;
      if (this.recordingStartTimer >= this.recordingStartDelay) {
        this.start();
      }
    }
  }

  /** Pause the recording audio while the game is paused. */
  pauseAudio(): void {
    if (this.recordingAudio && this.isRecordingPlaying) {
      this.recordingAudio.pause();
    }
  }

  /** Resume the recording audio when the game unpauses. */
  resumeAudio(): void {
    if (this.recordingAudio && this.isRecordingPlaying) {
      this.recordingAudio.play();
    }
  }

  /**
   * Start playing the Engineer recording for the current night
   */
  start(): void {
    // Don't play if already played, already loading, or game not playing
    if (this.hasPlayedRecording || this.host.getGameStatus() !== 'PLAYING') return;
    
    // Mark as played IMMEDIATELY to prevent multiple calls
    this.hasPlayedRecording = true;
    
    // Determine which recording to play based on night number
    let recordingFile = `night${this.host.getNightNumber()}.mp3`;
    
    // Special case for Night 6 bad ending
    if (this.host.getNightNumber() === 6 && this.host.isBadEndingNight6Now()) {
      recordingFile = 'night6.mp3';
    }
    
    // Try to load and play the audio
    try {
      this.recordingAudio = new Audio(`./audio/recordings/${recordingFile}`);
      this.recordingAudio.volume = 0.7;
      
      this.recordingAudio.addEventListener('canplaythrough', () => {
        if (this.recordingAudio && this.host.getGameStatus() === 'PLAYING') {
          this.recordingAudio.play();
          this.isRecordingPlaying = true;
          this.recordingSkipButton.setVisible(true);
          this.recordingIndicator.setVisible(true);
          console.log(`🎙️ Playing Engineer recording: ${recordingFile}`);
        }
      });
      
      this.recordingAudio.addEventListener('ended', () => {
        this.stop();
      });
      
      this.recordingAudio.addEventListener('error', () => {
        console.log(`🎙️ No recording found for: ${recordingFile}`);
        this.hasPlayedRecording = true; // Mark as played so we don't retry
      });
      
      this.recordingAudio.load();
    } catch (e) {
      console.log('🎙️ Audio playback not supported');
      this.hasPlayedRecording = true;
    }
  }

  /**
   * Stop the current recording
   */
  stop(): void {
    if (this.recordingAudio) {
      this.recordingAudio.pause();
      this.recordingAudio.currentTime = 0;
      this.recordingAudio = null;
    }
    
    this.isRecordingPlaying = false;
    this.hasPlayedRecording = true;
    this.recordingSkipButton?.setVisible(false);
    this.recordingIndicator?.setVisible(false);
    console.log('🎙️ Recording stopped');
  }
}
