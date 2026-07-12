import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../types';
import { updateSaveOnVictory, updateSaveOnNight6Complete } from '../utils/saveData';
import { drawJumpscareSilhouette, drawCelebratingMercs } from '../drawing/enemySilhouettes';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import {
  drawMedicGhostSilhouette,
  drawPaulingJumpscarePortrait,
} from '../drawing/medicPaulingPortraits';
import { PALETTE, FONTS } from '../ui/kit/theme';
import { addScanlines, addStatic, ensureNoiseTexture } from '../ui/kit/effects';
import type { GameScene } from '../scenes/GameScene';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Display-font style (Fjalla One) for end-screen titles */
function display(size: number, color: string): TextStyle {
  return { fontFamily: FONTS.display, fontSize: `${size}px`, color };
}

/** Terminal-font style (VT323) for end-screen body text */
function term(size: number, color: string): TextStyle {
  return { fontFamily: FONTS.terminal, fontSize: `${size}px`, color };
}

/**
 * Win/lose flows: jumpscare game-overs, victory screens, and the good/bad/dark
 * endings (incl. endless Night 6). Extracted from GameScene; game state stays
 * on the scene, accessed via public members.
 */
export class EndingsSystem {
  constructor(private scene: GameScene) {}

  /** Static grain + scanlines over the end screen (security-feed dressing). */
  private addCrtDressing(staticAlpha = 0.04): void {
    ensureNoiseTexture(this.scene);
    const grain = addStatic(this.scene, 640, 360, 1280, 720, staticAlpha);
    this.scene.endScreen.add(grain);
    const scan = addScanlines(this.scene, 0, 0, 1280, 720, 0.1);
    this.scene.endScreen.add(scan);
  }

  /**
   * The lonely Engineer: sitting on the floor of a dark room, slumped
   * forward, hardhat lamp dead, wrench dropped beside him. Shared by both
   * dark endings. (x, y) is roughly his lap; drawing spans ~y-100..y+70.
   */
  private drawLonelyEngineer(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Soft warm pool of light from above — layered circles, no hard edges
    g.fillStyle(0x33220f, 0.1);
    g.fillCircle(x, y - 55, 190);
    g.fillStyle(0x442d14, 0.12);
    g.fillCircle(x, y - 35, 130);
    g.fillStyle(0x553a1a, 0.13);
    g.fillCircle(x, y - 15, 85);
    
    // Ground shadow
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(x, y + 64, 160, 20);
    
    // Dim warm silhouette palette
    const cloth = 0x2b211a;    // overalls
    const clothHi = 0x3a2c20;
    const shirt = 0x4a2620;    // RED team shirt, in shadow
    const skin = 0x584434;
    const hat = 0x6a5426;      // dimmed yellow hardhat
    const hatHi = 0x7d6530;
    
    // Legs — knees up, feet planted
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(x - 48, y + 6, 34, 46, 8);
    g.fillRoundedRect(x + 14, y + 6, 34, 46, 8);
    // Boots
    g.fillStyle(0x1d1712, 1);
    g.fillRoundedRect(x - 54, y + 46, 42, 14, 4);
    g.fillRoundedRect(x + 12, y + 46, 42, 14, 4);
    
    // Hunched torso
    g.fillStyle(shirt, 1);
    g.fillEllipse(x - 2, y - 20, 76, 80);
    // Overall bib
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(x - 24, y - 34, 44, 50, 8);
    // Straps over the shoulders
    g.fillStyle(clothHi, 1);
    g.fillRect(x - 20, y - 50, 8, 20);
    g.fillRect(x + 8, y - 50, 8, 20);
    
    // Arms hanging over the knees
    g.fillStyle(shirt, 1);
    g.fillRoundedRect(x - 48, y - 24, 18, 46, 8);
    g.fillRoundedRect(x + 28, y - 24, 18, 46, 8);
    // Gloved hands, limp
    g.fillStyle(0x3a3128, 1);
    g.fillCircle(x - 39, y + 24, 9);
    g.fillCircle(x + 37, y + 24, 9);
    
    // Head bowed forward
    g.fillStyle(skin, 1);
    g.fillCircle(x - 2, y - 64, 20);
    // Goggles pushed up — dark band with two lenses
    g.fillStyle(0x241c14, 1);
    g.fillRoundedRect(x - 21, y - 71, 40, 9, 4);
    g.fillStyle(0x191510, 1);
    g.fillCircle(x - 10, y - 66, 6);
    g.fillCircle(x + 7, y - 66, 6);
    
    // Hardhat: dome, then brim, tilted with the bowed head
    g.fillStyle(hat, 1);
    g.beginPath();
    g.arc(x - 2, y - 74, 22, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(hatHi, 1);
    g.fillEllipse(x - 2, y - 74, 54, 9);
    // Dead headlamp
    g.fillStyle(0x33291a, 1);
    g.fillCircle(x - 2, y - 89, 5);
    
    // Wrench dropped on the floor beside him
    g.fillStyle(0x4c4438, 1);
    g.fillRoundedRect(x + 62, y + 52, 46, 7, 3);
    g.fillCircle(x + 64, y + 55, 8);
    g.fillStyle(0x5c5344, 1);
    g.fillRect(x + 100, y + 49, 10, 13);
  }

  /** Blinking terminal-style return prompt. */
  private addReturnPrompt(y: number, label = '>> SPACE or CLICK to return to menu'): void {
    const prompt = this.scene.add.text(640, y, label, term(20, PALETTE.amberDimCss)).setOrigin(0.5);
    this.scene.endScreen.add(prompt);
    this.scene.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

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
    
    // Security-feed cut: static + scanlines under the report, with a very
    // quiet dead-feed hiss fading in underneath
    this.addCrtDressing(0.06);
    this.scene.audio.startDeadFeedStatic();
    
    // Show time of death (12-hour format)
    const hours24 = Math.floor(this.scene.gameMinutes / 60);
    const mins = this.scene.gameMinutes % 60;
    const displayHours = hours24 === 0 ? 12 : hours24;  // 00:XX becomes 12:XX
    const timeStr = `${displayHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} AM`;
    
    // OSD header line, like the camera feed's last frame — shows where the
    // Engineer actually was when the feed cut
    const osdLine = this.scene.add
      .text(640, 210, `REC ● ${this.scene.getLocationLabel()} — ${timeStr} — FEED TERMINATED`, term(22, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(osdLine);
    
    const title = this.scene.add.text(640, 300, 'GAME OVER', display(80, PALETTE.alertCss)).setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    // Unsteady phosphor flicker on the title
    this.scene.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.78 },
      duration: 90,
      yoyo: true,
      repeat: -1,
      hold: 900,
      repeatDelay: 500,
    });
    
    const subtitle = this.scene.add.text(640, 385, reason, term(26, PALETTE.amberCss)).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    this.addReturnPrompt(470);
    
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
    
    // Dark, somber ending screen — faint grain, no bright scanlines
    ensureNoiseTexture(this.scene);
    const grain = addStatic(this.scene, 640, 360, 1280, 720, 0.03);
    this.scene.endScreen.add(grain);
    
    const title = this.scene.add.text(640, 100, 'THE END', display(64, PALETTE.creamCss))
      .setOrigin(0.5)
      .setAlpha(0.75);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add.text(640, 170, 'You survived...', term(28, PALETTE.amberDimCss)).setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Survival time - the "badge of honor"
    const survivalText = this.scene.add.text(640, 230, survivalStr, term(46, PALETTE.amberCss)).setOrigin(0.5);
    this.scene.endScreen.add(survivalText);
    
    const cost = this.scene.add.text(640, 290, 'but at what cost?', term(24, PALETTE.amberDimCss))
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.scene.endScreen.add(cost);
    
    // Lonely Engineer silhouette - sitting alone, defeated
    const graphics = this.scene.add.graphics();
    this.drawLonelyEngineer(graphics, 640, 440);
    this.scene.endScreen.add(graphics);
    
    // Death reason (smaller, at bottom)
    const deathReason = this.scene.add.text(640, 560, reason, term(20, PALETTE.alertDimCss)).setOrigin(0.5);
    this.scene.endScreen.add(deathReason);
    
    this.addReturnPrompt(620);
    
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
    
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.92);
    this.scene.endScreen.add(overlay);
    
    this.addCrtDressing();
    
    const time = this.scene.add.text(640, 190, '6:00 AM', display(84, PALETTE.creamCss)).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const displayNight = this.scene.nightNumber === 7 ? 'CUSTOM' : this.scene.nightNumber === 8 ? 'NIGHTMARE' : this.scene.nightNumber;
    const title = this.scene.add
      .text(640, 295, `NIGHT ${displayNight} COMPLETE`, display(42, PALETTE.amberCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add
      .text(640, 360, 'Shift over. You survived the night.', term(24, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Star rating based on sentry level
    const starLevel = this.scene.sentry.exists ? this.scene.sentry.level : 0;
    const stars = '★'.repeat(starLevel) + '☆'.repeat(3 - starLevel);
    const starColor = starLevel === 3 ? '#ffd700' : starLevel === 2 ? '#c0c0c0' : '#cd7f32';
    
    const ratingLabel = this.scene.add.text(640, 430, 'SENTRY RATING', term(18, PALETTE.amberDimCss)).setOrigin(0.5);
    this.scene.endScreen.add(ratingLabel);
    
    const starRating = this.scene.add.text(640, 470, stars, {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: starColor,
    }).setOrigin(0.5);
    this.scene.endScreen.add(starRating);
    
    const levelText = this.scene.add
      .text(640, 512, starLevel > 0 ? `Level ${starLevel} Sentry` : 'No Sentry', term(20, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(levelText);
    
    this.addReturnPrompt(585, '>> SPACE or CLICK to continue');
    
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
    
    // Warm dawn glow — sunrise over 2Fort, matching the game's amber palette
    const dawnWash = this.scene.add.rectangle(640, 360, 1280, 720, 0x2a1608, 0.4);
    this.scene.endScreen.add(dawnWash);
    const dawnGlow = this.scene.add.graphics();
    dawnGlow.fillStyle(0xffb454, 0.05);
    dawnGlow.fillCircle(640, 130, 420);
    dawnGlow.fillStyle(0xffb454, 0.06);
    dawnGlow.fillCircle(640, 100, 260);
    this.scene.endScreen.add(dawnGlow);
    
    const time = this.scene.add.text(640, 80, '6:00 AM', display(56, PALETTE.creamCss)).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const title = this.scene.add
      .text(640, 145, 'The nightmare is over.', term(34, PALETTE.amberCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(title);
    
    const subtitle = this.scene.add
      .text(640, 185, 'You held the line, Engineer.', term(26, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(subtitle);
    
    // Draw all 9 mercs celebrating (simplified silhouettes)
    const celebrationGraphics = this.scene.add.graphics();
    drawCelebratingMercs(celebrationGraphics);
    this.scene.endScreen.add(celebrationGraphics);
    
    const theEnd = this.scene.add.text(640, 520, 'THE END', display(60, PALETTE.creamCss)).setOrigin(0.5);
    this.scene.endScreen.add(theEnd);
    
    // Credits
    const credits = this.scene.add
      .text(640, 590, '— Thank you for playing —', term(20, PALETTE.amberDimCss))
      .setOrigin(0.5);
    this.scene.endScreen.add(credits);
    
    this.addReturnPrompt(650);
    
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
    
    // Faint static under the story text
    ensureNoiseTexture(this.scene);
    const grain = addStatic(this.scene, 640, 360, 1280, 720, 0.035);
    this.scene.endScreen.add(grain);
    
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
      
      const text = this.scene.add
        .text(640, y, line, term(26, i >= 6 ? PALETTE.alertCss : PALETTE.amberDimCss))
        .setOrigin(0.5)
        .setAlpha(0);
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
    const night6 = this.scene.add
      .text(640, 550, 'NIGHT 6', display(72, PALETTE.alertCss))
      .setOrigin(0.5)
      .setAlpha(0);
    this.scene.endScreen.add(night6);
    
    this.scene.tweens.add({
      targets: night6,
      alpha: 1,
      duration: 1000,
      delay: 4500,
    });
    
    const prompt = this.scene.add
      .text(640, 620, '>> SPACE or CLICK to begin', term(20, PALETTE.amberDimCss))
      .setOrigin(0.5)
      .setAlpha(0);
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
    
    // Faint grain, no bright scanlines — this ending stays somber
    ensureNoiseTexture(this.scene);
    const grain = addStatic(this.scene, 640, 360, 1280, 720, 0.03);
    this.scene.endScreen.add(grain);
    
    const time = this.scene.add.text(640, 150, '6:00 AM', display(60, PALETTE.amberCss)).setOrigin(0.5);
    this.scene.endScreen.add(time);
    
    const survived = this.scene.add.text(640, 230, 'You survived...', term(32, PALETTE.amberDimCss)).setOrigin(0.5);
    this.scene.endScreen.add(survived);
    
    const cost = this.scene.add.text(640, 280, 'but at what cost?', term(28, PALETTE.amberDimCss))
      .setOrigin(0.5)
      .setAlpha(0.8);
    this.scene.endScreen.add(cost);
    
    // Lonely Engineer silhouette
    const graphics = this.scene.add.graphics();
    this.drawLonelyEngineer(graphics, 640, 420);
    this.scene.endScreen.add(graphics);
    
    const theEnd = this.scene.add.text(640, 550, 'THE END', display(52, PALETTE.creamCss))
      .setOrigin(0.5)
      .setAlpha(0.7);
    this.scene.endScreen.add(theEnd);
    
    this.addReturnPrompt(650);
    
    this.scene.endScreen.setVisible(true);
    
    this.scene.input.keyboard?.once('keydown-SPACE', () => {
      this.scene.goToMainMenu();
    });
    this.scene.input.once('pointerdown', () => {
      this.scene.goToMainMenu();
    });
  }

}
