import Phaser from 'phaser';
import { isMobileDevice } from '../utils/mobile';
import { 
  SaveData, 
  loadSave, 
  createNewSave, 
  deleteSave, 
  hasSave, 
  unlockEverything 
} from '../utils/saveData';
import { loadCustomNightEnemies } from '../data/customNightStorage';
import {
  playGameStartChime,
  playMenuButtonSound,
  playMenuToggleOffSound,
  playMenuToggleOnSound,
} from '../utils/menuSounds';
import { drawCharacterSilhouette } from '../drawing/characterSilhouettes';
import { pickRandomSpyDisguise } from '../drawing/spyGalleryDisguise';

/**
 * BootScene - Main Menu / Title Screen
 * 
 * Displays the game title, night selection, and allows player to start the game.
 * 
 * Menu States:
 * 1. No save: "NEW GAME" only
 * 2. Save exists, incomplete: "NEW GAME" + "CONTINUE"  
 * 3. Game completed: Night selection (1-5, 6) + Custom Night
 */
export class BootScene extends Phaser.Scene {
  private selectedNight: number = 1;
  private tutorialContainer!: Phaser.GameObjects.Container;
  private extrasContainer!: Phaser.GameObjects.Container;
  private endingsContainer!: Phaser.GameObjects.Container;  // Endings preview (dev mode)
  private isMobile: boolean = false;
  private saveData: SaveData | null = null;
  
  // Developer password tracking
  private devPasswordBuffer: string = '';
  private readonly DEV_PASSWORD = '2FORT';
  private devInputEl: HTMLInputElement | null = null;
  
  constructor() {
    super({ key: 'BootScene' });
  }
  
  preload(): void {
    // Show loading text briefly
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const loadingText = this.add.text(width / 2, height / 2, 'LOADING...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '32px',
      color: '#ff6600',
    });
    loadingText.setOrigin(0.5);
  }
  
  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // Detect mobile device
    this.isMobile = isMobileDevice();
    
    // Load save data
    this.saveData = loadSave();
    const hasBeatenNight5 = this.saveData?.hasBeatenNight5 || false;
    const hasExistingSave = hasSave();
    
    // Reset selected night based on save state
    this.selectedNight = this.saveData?.currentNight || 1;
    
    // Reset dev password buffer
    this.devPasswordBuffer = '';
    
    // Clear loading text
    this.children.removeAll();
    
    // ===== BACKGROUND =====
    // Dark gradient background
    const bgGradient = this.add.graphics();
    bgGradient.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x141428, 0x141428, 1);
    bgGradient.fillRect(0, 0, width, height);
    
    // Subtle grid pattern
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x < width; x += 40) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 40) {
      grid.lineBetween(0, y, width, y);
    }
    
    // Corner accents
    const corners = this.add.graphics();
    corners.lineStyle(2, 0xff6600, 0.6);
    // Top left
    corners.lineBetween(30, 30, 30, 80);
    corners.lineBetween(30, 30, 80, 30);
    // Top right
    corners.lineBetween(width - 30, 30, width - 30, 80);
    corners.lineBetween(width - 30, 30, width - 80, 30);
    // Bottom left
    corners.lineBetween(30, height - 30, 30, height - 80);
    corners.lineBetween(30, height - 30, 80, height - 30);
    // Bottom right
    corners.lineBetween(width - 30, height - 30, width - 30, height - 80);
    corners.lineBetween(width - 30, height - 30, width - 80, height - 30);
    
    // ===== TITLE (top) =====
    // Title glow
    this.add.text(width / 2, 100, 'FIVE NIGHTS AT 2FORT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#ff4400',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.2).setScale(1.02);
    
    this.add.text(width / 2, 100, 'FIVE NIGHTS AT 2FORT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Subtitle
    this.add.text(width / 2, 155, 'A TF2-Inspired FNAF Experience', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#555566',
    }).setOrigin(0.5);
    
    // ===== CONTROLS LEGEND (left side with background) =====
    // Only show keyboard controls on desktop
    if (!this.isMobile) {
      const controlsX = 115;
      const controlsY = 350;
      
      // Background panel for controls
      const controlsBg = this.add.rectangle(controlsX, controlsY, 150, 170, 0x0a0f15, 0.9);
      controlsBg.setStrokeStyle(1, 0x2a3545);
      
      this.add.text(controlsX, controlsY - 65, 'CONTROLS', {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#5588aa',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      const controlsList = [
        ['F', 'Wrangler'],
        ['A/D', 'Aim'],
        ['SPACE', 'Fire'],
        ['TAB', 'Cameras'],
        ['R', 'Build'],
      ];
      
      controlsList.forEach((ctrl, i) => {
        const cy = controlsY - 35 + i * 26;
        // Key
        const keyBg = this.add.rectangle(controlsX - 35, cy, 40, 20, 0x152535);
        keyBg.setStrokeStyle(1, 0x3a4a5a);
        this.add.text(controlsX - 35, cy, ctrl[0], {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#7799bb',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        // Action
        this.add.text(controlsX + 5, cy, ctrl[1], {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#556677',
        }).setOrigin(0, 0.5);
      });
    } else {
      // Mobile touch controls hint
      const controlsX = 115;
      const controlsY = 350;
      
      // Background panel
      const controlsBg = this.add.rectangle(controlsX, controlsY, 150, 140, 0x0a0f15, 0.9);
      controlsBg.setStrokeStyle(1, 0x2a3545);
      
      this.add.text(controlsX, controlsY - 50, 'TOUCH CONTROLS', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#5588aa',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      const touchHints = [
        'Hold edges to aim',
        'Tap sentry to fire',
        'CAM button: cameras',
        'Action button: build',
      ];
      
      touchHints.forEach((hint, i) => {
        this.add.text(controlsX, controlsY - 20 + i * 22, hint, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          color: '#556677',
        }).setOrigin(0.5);
      });
    }
    
    // ===== MENU BUTTONS (center area) =====
    // Different menu layouts based on game state
    
    let started = false;
    
    // Start game function - reused by multiple buttons
    const startGame = (night: number, isCustomNight: boolean = false, isBadEndingNight6: boolean = false, isNightmareMode: boolean = false) => {
      if (started) return;
      started = true;
      
      playGameStartChime();
      
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(600, () => {
        if (isCustomNight) {
          const customNightEnemies = loadCustomNightEnemies();
          this.scene.start('GameScene', { 
            night: 7, // Use 7 for custom night to distinguish from story Night 6
            customEnemies: { ...customNightEnemies },
            isCustomNight: true
          });
        } else if (isNightmareMode) {
          // Nightmare Mode - all enemies, starts at 10 AM difficulty, endless
          this.scene.start('GameScene', {
            night: 8,
            isNightmareMode: true,
            customEnemies: {
              scout: true,
              soldier: true,
              demoman: true,
              heavy: true,
              sniper: true,
              spy: true,
              pyro: true,
              medic: true,
              administrator: true,
              pauling: true,
            }
          });
        } else if (isBadEndingNight6) {
          // Bad ending Night 6 - all enemies + medic forced on
          this.scene.start('GameScene', { 
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
              medic: true,
              administrator: false,
              pauling: false,
            }
          });
        } else {
          this.scene.start('GameScene', { night });
        }
      });
    };
    
    if (hasBeatenNight5) {
      // ===== POST-GAME: NIGHT SELECTION + CUSTOM NIGHT =====
      this.createPostGameMenu(width, height, startGame, this.saveData);
    } else {
      // ===== PRE-GAME: NEW GAME / CONTINUE =====
      this.createPreGameMenu(width, height, hasExistingSave, startGame);
    }
    
    // ===== DEVELOPER PASSWORD (hidden text input + keyboard fallback) =====
    this.setupDevPasswordInput();
    this.setupDevPasswordListener();
    
    // ===== SIDE MENU BUTTONS (right side - with button backgrounds) =====
    const menuX = width - 115;
    
    // How to Play button
    const tutorialBtnBg = this.add.rectangle(menuX, 330, 130, 32, 0x0a1520);
    tutorialBtnBg.setStrokeStyle(1, 0x334455);
    tutorialBtnBg.setInteractive({ useHandCursor: true });
    const tutorialBtnText = this.add.text(menuX, 330, '? HOW TO PLAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#5588aa',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    tutorialBtnBg.on('pointerover', () => {
      tutorialBtnBg.setFillStyle(0x152535);
      tutorialBtnBg.setStrokeStyle(1, 0x5588aa);
      tutorialBtnText.setColor('#88bbdd');
    });
    tutorialBtnBg.on('pointerout', () => {
      tutorialBtnBg.setFillStyle(0x0a1520);
      tutorialBtnBg.setStrokeStyle(1, 0x334455);
      tutorialBtnText.setColor('#5588aa');
    });
    tutorialBtnBg.on('pointerdown', () => {
      playMenuButtonSound();
      this.showTutorial();
    });
    
    // Gallery button
    const extrasBtnBg = this.add.rectangle(menuX, 375, 130, 32, 0x1a1510);
    extrasBtnBg.setStrokeStyle(1, 0x554433);
    extrasBtnBg.setInteractive({ useHandCursor: true });
    const extrasBtnText = this.add.text(menuX, 375, '★ GALLERY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#aa8855',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    extrasBtnBg.on('pointerover', () => {
      extrasBtnBg.setFillStyle(0x2a2520);
      extrasBtnBg.setStrokeStyle(1, 0xaa8855);
      extrasBtnText.setColor('#ddaa77');
    });
    extrasBtnBg.on('pointerout', () => {
      extrasBtnBg.setFillStyle(0x1a1510);
      extrasBtnBg.setStrokeStyle(1, 0x554433);
      extrasBtnText.setColor('#aa8855');
    });
    extrasBtnBg.on('pointerdown', () => {
      playMenuButtonSound();
      this.showExtras();
    });
    
    // Endings preview button (for testing/dev mode - shows after beating Night 5)
    const save = loadSave();
    if (save?.hasBeatenNight5) {
      const endingsBtnBg = this.add.rectangle(menuX, 410, 130, 32, 0x151520);
      endingsBtnBg.setStrokeStyle(1, 0x445566);
      endingsBtnBg.setInteractive({ useHandCursor: true });
      const endingsBtnText = this.add.text(menuX, 410, '☆ ENDINGS', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#8899bb',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      endingsBtnBg.on('pointerover', () => {
        endingsBtnBg.setFillStyle(0x252535);
        endingsBtnBg.setStrokeStyle(1, 0x8899bb);
        endingsBtnText.setColor('#aabbdd');
      });
      endingsBtnBg.on('pointerout', () => {
        endingsBtnBg.setFillStyle(0x151520);
        endingsBtnBg.setStrokeStyle(1, 0x445566);
        endingsBtnText.setColor('#8899bb');
      });
      endingsBtnBg.on('pointerdown', () => {
        playMenuButtonSound();
        this.showEndingsMenu();
      });
    }
    
    // Audio logs toggle (default ON) - persist in localStorage
    const audioLogsY = save?.hasBeatenNight5 ? 445 : 420;
    const audioLogsStorage = localStorage.getItem('audioLogsEnabled');
    let audioLogsOn = audioLogsStorage === null || audioLogsStorage === 'true';
    
    const audioLogsBg = this.add.rectangle(menuX, audioLogsY, 130, 32, 0x0f1510);
    audioLogsBg.setStrokeStyle(1, 0x334444);
    audioLogsBg.setInteractive({ useHandCursor: true });
    const audioLogsLabel = this.add.text(menuX - 28, audioLogsY, 'AUDIO LOGS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#668877',
    }).setOrigin(0.5);
    const audioLogsValue = this.add.text(menuX + 42, audioLogsY, audioLogsOn ? 'ON' : 'OFF', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: audioLogsOn ? '#55aa55' : '#886644',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    const updateAudioLogsToggle = () => {
      audioLogsValue.setText(audioLogsOn ? 'ON' : 'OFF');
      audioLogsValue.setColor(audioLogsOn ? '#55aa55' : '#886644');
      localStorage.setItem('audioLogsEnabled', audioLogsOn ? 'true' : 'false');
    };
    
    audioLogsBg.on('pointerover', () => {
      audioLogsBg.setFillStyle(0x152520);
      audioLogsBg.setStrokeStyle(1, 0x558877);
    });
    audioLogsBg.on('pointerout', () => {
      audioLogsBg.setFillStyle(0x0f1510);
      audioLogsBg.setStrokeStyle(1, 0x334444);
    });
    audioLogsBg.on('pointerdown', () => {
      audioLogsOn = !audioLogsOn;
      if (audioLogsOn) playMenuToggleOnSound();
      else playMenuToggleOffSound();
      updateAudioLogsToggle();
    });
    
    // Create tutorial overlay
    this.createTutorialOverlay();
    
    // Create extras overlay
    this.createExtrasOverlay();
    
    // Create endings preview overlay
    this.createEndingsOverlay();
    
    // Version
    this.add.text(width - 60, height - 30, 'v1.1', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#333344',
    }).setOrigin(0.5);
  }
  
  /**
   * Create pre-game menu (New Game / Continue)
   */
  private createPreGameMenu(
    width: number, 
    height: number, 
    hasExistingSave: boolean,
    startGame: (night: number, isCustomNight?: boolean, isBadEndingNight6?: boolean, isNightmareMode?: boolean) => void
  ): void {
    const centerY = 300;
    const btnWidth = 280;
    const btnHeight = 50;
    
    // NEW GAME button
    const newGameY = hasExistingSave ? centerY - 35 : centerY;
    const newGameGlow = this.add.rectangle(width / 2, newGameY, btnWidth + 8, btnHeight + 8, 0x44ff44, 0.08);
    const newGameBg = this.add.rectangle(width / 2, newGameY, btnWidth, btnHeight, 0x0f1f0f);
    newGameBg.setStrokeStyle(3, 0x44aa44);
    newGameBg.setInteractive({ useHandCursor: true });
    
    const newGameText = this.add.text(width / 2, newGameY, '▶ NEW GAME', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#55dd55',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Pulse effect
    this.tweens.add({
      targets: [newGameGlow],
      alpha: 0.3,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    newGameBg.on('pointerover', () => {
      newGameBg.setFillStyle(0x225522);
      newGameBg.setStrokeStyle(3, 0x66ff66);
      newGameText.setColor('#88ff88');
    });
    
    newGameBg.on('pointerout', () => {
      newGameBg.setFillStyle(0x0f1f0f);
      newGameBg.setStrokeStyle(3, 0x44aa44);
      newGameText.setColor('#55dd55');
    });
    
    newGameBg.on('pointerdown', () => {
      playMenuButtonSound();
      // Delete existing save and create new one
      deleteSave();
      createNewSave();
      this.selectedNight = 1;
      newGameText.setText('LOADING...');
      startGame(1);
    });
    
    // CONTINUE button (only if save exists)
    if (hasExistingSave && this.saveData) {
      const continueY = centerY + 35;
      const continueNight = this.saveData.currentNight;
      
      const continueBg = this.add.rectangle(width / 2, continueY, btnWidth, btnHeight, 0x0f1520);
      continueBg.setStrokeStyle(2, 0x446688);
      continueBg.setInteractive({ useHandCursor: true });
      
      const continueText = this.add.text(width / 2, continueY, `▶ CONTINUE - NIGHT ${continueNight}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#6699bb',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      continueBg.on('pointerover', () => {
        continueBg.setFillStyle(0x152535);
        continueBg.setStrokeStyle(2, 0x6699bb);
        continueText.setColor('#88bbdd');
      });
      
      continueBg.on('pointerout', () => {
        continueBg.setFillStyle(0x0f1520);
        continueBg.setStrokeStyle(2, 0x446688);
        continueText.setColor('#6699bb');
      });
      
      continueBg.on('pointerdown', () => {
        playMenuButtonSound();
        continueText.setText('LOADING...');
        // Night 6 is always bad ending mode
        const isBadEnding = continueNight === 6;
        startGame(continueNight, false, isBadEnding);
      });
    }
    
    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-SPACE', () => {
      playMenuButtonSound();
      if (hasExistingSave && this.saveData) {
        // Continue with current save - Night 6 is always bad ending mode
        const isBadEnding = this.saveData.currentNight === 6;
        startGame(this.saveData.currentNight, false, isBadEnding);
      } else {
        // New game
        deleteSave();
        createNewSave();
        startGame(1);
      }
    });
  }
  
  /**
   * Create post-game menu (night selection + custom night)
   */
  private createPostGameMenu(
    width: number, 
    height: number, 
    startGame: (night: number, isCustomNight?: boolean, isBadEndingNight6?: boolean, isNightmareMode?: boolean) => void,
    save: SaveData | null
  ): void {
    // Calculate total destructions to determine if good ending is available
    const nightDestructions = save?.nightDestructions || {};
    const totalDestructions = Object.values(nightDestructions).reduce((sum: number, count: number) => sum + count, 0);
    const goodEndingAchieved = save?.goodEndingAchieved || false;
    
    // Can redeem for good ending = beat Night 5, haven't gotten good ending yet, destructions now low enough
    const canRedeemForGoodEnding = save?.hasBeatenNight5 && !goodEndingAchieved && totalDestructions < 5;
    
    // Night selection header
    const nightSelY = 560;
    
    // Show destruction status hint
    let statusColor: string;
    let statusText: string;
    const badEndingAchieved = save?.badEndingAchieved || false;
    
    if (goodEndingAchieved) {
      // Already got good ending - just show stats
      statusColor = '#44ff44';
      statusText = `Total destructions: ${totalDestructions} - Good ending achieved!`;
    } else if (canRedeemForGoodEnding) {
      // Can redeem from bad ending path
      statusColor = '#ffcc00';
      statusText = `Total destructions: ${totalDestructions}/5 - Good ending available!`;
    } else {
      // Too many destructions - show bad ending status if achieved
      statusColor = '#ff6644';
      if (badEndingAchieved) {
        statusText = `Total destructions: ${totalDestructions}/5 - Bad ending achieved. Replay to reduce`;
      } else {
        statusText = `Total destructions: ${totalDestructions}/5 - Replay nights to reduce`;
      }
    }
    
    this.add.text(width / 2, nightSelY - 80, statusText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: statusColor,
    }).setOrigin(0.5);
    
    this.add.text(width / 2, nightSelY - 60, 'SELECT NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#446644',
    }).setOrigin(0.5);
    
    // Night buttons - compact row (1-5 + 6)
    const nightButtons: Phaser.GameObjects.Container[] = [];
    const nights = [1, 2, 3, 4, 5, 6];
    const nightBtnWidth = 55;
    const nightBtnGap = 10;
    const totalNightWidth = nights.length * nightBtnWidth + (nights.length - 1) * nightBtnGap;
    const buttonStartX = (width - totalNightWidth) / 2 + nightBtnWidth / 2;
    const buttonY = nightSelY;
    
    // Reference to start text (assigned later, used in button handlers)
    const startTextRef: { text: Phaser.GameObjects.Text | null } = { text: null };
    
    nights.forEach((night, index) => {
      const x = buttonStartX + index * (nightBtnWidth + nightBtnGap);
      const isNight6 = night === 6;
      
      // Night 6 is available to anyone who has beaten Night 5
      if (isNight6 && !save?.hasBeatenNight5) {
        return; // Skip Night 6 button if not unlocked
      }
      
      // Determine color based on destruction count for this night
      let glowColor = 0x44ff44;  // Default green
      let bgColor = 0x0f1a0f;
      let strokeColor = 0x336633;
      let textColor = '#44aa44';
      let hoverBgColor = 0x1a331a;
      let hoverStrokeColor = 0x55aa55;
      let hoverTextColor = '#66ff66';
      let selectedBgColor = 0x1a2a1a;
      let selectedStrokeColor = 0x44ff44;
      
      if (night <= 5) {
        const destructions = nightDestructions[night] ?? 0;
        
        if (night === 5 && canRedeemForGoodEnding) {
          // Night 5 glows GOLD when player can redeem from bad ending path!
          glowColor = 0xffcc00;
          bgColor = 0x1a1a0a;
          strokeColor = 0x998833;
          textColor = '#ddaa22';
          hoverBgColor = 0x2a2a1a;
          hoverStrokeColor = 0xddcc44;
          hoverTextColor = '#ffdd44';
          selectedBgColor = 0x2a2a1a;
          selectedStrokeColor = 0xffcc00;
        } else if (destructions > 0) {
          // Red for nights with destructions
          glowColor = 0xff4444;
          bgColor = 0x1a0f0f;
          strokeColor = 0x663333;
          textColor = '#aa4444';
          hoverBgColor = 0x331a1a;
          hoverStrokeColor = 0xaa5555;
          hoverTextColor = '#ff6666';
          selectedBgColor = 0x2a1a1a;
          selectedStrokeColor = 0xff4444;
        }
        // else: green (default) for 0 destructions
      }
      
      const btnGlow = this.add.rectangle(x, buttonY, nightBtnWidth + 4, 44, glowColor, 0);
      const btnBg = this.add.rectangle(x, buttonY, nightBtnWidth, 40, bgColor);
      btnBg.setStrokeStyle(2, strokeColor);
      
      const nightNum = this.add.text(x, buttonY, `${night}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: textColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      const container = this.add.container(0, 0, [btnGlow, btnBg, nightNum]);
      nightButtons.push(container);
      
      btnBg.setInteractive({ useHandCursor: true });
      
      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(hoverBgColor);
        btnBg.setStrokeStyle(2, hoverStrokeColor);
        nightNum.setColor(hoverTextColor);
      });
      
      btnBg.on('pointerout', () => {
        if (this.selectedNight === night) {
          btnBg.setFillStyle(selectedBgColor);
          btnBg.setStrokeStyle(3, selectedStrokeColor);
          btnGlow.setFillStyle(glowColor, 0.08);
          nightNum.setColor(hoverTextColor);
        } else {
          btnBg.setFillStyle(bgColor);
          btnBg.setStrokeStyle(2, strokeColor);
          btnGlow.setFillStyle(glowColor, 0);
          nightNum.setColor(textColor);
        }
      });
      
      btnBg.on('pointerdown', () => {
        playMenuButtonSound();
        this.selectedNight = night;
        
        // Update start button text (if it exists)
        if (startTextRef.text) {
          startTextRef.text.setText(`▶ START NIGHT ${night}`);
        }
        
        // Update all buttons - reset each to their base colors, then highlight selected
        nightButtons.forEach((btn, i) => {
          const glow = btn.list[0] as Phaser.GameObjects.Rectangle;
          const bg = btn.list[1] as Phaser.GameObjects.Rectangle;
          const num = btn.list[2] as Phaser.GameObjects.Text;
          const btnNight = nights[i];
          
          // Recalculate colors for this button
          const btnDestructions = nightDestructions[btnNight] ?? 0;
          let btnGlowColor = 0x44ff44;
          let btnBgColor = 0x0f1a0f;
          let btnStrokeColor = 0x336633;
          let btnTextColor = '#44aa44';
          let btnSelectedBgColor = 0x1a2a1a;
          let btnSelectedStrokeColor = 0x44ff44;
          let btnHoverTextColor = '#66ff66';
          
          if (btnNight <= 5) {
            if (btnNight === 5 && canRedeemForGoodEnding) {
              btnGlowColor = 0xffcc00;
              btnBgColor = 0x1a1a0a;
              btnStrokeColor = 0x998833;
              btnTextColor = '#ddaa22';
              btnSelectedBgColor = 0x2a2a1a;
              btnSelectedStrokeColor = 0xffcc00;
              btnHoverTextColor = '#ffdd44';
            } else if (btnDestructions > 0) {
              btnGlowColor = 0xff4444;
              btnBgColor = 0x1a0f0f;
              btnStrokeColor = 0x663333;
              btnTextColor = '#aa4444';
              btnSelectedBgColor = 0x2a1a1a;
              btnSelectedStrokeColor = 0xff4444;
              btnHoverTextColor = '#ff6666';
            }
          }
          
          if (i === index) {
            bg.setFillStyle(btnSelectedBgColor);
            bg.setStrokeStyle(3, btnSelectedStrokeColor);
            glow.setFillStyle(btnGlowColor, 0.08);
            num.setColor(btnHoverTextColor);
          } else {
            bg.setFillStyle(btnBgColor);
            bg.setStrokeStyle(2, btnStrokeColor);
            glow.setFillStyle(btnGlowColor, 0);
            num.setColor(btnTextColor);
          }
        });
      });
      
      // Select current night by default
      if (night === this.selectedNight) {
        btnBg.setFillStyle(selectedBgColor);
        btnBg.setStrokeStyle(3, selectedStrokeColor);
        btnGlow.setFillStyle(glowColor, 0.08);
        nightNum.setColor(hoverTextColor);
      }
      
      // Add pulsing glow for Night 5 when player can redeem from bad ending
      if (night === 5 && canRedeemForGoodEnding) {
        btnGlow.setFillStyle(0xffcc00, 0.15);
        this.tweens.add({
          targets: btnGlow,
          alpha: 0.6,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
    
    // Start selected night button
    const startBtnY = 290;
    const startBtnGlow = this.add.rectangle(width / 2, startBtnY, 320, 60, 0x44ff44, 0.08);
    const startBtnBg = this.add.rectangle(width / 2, startBtnY, 300, 50, 0x0f1f0f);
    startBtnBg.setStrokeStyle(3, 0x44aa44);
    startBtnBg.setInteractive({ useHandCursor: true });
    
    const startText = this.add.text(width / 2, startBtnY, `▶ START NIGHT ${this.selectedNight}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#55dd55',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Assign to reference so button handlers can update it
    startTextRef.text = startText;
    
    this.tweens.add({
      targets: [startBtnGlow],
      alpha: 0.3,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    startBtnBg.on('pointerover', () => {
      startBtnBg.setFillStyle(0x225522);
      startBtnBg.setStrokeStyle(3, 0x66ff66);
      startText.setColor('#88ff88');
    });
    
    startBtnBg.on('pointerout', () => {
      startBtnBg.setFillStyle(0x0f1f0f);
      startBtnBg.setStrokeStyle(3, 0x44aa44);
      startText.setColor('#55dd55');
    });
    
    startBtnBg.on('pointerdown', () => {
      playMenuButtonSound();
      startText.setText('LOADING...');
      // Night 6 in post-game is always bad ending style (all enemies)
      const isBadEnding = this.selectedNight === 6;
      startGame(this.selectedNight, false, isBadEnding);
    });
    
    // ===== CUSTOM NIGHT BUTTON (below start button) =====
    // Custom Night is available after beating Night 5
    const customNightUnlocked = save?.hasBeatenNight5 || false;
    const customBtnY = 360;
    const customBtnBg = this.add.rectangle(width / 2, customBtnY, 220, 40, 0x151520);
    customBtnBg.setStrokeStyle(2, 0x554488);
    
    const customBtnText = this.add.text(width / 2, customBtnY, '★ CUSTOM NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#8866aa',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Only enable interaction if unlocked
    if (customNightUnlocked) {
      customBtnBg.setInteractive({ useHandCursor: true });
      
      customBtnBg.on('pointerover', () => {
        customBtnBg.setFillStyle(0x252535);
        customBtnBg.setStrokeStyle(2, 0x8866cc);
        customBtnText.setColor('#aa88dd');
      });
      
      customBtnBg.on('pointerout', () => {
        customBtnBg.setFillStyle(0x151520);
        customBtnBg.setStrokeStyle(2, 0x554488);
        customBtnText.setColor('#8866aa');
      });
      
      customBtnBg.on('pointerdown', () => {
        playMenuButtonSound();
        this.scene.start('CustomNightScene');
      });
    } else {
      // Locked appearance
      customBtnBg.setFillStyle(0x0a0a10);
      customBtnBg.setStrokeStyle(1, 0x333344);
      customBtnText.setColor('#444455');
      customBtnText.setText('🔒 CUSTOM NIGHT');
    }
    
    // ===== NIGHTMARE MODE BUTTON (below custom night button) =====
    // Nightmare Mode is available after beating Night 5 (same unlock as Custom Night)
    const nightmareBtnY = customBtnY + 50;
    const nightmareBtnBg = this.add.rectangle(width / 2, nightmareBtnY, 220, 40, 0x150505);
    nightmareBtnBg.setStrokeStyle(2, 0x882222);
    
    const nightmareBtnText = this.add.text(width / 2, nightmareBtnY, '☠ NIGHTMARE MODE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#cc4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    if (customNightUnlocked) {
      nightmareBtnBg.setInteractive({ useHandCursor: true });
      
      nightmareBtnBg.on('pointerover', () => {
        nightmareBtnBg.setFillStyle(0x251010);
        nightmareBtnBg.setStrokeStyle(2, 0xcc4444);
        nightmareBtnText.setColor('#ff6666');
      });
      
      nightmareBtnBg.on('pointerout', () => {
        nightmareBtnBg.setFillStyle(0x150505);
        nightmareBtnBg.setStrokeStyle(2, 0x882222);
        nightmareBtnText.setColor('#cc4444');
      });
      
      nightmareBtnBg.on('pointerdown', () => {
        playMenuButtonSound();
        nightmareBtnText.setText('LOADING...');
        startGame(8, false, false, true);
      });
    } else {
      // Locked appearance
      nightmareBtnBg.setFillStyle(0x0a0505);
      nightmareBtnBg.setStrokeStyle(1, 0x441111);
      nightmareBtnText.setColor('#442222');
      nightmareBtnText.setText('🔒 NIGHTMARE MODE');
    }
    
    // Keyboard shortcut
    this.input.keyboard?.on('keydown-SPACE', () => {
      playMenuButtonSound();
      const isBadEnding = this.selectedNight === 6;
      startGame(this.selectedNight, false, isBadEnding);
    });
  }
  
  /**
   * Create unlabeled text input on main menu for dev code (mobile-friendly).
   * Intentionally unlabeled so it's not obvious; devs often use a small corner field.
   */
  private setupDevPasswordInput(): void {
    const id = 'boot-dev-input';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const container = document.getElementById('game-container');
    if (!container) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', ' ');
    Object.assign(input.style, {
      position: 'absolute',
      left: '8px',
      bottom: '8px',
      width: '72px',
      height: '18px',
      padding: '0 4px',
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#333344',
      background: 'rgba(10, 15, 40, 0.6)',
      border: '1px solid #222233',
      borderRadius: '2px',
      outline: 'none',
      caretColor: '#333344',
      boxSizing: 'border-box',
    });
    container.style.position = 'relative';
    container.appendChild(input);
    this.devInputEl = input;

    const check = () => {
      const value = (input.value || '').toUpperCase().trim();
      if (value === this.DEV_PASSWORD) {
        input.value = '';
        input.blur();
        this.onDevPasswordEntered();
      }
    };
    input.addEventListener('input', check);
    input.addEventListener('change', check);

    this.events.once('shutdown', () => {
      input.remove();
      this.devInputEl = null;
    });
  }

  /**
   * Setup developer password listener (keyboard fallback for desktop)
   */
  private setupDevPasswordListener(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // Only track letter keys
      if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
        this.devPasswordBuffer += event.key.toUpperCase();
        
        // Keep buffer at password length
        if (this.devPasswordBuffer.length > this.DEV_PASSWORD.length) {
          this.devPasswordBuffer = this.devPasswordBuffer.slice(-this.DEV_PASSWORD.length);
        }
        
        // Check for match
        if (this.devPasswordBuffer === this.DEV_PASSWORD) {
          this.onDevPasswordEntered();
        }
      }
    });
  }
  
  /**
   * Called when developer password is entered correctly
   */
  private onDevPasswordEntered(): void {
    // Unlock everything
    unlockEverything();
    
    // Show unlock notification
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const unlockText = this.add.text(width / 2, height / 2, 'DEVELOPER MODE UNLOCKED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#ffcc00',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { left: 20, right: 20, top: 10, bottom: 10 },
    }).setOrigin(0.5).setDepth(200);
    
    // Play unlock sound
    playGameStartChime();
    
    // Fade out and reload menu
    this.tweens.add({
      targets: unlockText,
      alpha: 0,
      duration: 1500,
      delay: 1000,
      onComplete: () => {
        unlockText.destroy();
        // Reload the scene to reflect unlocked state
        this.scene.restart();
      }
    });
  }
  
  private createTutorialOverlay(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    this.tutorialContainer = this.add.container(0, 0);
    this.tutorialContainer.setDepth(100);
    this.tutorialContainer.setVisible(false);
    
    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92);
    overlay.setInteractive();
    this.tutorialContainer.add(overlay);
    
    // Main panel - wider to fit content
    const panelWidth = 820;
    const panelHeight = 580;
    const panelX = width / 2;
    const panelY = height / 2;
    
    // Panel background
    const panelBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x08080c);
    panelBg.setStrokeStyle(2, 0x334455);
    this.tutorialContainer.add(panelBg);
    
    // Title
    const titleText = this.add.text(panelX, panelY - panelHeight/2 + 28, '— SURVIVAL GUIDE —', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tutorialContainer.add(titleText);
    
    // Divider under title
    const divider = this.add.rectangle(panelX, panelY - panelHeight/2 + 45, panelWidth - 40, 1, 0x334455);
    this.tutorialContainer.add(divider);
    
    // Layout - wider spacing
    const leftX = panelX - 180;
    const rightX = panelX + 200;
    const contentY = panelY - panelHeight/2 + 60;
    
    // ===== LEFT COLUMN =====
    let y = contentY;
    
    // BASICS
    this.addSmallHeader(leftX - 140, y, 'BASICS', 0x44ff44);
    y += 24;
    this.addLine(leftX - 140, y, 'Survive 12AM → 6AM');
    y += 18;
    this.addLine(leftX - 140, y, 'Defend Intel Room from enemies');
    y += 32;
    
    // CONTROLS
    this.addSmallHeader(leftX - 140, y, 'CONTROLS', 0x4488ff);
    y += 24;
    const controls = [
      ['F', 'Wrangler ON/OFF'],
      ['A/D', 'Aim Left/Right'],
      ['SPACE', 'Fire (50 metal)'],
      ['TAB', 'Open Cameras'],
      ['R', 'Build/Repair/Upgrade'],
    ];
    controls.forEach(([key, action]) => {
      this.addKeyAction(leftX - 140, y, key, action);
      y += 20;
    });
    y += 20;
    
    // DEFENSE
    this.addSmallHeader(leftX - 140, y, 'SENTRY DEFENSE', 0xffaa44);
    y += 24;
    this.addLine(leftX - 140, y, 'Wrangler ON → You aim & fire', '#aaaaaa');
    y += 18;
    this.addLine(leftX - 140, y, 'Wrangler OFF → Auto-kills', '#aaaaaa');
    y += 18;
    this.addLine(leftX - 140, y, '  (but sentry is destroyed)', '#777777');
    y += 18;
    this.addLine(leftX - 140, y, 'No Sentry = YOU DIE', '#ff6666');
    y += 28;
    
    // Star rating
    this.addLine(leftX - 140, y, '⭐ Rating = Sentry Lvl at 6AM', '#ffcc44');
    y += 32;
    
    // TELEPORTER (N3+)
    this.addSmallHeader(leftX - 140, y, 'N3+ TELEPORTER', 0xaa88cc);
    y += 24;
    this.addLine(leftX - 140, y, 'Place LURES (50 metal)', '#8877aa');
    y += 18;
    this.addLine(leftX - 140, y, 'Lure certain enemies away!', '#8877aa');
    
    // ===== RIGHT COLUMN =====
    y = contentY;
    
    // ENEMIES header
    this.addSmallHeader(rightX - 140, y, 'ENEMIES', 0xff4444);
    const expandHint = this.add.text(rightX + 40, y + 2, '(click to expand)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#555566',
    });
    this.tutorialContainer.add(expandHint);
    y += 28;
    
    const enemies = [
      { name: 'SCOUT', color: '#9966cc', info: 'Fast · Left hallway' },
      { name: 'SOLDIER', color: '#aa8866', info: 'Rockets · Right hallway' },
      { name: 'DEMO', color: '#44ff44', info: 'N2+ Eye = incoming!' },
      { name: 'HEAVY', color: '#ff4444', info: 'N3+ Lure only!' },
      { name: 'SNIPER', color: '#44aaff', info: 'N4+ Lure or 2 shots' },
      { name: 'SPY', color: '#cc8855', info: 'N4+ See below' },
      { name: 'PYRO', color: '#ff6622', info: 'N5+ See below' },
    ];
    
    enemies.forEach(enemy => {
      // Colored dot with glow effect
      const dotGlow = this.add.circle(rightX - 148, y + 7, 6, parseInt(enemy.color.slice(1), 16), 0.2);
      this.tutorialContainer.add(dotGlow);
      const dot = this.add.circle(rightX - 148, y + 7, 4, parseInt(enemy.color.slice(1), 16));
      this.tutorialContainer.add(dot);
      
      // Clickable hit area (covers name and arrow)
      const hitArea = this.add.rectangle(rightX - 80, y + 7, 160, 20, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      this.tutorialContainer.add(hitArea);
      
      // Enemy name (larger font)
      const nameText = this.add.text(rightX - 135, y, enemy.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: enemy.color,
        fontStyle: 'bold',
      });
      this.tutorialContainer.add(nameText);
      
      // Arrow indicator
      const arrow = this.add.text(rightX - 50, y + 2, '▶', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#444455',
      });
      this.tutorialContainer.add(arrow);
      
      // Info text (hidden by default)
      const infoText = this.add.text(rightX - 30, y, enemy.info, {
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        color: '#889999',
      });
      infoText.setVisible(false);
      this.tutorialContainer.add(infoText);
      
      // Toggle on click (hit area covers name + arrow)
      hitArea.on('pointerdown', () => {
        playMenuButtonSound();
        const isVisible = infoText.visible;
        infoText.setVisible(!isVisible);
        arrow.setText(isVisible ? '▶' : '▼');
        arrow.setColor(isVisible ? '#444455' : enemy.color);
      });
      
      // Hover effect
      hitArea.on('pointerover', () => {
        nameText.setColor('#ffffff');
        arrow.setColor('#777788');
        dotGlow.setAlpha(0.5);
      });
      hitArea.on('pointerout', () => {
        nameText.setColor(enemy.color);
        dotGlow.setAlpha(0.2);
        if (!infoText.visible) {
          arrow.setColor('#444455');
        }
      });
      
      y += 22;
    });
    y += 16;
    
    // SPY section base Y
    const spyBaseY = y;
    const spyCollapsedHeight = 28;
    const spyExpandedHeight = 90;
    
    // SPY box (collapsible)
    const spyBoxCollapsed = this.add.rectangle(rightX + 10, spyBaseY + 14, 320, 28, 0x18140c);
    spyBoxCollapsed.setStrokeStyle(1, 0xaa7744);
    this.tutorialContainer.add(spyBoxCollapsed);
    
    const spyBoxExpanded = this.add.rectangle(rightX + 10, spyBaseY + 45, 320, 90, 0x18140c);
    spyBoxExpanded.setStrokeStyle(1, 0xaa7744);
    spyBoxExpanded.setVisible(false);
    this.tutorialContainer.add(spyBoxExpanded);
    
    // SPY header (clickable)
    const spyHeader = this.add.text(rightX - 140, spyBaseY + 6, '▶ SPY: Two modes (not both!)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#ddaa77',
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(spyHeader);
    
    // SPY details (hidden by default)
    const spyDetails: Phaser.GameObjects.Text[] = [];
    const spyLine1 = this.add.text(rightX - 130, spyBaseY + 30, '• DISGUISE: Fake enemy on cams', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#aa9966',
    });
    const spyLine2 = this.add.text(rightX - 130, spyBaseY + 48, '• SAP: Saps if you TP away', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#aa9966',
    });
    const spyLine3 = this.add.text(rightX - 130, spyBaseY + 66, 'Sapper? Press SPACE x2!', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#ffcc88',
    });
    spyDetails.push(spyLine1, spyLine2, spyLine3);
    spyDetails.forEach(t => { t.setVisible(false); this.tutorialContainer.add(t); });
    
    // SPY click area
    const spyClickArea = this.add.rectangle(rightX + 10, spyBaseY + 14, 320, 28, 0x000000, 0);
    spyClickArea.setInteractive({ useHandCursor: true });
    this.tutorialContainer.add(spyClickArea);
    
    // PYRO section - positioned right below SPY
    const pyroBaseY = spyBaseY + spyCollapsedHeight + 6; // Small gap
    
    // PYRO box (collapsible)
    const pyroBoxCollapsed = this.add.rectangle(rightX + 10, pyroBaseY + 14, 320, 28, 0x1a100c);
    pyroBoxCollapsed.setStrokeStyle(1, 0xff6622);
    this.tutorialContainer.add(pyroBoxCollapsed);
    
    const pyroBoxExpanded = this.add.rectangle(rightX + 10, pyroBaseY + 52, 320, 100, 0x1a100c);
    pyroBoxExpanded.setStrokeStyle(1, 0xff6622);
    pyroBoxExpanded.setVisible(false);
    this.tutorialContainer.add(pyroBoxExpanded);
    
    // PYRO header (clickable)
    const pyroHeader = this.add.text(rightX - 140, pyroBaseY + 6, '▶ PYRO: Night 5+', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#ff6622',
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(pyroHeader);
    
    // PYRO details (hidden by default)
    const pyroDetails: Phaser.GameObjects.Text[] = [];
    const pyroLine1 = this.add.text(rightX - 130, pyroBaseY + 30, '• ROOM: Crackle on cams, invisible', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#dd8844',
    });
    const pyroLine2 = this.add.text(rightX - 130, pyroBaseY + 48, '• HALLWAY: Shine light 1.5s!', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#ffcc66',
    });
    const pyroLine3 = this.add.text(rightX - 130, pyroBaseY + 66, '• INTEL: Match = 10s to escape!', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#dd8844',
    });
    const pyroLine4 = this.add.text(rightX - 130, pyroBaseY + 84, 'Reflects sentry shots!', {
      fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#ffaa66',
    });
    pyroDetails.push(pyroLine1, pyroLine2, pyroLine3, pyroLine4);
    pyroDetails.forEach(t => { t.setVisible(false); this.tutorialContainer.add(t); });
    
    // PYRO click area
    const pyroClickArea = this.add.rectangle(rightX + 10, pyroBaseY + 14, 320, 28, 0x000000, 0);
    pyroClickArea.setInteractive({ useHandCursor: true });
    this.tutorialContainer.add(pyroClickArea);
    
    // All PYRO elements for repositioning
    const pyroElements = [pyroBoxCollapsed, pyroBoxExpanded, pyroHeader, pyroClickArea, ...pyroDetails];
    
    // SPY click handler - toggles and moves Pyro
    let spyExpanded = false;
    spyClickArea.on('pointerdown', () => {
      playMenuButtonSound();
      spyExpanded = !spyExpanded;
      spyBoxCollapsed.setVisible(!spyExpanded);
      spyBoxExpanded.setVisible(spyExpanded);
      spyDetails.forEach(t => t.setVisible(spyExpanded));
      spyHeader.setText(spyExpanded ? '▼ SPY: Two modes (not both!)' : '▶ SPY: Two modes (not both!)');
      
      // Move Pyro elements up or down
      const offset = spyExpanded ? (spyExpandedHeight - spyCollapsedHeight) : -(spyExpandedHeight - spyCollapsedHeight);
      pyroElements.forEach(el => el.setY(el.y + offset));
    });
    
    // PYRO click handler
    let pyroExpanded = false;
    pyroClickArea.on('pointerdown', () => {
      playMenuButtonSound();
      pyroExpanded = !pyroExpanded;
      pyroBoxCollapsed.setVisible(!pyroExpanded);
      pyroBoxExpanded.setVisible(pyroExpanded);
      pyroDetails.forEach(t => t.setVisible(pyroExpanded));
      pyroHeader.setText(pyroExpanded ? '▼ PYRO: Night 5+' : '▶ PYRO: Night 5+');
    });
    
    // Close instruction
    const closeText = this.add.text(panelX, panelY + panelHeight/2 - 15, '[ click anywhere to close ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#555566',
    }).setOrigin(0.5);
    this.tutorialContainer.add(closeText);
    
    // Close on click
    overlay.on('pointerdown', () => this.hideTutorial());
  }
  
  private addSmallHeader(x: number, y: number, text: string, color: number): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const header = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: colorHex,
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(header);
  }
  
  private addLine(x: number, y: number, text: string, color: string = '#999999', bold: boolean = false): void {
    const line = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: color,
      fontStyle: bold ? 'bold' : 'normal',
    });
    this.tutorialContainer.add(line);
  }
  
  private addKeyAction(x: number, y: number, key: string, action: string): void {
    const keyText = this.add.text(x, y, `[${key}]`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#6699bb',
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(keyText);
    
    const actionText = this.add.text(x + 65, y, action, {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#888899',
    });
    this.tutorialContainer.add(actionText);
  }
  
  private _addSection(x: number, y: number, title: string, color: number, lines: string[]): void {
    this.addHeader(x, y, title, color);
    
    lines.forEach((line, i) => {
      this.addText(x - 140, y + 30 + i * 18, line, '#9999aa');
    });
  }
  
  private addHeader(x: number, y: number, title: string, color: number): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const text = this.add.text(x - 140, y, title, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: colorHex,
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(text);
    
    const line = this.add.rectangle(x, y + 18, 280, 1, color, 0.4);
    this.tutorialContainer.add(line);
  }
  
  private addText(x: number, y: number, text: string, color: string, bold: boolean = false): void {
    const textObj = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: color,
      fontStyle: bold ? 'bold' : 'normal',
    });
    this.tutorialContainer.add(textObj);
  }
  
  private showTutorial(): void {
    this.tutorialContainer.setVisible(true);
  }
  
  private hideTutorial(): void {
    playMenuButtonSound();
    this.tutorialContainer.setVisible(false);
  }
  
  private createExtrasOverlay(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    this.extrasContainer = this.add.container(0, 0);
    this.extrasContainer.setDepth(100);
    this.extrasContainer.setVisible(false);
    
    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hideExtras());
    this.extrasContainer.add(overlay);
    
    // Title
    const titleText = this.add.text(width / 2, 50, '★ CHARACTER GALLERY ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#ffaa44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.extrasContainer.add(titleText);
    
    // Subtitle
    const subText = this.add.text(width / 2, 85, 'Click anywhere to close', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5);
    this.extrasContainer.add(subText);
    
    // All 6 real characters (Spy is dynamic, shown separately)
    const characters = [
      { name: 'SCOUT', color: 0x9966cc, desc: 'Fast Attacker', night: 1 },  // Purple
      { name: 'SOLDIER', color: 0xaa5544, desc: 'Siege Specialist', night: 1 },
      { name: 'DEMOMAN', color: 0x44cc44, desc: 'Ghostly Charger', night: 2 },
      { name: 'HEAVY', color: 0xaa7744, desc: 'Unstoppable Tank', night: 3 },
      { name: 'SNIPER', color: 0x5588cc, desc: 'Long-Range Threat', night: 4 },
      { name: 'PYRO', color: 0xff6622, desc: 'Ghostly Flame', night: 5 },
    ];
    
    // Spy disguises as a random character each time gallery opens!
    const spyDisguiseIndex = Math.floor(Math.random() * 5);
    const spyDisguise = characters[spyDisguiseIndex];
    
    // Draw 4 cards in first row (centered on screen width 1280)
    for (let i = 0; i < 4; i++) {
      const x = 310 + i * 220;  // 310, 530, 750, 970
      this.drawCharacterCard(x, 250, characters[i].name, characters[i].color, characters[i].night);
    }
    
    // Draw 3 cards in second row (Sniper, Pyro, Spy) - centered
    for (let i = 4; i < 6; i++) {
      const x = 420 + (i - 4) * 220;  // 420, 640
      this.drawCharacterCard(x, 480, characters[i].name, characters[i].color, characters[i].night);
    }
    
    // SPY card placeholder at position 860 (actual card generated in regenerateSpyCard each time gallery opens)
  }
  
  private drawCharacterCard(x: number, y: number, name: string, color: number, night: number): void {
    // Card background
    const cardBg = this.add.rectangle(x, y, 180, 180, 0x0a0a15);
    cardBg.setStrokeStyle(2, color);
    this.extrasContainer.add(cardBg);
    
    // Character silhouette
    const silhouette = this.add.graphics();
    drawCharacterSilhouette(silhouette, x, y - 15, name, color);
    this.extrasContainer.add(silhouette);
    
    // Name only (no description tagline)
    const nameText = this.add.text(x, y + 70, name, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.extrasContainer.add(nameText);
    
    // Night badge (0 = Custom Night shown as "C")
    const nightLabel = night === 0 ? 'C' : `N${night}`;
    const nightBadge = this.add.text(x + 75, y - 75, nightLabel, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: night === 0 ? '#ff6622' : '#888888',
      backgroundColor: '#1a1a22',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5);
    this.extrasContainer.add(nightBadge);
  }
  
  
  private showExtras(): void {
    // Regenerate the Spy card with a new random disguise each time
    this.regenerateSpyCard();
    this.extrasContainer.setVisible(true);
  }
  
  private hideExtras(): void {
    playMenuButtonSound();
    this.extrasContainer.setVisible(false);
  }
  
  // Store spy card elements so we can regenerate them
  private spyCardElements: Phaser.GameObjects.GameObject[] = [];
  
  private regenerateSpyCard(): void {
    // Remove old spy card elements
    this.spyCardElements.forEach(el => el.destroy());
    this.spyCardElements = [];
    
    const disguise = pickRandomSpyDisguise();
    
    // Create new spy card at position (860, 480) - third in bottom row (centered)
    const x = 860, y = 480;
    
    const cardBg = this.add.rectangle(x, y, 180, 180, 0x050508);
    cardBg.setStrokeStyle(2, 0x333333);
    this.extrasContainer.add(cardBg);
    this.spyCardElements.push(cardBg);
    
    const silhouette = this.add.graphics();
    drawCharacterSilhouette(silhouette, x, y - 15, disguise.name, disguise.color);
    this.extrasContainer.add(silhouette);
    this.spyCardElements.push(silhouette);
    
    const nameText = this.add.text(x, y + 65, 'SPY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#bb4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.extrasContainer.add(nameText);
    this.spyCardElements.push(nameText);
    
    const nightBadge = this.add.text(x + 75, y - 75, 'N4', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#444444',
      backgroundColor: '#111111',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5);
    this.extrasContainer.add(nightBadge);
    this.spyCardElements.push(nightBadge);
  }
  
  // ============================================
  // ENDINGS PREVIEW (DEV MODE / POST-GAME)
  // ============================================
  
  /**
   * Create the endings preview overlay
   */
  private createEndingsOverlay(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    this.endingsContainer = this.add.container(0, 0);
    this.endingsContainer.setVisible(false);
    this.endingsContainer.setDepth(200);
    
    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hideEndingsMenu());
    this.endingsContainer.add(overlay);
    
    // Title
    const title = this.add.text(width / 2, 80, '☆ ENDINGS PREVIEW ☆', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#8899bb',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endingsContainer.add(title);
    
    const subtitle = this.add.text(width / 2, 115, 'Preview all ending screens', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#556677',
    }).setOrigin(0.5);
    this.endingsContainer.add(subtitle);
    
    // Good Ending button
    const goodBtn = this.add.rectangle(width / 2, 220, 350, 80, 0x1a2a1a);
    goodBtn.setStrokeStyle(2, 0x44aa44);
    goodBtn.setInteractive({ useHandCursor: true });
    goodBtn.on('pointerover', () => goodBtn.setFillStyle(0x2a3a2a));
    goodBtn.on('pointerout', () => goodBtn.setFillStyle(0x1a2a1a));
    goodBtn.on('pointerdown', () => {
      playMenuButtonSound();
      this.scene.start('GameScene', { night: 5, previewEnding: 'good' });
    });
    this.endingsContainer.add(goodBtn);
    
    const goodTitle = this.add.text(width / 2, 210, 'GOOD ENDING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#88ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endingsContainer.add(goodTitle);
    
    const goodDesc = this.add.text(width / 2, 235, 'Peaceful celebration - all mercs together', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#66aa66',
    }).setOrigin(0.5);
    this.endingsContainer.add(goodDesc);
    
    // Bad Ending Intro button
    const badIntroBtn = this.add.rectangle(width / 2, 330, 350, 80, 0x2a1a1a);
    badIntroBtn.setStrokeStyle(2, 0xaa4444);
    badIntroBtn.setInteractive({ useHandCursor: true });
    badIntroBtn.on('pointerover', () => badIntroBtn.setFillStyle(0x3a2a2a));
    badIntroBtn.on('pointerout', () => badIntroBtn.setFillStyle(0x2a1a1a));
    badIntroBtn.on('pointerdown', () => {
      playMenuButtonSound();
      this.scene.start('GameScene', { night: 5, previewEnding: 'badIntro' });
    });
    this.endingsContainer.add(badIntroBtn);
    
    const badIntroTitle = this.add.text(width / 2, 320, 'BAD ENDING INTRO', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff8888',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endingsContainer.add(badIntroTitle);
    
    const badIntroDesc = this.add.text(width / 2, 345, 'Medic goes mad cinematic - leads to Night 6', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#aa6666',
    }).setOrigin(0.5);
    this.endingsContainer.add(badIntroDesc);
    
    // Dark Ending (Night 6) button
    const darkBtn = this.add.rectangle(width / 2, 440, 350, 80, 0x1a1a2a);
    darkBtn.setStrokeStyle(2, 0x6666aa);
    darkBtn.setInteractive({ useHandCursor: true });
    darkBtn.on('pointerover', () => darkBtn.setFillStyle(0x2a2a3a));
    darkBtn.on('pointerout', () => darkBtn.setFillStyle(0x1a1a2a));
    darkBtn.on('pointerdown', () => {
      playMenuButtonSound();
      this.scene.start('GameScene', { night: 6, previewEnding: 'dark' });
    });
    this.endingsContainer.add(darkBtn);
    
    const darkTitle = this.add.text(width / 2, 430, 'DARK ENDING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#aaaaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.endingsContainer.add(darkTitle);
    
    const darkDesc = this.add.text(width / 2, 455, 'Night 6 survival end - lonely Engineer', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#7777aa',
    }).setOrigin(0.5);
    this.endingsContainer.add(darkDesc);
    
    // Close button
    const closeBtn = this.add.text(width / 2, 550, '[ CLOSE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#666666',
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#aaaaaa'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#666666'));
    closeBtn.on('pointerdown', () => this.hideEndingsMenu());
    this.endingsContainer.add(closeBtn);
  }
  
  /**
   * Show the endings preview menu
   */
  private showEndingsMenu(): void {
    this.endingsContainer.setVisible(true);
  }
  
  /**
   * Hide the endings preview menu
   */
  private hideEndingsMenu(): void {
    playMenuButtonSound();
    this.endingsContainer.setVisible(false);
  }
}
