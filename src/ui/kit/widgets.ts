import Phaser from 'phaser';
import { PALETTE, osdStyle, terminalStyle } from './theme';
import { playMenuButtonSound, playMenuHoverSound } from '../../utils/menuSounds';

/**
 * Terminal-style widgets: text-list menus with a blinking `>>` cursor,
 * OSD labels, and bordered panels. Replaces the per-button rectangle +
 * copy-pasted hover handler pattern.
 */

export interface TerminalMenuItem {
  id: string;
  label: string;
  /** Render in alert red (Nightmare Mode, Give Up) */
  danger?: boolean;
  /** Faint and unselectable */
  disabled?: boolean;
  onSelect?: () => void;
  /** If set, item responds to ◀ ▶ (arrow keys / clicking the arrows) */
  onLeft?: () => void;
  onRight?: () => void;
}

export interface TerminalMenuOptions {
  x: number;
  y: number;
  /** Vertical distance between items */
  pitch?: number;
  fontSize?: number;
  /** Return true to ignore keyboard input (e.g. overlay open) */
  isBlocked?: () => boolean;
  /** Enable up/down/enter/space keyboard navigation */
  keyboard?: boolean;
}

export interface TerminalMenu {
  container: Phaser.GameObjects.Container;
  setLabel(id: string, label: string): void;
  setDisabled(id: string, disabled: boolean): void;
  destroy(): void;
}

export function createTerminalMenu(
  scene: Phaser.Scene,
  items: TerminalMenuItem[],
  opts: TerminalMenuOptions
): TerminalMenu {
  const pitch = opts.pitch ?? 44;
  const fontSize = opts.fontSize ?? 28;
  const container = scene.add.container(opts.x, opts.y);

  const selectable = (i: number) => !items[i].disabled;
  let activeIndex = items.findIndex((it) => !it.disabled);
  if (activeIndex < 0) activeIndex = 0;

  const texts: Phaser.GameObjects.Text[] = [];
  const arrowPairs: Array<{ left: Phaser.GameObjects.Text; right: Phaser.GameObjects.Text } | null> = [];

  // Blinking cursor
  const cursor = scene.add.text(-34, 0, '>>', terminalStyle(fontSize, PALETTE.amberCss)).setOrigin(0, 0.5);
  container.add(cursor);
  const blink = scene.time.addEvent({
    delay: 420,
    loop: true,
    callback: () => cursor.setVisible(!cursor.visible),
  });

  const colorFor = (i: number, active: boolean): string => {
    const it = items[i];
    if (it.disabled) return PALETTE.amberFaintCss;
    if (it.danger) return active ? PALETTE.alertCss : PALETTE.alertDimCss;
    return active ? PALETTE.creamCss : PALETTE.amberDimCss;
  };

  const refresh = () => {
    texts.forEach((t, i) => {
      const active = i === activeIndex;
      t.setColor(colorFor(i, active));
      const arrows = arrowPairs[i];
      if (arrows) {
        const c = active ? PALETTE.amberCss : PALETTE.amberFaintCss;
        arrows.left.setColor(c);
        arrows.right.setColor(c);
      }
    });
    // Items with ◀ ▶ arrows need the cursor further left to avoid overlap
    cursor.setX(arrowPairs[activeIndex] ? -72 : -34);
    cursor.setY(activeIndex * pitch);
    cursor.setColor(items[activeIndex]?.danger ? PALETTE.alertCss : PALETTE.amberCss);
    cursor.setVisible(true);
  };

  const setActive = (i: number, silent = false) => {
    if (i === activeIndex || !selectable(i)) return;
    activeIndex = i;
    if (!silent) playMenuHoverSound();
    refresh();
  };

  const select = (i: number) => {
    const it = items[i];
    if (!it || it.disabled || !it.onSelect) return;
    playMenuButtonSound();
    it.onSelect();
  };

  items.forEach((it, i) => {
    const t = scene.add.text(0, i * pitch, it.label, terminalStyle(fontSize)).setOrigin(0, 0.5);
    container.add(t);
    texts.push(t);

    if (it.onLeft || it.onRight) {
      const left = scene.add
        .text(t.x - 8, i * pitch, '◀', terminalStyle(fontSize - 4))
        .setOrigin(1, 0.5);
      const right = scene.add
        .text(t.x + t.width + 12, i * pitch, '▶', terminalStyle(fontSize - 4))
        .setOrigin(0, 0.5);
      container.add([left, right]);
      arrowPairs.push({ left, right });

      left.setInteractive({ useHandCursor: true });
      right.setInteractive({ useHandCursor: true });
      left.on('pointerdown', () => {
        setActive(i, true);
        playMenuButtonSound();
        it.onLeft?.();
      });
      right.on('pointerdown', () => {
        setActive(i, true);
        playMenuButtonSound();
        it.onRight?.();
      });
    } else {
      arrowPairs.push(null);
    }

    if (!it.disabled) {
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => setActive(i));
      t.on('pointerdown', () => {
        setActive(i, true);
        select(i);
      });
    }
  });

  // Keyboard navigation
  const keyHandlers: Array<{ event: string; fn: (e: KeyboardEvent) => void }> = [];
  if (opts.keyboard !== false && scene.input.keyboard) {
    const kb = scene.input.keyboard;
    const move = (dir: number) => {
      if (opts.isBlocked?.()) return;
      let i = activeIndex;
      for (let step = 0; step < items.length; step++) {
        i = (i + dir + items.length) % items.length;
        if (selectable(i)) break;
      }
      setActive(i);
    };
    const on = (event: string, fn: (e: KeyboardEvent) => void) => {
      kb.on(event, fn);
      keyHandlers.push({ event, fn });
    };
    on('keydown-UP', () => move(-1));
    on('keydown-DOWN', () => move(1));
    on('keydown-W', () => move(-1));
    on('keydown-S', () => move(1));
    on('keydown-LEFT', () => {
      if (opts.isBlocked?.()) return;
      const it = items[activeIndex];
      if (it.onLeft) {
        playMenuButtonSound();
        it.onLeft();
      }
    });
    on('keydown-RIGHT', () => {
      if (opts.isBlocked?.()) return;
      const it = items[activeIndex];
      if (it.onRight) {
        playMenuButtonSound();
        it.onRight();
      }
    });
    on('keydown-ENTER', () => {
      if (opts.isBlocked?.()) return;
      select(activeIndex);
    });
    on('keydown-SPACE', () => {
      if (opts.isBlocked?.()) return;
      select(activeIndex);
    });
  }

  refresh();

  return {
    container,
    setLabel(id: string, label: string) {
      const i = items.findIndex((it) => it.id === id);
      if (i < 0) return;
      texts[i].setText(label);
      const arrows = arrowPairs[i];
      if (arrows) {
        arrows.right.setX(texts[i].x + texts[i].width + 12);
      }
    },
    setDisabled(id: string, disabled: boolean) {
      const i = items.findIndex((it) => it.id === id);
      if (i < 0) return;
      items[i].disabled = disabled;
      refresh();
    },
    destroy() {
      blink.remove();
      keyHandlers.forEach(({ event, fn }) => scene.input.keyboard?.off(event, fn));
      container.destroy();
    },
  };
}

/** Small camera-OSD label, e.g. `REC ● CAM 07` */
export function createOsdLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 18,
  color: string = PALETTE.amberDimCss
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, osdStyle(size, color));
}

/** Bordered terminal panel with faint amber hairline */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  fillAlpha = 0.92
): Phaser.GameObjects.Rectangle {
  const panel = scene.add.rectangle(x, y, width, height, PALETTE.panel, fillAlpha);
  panel.setStrokeStyle(1, PALETTE.amberFaint);
  return panel;
}

/**
 * Clickable terminal text button (for overlay close buttons, presets, etc.)
 */
export function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  size = 22,
  danger = false
): Phaser.GameObjects.Text {
  const idle = danger ? PALETTE.alertDimCss : PALETTE.amberDimCss;
  const hot = danger ? PALETTE.alertCss : PALETTE.creamCss;
  const t = scene.add.text(x, y, label, terminalStyle(size, idle)).setOrigin(0.5);
  t.setInteractive({ useHandCursor: true });
  t.on('pointerover', () => {
    playMenuHoverSound();
    t.setColor(hot);
  });
  t.on('pointerout', () => t.setColor(idle));
  t.on('pointerdown', () => {
    playMenuButtonSound();
    onClick();
  });
  return t;
}
