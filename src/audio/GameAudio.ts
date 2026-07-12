import { GameStatus, GAME_CONSTANTS } from '../types';
import type { PyroEnemy } from '../entities/PyroEnemy';
import { getMusicVolume, getSfxVolume } from '../utils/settings';

/**
 * Narrow view of the game state that sounds need to read.
 * GameScene supplies this so the audio engine stays decoupled from scene internals.
 */
export interface GameAudioHost {
  getNightNumber(): number;
  getGameStatus(): GameStatus;
  isPausedNow(): boolean;
  isTeleportedNow(): boolean;
  isCameraModeNow(): boolean;
  getPyro(): PyroEnemy | undefined;
  isMerasmusEnabled(): boolean;
  isSniperEnabled(): boolean;
  isPyroEnabled(): boolean;
}

/**
 * GameAudio - procedural WebAudio sound engine for the game.
 * Owns the shared AudioContext, master bus, and all oscillator/ambient-loop state.
 * Extracted from GameScene; all sounds are synthesized (no audio assets).
 */
export class GameAudio {
  constructor(private host: GameAudioHost) {}

  merasmusHumPlaying: boolean = false;
  demoEyeGlowSoundPlaying: boolean = false;
  demoEyeGlowOscillator: OscillatorNode | null = null;
  demoEyeGlowOscillator2: OscillatorNode | null = null;
  demoEyeGlowLfo: OscillatorNode | null = null;
  demoEyeGlowLfoGain: GainNode | null = null;
  demoEyeGlowGain: GainNode | null = null;
  medicGhostAudioContext: AudioContext | null = null;  // For stopping scream
  medicGhostOscillators: OscillatorNode[] = [];  // Track oscillators to stop them
  merasmusHumOscillator: OscillatorNode | null = null;
  merasmusHumOscillator2: OscillatorNode | null = null;
  merasmusHumGain: GainNode | null = null;
  sapperSoundOscillator: OscillatorNode | null = null;
  sapperSoundModulator: OscillatorNode | null = null;
  sapperSoundGain: GainNode | null = null;
  isPlayingSapperSound: boolean = false;
  isPlayingDetectionSound: boolean = false;
  detectionSoundReleaseFrames: number = 0;
  detectionOscillator: OscillatorNode | null = null;
  detectionGain: GainNode | null = null;
  detectionLfo: OscillatorNode | null = null;
  detectionLfoGain: GainNode | null = null;
  isPlayingSniperHum: boolean = false;
  sniperHumOscillator: OscillatorNode | null = null;
  sniperHumOscillator2: OscillatorNode | null = null;  // Second harmonic oscillator
  sniperHumGain: GainNode | null = null;
  isPlayingPyroHallwayHiss: boolean = false;
  pyroHallwayHissStopping: boolean = false;
  pyroHallwayHissGain: GainNode | null = null;
  pyroHallwayHissBodyNoise: AudioBufferSourceNode | null = null;
  pyroHallwayHissBodyFilter: BiquadFilterNode | null = null;
  pyroHallwayHissBodyGain: GainNode | null = null;
  pyroHallwayHissHissNoise: AudioBufferSourceNode | null = null;
  pyroHallwayHissHissHighpass: BiquadFilterNode | null = null;
  pyroHallwayHissHissFilter: BiquadFilterNode | null = null;
  pyroHallwayHissHissGain: GainNode | null = null;
  pyroHallwayHissPanner: StereoPannerNode | null = null;
  pyroHallwayHissSide: 'LEFT' | 'RIGHT' | null = null;
  pyroHallwayHissStopTimeout: number | null = null;
  pyroHallwayHissAudible: boolean = false;
  pyroHallwayHissIntroDone: boolean = false;
  sharedAudioContext: AudioContext | null = null;
  masterAudioGain: GainNode | null = null;
  masterAudioCompressor: DynamicsCompressorNode | null = null;
  isPlayingDispenserHum: boolean = false;
  dispenserHumOscillator: OscillatorNode | null = null;
  dispenserHumOscillator2: OscillatorNode | null = null;
  dispenserHumLfo: OscillatorNode | null = null;
  dispenserHumSecondaryGain: GainNode | null = null;
  dispenserHumGain: GainNode | null = null;
  intelRoomAmbience: HTMLAudioElement | null = null;
  approachGrowlOsc: OscillatorNode | null = null;
  approachGrowlOsc2: OscillatorNode | null = null;
  approachGrowlGain: GainNode | null = null;
  pyroCracklingGain: GainNode | null = null;
  pyroCracklingInterval: number | null = null;
  pyroCracklingIntensity: number = 0; // 0-1, increases as time runs out
  pyroCracklingLastInterval: number = 200; // Track current interval speed
  cameraWarningSoundPlaying: boolean = false;
  pyroBurningSoundThrottle: number = 0;
  _administratorRepairSoundTimer: number = 0;

  /**
   * Get or create the shared AudioContext with a soft master compressor to tame stacking peaks.
   */
  ensureSharedAudioContext(): AudioContext | null {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.masterAudioGain = this.sharedAudioContext.createGain();
        this.masterAudioGain.gain.value = 1;
        this.masterAudioCompressor = this.sharedAudioContext.createDynamicsCompressor();
        this.masterAudioCompressor.threshold.value = -18;
        this.masterAudioCompressor.knee.value = 12;
        this.masterAudioCompressor.ratio.value = 8;
        this.masterAudioCompressor.attack.value = 0.002;
        this.masterAudioCompressor.release.value = 0.15;
        this.masterAudioGain.connect(this.masterAudioCompressor);
        this.masterAudioCompressor.connect(this.sharedAudioContext.destination);
      }
      if (this.sharedAudioContext.state === 'suspended') {
        void this.sharedAudioContext.resume();
      }
      if (!this.masterAudioGain || !this.masterAudioCompressor) {
        this.masterAudioGain = this.sharedAudioContext.createGain();
        this.masterAudioGain.gain.value = 1;
        this.masterAudioCompressor = this.sharedAudioContext.createDynamicsCompressor();
        this.masterAudioCompressor.threshold.value = -18;
        this.masterAudioCompressor.knee.value = 12;
        this.masterAudioCompressor.ratio.value = 8;
        this.masterAudioCompressor.attack.value = 0.002;
        this.masterAudioCompressor.release.value = 0.15;
        this.masterAudioGain.connect(this.masterAudioCompressor);
        this.masterAudioCompressor.connect(this.sharedAudioContext.destination);
      }
      // Keep the master bus tracking the SFX volume setting; this runs on
      // every sound trigger so slider changes apply almost immediately.
      this.masterAudioGain.gain.value = getSfxVolume();
      return this.sharedAudioContext;
    } catch {
      return null;
    }
  }

  /** Route game audio through the shared master bus (with soft limiting). */
  connectGameAudio(node: AudioNode): void {
    const ctx = this.ensureSharedAudioContext();
    if (!ctx) return;
    if (this.masterAudioGain) {
      node.connect(this.masterAudioGain);
    } else {
      node.connect(this.bus(ctx));
    }
  }

  /**
   * Output bus for a node's final connect. Routes through the master gain
   * (SFX volume + limiter) when the node belongs to the shared context;
   * falls back to the raw destination for standalone contexts.
   */
  private bus(ctx: AudioContext): AudioNode {
    if (ctx === this.sharedAudioContext && this.masterAudioGain) {
      return this.masterAudioGain;
    }
    return ctx.destination;
  }

  /** Stop and disconnect an oscillator node safely. */
  stopOscillator(node: OscillatorNode | null): null {
    if (!node) return null;
    try {
      node.stop();
      node.disconnect();
    } catch {
      // Already stopped
    }
    return null;
  }

  /**
   * Magical, creepy shimmer when the display mirrors horizontally (Merasmus flip).
   * Rising and bright when entering the mirror, falling and darker when leaving it.
   */
  playMerasmusFlipSound(mirrored: boolean): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      const now = audioContext.currentTime;
      const duration = 0.7;

      // Detuned shimmer pair - the "magic" (slow beat between two close pitches)
      const shimmerFreqs = mirrored ? [420, 427] : [640, 646];
      shimmerFreqs.forEach((freq) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        if (mirrored) {
          osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + duration);
        } else {
          osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + duration);
        }

        // Slow vibrato for an unsettling wobble
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        lfo.frequency.value = 6.5;
        lfoGain.gain.value = 9;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
      });

      // Dark undertone - low sweep opposite to the shimmer, gives it menace
      const under = audioContext.createOscillator();
      const underGain = audioContext.createGain();
      under.type = 'sine';
      if (mirrored) {
        under.frequency.setValueAtTime(160, now);
        under.frequency.exponentialRampToValueAtTime(55, now + duration);
      } else {
        under.frequency.setValueAtTime(60, now);
        under.frequency.exponentialRampToValueAtTime(140, now + duration);
      }
      underGain.gain.setValueAtTime(0.14, now);
      underGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      under.connect(underGain);
      underGain.connect(this.bus(audioContext));
      under.start(now);
      under.stop(now + duration);

      // Whispery sparkle - airy filtered noise that swells and fades
      const noiseDuration = 0.5;
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * noiseDuration, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI);
      }
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = audioContext.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.Q.value = 1.5;
      if (mirrored) {
        noiseFilter.frequency.setValueAtTime(2000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(5000, now + noiseDuration);
      } else {
        noiseFilter.frequency.setValueAtTime(5000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(1800, now + noiseDuration);
      }
      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.1, now + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.bus(audioContext));
      noise.start(now);
      noise.stop(now + noiseDuration);
    } catch (e) {
      // Audio not available
    }
  }

  startMerasmusHum(): void {
    if (this.merasmusHumPlaying || this.merasmusHumOscillator) return;

    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;

      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const mainGain = audioContext.createGain();

      osc1.type = 'sine';
      osc1.frequency.value = 52;
      osc2.type = 'triangle';
      osc2.frequency.value = 78;

      osc1.connect(mainGain);
      osc2.connect(mainGain);
      this.connectGameAudio(mainGain);

      mainGain.gain.value = 0;

      osc1.start();
      osc2.start();

      this.merasmusHumOscillator = osc1;
      this.merasmusHumOscillator2 = osc2;
      this.merasmusHumGain = mainGain;
      this.merasmusHumPlaying = true;
    } catch {
      this.stopMerasmusHum();
    }
  }

  stopMerasmusHum(): void {
    if (!this.merasmusHumPlaying && !this.merasmusHumOscillator) return;

    try {
      if (this.merasmusHumGain) {
        this.merasmusHumGain.disconnect();
      }
    } catch {
      /* already disconnected */
    }

    this.merasmusHumOscillator = this.stopOscillator(this.merasmusHumOscillator);
    this.merasmusHumOscillator2 = this.stopOscillator(this.merasmusHumOscillator2);
    this.merasmusHumGain = null;
    this.merasmusHumPlaying = false;
  }

  updateMerasmusHumVolume(displayAlpha: number): void {
    if (!this.host.isMerasmusEnabled()) return;

    if (displayAlpha <= 0.001) {
      if (this.merasmusHumPlaying) {
        this.stopMerasmusHum();
      }
      return;
    }

    if (!this.merasmusHumPlaying) {
      this.startMerasmusHum();
    }

    if (this.merasmusHumGain) {
      this.merasmusHumGain.gain.value = 0.02 + displayAlpha * 0.18;
    }
  }

  playMerasmusCackle(): void {
    try {
      const a = new Audio('./audio/merasmus-cackle.mp3');
      a.volume = 0.85 * getSfxVolume();
      void a.play().catch(() => {});
    } catch {
      /* missing or blocked audio */
    }
  }

  /**
   * Play Medic voice lure sound
   */
  playLureSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Medic voice-like sound (German accent "MEDIC!")
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // Warbling voice-like sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(450, audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.6);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sound when lure is placed - short confirmation beep
   */
  playLurePlacedSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Short rising confirmation beep
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sound when lure is consumed - distinctive "power down" sound
   */
  playLureConsumedSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Descending "power down" tone to indicate lure stopped
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play victory chime - triumphant fanfare
   */
  playVictoryChime(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Triumphant chord sequence
      const notes = [
        { freq: 523.25, time: 0, dur: 0.2 },     // C5
        { freq: 659.25, time: 0.15, dur: 0.2 },  // E5
        { freq: 783.99, time: 0.3, dur: 0.2 },   // G5
        { freq: 1046.50, time: 0.45, dur: 0.5 }, // C6 (hold)
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = audioContext.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur + 0.1);
      });
      
      // Add sparkle effect
      for (let i = 0; i < 5; i++) {
        const sparkle = audioContext.createOscillator();
        const sparkleGain = audioContext.createGain();
        sparkle.connect(sparkleGain);
        sparkleGain.connect(this.bus(audioContext));
        
        sparkle.type = 'sine';
        sparkle.frequency.value = 2000 + Math.random() * 2000;
        
        const t = audioContext.currentTime + 0.5 + i * 0.1;
        sparkleGain.gain.setValueAtTime(0.08, t);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        sparkle.start(t);
        sparkle.stop(t + 0.2);
      }
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play 6 AM bell chime - somber church bell for endless Night 6
   * Plays at each 6 AM to mock the player that the night isn't ending
   */
  play6AMBellChime(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Deep, somber church bell (6 chimes for 6 AM)
      for (let i = 0; i < 6; i++) {
        const startTime = audioContext.currentTime + i * 0.8;
        
        // Main bell tone (low)
        const bellOsc = audioContext.createOscillator();
        const bellGain = audioContext.createGain();
        bellOsc.connect(bellGain);
        bellGain.connect(this.bus(audioContext));
        
        bellOsc.type = 'sine';
        bellOsc.frequency.value = 220;  // A3 - deep bell
        
        bellGain.gain.setValueAtTime(0, startTime);
        bellGain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        bellGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.7);
        
        bellOsc.start(startTime);
        bellOsc.stop(startTime + 0.8);
        
        // Overtone (higher)
        const overOsc = audioContext.createOscillator();
        const overGain = audioContext.createGain();
        overOsc.connect(overGain);
        overGain.connect(this.bus(audioContext));
        
        overOsc.type = 'sine';
        overOsc.frequency.value = 440;  // A4 - overtone
        
        overGain.gain.setValueAtTime(0, startTime);
        overGain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        overGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        
        overOsc.start(startTime);
        overOsc.stop(startTime + 0.6);
      }
      
      console.log('🔔 6 AM bell chimes... but the night continues');
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play give up sound - melancholic descending sigh
   */
  playGiveUpSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Descending minor "sigh" - like giving up hope
      const notes = [
        { freq: 440, time: 0, dur: 0.35 },      // A4
        { freq: 392, time: 0.25, dur: 0.35 },   // G4
        { freq: 330, time: 0.5, dur: 0.35 },    // E4
        { freq: 294, time: 0.75, dur: 0.6 },    // D4 (sad resolve - A minor feel)
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = 'triangle';  // Softer, sadder tone
        osc.frequency.value = note.freq;
        
        const startTime = audioContext.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur + 0.1);
      });
      
      // Add a quiet low drone underneath for weight
      const drone = audioContext.createOscillator();
      const droneGain = audioContext.createGain();
      drone.connect(droneGain);
      droneGain.connect(this.bus(audioContext));
      
      drone.type = 'sine';
      drone.frequency.value = 110;  // A2 - low drone (matches A minor)
      
      droneGain.gain.setValueAtTime(0, audioContext.currentTime);
      droneGain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.2);
      droneGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
      
      drone.start(audioContext.currentTime);
      drone.stop(audioContext.currentTime + 1.3);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play good ending sound - triumphant, celebratory fanfare
   */
  playGoodEndingSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Triumphant fanfare - ascending major chord progression
      const notes = [
        { freq: 523.25, time: 0, dur: 0.25 },     // C5
        { freq: 659.25, time: 0.2, dur: 0.25 },   // E5
        { freq: 783.99, time: 0.4, dur: 0.25 },   // G5
        { freq: 1046.50, time: 0.6, dur: 0.6 },   // C6
        // Harmony layer
        { freq: 392.00, time: 0, dur: 0.8 },      // G4 (bass)
        { freq: 523.25, time: 0.6, dur: 0.6 },    // C5 (harmony)
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = audioContext.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur + 0.1);
      });
      
      // Victory sparkles
      for (let i = 0; i < 8; i++) {
        const sparkle = audioContext.createOscillator();
        const sparkleGain = audioContext.createGain();
        sparkle.connect(sparkleGain);
        sparkleGain.connect(this.bus(audioContext));
        
        sparkle.type = 'sine';
        sparkle.frequency.value = 1500 + Math.random() * 2500;
        
        const t = audioContext.currentTime + 0.8 + i * 0.08;
        sparkleGain.gain.setValueAtTime(0.06, t);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        
        sparkle.start(t);
        sparkle.stop(t + 0.15);
      }
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play bad ending intro sound - ominous, creepy atmosphere
   */
  playBadEndingIntroSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Deep, ominous drone
      const drone = audioContext.createOscillator();
      const droneGain = audioContext.createGain();
      drone.connect(droneGain);
      droneGain.connect(this.bus(audioContext));
      
      drone.type = 'sawtooth';
      drone.frequency.value = 55;  // A1 - very low
      
      droneGain.gain.setValueAtTime(0, audioContext.currentTime);
      droneGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 1);
      droneGain.gain.setValueAtTime(0.15, audioContext.currentTime + 3);
      droneGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 5);
      
      drone.start(audioContext.currentTime);
      drone.stop(audioContext.currentTime + 5);
      
      // Dissonant accents
      const accents = [
        { freq: 116.54, time: 0.5 },  // Bb2
        { freq: 138.59, time: 1.5 },  // C#3
        { freq: 103.83, time: 2.5 },  // Ab2
      ];
      
      accents.forEach(accent => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = 'sine';
        osc.frequency.value = accent.freq;
        
        const t = audioContext.currentTime + accent.time;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
        
        osc.start(t);
        osc.stop(t + 1.2);
      });
      
      // Heartbeat-like pulse
      for (let i = 0; i < 4; i++) {
        const beat = audioContext.createOscillator();
        const beatGain = audioContext.createGain();
        beat.connect(beatGain);
        beatGain.connect(this.bus(audioContext));
        
        beat.type = 'sine';
        beat.frequency.value = 40;
        
        const t = audioContext.currentTime + 3.5 + i * 0.8;
        beatGain.gain.setValueAtTime(0.2, t);
        beatGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        
        beat.start(t);
        beat.stop(t + 0.4);
      }
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play dark ending sound - melancholic, lonely melody
   */
  playDarkEndingSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Slow, sad minor melody
      const notes = [
        { freq: 329.63, time: 0, dur: 0.8 },      // E4
        { freq: 293.66, time: 0.7, dur: 0.8 },    // D4
        { freq: 261.63, time: 1.4, dur: 0.8 },    // C4
        { freq: 246.94, time: 2.1, dur: 1.2 },    // B3
        { freq: 220.00, time: 3.0, dur: 1.5 },    // A3 (resolve)
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = audioContext.currentTime + note.time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
        gain.gain.setValueAtTime(0.15, startTime + note.dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.dur);
        
        osc.start(startTime);
        osc.stop(startTime + note.dur + 0.1);
      });
      
      // Quiet ambient pad underneath
      const pad = audioContext.createOscillator();
      const padGain = audioContext.createGain();
      pad.connect(padGain);
      padGain.connect(this.bus(audioContext));
      
      pad.type = 'sine';
      pad.frequency.value = 110;  // A2
      
      padGain.gain.setValueAtTime(0, audioContext.currentTime);
      padGain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.5);
      padGain.gain.setValueAtTime(0.08, audioContext.currentTime + 4);
      padGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 5);
      
      pad.start(audioContext.currentTime);
      pad.stop(audioContext.currentTime + 5);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Start the Demoman eye glow fire sound (looping crackle)
   */
  startDemoEyeGlowSound(): void {
    if (this.demoEyeGlowSoundPlaying || this.demoEyeGlowOscillator) return;
    
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      const mainGain = audioContext.createGain();
      
      lfo.type = 'square';
      lfo.frequency.value = 8;
      lfo.connect(lfoGain);
      lfoGain.gain.value = 30;
      lfoGain.connect(osc1.frequency);
      
      osc1.type = 'sawtooth';
      osc1.frequency.value = 80;
      osc2.type = 'triangle';
      osc2.frequency.value = 120;
      
      osc1.connect(mainGain);
      osc2.connect(mainGain);
      this.connectGameAudio(mainGain);
      
      mainGain.gain.value = 0.08;
      
      lfo.start();
      osc1.start();
      osc2.start();
      
      this.demoEyeGlowOscillator = osc1;
      this.demoEyeGlowOscillator2 = osc2;
      this.demoEyeGlowLfo = lfo;
      this.demoEyeGlowLfoGain = lfoGain;
      this.demoEyeGlowGain = mainGain;
      this.demoEyeGlowSoundPlaying = true;
    } catch (e) {
      this.stopDemoEyeGlowSound();
    }
  }

  /**
   * Stop the Demoman eye glow fire sound
   */
  stopDemoEyeGlowSound(): void {
    if (!this.demoEyeGlowSoundPlaying && !this.demoEyeGlowOscillator) return;
    
    try {
      if (this.demoEyeGlowGain) {
        this.demoEyeGlowGain.disconnect();
      }
    } catch {
      // Already disconnected
    }

    this.demoEyeGlowOscillator = this.stopOscillator(this.demoEyeGlowOscillator);
    this.demoEyeGlowOscillator2 = this.stopOscillator(this.demoEyeGlowOscillator2);
    this.demoEyeGlowLfo = this.stopOscillator(this.demoEyeGlowLfo);
    if (this.demoEyeGlowLfoGain) {
      try { this.demoEyeGlowLfoGain.disconnect(); } catch { /* ignore */ }
    }
    this.demoEyeGlowGain = null;
    this.demoEyeGlowLfoGain = null;
    this.demoEyeGlowSoundPlaying = false;
  }

  /**
   * Play jumpscare sound for game over
   */
  playJumpscareSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Loud stinger chord
      const frequencies = [120, 180, 240, 360];  // Dissonant chord
      frequencies.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.bus(audioContext));
        
        osc.type = i === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioContext.currentTime + 0.8);
        
        gain.gain.setValueAtTime(0.4, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.8);
      });
      
      // Harsh noise burst
      const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSource = audioContext.createBufferSource();
      const noiseGain = audioContext.createGain();
      noiseSource.buffer = noiseBuffer;
      noiseSource.connect(noiseGain);
      noiseGain.connect(this.bus(audioContext));
      noiseGain.gain.setValueAtTime(0.5, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      noiseSource.start(audioContext.currentTime);
      
      // Deep bass hit
      const bassOsc = audioContext.createOscillator();
      const bassGain = audioContext.createGain();
      bassOsc.connect(bassGain);
      bassGain.connect(this.bus(audioContext));
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(40, audioContext.currentTime);
      bassOsc.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
      bassGain.gain.setValueAtTime(0.6, audioContext.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      bassOsc.start(audioContext.currentTime);
      bassOsc.stop(audioContext.currentTime + 0.5);
      
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play camera switch sound - consistent volume
   */
  playCameraSwitchSound(): void {
    try {
      // Reuse shared audio context for consistent volume
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // Consistent click sound
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.03);
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);  // Fixed volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play Heavy footstep sound - THREE loud thuds (old style, louder)
   */
  playHeavyFootsteps(volume: number): void {
    if (this.host.getNightNumber() < 3) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Volume based on distance - VERY LOUD (minimum 0.4, max 1.0)
      const actualVolume = Math.max(0.4, volume) * 1.0;
      
      // Play THREE thuds with slight delays
      const thudDelays = [0, 0.2, 0.45]; // Timing for each thud
      
      thudDelays.forEach((delay) => {
        const thudTime = audioContext.currentTime + delay;
        
        // OLD STYLE - Deep thudding footstep
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const osc3 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc3.connect(gainNode);
        gainNode.connect(this.bus(audioContext));
        
        // Very low frequency thud - impact
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(40, thudTime);
        osc1.frequency.exponentialRampToValueAtTime(20, thudTime + 0.3);
        
        // Mid rumble
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(70, thudTime);
        osc2.frequency.exponentialRampToValueAtTime(30, thudTime + 0.2);
        
        // High transient click
        osc3.type = 'square';
        osc3.frequency.setValueAtTime(150, thudTime);
        osc3.frequency.exponentialRampToValueAtTime(50, thudTime + 0.05);
        
        gainNode.gain.setValueAtTime(actualVolume, thudTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, thudTime + 0.35);
        
        osc1.start(thudTime);
        osc1.stop(thudTime + 0.35);
        osc2.start(thudTime);
        osc2.stop(thudTime + 0.25);
        osc3.start(thudTime);
        osc3.stop(thudTime + 0.08);
      });
      
    } catch (e) {
      // Audio error
    }
  }

  /**
   * Play teleport sound effect - sci-fi zap/whoosh
   */
  playTeleportSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // High-pitched rising tone
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // Rising sci-fi sweep
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(200, audioContext.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.15);
      
      // Harmonic for thickness
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300, audioContext.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1500, audioContext.currentTime + 0.15);
      
      // Lowpass filter for sci-fi effect
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(4000, audioContext.currentTime + 0.1);
      filter.Q.value = 5;
      
      // Quick fade in/out
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.2);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play enemy approaching warning sound - growing growl
   */
  playEnemyApproachSound(): void {
    this.startApproachGrowl();
  }

  /**
   * Start the growling sound that intensifies during escape countdown
   */
  startApproachGrowl(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      this.stopApproachGrowl();
      
      this.approachGrowlOsc = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      this.approachGrowlOsc2 = osc2;
      this.approachGrowlGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      this.approachGrowlOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(this.approachGrowlGain);
      this.connectGameAudio(this.approachGrowlGain);
      
      // Low menacing rumble
      this.approachGrowlOsc.type = 'sawtooth';
      this.approachGrowlOsc.frequency.setValueAtTime(50, audioContext.currentTime);
      
      // Secondary growl tone
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(70, audioContext.currentTime);
      
      // Lowpass filter for rumble
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, audioContext.currentTime);
      filter.Q.value = 2;
      
      // Start quiet, will be updated by updateApproachGrowl
      this.approachGrowlGain.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      this.approachGrowlOsc.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      
      // Stop after 6 seconds max
      this.approachGrowlOsc.stop(audioContext.currentTime + 6);
      osc2.stop(audioContext.currentTime + 6);
      
    } catch (e) {
      // Audio error
    }
  }

  /**
   * Update growl intensity based on time remaining
   */
  updateApproachGrowl(timeRemaining: number): void {
    if (!this.approachGrowlGain || !this.sharedAudioContext) return;
    
    try {
      // Intensity increases as time runs out (5s -> 0s maps to 0.1 -> 0.8)
      const maxTime = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
      const progress = 1 - (timeRemaining / maxTime);
      const volume = 0.08 + (progress * 0.32);
      
      this.approachGrowlGain.gain.setValueAtTime(volume, this.sharedAudioContext.currentTime);
      
      // Also increase filter frequency for more intensity
      if (this.approachGrowlOsc) {
        const freq = 50 + (progress * 100);
        this.approachGrowlOsc.frequency.setValueAtTime(freq, this.sharedAudioContext.currentTime);
      }
    } catch (e) {
      // Audio error
    }
  }

  /**
   * Stop the approach growl sound
   */
  stopApproachGrowl(): void {
    if (this.approachGrowlOsc) {
      try {
        this.approachGrowlOsc.stop();
        this.approachGrowlOsc.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.approachGrowlOsc = null;
    }
    if (this.approachGrowlOsc2) {
      try {
        this.approachGrowlOsc2.stop();
        this.approachGrowlOsc2.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.approachGrowlOsc2 = null;
    }
    if (this.approachGrowlGain) {
      try {
        this.approachGrowlGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.approachGrowlGain = null;
    }
  }

  /**
   * Play Sniper charge warning sound - rising tension
   */
  playSniperChargeSound(): void {
    if (this.host.getNightNumber() < 3) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Rising warning tone
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, audioContext.currentTime + 1.5);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.5);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 1.5);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play Sniper teleport sound - eerie digital glitch/shimmer
   */
  playSniperTeleportSound(): void {
    if (!this.host.isSniperEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Eerie digital shimmer/glitch sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // High-pitched shimmer
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2000, audioContext.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 0.3);
      
      // Low rumble underneath
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(80, audioContext.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.3);
      osc2.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play Pyro match lighting sound - sharp click followed by fire fwoosh
   * Plays once when match is lit, does not loop.
   * LOUD - plays even when player is on cameras.
   */
  playPyroMatchSound(): void {
    if (!this.host.isPyroEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      
      // === PART 1: Sharp click (match head striking) ===
      // Very short, bright click sound - LOUD
      const clickBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.03, audioContext.sampleRate);
      const clickData = clickBuffer.getChannelData(0);
      for (let i = 0; i < clickData.length; i++) {
        // Sharp attack with fast decay
        const t = i / audioContext.sampleRate;
        clickData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 150);
      }
      const clickSource = audioContext.createBufferSource();
      clickSource.buffer = clickBuffer;
      
      // Highpass to make it bright and clicky
      const clickFilter = audioContext.createBiquadFilter();
      clickFilter.type = 'highpass';
      clickFilter.frequency.value = 2500;
      
      const clickGain = audioContext.createGain();
      clickGain.gain.setValueAtTime(0.7, now); // LOUDER
      
      clickSource.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.bus(audioContext));
      
      clickSource.start(now);
      clickSource.stop(now + 0.03);
      
      // === PART 2: Fire fwoosh (ignition) ===
      // Rising then falling noise with warmth - LOUD
      const fwooshDuration = 0.8;
      const fwooshBuffer = audioContext.createBuffer(1, audioContext.sampleRate * fwooshDuration, audioContext.sampleRate);
      const fwooshData = fwooshBuffer.getChannelData(0);
      for (let i = 0; i < fwooshData.length; i++) {
        const t = i / fwooshData.length;
        // Envelope: quick rise, sustained, gradual fall
        const envelope = Math.sin(t * Math.PI) * (1 - t * 0.3);
        fwooshData[i] = (Math.random() * 2 - 1) * envelope;
      }
      const fwooshSource = audioContext.createBufferSource();
      fwooshSource.buffer = fwooshBuffer;
      
      // Bandpass filter for fire-like warmth
      const fwooshFilter = audioContext.createBiquadFilter();
      fwooshFilter.type = 'bandpass';
      fwooshFilter.frequency.value = 500;
      fwooshFilter.Q.value = 0.6;
      
      const fwooshGain = audioContext.createGain();
      fwooshGain.gain.setValueAtTime(0, now + 0.02);
      fwooshGain.gain.linearRampToValueAtTime(0.6, now + 0.1);  // LOUDER
      fwooshGain.gain.linearRampToValueAtTime(0.45, now + 0.4);
      fwooshGain.gain.exponentialRampToValueAtTime(0.001, now + fwooshDuration + 0.02);
      
      fwooshSource.connect(fwooshFilter);
      fwooshFilter.connect(fwooshGain);
      fwooshGain.connect(this.bus(audioContext));
      
      fwooshSource.start(now + 0.02); // Start right after click
      fwooshSource.stop(now + 0.02 + fwooshDuration);
      
      // Start the ambient crackling sound after the match ignites
      this.startPyroCracklingAmbient();
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Start low ambient crackling sound while match is lit
   */
  startPyroCracklingAmbient(): void {
    // Stop any existing crackling first
    this.stopPyroCracklingAmbient();
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') return;
      const audioContext = this.sharedAudioContext;
      
      // Create master gain for crackling - starts quiet
      this.pyroCracklingGain = audioContext.createGain();
      this.pyroCracklingGain.gain.setValueAtTime(0.08, audioContext.currentTime);
      this.connectGameAudio(this.pyroCracklingGain);
      
      // Reset intensity tracking
      this.pyroCracklingIntensity = 0;
      this.pyroCracklingLastInterval = 200;
      
      // Start the crackling loop
      this.schedulePyroCrackle();
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Schedule the next crackle sound with dynamic timing based on intensity
   */
  schedulePyroCrackle(): void {
    if (!this.pyroCracklingGain || !this.sharedAudioContext) return;
    
    const audioContext = this.sharedAudioContext;
    
    // Check if Pyro's match is still lit
    const pyro = this.host.getPyro();
    if (!pyro || !pyro.isMatchLit()) {
      this.stopPyroCracklingAmbient();
      return;
    }
    
    // Calculate intensity based on escape time (0 = full time, 1 = about to die)
    const escapeRemaining = pyro.getEscapeTimeRemaining();
    const escapeTotal = GAME_CONSTANTS.PYRO_INTEL_ESCAPE_TIME;
    this.pyroCracklingIntensity = 1 - (escapeRemaining / escapeTotal);
    
    // Update gain: starts at 0.08, ramps up to 0.5 as intensity increases
    const baseGain = 0.08;
    const maxGain = 0.5;
    const currentGain = baseGain + (maxGain - baseGain) * this.pyroCracklingIntensity;
    
    try {
      this.pyroCracklingGain.gain.setValueAtTime(currentGain, audioContext.currentTime);
    } catch (e) {
      // Gain node may have been disconnected
    }
    
    // Play a crackle
    this.playPyroCrackleSound();
    
    // Schedule next crackle with dynamic interval
    // Starts at 200ms, accelerates to 40ms as intensity increases
    const baseInterval = 200;
    const minInterval = 40;
    const interval = baseInterval - (baseInterval - minInterval) * this.pyroCracklingIntensity;
    this.pyroCracklingLastInterval = interval;
    
    // Add some randomness but less as intensity increases (more frantic)
    const randomness = 50 * (1 - this.pyroCracklingIntensity * 0.7);
    const nextInterval = interval + Math.random() * randomness;
    
    this.pyroCracklingInterval = window.setTimeout(() => {
      this.schedulePyroCrackle();
    }, nextInterval);
  }

  /**
   * Play a single crackle sound
   */
  playPyroCrackleSound(): void {
    if (!this.pyroCracklingGain || !this.sharedAudioContext) return;
    
    try {
      const ctx = this.sharedAudioContext;
      const now = ctx.currentTime;
      
      // Random short crackle - duration decreases as intensity increases
      const baseDuration = 0.05 + Math.random() * 0.08;
      const duration = baseDuration * (1 - this.pyroCracklingIntensity * 0.3);
      
      const crackleBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleData.length; i++) {
        const env = Math.exp(-i / (crackleData.length * 0.3));
        crackleData[i] = (Math.random() * 2 - 1) * env;
      }
      const crackleSource = ctx.createBufferSource();
      crackleSource.buffer = crackleBuffer;
      
      // Bandpass for fire crackle - pitch increases with intensity
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800 + Math.random() * 600 + this.pyroCracklingIntensity * 400;
      filter.Q.value = 2;
      
      crackleSource.connect(filter);
      filter.connect(this.pyroCracklingGain!);
      
      crackleSource.start(now);
      crackleSource.stop(now + duration);
    } catch (e) {
      // Audio context issue
    }
  }

  /**
   * Stop ambient crackling sound
   */
  stopPyroCracklingAmbient(): void {
    if (this.pyroCracklingInterval) {
      clearTimeout(this.pyroCracklingInterval);
      this.pyroCracklingInterval = null;
    }
    if (this.pyroCracklingGain) {
      try {
        this.pyroCracklingGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.pyroCracklingGain = null;
    }
    this.pyroCracklingIntensity = 0;
  }

  /**
   * Create a looped noise buffer for Pyro hallway flame layers
   */
  createPyroHallwayNoiseBuffer(audioContext: AudioContext, durationSec: number): AudioBuffer {
    const bufferLength = audioContext.sampleRate * durationSec;
    const noiseBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  /**
   * Start steady lighter/flame hiss when Pyro is in a hallway (ROOM mode, Intel view)
   */
  startPyroHallwayHiss(side: 'LEFT' | 'RIGHT'): void {
    if (!this.host.isPyroEnabled()) return;

    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const loopDuration = 2;
      const bodyBuffer = this.createPyroHallwayNoiseBuffer(audioContext, loopDuration);
      const hissBuffer = this.createPyroHallwayNoiseBuffer(audioContext, loopDuration);

      // Low flame body layer
      this.pyroHallwayHissBodyNoise = audioContext.createBufferSource();
      this.pyroHallwayHissBodyNoise.buffer = bodyBuffer;
      this.pyroHallwayHissBodyNoise.loop = true;

      this.pyroHallwayHissBodyFilter = audioContext.createBiquadFilter();
      this.pyroHallwayHissBodyFilter.type = 'bandpass';
      this.pyroHallwayHissBodyFilter.frequency.value = 420;
      this.pyroHallwayHissBodyFilter.Q.value = 0.7;

      this.pyroHallwayHissBodyGain = audioContext.createGain();
      this.pyroHallwayHissBodyGain.gain.value = 0.65;

      // High lighter/flame hiss layer
      this.pyroHallwayHissHissNoise = audioContext.createBufferSource();
      this.pyroHallwayHissHissNoise.buffer = hissBuffer;
      this.pyroHallwayHissHissNoise.loop = true;

      this.pyroHallwayHissHissHighpass = audioContext.createBiquadFilter();
      this.pyroHallwayHissHissHighpass.type = 'highpass';
      this.pyroHallwayHissHissHighpass.frequency.value = 900;

      this.pyroHallwayHissHissFilter = audioContext.createBiquadFilter();
      this.pyroHallwayHissHissFilter.type = 'bandpass';
      this.pyroHallwayHissHissFilter.frequency.value = 1800;
      this.pyroHallwayHissHissFilter.Q.value = 0.8;

      this.pyroHallwayHissHissGain = audioContext.createGain();
      this.pyroHallwayHissHissGain.gain.value = 0.35;

      // Master gain — audibility controlled by updatePyroHallwayAudio (fade-in once per hallway visit)
      this.pyroHallwayHissGain = audioContext.createGain();
      this.pyroHallwayHissGain.gain.setValueAtTime(0, audioContext.currentTime);

      this.pyroHallwayHissPanner = audioContext.createStereoPanner();
      this.pyroHallwayHissPanner.pan.value = side === 'LEFT' ? -0.65 : 0.65;

      this.pyroHallwayHissBodyNoise.connect(this.pyroHallwayHissBodyFilter);
      this.pyroHallwayHissBodyFilter.connect(this.pyroHallwayHissBodyGain);
      this.pyroHallwayHissBodyGain.connect(this.pyroHallwayHissGain);

      this.pyroHallwayHissHissNoise.connect(this.pyroHallwayHissHissHighpass);
      this.pyroHallwayHissHissHighpass.connect(this.pyroHallwayHissHissFilter);
      this.pyroHallwayHissHissFilter.connect(this.pyroHallwayHissHissGain);
      this.pyroHallwayHissHissGain.connect(this.pyroHallwayHissGain);

      this.pyroHallwayHissGain.connect(this.pyroHallwayHissPanner);
      this.connectGameAudio(this.pyroHallwayHissPanner);

      this.pyroHallwayHissBodyNoise.start();
      this.pyroHallwayHissHissNoise.start();
      this.pyroHallwayHissSide = side;
      this.pyroHallwayHissStopping = false;
      this.isPlayingPyroHallwayHiss = true;
    } catch (e) {
      this.stopPyroHallwayHiss(true);
    }
  }

  /**
   * Fade in hallway hiss on first audible appearance this hallway visit
   */
  applyPyroHallwayHissAudible(fadeIn: boolean): void {
    if (!this.pyroHallwayHissGain || !this.sharedAudioContext) return;

    const audioContext = this.sharedAudioContext;
    const now = audioContext.currentTime;
    const maxGain = GAME_CONSTANTS.PYRO_HALLWAY_HISS_MAX_GAIN;

    try {
      this.pyroHallwayHissGain.gain.cancelScheduledValues(now);
      if (fadeIn) {
        this.pyroHallwayHissGain.gain.setValueAtTime(0, now);
        const fadeSec = GAME_CONSTANTS.PYRO_HALLWAY_HISS_FADE_MS / 1000;
        this.pyroHallwayHissGain.gain.linearRampToValueAtTime(maxGain, now + fadeSec);
      } else {
        this.pyroHallwayHissGain.gain.setValueAtTime(maxGain, now);
      }
    } catch (e) {
      // Gain node may have been disconnected
    }
  }

  /**
   * Mute hallway hiss while cameras are up or player is teleported (keeps loop running)
   */
  applyPyroHallwayHissMuted(): void {
    if (!this.pyroHallwayHissGain || !this.sharedAudioContext) return;

    try {
      const now = this.sharedAudioContext.currentTime;
      this.pyroHallwayHissGain.gain.cancelScheduledValues(now);
      this.pyroHallwayHissGain.gain.setValueAtTime(0, now);
    } catch (e) {
      // Gain node may have been disconnected
    }
  }

  /**
   * Update hallway hiss stereo pan when side changes mid-play
   */
  updatePyroHallwayHiss(side: 'LEFT' | 'RIGHT'): void {
    if (!this.isPlayingPyroHallwayHiss || !this.pyroHallwayHissPanner) return;

    this.pyroHallwayHissPanner.pan.value = side === 'LEFT' ? -0.65 : 0.65;
  }

  /**
   * Disconnect all Pyro hallway hiss audio nodes immediately
   */
  disconnectPyroHallwayHissNodes(): void {
    if (this.pyroHallwayHissStopTimeout !== null) {
      window.clearTimeout(this.pyroHallwayHissStopTimeout);
      this.pyroHallwayHissStopTimeout = null;
    }

    const stopSource = (source: AudioBufferSourceNode | null) => {
      if (!source) return;
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    };

    const disconnectNode = (node: AudioNode | null) => {
      if (!node) return;
      try {
        node.disconnect();
      } catch (e) {
        // Already disconnected
      }
    };

    stopSource(this.pyroHallwayHissBodyNoise);
    stopSource(this.pyroHallwayHissHissNoise);
    disconnectNode(this.pyroHallwayHissBodyFilter);
    disconnectNode(this.pyroHallwayHissBodyGain);
    disconnectNode(this.pyroHallwayHissHissHighpass);
    disconnectNode(this.pyroHallwayHissHissFilter);
    disconnectNode(this.pyroHallwayHissHissGain);
    disconnectNode(this.pyroHallwayHissGain);
    disconnectNode(this.pyroHallwayHissPanner);

    this.pyroHallwayHissBodyNoise = null;
    this.pyroHallwayHissBodyFilter = null;
    this.pyroHallwayHissBodyGain = null;
    this.pyroHallwayHissHissNoise = null;
    this.pyroHallwayHissHissHighpass = null;
    this.pyroHallwayHissHissFilter = null;
    this.pyroHallwayHissHissGain = null;
    this.pyroHallwayHissGain = null;
    this.pyroHallwayHissPanner = null;
    this.isPlayingPyroHallwayHiss = false;
    this.pyroHallwayHissStopping = false;
    this.pyroHallwayHissSide = null;
    this.pyroHallwayHissAudible = false;
    this.pyroHallwayHissIntroDone = false;
  }

  /**
   * Stop hallway lighter hiss (400ms fade-out unless immediate)
   */
  stopPyroHallwayHiss(immediate: boolean = false): void {
    if (!this.isPlayingPyroHallwayHiss && !this.pyroHallwayHissGain) {
      this.pyroHallwayHissStopping = false;
      return;
    }

    if (immediate || !this.pyroHallwayHissGain || !this.sharedAudioContext) {
      this.disconnectPyroHallwayHissNodes();
      return;
    }

    if (this.pyroHallwayHissStopping) return;

    this.pyroHallwayHissStopping = true;
    const audioContext = this.sharedAudioContext;
    const now = audioContext.currentTime;
    const fadeOutSec = 0.4;

    try {
      this.pyroHallwayHissGain.gain.cancelScheduledValues(now);
      this.pyroHallwayHissGain.gain.setValueAtTime(this.pyroHallwayHissGain.gain.value, now);
      this.pyroHallwayHissGain.gain.exponentialRampToValueAtTime(0.001, now + fadeOutSec);
    } catch (e) {
      this.disconnectPyroHallwayHissNodes();
      return;
    }

    this.pyroHallwayHissStopTimeout = window.setTimeout(() => {
      this.disconnectPyroHallwayHissNodes();
    }, fadeOutSec * 1000 + 50);
  }

  /**
   * Manage Pyro hallway hiss based on game state
   */
  updatePyroHallwayAudio(_delta: number): void {
    if (this.pyroHallwayHissStopping) return;

    const pyro = this.host.getPyro();
    const pyroInHallway =
      this.host.isPyroEnabled() &&
      pyro &&
      !pyro.isForceDespawned() &&
      pyro.shouldPlayHallwayHiss();

    const shouldAudible =
      pyroInHallway &&
      !this.host.isCameraModeNow() &&
      !this.host.isTeleportedNow();

    if (!pyroInHallway) {
      this.pyroHallwayHissAudible = false;
      this.pyroHallwayHissIntroDone = false;
      if (this.isPlayingPyroHallwayHiss) {
        this.stopPyroHallwayHiss();
      }
      return;
    }

    const side = this.host.getPyro()!.getHallway()!;

    if (!this.isPlayingPyroHallwayHiss) {
      this.startPyroHallwayHiss(side);
    } else if (this.pyroHallwayHissSide !== side) {
      this.pyroHallwayHissSide = side;
      this.updatePyroHallwayHiss(side);
    }

    if (shouldAudible && !this.pyroHallwayHissAudible) {
      this.pyroHallwayHissAudible = true;
      this.applyPyroHallwayHissAudible(!this.pyroHallwayHissIntroDone);
      this.pyroHallwayHissIntroDone = true;
    } else if (!shouldAudible && this.pyroHallwayHissAudible) {
      this.pyroHallwayHissAudible = false;
      this.applyPyroHallwayHissMuted();
    }
  }

  /**
   * Play Pyro burning/crackling ambient sound (for camera viewing)
   * Creates a realistic fire crackle with pops and hisses
   */
  playPyroBurningSound(): void {
    if (!this.host.isPyroEnabled()) return;
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const duration = 0.4;
      const now = audioContext.currentTime;
      
      // Create multiple short crackle bursts for fire effect
      for (let burst = 0; burst < 4; burst++) {
        const burstStart = now + burst * 0.08 + Math.random() * 0.05;
        const burstDuration = 0.03 + Math.random() * 0.04;
        
        // High-frequency crackle (short noise burst)
        const crackleBuffer = audioContext.createBuffer(1, audioContext.sampleRate * burstDuration, audioContext.sampleRate);
        const crackleData = crackleBuffer.getChannelData(0);
        for (let i = 0; i < crackleData.length; i++) {
          // Sharp attack, quick decay for crackle effect
          const envelope = Math.exp(-i / (crackleData.length * 0.2));
          crackleData[i] = (Math.random() * 2 - 1) * envelope;
        }
        const crackleSource = audioContext.createBufferSource();
        crackleSource.buffer = crackleBuffer;
        
        // Highpass filter for crisp crackle
        const highpass = audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 2000 + Math.random() * 3000;
        
        // Vary volume for each burst
        const crackleGain = audioContext.createGain();
        crackleGain.gain.setValueAtTime(0.08 + Math.random() * 0.1, burstStart);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, burstStart + burstDuration);
        
        crackleSource.connect(highpass);
        highpass.connect(crackleGain);
        crackleGain.connect(this.bus(audioContext));
        
        crackleSource.start(burstStart);
        crackleSource.stop(burstStart + burstDuration);
      }
      
      // Low rumbling base fire sound
      const baseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const baseData = baseBuffer.getChannelData(0);
      for (let i = 0; i < baseData.length; i++) {
        // Slow modulation for fire roar
        const mod = Math.sin(i / (audioContext.sampleRate * 0.05)) * 0.3 + 0.7;
        baseData[i] = (Math.random() * 2 - 1) * mod * 0.5;
      }
      const baseSource = audioContext.createBufferSource();
      baseSource.buffer = baseBuffer;
      
      // Bandpass for warm fire tone
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 400;
      bandpass.Q.value = 0.5;
      
      const baseGain = audioContext.createGain();
      baseGain.gain.setValueAtTime(0.06, now);
      baseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      baseSource.connect(bandpass);
      bandpass.connect(baseGain);
      baseGain.connect(this.bus(audioContext));
      
      baseSource.start(now);
      baseSource.stop(now + duration);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play Pyro airblast sound - sudden burst of compressed air
   */
  playPyroReflectSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      
      // === Airblast: sudden burst of compressed air ===
      // Fast attack white noise with rapid decay - "PSSH!"
      const blastDuration = 0.25;
      const blastBuffer = audioContext.createBuffer(1, audioContext.sampleRate * blastDuration, audioContext.sampleRate);
      const blastData = blastBuffer.getChannelData(0);
      for (let i = 0; i < blastData.length; i++) {
        const t = i / blastData.length;
        // Sharp attack, quick decay
        const envelope = Math.exp(-t * 15) * (1 - Math.exp(-t * 100));
        blastData[i] = (Math.random() * 2 - 1) * envelope;
      }
      const blastSource = audioContext.createBufferSource();
      blastSource.buffer = blastBuffer;
      
      // Highpass filter for airy, hissy quality
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 2000;
      
      // Bandpass for body
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 4000;
      bandpass.Q.value = 0.5;
      
      const blastGain = audioContext.createGain();
      blastGain.gain.setValueAtTime(0.5, now);
      
      blastSource.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(blastGain);
      blastGain.connect(this.bus(audioContext));
      
      blastSource.start(now);
      blastSource.stop(now + blastDuration);
      
      // === Low thump for impact ===
      const thumpOsc = audioContext.createOscillator();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(80, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      
      const thumpGain = audioContext.createGain();
      thumpGain.gain.setValueAtTime(0.3, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.bus(audioContext));
      
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.15);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play Medic Übercharge sound - rising electrical charge sound
   * Heard from anywhere to alert player that a new enemy has been Übered
   */
  playUberChargeSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const now = audioContext.currentTime;
      const duration = 0.8;
      
      // === Rising electrical charge tone ===
      // Base tone that rises in pitch
      const chargeOsc = audioContext.createOscillator();
      chargeOsc.type = 'sawtooth';
      chargeOsc.frequency.setValueAtTime(150, now);
      chargeOsc.frequency.exponentialRampToValueAtTime(600, now + duration * 0.7);
      chargeOsc.frequency.setValueAtTime(600, now + duration * 0.7);
      
      // Harmonic overtone
      const harmOsc = audioContext.createOscillator();
      harmOsc.type = 'square';
      harmOsc.frequency.setValueAtTime(300, now);
      harmOsc.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.7);
      
      // Modulation for electrical crackle effect
      const modOsc = audioContext.createOscillator();
      modOsc.type = 'square';
      modOsc.frequency.setValueAtTime(30, now);
      modOsc.frequency.linearRampToValueAtTime(60, now + duration);
      
      const modGain = audioContext.createGain();
      modGain.gain.setValueAtTime(50, now);
      
      modOsc.connect(modGain);
      modGain.connect(chargeOsc.frequency);
      
      // Main envelope - builds up then quick release
      const mainGain = audioContext.createGain();
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      mainGain.gain.setValueAtTime(0.25, now + duration * 0.7);
      mainGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      // Harmonic envelope
      const harmGain = audioContext.createGain();
      harmGain.gain.setValueAtTime(0, now);
      harmGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
      harmGain.gain.setValueAtTime(0.1, now + duration * 0.7);
      harmGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      // Low-pass filter for warmth
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(3000, now + duration * 0.7);
      
      chargeOsc.connect(mainGain);
      harmOsc.connect(harmGain);
      mainGain.connect(filter);
      harmGain.connect(filter);
      filter.connect(this.bus(audioContext));
      
      chargeOsc.start(now);
      harmOsc.start(now);
      modOsc.start(now);
      
      chargeOsc.stop(now + duration);
      harmOsc.stop(now + duration);
      modOsc.stop(now + duration);
      
      // === Final "pop" at the end ===
      const popOsc = audioContext.createOscillator();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(800, now + duration * 0.65);
      popOsc.frequency.exponentialRampToValueAtTime(200, now + duration * 0.65 + 0.15);
      
      const popGain = audioContext.createGain();
      popGain.gain.setValueAtTime(0.3, now + duration * 0.65);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.65 + 0.15);
      
      popOsc.connect(popGain);
      popGain.connect(this.bus(audioContext));
      
      popOsc.start(now + duration * 0.65);
      popOsc.stop(now + duration * 0.65 + 0.2);
      
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play mounting camera watch warning sound - gets more intense as watch progress increases
   */
  playCameraWatchWarningSound(progress: number): void {
    if (this.host.getNightNumber() < 3) return;
    if (this.cameraWarningSoundPlaying) return; // Don't overlap sounds
    
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      this.cameraWarningSoundPlaying = true;
      
      // Low rumbling warning sound that increases in pitch/volume
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // Frequency increases with progress
      const baseFreq = 60 + progress * 100;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, audioContext.currentTime + 0.3);
      
      // Volume increases with progress
      const volume = 0.05 + progress * 0.15;
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.3);
      
      // Allow next sound after this one finishes
      setTimeout(() => {
        this.cameraWarningSoundPlaying = false;
      }, 350);
    } catch (e) {
      this.cameraWarningSoundPlaying = false;
    }
  }

  /**
   * Play denied/error sound - when player can't do an action (not enough metal)
   */
  playDeniedSound(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      this.connectGameAudio(gainNode);
      
      // First tone (higher)
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(400, audioContext.currentTime);
      osc1.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
      
      // Second tone (lower, slightly delayed)
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(0, audioContext.currentTime);
      osc2.frequency.setValueAtTime(250, audioContext.currentTime + 0.15);
      osc2.frequency.setValueAtTime(200, audioContext.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime + 0.15);
      osc1.stop(audioContext.currentTime + 0.15);
      osc2.stop(audioContext.currentTime + 0.35);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sentry build sound - mechanical construction/wrench sounds
   */
  playSentryBuildSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Series of wrench clinks and mechanical whirrs
      const delays = [0, 0.12, 0.24, 0.36];
      delays.forEach((delay, i) => {
        // Metallic clink
        const clink = audioContext.createOscillator();
        const clinkGain = audioContext.createGain();
        clink.connect(clinkGain);
        clinkGain.connect(this.bus(audioContext));
        
        clink.type = 'triangle';
        const baseFreq = 800 + i * 100; // Rising pitch
        clink.frequency.setValueAtTime(baseFreq, audioContext.currentTime + delay);
        clink.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, audioContext.currentTime + delay + 0.08);
        
        clinkGain.gain.setValueAtTime(0.2, audioContext.currentTime + delay);
        clinkGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + 0.1);
        
        clink.start(audioContext.currentTime + delay);
        clink.stop(audioContext.currentTime + delay + 0.1);
      });
      
      // Final "powered up" confirmation
      const powerUp = audioContext.createOscillator();
      const powerGain = audioContext.createGain();
      powerUp.connect(powerGain);
      powerGain.connect(this.bus(audioContext));
      
      powerUp.type = 'sine';
      powerUp.frequency.setValueAtTime(300, audioContext.currentTime + 0.5);
      powerUp.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.7);
      
      powerGain.gain.setValueAtTime(0, audioContext.currentTime + 0.5);
      powerGain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.55);
      powerGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
      
      powerUp.start(audioContext.currentTime + 0.5);
      powerUp.stop(audioContext.currentTime + 0.8);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sentry repair sound - quick wrench hit
   */
  playSentryRepairSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Single metallic wrench hit
      const clink = audioContext.createOscillator();
      const clinkGain = audioContext.createGain();
      clink.connect(clinkGain);
      clinkGain.connect(this.bus(audioContext));
      
      clink.type = 'triangle';
      clink.frequency.setValueAtTime(1000, audioContext.currentTime);
      clink.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
      
      clinkGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      clinkGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      
      clink.start(audioContext.currentTime);
      clink.stop(audioContext.currentTime + 0.15);
      
      // Subtle heal chime
      const chime = audioContext.createOscillator();
      const chimeGain = audioContext.createGain();
      chime.connect(chimeGain);
      chimeGain.connect(this.bus(audioContext));
      
      chime.type = 'sine';
      chime.frequency.setValueAtTime(880, audioContext.currentTime + 0.05);
      
      chimeGain.gain.setValueAtTime(0.1, audioContext.currentTime + 0.05);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      chime.start(audioContext.currentTime + 0.05);
      chime.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sentry upgrade sound - powerful ratcheting/powering up
   */
  playSentryUpgradeSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Rapid ratcheting sounds
      const ratchetCount = 6;
      for (let i = 0; i < ratchetCount; i++) {
        const delay = i * 0.08;
        const ratchet = audioContext.createOscillator();
        const ratchetGain = audioContext.createGain();
        ratchet.connect(ratchetGain);
        ratchetGain.connect(this.bus(audioContext));
        
        ratchet.type = 'sawtooth';
        const freq = 400 + i * 80; // Rising pitch
        ratchet.frequency.setValueAtTime(freq, audioContext.currentTime + delay);
        ratchet.frequency.exponentialRampToValueAtTime(freq * 0.5, audioContext.currentTime + delay + 0.05);
        
        ratchetGain.gain.setValueAtTime(0.15, audioContext.currentTime + delay);
        ratchetGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + 0.06);
        
        ratchet.start(audioContext.currentTime + delay);
        ratchet.stop(audioContext.currentTime + delay + 0.06);
      }
      
      // Big power-up surge at the end
      const surge = audioContext.createOscillator();
      const surge2 = audioContext.createOscillator();
      const surgeGain = audioContext.createGain();
      surge.connect(surgeGain);
      surge2.connect(surgeGain);
      surgeGain.connect(this.bus(audioContext));
      
      surge.type = 'sine';
      surge.frequency.setValueAtTime(200, audioContext.currentTime + 0.5);
      surge.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.8);
      
      surge2.type = 'triangle';
      surge2.frequency.setValueAtTime(400, audioContext.currentTime + 0.5);
      surge2.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.8);
      
      surgeGain.gain.setValueAtTime(0, audioContext.currentTime + 0.5);
      surgeGain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.6);
      surgeGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.9);
      
      surge.start(audioContext.currentTime + 0.5);
      surge.stop(audioContext.currentTime + 0.9);
      surge2.start(audioContext.currentTime + 0.5);
      surge2.stop(audioContext.currentTime + 0.9);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play wrangler aim sound - mechanical servo/click when aiming
   */
  playWranglerAimSound(direction: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE'): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Mechanical servo whir — matched to the 140ms head swivel.
      // Aiming at a door sweeps up (head turning out); returning to middle
      // sweeps down (head settling back).
      const aiming = direction !== 'NONE';
      const servo = audioContext.createOscillator();
      const servoGain = audioContext.createGain();
      servo.connect(servoGain);
      servoGain.connect(this.bus(audioContext));
      
      servo.type = 'sawtooth';
      if (aiming) {
        servo.frequency.setValueAtTime(140, audioContext.currentTime);
        servo.frequency.linearRampToValueAtTime(230, audioContext.currentTime + 0.09);
        servo.frequency.linearRampToValueAtTime(180, audioContext.currentTime + 0.14);
      } else {
        servo.frequency.setValueAtTime(200, audioContext.currentTime);
        servo.frequency.linearRampToValueAtTime(110, audioContext.currentTime + 0.14);
      }
      
      servoGain.gain.setValueAtTime(0.08, audioContext.currentTime);
      servoGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.14);
      
      servo.start(audioContext.currentTime);
      servo.stop(audioContext.currentTime + 0.14);
      
      // Click at end
      const click = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      click.connect(clickGain);
      clickGain.connect(this.bus(audioContext));
      
      click.type = 'square';
      click.frequency.setValueAtTime(800, audioContext.currentTime + 0.08);
      click.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      clickGain.gain.setValueAtTime(0.1, audioContext.currentTime + 0.08);
      clickGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
      
      click.start(audioContext.currentTime + 0.08);
      click.stop(audioContext.currentTime + 0.12);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play enemy retreat sound - fading footsteps running away
   */
  playEnemyRetreatSound(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      const stepCount = 5;
      for (let i = 0; i < stepCount; i++) {
        const delay = i * 0.15;
        const volume = 0.09 * (1 - i / stepCount);
        
        const thud = audioContext.createOscillator();
        const thudGain = audioContext.createGain();
        thud.connect(thudGain);
        this.connectGameAudio(thudGain);
        
        thud.type = 'sine';
        thud.frequency.setValueAtTime(60 + i * 5, audioContext.currentTime + delay);
        thud.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + delay + 0.08);
        
        thudGain.gain.setValueAtTime(volume, audioContext.currentTime + delay);
        thudGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + 0.1);
        
        thud.start(audioContext.currentTime + delay);
        thud.stop(audioContext.currentTime + delay + 0.1);
        
        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.05, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let j = 0; j < noiseData.length; j++) {
          noiseData[j] = (Math.random() * 2 - 1) * (1 - j / noiseData.length);
        }
        const noise = audioContext.createBufferSource();
        const noiseGain = audioContext.createGain();
        noise.buffer = noiseBuffer;
        noise.connect(noiseGain);
        this.connectGameAudio(noiseGain);
        noiseGain.gain.setValueAtTime(volume * 0.3, audioContext.currentTime + delay + 0.02);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + 0.07);
        noise.start(audioContext.currentTime + delay + 0.02);
      }
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play wrangler toggle sound - power up/down sound
   */
  playWranglerToggleSound(wranglerOn: boolean): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      if (wranglerOn) {
        // Power up sound - rising tone with electronic buzz
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.bus(audioContext));
        
        // Main rising tone
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, audioContext.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
        
        // Harmonic buzz
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(300, audioContext.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.2);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.2);
        
        // Confirmation beep
        const beep = audioContext.createOscillator();
        const beepGain = audioContext.createGain();
        beep.connect(beepGain);
        beepGain.connect(this.bus(audioContext));
        
        beep.type = 'sine';
        beep.frequency.setValueAtTime(880, audioContext.currentTime + 0.15);
        
        beepGain.gain.setValueAtTime(0.15, audioContext.currentTime + 0.15);
        beepGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
        
        beep.start(audioContext.currentTime + 0.15);
        beep.stop(audioContext.currentTime + 0.25);
      } else {
        // Power down sound - descending tone
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.bus(audioContext));
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.25);
      }
    } catch (e) {
      // Audio not available
    }
  }

  // (The old electronic pause/unpause tones were replaced by
  // playVcrPauseSound / playVcrResumeSound — mechanical VCR clicks that
  // match the freeze-frame pause screen.)

  /**
   * Play screen flip sound - soft, lowkey whoosh when raising/lowering the camera monitor
   * @param direction 'up' when opening cameras, 'down' when closing
   */
  playScreenFlipSound(direction: 'up' | 'down'): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      const now = audioContext.currentTime;

      // Short filtered noise whoosh (like fabric/plastic moving quickly)
      const duration = 0.22;
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        // Smooth swell in the middle, silent at the edges
        const envelope = Math.sin(t * Math.PI);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      // Bandpass sweep gives the whoosh its motion - up sweeps rising, down sweeps falling
      const filter = audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      if (direction === 'up') {
        filter.frequency.setValueAtTime(350, now);
        filter.frequency.exponentialRampToValueAtTime(1600, now + duration);
      } else {
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(350, now + duration);
      }

      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Direct to destination (like the camera boot blip) so the master
      // compressor doesn't duck it under other simultaneous sounds
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bus(audioContext));

      source.start(now);
      source.stop(now + duration);

      // Soft low "thump" underneath - the physical feel of the monitor moving
      const thump = audioContext.createOscillator();
      const thumpGain = audioContext.createGain();
      thump.type = 'sine';
      if (direction === 'up') {
        thump.frequency.setValueAtTime(90, now);
        thump.frequency.exponentialRampToValueAtTime(140, now + 0.1);
      } else {
        thump.frequency.setValueAtTime(140, now);
        thump.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      }
      thumpGain.gain.setValueAtTime(0.12, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      thump.connect(thumpGain);
      thumpGain.connect(this.bus(audioContext));
      thump.start(now);
      thump.stop(now + 0.12);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play camera boot-up sound - subtle electronic chirp
   */
  playCameraBootSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Short, subtle electronic "blip" - not intrusive since cameras open frequently
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      // Gentle low-pass filter
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, audioContext.currentTime);
      
      // Quick ascending tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
      
      // Subtle but audible, quick fade
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.25);
      
      // Subtle CRT power-up whine — fast rising sweep as the tube warms
      const whine = audioContext.createOscillator();
      const whineGain = audioContext.createGain();
      whine.connect(whineGain);
      whineGain.connect(this.bus(audioContext));
      whine.type = 'sine';
      whine.frequency.setValueAtTime(400, audioContext.currentTime);
      whine.frequency.exponentialRampToValueAtTime(4200, audioContext.currentTime + 0.45);
      whineGain.gain.setValueAtTime(0.02, audioContext.currentTime);
      whineGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      whine.start(audioContext.currentTime);
      whine.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play camera static burst sound - brief static when switching
   */
  playCameraStaticBurst(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // White noise burst
      const bufferSize = audioContext.sampleRate * 0.1;
      const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      
      const noise = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      noise.buffer = noiseBuffer;
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bus(audioContext));
      
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      noise.start(audioContext.currentTime);
      noise.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play camera destroy sound - static burst and smash
   */
  playCameraDestroySound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Static noise burst
      const bufferSize = audioContext.sampleRate * 0.3;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioContext.createGain();
      noise.connect(noiseGain);
      noiseGain.connect(this.bus(audioContext));
      noiseGain.gain.setValueAtTime(0.4, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
      noise.start(audioContext.currentTime);
      
      // Low crunch
      const osc = audioContext.createOscillator();
      const oscGain = audioContext.createGain();
      osc.connect(oscGain);
      oscGain.connect(this.bus(audioContext));
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.15);
      oscGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not available
    }
  }

  playVentTabClickSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.bus(ctx));
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) { /* audio not available */ }
  }

  playVentSealSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Metallic clank — sealing a vent
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.bus(ctx));
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);

      // Secondary higher clank
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(this.bus(ctx));
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(600, now + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain2.gain.setValueAtTime(0.06, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.1);
    } catch (e) { /* audio not available */ }
  }

  playVentThudSound(): void {
    console.log('📋 [SFX] Vent thud sound triggered');
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Layer 1: Deep bass impact
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.connect(bassGain);
      bassGain.connect(this.bus(ctx));
      bass.type = 'sine';
      bass.frequency.setValueAtTime(100, now);
      bass.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      bassGain.gain.setValueAtTime(1.5, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      bass.start(now);
      bass.stop(now + 0.5);

      // Layer 2: Metallic clang (mid frequency)
      const clang = ctx.createOscillator();
      const clangGain = ctx.createGain();
      clang.connect(clangGain);
      clangGain.connect(this.bus(ctx));
      clang.type = 'triangle';
      clang.frequency.setValueAtTime(300, now);
      clang.frequency.exponentialRampToValueAtTime(120, now + 0.2);
      clangGain.gain.setValueAtTime(1.0, now);
      clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      clang.start(now);
      clang.stop(now + 0.25);

      // Layer 3: High metallic rattle
      const rattle = ctx.createOscillator();
      const rattleGain = ctx.createGain();
      const rattleFilter = ctx.createBiquadFilter();
      rattle.connect(rattleFilter);
      rattleFilter.connect(rattleGain);
      rattleGain.connect(this.bus(ctx));
      rattleFilter.type = 'bandpass';
      rattleFilter.frequency.setValueAtTime(1200, now);
      rattleFilter.Q.setValueAtTime(3, now);
      rattle.type = 'sawtooth';
      rattle.frequency.setValueAtTime(400, now);
      rattle.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      rattleGain.gain.setValueAtTime(0.7, now);
      rattleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      rattle.start(now);
      rattle.stop(now + 0.2);

      // Layer 4: Noise burst for impact texture
      const bufferSize = ctx.sampleRate * 0.1;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.bus(ctx));
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(600, now);
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.start(now);
    } catch (e) { console.log('📋 [SFX] Vent thud error:', e); }
  }

  playThermostatBeep(pct: number): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Pitch rises with heat (800Hz at 50% → 1600Hz at 100%)
      const freq = 800 + (pct - 0.5) * 1600;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.bus(ctx));
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.1 + pct * 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) { /* audio not available */ }
  }

  /**
   * Play cassette stop/click sound - mechanical clunk when skipping recording
   */
  playCassetteStopSound(): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      const now = ctx.currentTime;
      
      // Create a mechanical "click" sound like a cassette button
      const clickGain = ctx.createGain();
      clickGain.connect(this.bus(ctx));
      
      // First click - the button press
      const click1 = ctx.createOscillator();
      click1.type = 'square';
      click1.frequency.setValueAtTime(800, now);
      click1.frequency.exponentialRampToValueAtTime(200, now + 0.02);
      click1.connect(clickGain);
      clickGain.gain.setValueAtTime(0.3, now);
      clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      click1.start(now);
      click1.stop(now + 0.05);
      
      // Second clunk - the mechanism engaging
      const clunk = ctx.createOscillator();
      const clunkGain = ctx.createGain();
      clunk.type = 'triangle';
      clunk.frequency.setValueAtTime(150, now + 0.03);
      clunk.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      clunk.connect(clunkGain);
      clunkGain.connect(this.bus(ctx));
      clunkGain.gain.setValueAtTime(0.25, now + 0.03);
      clunkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      clunk.start(now + 0.03);
      clunk.stop(now + 0.12);
      
      // Tape stop "whir-down" sound
      const whir = ctx.createOscillator();
      const whirGain = ctx.createGain();
      whir.type = 'sawtooth';
      whir.frequency.setValueAtTime(400, now + 0.05);
      whir.frequency.exponentialRampToValueAtTime(50, now + 0.25);
      whir.connect(whirGain);
      whirGain.connect(this.bus(ctx));
      whirGain.gain.setValueAtTime(0.08, now + 0.05);
      whirGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      whir.start(now + 0.05);
      whir.stop(now + 0.25);
      
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Start the sniper laser hum - electrical/ominous sound that intensifies with charge
   */
  startSniperLaserHum(chargeProgress: number): void {
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioContext = this.sharedAudioContext;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // If already playing, just update the intensity
      if (this.isPlayingSniperHum && this.sniperHumGain && this.sniperHumOscillator) {
        // Update volume and frequency based on charge progress
        const baseVolume = 0.03 + chargeProgress * 0.08;
        const baseFreq = 80 + chargeProgress * 60;
        this.sniperHumGain.gain.setTargetAtTime(baseVolume, audioContext.currentTime, 0.1);
        this.sniperHumOscillator.frequency.setTargetAtTime(baseFreq, audioContext.currentTime, 0.1);
        return;
      }
      
      // Create new hum sound
      this.sniperHumOscillator = audioContext.createOscillator();
      this.sniperHumOscillator2 = audioContext.createOscillator();  // Track second oscillator
      this.sniperHumGain = audioContext.createGain();
      
      this.sniperHumOscillator.connect(this.sniperHumGain);
      this.sniperHumOscillator2.connect(this.sniperHumGain);
      this.connectGameAudio(this.sniperHumGain);
      
      // Low electrical hum
      this.sniperHumOscillator.type = 'sawtooth';
      this.sniperHumOscillator.frequency.value = 80 + chargeProgress * 60;
      
      // Higher harmonic for "electrical" feel
      this.sniperHumOscillator2.type = 'sine';
      this.sniperHumOscillator2.frequency.value = 240 + chargeProgress * 120;
      
      this.sniperHumGain.gain.value = 0.03 + chargeProgress * 0.08;
      
      this.sniperHumOscillator.start();
      this.sniperHumOscillator2.start();
      this.isPlayingSniperHum = true;
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Stop the sniper laser hum
   */
  stopSniperLaserHum(): void {
    if (!this.isPlayingSniperHum) return;
    
    try {
      if (this.sniperHumOscillator) {
        this.sniperHumOscillator.stop();
        this.sniperHumOscillator.disconnect();
        this.sniperHumOscillator = null;
      }
      if (this.sniperHumOscillator2) {
        this.sniperHumOscillator2.stop();
        this.sniperHumOscillator2.disconnect();
        this.sniperHumOscillator2 = null;
      }
      if (this.sniperHumGain) {
        this.sniperHumGain.disconnect();
        this.sniperHumGain = null;
      }
    } catch (e) {
      // Already stopped
    }
    this.isPlayingSniperHum = false;
  }

  /**
   * Start the dispenser ambient hum - low continuous electrical hum
   */
  startDispenserHum(): void {
    if (this.isPlayingDispenserHum) return;
    
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      this.dispenserHumGain = audioContext.createGain();
      this.dispenserHumGain.gain.setValueAtTime(0.045, audioContext.currentTime);
      this.connectGameAudio(this.dispenserHumGain);
      
      this.dispenserHumOscillator = audioContext.createOscillator();
      this.dispenserHumOscillator.type = 'sine';
      this.dispenserHumOscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      this.dispenserHumOscillator.connect(this.dispenserHumGain);
      
      this.dispenserHumOscillator2 = audioContext.createOscillator();
      this.dispenserHumOscillator2.type = 'triangle';
      this.dispenserHumOscillator2.frequency.setValueAtTime(200, audioContext.currentTime);
      
      const secondaryGain = audioContext.createGain();
      secondaryGain.gain.setValueAtTime(0.022, audioContext.currentTime);
      this.connectGameAudio(secondaryGain);
      this.dispenserHumOscillator2.connect(secondaryGain);
      this.dispenserHumSecondaryGain = secondaryGain;
      
      // Add subtle wobble to make it sound more organic
      const lfo = audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.3, audioContext.currentTime);
      const lfoGain = audioContext.createGain();
      lfoGain.gain.setValueAtTime(2, audioContext.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(this.dispenserHumOscillator.frequency);
      lfo.start();
      this.dispenserHumLfo = lfo;
      
      this.dispenserHumOscillator.start();
      this.dispenserHumOscillator2.start();
      this.isPlayingDispenserHum = true;
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Stop the dispenser ambient hum
   */
  stopDispenserHum(): void {
    if (!this.isPlayingDispenserHum) return;
    
    try {
      if (this.dispenserHumOscillator) {
        this.dispenserHumOscillator.stop();
        this.dispenserHumOscillator.disconnect();
        this.dispenserHumOscillator = null;
      }
      if (this.dispenserHumOscillator2) {
        this.dispenserHumOscillator2.stop();
        this.dispenserHumOscillator2.disconnect();
        this.dispenserHumOscillator2 = null;
      }
      if (this.dispenserHumLfo) {
        this.dispenserHumLfo.stop();
        this.dispenserHumLfo.disconnect();
        this.dispenserHumLfo = null;
      }
      if (this.dispenserHumSecondaryGain) {
        this.dispenserHumSecondaryGain.disconnect();
        this.dispenserHumSecondaryGain = null;
      }
      if (this.dispenserHumGain) {
        this.dispenserHumGain.disconnect();
        this.dispenserHumGain = null;
      }
    } catch (e) {
      // Already stopped
    }
    this.isPlayingDispenserHum = false;
  }

  /**
   * Looping 2Fort Intel room ambience (HTMLAudio). Keeps playing while wrangler aim mutes the synthetic hum.
   */
  startIntelRoomAmbience(): void {
    if (this.host.isTeleportedNow() || this.host.isPausedNow() || this.host.getGameStatus() !== 'PLAYING') return;
    
    try {
      if (!this.intelRoomAmbience) {
        const audio = new Audio('./audio/intel-room-ambience.mp3');
        audio.loop = true;
        audio.volume = 0.52 * getMusicVolume();
        const tryPlay = (): void => {
          if (this.intelRoomAmbience !== audio) return;
          if (this.host.isTeleportedNow() || this.host.isPausedNow() || this.host.getGameStatus() !== 'PLAYING') return;
          void audio.play().catch(() => {});
        };
        audio.addEventListener('canplaythrough', tryPlay, { once: true });
        audio.addEventListener('error', () => {
          // dispose() clears src and reloads, which fires 'error' on the old
          // element — only report failures for the live instance
          if (this.intelRoomAmbience !== audio) return;
          console.log('[Audio] Intel room ambience failed to load');
        });
        this.intelRoomAmbience = audio;
        audio.load();
        return;
      }
      if (this.intelRoomAmbience.paused) {
        void this.intelRoomAmbience.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  stopIntelRoomAmbience(): void {
    if (!this.intelRoomAmbience) return;
    try {
      this.intelRoomAmbience.pause();
    } catch {
      // ignore
    }
  }

  disposeIntelRoomAmbience(): void {
    this.stopIntelRoomAmbience();
    if (this.intelRoomAmbience) {
      const audio = this.intelRoomAmbience;
      // Null the ref BEFORE clearing src: the empty-src load fires 'error',
      // and the handler above ignores events from disposed instances
      this.intelRoomAmbience = null;
      audio.src = '';
      audio.load();
    }
  }

  /**
   * Play sapper sparking/buzzing sound (Night 5+)
   */
  playSapperSound(): void {
    if (this.host.getGameStatus() !== 'PLAYING') return;
    if (this.isPlayingSapperSound || this.sapperSoundOscillator) return;
    
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      this.sapperSoundGain = audioContext.createGain();
      this.sapperSoundGain.gain.setValueAtTime(0.12, audioContext.currentTime);
      this.connectGameAudio(this.sapperSoundGain);
      
      this.sapperSoundOscillator = audioContext.createOscillator();
      this.sapperSoundOscillator.type = 'sawtooth';
      this.sapperSoundOscillator.frequency.setValueAtTime(120, audioContext.currentTime);
      
      this.sapperSoundModulator = audioContext.createOscillator();
      this.sapperSoundModulator.type = 'square';
      this.sapperSoundModulator.frequency.setValueAtTime(8, audioContext.currentTime);
      
      const modulatorGain = audioContext.createGain();
      modulatorGain.gain.setValueAtTime(30, audioContext.currentTime);
      
      this.sapperSoundModulator.connect(modulatorGain);
      modulatorGain.connect(this.sapperSoundOscillator.frequency);
      
      this.sapperSoundOscillator.connect(this.sapperSoundGain);
      
      this.sapperSoundOscillator.start();
      this.sapperSoundModulator.start();
      this.isPlayingSapperSound = true;
    } catch (e) {
      this.stopSapperSound();
    }
  }

  /**
   * Stop sapper sound
   */
  stopSapperSound(): void {
    try {
      if (this.sapperSoundGain) {
        this.sapperSoundGain.disconnect();
      }
    } catch {
      // Already disconnected
    }
    this.sapperSoundOscillator = this.stopOscillator(this.sapperSoundOscillator);
    this.sapperSoundModulator = this.stopOscillator(this.sapperSoundModulator);
    this.sapperSoundGain = null;
    this.isPlayingSapperSound = false;
  }

  /**
   * Play sound when Administrator selects a Mode 2 target — tense, urgent radio-static ping
   * Signals the player to check cameras and be ready to interrupt
   */
  playAdministratorTargetingSound(): void {
    if (this.host.getGameStatus() !== 'PLAYING') return;
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const gain = ctx.createGain();
      gain.connect(this.bus(ctx));

      // Two sharp ascending pings — like a radar/sonar alert
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
        osc.frequency.linearRampToValueAtTime(1320, ctx.currentTime + offset + 0.08);
        osc.connect(gain);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.1);
      });

      // Short static burst underneath for urgency
      const noise = ctx.createOscillator();
      noise.type = 'square';
      noise.frequency.setValueAtTime(180, ctx.currentTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.04, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      noise.connect(noiseGain);
      noiseGain.connect(this.bus(ctx));
      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sound when Administrator hacks a teleporter room — ominous digital glitch/power-down
   */
  playAdministratorHackSound(): void {
    if (this.host.getGameStatus() !== 'PLAYING') return;
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const gain = ctx.createGain();
      gain.connect(this.bus(ctx));

      // Descending pitch sweep — "power-down" feel
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);

      // Digital noise burst via second osc
      const noise = ctx.createOscillator();
      noise.type = 'square';
      noise.frequency.setValueAtTime(220, ctx.currentTime);
      noise.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.06, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      noise.connect(noiseGain);
      noiseGain.connect(gain);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
  }

  playAdministratorRepairTickSound(): void {
    if (this.host.getGameStatus() !== 'PLAYING') return;
    // Play a short tick every ~250ms so it feels like continuous activity without overlap
    this._administratorRepairSoundTimer -= 1; // decremented per frame; reset when <= 0
    if (this._administratorRepairSoundTimer > 0) return;
    this._administratorRepairSoundTimer = 15; // ~15 frames between ticks at 60fps ≈ 250ms

    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const gain = ctx.createGain();
      gain.connect(this.bus(ctx));

      // Short high-pitched electronic blip — screwdriver/typing feel
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play sound when a hacked teleporter is fully repaired — upward chime/success sting
   */
  playAdministratorRepairCompleteSound(): void {
    if (this.host.getGameStatus() !== 'PLAYING') return;
    try {
      if (!this.sharedAudioContext || this.sharedAudioContext.state === 'closed') {
        this.sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = this.sharedAudioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const gain = ctx.createGain();
      gain.connect(this.bus(ctx));

      // Rising two-tone chime — C5 → E5
      const freqs = [523, 659];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        osc.connect(gain);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.18);
      });

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Start the scary buzzing/detection sound when enemy is in lit doorway
   * @param heavyPresent - deeper/louder hum when Heavy's shadow is in the light
   */
  startDetectionSound(heavyPresent = false): void {
    if (this.isPlayingDetectionSound) return;
    
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      this.detectionOscillator = audioContext.createOscillator();
      this.detectionGain = audioContext.createGain();
      this.detectionLfo = audioContext.createOscillator();
      this.detectionLfoGain = audioContext.createGain();
      
      this.detectionLfo.frequency.value = heavyPresent ? 6 : 8;
      this.detectionLfoGain.gain.value = heavyPresent ? 35 : 30;
      
      this.detectionLfo.connect(this.detectionLfoGain);
      this.detectionLfoGain.connect(this.detectionOscillator.frequency);
      
      this.detectionOscillator.type = 'sawtooth';
      this.detectionOscillator.frequency.value = heavyPresent ? 62 : 80;
      
      this.detectionOscillator.connect(this.detectionGain);
      this.connectGameAudio(this.detectionGain);
      
      this.detectionGain.gain.value = heavyPresent ? 0.19 : 0.12;
      
      this.detectionLfo.start();
      this.detectionOscillator.start();
      this.isPlayingDetectionSound = true;
    } catch (e) {
      this.stopDetectionSound();
    }
  }

  /**
   * Adjust detection hum when Heavy enters/leaves the lit doorway while buzz is playing
   */
  updateDetectionSoundIntensity(heavyPresent: boolean): void {
    if (!this.isPlayingDetectionSound || !this.detectionGain || !this.detectionOscillator) return;

    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;

      const now = audioContext.currentTime;
      const targetGain = heavyPresent ? 0.19 : 0.12;
      const targetFreq = heavyPresent ? 62 : 80;
      const targetLfo = heavyPresent ? 6 : 8;

      this.detectionGain.gain.setTargetAtTime(targetGain, now, 0.15);
      this.detectionOscillator.frequency.setTargetAtTime(targetFreq, now, 0.15);
      if (this.detectionLfo) {
        this.detectionLfo.frequency.setTargetAtTime(targetLfo, now, 0.15);
      }
    } catch {
      // Audio node may have been stopped
    }
  }

  /**
   * Stop the detection sound
   */
  stopDetectionSound(): void {
    if (!this.isPlayingDetectionSound) return;
    
    try {
      if (this.detectionGain) {
        this.detectionGain.disconnect();
      }
    } catch {
      // Already disconnected
    }

    this.detectionOscillator = this.stopOscillator(this.detectionOscillator);
    this.detectionLfo = this.stopOscillator(this.detectionLfo);
    if (this.detectionLfoGain) {
      try { this.detectionLfoGain.disconnect(); } catch { /* ignore */ }
    }
    this.detectionGain = null;
    this.detectionLfoGain = null;
    this.isPlayingDetectionSound = false;
    this.detectionSoundReleaseFrames = 0;
  }

  // Dead-feed static loops ---------------------------------------------------
  private deadFeedStaticSource: AudioBufferSourceNode | null = null;
  private deadFeedStaticGain: GainNode | null = null;
  private camDeadHissSource: AudioBufferSourceNode | null = null;
  private camDeadHissGain: GainNode | null = null;

  /** Shared band-limited noise loop used by both dead-feed sounds. */
  private createDeadFeedNoiseChain(
    ctx: AudioContext,
    targetGain: number,
    fadeSec: number
  ): { src: AudioBufferSourceNode; gain: GainNode } {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    // Band-limit the hiss so it sits in the background instead of biting
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 5500;

    const gain = ctx.createGain();
    // Linear ramp: audible from the first moment, swells gently to quiet
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + fadeSec);

    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.bus(ctx));
    src.start();
    return { src, gain };
  }

  private stopNoiseChain(
    src: AudioBufferSourceNode | null,
    gain: GainNode | null
  ): void {
    if (src) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }
  }

  /**
   * Very quiet looping static, like a camera feed that went dead.
   * Fades in slowly under the game over screen.
   */
  startDeadFeedStatic(): void {
    if (this.deadFeedStaticSource) return;
    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const chain = this.createDeadFeedNoiseChain(ctx, 0.008, 1.5);
      this.deadFeedStaticSource = chain.src;
      this.deadFeedStaticGain = chain.gain;
    } catch (e) {
      // Audio not available
    }
  }

  stopDeadFeedStatic(): void {
    this.stopNoiseChain(this.deadFeedStaticSource, this.deadFeedStaticGain);
    this.deadFeedStaticSource = null;
    this.deadFeedStaticGain = null;
  }

  /** Even quieter hiss while viewing a destroyed camera. */
  startCameraDeadFeedHiss(): void {
    if (this.camDeadHissSource) return;
    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const chain = this.createDeadFeedNoiseChain(ctx, 0.004, 0.4);
      this.camDeadHissSource = chain.src;
      this.camDeadHissGain = chain.gain;
    } catch (e) {
      // Audio not available
    }
  }

  stopCameraDeadFeedHiss(): void {
    this.stopNoiseChain(this.camDeadHissSource, this.camDeadHissGain);
    this.camDeadHissSource = null;
    this.camDeadHissGain = null;
  }

  // Tiered alert sounds ------------------------------------------------------
  private alertSoundLastAt: Record<string, number> = {};

  /**
   * Quiet audio cue per alert level. Per-level cooldown keeps alert spam
   * (rocket hits, sapper click progress) from getting tiring — the banner
   * stays the primary signal. 'info' alerts are deliberately silent.
   */
  playAlertSound(level: 'success' | 'info' | 'warning' | 'danger'): void {
    if (level === 'info') return;
    if (this.host.getGameStatus() !== 'PLAYING') return;

    const now = performance.now();
    const last = this.alertSoundLastAt[level] ?? -Infinity;
    if (now - last < 1500) return;
    this.alertSoundLastAt[level] = now;

    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      const tone = (freq: number, start: number, dur: number, type: OscillatorType, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(this.bus(ctx));
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(vol, t + start);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.start(t + start);
        osc.stop(t + start + dur);
      };

      switch (level) {
        case 'danger':
          // Short low double-buzz
          tone(120, 0, 0.06, 'square', 0.06);
          tone(110, 0.09, 0.07, 'square', 0.06);
          break;
        case 'warning':
          // Single mid blip
          tone(420, 0, 0.07, 'triangle', 0.055);
          break;
        case 'success':
          // Soft two-note up-chirp
          tone(520, 0, 0.06, 'sine', 0.05);
          tone(780, 0.07, 0.07, 'sine', 0.05);
          break;
      }
    } catch (e) {
      // Audio not available
    }
  }

  // VCR pause/resume ---------------------------------------------------------

  /** Mechanical ka-chunk — tape put on hold. */
  playVcrPauseSound(): void {
    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Low mechanical thud
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.connect(thudGain);
      thudGain.connect(this.bus(ctx));
      thud.type = 'sine';
      thud.frequency.setValueAtTime(90, t);
      thud.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      thudGain.gain.setValueAtTime(0.16, t);
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      thud.start(t);
      thud.stop(t + 0.1);

      // Brief tape squeak as the head disengages
      const squeak = ctx.createOscillator();
      const squeakGain = ctx.createGain();
      squeak.connect(squeakGain);
      squeakGain.connect(this.bus(ctx));
      squeak.type = 'triangle';
      squeak.frequency.setValueAtTime(1400, t + 0.03);
      squeak.frequency.exponentialRampToValueAtTime(700, t + 0.1);
      squeakGain.gain.setValueAtTime(0.03, t + 0.03);
      squeakGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      squeak.start(t + 0.03);
      squeak.stop(t + 0.11);
    } catch (e) {
      // Audio not available
    }
  }

  /** Click + short motor spin-up — tape rolling again. */
  playVcrResumeSound(): void {
    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Click
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.connect(clickGain);
      clickGain.connect(this.bus(ctx));
      click.type = 'square';
      click.frequency.setValueAtTime(900, t);
      click.frequency.exponentialRampToValueAtTime(450, t + 0.04);
      clickGain.gain.setValueAtTime(0.08, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      click.start(t);
      click.stop(t + 0.05);

      // Motor spin-up
      const motor = ctx.createOscillator();
      const motorGain = ctx.createGain();
      motor.connect(motorGain);
      motorGain.connect(this.bus(ctx));
      motor.type = 'sawtooth';
      motor.frequency.setValueAtTime(50, t + 0.03);
      motor.frequency.linearRampToValueAtTime(130, t + 0.22);
      motorGain.gain.setValueAtTime(0.045, t + 0.03);
      motorGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      motor.start(t + 0.03);
      motor.stop(t + 0.26);
    } catch (e) {
      // Audio not available
    }
  }

  // Per-room camera ambience beds --------------------------------------------
  private camAmbienceNode: string | null = null;
  private camAmbienceSource: AudioBufferSourceNode | null = null;
  private camAmbienceGain: GainNode | null = null;
  private camAmbienceExtraOsc: OscillatorNode | null = null;
  private camAmbienceExtraGain: GainNode | null = null;
  private camAmbienceLfo: OscillatorNode | null = null;
  private camAmbienceLfoGain: GainNode | null = null;
  private camAmbienceEventTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Very quiet looping room tone for the selected camera, with a per-room
   * character: drips in the sewer, wind in the courtyard, duct rumble at the
   * grate, creaks on the bridge, electrical hum in the halls.
   */
  startCameraRoomAmbience(node: string): void {
    if (this.camAmbienceNode === node && this.camAmbienceSource) return;
    this.stopCameraRoomAmbience();

    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Per-room recipe: noise filter tint + level, optional layers
      const recipes: Record<string, { freq: number; gain: number; wind?: boolean; hum?: boolean; rumble?: boolean; events?: 'drip' | 'creak' }> = {
        SEWER: { freq: 900, gain: 0.006, events: 'drip' },
        COURTYARD: { freq: 1600, gain: 0.007, wind: true },
        GRATE: { freq: 350, gain: 0.008, rumble: true },
        BRIDGE: { freq: 1100, gain: 0.005, events: 'creak' },
        STAIRCASE: { freq: 700, gain: 0.005 },
        SPIRAL: { freq: 500, gain: 0.005 },
        LEFT_HALL: { freq: 800, gain: 0.004, hum: true },
        RIGHT_HALL: { freq: 800, gain: 0.004, hum: true },
      };
      const recipe = recipes[node];
      if (!recipe) return;

      // Base noise bed
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = recipe.freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(recipe.gain, t + 0.6);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.bus(ctx));
      src.start();
      this.camAmbienceSource = src;
      this.camAmbienceGain = gain;

      // Wind: slow LFO sweeping the filter cutoff
      if (recipe.wind) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.13;
        lfoGain.gain.value = 700;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        this.camAmbienceLfo = lfo;
        this.camAmbienceLfoGain = lfoGain;
      }

      // Electrical hum / duct rumble: steady low oscillator layer
      if (recipe.hum || recipe.rumble) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = recipe.hum ? 'sine' : 'triangle';
        osc.frequency.value = recipe.hum ? 120 : 46;
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(recipe.hum ? 0.004 : 0.008, t + 0.6);
        osc.connect(oscGain);
        oscGain.connect(this.bus(ctx));
        osc.start();
        this.camAmbienceExtraOsc = osc;
        this.camAmbienceExtraGain = oscGain;
      }

      // Random one-shot events (drips / creaks)
      if (recipe.events) {
        const scheduleEvent = () => {
          const delay = 2500 + Math.random() * 4500;
          this.camAmbienceEventTimer = setTimeout(() => {
            try {
              if (!this.camAmbienceSource || !this.sharedAudioContext) return;
              const c = this.sharedAudioContext;
              const now2 = c.currentTime;
              const osc = c.createOscillator();
              const g = c.createGain();
              osc.connect(g);
              g.connect(this.bus(c));
              if (recipe.events === 'drip') {
                osc.type = 'sine';
                const f = 900 + Math.random() * 600;
                osc.frequency.setValueAtTime(f, now2);
                osc.frequency.exponentialRampToValueAtTime(f * 0.6, now2 + 0.09);
                g.gain.setValueAtTime(0.02, now2);
                g.gain.exponentialRampToValueAtTime(0.001, now2 + 0.12);
                osc.start(now2);
                osc.stop(now2 + 0.12);
              } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(160 + Math.random() * 60, now2);
                osc.frequency.linearRampToValueAtTime(90, now2 + 0.3);
                g.gain.setValueAtTime(0.012, now2);
                g.gain.exponentialRampToValueAtTime(0.001, now2 + 0.32);
                osc.start(now2);
                osc.stop(now2 + 0.32);
              }
            } catch (e) {
              // Audio not available
            }
            scheduleEvent();
          }, delay);
        };
        scheduleEvent();
      }

      this.camAmbienceNode = node;
    } catch (e) {
      // Audio not available
    }
  }

  stopCameraRoomAmbience(): void {
    if (this.camAmbienceEventTimer) {
      clearTimeout(this.camAmbienceEventTimer);
      this.camAmbienceEventTimer = null;
    }
    this.stopNoiseChain(this.camAmbienceSource, this.camAmbienceGain);
    this.camAmbienceSource = null;
    this.camAmbienceGain = null;
    this.camAmbienceExtraOsc = this.stopOscillator(this.camAmbienceExtraOsc);
    if (this.camAmbienceExtraGain) {
      try {
        this.camAmbienceExtraGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.camAmbienceExtraGain = null;
    }
    this.camAmbienceLfo = this.stopOscillator(this.camAmbienceLfo);
    if (this.camAmbienceLfoGain) {
      try {
        this.camAmbienceLfoGain.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.camAmbienceLfoGain = null;
    }
    this.camAmbienceNode = null;
  }

  // Administrator hack tick (targeted camera only) ----------------------------
  private hackTickTimer: ReturnType<typeof setTimeout> | null = null;
  private hackTickProgress = 0;

  /**
   * Quiet accelerating tick while watching the camera the Administrator is
   * actively hacking. Rate rises with hack progress. Only runs while the
   * player is on that camera — off-screen hacks stay silent.
   */
  startHackTickLoop(): void {
    if (this.hackTickTimer) return;
    const scheduleTick = () => {
      // 1.5 ticks/sec at progress 0 → ~5/sec near completion
      const rate = 1.5 + this.hackTickProgress * 3.5;
      this.hackTickTimer = setTimeout(() => {
        try {
          const ctx = this.ensureSharedAudioContext();
          if (ctx) {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(this.bus(ctx));
            osc.type = 'square';
            osc.frequency.setValueAtTime(1000 + this.hackTickProgress * 400, t);
            gain.gain.setValueAtTime(0.025 + this.hackTickProgress * 0.02, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.start(t);
            osc.stop(t + 0.03);
          }
        } catch (e) {
          // Audio not available
        }
        scheduleTick();
      }, 1000 / rate);
    };
    scheduleTick();
  }

  setHackTickProgress(progress: number): void {
    this.hackTickProgress = Math.max(0, Math.min(1, progress));
  }

  stopHackTickLoop(): void {
    if (this.hackTickTimer) {
      clearTimeout(this.hackTickTimer);
      this.hackTickTimer = null;
    }
    this.hackTickProgress = 0;
  }

  // Thermostat heat creaks -----------------------------------------------------
  private nextHeatCreakAt = 0;

  /**
   * Occasional metallic expansion tinks once the vents run hot (>75%).
   * Called every frame from the thermostat update; self-throttles to a
   * random 3–8s spacing.
   */
  maybePlayHeatCreak(pct: number): void {
    if (pct < 0.75) return;
    const now = performance.now();
    if (now < this.nextHeatCreakAt) return;
    this.nextHeatCreakAt = now + 3000 + Math.random() * 5000;

    try {
      const ctx = this.ensureSharedAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Metallic tink: high sine with a fast pitch drop + tiny noise tail
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.bus(ctx));
      osc.type = 'sine';
      const f = 1800 + Math.random() * 700;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.06);
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t);
      osc.stop(t + 0.14);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Stop ALL game sounds - called on game over/victory
   */
  stopAllGameSounds(): void {
    // Stop all individual sound types
    this.stopDetectionSound();
    this.stopSniperLaserHum();
    this.stopSapperSound();
    this.stopDemoEyeGlowSound();
    this.stopMerasmusHum();
    this.stopApproachGrowl();
    this.stopDispenserHum();
    this.disposeIntelRoomAmbience();
    this.stopPyroCracklingAmbient();
    this.stopPyroHallwayHiss(true);
    // Ghost scream runs on its own AudioContext, so closing the shared context
    // below doesn't silence it - stop it explicitly or it screams over game over
    this.stopMedicGhostScream();
    this.stopDeadFeedStatic();
    this.stopCameraDeadFeedHiss();
    this.stopCameraRoomAmbience();
    this.stopHackTickLoop();

    // Force stop any oscillators that might still be running
    const oscillatorsToStop = [
      this.demoEyeGlowOscillator,
      this.sapperSoundOscillator,
      this.sniperHumOscillator,
      this.sniperHumOscillator2,
      this.detectionOscillator,
      this.approachGrowlOsc,
      this.approachGrowlOsc2,
      this.dispenserHumOscillator,
      this.dispenserHumOscillator2,
      this.dispenserHumLfo,
      this.merasmusHumOscillator,
      this.merasmusHumOscillator2,
    ];
    
    for (const osc of oscillatorsToStop) {
      if (osc) {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Already stopped
        }
      }
    }
    
    // Null out all oscillator references
    this.demoEyeGlowOscillator = null;
    this.demoEyeGlowOscillator2 = null;
    this.demoEyeGlowLfo = null;
    this.demoEyeGlowLfoGain = null;
    this.sapperSoundOscillator = null;
    this.sapperSoundModulator = null;
    this.sniperHumOscillator = null;
    this.sniperHumOscillator2 = null;
    this.detectionOscillator = null;
    this.detectionGain = null;
    this.detectionLfo = null;
    this.detectionLfoGain = null;
    this.approachGrowlOsc = null;
    this.approachGrowlOsc2 = null;
    this.dispenserHumOscillator = null;
    this.dispenserHumOscillator2 = null;
    this.dispenserHumLfo = null;
    this.dispenserHumSecondaryGain = null;
    this.merasmusHumOscillator = null;
    this.merasmusHumOscillator2 = null;
    this.merasmusHumGain = null;
    this.merasmusHumPlaying = false;
    
    // Null out gain nodes too
    this.demoEyeGlowGain = null;
    this.sapperSoundGain = null;
    this.sniperHumGain = null;
    this.approachGrowlGain = null;
    this.dispenserHumGain = null;
    this.pyroCracklingGain = null;
    
    // Close the shared audio context completely to stop ALL sounds
    if (this.sharedAudioContext) {
      try {
        this.sharedAudioContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.sharedAudioContext = null;
      this.masterAudioGain = null;
      this.masterAudioCompressor = null;
    }
    
    // Reset all audio state flags
    this.isPlayingDetectionSound = false;
    this.isPlayingSapperSound = false;
    this.isPlayingSniperHum = false;
    this.demoEyeGlowSoundPlaying = false;
  }

  /**
   * Play a procedural sound effect using Web Audio API
   */
  playSound(type: 'fire' | 'rocketHit' | 'sentryDestroyed'): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      const now = audioContext.currentTime;

      switch (type) {
        case 'fire': {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          this.connectGameAudio(gainNode);
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(200, now);
          oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.1);
          gainNode.gain.setValueAtTime(0.16, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          oscillator.start(now);
          oscillator.stop(now + 0.1);
          break;
        }

        case 'rocketHit': {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          this.connectGameAudio(gainNode);
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(80, now);
          oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.4);
          gainNode.gain.setValueAtTime(0.24, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          oscillator.start(now);
          oscillator.stop(now + 0.4);

          const bassOsc = audioContext.createOscillator();
          const bassGain = audioContext.createGain();
          bassOsc.connect(bassGain);
          this.connectGameAudio(bassGain);
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(50, now);
          bassOsc.frequency.exponentialRampToValueAtTime(25, now + 0.25);
          bassGain.gain.setValueAtTime(0.18, now);
          bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          bassOsc.start(now);
          bassOsc.stop(now + 0.25);

          const crackOsc = audioContext.createOscillator();
          const crackGain = audioContext.createGain();
          crackOsc.connect(crackGain);
          this.connectGameAudio(crackGain);
          crackOsc.type = 'square';
          crackOsc.frequency.setValueAtTime(150, now);
          crackOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
          crackGain.gain.setValueAtTime(0.14, now);
          crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          crackOsc.start(now);
          crackOsc.stop(now + 0.1);

          const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
          const noiseData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = Math.random() * 2 - 1;
          }
          const noiseSource = audioContext.createBufferSource();
          const noiseGain = audioContext.createGain();
          noiseSource.buffer = noiseBuffer;
          noiseSource.connect(noiseGain);
          this.connectGameAudio(noiseGain);
          noiseGain.gain.setValueAtTime(0.1, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          noiseSource.start(now);
          break;
        }

        case 'sentryDestroyed': {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          this.connectGameAudio(gainNode);
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(300, now);
          oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.5);
          gainNode.gain.setValueAtTime(0.22, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          oscillator.start(now);
          oscillator.stop(now + 0.5);

          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          this.connectGameAudio(gain2);
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(100, now);
          osc2.frequency.exponentialRampToValueAtTime(10, now + 0.6);
          gain2.gain.setValueAtTime(0.14, now);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
          osc2.start(now);
          osc2.stop(now + 0.6);
          break;
        }
      }
    } catch (e) {
      console.log('Audio not available');
    }
  }

  /**
   * Play Demoman's battle cry when he reaches the door
   */
  playDemomanBattleCry(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      this.connectGameAudio(gain);
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(100, audioContext.currentTime);
      osc1.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.3);
      osc1.frequency.linearRampToValueAtTime(80, audioContext.currentTime + 0.6);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(200, audioContext.currentTime);
      osc2.frequency.linearRampToValueAtTime(300, audioContext.currentTime + 0.3);
      osc2.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.28, audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.32, audioContext.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7);
      
      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.7);
      osc2.stop(audioContext.currentTime + 0.7);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play distant cry when Demoman starts charging
   */
  playDemomanDistantCry(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      
      const osc = audioContext.createOscillator();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      
      osc.connect(filter);
      filter.connect(gain);
      this.connectGameAudio(gain);
      
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioContext.currentTime);
      osc.frequency.linearRampToValueAtTime(180, audioContext.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.16, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Scout linger easter egg audio: rapid sprinting footsteps that get louder
   * fast, with heartbeat thumps underneath - sells "he's rushing you from the door"
   */
  playScoutLingerApproach(): void {
    try {
      const audioContext = this.ensureSharedAudioContext();
      if (!audioContext) return;
      const now = audioContext.currentTime;

      // Four rapid sneaker steps, ramping up hard as he closes in
      // Timed to the ~140ms sprint-bob cycle of the visual
      for (let i = 0; i < 4; i++) {
        const start = now + 0.05 + i * 0.13;
        const stepDuration = 0.07;
        const loudness = 0.1 + i * 0.06; // Each step closer = louder

        // Thud body of the step
        const thud = audioContext.createOscillator();
        const thudGain = audioContext.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(110 - i * 8, start);
        thud.frequency.exponentialRampToValueAtTime(50, start + stepDuration);
        thudGain.gain.setValueAtTime(loudness, start);
        thudGain.gain.exponentialRampToValueAtTime(0.001, start + stepDuration);
        thud.connect(thudGain);
        thudGain.connect(this.bus(audioContext));
        thud.start(start);
        thud.stop(start + stepDuration);

        // Scuff noise on top (sneaker on concrete)
        const scuffDuration = 0.05;
        const buffer = audioContext.createBuffer(1, audioContext.sampleRate * scuffDuration, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < data.length; j++) {
          data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
        }
        const scuff = audioContext.createBufferSource();
        scuff.buffer = buffer;
        const scuffFilter = audioContext.createBiquadFilter();
        scuffFilter.type = 'highpass';
        scuffFilter.frequency.value = 1500;
        const scuffGain = audioContext.createGain();
        scuffGain.gain.setValueAtTime(loudness * 0.5, start);
        scuffGain.gain.exponentialRampToValueAtTime(0.001, start + scuffDuration);
        scuff.connect(scuffFilter);
        scuffFilter.connect(scuffGain);
        scuffGain.connect(this.bus(audioContext));
        scuff.start(start);
        scuff.stop(start + scuffDuration);
      }

      // Heartbeat thumps underneath - the player's own pulse
      for (let i = 0; i < 2; i++) {
        const start = now + 0.1 + i * 0.3;
        const thump = audioContext.createOscillator();
        const thumpGain = audioContext.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(55, start);
        thump.frequency.exponentialRampToValueAtTime(35, start + 0.12);
        thumpGain.gain.setValueAtTime(0.2, start);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        thump.connect(thumpGain);
        thumpGain.connect(this.bus(audioContext));
        thump.start(start);
        thump.stop(start + 0.15);
      }
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Play creepy Medic ghost scream - jarring and lasts full duration
   */
  playMedicGhostScream(): void {
    // Stop any existing scream first
    this.stopMedicGhostScream();
    
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.medicGhostAudioContext = audioContext;
      this.medicGhostOscillators = [];
      
      // Standalone context bypasses the shared master bus — apply SFX volume here
      const screamBus = audioContext.createGain();
      screamBus.gain.value = getSfxVolume();
      screamBus.connect(this.bus(audioContext));
      
      const duration = 3.5;  // Full ghost duration
      
      // LOUD initial shriek - the jumpscare
      const shriek = audioContext.createOscillator();
      const shriekGain = audioContext.createGain();
      shriek.connect(shriekGain);
      shriekGain.connect(screamBus);
      
      shriek.type = 'sawtooth';
      shriek.frequency.setValueAtTime(1800, audioContext.currentTime);
      shriek.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.8);
      
      shriekGain.gain.setValueAtTime(0.35, audioContext.currentTime);  // LOUD
      shriekGain.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + 0.3);
      shriekGain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + duration);
      
      shriek.start(audioContext.currentTime);
      shriek.stop(audioContext.currentTime + duration);
      this.medicGhostOscillators.push(shriek);
      
      // Distorted warbling layer - unsettling
      const warble = audioContext.createOscillator();
      const warbleGain = audioContext.createGain();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      
      lfo.connect(lfoGain);
      lfoGain.connect(warble.frequency);
      warble.connect(warbleGain);
      warbleGain.connect(screamBus);
      
      warble.type = 'square';
      warble.frequency.value = 600;
      lfo.type = 'sine';
      lfo.frequency.value = 8;  // Fast vibrato
      lfoGain.gain.value = 200;  // Wide pitch variation
      
      warbleGain.gain.setValueAtTime(0.12, audioContext.currentTime);
      warbleGain.gain.setValueAtTime(0.12, audioContext.currentTime + duration * 0.7);
      warbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      lfo.start(audioContext.currentTime);
      warble.start(audioContext.currentTime);
      lfo.stop(audioContext.currentTime + duration);
      warble.stop(audioContext.currentTime + duration);
      this.medicGhostOscillators.push(lfo, warble);
      
      // Deep rumbling drone - threatening
      const drone = audioContext.createOscillator();
      const droneGain = audioContext.createGain();
      drone.connect(droneGain);
      droneGain.connect(screamBus);
      
      drone.type = 'sawtooth';
      drone.frequency.value = 55;
      
      droneGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      droneGain.gain.setValueAtTime(0.2, audioContext.currentTime + duration * 0.8);
      droneGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      drone.start(audioContext.currentTime);
      drone.stop(audioContext.currentTime + duration);
      this.medicGhostOscillators.push(drone);
      
      // Random glitchy pops throughout
      for (let i = 0; i < 6; i++) {
        const pop = audioContext.createOscillator();
        const popGain = audioContext.createGain();
        pop.connect(popGain);
        popGain.connect(screamBus);
        
        pop.type = 'square';
        pop.frequency.value = 100 + Math.random() * 2000;
        
        const t = audioContext.currentTime + 0.2 + Math.random() * (duration - 0.5);
        popGain.gain.setValueAtTime(0.15, t);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        
        pop.start(t);
        pop.stop(t + 0.1);
        this.medicGhostOscillators.push(pop);
      }
      
    } catch (e) {
      // Audio not available
    }
  }

  /**
   * Stop the Medic ghost scream immediately
   */
  stopMedicGhostScream(): void {
    try {
      // Stop all tracked oscillators
      for (const osc of this.medicGhostOscillators) {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      }
      this.medicGhostOscillators = [];
      
      // Close the audio context
      if (this.medicGhostAudioContext) {
        this.medicGhostAudioContext.close();
        this.medicGhostAudioContext = null;
      }
    } catch (e) {
      // Ignore errors
    }
  }

}
