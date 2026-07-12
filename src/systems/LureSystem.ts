import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../types';
import type { GameScene } from '../scenes/GameScene';

/**
 * Lure mechanics (Night 3+): placing/picking up lures in rooms, playing them
 * from the camera view, and the lure button states. Extracted from GameScene;
 * game state stays on the scene, accessed via public members.
 */
export class LureSystem {
  constructor(private scene: GameScene) {}

  /**
   * Handle camera lure button action (play lure)
   */
  handleCameraLureAction(): void {
    if (!this.scene.activeLure || !this.scene.activeLure.placed || this.scene.activeLure.playing) return;
    
    // Play the lure
    this.scene.activeLure.playing = true;
    this.scene.activeLure.playTimeRemaining = GAME_CONSTANTS.LURE_DURATION;
    this.scene.showAlert('Lure activated!', 'info');
    this.scene.audio.playLureSound();
    console.log('Lure activated from camera view at', this.scene.activeLure.node);
    
    this.updateCameraLureButton();
  }

  /**
   * Update camera lure button style based on lure state
   */
  updateCameraLureButtonStyle(): void {
    if (!this.scene.cameraLureButton || !this.scene.activeLure) return;
    
    const btnBg = this.scene.cameraLureButton.list[0] as Phaser.GameObjects.Rectangle;
    const btnText = this.scene.cameraLureButton.list[1] as Phaser.GameObjects.Text;
    
    // Always show play option (button is hidden when lure is playing)
    btnBg.setFillStyle(0x140e06);
    btnBg.setStrokeStyle(2, 0x8a6230);
    btnText.setText('PLAY LURE');
    btnText.setColor('#ffb454');
  }

  /**
   * Update camera lure button visibility
   */
  updateCameraLureButton(): void {
    if (!this.scene.cameraLureButton || !this.scene.isCameraMode) return;
    
    // Show button only if there's a lure placed but NOT playing yet
    const hasUnplayedLure = this.scene.activeLure && this.scene.activeLure.placed && !this.scene.activeLure.playing;
    
    this.scene.cameraLureButton.setVisible(!!hasUnplayedLure && this.scene.nightNumber >= 3);
    
    if (hasUnplayedLure) {
      this.updateCameraLureButtonStyle();
    }
  }

  /**
   * Handle lure button - place lure or play existing lure
   */
  toggleLure(): void {
    console.log(`toggleLure called. isTeleported=${this.scene.isTeleported}, currentRoom=${this.scene.currentRoom}`);
    
    // If lure exists and we're at the lure location, play it
    if (this.scene.activeLure && this.scene.activeLure.node === this.scene.currentRoom && this.scene.activeLure.placed) {
      if (!this.scene.activeLure.playing) {
        // Play the lure (activate Medic voice)
        this.scene.activeLure.playing = true;
        this.scene.activeLure.playTimeRemaining = GAME_CONSTANTS.LURE_DURATION;
        this.scene.showAlert('Lure activated!', 'info');
        this.scene.audio.playLureSound();
        console.log('Lure activated at', this.scene.currentRoom);
      } else {
        this.scene.showAlert('Lure already playing!', 'warning');
      }
      this.updateLureButtonText();
      return;
    }
    
    // If lure exists elsewhere, can't do anything here
    if (this.scene.activeLure && this.scene.activeLure.placed) {
      this.scene.showAlert(`Lure already at ${this.scene.activeLure.node.replace('_', ' ')}!`, 'warning');
      return;
    }
    
    if (!this.scene.isTeleported) {
      this.scene.showAlert('Must be teleported to place lure!', 'warning');
      return;
    }
    
    if (this.scene.currentRoom === 'INTEL') {
      this.scene.showAlert('Cannot place lure in Intel room!', 'warning');
      return;
    }
    
    // Place new lure
    if (this.scene.metal < GAME_CONSTANTS.LURE_COST) {
      this.scene.showAlert('Not enough metal! (50 required)', 'warning');
      return;
    }
    
    this.scene.metal -= GAME_CONSTANTS.LURE_COST;
    this.scene.activeLure = { 
      node: this.scene.currentRoom, 
      placed: true, 
      playing: false, 
      playTimeRemaining: 0 
    };
    console.log(`Lure placed at ${this.scene.currentRoom}`);
    this.scene.audio.playLurePlacedSound();
    this.scene.showAlert(`Lure placed! Play from cameras.`, 'info');
    this.scene.updateHUD();
    this.updateLureButtonText();
  }

  /**
   * Update lure button text based on state
   */
  updateLureButtonText(): void {
    if (!this.scene.lureButton) return;
    
    const btnText = this.scene.lureButton.list[1] as Phaser.GameObjects.Text;
    const btnBg = this.scene.lureButton.list[0] as Phaser.GameObjects.Rectangle;
    
    if (this.scene.activeLure && this.scene.activeLure.placed) {
      if (this.scene.activeLure.node === this.scene.currentRoom) {
        // At the lure location
        if (this.scene.activeLure.playing) {
          btnText.setText('🔊 LURE PLAYING...');
          btnBg.setFillStyle(0x2a1f10);
          btnBg.setStrokeStyle(2, 0xffb454);
          btnText.setColor('#ffb454');
        } else {
          btnText.setText('PLAY LURE');
          btnBg.setFillStyle(0x1c1409);
          btnBg.setStrokeStyle(2, 0xf0e6d2);
          btnText.setColor('#f0e6d2');
        }
      } else {
        // Lure is placed elsewhere - show info (can't place another)
        const lureRoom = this.scene.activeLure.node.replace('_', ' ');
        btnText.setText(`LURE AT ${lureRoom}`);
        btnBg.setFillStyle(0x140e06);
        btnBg.setStrokeStyle(2, 0x3d2c14);
        btnText.setColor('#8a6230');
      }
    } else {
      // No lure placed - check if enough metal
      const canAfford = this.scene.metal >= GAME_CONSTANTS.LURE_COST;
      btnText.setText('PLACE LURE (50 metal)');
      if (canAfford) {
        btnBg.setFillStyle(0x1c1409);
        btnBg.setStrokeStyle(2, 0x8a6230);
        btnText.setColor('#ffb454');
      } else {
        // Greyed out - not enough metal
        btnBg.setFillStyle(0x100b05);
        btnBg.setStrokeStyle(2, 0x3d2c14);
        btnText.setColor('#3d2c14');
      }
    }
  }

}
