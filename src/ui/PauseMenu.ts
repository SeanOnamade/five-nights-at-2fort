import Phaser from 'phaser';

/** Actions triggered by the pause menu buttons; implemented by GameScene. */
export interface PauseMenuCallbacks {
  onResume(): void;
  onRestart(): void;
  onMainMenu(): void;
  onGiveUp(): void;
}

/**
 * Pause menu overlay: resume/restart/main-menu buttons, optional Give Up button
 * (endless Night 6), and a random gameplay hint. Extracted from GameScene.
 */
export class PauseMenu {
  private container!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;

  // Hints for pause menu
  private readonly hints: string[] = [
    // User-provided hints
    "Demoman can be stalled by watching his head!",
    "Only Scout, Soldier, Pyro, Sniper, and Demoman's body show up in the Wrangler light.",
    "Scout is the fastest of the mercs.",
    "Sniper moves at random!",
    "Spy can disguise as any enemy except Pyro! When disguised, he won't attempt to sap your sentry!",
    "Deterring Demoman's charge at the last second provides bonus metal! Test your luck!",
    "Heavy's footsteps get louder the closer he is to Intel!",
    "Press Space twice to remove a Sapper!",
    "Spy and Demoman's head will not attack you when teleported.",
    "If you don't have the metal to ward off an enemy, unwrangle your Sentry before they attack to save yourself!",
    "Spy switches mode every hour.",
    "You can cancel a teleport by clicking the button again.",
    "When teleporting, if an enemy is in an adjacent room, they will hear you and approach.",
    "Demo will never begin his attack while you're watching him.",
    // Additional hints
    "One sentry attack can affect multiple enemies.",
    "Heavy will destroy your camera if you stare too long. Sniper will headshot you through it!",
    "Lures can distract certain enemies, buying you precious time!",
    "Metal regenerates over time -- manage it wisely!",
    "Sniper requires 2 shots to repel.",
    "When Heavy reaches the intel room, you have very little time to react!",
    "Pyro blocks doorways until you shine the Wrangler light on him!",
    "Pyro reflects sentry shots! Use the Wrangler light to drive him away.",
  ];

  constructor(
    private scene: Phaser.Scene,
    private callbacks: PauseMenuCallbacks,
  ) {}

  /**
   * Create the pause menu UI
   * @param showGiveUp - Adds the Give Up button (endless Night 6 only)
   */
  create(showGiveUp: boolean): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(200);
    
    // Dark overlay
    const overlay = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
    this.container.add(overlay);
    
    // Main pause panel (center) - taller for endless Night 6 to fit Give Up button
    const panelHeight = showGiveUp ? 420 : 350;
    const panel = this.scene.add.rectangle(640, 360, 400, panelHeight, 0x1a1a2a);
    panel.setStrokeStyle(3, 0xff6600);
    this.container.add(panel);
    
    // Title
    const title = this.scene.add.text(640, 220, 'PAUSED', {
      fontFamily: 'Courier New, monospace',
      fontSize: '48px',
      color: '#ff6600',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Buttons Y position
    const buttonsStartY = 310;
    
    // Resume button
    const resumeBtn = this.scene.add.rectangle(640, buttonsStartY, 250, 45, 0x224422);
    resumeBtn.setStrokeStyle(2, 0x44aa44);
    resumeBtn.setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerover', () => resumeBtn.setFillStyle(0x336633));
    resumeBtn.on('pointerout', () => resumeBtn.setFillStyle(0x224422));
    resumeBtn.on('pointerdown', () => this.callbacks.onResume());
    this.container.add(resumeBtn);
    
    const resumeText = this.scene.add.text(640, buttonsStartY, 'RESUME', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#88ff88',
    }).setOrigin(0.5);
    this.container.add(resumeText);
    
    // Restart button
    const restartBtn = this.scene.add.rectangle(640, buttonsStartY + 55, 250, 45, 0x442222);
    restartBtn.setStrokeStyle(2, 0xaa4444);
    restartBtn.setInteractive({ useHandCursor: true });
    restartBtn.on('pointerover', () => restartBtn.setFillStyle(0x663333));
    restartBtn.on('pointerout', () => restartBtn.setFillStyle(0x442222));
    restartBtn.on('pointerdown', () => this.callbacks.onRestart());
    this.container.add(restartBtn);
    
    const restartText = this.scene.add.text(640, buttonsStartY + 55, 'RESTART NIGHT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#ff8888',
    }).setOrigin(0.5);
    this.container.add(restartText);
    
    // Main menu button
    const menuBtn = this.scene.add.rectangle(640, buttonsStartY + 110, 250, 45, 0x222244);
    menuBtn.setStrokeStyle(2, 0x4444aa);
    menuBtn.setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x333366));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x222244));
    menuBtn.on('pointerdown', () => {
      this.callbacks.onMainMenu();
    });
    this.container.add(menuBtn);
    
    const menuText = this.scene.add.text(640, buttonsStartY + 110, 'MAIN MENU', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#8888ff',
    }).setOrigin(0.5);
    this.container.add(menuText);
    
    // Give Up button (Endless Night 6 only) - Pyro jumpscare then dark ending
    if (showGiveUp) {
      const giveUpBtn = this.scene.add.rectangle(640, buttonsStartY + 165, 250, 45, 0x442244);
      giveUpBtn.setStrokeStyle(2, 0xaa44aa);
      giveUpBtn.setInteractive({ useHandCursor: true });
      giveUpBtn.on('pointerover', () => giveUpBtn.setFillStyle(0x663366));
      giveUpBtn.on('pointerout', () => giveUpBtn.setFillStyle(0x442244));
      giveUpBtn.on('pointerdown', () => this.callbacks.onGiveUp());
      this.container.add(giveUpBtn);
      
      const giveUpText = this.scene.add.text(640, buttonsStartY + 165, 'GIVE UP', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#ff88ff',
      }).setOrigin(0.5);
      this.container.add(giveUpText);
    }
    
    // Hint background (bottom)
    const hintBg = this.scene.add.rectangle(640, 620, 500, 55, 0x0a0a14, 0.95);
    hintBg.setStrokeStyle(1, 0x333344);
    this.container.add(hintBg);
    
    // Hint text (random hint shown each pause)
    this.hintText = this.scene.add.text(640, 620, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#cccccc',
      fontStyle: 'italic',
      wordWrap: { width: 470 },
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.hintText);
  }

  setVisible(visible: boolean): void {
    this.container?.setVisible(visible);
  }

  /** Pick and display a random gameplay hint (called when pausing). */
  showRandomHint(): void {
    const randomHint = this.hints[Math.floor(Math.random() * this.hints.length)];
    this.hintText.setText(randomHint);
  }
}
