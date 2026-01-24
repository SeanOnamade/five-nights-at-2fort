import Phaser from 'phaser';
import { isMobileDevice } from '../utils/mobile';

/**
 * BootScene - Main Menu / Title Screen
 * 
 * Displays the game title, night selection, and allows player to start the game.
 */
export class BootScene extends Phaser.Scene {
  private selectedNight: number = 1;
  private tutorialContainer!: Phaser.GameObjects.Container;
  private extrasContainer!: Phaser.GameObjects.Container;
  private isMobile: boolean = false;
  
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
    
    // Reset selected night to 1 when returning to menu
    this.selectedNight = 1;
    
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
    
    // Start button text (declared early so night buttons can reference it)
    let startText: Phaser.GameObjects.Text;
    
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
    
    // ===== NIGHT SELECTION (bottom area) =====
    const nightSelY = 580;
    
    this.add.text(width / 2, nightSelY - 50, 'SELECT NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#446644',
    }).setOrigin(0.5);
    
    // Night buttons - compact row at bottom
    const nightButtons: Phaser.GameObjects.Container[] = [];
    const nights = [1, 2, 3, 4, 5, 6];
    const nightBtnWidth = 60;
    const nightBtnGap = 12;
    const totalNightWidth = nights.length * nightBtnWidth + (nights.length - 1) * nightBtnGap;
    const buttonStartX = (width - totalNightWidth) / 2 + nightBtnWidth / 2;
    const buttonY = nightSelY;
    
    // Custom night enemy toggles - load from localStorage or default to OFF
    const savedSettings = localStorage.getItem('customNightEnemies');
    const customNightEnemies = savedSettings ? JSON.parse(savedSettings) : {
      scout: false,
      soldier: false,
      demoman: false,
      heavy: false,
      sniper: false,
      spy: false,
      pyro: false,
      medic: false,
    };
    // Ensure medic key exists for older saved settings
    if (customNightEnemies.medic === undefined) {
      customNightEnemies.medic = false;
    }
    
    // Custom night UI container (created later, shown when N6 selected)
    let customNightUI: Phaser.GameObjects.Container | null = null;
    
    nights.forEach((night, index) => {
      const x = buttonStartX + index * (nightBtnWidth + nightBtnGap);
      const isCustomNight = night === 6;
      const isUnlocked = night <= 6;
      
      // Compact green color scheme
      const glowColor = 0x44ff44;
      const bgColor = 0x0f1a0f;
      const strokeColor = 0x336633;
      const textColor = '#44aa44';
      
      // Button glow (for selected)
      const btnGlow = this.add.rectangle(x, buttonY, nightBtnWidth + 4, 44, glowColor, 0);
      
      // Button background - compact
      const btnBg = this.add.rectangle(x, buttonY, nightBtnWidth, 40, isUnlocked ? bgColor : 0x111111);
      btnBg.setStrokeStyle(2, isUnlocked ? strokeColor : 0x222222);
      
      // Night number or "C" for custom
      const nightNum = this.add.text(x, buttonY, isCustomNight ? 'C' : `${night}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: isUnlocked ? textColor : '#333333',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      // No label - just the number/letter
      
      const container = this.add.container(0, 0, [btnGlow, btnBg, nightNum]);
      nightButtons.push(container);
      
      if (isUnlocked) {
        btnBg.setInteractive({ useHandCursor: true });
        
        btnBg.on('pointerover', () => {
          btnBg.setFillStyle(0x1a331a);
          btnBg.setStrokeStyle(2, 0x55aa55);
          nightNum.setColor('#66ff66');
        });
        
        btnBg.on('pointerout', () => {
          if (this.selectedNight === night) {
            btnBg.setFillStyle(0x1a2a1a);
            btnBg.setStrokeStyle(3, 0x44ff44);
            btnGlow.setFillStyle(0x44ff44, 0.08);
            nightNum.setColor('#66ff66');
          } else {
            btnBg.setFillStyle(0x112211);
            btnBg.setStrokeStyle(2, 0x336633);
            btnGlow.setFillStyle(0x44ff44, 0);
            nightNum.setColor('#44aa44');
          }
        });
        
        btnBg.on('pointerdown', () => {
          this.selectedNight = night;
          startText.setText(isCustomNight ? '▶ START CUSTOM NIGHT' : `▶ START NIGHT ${night}`);
          
          // Show/hide custom night UI
          if (customNightUI) {
            customNightUI.setVisible(isCustomNight);
          }
          
          // Update all buttons
          nightButtons.forEach((btn, i) => {
            const glow = btn.list[0] as Phaser.GameObjects.Rectangle;
            const bg = btn.list[1] as Phaser.GameObjects.Rectangle;
            const num = btn.list[2] as Phaser.GameObjects.Text;
            const isThisCustom = nights[i] === 6;
            
            if (nights[i] <= 6) {
              if (i === index) {
                // All buttons use green when selected (including custom)
                bg.setFillStyle(0x1a2a1a);
                bg.setStrokeStyle(3, 0x44ff44);
                glow.setFillStyle(0x44ff44, 0.08);
                num.setColor('#66ff66');
              } else {
                // All buttons use green when not selected
                bg.setFillStyle(0x112211);
                bg.setStrokeStyle(2, 0x336633);
                glow.setFillStyle(0x44ff44, 0);
                num.setColor('#44aa44');
              }
            }
          });
        });
        
        // Select night 1 by default
        if (night === 1) {
          btnBg.setFillStyle(0x1a2a1a);
          btnBg.setStrokeStyle(3, 0x44ff44);
          btnGlow.setFillStyle(0x44ff44, 0.08);
          nightNum.setColor('#66ff66');
        }
      }
    });
    
    // ===== CUSTOM NIGHT UI (shown when C is selected - ABOVE night selection) =====
    customNightUI = this.add.container(width / 2, nightSelY - 75);
    customNightUI.setVisible(false);
    
    // Brighter panel for custom night (wider to fit 8 enemies including Pyro and Medic)
    const customBg = this.add.rectangle(0, 0, 580, 60, 0x101815, 0.98);
    customBg.setStrokeStyle(2, 0x44aa44);
    customNightUI.add(customBg);
    
    const customTitle = this.add.text(0, -24, 'ENABLE THREATS:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#66cc66',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    customNightUI.add(customTitle);
    
    const enemyTypes = ['scout', 'soldier', 'demoman', 'heavy', 'sniper', 'spy', 'pyro', 'medic'] as const;
    const enemyColors: Record<string, number> = {
      scout: 0x7755aa,   // Purple for scout
      soldier: 0x6688aa,
      demoman: 0x44aa55,
      heavy: 0xaa6644,
      sniper: 0x5599cc,
      spy: 0x666677,
      pyro: 0xdd6622,    // Fire orange for Pyro
      medic: 0x4488ff,   // Blue for Medic (Über color)
    };
    const enemyLabels: Record<string, string> = {
      scout: 'SCT',
      soldier: 'SOL',
      demoman: 'DEM',
      heavy: 'HVY',
      sniper: 'SNP',
      spy: 'SPY',
      pyro: 'PYR',
      medic: 'MED',
    };
    
    enemyTypes.forEach((enemy, i) => {
      const ex = -217 + i * 62;  // Centered spacing for 8 enemies
      const ey = 10;
      
      // Brighter toggle button - starts OFF by default (smaller to fit 7 enemies)
      const toggleBg = this.add.rectangle(ex, ey, 55, 28, enemyColors[enemy], 0.5);
      toggleBg.setStrokeStyle(1, 0x555555);
      toggleBg.setInteractive({ useHandCursor: true });
      
      const toggleLabel = this.add.text(ex, ey, enemyLabels[enemy], {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#888888',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      toggleBg.on('pointerdown', () => {
        customNightEnemies[enemy] = !customNightEnemies[enemy];
        // Save to localStorage
        localStorage.setItem('customNightEnemies', JSON.stringify(customNightEnemies));
        
        if (customNightEnemies[enemy]) {
          toggleBg.setStrokeStyle(2, 0x66ff66);
          toggleBg.setAlpha(1);
          toggleLabel.setColor('#ffffff');
        } else {
          toggleBg.setStrokeStyle(1, 0x555555);
          toggleBg.setAlpha(0.5);
          toggleLabel.setColor('#888888');
        }
      });
      
      // Initialize visual state based on saved settings
      if (customNightEnemies[enemy]) {
        toggleBg.setStrokeStyle(2, 0x66ff66);
        toggleBg.setAlpha(1);
        toggleLabel.setColor('#ffffff');
      }
      
      customNightUI!.add([toggleBg, toggleLabel]);
    });
    
    // ===== START BUTTON (center of screen - prominent) =====
    const startBtnY = 320;
    const startBtnGlow = this.add.rectangle(width / 2, startBtnY, 340, 70, 0x44ff44, 0.08);
    const startBtnBg = this.add.rectangle(width / 2, startBtnY, 320, 60, 0x0f1f0f);
    startBtnBg.setStrokeStyle(3, 0x44aa44);
    startBtnBg.setInteractive({ useHandCursor: true });
    
    startText = this.add.text(width / 2, startBtnY, '▶ START NIGHT 1', {
      fontFamily: 'Courier New, monospace',
      fontSize: '26px',
      color: '#55dd55',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Pulse effect on start button
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
      startBtnBg.setFillStyle(0x1a331a);
      startBtnBg.setStrokeStyle(3, 0x44aa44);
      startText.setColor('#66ff66');
    });
    
    // Start game function
    let started = false;
    const startGame = () => {
      if (started) return;
      started = true;
      
      this.playStartSound();
      startText.setText(`LOADING NIGHT ${this.selectedNight}...`);
      
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(600, () => {
        // For custom night, pass enemy toggles
        if (this.selectedNight === 6) {
          this.scene.start('GameScene', { 
            night: 6, 
            customEnemies: { ...customNightEnemies }
          });
        } else {
          this.scene.start('GameScene', { night: this.selectedNight });
        }
      });
    };
    
    startBtnBg.on('pointerdown', startGame);
    this.input.keyboard?.on('keydown-SPACE', startGame);
    this.input.keyboard?.on('keydown-ENTER', startGame);
    
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
    tutorialBtnBg.on('pointerdown', () => this.showTutorial());
    
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
    extrasBtnBg.on('pointerdown', () => this.showExtras());
    
    // Create tutorial overlay
    this.createTutorialOverlay();
    
    // Create extras overlay
    this.createExtrasOverlay();
    
    // Version
    this.add.text(width - 60, height - 30, 'v1.0', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#333344',
    }).setOrigin(0.5);
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
      { name: 'SCOUT', color: '#9966cc', info: 'Fast · Left door' },
      { name: 'SOLDIER', color: '#aa8866', info: 'Rockets · Right door' },
      { name: 'DEMO', color: '#44ff44', info: 'N2+ Eye = incoming!' },
      { name: 'HEAVY', color: '#ff4444', info: 'N3+ Lure only!' },
      { name: 'SNIPER', color: '#44aaff', info: 'N4+ Lure or 2 shots' },
      { name: 'SPY', color: '#cc8855', info: 'N5+ See below' },
      { name: 'PYRO', color: '#ff6622', info: 'Custom · See below' },
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
    const spyLine2 = this.add.text(rightX - 130, spyBaseY + 48, '• SAP: May sap if you TP away', {
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
    const pyroHeader = this.add.text(rightX - 140, pyroBaseY + 6, '▶ PYRO: Custom Night Only!', {
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
      pyroExpanded = !pyroExpanded;
      pyroBoxCollapsed.setVisible(!pyroExpanded);
      pyroBoxExpanded.setVisible(pyroExpanded);
      pyroDetails.forEach(t => t.setVisible(pyroExpanded));
      pyroHeader.setText(pyroExpanded ? '▼ PYRO: Custom Night Only!' : '▶ PYRO: Custom Night Only!');
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
    this.tutorialContainer.setVisible(false);
  }
  
  private playStartSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not available
    }
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
      { name: 'PYRO', color: 0xff6622, desc: 'Ghostly Flame', night: 0 },  // Custom night = 0
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
    this.drawCharacterSilhouette(silhouette, x, y - 15, name, color);
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
  
  private drawCharacterSilhouette(graphics: Phaser.GameObjects.Graphics, x: number, y: number, name: string, _color: number): void {
    graphics.clear();
    
    switch (name) {
      case 'SCOUT':
        // Scout - lean Boston speedster with iconic look
        
        // Glow effect behind
        graphics.fillStyle(0x3366aa, 0.15);
        graphics.fillCircle(x, y, 75);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 60, 55, 12);
        
        // Legs - athletic runner stance
        graphics.fillStyle(0x8b7355, 1); // Khaki pants
        graphics.fillRect(x - 15, y + 15, 13, 40);
        graphics.fillRect(x + 2, y + 12, 13, 43);
        // Knee wraps/tape
        graphics.fillStyle(0xcccccc, 1);
        graphics.fillRect(x - 14, y + 30, 11, 6);
        graphics.fillRect(x + 3, y + 28, 11, 6);
        
        // Running shoes - red with white
        graphics.fillStyle(0xcc2222, 1);
        graphics.fillRoundedRect(x - 18, y + 52, 18, 10, 3);
        graphics.fillRoundedRect(x + 2, y + 52, 18, 10, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(x - 14, y + 55, 8, 3);
        graphics.fillRect(x + 6, y + 55, 8, 3);
        
        // Lean athletic torso - BLU team t-shirt
        graphics.fillStyle(0x335599, 1);
        graphics.beginPath();
        graphics.moveTo(x - 20, y - 20);
        graphics.lineTo(x + 18, y - 20);
        graphics.lineTo(x + 15, y + 18);
        graphics.lineTo(x - 17, y + 18);
        graphics.closePath();
        graphics.fillPath();
        
        // Dog tags
        graphics.fillStyle(0x777777, 1);
        graphics.fillRect(x - 1, y - 15, 2, 20);
        graphics.fillStyle(0x999999, 1);
        graphics.fillEllipse(x, y + 7, 6, 8);
        graphics.fillEllipse(x + 2, y + 9, 6, 8);
        
        // Bandages on hands/forearms - iconic Scout look
        graphics.fillStyle(0xdddddd, 1);
        graphics.fillRect(x - 38, y + 5, 12, 18);
        graphics.fillRect(x + 26, y - 25, 12, 18);
        // Tape strips
        graphics.fillStyle(0xcccccc, 1);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x - 37, y + 7 + i * 4, 10, 2);
          graphics.fillRect(x + 27, y - 23 + i * 4, 10, 2);
        }
        
        // Arms - BLU team
        graphics.fillStyle(0x335599, 1);
        graphics.fillCircle(x - 22, y - 14, 10);
        graphics.fillCircle(x + 20, y - 14, 10);
        graphics.fillRect(x - 42, y - 18, 22, 12);
        graphics.fillRect(x + 18, y - 35, 12, 25);
        
        // Hands (under bandages)
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x - 35, y + 20, 8);
        graphics.fillCircle(x + 30, y - 38, 8);
        
        // Baseball bat - aluminum
        graphics.fillStyle(0xaaaaaa, 1);
        graphics.fillRect(x + 24, y - 70, 10, 50);
        graphics.fillStyle(0x888888, 1);
        graphics.fillRoundedRect(x + 22, y - 78, 14, 22, 5);
        // Grip tape
        graphics.fillStyle(0x222222, 1);
        graphics.fillRect(x + 25, y - 25, 8, 18);
        graphics.fillStyle(0xcc2222, 1);
        graphics.fillCircle(x + 29, y - 5, 5);
        
        // Head
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x, y - 40, 22);
        graphics.fillEllipse(x, y - 22, 16, 10);
        
        // Patrol cap - grey military style
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.beginPath();
        graphics.arc(x, y - 48, 24, Math.PI, 0, false);
        graphics.closePath();
        graphics.fillPath();
        // Bill (facing backward/right)
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x + 24, y - 46);
        graphics.lineTo(x + 45, y - 38);
        graphics.lineTo(x + 40, y - 44);
        graphics.lineTo(x + 5, y - 46);
        graphics.closePath();
        graphics.fillPath();
        // Cap button
        graphics.fillStyle(0x555555, 1);
        graphics.fillCircle(x, y - 62, 4);
        
        // Headset
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 12, y - 55, 14, 4);
        graphics.fillCircle(x + 22, y - 42, 9);
        graphics.fillStyle(0x222222, 1);
        graphics.fillCircle(x + 22, y - 42, 6);
        // Mic
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 20, y - 38, 3, 20);
        graphics.fillCircle(x + 21, y - 18, 5);
        
        // No mouth - more mysterious/threatening
        
        // Intense eyes - lower on face
        graphics.fillStyle(0xff0000, 0.4);
        graphics.fillCircle(x - 8, y - 40, 8);
        graphics.fillCircle(x + 8, y - 40, 8);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 8, y - 40, 5);
        graphics.fillCircle(x + 8, y - 40, 5);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(x - 10, y - 42, 2);
        graphics.fillCircle(x + 6, y - 42, 2);
        break;
        
      case 'SOLDIER':
        // Soldier - stocky American patriot with helmet and rocket launcher
        
        // Red/orange glow behind
        graphics.fillStyle(0xcc4422, 0.12);
        graphics.fillCircle(x, y, 80);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 60, 75, 15);
        
        // Legs - wide military stance
        graphics.fillStyle(0x3a3a4a, 1);
        graphics.fillRect(x - 24, y + 22, 18, 36);
        graphics.fillRect(x + 6, y + 22, 18, 36);
        // Knee pads
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillEllipse(x - 15, y + 32, 10, 8);
        graphics.fillEllipse(x + 15, y + 32, 10, 8);
        // Combat boots - chunky
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 28, y + 52, 24, 12, 3);
        graphics.fillRoundedRect(x + 4, y + 52, 24, 12, 3);
        // Boot soles
        graphics.fillStyle(0x111111, 1);
        graphics.fillRect(x - 28, y + 62, 24, 3);
        graphics.fillRect(x + 4, y + 62, 24, 3);
        
        // Stocky military torso - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.fillRoundedRect(x - 32, y - 18, 64, 45, 6);
        // Jacket center seam
        graphics.fillStyle(0x1a3377, 1);
        graphics.fillRect(x - 3, y - 15, 6, 40);
        // Jacket collar
        graphics.fillStyle(0x1a2a66, 1);
        graphics.fillRect(x - 18, y - 20, 36, 8);
        // Chest pockets
        graphics.fillStyle(0x335599, 0.5);
        graphics.fillRect(x - 26, y - 8, 14, 12);
        graphics.fillRect(x + 12, y - 8, 14, 12);
        // Pocket buttons
        graphics.fillStyle(0x888866, 1);
        graphics.fillCircle(x - 19, y - 2, 2);
        graphics.fillCircle(x + 19, y - 2, 2);
        
        // Ammo pouches on belt
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRect(x - 30, y + 14, 14, 14);
        graphics.fillRect(x + 16, y + 14, 14, 14);
        // Pouch flaps
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillRect(x - 30, y + 14, 14, 5);
        graphics.fillRect(x + 16, y + 14, 14, 5);
        
        // Strong arms - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.fillCircle(x - 32, y - 8, 14);
        graphics.fillCircle(x + 32, y - 8, 14);
        // Left arm down at side
        graphics.fillRect(x - 44, y - 10, 16, 40);
        // Right arm up holding launcher
        graphics.fillRect(x + 28, y - 25, 16, 30);
        
        // Hands - rough military
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 38, y + 32, 10);
        graphics.fillCircle(x + 36, y - 28, 10);
        
        // Head (mostly hidden under helmet)
        graphics.fillStyle(0x9a8a7a, 1);
        graphics.fillCircle(x, y - 35, 20);
        // Strong jaw/chin visible
        graphics.fillStyle(0xaa9a8a, 1);
        graphics.fillEllipse(x, y - 18, 18, 12);
        // Stubble
        graphics.fillStyle(0x6a5a4a, 0.4);
        graphics.fillEllipse(x, y - 20, 16, 10);
        
        // Iconic pot helmet - covering eyes completely
        graphics.fillStyle(0x5a5a4a, 1);
        graphics.fillCircle(x, y - 44, 28);
        graphics.fillRect(x - 28, y - 44, 56, 22);
        // Helmet rim (wide brim casting shadow)
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRoundedRect(x - 34, y - 26, 68, 12, 3);
        // Deep shadow under helmet
        graphics.fillStyle(0x1a1a1a, 0.85);
        graphics.fillRect(x - 28, y - 20, 56, 12);
        // Helmet dent/battle damage
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillCircle(x + 12, y - 48, 6);
        
        // Glowing menacing eyes in shadow
        graphics.fillStyle(0xff0000, 0.5);
        graphics.fillCircle(x - 11, y - 16, 10);
        graphics.fillCircle(x + 11, y - 16, 10);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 11, y - 16, 6);
        graphics.fillCircle(x + 11, y - 16, 6);
        graphics.fillStyle(0xffaaaa, 1);
        graphics.fillCircle(x - 11, y - 16, 3);
        graphics.fillCircle(x + 11, y - 16, 3);
        
        // ROCKET LAUNCHER - detailed
        graphics.fillStyle(0x5a5a5a, 1);
        graphics.fillRoundedRect(x + 18, y - 55, 58, 20, 4);
        // Launcher tube opening
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillCircle(x + 76, y - 45, 14);
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x + 76, y - 45, 10);
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x + 76, y - 45, 6);
        // Sight on top
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 35, y - 62, 18, 8);
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 38, y - 66, 4, 6);
        // Handle grip
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x + 32, y - 40, 10, 18);
        // Trigger guard
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRect(x + 28, y - 38, 6, 12);
        
        // Grenades on belt - detailed
        graphics.fillStyle(0x3a4a3a, 1);
        graphics.fillCircle(x - 22, y + 30, 8);
        graphics.fillCircle(x - 6, y + 30, 8);
        graphics.fillCircle(x + 10, y + 30, 8);
        // Grenade tops/fuses
        graphics.fillStyle(0x2a3a2a, 1);
        graphics.fillRect(x - 25, y + 22, 6, 6);
        graphics.fillRect(x - 9, y + 22, 6, 6);
        graphics.fillRect(x + 7, y + 22, 6, 6);
        // Pins
        graphics.fillStyle(0xaaaa88, 1);
        graphics.fillCircle(x - 22, y + 23, 3);
        graphics.fillCircle(x - 6, y + 23, 3);
        graphics.fillCircle(x + 10, y + 23, 3);
        graphics.fillCircle(x - 6, y + 23, 2);
        graphics.fillCircle(x + 8, y + 23, 2);
        break;
        
      case 'DEMOMAN':
        // Demoman - headless body with Eyelander + floating head
        
        // Ghostly green glow behind
        graphics.fillStyle(0x00ff44, 0.15);
        graphics.fillCircle(x, y, 90);
        graphics.fillStyle(0x00aa33, 0.1);
        graphics.fillCircle(x - 10, y + 10, 70);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 65, 70, 14);
        
        // === HEADLESS BODY ===
        // Legs - sturdy stance
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillRect(x - 20, y + 18, 16, 44);
        graphics.fillRect(x + 4, y + 18, 16, 44);
        // Boots
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 24, y + 56, 22, 12, 3);
        graphics.fillRoundedRect(x + 2, y + 56, 22, 12, 3);
        
        // Torso - sturdy Scottish build - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.fillRoundedRect(x - 28, y - 20, 56, 42, 6);
        // Vest/harness
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 24, y - 15, 10, 35);
        graphics.fillRect(x + 14, y - 15, 10, 35);
        graphics.fillRect(x - 24, y - 5, 48, 8);
        // Grenade bandolier
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 26, y + 15);
        graphics.lineTo(x + 26, y - 12);
        graphics.lineTo(x + 26, y - 4);
        graphics.lineTo(x - 26, y + 22);
        graphics.closePath();
        graphics.fillPath();
        // Grenades/stickybombs on bandolier
        graphics.fillStyle(0x333333, 1);
        for (let i = 0; i < 5; i++) {
          const gx = x - 20 + i * 10;
          const gy = y + 10 - i * 5;
          graphics.fillCircle(gx, gy, 6);
          graphics.fillStyle(0xff3300, 1);
          graphics.fillCircle(gx, gy, 3);
          graphics.fillStyle(0x333333, 1);
        }
        
        // Arms - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.fillCircle(x - 28, y - 10, 12);
        graphics.fillCircle(x + 28, y - 10, 12);
        // Left arm down
        graphics.fillRect(x - 38, y - 12, 14, 38);
        // Right arm up holding Eyelander
        graphics.fillRect(x + 24, y - 30, 14, 28);
        
        // Hands
        graphics.fillStyle(0x5a4a3a, 1);
        graphics.fillCircle(x - 34, y + 28, 10);
        graphics.fillCircle(x + 30, y - 35, 10);
        
        // === NECK STUMP (headless!) ===
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillEllipse(x, y - 25, 18, 10);
        // Ghostly green ectoplasm dripping
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillEllipse(x - 5, y - 22, 8, 12);
        graphics.fillEllipse(x + 6, y - 24, 6, 10);
        graphics.fillStyle(0x00ff44, 0.4);
        graphics.fillEllipse(x - 3, y - 15, 5, 8);
        
        // === EYELANDER SWORD ===
        // Blade - long and glowing
        graphics.fillStyle(0x00ff44, 0.3);
        graphics.fillRect(x + 26, y - 80, 12, 55);
        graphics.fillStyle(0x666666, 1);
        graphics.fillRect(x + 28, y - 78, 8, 50);
        // Blade edge gleam
        graphics.fillStyle(0x00ff44, 0.8);
        graphics.fillRect(x + 28, y - 78, 2, 50);
        // Blade tip
        graphics.beginPath();
        graphics.moveTo(x + 28, y - 78);
        graphics.lineTo(x + 36, y - 78);
        graphics.lineTo(x + 32, y - 88);
        graphics.closePath();
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillPath();
        // Crossguard
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 22, y - 30, 20, 6);
        // Handle
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x + 28, y - 25, 8, 18);
        // Pommel
        graphics.fillStyle(0x555555, 1);
        graphics.fillCircle(x + 32, y - 5, 5);
        
        // === FLOATING HEAD (to the side) ===
        // Head position
        const headX = x - 45;
        const headY = y - 40;
        
        // Head (dark skin) - no green glow to avoid looking like a neck
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillCircle(headX, headY, 26);
        // Beanie
        graphics.fillStyle(0x1a1a2a, 1);
        graphics.beginPath();
        graphics.arc(headX, headY - 6, 28, Math.PI, 0, false);
        graphics.closePath();
        graphics.fillPath();
        // Beanie fold
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillRect(headX - 28, headY - 8, 56, 6);
        // Beard
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillEllipse(headX, headY + 18, 28, 16);
        // Eyepatch
        graphics.fillStyle(0x111111, 1);
        graphics.fillCircle(headX + 10, headY - 2, 10);
        graphics.fillRect(headX + 8, headY - 28, 4, 26);
        // Glowing green eye
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillCircle(headX - 10, headY - 2, 12);
        graphics.fillStyle(0x00ff44, 1);
        graphics.fillCircle(headX - 10, headY - 2, 8);
        // Eye glint
        graphics.fillStyle(0xaaffaa, 1);
        graphics.fillCircle(headX - 12, headY - 4, 3);
        break;
        
      case 'HEAVY':
        // Heavy - massive Russian weapons guy with Sasha
        
        // Red glow behind
        graphics.fillStyle(0xaa3333, 0.12);
        graphics.fillCircle(x, y, 90);
        
        // Ground shadow - very large
        graphics.fillStyle(0x000000, 0.6);
        graphics.fillEllipse(x, y + 65, 100, 20);
        
        // Thick powerful legs
        graphics.fillStyle(0x4a4a5a, 1);
        graphics.fillRect(x - 30, y + 25, 26, 38);
        graphics.fillRect(x + 4, y + 25, 26, 38);
        // Knee pads
        graphics.fillStyle(0x3a3a4a, 1);
        graphics.fillEllipse(x - 17, y + 35, 14, 10);
        graphics.fillEllipse(x + 17, y + 35, 14, 10);
        // Combat boots
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 34, y + 58, 32, 12, 3);
        graphics.fillRoundedRect(x + 2, y + 58, 32, 12, 3);
        // Boot laces
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x - 22, y + 60, 10, 2);
        graphics.fillRect(x + 12, y + 60, 10, 2);
        
        // MASSIVE barrel chest - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.fillRoundedRect(x - 50, y - 30, 100, 60, 12);
        // Pec muscle definition
        graphics.fillStyle(0x1a3377, 0.4);
        graphics.fillEllipse(x - 22, y - 5, 22, 28);
        graphics.fillEllipse(x + 22, y - 5, 22, 28);
        
        // Vest with buckles
        graphics.fillStyle(0x1a2a55, 1);
        graphics.fillRect(x - 6, y - 25, 12, 55);
        // Buckles
        graphics.fillStyle(0xaa9944, 1);
        graphics.fillRect(x - 8, y - 15, 16, 6);
        graphics.fillRect(x - 8, y + 5, 16, 6);
        graphics.fillRect(x - 8, y + 20, 16, 6);
        
        // Ammo belt - THICK diagonal
        graphics.fillStyle(0x6a5a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 48, y + 15);
        graphics.lineTo(x + 48, y - 18);
        graphics.lineTo(x + 48, y - 5);
        graphics.lineTo(x - 48, y + 28);
        graphics.closePath();
        graphics.fillPath();
        // Brass bullets
        graphics.fillStyle(0xccaa33, 1);
        for (let i = 0; i < 9; i++) {
          const bx = x - 42 + i * 11;
          const by = y + 13 - i * 3.8;
          graphics.fillRect(bx, by, 6, 10);
          graphics.fillStyle(0xdd6633, 1);
          graphics.fillRect(bx, by + 6, 6, 4);
          graphics.fillStyle(0xccaa33, 1);
        }
        
        // HUGE arms - BLU team
        graphics.fillStyle(0x224488, 1);
        // Left arm - massive bicep
        graphics.fillCircle(x - 50, y - 15, 22);
        graphics.fillRect(x - 70, y - 20, 28, 55);
        // Right arm
        graphics.fillCircle(x + 50, y - 15, 22);
        graphics.fillRect(x + 42, y - 20, 28, 50);
        
        // Meaty hands
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x - 60, y + 38, 16);
        graphics.fillCircle(x + 55, y + 32, 16);
        // Thick fingers
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 70, y + 35, 7);
        graphics.fillCircle(x - 52, y + 48, 6);
        graphics.fillCircle(x + 65, y + 28, 7);
        graphics.fillCircle(x + 48, y + 42, 6);
        
        // Big bald head
        graphics.fillStyle(0x8a7a6a, 1);
        graphics.fillCircle(x, y - 52, 36);
        // Face
        graphics.fillStyle(0x9a8a7a, 1);
        graphics.fillCircle(x, y - 48, 30);
        // Ears
        graphics.fillStyle(0x8a7a6a, 1);
        graphics.fillCircle(x - 34, y - 50, 12);
        graphics.fillCircle(x + 34, y - 50, 12);
        
        // 5 o'clock shadow/stubble
        graphics.fillStyle(0x5a4a3a, 0.4);
        graphics.fillEllipse(x, y - 32, 26, 18);
        
        // Heavy brow ridge
        graphics.fillStyle(0x6a5a4a, 1);
        graphics.fillRect(x - 26, y - 62, 52, 12);
        
        // Angry eyebrows - thick and furrowed
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 26, y - 58);
        graphics.lineTo(x - 6, y - 52);
        graphics.lineTo(x - 26, y - 52);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 26, y - 58);
        graphics.lineTo(x + 6, y - 52);
        graphics.lineTo(x + 26, y - 52);
        graphics.closePath();
        graphics.fillPath();
        
        // Glowing ANGRY red eyes
        graphics.fillStyle(0xff0000, 0.6);
        graphics.fillCircle(x - 14, y - 50, 14);
        graphics.fillCircle(x + 14, y - 50, 14);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 14, y - 50, 9);
        graphics.fillCircle(x + 14, y - 50, 9);
        graphics.fillStyle(0xffaaaa, 1);
        graphics.fillCircle(x - 14, y - 50, 4);
        graphics.fillCircle(x + 14, y - 50, 4);
        // Eye glints
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(x - 18, y - 54, 3);
        graphics.fillCircle(x + 10, y - 54, 3);
        
        // Wide nose
        graphics.fillStyle(0x7a6a5a, 1);
        graphics.fillEllipse(x, y - 40, 14, 10);
        
        // No mouth - more menacing
        
        // MINIGUN "SASHA" - massive and iconic
        // Main body - gunmetal grey
        graphics.fillStyle(0x555555, 1);
        graphics.fillRoundedRect(x - 72, y + 30, 135, 26, 4);
        // Barrel shroud housing
        graphics.fillStyle(0x666666, 1);
        graphics.fillRoundedRect(x - 80, y + 32, 25, 22, 3);
        // Rotating barrel cluster - 6 barrels
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillCircle(x - 85, y + 43, 20);
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillCircle(x - 85, y + 43, 16);
        // Individual barrels with depth
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const bx = x - 85 + Math.cos(angle) * 10;
          const by = y + 43 + Math.sin(angle) * 10;
          graphics.fillStyle(0x222222, 1);
          graphics.fillCircle(bx, by, 4);
          graphics.fillStyle(0x111111, 1);
          graphics.fillCircle(bx, by, 2);
        }
        // Center spindle
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x - 85, y + 43, 5);
        
        // Handle grips - ergonomic
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x, y + 16, 16, 22);
        graphics.fillRect(x + 35, y + 20, 12, 18);
        // Grip texture lines
        graphics.fillStyle(0x3a2a1a, 1);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x + 2, y + 18 + i * 5, 12, 2);
        }
        
        // Ammo drum/box - big and boxy
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillRoundedRect(x + 40, y + 28, 30, 28, 5);
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRect(x + 45, y + 32, 20, 20);
        // Ammo belt feeding
        graphics.fillStyle(0x8b7355, 1);
        graphics.fillRect(x + 55, y + 38, 8, 4);
        graphics.fillRect(x + 60, y + 40, 4, 8);
        break;
        
      case 'SNIPER':
        // Sniper - aiming pose, rifle pointed at viewer
        
        // Eerie blue glow behind - signature Sniper look
        graphics.fillStyle(0x4488ff, 0.25);
        graphics.fillCircle(x, y - 10, 90);
        graphics.fillStyle(0x2266dd, 0.2);
        graphics.fillCircle(x, y - 30, 50);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillEllipse(x, y + 65, 50, 10);
        
        // Tall lean legs - slightly crouched aiming stance
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRect(x - 16, y + 12, 14, 50);
        graphics.fillRect(x + 2, y + 12, 14, 50);
        // Knee details
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillEllipse(x - 9, y + 26, 9, 7);
        graphics.fillEllipse(x + 9, y + 26, 9, 7);
        // Tall boots
        graphics.fillStyle(0x2a2a1a, 1);
        graphics.fillRoundedRect(x - 18, y + 54, 16, 14, 2);
        graphics.fillRoundedRect(x + 2, y + 54, 16, 14, 2);
        
        // Lean vest - body angled slightly - BLU team
        graphics.fillStyle(0x224488, 1);
        graphics.beginPath();
        graphics.moveTo(x - 24, y - 28);
        graphics.lineTo(x + 20, y - 28);
        graphics.lineTo(x + 16, y + 16);
        graphics.lineTo(x - 20, y + 16);
        graphics.closePath();
        graphics.fillPath();
        // Vest details
        graphics.fillStyle(0x1a3377, 1);
        graphics.fillRect(x - 3, y - 25, 4, 40);
        // Shirt collar
        graphics.fillStyle(0xaa9988, 1);
        graphics.fillRect(x - 14, y - 32, 26, 6);
        
        // Arms in aiming position - both forward - BLU team
        graphics.fillStyle(0x224488, 1);
        // Shoulders
        graphics.fillCircle(x - 24, y - 20, 12);
        graphics.fillCircle(x + 20, y - 20, 12);
        // Left arm - forward supporting rifle
        graphics.fillRect(x - 30, y - 24, 12, 14);
        // Right arm - back on trigger
        graphics.fillRect(x + 14, y - 24, 12, 14);
        
        // Hands gripping rifle (in front of body)
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 8, y - 15, 9);  // Left hand forward
        graphics.fillCircle(x + 12, y - 12, 9); // Right hand on trigger
        
        // Tall head - tilted slightly, looking down scope
        graphics.fillStyle(0xb49a7a, 1);
        graphics.fillCircle(x + 5, y - 50, 20);
        // Angular jaw
        graphics.fillStyle(0xc4aa8a, 1);
        graphics.fillEllipse(x + 5, y - 34, 15, 11);
        // Stubble
        graphics.fillStyle(0x5a4a3a, 0.5);
        graphics.fillEllipse(x + 5, y - 36, 13, 9);
        
        // SLOUCH HAT - iconic Australian style
        graphics.fillStyle(0x5a4a3a, 1);
        // Hat brim
        graphics.fillEllipse(x + 5, y - 58, 38, 10);
        // Hat crown
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRoundedRect(x - 12, y - 78, 34, 22, 4);
        // Hat band
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 12, y - 60, 34, 5);
        // Hat dent
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 3, y - 78, 16, 6);
        
        // Blue visor (glowing) - spans across both eyes
        // Visor frame
        graphics.fillStyle(0x222222, 1);
        graphics.fillRoundedRect(x - 14, y - 58, 38, 14, 4);
        // Visor glass - glowing blue
        graphics.fillStyle(0x00aaff, 0.3);
        graphics.fillRoundedRect(x - 12, y - 56, 34, 10, 3);
        graphics.fillStyle(0x00aaff, 0.7);
        graphics.fillRoundedRect(x - 10, y - 54, 30, 6, 2);
        // Bright center glow
        graphics.fillStyle(0x00aaff, 1);
        graphics.fillRoundedRect(x - 6, y - 53, 22, 4, 2);
        // Outer glow effect
        graphics.fillStyle(0x00aaff, 0.2);
        graphics.fillRoundedRect(x - 16, y - 60, 42, 18, 5);
        
        // Slight focused expression
        graphics.fillStyle(0x8a6a5a, 1);
        graphics.fillRect(x - 2, y - 38, 14, 2);
        
        // SNIPER RIFLE - AIMED AT VIEWER (foreshortened perspective)
        // Rifle body (short from this angle)
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRoundedRect(x - 18, y - 8, 36, 20, 4);
        // Stock behind (visible part)
        graphics.fillStyle(0x5a4a3a, 1);
        graphics.fillRoundedRect(x + 14, y - 4, 20, 14, 3);
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x + 30, y - 2, 8, 10);
        
        // SCOPE - prominent, aimed at viewer
        graphics.fillStyle(0x2a2a2a, 1);
        graphics.fillCircle(x - 5, y - 22, 18);
        graphics.fillStyle(0x222222, 1);
        graphics.fillCircle(x - 5, y - 22, 14);
        // Scope lens - GLOWING BLUE (aimed at you!)
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x - 5, y - 22, 10);
        graphics.fillStyle(0x4488ff, 0.4);
        graphics.fillCircle(x - 5, y - 22, 10);
        graphics.fillStyle(0x4488ff, 1);
        graphics.fillCircle(x - 5, y - 22, 6);
        graphics.fillStyle(0x88ccff, 1);
        graphics.fillCircle(x - 7, y - 24, 3);
        // Scope crosshair hint
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillRect(x - 6, y - 28, 2, 12);
        graphics.fillRect(x - 11, y - 23, 12, 2);
        
        // Barrel - coming toward viewer (foreshortened)
        graphics.fillStyle(0x2a2a2a, 1);
        graphics.fillCircle(x - 5, y + 8, 8);
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x - 5, y + 8, 5);
        // Muzzle hole (dark, ominous)
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(x - 5, y + 8, 3);
        
        // Trigger guard visible
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 5, y, 8, 10);
        
        // Kukri knife on belt (iconic accessory)
        graphics.fillStyle(0x888888, 1);
        graphics.fillRect(x - 25, y + 8, 16, 4);
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x - 28, y + 6, 5, 8);
        break;
        
      case 'PYRO':
        // Pyro - Ghostly floating gas mask with eerie fire glow
        
        // Intense fire glow behind (larger, more dramatic)
        graphics.fillStyle(0xff2200, 0.08);
        graphics.fillCircle(x, y, 90);
        graphics.fillStyle(0xff4400, 0.12);
        graphics.fillCircle(x, y, 70);
        graphics.fillStyle(0xff6600, 0.18);
        graphics.fillCircle(x, y, 50);
        graphics.fillStyle(0xff8800, 0.25);
        graphics.fillCircle(x, y, 35);
        
        // Ghostly wisps rising (fire-like)
        graphics.fillStyle(0xff6600, 0.15);
        graphics.fillEllipse(x - 25, y - 45, 12, 30);
        graphics.fillEllipse(x + 30, y - 50, 10, 25);
        graphics.fillEllipse(x + 5, y - 55, 8, 20);
        graphics.fillStyle(0xff4400, 0.1);
        graphics.fillEllipse(x - 35, y - 30, 15, 40);
        graphics.fillEllipse(x + 40, y - 35, 12, 35);
        
        // Main gas mask shape - dark silhouette
        graphics.fillStyle(0x1a1a1a, 0.95);
        graphics.fillEllipse(x, y, 55, 65);
        
        // Mask details - filter/muzzle area
        graphics.fillStyle(0x222222, 1);
        graphics.fillRoundedRect(x - 18, y + 8, 36, 28, 8);
        
        // Eye holes - glowing white with orange inner
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillCircle(x - 15, y - 12, 16);
        graphics.fillCircle(x + 15, y - 12, 16);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(x - 15, y - 12, 12);
        graphics.fillCircle(x + 15, y - 12, 12);
        graphics.fillStyle(0xff6600, 0.9);
        graphics.fillCircle(x - 15, y - 12, 7);
        graphics.fillCircle(x + 15, y - 12, 7);
        graphics.fillStyle(0xff2200, 1);
        graphics.fillCircle(x - 15, y - 12, 4);
        graphics.fillCircle(x + 15, y - 12, 4);
        
        // Filter canister details
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x, y + 22, 12);
        graphics.fillStyle(0x444444, 1);
        graphics.fillCircle(x, y + 22, 8);
        // Vent lines on filter
        graphics.lineStyle(2, 0x555555, 1);
        graphics.lineBetween(x - 6, y + 18, x - 6, y + 26);
        graphics.lineBetween(x, y + 16, x, y + 28);
        graphics.lineBetween(x + 6, y + 18, x + 6, y + 26);
        
        // Straps going back (ghostly fade)
        graphics.lineStyle(4, 0x333333, 0.6);
        graphics.lineBetween(x - 28, y - 5, x - 45, y - 20);
        graphics.lineBetween(x + 28, y - 5, x + 45, y - 20);
        
        // Hood outline (very faint)
        graphics.lineStyle(2, 0x222222, 0.5);
        graphics.beginPath();
        graphics.arc(x, y - 20, 45, Math.PI + 0.3, -0.3, false);
        graphics.strokePath();
        break;
        
    }
  }
  
  private showExtras(): void {
    // Regenerate the Spy card with a new random disguise each time
    this.regenerateSpyCard();
    this.extrasContainer.setVisible(true);
  }
  
  private hideExtras(): void {
    this.extrasContainer.setVisible(false);
  }
  
  // Store spy card elements so we can regenerate them
  private spyCardElements: Phaser.GameObjects.GameObject[] = [];
  
  private regenerateSpyCard(): void {
    // Remove old spy card elements
    this.spyCardElements.forEach(el => el.destroy());
    this.spyCardElements = [];
    
    // Pick a random character to disguise as
    const characters = [
      { name: 'SCOUT', color: 0x9966cc },  // Purple
      { name: 'SOLDIER', color: 0xaa5544 },
      { name: 'DEMOMAN', color: 0x44cc44 },
      { name: 'HEAVY', color: 0xaa7744 },
      { name: 'SNIPER', color: 0x5588cc },
    ];
    const disguise = characters[Math.floor(Math.random() * characters.length)];
    
    // Create new spy card at position (860, 480) - third in bottom row (centered)
    const x = 860, y = 480;
    
    const cardBg = this.add.rectangle(x, y, 180, 180, 0x050508);
    cardBg.setStrokeStyle(2, 0x333333);
    this.extrasContainer.add(cardBg);
    this.spyCardElements.push(cardBg);
    
    const silhouette = this.add.graphics();
    this.drawCharacterSilhouette(silhouette, x, y - 15, disguise.name, disguise.color);
    this.extrasContainer.add(silhouette);
    this.spyCardElements.push(silhouette);
    
    const nameText = this.add.text(x, y + 65, '???', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#444444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.extrasContainer.add(nameText);
    this.spyCardElements.push(nameText);
    
    const nightBadge = this.add.text(x + 75, y - 75, 'N5', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#444444',
      backgroundColor: '#111111',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5);
    this.extrasContainer.add(nightBadge);
    this.spyCardElements.push(nightBadge);
  }
}
