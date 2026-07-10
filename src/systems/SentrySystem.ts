import Phaser from 'phaser';
import { GAME_CONSTANTS, SENTRY_MAX_HP, SentryLevel } from '../types';
import type { UberTarget } from '../entities/MedicEnemy';
import type { GameScene } from '../scenes/GameScene';

/**
 * Sentry and Wrangler mechanics: build/upgrade/repair/damage/destroy, manual
 * wrangler fire, auto-defense, and ubered-enemy escapes. Extracted from
 * GameScene; game state stays on the scene, accessed via public members.
 */
export class SentrySystem {
  constructor(private scene: GameScene) {}

  /**
   * Play looping repair buzz while player holds the repair bar
   * Called each frame while administratorRepairActive; manages its own throttle via _administratorRepairSoundTimer
   */
  fireWrangler(): void {
    if (!this.scene.sentry.exists || !this.scene.sentry.isWrangled) return;
    if (this.scene.sentry.aimedDoor === 'NONE') return; // Can't fire when not aiming at a door
    
    // Check cooldown (1 second between shots)
    if (this.scene.wranglerCooldown > 0) {
      this.scene.showAlert('COOLING DOWN...', 0xff6600);
      this.scene.audio.playDeniedSound();
      return;
    }
    
    // Check if we have enough metal to fire (always costs 50)
    if (this.scene.metal < 50) {
      this.scene.showAlert('NOT ENOUGH METAL TO FIRE!', 0xff0000);
      this.scene.audio.playDeniedSound();
      return;
    }
    
    // Deduct metal cost for firing
    this.scene.metal -= 50;
    
    // Start cooldown
    this.scene.wranglerCooldown = this.scene.WRANGLER_COOLDOWN;
    
    // Visual feedback
    this.scene.cameras.main.shake(100, 0.01);
    this.scene.audio.playSound('fire');
    
    // Fire bullet projectile
    const targetX = this.scene.sentry.aimedDoor === 'LEFT' ? 120 : 1160;
    const targetY = 310;
    this.scene.fireBulletProjectile(640, 500, targetX, targetY);
    
    // Flash the aim beam
    this.scene.aimBeam.clear();
    this.scene.aimBeam.lineStyle(8, 0xffff00, 1);
    if (this.scene.sentry.aimedDoor === 'LEFT') {
      this.scene.aimBeam.lineBetween(640, 500, 120, 310);
    } else {
      this.scene.aimBeam.lineBetween(640, 500, 1160, 310);
    }
    
    // Reset beam after flash
    this.scene.time.delayedCall(100, () => {
      // Don't run after death - updateWranglerVisuals can restart the
      // detection sound over the jumpscare
      if (this.scene.gameStatus !== 'PLAYING') return;
      this.scene.updateWranglerVisuals();
    });
    
    // Check if we hit an enemy
    let hitEnemy = false;
    
    // PYRO REFLECTION CHECK - Pyro reflects sentry fire and destroys sentry!
    // This check happens BEFORE other enemy checks
    if (this.scene.isPyroEnabled() && this.scene.pyro && !this.scene.pyro.isForceDespawned()) {
      const pyroHallway = this.scene.pyro.getHallway();
      const firingAtPyro = (this.scene.sentry.aimedDoor === 'LEFT' && pyroHallway === 'LEFT') ||
                           (this.scene.sentry.aimedDoor === 'RIGHT' && pyroHallway === 'RIGHT');
      if (firingAtPyro) {
        // Pyro reflects the shot! Sentry is destroyed!
        console.log('🔥 PYRO REFLECTED YOUR SHOT!');
        this.scene.showAlert('PYRO REFLECTED! SENTRY DESTROYED!', 0xff4400);
        this.destroySentry();
        this.scene.audio.playPyroReflectSound();
        // Pyro teleports away immediately after reflecting
        this.scene.pyro.teleportToRandomRoom();
        return; // Don't process any other hits
      }
    }
    
    if (this.scene.sentry.aimedDoor === 'LEFT') {
      // Check Scout at left door (if enabled)
      if (this.scene.isScoutEnabled() && this.scene.scout.currentNode === 'LEFT_HALL' && 
          (this.scene.scout.state === 'WAITING' || this.scene.scout.state === 'ATTACKING')) {
        // Check if Scout is Übered (Medic) - can't be repelled!
        if (this.scene.isMedicEnabled() && this.scene.medic && this.scene.medic.isEnemyUbered('SCOUT')) {
          this.scene.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true; // Still counts as hitting (spent metal)
        } else {
          this.scene.scout.driveAway();
          this.scene.showAlert('SCOUT REPELLED!', 0x00ff00);
          this.scene.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Demoman at left door (if enabled)
      if (this.scene.isDemomanEnabled() && this.scene.demoman.getChargeDoor() === 'LEFT' &&
          (this.scene.demoman.currentNode === 'LEFT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.scene.isMedicEnabled() && this.scene.medic && this.scene.medic.isEnemyUbered('DEMOMAN')) {
          this.scene.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          // Bonus: +25 metal if hit during body phase (not just glow)
          if (this.scene.demoman.isInBodyPhase()) {
            this.scene.metal = Math.min(this.scene.metal + 25, GAME_CONSTANTS.MAX_METAL);
            this.scene.showAlert('REPELLED LAST SECOND! +25 METAL', 0x00ff00);
          } else {
            this.scene.showAlert('DEMOMAN REPELLED!', 0x00ff00);
          }
          this.scene.demoman.deter();
          // Allow Pyro to teleport to this hallway again
          if (this.scene.isPyroEnabled() && this.scene.pyro) {
            this.scene.pyro.onDemomanChargeEnd();
          }
          this.scene.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Sniper at left door (Night 4+) - ALWAYS requires 2 shots to repel
      // Only hit Sniper if he's actually AIMING (not if lured and just passing through)
      if (this.scene.isSniperEnabled() && this.scene.sniper.currentNode === 'LEFT_HALL' && 
          this.scene.sniper.isActive() && !this.scene.sniper.isCurrentlyLured()) {
        const fullyRepelled = this.scene.sniper.wardOff(this.scene.sentry.level);
        if (fullyRepelled) {
          this.scene.showAlert('SNIPER DRIVEN AWAY!', 0x00ff00);
          this.scene.audio.playEnemyRetreatSound();
        }
        // No alert for partial hits - the sniper aiming UI already shows shots remaining
        hitEnemy = true;
      }
    } else if (this.scene.sentry.aimedDoor === 'RIGHT') {
      // Check Soldier at right door (if enabled)
      if (this.scene.isSoldierEnabled() && this.scene.soldier.currentNode === 'RIGHT_HALL' && 
          (this.scene.soldier.state === 'WAITING' || this.scene.soldier.state === 'SIEGING')) {
        // Check if Soldier is Übered (Medic) - can't be repelled!
        if (this.scene.isMedicEnabled() && this.scene.medic && this.scene.medic.isEnemyUbered('SOLDIER')) {
          this.scene.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          this.scene.soldier.driveAway();
          this.scene.showAlert('SOLDIER REPELLED!', 0x00ff00);
          this.scene.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Demoman at right door (if enabled)
      if (this.scene.isDemomanEnabled() && this.scene.demoman.getChargeDoor() === 'RIGHT' &&
          (this.scene.demoman.currentNode === 'RIGHT_HALL')) {
        // Check if Demoman is Übered (Medic) - can't be repelled!
        if (this.scene.isMedicEnabled() && this.scene.medic && this.scene.medic.isEnemyUbered('DEMOMAN')) {
          this.scene.showAlert('ÜBERED! CANNOT REPEL!', 0xff4444);
          hitEnemy = true;
        } else {
          // Bonus: +25 metal if hit during body phase (not just glow)
          if (this.scene.demoman.isInBodyPhase()) {
            this.scene.metal = Math.min(this.scene.metal + 25, GAME_CONSTANTS.MAX_METAL);
            this.scene.showAlert('REPELLED LAST SECOND! +25 METAL', 0x00ff00);
          } else {
            this.scene.showAlert('DEMOMAN REPELLED!', 0x00ff00);
          }
          this.scene.demoman.deter();
          // Allow Pyro to teleport to this hallway again
          if (this.scene.isPyroEnabled() && this.scene.pyro) {
            this.scene.pyro.onDemomanChargeEnd();
          }
          this.scene.audio.playEnemyRetreatSound();
          hitEnemy = true;
        }
      }
      // Check Sniper at right door (if enabled) - ALWAYS requires 2 shots to repel
      // Only hit Sniper if he's actually AIMING (not if lured and just passing through)
      if (this.scene.isSniperEnabled() && this.scene.sniper.currentNode === 'RIGHT_HALL' && 
          this.scene.sniper.isActive() && !this.scene.sniper.isCurrentlyLured()) {
        const fullyRepelled = this.scene.sniper.wardOff(this.scene.sentry.level);
        if (fullyRepelled) {
          this.scene.showAlert('SNIPER DRIVEN AWAY!', 0x00ff00);
          this.scene.audio.playEnemyRetreatSound();
        }
        // No alert for partial hits - the sniper aiming UI already shows shots remaining
        hitEnemy = true;
      }
    }

    // If we missed, show feedback (Heavy absorbs sentry fire — lure only)
    if (!hitEnemy) {
      const heavyBlocking =
        (this.scene.sentry.aimedDoor === 'LEFT' && this.scene.isHeavyAtHallway('LEFT')) ||
        (this.scene.sentry.aimedDoor === 'RIGHT' && this.scene.isHeavyAtHallway('RIGHT'));
      if (heavyBlocking) {
        this.scene.showAlert('HEAVY IGNORES SENTRY! LURE HIM!', 0xff6600);
      } else {
        this.scene.showAlert('FIRED! (-50 metal)', 0xffaa00);
      }
    }
  }

  buildSentry(): void {
    if (this.scene.sentry.exists) {
      this.scene.showAlert('Sentry already exists!', 0xffff00);
      return;
    }
    
    // Can't build when cameras are up - must lower cameras first
    if (this.scene.isCameraMode) {
      this.scene.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't build remotely - must be in Intel room
    if (this.scene.isTeleported) {
      this.scene.showAlert('Return to Intel to build!', 0xff6600);
      return;
    }
    
    if (this.scene.metal < GAME_CONSTANTS.BUILD_SENTRY_COST) {
      this.scene.showAlert('Not enough metal! (100 required)', 0xff0000);
      return;
    }
    
    this.scene.metal -= GAME_CONSTANTS.BUILD_SENTRY_COST;
    this.scene.sentry = {
      exists: true,
      level: 1,
      hp: SENTRY_MAX_HP[1],
      maxHp: SENTRY_MAX_HP[1],
      isWrangled: false,
      aimedDoor: 'LEFT',
    };
    
    this.scene.sentryGraphic.setVisible(true);
    this.updateSentryVisuals();
    this.scene.updateHUD();
    this.scene.showAlert('SENTRY BUILT!', 0x00ff00);
    this.scene.audio.playSentryBuildSound();
  }

  upgradeSentry(): void {
    if (!this.scene.sentry.exists) {
      this.scene.showAlert('No sentry to upgrade!', 0xff0000);
      return;
    }
    
    // Can't upgrade when cameras are up - must lower cameras first
    if (this.scene.isCameraMode) {
      this.scene.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't upgrade remotely - must be in Intel room
    if (this.scene.isTeleported) {
      this.scene.showAlert('Return to Intel to upgrade!', 0xff6600);
      return;
    }
    
    if (this.scene.sentry.level >= 3) {
      this.scene.showAlert('Sentry already max level!', 0xffff00);
      return;
    }
    
    if (this.scene.sentry.hp < this.scene.sentry.maxHp) {
      this.scene.showAlert('Repair sentry to full HP first!', 0xff0000);
      return;
    }
    
    if (this.scene.metal < GAME_CONSTANTS.UPGRADE_SENTRY_COST) {
      this.scene.showAlert('Not enough metal! (200 required)', 0xff0000);
      return;
    }
    
    this.scene.metal -= GAME_CONSTANTS.UPGRADE_SENTRY_COST;
    this.scene.sentry.level = (this.scene.sentry.level + 1) as SentryLevel;
    this.scene.sentry.maxHp = SENTRY_MAX_HP[this.scene.sentry.level];
    this.scene.sentry.hp = this.scene.sentry.maxHp; // Full heal on upgrade
    
    this.updateSentryVisuals();
    this.scene.updateHUD();
    this.scene.showAlert(`SENTRY UPGRADED TO L${this.scene.sentry.level}!`, 0x00ff00);
    this.scene.audio.playSentryUpgradeSound();
  }

  repairSentry(): void {
    if (!this.scene.sentry.exists) {
      this.scene.showAlert('No sentry to repair!', 0xff0000);
      return;
    }
    
    // Can't repair when cameras are up - must lower cameras first
    if (this.scene.isCameraMode) {
      this.scene.showAlert('Lower cameras first! (TAB)', 0xff6600);
      return;
    }
    
    // Can't repair remotely - must be in Intel room
    if (this.scene.isTeleported) {
      this.scene.showAlert('Return to Intel to repair!', 0xff6600);
      return;
    }
    
    if (this.scene.sentry.hp >= this.scene.sentry.maxHp) {
      this.scene.showAlert('Sentry at full health!', 0xffff00);
      return;
    }
    
    // Calculate how much HP is missing and only charge for what's needed
    const missingHp = this.scene.sentry.maxHp - this.scene.sentry.hp;
    const hpToRepair = Math.min(missingHp, GAME_CONSTANTS.REPAIR_SENTRY_AMOUNT);
    const metalCost = hpToRepair; // 1 metal = 1 HP
    
    if (this.scene.metal < 1) {
      this.scene.showAlert('Not enough metal!', 0xff0000);
      return;
    }
    
    // Use available metal, up to what's needed
    const actualCost = Math.min(metalCost, Math.floor(this.scene.metal));
    const actualRepair = actualCost; // 1:1 ratio
    
    this.scene.metal -= actualCost;
    this.scene.sentry.hp = Math.min(this.scene.sentry.hp + actualRepair, this.scene.sentry.maxHp);
    
    this.scene.updateHUD();
    this.scene.showAlert(`+${Math.floor(actualRepair)} HP (-${Math.floor(actualCost)} metal)`, 0x00ff00);
    this.scene.audio.playSentryRepairSound();
  }

  damageSentry(amount: number): void {
    if (!this.scene.sentry.exists) return;
    
    this.scene.sentry.hp -= amount;
    this.scene.cameras.main.shake(200, 0.02);
    
    // Play rocket hit sound
    this.scene.audio.playSound('rocketHit');
    
    // Flash sentry red
    this.scene.sentryBody.setFillStyle(0xff0000);
    this.scene.time.delayedCall(200, () => {
      if (this.scene.sentry.exists) {
        this.scene.sentryBody.setFillStyle(0xBB4444); // Back to RED team color
      }
    });
    
    if (this.scene.sentry.hp <= 0) {
      this.destroySentry();
    }
    
    this.scene.updateHUD();
  }

  destroySentry(): void {
    this.scene.sentry.exists = false;
    this.scene.sentry.hp = 0;
    this.scene.sentry.isWrangled = false;
    this.scene.sentry.aimedDoor = 'NONE';
    
    // Track destruction for save system (only during story nights 1-5)
    if (!this.scene.isCustomNightMode && this.scene.nightNumber <= 5) {
      this.scene.sessionDestructions++;
      console.log(`🔧 Sentry destroyed! Session destructions: ${this.scene.sessionDestructions}`);
    }
    
    this.scene.sentryGraphic.setVisible(false);
    this.scene.aimBeam.setVisible(false);
    
    // Hide any enemies shown in doorways (fixes Scout glitch)
    this.scene.scoutInDoorway.setVisible(false);
    this.scene.soldierInDoorway.setVisible(false);
    this.scene.hideHeavyDoorwayShadow();
    
    // Stop detection sound
    this.scene.audio.stopDetectionSound();
    
    // Resume dispenser hum if in Intel room (was paused for aiming)
    if (!this.scene.isTeleported && !this.scene.isPaused) {
      this.scene.audio.startDispenserHum();
    }
    
    // Reset door colors
    this.scene.leftDoor.setFillStyle(0x000000);
    this.scene.rightDoor.setFillStyle(0x000000);
    
    // Play sentry destroyed sound
    this.scene.audio.playSound('sentryDestroyed');
    
    this.scene.showAlert('SENTRY DESTROYED!', 0xff0000);
    
    // Clear any active sapper (sentry is gone, so sapper is too)
    if (this.scene.isSpyEnabled() && this.scene.spy.isSapping()) {
      this.scene.spy.removeSapper();
      this.scene.sapperIndicator.setVisible(false);
      this.scene.audio.stopSapperSound();
      console.log('🕵️ Sapper destroyed with sentry');
    }
    
    // If Soldier was sieging, he starts breach countdown
    if (this.scene.isSoldierEnabled() && this.scene.soldier.isSieging()) {
      this.scene.soldier.sentryDestroyed();
      this.scene.showAlert('⚠ SOLDIER BREACHING IN 3 SECONDS! ⚠', 0xff0000);
      
      // Flash the screen red as warning
      this.scene.cameras.main.flash(500, 255, 0, 0, false);
    }
  }

  updateSentryVisuals(): void {
    // Update level badge text
    const levelText = this.scene.sentryGraphic.list[3] as Phaser.GameObjects.Text;
    levelText.setText(`L${this.scene.sentry.level}`);
    
    // Scale sentry based on level
    const scale = 0.8 + (this.scene.sentry.level * 0.1);
    this.scene.sentryGraphic.setScale(scale);
  }

  /**
   * Auto-defense: Unwrangled sentry automatically defends but is destroyed
   */
  triggerAutoDefense(enemyType: string): void {
    if (!this.scene.sentry.exists) return;
    
    // Sentry fires and destroys itself
    this.scene.showAlert(`SENTRY AUTO-DEFENSE vs ${enemyType}!`, 0xffff00);
    
    // Drive away the enemy
    if (enemyType === 'SCOUT') {
      this.scene.scout.driveAway();
    } else if (enemyType === 'DEMOMAN') {
      this.scene.demoman.deter();
      // Allow Pyro to teleport to hallways again
      if (this.scene.isPyroEnabled() && this.scene.pyro) {
        this.scene.pyro.onDemomanChargeEnd();
      }
    } else {
      this.scene.soldier.driveAway();
    }
    
    // Destroy sentry
    this.destroySentry();
  }

  /**
   * Handle when player escapes an Übered enemy by teleporting away
   * The enemy retreats, sentry is destroyed, and Medic picks a new target next hour
   */
  handleUberedEnemyEscaped(enemyType: UberTarget): void {
    // Drive away the enemy (they can't wait in Intel like normal - Über ran out)
    if (enemyType === 'SCOUT') {
      this.scene.scout.driveAway();
    } else if (enemyType === 'SOLDIER') {
      this.scene.soldier.driveAway();
    } else if (enemyType === 'DEMOMAN') {
      this.scene.demoman.deter();
      // Allow Pyro to teleport to hallways again
      if (this.scene.isPyroEnabled() && this.scene.pyro) {
        this.scene.pyro.onDemomanChargeEnd();
      }
    }
    
    // Destroy sentry if it exists
    if (this.scene.sentry.exists) {
      this.scene.showAlert('SENTRY DESTROYED BY ÜBER!', 0xff4444);
      this.destroySentry();
    }
    
    // Notify Medic that the attack resolved - will pick new target next hour
    if (this.scene.medic) {
      this.scene.medic.onTargetAttackResolved();
    }
    
    // Reset Medic ghost cooldown to prevent immediate spawn after Über ends
    // Ghost should wait at least 30 seconds after an Über attack resolves
    this.scene.medicGhostCooldown = Math.max(this.scene.medicGhostCooldown, 30000);
    
    console.log(`💉 ${enemyType} Über attack resolved - player escaped!`);
  }

}
