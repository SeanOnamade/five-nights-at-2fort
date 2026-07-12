import Phaser from 'phaser';
import { TerminalOverlay } from '../../ui/kit/overlay';
import { PALETTE, terminalStyle } from '../../ui/kit/theme';
import { playMenuButtonSound, playMenuHoverSound } from '../../utils/menuSounds';

interface ManualPage {
  id: string;
  tab: string;
  build(container: Phaser.GameObjects.Container, x: number, y: number): void;
}

/**
 * "Survival Manual" — the How to Play overlay, restructured into tabbed
 * pages (Basics / Controls / Enemies) instead of one dense two-column wall.
 */
export class TutorialOverlay extends TerminalOverlay {
  private pages: Array<{ container: Phaser.GameObjects.Container; tabText: Phaser.GameObjects.Text }> = [];
  private activePage = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 'SURVIVAL MANUAL');
  }

  create(): void {
    super.create(860, 600, 100);
  }

  protected buildContent(): void {
    const contentX = this.panelX - this.panelWidth / 2 + 50;
    const contentY = this.panelY - this.panelHeight / 2 + 130;

    const pages: ManualPage[] = [
      { id: 'basics', tab: 'BASICS', build: (c, x, y) => this.buildBasics(c, x, y) },
      { id: 'controls', tab: 'CONTROLS', build: (c, x, y) => this.buildControls(c, x, y) },
      { id: 'enemies', tab: 'ENEMIES', build: (c, x, y) => this.buildEnemies(c, x, y) },
    ];

    // Tab row
    const tabY = this.panelY - this.panelHeight / 2 + 78;
    let tabX = contentX;
    pages.forEach((page, i) => {
      const tabText = this.scene.add
        .text(tabX, tabY, `[ ${page.tab} ]`, terminalStyle(24, PALETTE.amberDimCss))
        .setOrigin(0, 0.5);
      tabText.setInteractive({ useHandCursor: true });
      tabText.on('pointerover', () => {
        if (this.activePage !== i) {
          playMenuHoverSound();
          tabText.setColor(PALETTE.amberCss);
        }
      });
      tabText.on('pointerout', () => this.refreshTabs());
      tabText.on('pointerdown', () => {
        playMenuButtonSound();
        this.setPage(i);
      });
      this.add(tabText);
      tabX += tabText.width + 30;

      const pageContainer = this.scene.add.container(0, 0);
      pageContainer.setVisible(i === 0);
      page.build(pageContainer, contentX, contentY);
      this.add(pageContainer);

      this.pages.push({ container: pageContainer, tabText });
    });

    this.refreshTabs();
  }

  private setPage(i: number): void {
    this.activePage = i;
    this.pages.forEach((p, idx) => p.container.setVisible(idx === i));
    this.refreshTabs();
  }

  private refreshTabs(): void {
    this.pages.forEach((p, idx) => {
      p.tabText.setColor(idx === this.activePage ? PALETTE.creamCss : PALETTE.amberDimCss);
    });
  }

  // ── Page builders ────────────────────────────────────────────────

  private line(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    color: string = PALETTE.amberDimCss,
    size = 21
  ): void {
    container.add(this.scene.add.text(x, y, text, terminalStyle(size, color)));
  }

  private header(container: Phaser.GameObjects.Container, x: number, y: number, text: string): void {
    container.add(this.scene.add.text(x, y, text, terminalStyle(23, PALETTE.creamCss)));
    container.add(this.scene.add.rectangle(x + 170, y + 30, 340, 1, PALETTE.amberFaint).setOrigin(0.5, 0.5));
  }

  private buildBasics(c: Phaser.GameObjects.Container, x: number, y: number): void {
    const colR = x + 400;
    let yy = y;
    this.header(c, x, yy, 'THE JOB');
    yy += 40;
    this.line(c, x, yy, 'Survive 12 AM to 6 AM.'); yy += 26;
    this.line(c, x, yy, 'Defend the Intel Room from the mercs.'); yy += 26;
    this.line(c, x, yy, 'No sentry when they get in = YOU DIE.', PALETTE.alertCss); yy += 44;

    this.header(c, x, yy, 'SENTRY DEFENSE');
    yy += 40;
    this.line(c, x, yy, 'Wrangler ON  — you aim and fire (50 metal/shot).'); yy += 26;
    this.line(c, x, yy, 'Wrangler OFF — auto-kills one attacker,'); yy += 26;
    this.line(c, x, yy, '               but the sentry is destroyed.'); yy += 26;
    this.line(c, x, yy, 'Star rating = sentry level at 6 AM.', PALETTE.creamCss);

    let ry = y;
    this.header(c, colR, ry, 'METAL');
    ry += 40;
    this.line(c, colR, ry, 'Dispenser generates metal over time.'); ry += 26;
    this.line(c, colR, ry, 'Spend it on shots, repairs, builds'); ry += 26;
    this.line(c, colR, ry, 'and upgrades. Manage it wisely.'); ry += 44;

    this.header(c, colR, ry, 'NIGHT 3+: TELEPORTER');
    ry += 40;
    this.line(c, colR, ry, 'Teleport to other rooms and place'); ry += 26;
    this.line(c, colR, ry, 'LURES (50 metal) to draw certain'); ry += 26;
    this.line(c, colR, ry, 'enemies away from the Intel Room.'); ry += 26;
    this.line(c, colR, ry, 'Enemies nearby will hear you teleport!');
  }

  private buildControls(c: Phaser.GameObjects.Container, x: number, y: number): void {
    const controls: Array<[string, string]> = [
      ['F', 'Toggle Wrangler ON/OFF'],
      ['A / D', 'Aim left / right doorway (shines light)'],
      ['SPACE', 'Fire wrangled sentry (50 metal)'],
      ['SPACE x2', 'Remove a Spy sapper'],
      ['TAB', 'Open / close cameras'],
      ['R', 'Build / repair / upgrade sentry'],
      ['Q', 'Flip view (Merasmus)'],
      ['ESC', 'Pause'],
    ];
    let yy = y;
    this.header(c, x, yy, 'KEYBOARD');
    yy += 44;
    controls.forEach(([key, action]) => {
      this.line(c, x, yy, `[${key}]`, PALETTE.creamCss, 22);
      this.line(c, x + 150, yy, action, PALETTE.amberDimCss, 22);
      yy += 32;
    });
    yy += 12;
    this.line(c, x, yy, 'On mobile: touch zones on the screen edges aim,', PALETTE.amberDimCss, 19);
    yy += 24;
    this.line(c, x, yy, 'on-screen buttons handle cameras and actions.', PALETTE.amberDimCss, 19);
  }

  private buildEnemies(c: Phaser.GameObjects.Container, x: number, y: number): void {
    const roster: Array<{ name: string; night: string; info: string; color: number }> = [
      { name: 'SCOUT', night: 'N1', info: 'Fast. Left hallway.', color: 0x9966cc },
      { name: 'SOLDIER', night: 'N1', info: 'Sieges with rockets. Right hallway.', color: 0xaa8866 },
      { name: 'DEMOMAN', night: 'N2', info: 'Glowing eye = charge incoming. Watch him to stall.', color: 0x44cc44 },
      { name: 'HEAVY', night: 'N3', info: 'Cannot be shot — lure him away!', color: 0xcc4444 },
      { name: 'SNIPER', night: 'N4', info: 'Moves at random. Lure, or 2 shots.', color: 0x44aaff },
      { name: 'SPY', night: 'N4', info: 'DISGUISE: fakes enemies on cams. SAP: saps if you teleport away. Sapper on? SPACE x2.', color: 0xcc8855 },
      {
        name: 'PYRO',
        night: 'N5',
        info: 'Invisible in rooms — listen for the crackle. Hallway: light him 1.5s (he reflects sentry shots!). In YOUR room: match strike = ~10 seconds to teleport away or burn.',
        color: 0xff6622,
      },
    ];

    // Info column wraps; rows grow to fit multi-line entries
    const infoX = x + 210;
    const infoWrapWidth = this.panelX + this.panelWidth / 2 - 50 - infoX;

    let yy = y - 10;
    roster.forEach((e) => {
      const dot = this.scene.add.circle(x + 8, yy + 13, 5, e.color);
      c.add(dot);
      this.line(c, x + 26, yy, e.name.padEnd(9), PALETTE.creamCss, 22);
      this.line(c, x + 150, yy, e.night, PALETTE.amberFaintCss, 20);

      const info = this.scene.add.text(infoX, yy, e.info, {
        ...terminalStyle(20, PALETTE.amberDimCss),
        wordWrap: { width: infoWrapWidth },
        lineSpacing: 4,
      });
      c.add(info);

      yy += Math.max(38, info.height + 14);
    });
    yy += 8;
    this.line(c, x, yy, 'Later nights add threats the manual does not cover. Good luck.', PALETTE.alertDimCss, 20);
  }
}
