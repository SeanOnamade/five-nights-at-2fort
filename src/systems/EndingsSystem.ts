import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../types';
import { updateSaveOnVictory, updateSaveOnNight6Complete } from '../utils/saveData';
import { drawJumpscareSilhouette, drawCelebratingMercs } from '../drawing/enemySilhouettes';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import {
  drawMedicGhostSilhouette,
  drawPaulingJumpscarePortrait,
} from '../drawing/medicPaulingPortraits';
import type { GameScene } from '../scenes/GameScene';

/**
 * Win/lose flows: jumpscare game-overs, victory screens, and the good/bad/dark
 * endings (incl. endless Night 6). Extracted from GameScene; game state stays
 * on the scene, accessed via public members.
 */
export class EndingsSystem {
  constructor(private scene: GameScene) {}

  public gameOver(reason: string): void {
    if (this.scene.gameStatus !== 'PLAYING') return;

    this.scene.merasmus.reset();
    
    this.scene.gameStatus = 'LOST';
    // Stop ALL sounds immediately
    this.scene.audio.stopAllGameSounds();
    this.scene.recordings.stop(); // Stop Engineer recording if playing
    console.log('GAME OVER:', reason);

    // Determine which enemy killed the player
    const reasonLower = reason.toLowerCase();
    const isScout = reasonLower.includes('scout');
    const isDemoman = reasonLower.includes('demoman');
    const isHeavy = reasonLower.includes('heavy');
    const isSoldier = reasonLower.includes('soldier') || reasonLower.includes('breached');
    const isSniper = reasonLower.includes('snipe') || reasonLower.includes('sniper');
    const isPyro = reasonLower.includes('pyro') || reasonLower.includes('burned') || reasonLower.includes('overheated');
    // Note: don't match bare 'vent' - the Pyro thermostat death reason mentions vents too
    const isPauling = reasonLower.includes('pauling');
    const isMerasmus = reasonLower.includes('merasmus');
    
    // Create jumpscare container
    this.scene.endScreen.removeAll(true);
    this.scene.endScreen.setVisible(true);  // IMPORTANT: Make visible!
    
    // Dark flash
    const flash = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 1);
    this.scene.endScreen.add(flash);
    
    // Create enemy jumpscare graphic (zooms in from center)
    const jumpscareContainer = this.scene.add.container(640, 360);
    this.scene.endScreen.add(jumpscareContainer);
    
    // Draw proper character model for jumpscare
    const enemyGraphics = this.scene.add.graphics();
    if (isPauling) {
      drawPaulingJumpscarePortrait(enemyGraphics);
    } else if (isMerasmus) {
      drawCharacterSilhouette(enemyGraphics, 0, 0, 'MERASMUS', 0x8866dd);
    } else {
      drawJumpscareSilhouette(enemyGraphics, isScout, isSoldier, isDemoman, isHeavy, isSniper, isPyro);
    }
    jumpscareContainer.add(enemyGraphics);
    
    // The standard kill: jumpscare sound + shake + fast zoom-in
    const startKillSequence = () => {
      flash.setAlpha(1);  // Full blackout behind the jumpscare (linger keeps room visible until now)
      this.scene.tweens.killTweensOf(enemyGraphics);  // Stop the linger walk bob
      enemyGraphics.setPosition(0, 0);
      this.scene.audio.playJumpscareSound();
      this.scene.cameras.main.shake(300, 0.03);

      // Jumpscare zoom animation
      this.scene.tweens.add({
        targets: jumpscareContainer,
        scale: 2.5,
        alpha: 1,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          // Shake while zoomed
          this.scene.tweens.add({
            targets: jumpscareContainer,
            x: 640 + Phaser.Math.Between(-20, 20),
            y: 360 + Phaser.Math.Between(-20, 20),
            duration: 50,
            repeat: 5,
            yoyo: true,
            onComplete: () => {
              // Fade to game over screen
              this.scene.tweens.add({
                targets: jumpscareContainer,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  this.showGameOverScreen(reason);
                }
              });
            }
          });
        }
      });
    };

    // Easter egg: 2-in-5 Scout kills, he bursts through the left door and
    // sprints at the player before the actual jumpscare
    const scoutLinger = isScout && Math.random() < 0.4;

    if (scoutLinger) {
      console.log('👀 Scout linger easter egg triggered!');

      // Reveal the Intel room - Scout rushes in THROUGH the door, not over black
      this.scene.cameraUI?.setVisible(false);
      this.scene.roomViewUI?.setVisible(false);
      this.scene.isCameraMode = false;

      // Lights dim instead of full blackout so the room stays visible behind him
      flash.setAlpha(0.4);

      // Scout bursts through the left doorway (his attack path) and sprints at the player
      jumpscareContainer.setPosition(120, 330);
      jumpscareContainer.setScale(0.55);
      jumpscareContainer.setAlpha(0);
      this.scene.audio.playScoutLingerApproach();

      this.scene.tweens.add({
        targets: jumpscareContainer,
        alpha: 1,
        duration: 80,
        ease: 'Power2',
      });

      // The sprint: door to your face in half a second
      this.scene.tweens.add({
        targets: jumpscareContainer,
        scale: 1.35,
        x: 640,
        y: 385,
        duration: 500,
        ease: 'Quad.easeIn',
        onComplete: startKillSequence,
      });

      // Rapid sprint bob on the inner graphics - fast footfalls with a hard tilt
      this.scene.tweens.add({
        targets: enemyGraphics,
        y: 8,
        angle: 3.5,
        duration: 70,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 6,
      });
    } else {
      // Start small and zoom in fast
      jumpscareContainer.setScale(0.1);
      jumpscareContainer.setAlpha(0);
      startKillSequence();
    }
  }

  /**
   * Show Pyro jumpscare for Give Up, then transition to dark ending
   */
  showGiveUpJumpscare(): void {
    // Play jumpscare sound
    this.scene.audio.playJumpscareSound();
    
    // Screen shake for impact
    this.scene.cameras.main.shake(300, 0.03);
    
    // Create jumpscare container
    this.scene.endScreen.removeAll(true);
    this.scene.endScreen.setVisible(true);
    
    // Dark flash
    const flash = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 1);
    this.scene.endScreen.add(flash);
    
    // Create Pyro jumpscare graphic
    const jumpscareContainer = this.scene.add.container(640, 360);
    this.scene.endScreen.add(jumpscareContainer);
    
    // Draw Pyro for the jumpscare (isPyro = true)
    const enemyGraphics = this.scene.add.graphics();
    drawJumpscareSilhouette(enemyGraphics, false, false, false, false, false, true);
    jumpscareContainer.add(enemyGraphics);
    
    // Start small and zoom in fast
    jumpscareContainer.setScale(0.1);
    jumpscareContainer.setAlpha(0);
    
    // Jumpscare zoom animation
    this.scene.tweens.add({
      targets: jumpscareContainer,
      scale: 2.5,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        // Shake while zoomed
        this.scene.tweens.add({
          targets: jumpscareContainer,
          x: 640 + Phaser.Math.Between(-20, 20),
          y: 360 + Phaser.Math.Between(-20, 20),
          duration: 50,
          repeat: 5,
          yoyo: true,
          onComplete: () => {
            // Fade to dark ending
            this.scene.tweens.add({
              targets: jumpscareContainer,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                // Show dark ending with sad chime on menu return
                const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
                this.scene.endScreen.add(overlay);
                this.showEndlessDarkEnding('You gave up...', false, true);  // playSadChimeOnReturn = true
              }
            });
          }
        });
      }
    });
  }

  showGameOverScreen(reason: string): void {
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
    this.scene.endScreen.add(overlay);
    
    // For endless Night 6, show the dark ending with survival stats
    if (this.scene.isBadEndingNight6) {
      this.showEndlessDarkEnding(reason);
      return;
    }
    
    // Show time of death (12-hour format)
    const hours24 = Math.floor(this.scene.gameMinutes / 60);
    const mins = this.scene.gameMinutes % 60;
    const displayHours = hours24 === 0 ? 12 : hours24;  // 00:XX becomes 12:XX
    const timeStr = `${displayHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} AM`;
    
    const timeText = this.scene.add.text(640, 220, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '36px',
      color: '#ff4444',
    }).setOrigin(0.5);
    this.scene.endScreen.add(timeText);
    
    const title = this.scene.add.text(640, 290, 'GAME OVER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add.text(640, 370, reason, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    const menuPrompt = this.scene.add.text(640, 460, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);
    this.scene.endScreen.add(menuPrompt);
    
    this.scene.tweens.add({
      targets: menuPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    
    this.scene.endScreen.setVisible(true);
    
    // Return to menu on space or click
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      this.scene.goToMainMenu();
    });
  }

  /**
   * Show the dark ending for endless Night 6 with survival stats
   * This is the "bad ending" - player was trapped in an endless night and eventually fell
   * @param skipSound - If true, don't play the dark ending sound (e.g., when give up sound already played)
   * @param playSadChimeOnReturn - If true, play the give up sound when returning to menu
   */
  showEndlessDarkEnding(reason: string, skipSound: boolean = false, playSadChimeOnReturn: boolean = false): void {
    if (!skipSound) {
      this.scene.audio.playDarkEndingSound();  // Melancholic melody
    }
    
    // Store flag for menu return
    const shouldPlaySadChime = playSadChimeOnReturn;
    
    // Update save - mark game completed (unlocks everything)
    updateSaveOnNight6Complete();
    
    // Calculate survival stats
    const totalMinutes = this.scene.endlessSurvivalMinutes;
    // Days survived = endlessDay - 6 (Night 6 starts, Day 7 = 1 day survived, etc.)
    const survivalDays = this.scene.hasReached6AM ? (this.scene.endlessDay - 6) : 0;
    const survivalHours = Math.floor(totalMinutes / 60);
    const survivalMins = totalMinutes % 60;
    
    // Format survival time (with proper singular/plural)
    const hourWord = survivalHours === 1 ? 'hour' : 'hours';
    const minWord = survivalMins === 1 ? 'minute' : 'minutes';
    const dayWord = survivalDays === 1 ? 'day' : 'days';
    const hoursInDay = survivalHours % 24;
    const hoursInDayWord = hoursInDay === 1 ? 'hour' : 'hours';
    const minsInHour = survivalMins;
    const minsInHourWord = minsInHour === 1 ? 'minute' : 'minutes';
    
    let survivalStr = '';
    if (survivalDays > 0) {
      // Multiple days - show days, hours, and minutes
      survivalStr = `${survivalDays} ${dayWord}, ${hoursInDay} ${hoursInDayWord}, ${minsInHour} ${minsInHourWord}`;
    } else if (survivalHours > 0) {
      survivalStr = `${survivalHours} ${hourWord}, ${survivalMins} ${minWord}`;
    } else {
      survivalStr = `${survivalMins} ${minWord}`;
    }
    
    // Dark, somber ending screen
    const title = this.scene.add.text(640, 100, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#553333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add.text(640, 170, 'You survived...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#666666',
    }).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Survival time - the "badge of honor"
    const survivalText = this.scene.add.text(640, 230, survivalStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '42px',
      color: '#aa8800',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(survivalText);
    
    const cost = this.scene.add.text(640, 290, 'but at what cost?', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#555555',
    }).setOrigin(0.5);
    this.scene.endScreen.add(cost);
    
    // Lonely Engineer silhouette - sitting alone, defeated
    const graphics = this.scene.add.graphics();
    
    // Dark room backdrop with subtle gradient
    graphics.fillStyle(0x080810, 0.95);
    graphics.fillRect(340, 305, 600, 230);
    
    // Atmospheric spotlight from above - warm but dim
    graphics.fillStyle(0x443322, 0.08);
    graphics.fillCircle(640, 300, 150);
    graphics.fillStyle(0x554433, 0.12);
    graphics.fillCircle(640, 340, 100);
    graphics.fillStyle(0x665544, 0.18);
    graphics.fillCircle(640, 370, 60);
    graphics.fillStyle(0x776655, 0.25);
    graphics.fillCircle(640, 390, 35);
    
    const engX = 640;
    const engY = 430;
    
    // Shadow beneath (drawn first)
    graphics.fillStyle(0x000000, 0.5);
    graphics.fillEllipse(engX, engY + 75, 100, 18);
    
    // LEGS - Engineer's work pants, sitting on crate/ground
    graphics.fillStyle(0x2a2a3a, 1);
    // Left leg bent
    graphics.beginPath();
    graphics.moveTo(engX - 40, engY + 30);
    graphics.lineTo(engX - 15, engY + 30);
    graphics.lineTo(engX - 20, engY + 65);
    graphics.lineTo(engX - 50, engY + 65);
    graphics.closePath();
    graphics.fillPath();
    // Right leg extended slightly
    graphics.beginPath();
    graphics.moveTo(engX + 5, engY + 30);
    graphics.lineTo(engX + 35, engY + 30);
    graphics.lineTo(engX + 55, engY + 65);
    graphics.lineTo(engX + 20, engY + 65);
    graphics.closePath();
    graphics.fillPath();
    
    // Work boots
    graphics.fillStyle(0x222230, 1);
    graphics.fillRoundedRect(engX - 55, engY + 60, 25, 12, 3);
    graphics.fillRoundedRect(engX + 35, engY + 60, 28, 12, 3);
    
    // TORSO - RED team shirt (but dim in shadow)
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX - 35, engY - 35);
    graphics.lineTo(engX + 30, engY - 35);
    graphics.lineTo(engX + 35, engY + 35);
    graphics.lineTo(engX - 40, engY + 35);
    graphics.closePath();
    graphics.fillPath();
    
    // Overalls straps
    graphics.fillStyle(0x252535, 1);
    graphics.fillRect(engX - 25, engY - 30, 8, 50);
    graphics.fillRect(engX + 12, engY - 30, 8, 50);
    
    // LEFT ARM - resting on knee, holding wrench
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX - 35, engY - 25);
    graphics.lineTo(engX - 45, engY - 15);
    graphics.lineTo(engX - 55, engY + 15);
    graphics.lineTo(engX - 45, engY + 20);
    graphics.closePath();
    graphics.fillPath();
    // Gloved hand
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillCircle(engX - 52, engY + 18, 10);
    // Wrench (iconic!)
    graphics.fillStyle(0x444450, 1);
    graphics.fillRect(engX - 75, engY + 10, 30, 6);
    graphics.fillStyle(0x3a3a45, 1);
    graphics.fillRect(engX - 78, engY + 5, 8, 16);
    
    // RIGHT ARM - up to face, defeated pose
    graphics.fillStyle(0x3a2a2a, 1);
    graphics.beginPath();
    graphics.moveTo(engX + 25, engY - 25);
    graphics.lineTo(engX + 35, engY - 35);
    graphics.lineTo(engX + 25, engY - 55);
    graphics.lineTo(engX + 15, engY - 45);
    graphics.closePath();
    graphics.fillPath();
    // Gunslinger (robotic hand) touching face
    graphics.fillStyle(0x4a4a55, 1);
    graphics.fillCircle(engX + 22, engY - 58, 9);
    graphics.fillStyle(0x555560, 1);
    graphics.fillCircle(engX + 22, engY - 58, 6);
    
    // HEAD - slightly tilted down in despair
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillCircle(engX + 5, engY - 65, 24);
    
    // Neck
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillRect(engX - 5, engY - 45, 15, 12);
    
    // HARDHAT - Engineer's iconic yellow hardhat (dimmed)
    // Brim first
    graphics.fillStyle(0x4a4535, 1);
    graphics.fillEllipse(engX + 5, engY - 80, 35, 8);
    // Dome
    graphics.fillStyle(0x555540, 1);
    graphics.beginPath();
    graphics.arc(engX + 5, engY - 82, 26, Math.PI, 0, false);
    graphics.closePath();
    graphics.fillPath();
    // Highlight on dome
    graphics.fillStyle(0x666650, 0.5);
    graphics.beginPath();
    graphics.arc(engX + 5, engY - 85, 18, Math.PI * 1.2, Math.PI * 1.8, false);
    graphics.closePath();
    graphics.fillPath();
    // Hardhat light (dim, not powered)
    graphics.fillStyle(0x444438, 1);
    graphics.fillCircle(engX + 5, engY - 100, 7);
    graphics.fillStyle(0x333330, 1);
    graphics.fillCircle(engX + 5, engY - 100, 4);
    
    // GOGGLES - pushed up on forehead (iconic Engineer look)
    graphics.fillStyle(0x333340, 1);
    graphics.fillRoundedRect(engX - 18, engY - 82, 42, 10, 3);
    // Goggle lenses
    graphics.fillStyle(0x222235, 1);
    graphics.fillCircle(engX - 8, engY - 77, 7);
    graphics.fillCircle(engX + 14, engY - 77, 7);
    // Lens reflection (very subtle)
    graphics.fillStyle(0x334455, 0.3);
    graphics.fillCircle(engX - 10, engY - 79, 3);
    graphics.fillCircle(engX + 12, engY - 79, 3);
    
    // Face details (in shadow but visible)
    // Brow/eye area (shadowed)
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillRect(engX - 12, engY - 70, 30, 8);
    
    // Slight stubble/jaw
    graphics.fillStyle(0x404050, 1);
    graphics.fillEllipse(engX + 5, engY - 50, 18, 12);
    
    this.scene.endScreen.add(graphics);
    
    // Death reason (smaller, at bottom)
    const deathReason = this.scene.add.text(640, 560, reason, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#664444',
    }).setOrigin(0.5);
    this.scene.endScreen.add(deathReason);
    
    const prompt = this.scene.add.text(640, 620, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#444444',
    }).setOrigin(0.5);
    this.scene.endScreen.add(prompt);
    
    this.scene.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.scene.endScreen.setVisible(true);
    
    console.log(`🌙 Endless Night 6 ended. Survived ${survivalStr} (${survivalDays} days)`);
    
    // Return to menu on space or click
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      if (shouldPlaySadChime) {
        this.scene.audio.playGiveUpSound();
      }
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      if (shouldPlaySadChime) {
        this.scene.audio.playGiveUpSound();
      }
      this.scene.goToMainMenu();
    });
  }

  victory(): void {
    if (this.scene.gameStatus !== 'PLAYING') return;

    this.scene.merasmus.reset();
    
    this.scene.gameStatus = 'WON';
    this.scene.audio.stopAllGameSounds(); // Stop ALL sounds
    this.scene.recordings.stop(); // Stop Engineer recording if playing
    this.scene.audio.playVictoryChime(); // Play triumphant sound
    console.log('VICTORY!');
    
    // Update HUD to show 06 AM (consistent with gameplay display)
    this.scene.hud.timeText.setText('06 AM');
    
    // Handle different victory scenarios
    if (this.scene.isCustomNightMode) {
      // Custom Night - just show standard victory, no save updates
      this.showStandardVictoryScreen();
    } else if (this.scene.isBadEndingNight6) {
      // Survived Night 6 (bad ending path) - show dark ending
      updateSaveOnNight6Complete();
      this.showDarkEnding();
    } else if (this.scene.isNightmareMode) {
      // Nightmare Mode - fixed difficulty finite night, show standard victory
      this.showStandardVictoryScreen();
    } else {
      // Story nights 1-5 - save progress and check for endings
      const { triggeredBadEnding, triggeredGoodEnding } = updateSaveOnVictory(
        this.scene.nightNumber, 
        this.scene.sessionDestructions
      );
      
      if (triggeredGoodEnding) {
        // Night 5 complete with <5 destructions - Good ending!
        this.showGoodEnding();
      } else if (triggeredBadEnding) {
        // Night 5 complete with 5+ destructions - Bad ending path
        this.showBadEndingIntro();
      } else {
        // Nights 1-4: standard victory screen
        this.showStandardVictoryScreen();
      }
    }
  }

  /**
   * Show standard night complete victory screen
   */
  showStandardVictoryScreen(): void {
    this.scene.endScreen.removeAll(true);
    
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
    this.scene.endScreen.add(overlay);
    
    const time = this.scene.add.text(640, 200, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '72px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const displayNight = this.scene.nightNumber === 7 ? 'CUSTOM' : this.scene.nightNumber === 8 ? 'NIGHTMARE' : this.scene.nightNumber;
    const title = this.scene.add.text(640, 300, `NIGHT ${displayNight} COMPLETE!`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#00ff00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add.text(640, 370, 'You survived the night!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Star rating based on sentry level
    const starLevel = this.scene.sentry.exists ? this.scene.sentry.level : 0;
    const stars = '★'.repeat(starLevel) + '☆'.repeat(3 - starLevel);
    const starColor = starLevel === 3 ? '#ffd700' : starLevel === 2 ? '#c0c0c0' : '#cd7f32';
    
    const ratingLabel = this.scene.add.text(640, 430, 'SENTRY RATING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#888888',
    }).setOrigin(0.5);
    this.scene.endScreen.add(ratingLabel);
    
    const starRating = this.scene.add.text(640, 470, stars, {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: starColor,
    }).setOrigin(0.5);
    this.scene.endScreen.add(starRating);
    
    const levelText = this.scene.add.text(640, 510, starLevel > 0 ? `Level ${starLevel} Sentry` : 'No Sentry', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.scene.endScreen.add(levelText);
    
    const menuPrompt = this.scene.add.text(640, 580, 'SPACE or CLICK to continue', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#888888',
    }).setOrigin(0.5);
    this.scene.endScreen.add(menuPrompt);
    
    this.scene.tweens.add({
      targets: menuPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    
    this.scene.endScreen.setVisible(true);
    
    // Return to menu on space or click
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      this.scene.goToMainMenu();
    });
  }

  /**
   * Show good ending - peaceful scene with all mercs celebrating
   */
  showGoodEnding(): void {
    this.scene.audio.playGoodEndingSound();  // Triumphant fanfare
    
    this.scene.endScreen.removeAll(true);
    
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.95);
    this.scene.endScreen.add(overlay);
    
    // Peaceful blue/warm gradient feel
    const gradientOverlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x1a2a4a, 0.3);
    this.scene.endScreen.add(gradientOverlay);
    
    const time = this.scene.add.text(640, 80, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const title = this.scene.add.text(640, 140, 'The nightmare is over.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add.text(640, 180, 'You held the line, Engineer.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#66cc66',
    }).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Draw all 9 mercs celebrating (simplified silhouettes)
    const celebrationGraphics = this.scene.add.graphics();
    drawCelebratingMercs(celebrationGraphics);
    this.scene.endScreen.add(celebrationGraphics);
    
    const theEnd = this.scene.add.text(640, 520, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(theEnd);
    
    // Credits
    const credits = this.scene.add.text(640, 590, '- Thank you for playing -', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5);
    this.scene.endScreen.add(credits);
    
    const prompt = this.scene.add.text(640, 650, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#555555',
    }).setOrigin(0.5);
    this.scene.endScreen.add(prompt);
    
    this.scene.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.scene.endScreen.setVisible(true);
    
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      this.scene.goToMainMenu();
    });
  }

  /**
   * Show bad ending intro - Medic gone mad screen before Night 6
   */
  showBadEndingIntro(): void {
    this.scene.audio.playBadEndingIntroSound();  // Ominous drone
    
    this.scene.endScreen.removeAll(true);
    
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.98);
    this.scene.endScreen.add(overlay);
    
    // Red tint for ominous feel
    const redOverlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x330000, 0.3);
    this.scene.endScreen.add(redOverlay);
    
    // Story text - appearing line by line
    const lines = [
      'The constant gunfire...',
      'The explosions...',
      '',
      'The sentry\'s destruction echoed through',
      'the base, night after night.',
      '',
      'Medic couldn\'t take it anymore.',
      '',
      'He\'s thrown himself to the monsters.',
      'He\'s become one of them.',
    ];
    
    let y = 180;
    lines.forEach((line, i) => {
      if (line === '') {
        y += 20;
        return;
      }
      
      const text = this.scene.add.text(640, y, line, {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        color: i >= 6 ? '#ff4444' : '#aaaaaa',
      }).setOrigin(0.5).setAlpha(0);
      this.scene.endScreen.add(text);
      
      // Fade in each line
      this.scene.tweens.add({
        targets: text,
        alpha: 1,
        duration: 500,
        delay: i * 400,
      });
      
      y += 35;
    });
    
    // Night 6 announcement
    const night6 = this.scene.add.text(640, 550, 'NIGHT 6', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.scene.endScreen.add(night6);
    
    this.scene.tweens.add({
      targets: night6,
      alpha: 1,
      duration: 1000,
      delay: 4500,
    });
    
    const prompt = this.scene.add.text(640, 620, 'SPACE or CLICK to begin', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5).setAlpha(0);
    this.scene.endScreen.add(prompt);
    
    this.scene.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 500,
      delay: 5500,
      onComplete: () => {
        this.scene.tweens.add({
          targets: prompt,
          alpha: 0.3,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }
    });
    
    this.scene.endScreen.setVisible(true);
    
    // Start Night 6 on input (after delay)
    this.scene.time.delayedCall(5500, () => {
      const startNight6 = () => {
        this.scene.cameras.main.fadeOut(800, 0, 0, 0);
        this.scene.time.delayedCall(800, () => {
          this.scene.scene.start('GameScene', { 
            night: 6,
            isBadEndingNight6: true,
            customEnemies: {
              scout: true,
              soldier: true,
              demoman: true,
              heavy: true,
              sniper: true,
              spy: true,
              pyro: true,
              medic: true
            }
          });
        });
      };
      
      this.scene.input.keyboard?.once('keydown-SPACE', startNight6);
      this.scene.input.once('pointerdown', startNight6);
    });
  }

  /**
   * Show dark ending after surviving Night 6
   */
  showDarkEnding(): void {
    this.scene.endScreen.removeAll(true);
    
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.98);
    this.scene.endScreen.add(overlay);
    
    const time = this.scene.add.text(640, 150, '6:00 AM', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#aa8800',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const survived = this.scene.add.text(640, 230, 'You survived...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#888888',
    }).setOrigin(0.5);
    this.scene.endScreen.add(survived);
    
    const cost = this.scene.add.text(640, 280, 'but at what cost?', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#666666',
    }).setOrigin(0.5);
    this.scene.endScreen.add(cost);
    
    // Lonely Engineer silhouette
    const graphics = this.scene.add.graphics();
    
    // Dark room with single figure
    graphics.fillStyle(0x111122, 0.8);
    graphics.fillRect(440, 320, 400, 200);
    
    // Engineer silhouette - alone, hunched
    graphics.fillStyle(0x333344, 1);
    graphics.fillCircle(640, 380, 30); // Head
    graphics.fillRoundedRect(610, 400, 60, 80, 10); // Body
    // Hardhat
    graphics.fillStyle(0x444455, 1);
    graphics.fillEllipse(640, 360, 40, 15);
    
    // Single dim light above
    graphics.fillStyle(0x554422, 0.3);
    graphics.fillCircle(640, 320, 80);
    graphics.fillStyle(0x665533, 0.5);
    graphics.fillCircle(640, 340, 40);
    
    this.scene.endScreen.add(graphics);
    
    const theEnd = this.scene.add.text(640, 550, 'THE END', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#553333',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.scene.endScreen.add(theEnd);
    
    const prompt = this.scene.add.text(640, 650, 'SPACE or CLICK to return to menu', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#444444',
    }).setOrigin(0.5);
    this.scene.endScreen.add(prompt);
    
    this.scene.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    this.scene.endScreen.setVisible(true);
    
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      this.scene.goToMainMenu();
    });
  }

}
