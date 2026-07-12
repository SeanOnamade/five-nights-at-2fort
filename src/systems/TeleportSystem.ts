import Phaser from 'phaser';
import { NodeId, CAMERAS, GAME_CONSTANTS, ROOM_ADJACENCY } from '../types';
import type { GameScene } from '../scenes/GameScene';

/**
 * Teleporter mechanics (Night 3+): teleporting to rooms, the teleport
 * animation overlay, cancel/return flows, button appearance, and the
 * escape-danger countdown while an enemy approaches. Extracted from GameScene;
 * game state stays on the scene, accessed via public members.
 */
export class TeleportSystem {
  constructor(private scene: GameScene) {}

  /**
   * Teleport engineer to a room
   */
  teleportToRoom(node: NodeId): void {
    if (node === 'INTEL') {
      this.scene.showAlert('Cannot teleport to Intel room!', 'warning');
      return;
    }

    // Block teleport if Administrator has hacked this room's teleporter
    if (this.scene.isAdministratorEnabled() && this.scene.hackedRooms.get(node)?.hacked) {
      this.scene.showAlert('TELEPORTER OFFLINE', 'danger');
      return;
    }
    
    // Store pending destination (for cancel feature)
    this.scene.pendingTeleportDestination = node;
    
    // Freeze Pyro and Sniper teleportation during player's teleport animation
    // This prevents the unfair situation where they teleport into the destination
    // while the animation is playing
    if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
      this.scene.pyro.freezeTeleport();
      this.scene.pyro.setBlockedDestination(node);
    }
    if (this.scene.isSniperEnabled() && this.scene.sniper) {
      this.scene.sniper.freezeTeleport();
      this.scene.sniper.setBlockedDestination(node);
    }
    
    // Freeze Scout and Soldier movement during player's teleport animation
    // This prevents them from moving into rooms while player is mid-teleport
    if (this.scene.isScoutEnabled() && this.scene.scout) {
      this.scene.scout.freezeMovement();
    }
    if (this.scene.isSoldierEnabled() && this.scene.soldier) {
      this.scene.soldier.freezeMovement();
    }
    
    // Show teleport animation overlay FIRST, then check for enemies after arrival
    this.showTeleportAnimation(() => {
      // If game ended during teleport animation (e.g., Pyro timer ran out), don't proceed
      if (this.scene.gameStatus !== 'PLAYING') {
        // Still unfreeze enemies to prevent them being stuck
        if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
          this.scene.pyro.unfreezeTeleport();
        }
        if (this.scene.isSniperEnabled() && this.scene.sniper) {
          this.scene.sniper.unfreezeTeleport();
        }
        if (this.scene.isScoutEnabled() && this.scene.scout) {
          this.scene.scout.unfreezeMovement();
        }
        if (this.scene.isSoldierEnabled() && this.scene.soldier) {
          this.scene.soldier.unfreezeMovement();
        }
        return;
      }
      
      // Check if any enemy BODY is in this room (not just heads)
      // NOTE: Pyro stays frozen until AFTER this check completes
      const scoutThere = this.scene.scout.isAtNode(node);
      const soldierThere = this.scene.soldier.isAtNode(node);
      // Demoman body doesn't kill on teleport - his threat is at the doors only
      const heavyThere = this.scene.isHeavyEnabled() && this.scene.heavy.isAtNode(node);
      const sniperThere = this.scene.isSniperEnabled() && this.scene.sniper.isAtNode(node);
      // Pyro: in Room mode, teleporting to his room = death (he's invisible but deadly)
      const pyroThere = this.scene.isPyroEnabled() && this.scene.pyro && 
                        !this.scene.pyro.isForceDespawned() && 
                        this.scene.pyro.isAtNode(node);
      
      console.log(`Arrived at ${node}. Enemies: Scout=${scoutThere}, Soldier=${soldierThere}, Heavy=${heavyThere}, Sniper=${sniperThere}, Pyro=${pyroThere}`);
      
      // Helper to unfreeze enemies before returning
      const unfreezeAndReturn = () => {
        if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
          this.scene.pyro.unfreezeTeleport();
        }
        if (this.scene.isSniperEnabled() && this.scene.sniper) {
          this.scene.sniper.unfreezeTeleport();
        }
        if (this.scene.isScoutEnabled() && this.scene.scout) {
          this.scene.scout.unfreezeMovement();
        }
        if (this.scene.isSoldierEnabled() && this.scene.soldier) {
          this.scene.soldier.unfreezeMovement();
        }
      };
      
      // Check each enemy type and show appropriate jumpscare AFTER teleport animation
      if (scoutThere) {
        unfreezeAndReturn();
        this.scene.endings.gameOver('Scout caught you!');
        return;
      }
      if (soldierThere) {
        unfreezeAndReturn();
        this.scene.endings.gameOver('Soldier got you!');
        return;
      }
      if (heavyThere) {
        unfreezeAndReturn();
        this.scene.endings.gameOver('Heavy crushed you!');
        return;
      }
      if (sniperThere) {
        unfreezeAndReturn();
        this.scene.endings.gameOver('Sniped at close range!');
        return;
      }
      if (pyroThere) {
        unfreezeAndReturn();
        this.scene.endings.gameOver('Pyro burned you alive!');
        return;
      }
      
      // No enemy - safe to teleport
      this.scene.isTeleported = true;
      this.scene.currentRoom = node;
      this.scene.teleportEscapeTimer = 0;
      this.scene.enemyApproachingRoom = false;
      this.scene.approachingEnemyType = 'an enemy';

      // Track last teleported room for Administrator Mode 1; reset no-teleport timer for Mode 2
      this.scene.lastTeleportedRoom = node;
      this.scene.administratorNoTeleportTimer = 0;

      // Scare Administrator if she was targeting this room during TARGETING phase
      if (this.scene.isAdministratorEnabled() && this.scene.administrator && this.scene.administrator.isActive()) {
        if (this.scene.administrator.getCurrentTarget() === node && this.scene.administrator.getState() === 'TARGETING') {
          this.scene.administrator.scareAdministrator();
        }
      }
      
      // Stop dispenser hum when leaving Intel room
      this.scene.audio.stopDispenserHum();
      this.scene.audio.stopIntelRoomAmbience();
      
      // Reset aim states (important for mobile touch zones)
      this.scene.keyADown = false;
      this.scene.keyDDown = false;
      this.scene.sentry.aimedDoor = 'NONE';
      
      // Immediately check for approaching enemies and identify which one
      const adjacent = ROOM_ADJACENCY[this.scene.currentRoom] || [];
      
      let approachingEnemy = '';
      if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned() && this.scene.pyro.getMode() === 'ROOM' && adjacent.includes(this.scene.pyro.currentNode)) {
        approachingEnemy = 'Pyro';
      } else if (this.scene.isHeavyEnabled() && this.scene.heavy.isActive() && adjacent.includes(this.scene.heavy.currentNode)) {
        approachingEnemy = 'Heavy';
      } else if (this.scene.isSniperEnabled() && this.scene.sniper.isActive() && adjacent.includes(this.scene.sniper.currentNode)) {
        approachingEnemy = 'Sniper';
      } else if (this.scene.isScoutEnabled() && this.scene.scout.isActive() && adjacent.includes(this.scene.scout.currentNode)) {
        approachingEnemy = 'Scout';
      } else if (this.scene.isSoldierEnabled() && this.scene.soldier.isActive() && adjacent.includes(this.scene.soldier.currentNode)) {
        approachingEnemy = 'Soldier';
      }
      
      if (approachingEnemy) {
        this.scene.enemyApproachingRoom = true;
        this.scene.approachingEnemyType = approachingEnemy;
        this.scene.teleportEscapeTimer = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
        this.scene.showAlert('A nearby enemy heard you!', 'danger');
        this.scene.escapeWarning.setVisible(true);
        this.scene.roomDoorwayEyes.setVisible(true);
        this.scene.audio.playEnemyApproachSound();
      }
      
      // Hide camera UI, show room view
      this.scene.cameraUI.setVisible(false);
      this.scene.isCameraMode = false;
      this.scene.roomViewUI.setVisible(true);
      
      // Move metal text below room header when teleported (aligned with header at x=40)
      this.scene.hud.metalText.setPosition(40, 60);
      
      // Move lure bar below metal text when teleported
      this.scene.hud.lureBarContainer.setPosition(100, 105);
      
      // Update room view header + per-room props
      this.scene.roomViewHeader.setText(`ROOM: ${node.replace('_', ' ')}`);
      this.scene.drawTeleportedRoomProps(node);
      
      // Update lure button text if lure is active here
      this.scene.lure.updateLureButtonText();
      
      // Spy may sap the sentry when player leaves Intel!
      if (this.scene.isSpyEnabled() && this.scene.spy && this.scene.sentry.exists && !this.scene.spy.isSapping()) {
        const sapPlaced = this.scene.spy.attemptSap();
        if (sapPlaced) {
          this.scene.showAlert('⚠ SPY SAPPING SENTRY!', 'danger');
          this.scene.sapperIndicator.setVisible(true);
          this.scene.audio.playSapperSound();
          // Flash screen red to make it very noticeable
          this.scene.cameras.main.flash(300, 255, 100, 100, false);
        }
      }
      
      // Unfreeze all enemies AFTER all checks complete - prevents race condition
      if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
        this.scene.pyro.unfreezeTeleport();
      }
      if (this.scene.isSniperEnabled() && this.scene.sniper) {
        this.scene.sniper.unfreezeTeleport();
      }
      if (this.scene.isScoutEnabled() && this.scene.scout) {
        this.scene.scout.unfreezeMovement();
      }
      if (this.scene.isSoldierEnabled() && this.scene.soldier) {
        this.scene.soldier.unfreezeMovement();
      }
      
      console.log(`Engineer teleported to ${node}`);
    });
  }

  /**
   * Return engineer to Intel room
   */
  returnToIntel(): void {
    // Stop any approach sounds
    this.scene.audio.stopApproachGrowl();
    
    // Show teleport animation overlay
    this.showTeleportAnimation(() => {
      this.scene.isTeleported = false;
      this.scene.currentRoom = 'INTEL';
      this.scene.roomViewUI.setVisible(false);
      this.scene.escapeWarning.setVisible(false);
      this.scene.roomDoorwayEyes.setVisible(false);
      this.scene.enemyApproachingRoom = false;
      this.scene.approachingEnemyType = 'an enemy';
      this.scene.teleportEscapeTimer = 0;
      
      // Restore metal text to original position
      this.scene.hud.metalText.setPosition(20, 20);
      
      // Restore lure bar to original position (right of metal count, with spacing)
      this.scene.hud.lureBarContainer.setPosition(300, 28);
      
      // Resume dispenser hum when back in Intel room
      this.scene.audio.startDispenserHum();
      this.scene.audio.startIntelRoomAmbience();
      
      console.log('Engineer returned to Intel room');
      
      // Check if any enemy is waiting in Intel room (reached while player was away)
      if (this.scene.isHeavyEnabled() && this.scene.heavy.currentNode === 'INTEL') {
        this.scene.endings.gameOver('Heavy was waiting for you!');
        return;
      }
      if (this.scene.isScoutEnabled() && this.scene.scout.state === 'ATTACKING') {
        this.scene.endings.gameOver('Scout was waiting for you!');
        return;
      }
      if (this.scene.isSoldierEnabled() && this.scene.soldier.state === 'ATTACKING') {
        this.scene.endings.gameOver('Soldier was waiting for you!');
        return;
      }
      if (this.scene.isDemomanEnabled() && this.scene.demoman.state === 'ATTACKING') {
        this.scene.endings.gameOver('Demoman was waiting for you!');
        return;
      }

      // Administrator Mode 1: auto-hack last teleported room on return to Intel
      this.scene.handleAdministratorMode1();
    });
  }

  /**
   * Show teleport animation with particle effects (1 second duration)
   */
  showTeleportAnimation(onComplete: () => void): void {
    // Mark animation as in progress
    this.scene.isTeleportAnimating = true;
    
    // Update button to show cancel option
    this.updateTeleportButtonAppearance();
    
    // Play teleport sound
    this.scene.audio.playTeleportSound();
    
    // Create teleport overlay
    const overlay = this.scene.add.container(640, 360);
    overlay.setDepth(200);
    
    // Store reference for cancellation
    this.scene.teleportAnimationOverlay = overlay;
    
    // Dark flash background
    const flash = this.scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0);
    overlay.add(flash);
    
    // Red glow circle expanding from center (RED team teleporter)
    const glowCircle = this.scene.add.circle(0, 0, 10, 0xff4444, 0.8);
    overlay.add(glowCircle);
    
    // Inner bright core
    const core = this.scene.add.circle(0, 0, 5, 0xffffff, 1);
    overlay.add(core);
    
    // "TELEPORTING..." text
    const teleportText = this.scene.add.text(0, 150, 'TELEPORTING...', {
      fontFamily: 'VT323, "Courier New", monospace',
      fontSize: '28px',
      color: '#ff6666',
    }).setOrigin(0.5);
    teleportText.setAlpha(0);
    overlay.add(teleportText);
    
    // Create swirling particles
    const particles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const particle = this.scene.add.circle(
        Math.cos(angle) * 50,
        Math.sin(angle) * 50,
        4,
        0xff4444  // RED team teleporter particles
      );
      particle.setAlpha(0);
      particles.push(particle);
      overlay.add(particle);
    }
    
    // Animation sequence
    // 1. Flash in and expand glow
    this.scene.tweens.add({
      targets: flash,
      alpha: 0.7,
      duration: 150,
      yoyo: true,
    });
    
    this.scene.tweens.add({
      targets: glowCircle,
      scale: 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
    });
    
    this.scene.tweens.add({
      targets: core,
      scale: 5,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
    });
    
    // Text fade in
    this.scene.tweens.add({
      targets: teleportText,
      alpha: 1,
      duration: 200,
      delay: 100,
    });
    
    // Swirling particles
    particles.forEach((particle, i) => {
      const delay = i * 30;
      const angle = (i / 20) * Math.PI * 2;
      
      this.scene.tweens.add({
        targets: particle,
        alpha: 1,
        duration: 100,
        delay: delay,
      });
      
      this.scene.tweens.add({
        targets: particle,
        x: Math.cos(angle) * 200,
        y: Math.sin(angle) * 200,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        delay: delay + 100,
        ease: 'Power1',
      });
    });
    
    // Complete after 1 second
    this.scene.teleportAnimationCallback = this.scene.time.delayedCall(1000, () => {
      this.scene.isTeleportAnimating = false;
      this.scene.teleportAnimationOverlay = null;
      this.scene.teleportAnimationCallback = null;
      this.scene.pendingTeleportDestination = null;
      this.updateTeleportButtonAppearance();
      overlay.destroy();
      onComplete();
    });
  }

  /**
   * Cancel an in-progress teleport animation
   */
  cancelTeleport(): void {
    if (!this.scene.isTeleportAnimating) return;
    
    console.log('Teleport cancelled!');
    
    // Cancel the delayed callback
    if (this.scene.teleportAnimationCallback) {
      this.scene.teleportAnimationCallback.remove();
      this.scene.teleportAnimationCallback = null;
    }
    
    // Destroy the overlay (kill child tweens first so orphaned tweens
    // don't keep running against destroyed targets)
    if (this.scene.teleportAnimationOverlay) {
      this.scene.teleportAnimationOverlay.each((child: Phaser.GameObjects.GameObject) => {
        this.scene.tweens.killTweensOf(child);
      });
      this.scene.tweens.killTweensOf(this.scene.teleportAnimationOverlay);
      this.scene.teleportAnimationOverlay.destroy();
      this.scene.teleportAnimationOverlay = null;
    }
    
    // Unfreeze all enemies
    if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
      this.scene.pyro.unfreezeTeleport();
    }
    if (this.scene.isSniperEnabled() && this.scene.sniper) {
      this.scene.sniper.unfreezeTeleport();
    }
    if (this.scene.isScoutEnabled() && this.scene.scout) {
      this.scene.scout.unfreezeMovement();
    }
    if (this.scene.isSoldierEnabled() && this.scene.soldier) {
      this.scene.soldier.unfreezeMovement();
    }
    
    // Reset state
    this.scene.isTeleportAnimating = false;
    this.scene.pendingTeleportDestination = null;
    
    // Update button appearance back to normal
    this.updateTeleportButtonAppearance();
    
    // Show cancel feedback
    this.scene.showAlert('Teleport cancelled!', 'info');
  }

  /**
   * Update teleport button appearance based on animation state
   */
  updateTeleportButtonAppearance(): void {
    if (!this.scene.teleportButtonBg?.active || !this.scene.teleportButtonText?.active) return;

    const hacked = this.scene.isSelectedCameraHacked();

    if (hacked) {
      // Hacked state — alert red, repair progress fills the button while held
      this.scene.teleportButtonBg.setFillStyle(0x140e06);
      this.scene.teleportButtonBg.setStrokeStyle(2, 0xff3b30);
      this.scene.teleportButtonText.setText('HACKED — HOLD TO REPAIR');
      this.scene.teleportButtonText.setColor('#ff3b30');
      this.scene.teleportRepairBarFill?.setVisible(true);
    } else if (this.scene.isTeleportAnimating) {
      // Cancel mode - amber/warning colors
      this.scene.teleportButtonBg.setFillStyle(0x2a1f10);
      this.scene.teleportButtonBg.setStrokeStyle(2, 0xffb454);
      this.scene.teleportButtonText.setText('✕ CANCEL');
      this.scene.teleportButtonText.setColor('#ffb454');
      this.scene.teleportRepairBarBg?.setVisible(false);
      this.scene.teleportRepairBarFill?.setVisible(false);
    } else {
      // Normal mode - alert red (risk action)
      this.scene.teleportButtonBg.setFillStyle(0x1c0a06);
      this.scene.teleportButtonBg.setStrokeStyle(2, 0x7a2420);
      this.scene.teleportButtonText.setText('TELEPORT HERE');
      this.scene.teleportButtonText.setColor('#ff3b30');
      this.scene.teleportRepairBarBg?.setVisible(false);
      this.scene.teleportRepairBarFill?.setVisible(false);
    }
  }

  /**
   * Update teleport danger check - runs every frame regardless of which enemies are enabled
   */
  updateTeleportDanger(delta: number): void {
    // Only run on Night 3+ when teleporting is available (escapeWarning only exists then)
    if (!this.scene.escapeWarning) return;
    
    // Check if enemy is IN the Engineer's room or approaching
    if (this.scene.isTeleported && this.scene.currentRoom !== 'INTEL') {
      // Check if any enemy is IN the same room as engineer (very dangerous!)
      const scoutInRoom = this.scene.isScoutEnabled() && this.scene.scout.currentNode === this.scene.currentRoom && this.scene.scout.isActive();
      const soldierInRoom = this.scene.isSoldierEnabled() && this.scene.soldier.currentNode === this.scene.currentRoom && this.scene.soldier.isActive();
      const heavyInRoom = this.scene.isHeavyEnabled() && this.scene.heavy.currentNode === this.scene.currentRoom && this.scene.heavy.isActive();
      const sniperInRoom = this.scene.isSniperEnabled() && this.scene.sniper.currentNode === this.scene.currentRoom && this.scene.sniper.isActive();
      const demomanInRoom = this.scene.isDemomanEnabled() && this.scene.demoman.isCharging() && this.scene.demoman.currentNode === this.scene.currentRoom;
      const pyroInRoom = this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned() && this.scene.pyro.isAtNode(this.scene.currentRoom);
      
      const enemyInRoom = scoutInRoom || soldierInRoom || heavyInRoom || sniperInRoom || demomanInRoom || pyroInRoom;
      
      const adjacent = ROOM_ADJACENCY[this.scene.currentRoom] || [];
      
      // Identify which enemy is approaching (prioritize in-room over adjacent)
      let newApproachingEnemy = '';
      if (pyroInRoom) newApproachingEnemy = 'Pyro';
      else if (scoutInRoom) newApproachingEnemy = 'Scout';
      else if (soldierInRoom) newApproachingEnemy = 'Soldier';
      else if (heavyInRoom) newApproachingEnemy = 'Heavy';
      else if (sniperInRoom) newApproachingEnemy = 'Sniper';
      else if (demomanInRoom) newApproachingEnemy = 'Demoman';
      else if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned() && this.scene.pyro.getMode() === 'ROOM' && adjacent.includes(this.scene.pyro.currentNode)) {
        newApproachingEnemy = 'Pyro';
      } else if (this.scene.isHeavyEnabled() && this.scene.heavy.isActive() && adjacent.includes(this.scene.heavy.currentNode)) {
        newApproachingEnemy = 'Heavy';
      } else if (this.scene.isSniperEnabled() && this.scene.sniper.isActive() && adjacent.includes(this.scene.sniper.currentNode)) {
        newApproachingEnemy = 'Sniper';
      } else if (this.scene.isScoutEnabled() && this.scene.scout.isActive() && adjacent.includes(this.scene.scout.currentNode)) {
        newApproachingEnemy = 'Scout';
      } else if (this.scene.isSoldierEnabled() && this.scene.soldier.isActive() && adjacent.includes(this.scene.soldier.currentNode)) {
        newApproachingEnemy = 'Soldier';
      }
      
      // Enemy in room OR adjacent triggers warning
      const enemyApproaching = enemyInRoom || !!newApproachingEnemy;
      
      if (enemyApproaching && !this.scene.enemyApproachingRoom) {
        // Enemy just arrived - start the danger timer
        this.scene.enemyApproachingRoom = true;
        this.scene.approachingEnemyType = newApproachingEnemy || 'an enemy';
        this.scene.teleportEscapeTimer = GAME_CONSTANTS.TELEPORT_ESCAPE_TIME;
        this.scene.showAlert('A nearby enemy heard you!', 'danger');
        this.scene.escapeWarning.setVisible(true);
        this.scene.roomDoorwayEyes.setVisible(true);
        this.scene.audio.playEnemyApproachSound();
      } else if (!enemyApproaching && this.scene.enemyApproachingRoom) {
        // Enemy left the area - reset the warning so it can trigger again
        // But DON'T hide the escape warning yet - player still needs to leave
        // Just allow future enemies to re-trigger the alert
        console.log('Enemy left area, resetting approach detection');
        this.scene.enemyApproachingRoom = false;
        this.scene.escapeWarning.setVisible(false);
        this.scene.roomDoorwayEyes.setVisible(false);
        this.scene.audio.stopApproachGrowl();
      }
      
      // Keep the danger active while enemy is nearby
      if (this.scene.enemyApproachingRoom) {
        this.scene.teleportEscapeTimer -= delta;
        
        // Update progress bar (shrinks from full to empty)
        const progress = Math.max(0, this.scene.teleportEscapeTimer / GAME_CONSTANTS.TELEPORT_ESCAPE_TIME);
        const progressBar = this.scene.escapeWarning.list[1] as Phaser.GameObjects.Rectangle;
        const innerGlow = this.scene.escapeWarning.list[2] as Phaser.GameObjects.Rectangle;
        
        // Use displayWidth instead of scale for proper visual shrinking
        progressBar.displayWidth = 310 * progress;
        innerGlow.displayWidth = 310 * progress;
        
        // Shake effect - gets more intense as time runs out
        const shakeIntensity = (1 - progress) * 8;
        this.scene.escapeWarning.setPosition(640 + (Math.random() - 0.5) * shakeIntensity, 580);
        
        // Pulse the red eyes
        const eyesAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.4;
        this.scene.roomDoorwayEyes.setAlpha(eyesAlpha);
        
        // Update growl intensity
        this.scene.audio.updateApproachGrowl(this.scene.teleportEscapeTimer);
        
        if (this.scene.teleportEscapeTimer <= 0) {
          // Too late - player dies. Use the enemy that triggered the approach.
          this.scene.audio.stopApproachGrowl();
          
          // Use the stored approaching enemy type (the one who triggered the timer)
          // This ensures proper jumpscare even if the enemy moved away
          const killer = this.scene.approachingEnemyType || 'an enemy';
          
          this.scene.endings.gameOver(`${killer} caught you!`);
          return;
        }
      }
    } else if (!this.scene.isTeleported && this.scene.escapeWarning.visible) {
      // Hide warning when back at Intel
      this.scene.escapeWarning.setVisible(false);
      this.scene.audio.stopApproachGrowl();
    }
  }

}
