import Phaser from 'phaser';

/**
 * BootScene - Main Menu / Title Screen
 * 
 * Displays the game title, night selection, and allows player to start the game.
 */
export class BootScene extends Phaser.Scene {
  private selectedNight: number = 1;
  private tutorialContainer!: Phaser.GameObjects.Container;
  private extrasContainer!: Phaser.GameObjects.Container;
  
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
    
    // ===== TITLE =====
    // Title glow
    this.add.text(width / 2, 110, 'TWOFORT NIGHTS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff4400',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.25).setScale(1.03);
    
    this.add.text(width / 2, 110, 'TWOFORT NIGHTS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Subtitle
    this.add.text(width / 2, 165, 'A TF2-Inspired FNAF Experience', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#666688',
    }).setOrigin(0.5);
    
    // Decorative line under title
    const titleLine = this.add.graphics();
    titleLine.lineStyle(2, 0xff6600, 0.5);
    titleLine.lineBetween(width / 2 - 200, 185, width / 2 + 200, 185);
    titleLine.fillStyle(0xff6600, 0.8);
    titleLine.fillCircle(width / 2, 185, 4);
    
    // ===== NIGHT SELECTION =====
    this.add.text(width / 2, 220, 'SELECT NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#66aa66',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Start button text (declared early so night buttons can reference it)
    let startText: Phaser.GameObjects.Text;
    
    // Night buttons (1-5 regular, 6 is custom night) - centered
    const nightButtons: Phaser.GameObjects.Container[] = [];
    const nights = [1, 2, 3, 4, 5, 6];
    const totalWidth = nights.length * 92 - 12;
    const buttonStartX = (width - totalWidth) / 2 + 40;
    const buttonY = 285;
    
    // Custom night enemy toggles (all OFF by default for QoL)
    const customNightEnemies = {
      scout: false,
      soldier: false,
      demoman: false,
      heavy: false,
      sniper: false,
      spy: false,
    };
    
    // Custom night UI container (created later, shown when N6 selected)
    let customNightUI: Phaser.GameObjects.Container | null = null;
    
    nights.forEach((night, index) => {
      const x = buttonStartX + index * 92;
      const isCustomNight = night === 6;
      const isUnlocked = night <= 6;
      
      // All nights use same green color scheme
      const glowColor = 0x44ff44;
      const bgColor = 0x112211;
      const strokeColor = 0x336633;
      const textColor = '#44aa44';
      
      // Button glow (for selected)
      const btnGlow = this.add.rectangle(x, buttonY, 85, 70, glowColor, 0);
      
      // Button background
      const btnBg = this.add.rectangle(x, buttonY, 80, 65, isUnlocked ? bgColor : 0x111111);
      btnBg.setStrokeStyle(2, isUnlocked ? strokeColor : 0x222222);
      
      // Night number or "C" for custom
      const nightNum = this.add.text(x, buttonY - 8, isCustomNight ? 'C' : `${night}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '32px',
        color: isUnlocked ? textColor : '#333333',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      // Label
      const label = this.add.text(x, buttonY + 22, isCustomNight ? 'CUSTOM' : 'NIGHT', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: isUnlocked ? '#336633' : '#222222',
      }).setOrigin(0.5);
      
      const container = this.add.container(0, 0, [btnGlow, btnBg, nightNum, label]);
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
    
    // ===== QUICK CONTROLS =====
    const controlsBg = this.add.rectangle(width / 2, 400, 550, 90, 0x0a0a15, 0.9);
    controlsBg.setStrokeStyle(1, 0x333355);
    
    const controls = [
      ['F', 'Wrangler', 'A/D', 'Aim', 'SPACE', 'Fire'],
      ['TAB', 'Cameras', 'R', 'Build/Repair', 'ESC', 'Pause'],
    ];
    
    controls.forEach((row, rowIndex) => {
      for (let i = 0; i < row.length; i += 2) {
        const x = width / 2 - 220 + (i / 2) * 150;
        const y = 375 + rowIndex * 28;
        
        // Key
        const keyBg = this.add.rectangle(x, y, 40, 20, 0x1a1a2a);
        keyBg.setStrokeStyle(1, 0x444466);
        this.add.text(x, y, row[i], {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#88aacc',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        
        // Action
        this.add.text(x + 55, y, row[i + 1], {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#667788',
        }).setOrigin(0, 0.5);
      }
    });
    
    // ===== CUSTOM NIGHT UI =====
    customNightUI = this.add.container(width / 2, 460);
    customNightUI.setVisible(false);
    
    // Sleek panel
    const customBg = this.add.rectangle(0, 0, 540, 105, 0x0a0f0a, 0.95);
    customBg.setStrokeStyle(3, 0x44aa44);
    customNightUI.add(customBg);
    
    // Inner border for depth
    const customInner = this.add.rectangle(0, 0, 530, 95, 0x000000, 0);
    customInner.setStrokeStyle(1, 0x336633);
    customNightUI.add(customInner);
    
    const customTitle = this.add.text(0, -42, '◆ CONFIGURE THREATS ◆', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#66ff66',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    customNightUI.add(customTitle);
    
    const enemyTypes = ['scout', 'soldier', 'demoman', 'heavy', 'sniper', 'spy'] as const;
    const enemyColors: Record<string, number> = {
      scout: 0x3366aa,
      soldier: 0x224488,
      demoman: 0x00aa33,
      heavy: 0x883333,
      sniper: 0x4488cc,
      spy: 0x444466,
    };
    const enemyLabels: Record<string, string> = {
      scout: 'SCOUT',
      soldier: 'SOLDIER',
      demoman: 'DEMO',
      heavy: 'HEAVY',
      sniper: 'SNIPER',
      spy: 'SPY',
    };
    
    enemyTypes.forEach((enemy, i) => {
      const ex = -225 + i * 85;
      const ey = 5;
      
      // Toggle button with better styling - starts OFF by default
      const toggleBg = this.add.rectangle(ex, ey, 72, 58, enemyColors[enemy], 0.4);
      toggleBg.setStrokeStyle(2, 0x333333);
      toggleBg.setInteractive({ useHandCursor: true });
      
      const toggleLabel = this.add.text(ex, ey - 14, enemyLabels[enemy], {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      const toggleStatus = this.add.text(ex, ey + 14, 'OFF', {
        fontFamily: 'Courier New, monospace',
        fontSize: '15px',
        color: '#666666',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      
      toggleBg.on('pointerdown', () => {
        customNightEnemies[enemy] = !customNightEnemies[enemy];
        if (customNightEnemies[enemy]) {
          toggleBg.setStrokeStyle(2, 0x44ff44);
          toggleBg.setAlpha(1);
          toggleStatus.setText('ON');
          toggleStatus.setColor('#44ff44');
        } else {
          toggleBg.setStrokeStyle(2, 0x333333);
          toggleBg.setAlpha(0.4);
          toggleStatus.setText('OFF');
          toggleStatus.setColor('#666666');
        }
      });
      
      customNightUI!.add([toggleBg, toggleLabel, toggleStatus]);
    });
    
    // ===== START BUTTON =====
    const startBtnGlow = this.add.rectangle(width / 2, 530, 295, 60, 0x44ff44, 0.1);
    const startBtnBg = this.add.rectangle(width / 2, 530, 280, 55, 0x1a331a);
    startBtnBg.setStrokeStyle(3, 0x44aa44);
    startBtnBg.setInteractive({ useHandCursor: true });
    
    startText = this.add.text(width / 2, 530, '▶ START NIGHT 1', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#66ff66',
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
    
    // ===== HOW TO PLAY =====
    const tutorialBtn = this.add.text(width / 2 - 100, 580, '[ ? ]  HOW TO PLAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#557799',
    }).setOrigin(0.5);
    tutorialBtn.setInteractive({ useHandCursor: true });
    
    tutorialBtn.on('pointerover', () => tutorialBtn.setColor('#88bbdd'));
    tutorialBtn.on('pointerout', () => tutorialBtn.setColor('#557799'));
    tutorialBtn.on('pointerdown', () => this.showTutorial());
    
    // ===== EXTRAS =====
    const extrasBtn = this.add.text(width / 2 + 100, 580, '[ ★ ]  EXTRAS', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#997755',
    }).setOrigin(0.5);
    extrasBtn.setInteractive({ useHandCursor: true });
    
    extrasBtn.on('pointerover', () => extrasBtn.setColor('#ddaa88'));
    extrasBtn.on('pointerout', () => extrasBtn.setColor('#997755'));
    extrasBtn.on('pointerdown', () => this.showExtras());
    
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
    
    // Main panel
    const panelWidth = 680;
    const panelHeight = 440;
    const panelX = width / 2;
    const panelY = height / 2;
    
    // Panel background
    const panelBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x08080c);
    panelBg.setStrokeStyle(2, 0x334455);
    this.tutorialContainer.add(panelBg);
    
    // Title
    const titleText = this.add.text(panelX, panelY - panelHeight/2 + 25, '— SURVIVAL GUIDE —', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tutorialContainer.add(titleText);
    
    // Divider under title
    const divider = this.add.rectangle(panelX, panelY - panelHeight/2 + 45, panelWidth - 40, 1, 0x334455);
    this.tutorialContainer.add(divider);
    
    // Layout
    const leftX = panelX - 165;
    const rightX = panelX + 170;
    const contentY = panelY - panelHeight/2 + 60;
    
    // ===== LEFT COLUMN =====
    let y = contentY;
    
    // BASICS
    this.addSmallHeader(leftX - 140, y, 'BASICS', 0x44ff44);
    y += 20;
    this.addLine(leftX - 140, y, 'Survive 12AM → 6AM');
    y += 15;
    this.addLine(leftX - 140, y, 'Defend Intel Room from enemies');
    y += 28;
    
    // CONTROLS
    this.addSmallHeader(leftX - 140, y, 'CONTROLS', 0x4488ff);
    y += 20;
    const controls = [
      ['F', 'Wrangler ON/OFF'],
      ['A/D', 'Aim Left/Right'],
      ['SPACE', 'Fire (50 metal)'],
      ['TAB', 'Open Cameras'],
      ['R', 'Build/Repair/Upgrade'],
    ];
    controls.forEach(([key, action]) => {
      this.addKeyAction(leftX - 140, y, key, action);
      y += 16;
    });
    y += 18;
    
    // DEFENSE
    this.addSmallHeader(leftX - 140, y, 'SENTRY DEFENSE', 0xffaa44);
    y += 20;
    this.addLine(leftX - 140, y, 'Wrangler ON → You aim & fire', '#aaaaaa');
    y += 15;
    this.addLine(leftX - 140, y, 'Wrangler OFF → Auto-kills', '#aaaaaa');
    y += 15;
    this.addLine(leftX - 140, y, '  (but sentry is destroyed)', '#777777');
    y += 15;
    this.addLine(leftX - 140, y, 'No Sentry = YOU DIE', '#ff6666');
    y += 25;
    
    // Star rating at bottom left
    this.addLine(leftX - 140, y, '⭐ Rating = Sentry Lvl at 6AM', '#ffcc44');
    
    // ===== RIGHT COLUMN =====
    y = contentY;
    
    // ENEMIES
    this.addSmallHeader(rightX - 140, y, 'ENEMIES', 0xff4444);
    y += 22;
    
    const enemies = [
      { name: 'SCOUT', color: '#4488ff', info: 'Fast · Left door' },
      { name: 'SOLDIER', color: '#886644', info: 'Rockets · Right door' },
      { name: 'DEMO', color: '#44ff44', info: 'N2+ Eye = incoming!' },
      { name: 'HEAVY', color: '#ff4444', info: 'N3+ Lure only!' },
      { name: 'SNIPER', color: '#4477ff', info: 'N4+ Lure or 2 shots' },
      { name: 'SPY', color: '#aa6644', info: 'N5+ See below' },
    ];
    
    enemies.forEach(enemy => {
      const dot = this.add.circle(rightX - 140, y + 5, 4, parseInt(enemy.color.slice(1), 16));
      this.tutorialContainer.add(dot);
      this.addLine(rightX - 128, y, enemy.name, enemy.color, true);
      this.addLine(rightX - 55, y, enemy.info, '#777788');
      y += 18;
    });
    y += 12;
    
    // NIGHT 3+ box
    const n3Box = this.add.rectangle(rightX, y + 28, 290, 48, 0x101018);
    n3Box.setStrokeStyle(1, 0x6644aa);
    this.tutorialContainer.add(n3Box);
    this.addLine(rightX - 135, y + 12, '> N3+ TELEPORTER', '#aa88cc', true);
    this.addLine(rightX - 135, y + 28, 'Place LURES (50m)', '#8877aa');
    this.addLine(rightX - 135, y + 42, 'Heavy/Sniper lured 3x faster', '#8877aa');
    y += 68;
    
    // SPY box
    const spyBox = this.add.rectangle(rightX, y + 32, 290, 55, 0x18120c);
    spyBox.setStrokeStyle(1, 0xaa7744);
    this.tutorialContainer.add(spyBox);
    this.addLine(rightX - 135, y + 10, '> SPY: Two modes (not both!)', '#ddaa77', true);
    this.addLine(rightX - 135, y + 26, '• DISGUISE: Fake enemy on cams', '#aa9966');
    this.addLine(rightX - 135, y + 40, '• SAP: May sap sentry if you TP', '#aa9966');
    this.addLine(rightX - 135, y + 54, 'Sapper? Press SPACE x2!', '#ffcc88');
    
    // Close instruction
    const closeText = this.add.text(panelX, panelY + panelHeight/2 - 15, '[ click to close ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#444455',
    }).setOrigin(0.5);
    this.tutorialContainer.add(closeText);
    
    // Close on click
    overlay.on('pointerdown', () => this.hideTutorial());
  }
  
  private addSmallHeader(x: number, y: number, text: string, color: number): void {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const header = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: colorHex,
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(header);
  }
  
  private addLine(x: number, y: number, text: string, color: string = '#999999', bold: boolean = false): void {
    const line = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: color,
      fontStyle: bold ? 'bold' : 'normal',
    });
    this.tutorialContainer.add(line);
  }
  
  private addKeyAction(x: number, y: number, key: string, action: string): void {
    const keyText = this.add.text(x, y, `[${key}]`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#6699bb',
      fontStyle: 'bold',
    });
    this.tutorialContainer.add(keyText);
    
    const actionText = this.add.text(x + 55, y, action, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
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
    
    // All 5 characters
    const characters = [
      { name: 'SCOUT', color: 0x5599dd, desc: 'Fast Attacker', night: 1 },
      { name: 'SOLDIER', color: 0xaa5544, desc: 'Siege Specialist', night: 1 },
      { name: 'DEMOMAN', color: 0x44cc44, desc: 'Ghostly Charger', night: 2 },
      { name: 'HEAVY', color: 0xaa7744, desc: 'Unstoppable Tank', night: 3 },
      { name: 'SNIPER', color: 0x5588cc, desc: 'Long-Range Threat', night: 4 },
    ];
    
    // Draw 3 cards in first row (centered on screen width 1280)
    // Card width = 180, spacing = 40, total = 180*3 + 40*2 = 620
    // Screen center = 640, so first card center = 640 - 220 = 420
    for (let i = 0; i < 3; i++) {
      const x = 420 + i * 220;  // 420, 640, 860
      this.drawCharacterCard(x, 250, characters[i].name, characters[i].color, characters[i].desc, characters[i].night);
    }
    
    // Draw 2 cards in second row (centered)
    // Two cards = 180*2 + 40 = 400, so offset from center = 200
    for (let i = 3; i < 5; i++) {
      const x = 530 + (i - 3) * 220;  // 530, 750
      this.drawCharacterCard(x, 480, characters[i].name, characters[i].color, characters[i].desc, characters[i].night);
    }
  }
  
  private drawCharacterCard(x: number, y: number, name: string, color: number, desc: string, night: number): void {
    // Card background
    const cardBg = this.add.rectangle(x, y, 180, 180, 0x0a0a15);
    cardBg.setStrokeStyle(2, color);
    this.extrasContainer.add(cardBg);
    
    // Character silhouette
    const silhouette = this.add.graphics();
    this.drawCharacterSilhouette(silhouette, x, y - 15, name, color);
    this.extrasContainer.add(silhouette);
    
    // Name
    const nameText = this.add.text(x, y + 65, name, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.extrasContainer.add(nameText);
    
    // Description
    const descText = this.add.text(x, y + 82, desc, {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#666677',
    }).setOrigin(0.5);
    this.extrasContainer.add(descText);
    
    // Night badge
    const nightBadge = this.add.text(x + 75, y - 75, `N${night}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#888888',
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
        
    }
  }
  
  private showExtras(): void {
    this.extrasContainer.setVisible(true);
  }
  
  private hideExtras(): void {
    this.extrasContainer.setVisible(false);
  }
}
