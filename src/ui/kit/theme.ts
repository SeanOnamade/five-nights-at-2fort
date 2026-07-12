/**
 * Security-terminal UI theme — single source of truth for menu styling.
 *
 * Identity: every menu is a screen on the Engineer's security console.
 * Amber phosphor on near-black, one alert red reserved for danger actions.
 */

export const PALETTE = {
  /** Near-black CRT background */
  bg: 0x0a0704,
  bgCss: '#0a0704',
  /** Slightly lifted panel background */
  panel: 0x140e06,
  panelCss: '#140e06',
  /** Primary amber phosphor */
  amber: 0xffb454,
  amberCss: '#ffb454',
  /** Dim amber for secondary text / idle items */
  amberDim: 0x8a6230,
  amberDimCss: '#8a6230',
  /** Very dim amber for hairlines and disabled */
  amberFaint: 0x3d2c14,
  amberFaintCss: '#3d2c14',
  /** Cream for headings (TF2 poster cream) */
  cream: 0xf0e6d2,
  creamCss: '#f0e6d2',
  /** Alert red — ONLY danger actions (Nightmare, Give Up) */
  alert: 0xff3b30,
  alertCss: '#ff3b30',
  /** Dim alert red */
  alertDim: 0x7a2420,
  alertDimCss: '#7a2420',
} as const;

export const FONTS = {
  /** Terminal body text (bitmap CRT look) */
  terminal: 'VT323, "Courier New", monospace',
  /** Title / display headers */
  display: '"Fjalla One", Impact, "Arial Narrow", sans-serif',
} as const;

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Big display title (home screen game title) */
export function titleStyle(size = 76): TextStyle {
  return {
    fontFamily: FONTS.display,
    fontSize: `${size}px`,
    color: PALETTE.creamCss,
  };
}

/** Section heading in display font */
export function headingStyle(size = 30, color: string = PALETTE.creamCss): TextStyle {
  return {
    fontFamily: FONTS.display,
    fontSize: `${size}px`,
    color,
  };
}

/** Terminal menu item / body text */
export function terminalStyle(size = 26, color: string = PALETTE.amberCss): TextStyle {
  return {
    fontFamily: FONTS.terminal,
    fontSize: `${size}px`,
    color,
  };
}

/** Small camera-OSD label (REC ● CAM 07 ...) */
export function osdStyle(size = 18, color: string = PALETTE.amberDimCss): TextStyle {
  return {
    fontFamily: FONTS.terminal,
    fontSize: `${size}px`,
    color,
  };
}

/** Italic hint / log-entry text */
export function hintStyle(size = 20, color: string = PALETTE.amberCss): TextStyle {
  return {
    fontFamily: FONTS.terminal,
    fontSize: `${size}px`,
    color,
    fontStyle: 'italic',
  };
}
